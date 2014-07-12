---
layout: post
title: Подробнее о Celery
permalink: /blog/34-celery-described
---
Пока проверял как [Celery](http://ask.github.com/celery/getting-started/introduction.html) работает с MySQL в качестве брокера, материала набежало на большую статью. Сергей Лебедев, спасибо за этот замечательный [вопрос](http://vorushin.ru/blog/32-celery-task-queuejob-queue-based-distributed-messa/#comments)!
<!--more-->

### Проблемная область

В каждом более-менее крупном веб-проекте появляются задачи, которые не укладываются в короткий цикл запроса-ответа HTTP. Отправка уведомлений по почте - сервер может не отвечать 20 секунд, зачем же заставлять клиента ждать, можно отдать ему страничку "Письмо будет отправлено" и завершить отправку почту в фоновом (не-webserver) процессе. Отправка уведомлений поисковику и отправка pingbacks при создании новой статьи в блоге - в этих случаях тоже не обязательно заставлять пользователя ждать, когда запросы будут обработаны (может пройти тоже 10-20 секунд). Эти задачи можно выполнять в отдельных тредах, но нет гарантий, что они будут выполнены (например, веб-сервер может быть перестартован, когда задача будет выполнена наполовину, а после старта никто про задачу и не вспомнит).

Одним из первых и самых простых решений этой проблемы были [ghetto queues](http://news.ycombinator.com/item?id=655318) - создавалась табличка в базе данных, туда складывались задания, а отдельная группа приложений последовательно их выполняла. Такой подход реализован в библиотеке [ghettoq](http://github.com/ask/ghettoq). Основной недостаток - трудность (а порой и невозможность) оперативной обработки задач, потому что получение задач из базы производится периодически (а если опрашивать базу данных слишком часто, то создается напрасная нагрузка на сервер даже в случае, когда задач в очереди нет).

С появлением open-source messaging systems (RabbitMQ, ActiveMQ, Stomp, ...) стало возможным исправить этот недостаток. В этих системах регистрируются очереди и их обработчики. При появлении новых сообщений в очереди, обработчики сразу же их получают. У этих систем стали появляться общие стандарты, самым распространенным из которых стал AMQP, они стали активно использоваться в веб-проектах. 

Проект [Celery](http://ask.github.com/celery/getting-started/introduction.html) позволяет описывать задачи на Python и запускать их на нескольких серверах, распределяя их с помощью брокера, в качестве которого может выступать RabbitMQ (рекомендованный вариант), Stomp, Redis и даже большинство СУБД (а точнее те, с которыми умеет работать Django ORM). Если задача возвращает какой-то полезный результат, то он может быть сохранен в СУБД, Redis или снова помещен в AMQP. Celery может быть тесно интегрирован с django-проектами, что не удивительно, поскольку он стартовал как django-приложение. Также Celery можно использовать и из любого другого python-фреймворка, если использование Django ORM в глубинах Celery не оскорбляет ваши религиозные убеждения.

### Установка Celery

Устанавливаем через pip (кто еще не знает, что это такое, смотрите [Pip, virtualenv и virtualenvwrapper](http://vorushin.ru/blog/29-pip-virtualenv-virtualenvwrapper/)):

    $ pip install celery
    
Для программ celeryd, celeryinit нужно сделать символические ссылки, либо добавить путь к ним в PATH. Ниже - команды создания символических ссылок для Mac OS X + MacPorts:

    $ sudo ln -s /opt/local/Library/Frameworks/Python.framework/Versions/2.6/bin/celeryd /usr/bin/celeryd
    $ sudo ln -s /opt/local/Library/Frameworks/Python.framework/Versions/2.6/bin/celeryinit /usr/bin/celeryinit

### Настройка брокера

Устанавливаем и настраиваем RabbitMQ. Привожу инструкции для Mac OS X + MacPorts:

    $ sudo port install rabbitmq-server
    
Если у вас имя хоста задается DHCP-сервером (например: 124-23-11-02.starnet.ru), то нужно задать постоянное имя хоста:

    $ sudo scutil --set HostName myhost.local

А затем отдактировать /etc/hosts:

    127.0.0.1       localhost myhost myhost.local
    
Запускаем RabbitMQ:

    $ sudo rabbitmq-server
    
Создаем пользователя и виртуальный хост RabbitMQ специально для Celery:

    $ rabbitmqctl add_user celery celery
    $ rabbitmqctl add_vhost celery_test
    $ rabbitmqctl set_permissions -p celery_test celery "" ".*" ".*"

### Создание и выполнение задач

Создаем директорию с тестовым проектом:

    $ mkdir celery_test
    $ cd celery_test
    $ touch __init__.py
    
Создаем файл tasks.py с описанием задач:

    from celery.decorators import task

    @task
    def square_sum(n):
        return sum(i*i for i in xrange(0, n+1))
        
Создаем файл celeryconfig.py и записываем настройки Celery:

    BROKER_HOST = "localhost"
    BROKER_PORT = 5672
    BROKER_USER = "celery"
    BROKER_PASSWORD = "celery"
    BROKER_VHOST = "celery_test"
    CELERY_BACKEND = "amqp"
    CELERY_IMPORTS = ("tasks", )

Запускаем обработчик задач из текущей директории:

    $ PYTHONPATH="." celeryd --loglevel=INFO
    
В соседней консоли заходим в эту директорию и запускаем python shell (рекомендую [IPython](http://vostryakov.ru/blog/16-otkryvayu-zanovo-ipython/)):

    >>> from tasks import square_sum
    >>> result = square_sum.delay(100)
    >>> print result.result

### Celery, Carrot, MySQL

Если RabbitMQ поставить ну уж никак невозможно (например, не хватает памяти для Erlang-а, или места на диске, или прав), но есть старая добрая MySQL, то мы можем использовать проект [Carrot](http://github.com/ask/carrot/) от Ask Solem (автора Celery). Carrot - это AMQP Messaging Framework for Python, т.е. с его помощью мы сможем создать AMQP-обертку вокруг базы MySQL.

    $ pip install -U ghettoq
    $ mysql -u root
      mysql> create database celery_test character set = utf8;
      mysql> create user 'celery'@'localhost' identified by 'celery';
      mysql> grant all privileges on celery_test.* to 'celery'@'localhost';

Редактируем celeryconfig.py:

    CARROT_BACKEND = "ghettoq.taproot.Database"
    CELERY_IMPORTS = ("tasks", )

    INSTALLED_APPS = ("ghettoq", )

    DATABASE_ENGINE = 'mysql'
    DATABASE_NAME = 'celery_test' 
    DATABASE_HOST = ''
    DATABASE_PORT = ''
    DATABASE_USER = 'celery'
    DATABASE_PASSWORD = 'celery'
    
Из текущей директории вызываем celeryinit (аналог manage.py syncdb из django):

    $ PYTHONPATH="." celeryinit
    
Все готово, можно запускать рабочий процесс:

    $ PYTHONPATH="." celeryd --loglevel=INFO
    
Отправляем задачи на выполнение так же, как и в примере с RabbitMQ. Я заметил, что задачи отрабатывают очень быстро - похоже используется какой-то способ получения уведомления о новой записи в таблице MySQL.

### Бонус - задачи, выполняемые по расписанию

Кроме того, есть приятный бонус - можно создавать задачи, запускающиеся периодически (например, каждые полчаса). Эта функциональность не заменяет cron, но в одном из проектов мне как раз требовалось каждые 15 минут аггрегировать данные, а лезть ради этого в cron совсем не хотелось. 

Подробнее смотрите в документации: [Periodic Tasks](http://ask.github.com/celery/getting-started/periodic-tasks.html), [Ensuring a task is only executed one at a time](http://ask.github.com/celery/cookbook/tasks.html#ensuring-a-task-is-only-executed-one-at-a-time) и комплексный пример [Tutorial: Creating a click counter using carrot and celery](http://ask.github.com/celery/tutorials/clickcounter.html).

### Заключение

Если хорошо знаешь экосистему своего любимого языка программирования, то полурабочих велосипедов становится меньше, а код становится проще и понятнее другим разработчикам (недавно я просматривал код django-проекта, который программист писал год, он не использовал ни одного стороннего приложения, всё написал сам; так делать не стоит). Другие важные строительные кирпичики python-проектов: [Fabric](http://vorushin.ru/blog/10-razvertyvanie-django-proektov-c-pomoshyu-fabric/), [Pip, virtualenv, virtualevnwrapper](http://vorushin.ru/blog/29-pip-virtualenv-virtualenvwrapper/).