from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    """Immutable record of administrative / moderation actions."""

    ACTION_CHOICES = [
        ('user_register', 'User registered'),
        ('user_login', 'User login'),
        ('user_role_changed', 'User role changed'),
        ('user_password_reset', 'User password reset (admin)'),
        ('user_status_changed', 'User activated/deactivated'),
        ('dataset_uploaded', 'Dataset uploaded'),
        ('dataset_validated', 'Dataset validated'),
        ('dataset_deleted', 'Dataset deleted'),
        ('model_training_started', 'Model training started'),
        ('model_activated', 'Model activated'),
        ('model_deactivated', 'Model deactivated'),
        ('post_approved', 'Post approved'),
        ('post_rejected', 'Post rejected'),
        ('report_resolved', 'User report resolved'),
        ('post_deleted', 'Post deleted'),
    ]

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='audit_logs',
        help_text='User who performed the action.',
    )
    action = models.CharField(max_length=60, choices=ACTION_CHOICES, db_index=True)
    target_type = models.CharField(max_length=100, blank=True)
    target_id = models.CharField(max_length=50, blank=True)
    details = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'audit log entry'
        verbose_name_plural = 'audit log entries'

    def __str__(self):
        return f'{self.action} by {self.actor} at {self.created_at:%Y-%m-%d %H:%M}'
