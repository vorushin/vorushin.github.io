---
layout: post
title: Интерактивная консоль для pyuno + django
permalink: /blog/61-pyuno-django-interactive-shell
---
Недавно я писал про то, [как работать с документами LibreOffice из питона](http://vorushin.ru/blog/58-openoffice-python-ms-word/). Я сейчас работаю над исследовательским проектом, в котором django application обращается к LibreOffice через pyuno. В этом проекте натолкнулся на неприятную ошибку - ./manage.py shell при выполнении любых связанных с pyuno методов выдает сообщение "SystemError: pyuno runtime is not initialized, (the pyuno.bootstrap needs to be called before using any uno classes)". При этом если запустить python и сделать в нем import uno, а потом вызывать те же методы, что и в ./manage.py shell, то все работает отлично, за исключением того, что не получается обращаться к своим моделям (потому что не инициализировано окружение django).
<!--more-->
Покопавшись в исходниках django.core.management.commands.shell, обнаружил что виноваты две строчки кода:

    def handle_noargs(self, **options):
        # XXX: (Temporary) workaround for ticket #1796: force early loading of all
        # models from installed apps.
        from django.db.models.loading import get_models
        loaded_models = get_models()

Если их убрать, то pyuno работает без ошибок. Я написал крохотную django-команду, положил ее в свое приложение (app_name/management/commands/shell.py) и теперь она запускается вместо стандартной:

    from django.core.management.commands import shell

    class Command(shell.Command):
        def handle_noargs(self, **options):
            self.run_shell()

Единственное требование - должна быть установлена какая-нибудь интерактивная консоль (ipython или bpython).
