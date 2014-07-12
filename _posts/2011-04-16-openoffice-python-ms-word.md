---
layout: post
title: OpenOffice + Python, pабота с файлами MS Word
permalink: /blog/58-openoffice-python-ms-word
---
Пару недель назад для проекта [Grammarly Handbook](http://handbook.grammarly.com) понадобилось импортировать много форматированного текста из документов MS Word. Текст находился в 40 файлах размером от одной до двадцати страниц. Первые несколько страниц я перенес вручную и несколько утомился - механическая работа меня не очень радует. Начал искать возможность читать вордовские документы из Питона.

У меня был очень позитивный опыт с библиотеками [xlrd](http://pypi.python.org/pypi/xlrd), [xlwt](http://pypi.python.org/pypi/xlwt). Первая читает документы Excel, а вторая - записывает. Но подобных библиотек для документов \*.doc я не нашел. Зато нашел возможность обращаться из Python к OpenOffice. Эту возможность я успешно использовал, успешно импортировал весь грамматический материал и даже наткнулся на интересную идею для нашего основного продукта - [инструмента проверки грамматики Grammarly](http://grammarly.com).
<!--more-->

### Установка OpenOffice и python-uno

Сначала я поставил OpenOffice под Mac OS X, но оказалось что python bindings там только для python версии 2.3. То же самое справедливо и для Windows. Благо у меня всегда под рукой VirtualBox, в котором установлена Ubuntu. Для чистоты эксперимента я прямо сейчас поставлю чистую Ubuntu 11.04, куда и поставлю все необходимые пакеты.

    sudo aptitude install openoffice.org openoffice.org-writer python-uno

В Ubuntu 11.04 вместо OpenOffice используется независимый от Oracle форк LibreOffice. Запускаем LibreOffice и говорим ему слушать порт 2002:

    libreoffice -accept="socket,host=localhost,port=2002;urp;StarOffice.ServiceManager"

### Работа с документами

Ставим ipython и git-core. Клонируем вспомогательные функции [python-uno-utils](https://gist.github.com/923032), которые я выложил в github gist. Запускаем ipython из папки с python-uno-utils.

    sudo aptitude install ipython git-core
    git clone git://gist.github.com/923032.git python-uno-utils
    cd python-uno-utils
    ipython

Сначала нужно импортировать модуль uno - в нем есть import hooks, которые выполнят всю необходимую магию, чтобы в нашей питоновской консоли работал python-uno.

    In [1]: import uno

Затем подключаем python-uno-utils

    In [2]: %run python-uno-utils.py

Команда %run выгодно отличается от import тем, что после изменения файла достаточно выполнить команду повторно и продолжать работать с уже измененными функциями-классами без перезагрузки консоли.

Открываем документ hello.doc, который я создал специально для этой статьи. Видим как появляется новое окно LibreOffice с этим документом.

    In [3]: doc = open_document('http://dl.dropbox.com/u/318944/python-uno/hello.doc')

![Screenshot - opened document](http://dl.dropbox.com/u/318944/python-uno/scr1.png)

Документ состоит из параграфов:

    In [4]: print_elements(doc.Text)
    Привет!

    Это список:
    Раз
    Два
    Три

    Разные цвета: красный, зеленый, синий.

    Bold, italic.

Каждый параграф может состоять из кусочков (spans) с разным форматированием.

    In [5]: l = list_elements(doc.Text)
    In [6]: print l[7].getString()
    Разные цвета: красный, зеленый, синий.

    In [7]: print_elements(l[7])
    Разные цвета:
    красный
    ,
    зеленый
    ,
    синий
    .

    In [8]: l = list_elements(l[7])

    In [9]: color(l[0])
    Out[9]: 'black'

    In [10]: color(l[1])
    Out[10]: 'red'

    In [11]: color(l[2])
    Out[11]: 'black'

    In [12]: color(l[3])
    Out[12]: 'green'

    In [13]: color(l[4])
    Out[13]: 'black'

    In [14]: color(l[5])
    Out[14]: 'blue'

    In [15]: color(l[6])
    Out[15]: 'black'

После успешной работы с документом, закрываем его:

    In [16]: doc.dispose()

Также смотрите в [python-uno-tools](https://gist.github.com/923032): iter\_elements, nonempty\_elements, is\_leaf, is\_bold, is\_italic, is\_underline, is\_list.

Дополнительная информация - [http://lucasmanual.com/mywiki/OpenOffice](http://lucasmanual.com/mywiki/OpenOffice).