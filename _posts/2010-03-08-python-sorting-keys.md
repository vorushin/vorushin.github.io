---
layout: post
title: Sorting with keys
permalink: /blog/30-python-sorting-keys
---
И снова цитата из [Code Like a Pythonista](http://python.net/~goodger/projects/pycon/2007/idiomatic/handout.html#sorting-with-keys):

Python 2.4 introduced an optional argument to the sort list method, "key", which specifies a function of one argument that is used to compute a comparison key from each list element. For example:

    def my_key(item):
        return (item[1], item[3])

    to_sort.sort(key=my_key)

The function my\_key will be called once for each item in the to\_sort list.

You can make your own key function, or use any existing one-argument function if applicable:

    str.lower to sort alphabetically regarless of case.
    len to sort on the length of the items (strings or containers).
    int or float to sort numerically, as with numeric strings like "2", "123", "35".

Чем это лучше написания собственной функции сравнения? Это быстрее на длинных списках. Потому что функция сравнения будет вызываться и соответственно вычисляться O(n\*logn) раз, а key будет вычисляться O(n) раз и вызываться уже вычисленный O(n\*logn) раз. Т.е. это как бы собственная функция сравнения с кешированием - сортировка ест чуть больше памяти, но выполняется чуть быстрее.