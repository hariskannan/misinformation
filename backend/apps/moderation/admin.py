from django.contrib import admin

from .models import ModerationReview


@admin.register(ModerationReview)
class ModerationReviewAdmin(admin.ModelAdmin):
    list_display = ('id', 'post', 'moderator', 'action', 'created_at')
    list_filter = ('action',)
    search_fields = ('remarks', 'moderator__username')
