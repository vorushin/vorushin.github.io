---
layout: post-en
title: "Best explanations of how LLMs work"
lang: en
permalink: /blog/best-explanations-llms
---

I maintain a set of best explanations[^deutsch] of how LLMs train and work.

"LLMs" here is a broad term for the frontier models that create value in 2026. They have more components than just a language model, but powerful language models are their necessary core.

## Universal explainers

**Considering:** humans are **universal explainers** (Deutsch) - they use creativity to explain the world.

**Conjecture:** LLMs are **universal explainers** on a non-biological substrate.

That's the opposite of the claim that LLMs are *stochastic parrots* - that they only imitate, without understanding or creating new knowledge.

## Creativity

### Creativity in humans

* Evolved to understand complex human memes.
  * Apes understand only simple memes, limited to a small inborn vocabulary.
  * A complex human meme, by contrast - how to build a campfire: it needs a rich vocabulary and requires the learner to iteratively generate and improve hypotheses about what the teacher is trying to explain.
* Happened to have universal reach.
  * Create better explanations of reality, critique them, test them, create better ones still.
  * Powers scientific progress since the Renaissance.

### Creativity in LLMs

* Initially, creativity was crucial for understanding the intent behind underspecified user prompts (hepfulness).
* Now it seems to have universal reach - models can drive complex agentic loops for hours, iterating toward specified goals.
  * Powers demand for semiconductors, tokens, and 2026 IPOs.

## LLMs are <del>programmed</del> grown

A biological metaphor, in the spirit of Chris Olah's framing[^olah]:

* Neural networks are **grown, not programmed or built** (though the closest thing to programming here is differentiable functional programming[^dfp]).
* A neural-network architecture is like a scaffold upon which circuits grow.
* The loss objective is the light that guides the network's growth toward the desired outcome.
* The resulting network is akin to a biological entity - an organism that we can study.

## LLM pre-training

* Loss: predict the **distribution** of next tokens (not just the single most-probable token). The model has many steps (layers) and a large latent scratchpad (token embeddings + residual streams).
* Memorizing all the input data isn't enough - the training set is usually much larger than the number of model parameters.
* The model discovers recursive self-similarities in the data, learning the deeper truths about the reality the training data describes.
* Implicitly - without us programming it - the model invents whatever algorithm works best for learning these deeper truths (see [differentiable functional programming](https://colah.github.io/posts/2015-09-NN-Types-FP/) and [Software 2.0](https://karpathy.medium.com/software-2-0-a64152b37c35)).

## Reinforcement Learning

* Provides practice using external tools, beyond thinking in the latent space between layers: scratchpad, calculator, web search, and so on.
* Long RL is a chance to learn efficient strategies for self-critique and error correction - critical for long-horizon agentic tasks.
* Much less compute-efficient than pre-training, but this can be fixed by mid-training on the best RL trajectories.

## Persona training

LLM impersonating a coherent persona[^ant_persona] seems to be better at long horizon tasks. Without the persona training the LLM can switch between a wide range of human-like entities. Good for creative writing, not really helpful for getting things done. 

## Computation

LLMs are doing great by using only classical (as opposed to quantum) computation. Human brains seem to be powered by the classical computation as well.

* Human brains are deemed quite energy efficient - strong evidence that with the good solutions for continuous learning, sparsity, modularity the LLMs can be reasonably efficient as well.
* Data movement (outside -> chip) scales harder that computation[^tpu_eff].
* Most flos in LLMs are matrix multiplications; the large part of GPUs/TPUs chips holds the input/output matrices and systolic arrays that multiply them.
* Many recent algorithmic improvements build on the idea of sparse computation or smooth optimization.
* Another important vector: lowering precision. Keep weights and activations in nice regions that don't require many bits to represent - save a lot of energy and die area.

## Science of scaling

Very strong beliefs about the perfect solution to artificial general intelligence may handicap more than help, especially when blindly held. Nonetheless, it's important to keep track of approaches that help, approaches that don't help, and revisit the previously non-working approaches on more data and compute.

Simple ideas seem to scale the best. But getting to them often requires to trying multiple ad-hoc/narrow improvements first, and only later seeing a more general thread.

[^deutsch]: David Deutsch, *[The Beginning of Infinity: Explanations That Transform the World](https://www.thebeginningofinfinity.com/)*. Good explanations - bold, creative conjectures that are *hard to vary* while still precisely accounting for the world.
[^olah]: The particular set of metaphors is from the last hour of [this interview](https://www.youtube.com/watch?v=ugvHCXCOmm4).
[^dfp]: Chris Olah, *[Neural Networks, Types, and Functional Programming](https://colah.github.io/posts/2015-09-NN-Types-FP/)* (2015): "It feels like a new kind of programming altogether, a kind of differentiable functional programming." Yann LeCun later popularized the broader term "differentiable programming."
[^ant_persona]: Sam Marks, Jack Lindsey, Christopher Olah *[The Persona Selection Model: Why AI Assistants might Behave like Humans](https://alignment.anthropic.com/2026/psm/)*
[^tpu_eff]: See "TPUs and Energy Efficiency (TPUv4)" in *[TPU Deep Dive](https://henryhmko.github.io/posts/tpu/tpu.html)*