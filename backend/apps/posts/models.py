from django.conf import settings
from django.db import models


class Post(models.Model):
    """A social media post created by a user."""

    class Status(models.TextChoices):
        PUBLISHED = 'published', 'Published'
        PENDING_REVIEW = 'pending_review', 'Pending review'
        APPROVED = 'approved', 'Approved by moderator'
        REJECTED = 'rejected', 'Rejected by moderator'

    class RiskLevel(models.TextChoices):
        LOW = 'low', 'Low risk'
        MEDIUM = 'medium', 'Medium risk'
        HIGH = 'high', 'High risk'

    CATEGORY_CHOICES = [
        ('news', 'News'),
        ('politics', 'Politics'),
        ('health', 'Health'),
        ('technology', 'Technology'),
        ('science', 'Science'),
        ('business', 'Business'),
        ('entertainment', 'Entertainment'),
        ('sports', 'Sports'),
        ('other', 'Other'),
    ]

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='posts'
    )
    title = models.CharField(max_length=200, blank=True)
    content = models.TextField(max_length=10000)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default='other')
    image = models.ImageField(upload_to='post_images/%Y/%m/', blank=True, null=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PUBLISHED)
    risk_level = models.CharField(
        max_length=10, choices=RiskLevel.choices, blank=True, default=''
    )
    # The related Prediction is created by the ML pipeline and linked back
    # through apps.ml.models.Prediction.post (reverse accessor 'prediction').
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['risk_level', 'created_at']),
        ]

    def __str__(self):
        return f'Post #{self.pk} by {self.author.username} ({self.status})'

    @property
    def is_publicly_visible(self):
        return self.status in (self.Status.PUBLISHED, self.Status.APPROVED)


class Comment(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='comments'
    )
    content = models.TextField(max_length=2000)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'Comment by {self.author.username} on post {self.post_id}'


class Like(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='likes')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='likes'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['post', 'user'], name='unique_like_per_post')
        ]

    def __str__(self):
        return f'{self.user.username} likes post {self.post_id}'


class Notification(models.Model):
    """In-app notification (likes, comments, moderation decisions, system)."""

    class Type(models.TextChoices):
        LIKE = 'like', 'Like'
        COMMENT = 'comment', 'Comment'
        MODERATION = 'moderation', 'Moderation'
        REPORT = 'report', 'Report'
        SYSTEM = 'system', 'System'

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications'
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='triggered_notifications',
    )
    notification_type = models.CharField(max_length=20, choices=Type.choices, default=Type.SYSTEM)
    verb = models.CharField(max_length=200)
    message = models.TextField(blank=True)
    post = models.ForeignKey(Post, null=True, blank=True, on_delete=models.SET_NULL)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Notification for {self.recipient.username}: {self.verb}'


class UserReport(models.Model):
    """A user-submitted report about a suspicious post."""

    class Reason(models.TextChoices):
        MISINFORMATION = 'misinformation', 'Suspected misinformation'
        SPAM = 'spam', 'Spam or misleading'
        HARASSMENT = 'harassment', 'Harassment or hate'
        INAPPROPRIATE = 'inappropriate', 'Inappropriate content'
        OTHER = 'other', 'Other'

    class Status(models.TextChoices):
        OPEN = 'open', 'Open'
        IN_REVIEW = 'in_review', 'In review'
        RESOLVED = 'resolved', 'Resolved'
        DISMISSED = 'dismissed', 'Dismissed'

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='reports')
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='filed_reports'
    )
    reason = models.CharField(max_length=30, choices=Reason.choices)
    details = models.TextField(blank=True, max_length=2000)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    resolution_remarks = models.TextField(blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='resolved_reports',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['status', 'created_at'])]

    def __str__(self):
        return f'Report by {self.reporter.username} on post {self.post_id} ({self.status})'
