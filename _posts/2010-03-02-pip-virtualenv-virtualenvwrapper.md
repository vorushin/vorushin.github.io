---
layout: post
title: Pip, virtualenv и virtualenvwrapper
permalink: /blog/pip-virtualenv-virtualenvwrapper
---
В мейл-конференции Python-Dev всерьез обсуждают [включение фукнциональности virtualenv в Python](http://www.mail-archive.com/python-dev@python.org/msg45750.html). Это очень удобный инструмент питониста, позволяющий легко работать на одной машине с разными версиями библиотек (например, с django 1.0.4 и django из транка), быстро передавать список зависимостей проекта другим разработчикам (а они смогут поставить все библиотеки одной командой), упрощают деплоймент.
<!--more-->

### Pip

Утилита pip предназначена для установки питоновских библиотек из [PyPI](http://pypi.python.org), из архивного файла, из git-a, в общем - отовсюду.

    pip install South (установить последнюю версию South из PyPI)
    pip install http://www.aeracode.org/releases/south/south-0.6.2.tar.gz (установить South из указанного файла)
    pip install hg+http://bitbucket.org/andrewgodwin/south/ 
                       (установить South из транка, кроме hg+ поддерживаются также svn+, git+, bzr+)
    pip install South==0.5 (установить конкретную версию)
    pip uninstall South

### Virtualenv

Скрипт virtualenv позволяет создать изолированное рабочее окружение. Команда virtualenv tests --no-site-packages создает в текущей директории папку tests с подпапками bin, include, lib. В папке bin создаются линки на easy_install, pip и текущую версию интерпретатора python. Параметр --no-site-packages запрещает использовать уже установленные system-wide библиотеки. Чтобы *войти* в это изолированное окружение, нужно выполнить команду source tests/bin/activate. После активации окружения все команды pip воздействуют только на текущее окружение.

    virtualenv tests --no-site-packages
    source tests/bin/activate

Устанавливаем пакеты.    
    
    pip install Django
    pip install South
    
Формируем список установленных пакетов - для передачи другому разработчику или для деплоймента.

    pip freeze > requirements.txt
    
Содержимое файла requirements.txt:

    Django==1.1.1
    South==0.6.2
    wsgiref==0.1.2

Устанавливаем все пакеты из этого файла одной командой:

    pip install -r requirements.txt
    
### Virtualenvwrapper

Через какое-то время разработчики обленились и решили, что переходить в папку, где хранятся все окружения и делать там source env_name/bin/activate - это слишком долго. Они создали вспомогательные скрипты, которую позволяют сменить окружение одной командой. Одним из самых популярных стал набор скриптов virtualenvwrapper. Руководство по установке смотрите [на сайте разработчика virtualenvwrapper Doug Hellman](http://www.doughellmann.com/projects/virtualenvwrapper/).

После установки и настройки работа с виртуальными окружениями становится еще более удобной.

Создаем два окружения, tests и big_project:

    mkvirtualenv tests --no-site-packages
    mkvirtualenv big_project --no-site-packages

Переходим в tests и ставим несколько библиотек:    

    workon tests
    pip install Django
    pip install South

Переходим в big_project и ставим другие версии библиотек:    

    workon big_project
    pip install Django==1.0.4
    pip install South==0.5

Удаляем окружение tests:    

    rmvirtualenv tests
    
Все команды можно вызывать из любой папки, все виртуальные окружения создаются в специальной папке WORKON_HOME (по умолчанию, $HOME/.virtualenvs). Переключение между окружение - одной единственной командой workon. Красота!

* Pip - [http://pip.openplans.org/](http://pip.openplans.org/).
* Virtualenv - [http://pypi.python.org/pypi/virtualenv](http://pypi.python.org/pypi/virtualenv)
* Virtualenvwrapper - [http://www.doughellmann.com/projects/virtualenvwrapper/](http://www.doughellmann.com/projects/virtualenvwrapper/)
