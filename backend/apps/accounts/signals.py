"""Signals keeping every user's profile row in sync with the user row."""

from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import UserProfile

User = get_user_model()


@receiver(post_save, sender=User, dispatch_uid='truthguard_user_profile')
def ensure_user_profile(sender, instance, created, **kwargs):
    """Guarantee a UserProfile row exists for every user, no matter which
    creation path was used (API registration, seed command, Django admin...)."""
    UserProfile.objects.get_or_create(user=instance)
