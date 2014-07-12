---
layout: post
title: Декораторы Python
permalink: /blog/decorators-python
---
В питоне есть 2 очень мощных инструмента мета-программирования: декораторы и метаклассы. Декораторы применяются к функциям, метаклассы - к классам. Хочу подробно остановиться на декораторах.
<!--more-->

### Что это такое

Классический пример декоратора - [render\_to](http://www.djangosnippets.org/snippets/821/):

    def render_to(template):
        def renderer(func):
            def wrapper(request, *args, **kw):
                output = func(request, *args, **kw)
                if isinstance(output, (list, tuple)):
                    return render_to_response(output[1], output[0], RequestContext(request))
                elif isinstance(output, dict):
                    return render_to_response(template, output, RequestContext(request))
                return output
            return wrapper
        return renderer

Применяется этот декоратор вот так:

    @render_to('catalog/search.html')
    def search(request):
        # code snipped
        return {'search_string': product_title,
                'products': products,
                'show_search_bar': True}

Значение, возвращаемое из search,анализируется и если это словарь, то производится его рендеринг в HttpResponse. Очень удобно, когда return встречается несколько раз в django view. 

### Как это работает

Декоратор - это самая обычная питоновская функция, входным параметром которой является другая функция. Необычна лишь запись с @, которая появилась в Python 2.4 ([PEP-318](http://www.python.org/dev/peps/pep-0318/)), которая появилась уже после того, как декораторы стали устойчивым питоновским приемом.

Вот пример из [PEP-318](http://www.python.org/dev/peps/pep-0318/). Запись

    @dec2
    @dec1
    def func(arg1, arg2, ...):
        pass

эквивалентна

    def func(arg1, arg2, ...):
        pass
    func = dec2(dec1(func))

render\_to отличается еще одним важным свойством - он является не обычным декоратором, а фабрикой декораторов (decomaker). Именно это отличие когда-то сбило меня с толку, а времени разобраться что и как устроено у меня тогда не было. Вернемся к фабрике декораторов чуть позже.

### Самый простой декоратор

Самым простым в написании является декоратор, который принимает функцию своим единственным параметром. Давайте напишем в учебных целях милый, но бесполезный декоратор, который печатает значение, возвращаемое функцией.

    def print_value(func):
        def wrapper(*args, **kwargs):
            output = func(*args, **kwargs)
            print output
        return wrapper

    @print_value
    def return1():
        return 1
    
    @print_value
    def return_tuple():
        return (1, 2, 3)

Код очень простой - внутри print\_value мы создаем вложенную функцию, которая вызывает функцию func, а потом что-то делает с её результатами. Вложенную функцию очень часто (я бы даже сказал _традиционно_) называют wrapper, её список параметров может отличаться от списка параметров обернутой функции (например она может принимать request и класс формы, делать валидацию и передавать в оборачиваемую функцию список чистых полей формы - типичный случай валидирующего декоратора).

### Фабрика декораторов (decomaker)

Делаем еще один шаг. В случае render\_to нам кроме собственно декоратора нужно указывать также и дополнительную информацию - какой именно шаблон использовать при рендеринге. Выход очень простой - нужно написать функцию, которая будет создавать декораторы, в которых будет сохранена вся необходимая нам информация. В [PEP-318](http://www.python.org/dev/peps/pep-0318/) такой тип декораторов называется decomaker, вариант русского перевода - фабрика декораторов.

Работает это таким образом:

    @synchronized(lock)
    def foo(cls):
        pass
    
эквивалентно

    def foo(cls):
        pass
    foo = synchronized(lock)(foo)
    
При реализации такой фабрики у нас будет на одну вложенную функцию больше - потому что мы должны вернуть не декорированную функцию, а декоратор, который затем вернет декорированную функцию. Вооруженные этим знанием, вернемся к коду render\_to:

    def render_to(template):
        def renderer(func):
            def wrapper(request, *args, **kw):
                output = func(request, *args, **kw)
                if isinstance(output, (list, tuple)):
                    return render_to_response(output[1], output[0], RequestContext(request))
                elif isinstance(output, dict):
                    return render_to_response(template, output, RequestContext(request))
                return output
            return wrapper
        return renderer

* render\_to(temlate) - фабрика декораторов, все вложенные функции "запоминают" переменную template (используется лексическое замыкание, или closure)
* renderer(func) - собсвенно декоратор, он будет возвращен из фабрики декораторов
* wrapper(request, \*args, \*\*kw) - такой же враппер, как и в случае _самого простого декоратора_

### Полезный инструмент - functools.wraps

Если вы использовали в своих django-проектах декоратор render_to, то скорее всего время от времени вы получали сообщения об ошибках вида **NoReverseMatch: Reverse for 'utils.snippets.wrapper' with arguments '()' and keyword arguments '{}' not found**. Такие ошибки малоинформативны и лишь по имени файла и номеру строчки кода можно догадаться, что речь идет о view catalog.views.category. Дело кроется в специальных атрибутах функции category: \_\_name\_\_ и \_\_module\_\_, которые переписываются декоратором на 'wrapper' и 'utils.snippets' соответственно. 

В стандартной библиотеке есть отличное средство для исправления этого досадного неудобства - достаточно добавить для враппера декоратор [wraps](http://docs.python.org/library/functools.html#functools.wraps) из модуля [functools](http://docs.python.org/library/functools.html) с единственным обязательным параметром - функцией, которую оборачивает этот враппер. Этот декоратор копирует специальные атрибуты из оборачиваемой функции и мы получаем красивое понятное сообщение об ошибке вида **NoReverseMatch: Reverse for 'catalog.views.category' with arguments '()' and keyword arguments '{}' not found**. Для большей ясности приведу код улучшенного варианта render\_to:

    def render_to(template):
        def renderer(func):
            @wraps(func)
            def wrapper(request, *args, **kw):
                output = func(request, *args, **kw)
                if isinstance(output, (list, tuple)):
                    return render_to_response(output[1], output[0], RequestContext(request))
                elif isinstance(output, dict):
                    return render_to_response(template, output, RequestContext(request))
                return output
            return wrapper
        return renderer

### Сборный декоратор

Последний аспект работы с декораторами, который я хочу упомянуть, это легкость создания сборного декоратора - декоратора, который заменяет собой сразу несколько других декораторов. Например, если мы хотим чтобы целый ряд наших django view делал проверку прав пользователя и логировал бы определенным образом все необработанные исключения. Поскольку декоратор - это функция, которая получает функцию на вход и которая возвращает улучшенную фукнцию, код получается очень простым:

    def adminka_page(func):
        func = user_passes_test(lambda u: u.is_staff, login_url=settings.ADMIN_LOGIN_URL)(func)
        func = log_exceptions(func)
        return func
