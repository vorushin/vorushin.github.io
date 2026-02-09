---
layout: post-en
title: "TPU/GPU communication primitives"
lang: en
permalink: /blog/tpu-gpu-communication-primitives
published: false
---

Training LLMs on TPUs/GPUs is often constrained not by the speed of the matrix multiplication unit (MXU), but either by data transfer from high bandwidth memory (HBM) to MXU, or by data transfer between different TPUs. A large part of optimizing training/inference programs consists of finding ways to overlap data transfer and matrix multiplication operations - transferring data that will be needed soon while systolic arrays in MXU (or tensor cores on GPUs) are busy computing.

Moving data between TPUs is much slower than moving data between HBM and VMEM (the TPU vector cache). For example, for TPU v5p, HBM ↔ VMEM bandwidth is $2.8 \times 10^{12}$ bytes/s, while bidirectional links between TPUs have bandwidth $9 \times 10^{10}$ bytes/s (31× slower). This means we need to plan carefully **when** and **how** to move data between TPUs:

- **When**: ideally in advance, while MXU units are computing other data
- **How**: minimize the amount of data moved while maximizing link utilization (moving a single byte between 2 TPU v5p takes the same time as moving 45KB, see [How To Scale Your Model](https://jax-ml.github.io/scaling-book/sharding/), "A note on ICI latency")
<!--more-->
Long ago when data parallelism was all we needed, we mostly used **AllReduce** (parallel sum operation), but nowadays we use three primitives: **AllGather**, **ReduceScatter**, and **AllToAll**. AllReduce can be replaced by a combination of ReduceScatter and AllGather.

## AllGather

{% include all-gather-ring.html %}

- **Start**: $V$ bytes of a matrix are evenly sharded between $N$ TPUs - every TPU holds $\frac{V}{N}$ bytes
- **Finish**: every TPU holds $V$ bytes of the replicated matrix
- **Cost**: we move approximately $V$ bytes through every link in $\frac{N}{2}$ hops, evenly saturating links in both directions (except for the last hop)

The animation above shows AllGather for an $8 \times 8$ block matrix, sharded 8 ways. We move 56 blocks of data through every link: $8 \times 4 = 32$ blocks in one direction and $8 \times 3 = 24$ blocks in the other direction. The latency in the bottleneck direction (CW on the animation above) is defined by the time it takes to move these 32 blocks in one direction. Having *block_size* as the size of every block in bytes, and $\frac{W_{bidir}}{2}$ as the throughput of the interconnect links in one direction we get the following formula (for the case of $N = 8$):

$$T = \frac{32 \times block\_size}{\frac{W_{bidir}}{2}} = \frac{64 \times block\_size}{W_{bidir}} = \frac{V}{W_{bidir}}$$ 

Note that the time does not depend on the size of the ring / number of shards, it only depends on the full size of the matrix and the bidirectional speed of the interconnect links. Also note that each direction provides $\frac{W_{bidir}}{2}$ bandwidth — the total $W_{bidir}$ is split across two dedicated send/receive lanes.

It's interesting that AllGather on GPUs where a switch-based topology is used loads the send/receive lanes in a less balanced way. Every GPU sends $\frac{1}{N}V$ bytes and receives $\frac{N-1}{N}V$ bytes.

## ReduceScatter

**Reduce** in the name means an operation of reducing dimensionality of the data (going from $N$ to $N-1$ dimensions), same as the Python *functools.reduce* function (going from a list to a scalar). The Python function takes a list and a function that combines two elements together. For LLM training this combining operator is most often *sum* (add two numbers). The corresponding JAX function is called psum_scatter (parallel sum + scatter).

**Scatter**: while we send the data from every TPU to every other TPU, the reduced/summed data ends up scattered/sharded - different TPUs hold different shards of the data.

{% include reduce-scatter-ring.html %}

- **Start**: Every TPU holds $V$ bytes of a matrix with partial results - they have to be reduced before becoming useful.
- **Finish**: Every TPU holds a single shard of $\frac{V}{N}$ bytes with the reduced/summed data.
- **Cost**: we move approximately $V$ bytes through every link in $\frac{N}{2}$ hops, evenly saturating links in both directions (except for the last hop) - same as for AllGather.

It's easy to see that the communication cost of ReduceScatter is the same as for the AllGather (32 blocks or $\frac{V}{2}$ bytes move CW and 24 blocks or less than $\frac{V}{2}$ move CCW through every link).

The switch-based case is perfectly balanced: every node sends $\frac{N-1}{N}V$ bytes and receives $\frac{N-1}{N}V$ bytes. The latency is still the same as for AllGather: even though AllGather sends less data, the latency is dominated by the receiving part.

### Back propagation

ReduceScatter is also a counterpart of AllGather in **backward vs forward** passes. When there is an AllGather in a forward pass, we have ReduceScatter in the backward pass, and vice versa - a ReduceScatter in a forward pass calls for an AllGather in a backward pass.

### Note on AllReduce

*AllReduce* is usually implemented as a combination of *ReduceScatter* + *AllGather*. We can separate these two operations in time - perform *ReduceScatter* when we have the partial data, and perform *AllGather* closer to the time when we want to compute on the full matrix with the data (why wait? see the animation for AllGather - after the operation the matrix takes N times more HBM on every TPU).

Sometimes we can keep the data sharded and avoid running *AllGather* completely. Anyway, *AllReduce* isn't a communication primitive, it's a composite one.

## AllToAll

This operation is unrelated to *AllGather* and *ReduceScatter*. It's so important for modern MoE (mixtures-of-experts) implementations, that there are usually multiple implementations of it heavily tuned for the specific topologies, accelerator generations, and the character of work (training, inference, batch size, latency vs throughput).

{% include all-to-all-ring.html %}

AllToAll transposes the data sharding. It takes a matrix sharded by its first dimension and produces a matrix sharded by its second dimension. It's used for MoE implementations where in the forward pass we have tokens sharded by the sequence dimension and assigned to any experts. *AllToAll* reshuffles them so that they are sharded by experts - the expert MLPs live on different TPUs. After the expert MLPs have done their work, we run another *AllToAll* and get tokens sharded by the sequence dimension - ready for the next transformer block.

*AllToAll* costs 1/4 of the *AllGather* or *ReduceScatter* - even though the simple animation above has 10 blocks moved CW per link, and 6 blocks moved CCW, there is a simple optimization that turns it into a perfectly balanced scheme with 8 blocks moving CW and 8 blocks moving CCW (see the hidden section below).

<details>
<summary>See the balanced AllToAll animation</summary>

{% include all-to-all-ring-balanced.html %}

</details>
<br>
In the switch-based case of *AllToAll* every node sends $\frac{N-1}{N^2} \approx \frac{1}{N}$ data and receives $\frac{N-1}{N^2} \approx \frac{1}{N}$ data. It's more efficient than the ring-based topologies for N > 4.

### Back propagation

*AllToAll* is its own counterpart for the **backprop**. It can't be simpler than that.

## Epilogue

Cross-TPU/GPU communication primitives aren't scary at all. Most distributed ML operations boil down to *AllGather* and *ReduceScatter* (with Reduce = Sum in the majority of cases), which have simple logic (once the visualizations are internalized), have the same communication cost, and are each other's counterparts in the forward-backward passes. *AllReduce* is just *AllGather* + *ReduceScatter*. *AllToAll* is a new kid on the block. It's very important for efficient MoE implementations, especially its ragged (variable sizes of the shards) variants.

I highly recommend reading [How To Scale Your Model](https://jax-ml.github.io/scaling-book/) (aka "The TPU book") for much more useful details about writing efficient LLM training and inference programs on TPUs and GPUs.

If you want to see a fuller list of cross-GPU operations - take a look at [Collective Operations](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html) from NVIDIA docs.