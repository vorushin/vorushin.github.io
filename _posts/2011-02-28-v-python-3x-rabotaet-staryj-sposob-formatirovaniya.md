---
layout: post
title: В Python 3.x работает старый способ форматирования строк
permalink: /blog/v-python-3x-rabotaet-staryj-sposob-formatirovaniya
---
А старый добрый способ форматирования строк с помощью % в Python 3000 всё-таки оставили!

    ~ > workon python3
    (python3)~ > ipython    
    
    Python 3.2 (r32:88445, Feb 28 2011, 11:06:14) 

    In [1]: 'Good old %s still works in Python 3!' % 'string formatting'
    Out[1]: 'Good old string formatting still works in Python 3!'

По наводке [www.boredomandlaziness.org](http://www.boredomandlaziness.org/2011/02/status-quo-wins-stalemate.html)