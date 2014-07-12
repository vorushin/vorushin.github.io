---
layout: post
title: Celery - task queue/job queue based on distributed message passing
permalink: /blog/celery-task-queuejob-queue-based-distributed-messa
---
Определяем в питоновском коде задачи, которые должны выполняться асинхронно:

    from celery.decorators import task

    @task
    def add(x, y):
        return x + y

Запускаем несколько обработчиков на разных серверах (все они связываются брокером, в качестве которого может выступать RabbitMQ, Stomp, Redis и большинство современных СУБД)

Запускаем задачу на асинхронное выполнение:

    result = add.delay(4, 4)

Изначально celery создавался как специфическое django-app, а сейчас хорошо работает с любым питоновским проектом. Есть также поддержка "задач по расписанию" (cron-like).

Документация по celery на GitHub - [http://ask.github.com/celery/getting-started/introduction.html](http://ask.github.com/celery/getting-started/introduction.html)