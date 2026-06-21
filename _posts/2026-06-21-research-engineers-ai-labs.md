---
layout: post-en
title: "Research Engineers in AI labs"
lang: en
permalink: /blog/research-engineers-ai-labs
---

I often get asked what kind of work research engineers in AI labs like Google DeepMind do. Mostly in the context of software engineers considering getting a job in one of the frontier/neo AI labs.

## System engineering

Designing, writing, maintaining systems running on a classical stack: RPC servers, data storages, queues, caching. Storing/updating/serving training and eval data. Storing and querying metrics. RL environments.

There is a ton of "classical" software engineering work. The difference is that one has to be really good at defining useful abstractions and communicate/negotiate them with people of varying backgrounds: scientists, engineers, managers. An experienced engineer can have a lot of leverage, and the impact is easy to attribute.

All of that is [Designing Data-Intensive Applications](https://www.oreilly.com/library/view/designing-data-intensive-applications/9781491903063/) + strong communication skills and design taste to build pieces of software that provide the useful beautiful abstractions and are implemented in a scalable way.

Writing training codebases is at the extreme end of this part - it's usually much more successful when designed/written by people that speak both languages: science and engineering.

## TPUs go brrr

Racks of TPUs and GPUs are very different from a set of CPU servers. They are very expensive and scarce - no organization has too many of them. Knowing how to effectively program them is a rare and valuable skill. REs can help in writing efficient kernels, optimizing existing programs to use fewer TPUs/GPUs, and/or run faster on them. [More intelligence per compute unit](https://vorushin.github.io/resume).

Here one needs to learn in depth how these accelerators work, how they are connected, and the patterns for getting the most out of them during training and inference.
 
## Resources

I listened to [the podcast with Vlad Feinberg](https://www.youtube.com/watch?v=cDyi91onoJ8) - it's full of great recommendations on how to start in this area.

Also [The TPU book](https://jax-ml.github.io/scaling-book/) is amazing, [CS 336](https://cs336.stanford.edu/) is a great Stanford class, and then of course [JAX documentation](https://docs.jax.dev/en/latest/) and NVIDIA docs for your favorite kernel libs.

Reiner Pope has 2 amazing lectures on the hardware: [1](https://www.youtube.com/watch?v=xmkSf5IS-zw) and [2](https://www.youtube.com/watch?v=oIk3R-sMX5o).