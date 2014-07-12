---
layout: post
title: Python XML serializer
permalink: /blog/11-python-xml-serializer
---
Потребовалось мне на днях сделать сериализацию простого Python-dictionary в XML. Элементы словаря - списки и прочие объекты. Готового сниппета я не нашел, написал свой компактный (меньше 30 строчек) сериализатор.
<!--more-->

    from StringIO import StringIO
    from xml.etree.cElementTree import Element, ElementTree
    try:
        from django.utils.encoding import smart_unicode as unicode
    except:
        pass

    def serialize(data):
        content_elem = Element('content')
        _serialize(content_elem, data)
        tree = ElementTree(content_elem)
        f = StringIO()
        tree.write(f, 'UTF-8')
        return f.getvalue()

    def _serialize(parent_elem, data):
        if isinstance(data, (list, tuple)):
            _serialize_list(parent_elem, data)
        elif isinstance(data, dict):
            _serialize_dict(parent_elem, data)
        else:
            parent_elem.text = unicode(data)

    def _serialize_list(parent_elem, data_list):
        for i in data_list:
            item_elem = Element('item')
            parent_elem.append(item_elem)
            _serialize(item_elem, i)

    def _serialize_dict(parent_elem, data_dict):
        for k, v in data_dict.iteritems():
            key_elem = Element(k)
            parent_elem.append(key_elem)
            _serialize(key_elem, v)
        
    print serialize({'title': 'Hello!', 'data': [1, 2, 3]})