---
layout: post-en
title: "LLM pretraining on TPU with a $50 budget"
lang: en
permalink: /blog/llm-pretraining-tpu-budget
---

Andrej Karpathy has the [nanochat](https://github.com/karpathy/nanochat) project with the description "The best ChatGPT that $100 can buy". He evolved a model architecture and training setup that reaches performance of GPT-2 while costing 600 times less than the original OpenAI run in 2019. This is an inspiring example, showing that pretraining experiments can be available even to individuals without corporate/university backing. Andrej's run took ~3 hours on 8xH100 for 3 hours, costing $73.

I decided to investigate how much LLM pretraining research can be done using latest TPUs on a tight personal budget - without paying more that we pay for our coding assistants. Google Colab Pro+ has a $50 / month plan that provides 600 credits. These credits can buy GPU/TPU kernels. Supported TPUs: v5e, v6e. Their price (in Colab credits) is the same, while v6e (Trillium) packs 2x more HBM, and has 4.7x quicker matmuls. We only consider v6e (Trillium) below, but the provided notebook supports v5e as well[^1].

[^1]: The free Colab plan allows to use v5e, but not v63. The free quota is enough for a few short training runs. v5e has less HBM, but it's not critical for ~100M models.

## Back of the envelope calculations

Here are the Trillim performance specs from the [Google Cloud docs](https://docs.cloud.google.com/tpu/docs/v6e).

| Specification | Values |
|--------|-------|
| Peak compute per chip (bf16) | 918 TFLOPs |
| Peak compute per chip (Int8) | 1836 TOPs |
| HBM capacity per chip | 32 GB |
| HBM bandwidth per chip | 1600 GBps |

It packs a ton of matmul power - over 50x more than my new Macbook Pro with M4 Pro, enough High-Bandwith Memory that is connected by 1600 GBps lines, ~6x faster than my Macbook's unified memory. It natively supports bf16 and Int8 operations. fp32 is typically not used for matmuls. We sometimes use fp32 for accumulation of results that require high precision (e.g., for applying small changes to the model weights), and for having higher precision of some intermediate computation (e.g., output logits), but rarely perform multiplication of two fp32 tensors[^2].

[^2]: When needed we can use multiple bf16 matmuls to emulate fp32 matmuls of different levels of precission. See [jax.lax.Precision](https://docs.jax.dev/en/latest/jax.lax.html#jax.lax.Precision) and [Leveraging the bf16 AI Datatype For Higher-Precision Computations by G. Henry et al.](https://arxiv.org/abs/1904.06376).

Let's do math. Assuming we can saturate the MXU (maxrix multiplication units) at 50% of their peak capacity, how long would it take at train a ~100M LLM for the Chinchilla optimal 20 tokens per param?

$$\text{FLOPs required} = 6 \times 100 \times 10^6 \times (100 \times 10^6 \times 20) = 1.2 \times 10^{18}$$

$$\text{Time} = \frac{1.2 \times 10^{18}}{918 \times 10^{12} \times 0.5} = 2614 \text{ seconds}$$

We can train such a model in under one hour, neat! In my experiments below I fiddle with a 130M non-embedding param model bumping this training time to \\(2614 \times 1.3 \times 1.3 = 4413\\) seconds, still quite fast!

## Strong baseline

I take as much as possible from nanochat: the dataset, the tokenizer training, modern Transformer modifications (RoPE, RMSNorm, GQA, QK-Norm, logit softcap, pre-norm). I throw in SwiGLU, use AdamW instead of muon, drop value embeddings as they are not mainstream.

Here is the shape of the transformer I got:

| Parameter | Value |
|-----------|-------|
| d_model (n_embd) | 1024 |
| Layers (n_layer) | 8 |
| Query heads (n_head) | 4 |
| KV heads (n_kv_head) | 1 (MQA) |
| Head dim | 256 |
| MLP dim | 3072 (SwiGLU) |
| Vocab size | 32 * 1024 |
| Sequence length | 2048 |
| Batch size | 64 (16 microbatches x 4) |
| Total params | 163.6M |
| Non-embedding params | 130.0M |

TPU v6e does matmuls of 256*256 blocks - we need to make sure that our large tensor dimensions are divisible by 256, and are layed out in a TPU friendly way[^3]. We use bf16 for all computation. We optionaly use fp32 outputs[^4] for the final logit computation (reduces MFU by 4pp).

[^3]: [DotGeneral](https://openxla.org/xla/operation_semantics#dotgeneral) is a good start.
[^4]: The MXU takes two bf16 tensors as an input and produces the output in fp32. Most often the fp32 result is not needed (it's defined by the *preferred_element_type* argument), therefore it's converted back into bf16 before it's written back to HBM.

Training config: AdamW with lr=1e-4, beta1=0.9, beta2=0.95, weight_decay=0.1, warmup 2%, warmdown 50% (cosine to 0).

* Project on GitHub: <img src="https://github.githubassets.com/favicons/favicon.svg" width="16" height="16" style="display:inline; vertical-align:text-bottom; margin:0;"> <a href="https://github.com/vorushin/tpuchat">vorushin/tpuchat</a>.
* The ablation notebook in Google Colab: <a href="https://colab.research.google.com/github/vorushin/tpuchat/blob/master/08_tpu_ablations.ipynb?flush_caches=true">08_tpu_ablations.ipynb</a>.

<details>
<summary>Hints for using Google Colab + GitHub</summary>

If you modify your notebooks with Claude Code and push the updated versions to your GitHub, add "?flush_caches=true" to your Colab URL. We are writing the notebooks in Jupytext percent format (*.py files) and convert them to ipynb format only before commiting (.ipynb is harder to edit directly because of JSON escaping). In 08_tpu_ablations we also bump the visible rev numbers so that it's easy to know which notebook revision you're running now.
<img src="/img/tpu_ablations/colab_top.png" alt="Colab notebook screenshot">
</details>

What to do there? 

**Once:** retrain the baseline and remember the numbers (for the hero runs they are stored in wandb). Make sure the baseline has the optimal hparams, and not just default ones - run a hparam sweep of a fraction of the data for hat. We discoved that the default learning rate value *3e-4* is a bit too large for our baseline. See the amazing "Physics of LM part 4.1" videos (link) and slides (link) to understand why it's important to tune hparams. Also see "Learning Rate Matters: Vanilla LoRA May Suffice for LLM Fine-tuning"[^5].

[^5]: "Crucially, once learning rates are properly tuned, all methods achieve similar peak performance (within 1-2%), with only subtle rank-dependent behaviors." [arXiv](https://arxiv.org/abs/2602.04998)

<figure>
<img src="/img/tpu_ablations/lr_to_val_loss.png" alt="Learning rate to validation loss graph" width=600>
<figcaption>Results from the hparam search — we usually have a low validation loss basin in a wide enough LR range, but these basins can shift significantly after changing the model architecture, the optimizer, or the training data mix.</figcaption>
</figure>

My hero run reached val_loss 3.209. Here are some fun generations from the model (you can load it in the last cells of the notebook and play more):

<div class="model-output">
<div class="model-prompt">In a distant galaxy, scientists discovered</div>
<div class="model-completion">In a distant galaxy, scientists discovered an alien world hidden behind the dusty surface of the galaxy, and in this case, it is the closest known galaxy to the Earth. This is the galaxy known as the Milky Way, and it is made up of two massive galactic accumulations.</div>
</div>

<div class="model-output">
<div class="model-prompt">The theory of relativity states that</div>
<div class="model-completion">The theory of relativity states that it is possible to form the curvature of space. It also explains why space is flat. It is the result of a collision between two objects. Space is the result of the collision of two objects, but the gravitational force between them is so small that it is impossible to build the curvature of space. </div>
</div>

**Many times:** try some archicture changes (I added some knobs, but it's easy to add more), train on a different data mix (e.g., some high quality mix from NVidia, or completely synthetic data like in Physics of LM 4.1), go crazy with optimizer preconditioning or try muon variants. Make sure to tune haparams for the new variant and then run the hero run!

Read below for the details of what had to be done differently than in nanochat to reach this high MFU on TPU.

## Road to 50% MFU

{Roman: dig my LOG.md and write a timeline here, I will edit it later}

{Agent: Here's the timeline extracted from LOG.md:

**Day 1 (Feb 15) — First training run.** Tokenizer training, basic JAX training notebook. First run on v5e: val loss 10.40 → 5.27 in 18 minutes. Identified bottlenecks: input-bound data loading, slow scatter-add in backward pass. Fixed with PrefetchDataLoader and fused cross-entropy. Switched to v6e. ~107K tok/s.

**Day 2 (Feb 16) — Architecture tuning.** Disabled Value Embeddings (+14% speedup). Tied embed/unembed weights. Benchmarked attention: default einsum (14.5% MXU) vs jax.nn.dot_product_attention (14.6%) vs Pallas splash attention (up to 25.3%). Reduced KV heads 8→2, reached 27.7% MXU. Tried head_dim=256 to match the v6e MXU block size. Long training run: 1.6B tokens, 197 min, val loss 3.25.

**Day 3 (Feb 17) — Hyperparameter sweeps.** Created wandb sweep notebook. Explored LR (5e-5 to 1e-3), weight_decay (0.01 to 0.2). Best: lr=7e-4, wd=0.1. Attempted 685M model — only 24.7% MXU. Created MaxText-inspired variant with SwiGLU and explicit 256-aligned dimensions.

**Day 4 (Feb 18) — Memory optimization.** Chunked lm_head loss: peak memory 29.80 → 28.39 GB, fragmentation 8.65% → 0.03%.

**Day 5 (Feb 19) — Benchmark suite.** Fixed performance benchmark — had been using v5e's 197 TFLOPS instead of v6e's 918. Measured ~45% MXU for full fwd+bwd.

**Day 6 (Feb 20) — The big fix.** Created ablation notebook. **Critical discovery**: manual AdamW per-leaf loop inside @jax.jit traced 58 separate adamw_step calls into the XLA graph, preventing fusion. Switched to optax.adamw() (uses jax.tree.map). Result: 36ms → 22ms/step, 22% → 37% MFU. Tested microbatching (4 × 16 = 64): 45.8% MFU, 464K tok/s, 50.8% MXU.

**Day 7 (Feb 21) — 50% MXU achieved.** Final config: n_head=4, batch_size=64, 163.6M params (130M non-embed). **46.5% MFU, 434K tok/s, 51.6% MXU.**}

### How about TPU v5e?

{Roman: analyze why it's easier to get to the high MXU utilization on the older generation}

{Agent: The answer is arithmetic intensity — FLOPs per byte of memory traffic.

v6e has 918 TFLOPS of compute but only 1600 GB/s of HBM bandwidth. To keep the MXU busy, you need 918e12 / 1600e9 ≈ **574 FLOPs/byte**. v5e has 197 TFLOPS and ~819 GB/s, needing only 197e12 / 819e9 ≈ **241 FLOPs/byte**.

v6e packs 4.7x more matmul power but only 2x more bandwidth. The bar for saturation is much higher. Our ~130M model at batch_size=64 generates enough arithmetic intensity to comfortably exceed v5e's threshold (hence 80.6% MXU) but falls short of v6e's (hence 51.4% MXU). The model is simply too small to keep v6e's larger MXU fully fed — it runs out of compute work before it runs out of memory transfers.

To push v6e utilization higher we'd need larger batch sizes, longer sequences, or a bigger model — all of which increase the ratio of compute to memory traffic.}

Yes, but the price is the same, while v5e throughput is 3x smaller than v6e. Feel free to use v5e Colab kernel if you have no Colab Pro plan.

v6e:
tok/s: 433,606
Utilization of TPU Matrix Units	
51.4%

v5e:
tok/s: 148,829
Utilization of TPU Matrix Units	
80.6%


Details:
* Parts that led to poor MFU
* MFU analysis with the increased complexity of the tested components
* Using XProf

Style:
* Minimal texts, easily readable.
* Format of a story with important highlights:
- A strong baseline
- what to do differently when training on JAX/TPU (vs PyTorch/GPU), note that CC often has wrong hypotheses
- Important tools to compute MFU and how to use XProf
* Many pictures, but useful ones.
* Use footnotes - make them in a similar style to the Thinking Machines blog.

No bullshit, no filling phrases.

What is the simplest/max-pure-JAX setup with a reasonable MXU?
What is the more advanced one, but still hackable?
A quest to rewrite everything in Pallas with custom VJPs.

 A notable drawback of using the Colab plans - they are expected to be used by humans, not by agents.
