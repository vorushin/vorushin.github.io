---
layout: post
title: Почему системы так хорошо работают
permalink: /blog/why-systems-work-so-well
---
![Thinking in Systems, book cover](https://images.gr-assets.com/books/1390169859l/3828902.jpg)

Читаю книгу [Thinking in Systems, A Primer](https://www.amazon.com/Thinking-Systems-Donella-H-Meadows/dp/1603580557), на которую наткнулся в гугловых рекомендациях для инженеров. Книга - бомба! Короткая, по делу, открывает глаза на структуры и процессы в больших компаниях, сложных инженерных проектах. Полезна и для дизайна распределенных систем, и для навигации внутри больших компаний.

Глава 3 вообще оказалась про то, о чем я давно размышлял. В последнее время я замечаю много дискуссий на эти темы как внутри Гугла, так и среди друзей в других компаниях и некоммерческих организациях. Эти дискуссии - в основном о (вреде) иерархий и важной роли самоогранизации.

И тут я читаю, что иерархию придумала природа как замечательный и необходимый инструмент борьбы со сложностью. И я ведь из проектирования программных систем это знаю на практике, в том числе про то, что связность внутри компонентов может быть большой, а зависимость между компонентам небольшой и четко определенной. И про то, что сверточные нейронные сети (convolutional neural networks) работают так хорошо именно потому, что они оперируют иерархиями фильтров, распознавая таким образом иерархическую природу изображений (зрачок-радужка-белок-веки собираются в глаз, глаза-нос-рот-волосы собираются в голову, голова-тело-руки-ноги в человека, много человек в группу и т.п.).

Ну и конечно, очень многое перекликается с моими наблюдениями в среде стартапов, и опытом родительства.
<!--more-->

Ниже цитаты из этой главы:

## Resilience

Resilience has many definitions, depending on the branch of engineering, ecology, or system science doing the defining. For our purposes, the normal dictionary meaning will do: "the ability to bounce or spring back into shape, position, etc., after being pressed or stretched. Elasticity. The ability to recover strength, spirits, good humor, or any other aspect quickly." Resilience is a measure of a system's abilily to survive and persist withing a variable environment. The opposite of resilience is brittleness or rigidity.

Resilience is something that may be very hard to see, unless you exceed its limits, overwhelm and damage the balancing loops, and the system structure breaks down. Because resilience may not be obvious without the whole-system view, people often sacrifice resilience for stability, or for productivity, or for some other more immediately recognizable system property.

## Self-organization

The most marvelous characteristic of some complex system is their ability to learn, diversify, complexify, evolve.

This capacity if a asystem to make its own structure more complex is called self-organization. You see self-organization in a small, mechanistic way whenever you see a snowflake, or ice feathers on a poorly insulated window, or a supersaturated solution suddenly forming a garden of crystals. You see self-organization in a more profound way whenever a seed sprouts, or a baby learns to speak, or a neighborhood decides to come together to oppose a toxic waste dump.

Self-organization is such a common property, particularly of living systems, that we take it for granted. If we weren't nearly blind to the property of self-organization, we would do better at encouraging, rather than destroying, the self-organizing capacities of the systems of which we are a part.

Like resilience, self-organization is often sacrificed for purposes of short-term productivity and stability. Productivity and stability are the usual excuses for turning creative human beings into mechanical adjuncts to production processes. Or for narrowing the genetic variability of crop plants. Or for establishing bureaucracies and theories of knowledge that treat people as if they were only numbers.

Self-organization produces heterogeneity and unpredictability. It is likely to come up with whole new structures, whole new ways of doing things. It requires freedom and experimentation, and a certain amount of disorder.

Fortunately, self-organization is such a basic property of living systems that even the most overbearing power structure can never fully kill it, although in the name of law and order, self-organization can be suppressed for long, barren, cruel, boring periods.

Science knows now that self-organizing systems can arise from simple rules. Science, itself a self-organizing system, likes to think that all the complexity of the world must arise, ultimately, from simple rules.

## Hierarchy

In the process of creating new structures and increasing complexity, one thing that a self-organizing system often generates is hierarchy.

The world, or at least the parts of it humans think they understand, is organized in subsystems aggregated into larger subsystems, aggregated into still larger subsystems. A cell in your liver is a subsystem of an organ, which is a subsystem of you as an organism, and you are a subsystem of a family, an athletic team, a musical group, and so forth. These groups are subsystems of a town or city, and then a nation, and then the whole global socioeconomic system that dwells within the biosphere system. This arrangment of systems and subsystems is called a hierarchy.

If subsystems can largely take care of themselves, regulate themselves, maintain themselves, and yet serve the needs of the larger system, while the larger system coordinates and enhances the functioning of the subsystems, a stable, resilient, and efficient structure results. It is hard to imagine how any other kind of arrangment could have come to be.

Hierarchies ... reduce the amount of information that any part of the system has to keep track of.

In hierarchical systems relationships within each subsystem are denser and stronger than relationships between subsystems.

The original purpose of a hierarchy is always to help its originating subsystems do their jobs better. This is something, unfortunately, that both the higher and the lower levels of a greatly articulated hierarchy easily can forget. Therefore, many systems are not meeting our goals because of malfunctioning hierarchies.

If a team member is more interested in personal glory than in the team winning, he or she can cause the team to lose. If a body cell breaks free from its hierarchical function and starts multiplying wildly, we call it a cancer. If students think their purpose is to maximize personal grades instead of seeking knowledge, cheating and other counterproductive behaviors break out. If a single corporation bribes the government to favor that corporation, the andvantages of the competitive market and the good of the whole society are eroded.

When a subsystem's goals dominate at the expense of the totatl system's goals, the resulting behavior is called suboptimization.

Just as damaging as suboptimization, of course, is the problem of too much central control. ... Economic examples of overcontrol from the top, from companies to nations, are the causes of some of the great catastrophes of history, all of which are by no means behind us.

To be a highly functional system, hierarchy must balance the welfare, freedoms, and responsibilities of the subsystems and total system - there must be enough central control to achieve coordination toward the large-system goal, and enough autonomy to keep all subsystems flourishing, functioning, and self-organizing.

## Нужно читать не только про Computer Science

Теперь я думаю, что надо бы почаще выбираться за рамки Computer Science и изучать самое интересное из казалось бы нетехнических областей. Вот уже два года с большим удовольствие читаю [блог о психологии](http://evo-lutio.livejournal.com/), недавно по совету друзей проглотил [книгу об инвестировании](https://www.amazon.com/gp/product/1533667926/). Хорошо быть открытым к новому, особенно когда какой-то практический опыт уже есть и многие принципы уже выстраданы на практике.