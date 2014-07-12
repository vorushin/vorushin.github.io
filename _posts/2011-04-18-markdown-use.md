---
layout: post
title: Использование Markdown
permalink: /blog/markdown-use
---
В проекте [Grammarly Handbook](http://handbook.grammarly.com), про который я [писал вчера](http://vorushin.ru/blog/58-openoffice-python-ms-word/), грамматические карточки из формата MS Word нужно было конвертировать в какой-то внутренний формат, чтобы в этом формате было легко добавлять новые карточки и редактировать существующие. Кроме того, нужно было ограничить функционал редактора карточек, чтобы не было чрезмерного разнообразия форматирования и, как говорит наш дизайнер, "верстка была семантической".
<!--more-->

### Markdown - разметка не сложнее чем plain text e-mail

Я уже довольно давно для подобных задач использую разметку [Markdown](http://daringfireball.net/projects/markdown/). Его автор John Gruber описывает его так:

>The overriding design goal for Markdown’s formatting syntax is to make it as readable as possible. The idea is that a Markdown-formatted document should be publishable as-is, as plain text, without looking like it’s been marked up with tags or formatting instructions. While Markdown’s syntax has been influenced by several existing text-to-HTML filters, **the single biggest source of inspiration for Markdown’s syntax is the format of plain text email**.

Даже эту статью я пишу в разметке markdown (proofpic ниже).

![Proofpic](http://dl.dropbox.com/u/318944/markdown/src1.png)

### Рабочий пример

Разберем для примера карточку [Comma splice](http://handbook.grammarly.com/punctuation/comma/7/comma-splice/). 

#### MS Word

Вот скриншот части MS Word-документа с этой карточкой:

![Грамматическая карточка в формате Word](http://dl.dropbox.com/u/318944/markdown/word.png)

#### Markdown

Вот так я бы хотел записать такую карточку в markdown:

    If two independent clauses are to be joined into one sentence, they should be separated by a conjunction or a semi-colon, or possibly even a conjunction *and* a comma. They can also be separated into two sentences by a period. Using a comma causes a comma splice.

    > Koala bears are not actually bears<error>, </error>they are marsupials.
    > I am not angry with you<error>, </error>I am not happy with you, either.
    > I’m thinking of skipping English class<error>, </error>it’s really boring.

    **Exceptions:**
    Comma splices *can* be used for artistic or poetic effect, as when one is connecting several short independent clauses.  Don’t do this in a formal composition, though; it’s only for creative writing.  (If you’re going to pull this off in formal writing, try using a semi-colon.)

    > She was beautiful<ok>, </ok>she was gorgeous<ok>, </ok>she was ravishing.

    Comma splices may also be used if the two independent clauses are somehow contrasting, as when following a statement with a question.

    > You are coming to the party<ok>, </ok>aren’t you?

#### Html

А вот так эта карточка должна отображаться в html:

    <p>If two independent clauses are to be joined into one sentence, they should be separated by a conjunction or a semi-colon, or possibly even a conjunction <em>and</em> a comma. They can also be separated into two sentences by a period. Using a comma causes a comma splice.</p>

    <blockquote class="state_error"><p>Koala bears are not actually bears<span class="state_error_item">, </span>they are marsupials.</p></blockquote>
    <blockquote class="state_error"><p>I am not angry with you<span class="state_error_item">, </span>I am not happy with you, either.</p></blockquote>
    <blockquote class="state_error"><p>I’m thinking of skipping English class<span class="state_error_item">, </span>it’s really boring.</p></blockquote>

    <p><strong>Exceptions:</strong>
    Comma splices <em>can</em> be used for artistic or poetic effect, as when one is connecting several short independent clauses.  Don’t do this in a formal composition, though; it’s only for creative writing.  (If you’re going to pull this off in formal writing, try using a semi-colon.)</p>

    <blockquote class="state_ok"><p>She was beautiful<span class="state_ok_item">, </span>she was gorgeous<span class="state_ok_item">, </span>she was ravishing.</p></blockquote>

    <p>Comma splices may also be used if the two independent clauses are somehow contrasting, as when following a statement with a question.</p>

    <blockquote class="state_ok"><p>You are coming to the party<span class="state_ok_item">, </span>aren’t you?</p></blockquote>

### Отличия в синтаксисе

По моему мнению markdown-версия более удобна для редактирования человеком, чем сырой html. Для рендеринга mardown-версии в html есть две питоновские библиотеки: [python-markdown](http://www.freewisdom.org/projects/python-markdown/) и [python-markdown2](https://github.com/trentm/python-markdown2). У первой лучше [документация по написанию расширений](http://www.freewisdom.org/projects/python-markdown/Extensions), а вторая [быстрее](https://github.com/trentm/python-markdown2/wiki/Performance-Notes).

    >>> import markdown
    >>> import markdown2
    >>> markdown.markdown('*Hello*')
    u'<p><em>Hello</em></p>'
    >>> markdown2.markdown('*Hello*')
    u'<p><em>Hello</em></p>\n'

Я выбрал python-markdown из-за легкости написания расширений, с помощью которых можно вносить изменения в рендеринг. Синтаксис нашей карточки отличается от [исходного синтаксиса markdown](http://daringfireball.net/projects/markdown/syntax):

1. Если цитаты (>) идут одна за одной, то они должны превращаться в отдельные теги `<blockquote>` а не одну большую цитату с переносами строк между ними.
2. Псевдо-html теги `<ok>, <error>` должны превращаться в `<span class="state_ok_item"> и <span class="state_error_item">` соответственно. Их закрывающие теги - в `</span>`. А содержащие их `<blockquote>` должны получать классы state\_ok или state\_error.

### Создаем расширение для markdown

Расширения для python-markdown могут содержать preprocessors (на вход подается текст в разметке markdown), inline patterns (содержат регулярные выражения, определяющие их синтаксис, используются при разборе в дерево), treeprocessors (оперируют деревом, получившимся после парсинга) и postprocessors (подправляют полученный html). Также можно написать свой парсер вместо встроенного BlockParser, в котором уже можно делать вообще все что угодно.

Начинаем писать наше маленькое расширение. По соглашению имя файла должно начинаться с mdx\_, а файл должен содержать функцию makeExtension, которая создает инстанс расширения.

    def makeExtension(configs=None):
        return CardsExtension(configs=configs)

    class CardsExtension(markdown.Extension):
        def extendMarkdown(self, md, md_globals):
            md.preprocessors.add('split_blockquotes', SplitBlockquotes(md), '_begin')
            md.treeprocessors.add('mark_blockquotes', MarkBlockquotes(md), '_begin')
            md.postprocessors.add('replace_marker_tags', ReplaceMarkerTags(md), '_end')

SplitBlockquotes вставляет разделительный текст между последовательными цитатами. Этот текст мы уберем на стадии постпроцессинга. Цитаты, заканчивающиеся на два и более символа пробела пропускаем, markdown вставит там перенос строки.

    BLOCKQUOTE_SPLITTER = 'blockquote_splitter_paragraph_text'

    class SplitBlockquotes(markdown.preprocessors.Preprocessor):
        def run(self, lines):
            new_lines = []
            for line in lines:
                if line.startswith('>') and not line.endswith('  '):
                    new_line = line + '\n\n' + BLOCKQUOTE_SPLITTER + '\n\n'
                else:
                    new_line = line
                new_lines.append(new_line)
            return new_lines

MarkBlockquotes добавляет в `<blockquote>` css-классы.

    class MarkBlockquotes(markdown.treeprocessors.Treeprocessor):
        def run(self, root):
            for bq in root.findall('blockquote'):
                for elem in bq.iter():
                    if elem.text and elem.text.find('<ok>') != -1:
                        bq.set('class', 'state_ok')
                        break
                    if elem.text and elem.text.find('<error>') != -1:
                        bq.set('class', 'state_error')
                        break

ReplaceMarkerTags преобразует теги `<ok>, <error>` и убирает разделительный текст между цитатами.

    class ReplaceMarkerTags(markdown.postprocessors.Postprocessor):
        def run(self, text):
            text = re.sub('<ok>', u'<span class="state_ok_item">', text)
            text = re.sub('<error>', u'<span class="state_error_item">', text)
            text = re.sub('<example>', u'<span class="example">', text)
            text = re.sub('</ok>|</error>|</example>', u'</span>', text)
            text = re.sub('<p>' + BLOCKQUOTE_SPLITTER + '</p>', u'', text)
            return text

Расширение готово, если мы укажем его имя при рендеринге, то получим желаемый html.

    markdown.markdown(txt, extensions=['cards'])

### Интеграция в Django-приложение

Мне нужно:

1. Удобно рендерить карточки в html, причем желательно кешировать где-то отрендеренную версию, чтобы не увеличивать время загрузки страницы
2. Редактировать карточки в настраиваемом редакторе с предварительным просмотром.

Решить эти задачи помогает [django-markitup](https://bitbucket.org/carljm/django-markitup).

#### Модель

В django-markitup есть специальное поле MarkupField, которое добавляет в базу данных два поля - одно для markdown-версии, а второе - для html. Html-версия обновляется автоматически и как раз решает задачу кеширования.

    class Card(models.Model):
        ...
        slug = models.SlugField()
        text = MarkupField()

Чтобы при рендеринге использовалось наше расширение 'cards', нужно добавить настройку MARKITUP_FILTER:

    MARKITUP_FILTER = ('markdown.markdown', {'safe_mode': False, 'extensions': ['cards']})

#### Админка

MarkupField заменяет в админке обычную textarea на [редактор markitup](http://markitup.jaysalvat.com/), который по умолчанию выглядит вот так:

![default markitup widget](http://dl.dropbox.com/u/318944/markdown/adm1.png)

Настройка внешнего вида производится через markitup sets. Я скопировал идущий в поставке set 'markdown', сделал в фотошопе красивые кнопки для цитат-примеров и тегов ok/error. Какие показывать кнопки указываем в set.js:

    mySettings = {
        previewParserPath:  '/markitup/preview/',
        onShiftEnter:       {keepDefault:false, openWith:'\n\n'},
        markupSet: [
            {name:'Example block', key:'Q', openWith:'> '},
            {name:'Inline example', key:'E', openWith:'<example>', closeWith:'</example>'},
            {name:'Ok', key:'1', openWith:'<ok>', closeWith:'</ok>'},
            {name:'Error', key:'2', openWith:'<error>', closeWith:'</error>'},
            {separator:'---------------' },
            {name:'Bold', key:'B', openWith:'**', closeWith:'**'},
            {name:'Italic', key:'I', openWith:'*', closeWith:'*'},
            {separator:'---------------' },
            {name:'Bulleted List', openWith:'- ' },
            {name:'Numeric List', openWith:function(markItUp) {
                return markItUp.line+'. ';
            }},
            {separator:'---------------'},
            {name:'Preview', call:'preview', className:"preview"}
        ]
    }

В style.css прописываем стили для кнопок. Кнопки получают классы с индексом, начинающимся с 1.

    .markItUp .markItUpButton1 a {
        background-image:url(images/example.png);
        width: 60px; margin-right: 10px;
    }
    .markItUp .markItUpButton2 a {
        background-image:url(images/inline_example.png);
        width: 92px; margin-right: 10px;
    }
    ...

В settings.py добавляем путь к нашему сэту:

    MARKITUP_SET = '/media/markitup_hb/set'

А для того чтобы в превью отрендеренная карточка показывалась точно такой же как на сайте, я создал шаблон markitup/preview.html (если у вас Django>=1.2.5, то для работы превью нужно разобраться с CSRF-защитой ajax-запросов, см [CSRF exception for AJAX requests](http://docs.djangoproject.com/en/1.2/releases/1.2.5/#csrf-exception-for-ajax-requests).):

    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
    <html xmlns="http://www.w3.org/1999/xhtml">
    <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <title>markItUp! preview</title>
    <link rel="stylesheet" type="text/css" href="{{ MEDIA_URL }}css/all.css" />
    </head>
    <body>
    <div class="article2 clear">
        <div class="article_info">
        {{ preview|safe }}
        </div>
    </div>
    </body>
    </html>

Вот так выглядит доработанный редактор в админке:

![markitup with custom set and preview template](http://dl.dropbox.com/u/318944/markdown/adm2.png)

### Мои личные выводы

В этом проекте [markdown](http://daringfireball.net/projects/markdown/), [python-markdown](http://www.freewisdom.org/projects/python-markdown/) и [django-markitup](https://bitbucket.org/carljm/django-markitup) сослужили мне хорошую службу. Расширить синтаксис было несложно, а интеграция в джанго-приложение оказалась достойна всяческих похвал.