from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers

from apps.posts.models import Post

from .models import ModerationReview


class ModerationReviewSerializer(serializers.ModelSerializer):
    moderator_username = serializers.CharField(source='moderator.username', read_only=True)
    post_id = serializers.IntegerField(source='post.id', read_only=True)
    post_title = serializers.CharField(source='post.title', read_only=True, default='')
    post_content = serializers.SerializerMethodField()
    post_status = serializers.CharField(source='post.status', read_only=True)
    post_risk_level = serializers.CharField(source='post.risk_level', read_only=True, default='')
    post_author = serializers.CharField(source='post.author.username', read_only=True)

    class Meta:
        model = ModerationReview
        fields = [
            'id', 'post_id', 'post_title', 'post_content', 'post_status',
            'post_risk_level', 'post_author', 'moderator_username', 'action',
            'remarks', 'created_at',
        ]

    def get_post_content(self, obj):
        return obj.post.content[:200]


class ModerationQueueItemSerializer(serializers.ModelSerializer):
    """Queue representation of a post awaiting review."""

    author_username = serializers.CharField(source='author.username', read_only=True)
    author_full_name = serializers.SerializerMethodField()
    prediction = serializers.SerializerMethodField()
    reports_count = serializers.SerializerMethodField()
    latest_report_reasons = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id', 'title', 'content', 'category', 'status', 'risk_level',
            'created_at', 'author_username', 'author_full_name',
            'prediction', 'reports_count', 'latest_report_reasons',
        ]

    def get_author_full_name(self, obj):
        return getattr(obj.author.profile, 'full_name', '') or obj.author.username

    def get_prediction(self, obj):
        try:
            prediction = obj.prediction
        except ObjectDoesNotExist:
            return None
        if prediction is None:
            return None
        return {
            'id': prediction.id,
            'predicted_label': prediction.predicted_label,
            'risk_level': prediction.risk_level,
            'confidence': prediction.confidence,
            'probabilities': prediction.probabilities,
            'model': {
                'name': prediction.model_version.name,
                'algorithm': prediction.model_version.algorithm,
                'version_tag': prediction.model_version.version_tag,
                'trained_at': prediction.model_version.trained_at,
            },
            'created_at': prediction.created_at,
        }

    def get_reports_count(self, obj):
        return obj.reports.count()

    def get_latest_report_reasons(self, obj):
        return list(
            obj.reports.order_by('-created_at').values_list('reason', flat=True)[:5]
        )
