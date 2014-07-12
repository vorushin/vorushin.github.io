---
layout: post
title: Развертывание Django-проектов c помощью Fabric
permalink: /blog/10-razvertyvanie-django-proektov-c-pomoshyu-fabric
---
В одном из проектов необходимо регулярно выкладывать код из ветки stage на staging сервер. Начали делать это вручную - входишь через ssh, делаешь git push origin stage, если нужно - обновляешь базу и затем перезапускаешь apache. К концу этой недели решили, что хорошо бы все эти действия выполнять одной командой. Я прошерстил блоги - сейчас очень активно пишут про использования для этих целей библиотеки [Fabric](http://fabfile.org) (это аналог [Capistrano](http://www.capify.org/) из Ruby on Rails).
<!--more-->

###Как установить

Установите библиотеку fabric через pip или easy_install, затем создайте символическую ссылку для приложения fab, либо добавьте папку с bin файлами в вашем Python-дистрибутиве в PATH. Ниже - краткая инструкция для Mac OS X + ports.

    sudo pip-2.6 install fabric
    sudo ln -s /opt/local/Library/Frameworks/Python.framework/Versions/2.6/bin/fab /usr/local/bin/fab

###Что делает Fabric

Fabric позволяет выполнять самые разнообразные действия по ssh на целой группе серверов. Действия описываются в файле fabfile.py и представляют собой обычные питоновские функции. Обычно fabfile.py кладут в корневую папку проекта (рядом с manage.py, settings.py, urls.py, ...). 

    from fabric.api import *
    env.hosts = ['root@moodbox.com']
        
    def deploy():
        local('hg push')
        with cd('hgreps/vorushin_ru'):
            run('hg update')
            run('/etc/init.d/apache2 reload')
    
Теперь если я запускаю fab deploy из папки с проектом vorushin_ru (код этого блога, написанного на Django), то сначала с моей локальной машины произойдет push, затем по ssh на сервере будет сделан update с последующим перезапуском апача.

###Всякие тонкости

* Во-первых, работа по ssh должна идти через сертификаты. См. [ssh-keygen](http://www.electrictoolbox.com/article/linux-unix-bsd/create-rsa-dsa-keys-ssh/), [ssh authorized keys](http://www.google.com/search?q=ssh+authorized_keys).
* Во-вторых, если необходимо делать pull с другого сервера, то нужно добавлять [параметр -A при вызове ssh](http://lincolnloop.com/blog/2009/sep/22/easy-fabric-deployment-part-1-gitmercurial-and-ssh/).
* В-третьих, если развертывание делает поочередно команда разработчиков, то у файлов проекта должны быть [права на запись всей группой разработчиков](http://lincolnloop.com/blog/2009/oct/7/easy-fabric-deployment-part-2/).
* В-четвертых, если под апачем запущено несколько проектов, то его лучше перестартовывать через [touch your.wsgi](http://habrahabr.ru/blogs/django/56029/) (если mod\_wsgi настроен для работы в daemon\_mode).