from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers

from apps.ml.serializers import PredictionSerializer

from .models import Comment, Notification, Post, UserReport


class PublicUserSerializer(serializers.Serializer):
    """Minimal author representation used inside post payloads."""

    id = serializers.IntegerField(read_only=True)
    username = serializers.CharField(read_only=True)
    full_name = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()

    def get_full_name(self, obj):
        return getattr(obj.profile, 'full_name', '') or obj.username

    def get_department(self, obj):
        return getattr(obj.profile, 'department', '')


class CommentSerializer(serializers.ModelSerializer):
    author = PublicUserSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = ['id', 'author', 'content', 'created_at']


class PostSerializer(serializers.ModelSerializer):
    author = PublicUserSerializer(read_only=True)
    prediction = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    liked_by_me = serializers.SerializerMethodField()
    reported_by_me = serializers.SerializerMethodField()
    reports_count = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id', 'title', 'content', 'category', 'image', 'status', 'risk_level',
            'created_at', 'updated_at', 'author', 'prediction',
            'like_count', 'comment_count', 'liked_by_me', 'reported_by_me', 'reports_count',
        ]

    def get_prediction(self, obj):
        try:
            return PredictionSerializer(obj.prediction).data
        except ObjectDoesNotExist:
            return None

    def _request_user(self):
        request = self.context.get('request')
        return request.user if request and request.user.is_authenticated else None

    def get_like_count(self, obj):
        return obj.likes.count()

    def get_comment_count(self, obj):
        return obj.comments.count()

    def get_liked_by_me(self, obj):
        user = self._request_user()
        if not user:
            return False
        return obj.likes.filter(user=user).exists()

    def get_reported_by_me(self, obj):
        user = self._request_user()
        if not user:
            return False
        return obj.reports.filter(reporter=user).exists()

    def get_reports_count(self, obj):
        request = self.context.get('request')
        user = self._request_user()
        if user and user.role in ('moderator', 'admin'):
            return obj.reports.count()
        return None


class CreatePostSerializer(serializers.ModelSerializer):
    """Payload for creating a post. Risk prediction runs server-side on publish."""

    class Meta:
        model = Post
        fields = ['title', 'content', 'category', 'image']

    def validate_content(self, value):
        value = value.strip()
        if len(value) < 15:
            raise serializers.ValidationError(
                'Post content must be at least 15 characters long.'
            )
        return value

    def validate_image(self, image):
        if image is None:
            return image
        if image.size > 5 * 1024 * 1024:
            raise serializers.ValidationError('Image must be smaller than 5 MB.')
        return image


class PostDetailSerializer(PostSerializer):
    comments = CommentSerializer(many=True, read_only=True)
    moderation_remarks = serializers.SerializerMethodField()

    class Meta(PostSerializer.Meta):
        fields = PostSerializer.Meta.fields + ['comments', 'moderation_remarks']

    def get_moderation_remarks(self, obj):
        request = self.context.get('request')
        user = self._request_user()
        if user and (user.role in ('moderator', 'admin') or user == obj.author):
            latest = obj.reviews.order_by('-created_at').first()
            if latest:
                return {
                    'action': latest.action,
                    'remarks': latest.remarks,
                    'moderator': latest.moderator.username,
                    'created_at': latest.created_at,
                }
        return None


class NotificationSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source='actor.username', read_only=True, default=None)

    class Meta:
        model = Notification
        fields = [
            'id', 'notification_type', 'verb', 'message', 'actor_username',
            'post', 'is_read', 'created_at',
        ]


class CreateReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserReport
        fields = ['reason', 'details']

    def validate_reason(self, value):
        if value not in UserReport.Reason.values:
            raise serializers.ValidationError('Invalid report reason.')
        return value


class UserReportSerializer(serializers.ModelSerializer):
    """Representation of a user report (reporter-facing)."""

    post_id = serializers.IntegerField(source='post.id', read_only=True)
    post_title = serializers.CharField(source='post.title', read_only=True, default='')
    post_content = serializers.SerializerMethodField()
    post_status = serializers.CharField(source='post.status', read_only=True)
    post_risk_level = serializers.CharField(source='post.risk_level', read_only=True, default='')
    post_author = serializers.CharField(source='post.author.username', read_only=True)
    reporter_username = serializers.CharField(source='reporter.username', read_only=True)
    resolved_by_username = serializers.CharField(
        source='resolved_by.username', read_only=True, default=None
    )

    class Meta:
        model = UserReport
        fields = [
            'id', 'post_id', 'post_title', 'post_content', 'post_status',
            'post_risk_level', 'post_author', 'reason', 'details', 'status',
            'resolution_remarks', 'resolved_by_username', 'reporter_username',
            'created_at', 'resolved_at',
        ]

    def get_post_content(self, obj):
        return obj.post.content[:280]
