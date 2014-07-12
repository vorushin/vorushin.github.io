---
layout: post
title: Programmers at work (1989)
permalink: /blog/68-programmers-work-1989
---
С большим удовольствием читаю книгу ["Programmers at work"](http://www.amazon.com/Programmers-Work-Interviews-Computer-Industry/dp/1556152116), выпущенную в 1989 году. Думаю, что она понравится всем тем, кому понравилась книга ["Coders at work"](http://www.codersatwork.com/) ([также известная как "Кодеры за работой"](http://softwaremaniacs.org/blog/2011/04/02/coder-at-work-in-russian/)). Ниже - некоторые цитаты, которые я уже подчеркнул (а я еще в самом начале книги).
<!--more-->

SIMONYI: 
I think the listing gives the same sort of pleasure that you get from a clean home. You can just tell with a glance if things are messy--if garbage and unwashed dishes are lying about--or if things are really clean. It may not mean much. Just because a house is clean, it might still be a den of iniquity! But it is an important first impression and it does say something about the program. I'll bet you that from ten feet away I can tell if a program is bad. I might not guarantee that it is good, but if it looks bad from ten feet, I can guarantee you that it wasn't written with care. And if it wasn't written with care, it's probably not beautiful in the logical sense. But suppose it looks good. You then pick deeper. To understand the structure of a program is much, much harder. Some people have different opinions about what makes the structure beautiful. There are purists who think only structured programming with certain very simple constructions, used in a very strict mathematical fashion, is beautiful. That was a very reasonable reaction to the situation before the sixties when programmers were unaware of the notion of structuring. But to me, programs can be beautiful even if they do not follow those concepts, if they have other redeeming features. It's like comparing modern poetry with classical poetry. I think classical poetry is great and you can appreciate it. But you can't limit your appreciation to just classical poetry. It also doesn't mean that if you put random words on paper and call it poetry, there will be beauty. But if a code has some redeeming qualities, I don't think it needs to be structured in a mathematical sense to be beautiful.

I think the best way to supervise is by personal example and by frequent code reviews. We try to do code reviews all the time.

SIMONYI: 
There are a lot of formulas for making a good candidate into a good programmer. We hire talented people. I don't know how they got their talent and I don't care. But they are talented. From then on, there is a hell of a lot the environment can do. Programmers get a couple of books on their first day here. One of them, called HowtoSolveIt,is by George Polya, the mathematician. (Simonyi takes the book from a bookcase next to his desk and opens it to a certain page.) These two pages are important. The rest of the book just elaborates on these two pages. This is like a checklist for problem solving. This is the preflight, the takeoff, and the landing checklist. It doesn't mean this will tell you how to fly, but it does mean if you don't do this, then you can crash even if you already know how to fly. We follow these four steps of problem solving: first, understanding the problem, then devising a plan, carrying out the plan, and, finally, looking back. We have about four books like this and I think we make the programmers better than when they arrive.

"Any organization that designs a system … will produce a design whose structure is a copy of the organization’s communications structure." [Conway's Law](http://en.wikipedia.org/wiki/Conway's_Law)


LAMPSON: 
There are some basic techniques to control complexity. Fundamentally, I divide and conquer, break things down, and try to write reasonably precise descriptions of what each piece is supposed to do. That becomes a sketch of how to proceed. When you can't figure out how to write a spec, it's because you don't understand what's going on. Then you have two choices: Either back off to some other problem you do understand, or think harder. Also, the description of the system shouldn't be too big. You may have to think about a big system in smaller pieces. It's somewhat like solving problems in mathematics: You can write books that are full of useful hints, but you can't give an algorithm

INTERVIEWER: 
Do you think there are certain techniques that lead to a good program or a good system? 

LAMPSON: 
Yes. The most important goal is to define as precisely as possible the interfaces between the system and the rest of the world, as well as the interfaces between the major parts of the system itself. The biggest change in my design style over the years has been to put more and more emphasis on the problem to be solved and on finding techniques to define the interfaces precisely. That pays off tremendously, both in a better understanding of what the program really does, and in identification of the crucial parts. It also helps people understand how the system is put together. That's really the most important aspect of designing a program.

INTERVIEWER:
What qualities does a programmer need to write a successful program? 

LAMPSON: 
The most important quality is the ability to organize the solution to the problem into a manageable structure, with each component specified in a simple way. Sometimes successful programmers can do that but can't explain what they did, because they can't see the structure. Some people are good programmers because they can handle many more details than most people. But there are a lot of disadvantages in selecting programmers for that reason--it can result in programs that no one else can maintain.

WARNOCK: 
There are very few really talented designers. Some people are very good at one particular thing or another, but systems design takes real balance, taking a list of options here and a list of options there, and combining them so they really work well together. A lot of people design an algorithm and then design the system around that algorithm. Good systems design is much more of an engineering activity; it’s a set of trade-offs and balances among various systems’ components. I think the most difficult part of systems design is knowing how to make those trade-offs and balances among the various components.