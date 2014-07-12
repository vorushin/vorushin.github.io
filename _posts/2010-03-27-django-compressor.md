---
layout: post
title: django-compressor
permalink: /blog/django-compressor
---
Есть 2 задачи, связанные с .css и .js файлами, которые возникают при регулярном деплойменте веб-проектов. Первая - минимизация размера. Есть много утилит, позволяющих убрать комментарии и лишние пробелы, тем самым сократив размер файла, который скачивает браузер клиента. Вторая - версионирование. Если у вас файл со стилями доступен по ссылке /media/css/main.css, то при его обновлении многие клиенты продолжат пользоваться старой версией файла, сохраненной в кеше браузера. 

Меня особо заботила именно вторая задача - я менял css в этом блоге, а он не обновлялся у посетителей до тех пор, пока они не нажимали в своих браузерах Ctrl+R (Cmd+R). Я нашел отличное django-приложение [django-compressor](http://github.com/mintchaos/django_compressor), которое решает эту задачу следующим образом:
<!--more-->

В шаблонах все включения css и js оборачиваются шаблонным тегом compress

{% raw  %}
    {% load compress %}
    {% compress css %}
    <link rel="stylesheet" type="text/css" media="all" href="{{ MEDIA_URL }}css/main.css"/> 
    <link rel="stylesheet" type="text/css" media="all" href="{{ MEDIA_URL }}css/highlight/styles/vs.css"/>
    {% endcompress %}
{% endraw  %}

В settings.py указывается набор фильтров для сжатия

    COMPRESS = True
    COMPRESS_YUI_BINARY = 'java -jar /Users/vorushin/Java/yuicompressor-2.4.2.jar'
    COMPRESS_CSS_FILTERS = ['compressor.filters.yui.YUICSSFilter']

В результате, вместо двух css-файлов создается один css-файл со ссылкой вида /media/CACHE/css/105af1963311.css. При изменении исходных css-файлов (а точнее при изменении их даты последнего изменения), файл генерируется заново. Актуальное имя результирующего файла хранится в кеше.

Отмечу, что не все версии django-compressor меня радовали - месяц назад я натыкался на несколько неприятных ошибок, которые в версии 0.5.3 уже исправлены. Если у кого-то тоже были сложности с django-compressor - дайте ему еще один шанс, проект довольно активно развивается, к тому же его автор [Jannis Leidel aka jezdez](http://jannisleidel.com/) - отличный разработчик!

django-compressor на GitHub - [http://github.com/mintchaos/django_compressor](http://github.com/mintchaos/django_compressor)