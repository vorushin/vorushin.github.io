---
layout: post
title: Очистка кеша memcached
permalink: /blog/clear-cache-memcached
---
    from memcache import Client
    c = Client(('127.0.0.1:11211',))
    c.flush_all()