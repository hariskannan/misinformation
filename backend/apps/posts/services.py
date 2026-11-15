from django.contrib.auth import get_user_model
from django.conf import settings

from .models import Notification, Post

User = get_user_model()


def notify(recipient, verb, message='', notification_type=Notification.Type.SYSTEM,
           actor=None, post=None):
    """Create an in-app notification for a user. Never raises."""
    if recipient is None:
        return None
    if actor is not None and actor.id == recipient.id:
        # Do not notify users about their own actions.
        return None
    try:
        return Notification.objects.create(
            recipient=recipient,
            actor=actor,
            verb=verb,
            message=message,
            notification_type=notification_type,
            post=post,
        )
    except Exception:
        return None


def notify_staff(verb, message='', notification_type=Notification.Type.SYSTEM, actor=None, post=None):
    """Notify every moderator and administrator."""
    for user in User.objects.filter(role__in=['moderator', 'admin'], is_active=True):
        notify(user, verb, message, notification_type, actor=actor, post=post)


def create_post_with_prediction(author, title, content, category='other', image=None):
    """Create a post and run the full risk-prediction publishing workflow.

    The post is saved first with a non-public provisional status, then the
    ML pipeline runs, and only afterwards the final visibility is applied:
      - low    -> published immediately
      - medium -> published with a warning (or held, per TG_MEDIUM_RISK_ACTION)
      - high   -> held for moderator review (not publicly visible)
    """
    from apps.ml.prediction import predict_for_post

    post = Post(
        author=author,
        title=title,
        content=content,
        category=category,
        image=image,
        # Provisional state: never publicly visible before the prediction
        # workflow completes.
        status=Post.Status.PENDING_REVIEW,
    )
    post.save()

    prediction = predict_for_post(content, user=author, post=post)
    post.risk_level = prediction.risk_level

    medium_action = getattr(settings, 'TG_MEDIUM_RISK_ACTION', 'publish')

    if prediction.risk_level == Post.RiskLevel.LOW:
        post.status = Post.Status.PUBLISHED
    elif prediction.risk_level == Post.RiskLevel.MEDIUM:
        if medium_action == 'hold':
            post.status = Post.Status.PENDING_REVIEW
            notify(
                author,
                'Medium-risk content detected - awaiting review',
                message=(
                    'Our model flagged your post as a medium misinformation risk. '
                    'It was held for moderation according to the platform policy.'
                ),
                notification_type=Notification.Type.MODERATION,
                post=post,
            )
        else:
            post.status = Post.Status.PUBLISHED
    else:  # HIGH risk
        post.status = Post.Status.PENDING_REVIEW
        notify(
            author,
            'High-risk content detected',
            message=(
                'Our machine learning model flagged your post as potential '
                'misinformation (high risk). The post was sent to the moderation '
                'team for review and is not publicly visible until a moderator '
                'approves it. This is a risk signal, not a final judgement.'
            ),
            notification_type=Notification.Type.MODERATION,
            post=post,
        )
        notify_staff(
            'New high-risk post awaiting review',
            message=f'@{author.username} published content flagged as high risk.',
            notification_type=Notification.Type.REPORT,
            post=post,
        )
    post.save(update_fields=['risk_level', 'status', 'updated_at'])
    return post
