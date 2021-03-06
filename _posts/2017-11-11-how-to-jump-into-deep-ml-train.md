---
layout: post
title: Как запрыгнуть в поезд глубокого машинного обучения
permalink: /blog/how-to-jump-into-deep-ml-train
---

В 2011 году MOOC классы ml-class.org и ai-class.org в 2011 году взорвали мне мозг (см [блог пост того времени](https://vorushin.github.io/blog/69-on-stanford-online-classes)).

1. С компьтерами можно делать еще более интересные и сложные вещи, чем я думал
2. Всему этому можно научиться сейчас, не переживать что в университете изучал что-то совсем другое (у меня диплом инженера-электрика)

Я решил что нужно [изучать](https://vorushin.github.io/blog/73-new-horizons) это все удивительное и интересное, что называется Computer Science и искать работу, где бы я занимался этим целыми днями. Так год спустя я проснулся в цюрихском отеле, уставший после 3 дней автотрипа Киев-Цюрих, позавтракал и пошел на свой [первый рабочий день в Google](https://vorushin.github.io/blog/78-i-work-at-google-zurich).

В Гугле я со временем дорвался до возможности реализовывать и улучшать сложные алгоритмы в системах работающих под огромной нагрузкой. Следующее мое большое желание - залезть в глубокое машинное обучение (Deep Machine Learning). Я имею в виду именно convolutional neural nets, RNNs, куча слоев, residual nets, нелинейные активационные функции. Работа с картинками-видео-звуком, неструктурированным текстом.

В нашем офисе проектов с Deep ML очень много, но меня останавливала разница в моих навыков и навыками ребят, которые в них работают. Как правило это PhD, читающие статьи с кучей математики за кофе, попутно делая в уме wavelet transforms. Поэтому я не бросился с головой в один из таких проектов, хотя может быть просто была куча других забот (интеграция, изучение языков).

Поэтому я использовал свой любимый подход - в любой непонятной ситуации погугли. Я нашел список математических навыков, необходимых для Deep ML, а также книги и онлайн-курсы про само это глубокое непонятно что.
<!--more-->

### Математика

Так же как жизнь computer scientist полна ужасов без знания дискретной математики, в поле боя ML лучше выходить освоив два вида оружия: линейную алгебру и теорию вероятностей. Хорошие новости в том, что не нужно становиться экспертом в эти областях, вводного курса на 1-2 месяца для начала вполне хватит.

Линейную алгебру я изучал по [курсу MIT](https://ocw.mit.edu/courses/mathematics/18-06-linear-algebra-spring-2010/). Купил книгу, смотрел видео, делал домашние задания и экзамены. Он требует некоторой самоогранизованности, это не современный coursera класс, в котором все интегрировано и проверяется автоматически. К тому же он покрывает намного больше, чем нужно для начала в ML.

Из более легких материалов - [Linear Algebra в Khan Academy](https://www.khanacademy.org/math/linear-algebra) и [Essence of Linear Algebra от 3Blue1Brown](https://www.youtube.com/watch?v=kjBOesZCoqc&list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab) (весь этот YouTube channel просто бомба).

По теории вероятностей подвернулся курс на Coursera "Probability" от профессора Santosh S. Venkatesh, который в настоящее время недоступен. Но есть очень много других материалов.

По моим первым шагам в Deep ML основы линейной алгебры сейчас нужны больше, чем теория вероятностей. Поэтому вполне можно начать только с нее.

Перед праздниками не особо хотелось изучать серьезные вещи по вечерам и я стал искать игры для любителей поломать мозг. Одним из открытий для меня стал шахматный сайт [lichess.org](https://lichess.org).

### Deep ML

Из самого свежака - 5 курсов от Andrew Ng (ml-class.org) и команды deeplearning.ai на Coursera: [Deep Learning Specialization](https://www.coursera.org/specializations/deep-learning). Стоит 49$ / месяц. Зато все задания интегрированы в Coursera, все базовые вещи подробно и наглядно объяснены, даже есть часть про огранизацию ML-проекта. Это реальная бомба. Доступно, интересно. Лекции можно смотреть со смартфона по дороге на работу, домашние задания хорошо структурированы и вполне доставляют.

Я еще попутно просмотрел много других курсов, но мне кажется вполне можно справиться без них. Вот неполный их список:

* [CS231n Winter 2016, Stanford](https://www.youtube.com/watch?v=g-PvXUjD6qg&list=PLlJy-eBtNFt6EuMxFYRiNRS07MCWN5UIA)
* [Deep Learning by Google @Udacity](https://www.udacity.com/course/deep-learning--ud730)
* [Bay Area Deep Learning School 2016](https://www.youtube.com/playlist?list=PLrE1razUE9q151v_k-HnidYbPV45T8JCv)
* [Neural Networks for Machine Learning @Coursera](https://www.coursera.org/learn/neural-networks)

А вот книги могу порекомендовать две, обе отличные:

* [neuralnetworksanddeeplearning.com](http://neuralnetworksanddeeplearning.com) (попроще)
* [www.deeplearningbook.org](http://www.deeplearningbook.org) (подетальнее, включая research)

### Практика

Единственное что даст возможность по настоящему залезть в эту область, это - практика. В идеале постоянная работа над такими проектами, как минимум - реализация учебных проектов в свободное время, участие в [конкурсах](https://www.kaggle.com/).

Тут у меня пока негусто, это следующее что я планирую делать.

А как у вас дела? Я знаю что есть люди успешно запрыгнувшие в этот поезд. Поделитесь опытом?
