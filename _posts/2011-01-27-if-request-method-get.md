---
layout: post
title: if request.method == 'GET'
permalink: /blog/55-if-request-method-get
---
Наконец-то я понял, почему пишут так

    def item_view(request, id):
        item = get_object_or_404(Item, id=id)
        if request.method == 'POST':
            form = ItemForm(request.POST, instance=answer)
            if form.is_valid():
                form.save()
                return HttpResponseRedirect(item.get_absolute_url())
        else:
            form = ItemForm(instance=item)
        return render('item.html', {'item': item, 'form': form})

и не пишут вот так

    def item_view(request, id):
        item = get_object_or_404(Item, id=id)
        if request.method == 'GET':
            form = ItemForm(instance=item)
        elif request.method == 'POST':
            form = ItemForm(request.POST, instance=answer)
            if form.is_valid():
                form.save()
                return HttpResponseRedirect(item.get_absolute_url())            
        return render('item.html', {'item': item, 'form': form})
        
Второй вариант хоть и более выразительный, но не учитывает такие http methods как HEAD. А HEAD частенько шлются всякими программами и фейсбуками про постинге ссылки (чтобы проверить, что ссылка действительно рабочая).