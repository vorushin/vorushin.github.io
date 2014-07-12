---
layout: post
title: AkismetModerator для комментариев в Django
permalink: /blog/akismet-moderator-for-django-comments
---
В django есть хорошее встроенное приложение comments с поддержкой [модерации](http://docs.djangoproject.com/en/dev/ref/contrib/comments/moderation/#ref-contrib-comments-moderation). Сегодня написал AkismetModerator - крохотный класс, который фильтрует спам в комментариях с помощью сервиса [Akismet](http://akismet.com):

    from akismet import Akismet
    from django.contrib.comments.moderation import CommentModerator, moderator
    from django.utils.encoding import smart_str

    class AkismetModerator(CommentModerator):
        def moderate(self, comment, content_object, request):
            api = Akismet(agent='AkismetModerator@vorushin.ru')
            if not api.key:
                api.setAPIKey(settings.AKISMET_KEY, 'http://vorushin2.wordpress.com')
            if not api.verify_key():
                return True
            return api.comment_check(smart_str(comment.comment), 
                {'user_ip': request.META['REMOTE_ADDR'], 
                 'user_agent': request.META['HTTP_USER_AGENT']})

    moderator.register(Entry, AkismetModerator)
    moderator.register(Link, AkismetModerator)

Entry, Link - модели, комментарии к которым будут прогоняться через AkismetModerator.