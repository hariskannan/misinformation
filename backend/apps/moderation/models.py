from django.conf import settings
from django.db import models


class ModerationReview(models.Model):
    """A moderator decision on a post (approve / reject) with remarks."""

    class Action(models.TextChoices):
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    post = models.ForeignKey('posts.Post', on_delete=models.CASCADE, related_name='reviews')
    moderator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='moderation_reviews'
    )
    action = models.CharField(max_length=20, choices=Action.choices)
    remarks = models.TextField(blank=True, max_length=2000)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.moderator.username} {self.action} post {self.post_id}'
