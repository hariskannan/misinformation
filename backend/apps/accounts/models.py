from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """TruthGuard user with a role used for RBAC.

    Roles:
      - user:      standard social media participant
      - moderator: content review capabilities
      - admin:     full platform administration
    """

    class Role(models.TextChoices):
        USER = 'user', 'User'
        MODERATOR = 'moderator', 'Moderator'
        ADMIN = 'admin', 'Administrator'

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.USER)

    class Meta:
        indexes = [models.Index(fields=['role'])]

    @property
    def is_moderator(self):
        return self.role in (self.Role.MODERATOR, self.Role.ADMIN)

    @property
    def is_platform_admin(self):
        return self.role == self.Role.ADMIN

    def __str__(self):
        return f'{self.username} ({self.role})'


class UserProfile(models.Model):
    """Extended profile information for a user."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile'
    )
    full_name = models.CharField(max_length=120, blank=True)
    department = models.CharField(max_length=120, blank=True)
    bio = models.TextField(blank=True, max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Profile of {self.user.username}'
