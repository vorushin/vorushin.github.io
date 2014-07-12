---
layout: post
title: В чем польза документоориентированных БД
permalink: /blog/v-chem-polza-dokumentoorientirovannyh-bd-mongodb-c
---
Первый use-case использования документоориентированных БД, который не дает мне покоя.

### Relational Solution

* Use a relational database, with a normalized or semi-normalized schema.
* When rendering a response, run a handful of queries and then aggregate the data for the object.
* Cache the resultant aggregate object either on a TTL or do invalidation.
* Return the cached copy of the aggregate object.

### Document Store Solution
* Use a document datastore, and embed sub-objects or child lists within their parents.
* When rendering a response, retrieve the document by key and return it.

Рендеринг шаблонов сейчас может быть очень быстрым, а умная инвалидация кеша все еще остается очень непростой.

Источник - <http://codeascraft.etsy.com/2010/05/19/mongodb-at-etsy/>