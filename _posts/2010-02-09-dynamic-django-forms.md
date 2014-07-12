---
layout: post
title: Динамические формы Django
permalink: /blog/dynamic-django-forms
---
Неделю-две назад понадобилось мне сделать динамическую форму на Django - чтобы её поля создавались и настраивались в зависимости от данных, передаваемых в конструктор. Изучив исходники, я обнаружил, что сделать это легче легкого:

    class DynamicForm(forms.Form):        
        def __init__(self, some_data, *args, **kwargs):
            super(DynamicForm, self).__init__(*args, **kwargs)
            for i, requisite in enumerate(some_data.requisites_list):
                regex = requisite['regexp']
                label = requisite['name']
                self.fields['requisite_%s' % i] = forms.RegexField(regex=regex, label=label)

Ключевой элемент это словарь self.fields - в нем хранятся все поля, которые были перечислены при объявлении класса формы. 

PS. Написал это отдельным постом, потому что не первый раз вижу в Google Analytics, что на мой блог попадают люди по поисковой фразе "динамические формы джанго".