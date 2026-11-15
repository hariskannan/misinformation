from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.pagination import DefaultPagination
from apps.core.permissions import IsOwnerOrModeratorOrAdmin
from apps.core.utils import log_audit
from apps.ml.prediction import (
    NoActiveModelError,
    PredictionInputError,
    PredictionServiceError,
    predict_for_post,
)
from apps.ml.serializers import PredictionSerializer

from .models import Comment, Like, Notification, Post, UserReport
from .serializers import (
    CommentSerializer,
    CreatePostSerializer,
    CreateReportSerializer,
    NotificationSerializer,
    PostDetailSerializer,
    PostSerializer,
    UserReportSerializer,
)
from .services import create_post_with_prediction, notify, notify_staff

User = get_user_model()


class PostFeedView(APIView):
    """GET /api/posts/ - the public social feed (published + approved posts).
    POST /api/posts/ - create a post; runs the ML risk prediction before publishing.
    """

    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        queryset = (
            Post.objects.filter(status__in=[Post.Status.PUBLISHED, Post.Status.APPROVED])
            .select_related('author', 'author__profile', 'prediction', 'prediction__model_version')
        )
        category = request.query_params.get('category')
        if category and category != 'all':
            queryset = queryset.filter(category=category)
        risk = request.query_params.get('risk')
        if risk in Post.RiskLevel.values:
            queryset = queryset.filter(risk_level=risk)
        search = request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(content__icontains=search) | Q(title__icontains=search)
            )

        paginator = DefaultPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = PostSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        serializer = CreatePostSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # --- Prediction workflow: the post is never published before the
        # --- ML pipeline has produced a risk assessment.
        try:
            post = create_post_with_prediction(
                author=request.user,
                title=serializer.validated_data.get('title', ''),
                content=serializer.validated_data['content'],
                category=serializer.validated_data.get('category', 'other'),
                image=serializer.validated_data.get('image'),
            )
        except NoActiveModelError as exc:
            return Response(
                {'detail': str(exc)},
                status=status.HTTP_409_CONFLICT,
            )
        except PredictionInputError as exc:
            return Response(
                {'detail': str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except PredictionServiceError as exc:
            return Response(
                {'detail': str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        response_serializer = PostDetailSerializer(post, context={'request': request})
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class MyPostsView(APIView):
    """GET /api/posts/mine/ - post history of the current user (all statuses)."""

    def get(self, request):
        queryset = (
            Post.objects.filter(author=request.user)
            .select_related('author', 'author__profile', 'prediction', 'prediction__model_version')
        )
        post_status = request.query_params.get('status')
        if post_status in Post.Status.values:
            queryset = queryset.filter(status=post_status)
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = PostSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)


class PostDetailView(APIView):
    """GET /api/posts/{id}/ - full post detail with comments.
    DELETE /api/posts/{id}/ - author or admin only.

    Reading a public post is anonymous so shared links (/post/{id}) work for
    signed-out visitors. Non-public posts still require the author, a moderator
    or an administrator.
    """

    def get_permissions(self):
        if self.request.method in ('GET', 'HEAD', 'OPTIONS'):
            return [AllowAny()]
        return [IsAuthenticated(), IsOwnerOrModeratorOrAdmin()]

    def get(self, request, pk):
        try:
            post = Post.objects.select_related(
                'author', 'author__profile', 'prediction', 'prediction__model_version'
            ).get(pk=pk)
        except Post.DoesNotExist:
            return Response({'detail': 'Post not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not post.is_publicly_visible:
            user = request.user
            if not (user.is_authenticated and (user == post.author or user.role in ('moderator', 'admin'))):
                return Response(
                    {'detail': 'This post is not publicly available.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
        serializer = PostDetailSerializer(post, context={'request': request})
        return Response(serializer.data)

    def delete(self, request, pk):
        try:
            post = Post.objects.get(pk=pk)
        except Post.DoesNotExist:
            return Response({'detail': 'Post not found.'}, status=status.HTTP_404_NOT_FOUND)

        self.check_object_permissions(request, post)
        if not (request.user == post.author or request.user.role == 'admin'):
            return Response(
                {'detail': 'Only the author or an administrator can delete this post.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        log_audit(request, 'post_deleted', 'post', post.id,
                  {'author': post.author.username})
        post.delete()
        return Response({'detail': 'Post deleted.'}, status=status.HTTP_204_NO_CONTENT)


class LikeToggleView(APIView):
    """POST /api/posts/{id}/like/ - toggle like for the current user."""

    def post(self, request, pk):
        try:
            post = Post.objects.get(pk=pk)
        except Post.DoesNotExist:
            return Response({'detail': 'Post not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not post.is_publicly_visible and request.user != post.author:
            return Response(
                {'detail': 'This post cannot be interacted with.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        like = post.likes.filter(user=request.user).first()
        if like:
            like.delete()
            liked = False
        else:
            Like.objects.create(post=post, user=request.user)
            liked = True
            notify(
                post.author,
                f'@{request.user.username} liked your post',
                notification_type=Notification.Type.LIKE,
                actor=request.user,
                post=post,
            )
        return Response({'liked': liked, 'like_count': post.likes.count()})


class CommentView(APIView):
    """GET /api/posts/{id}/comments/ - list comments.
    POST /api/posts/{id}/comment/ - add a comment.
    """

    def get(self, request, pk):
        try:
            post = Post.objects.get(pk=pk)
        except Post.DoesNotExist:
            return Response({'detail': 'Post not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not post.is_publicly_visible and request.user != post.author:
            return Response(
                {'detail': 'This post cannot be interacted with.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        comments = post.comments.select_related('author', 'author__profile').order_by('created_at')
        serializer = CommentSerializer(comments, many=True)
        return Response({'count': comments.count(), 'results': serializer.data})

    def post(self, request, pk):
        try:
            post = Post.objects.get(pk=pk)
        except Post.DoesNotExist:
            return Response({'detail': 'Post not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not post.is_publicly_visible and request.user != post.author:
            return Response(
                {'detail': 'This post cannot be interacted with.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        content = (request.data.get('content') or '').strip()
        if len(content) < 1:
            return Response(
                {'detail': 'Comment text is required.'}, status=status.HTTP_400_BAD_REQUEST
            )
        if len(content) > 2000:
            return Response(
                {'detail': 'Comment must be at most 2000 characters.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        comment = Comment.objects.create(post=post, author=request.user, content=content)
        notify(
            post.author,
            f'@{request.user.username} commented on your post',
            message=content[:120],
            notification_type=Notification.Type.COMMENT,
            actor=request.user,
            post=post,
        )
        return Response(CommentSerializer(comment).data, status=status.HTTP_201_CREATED)


class ReportPostView(APIView):
    """POST /api/posts/{id}/report/ - report a suspicious post."""

    def post(self, request, pk):
        try:
            post = Post.objects.get(pk=pk)
        except Post.DoesNotExist:
            return Response({'detail': 'Post not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not post.is_publicly_visible and request.user != post.author:
            return Response(
                {'detail': 'This post cannot be reported.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if post.reports.filter(reporter=request.user).exists():
            return Response(
                {'detail': 'You have already reported this post.'},
                status=status.HTTP_409_CONFLICT,
            )

        serializer = CreateReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = UserReport.objects.create(
            post=post, reporter=request.user, **serializer.validated_data
        )
        notify_staff(
            'New user report submitted',
            message=f'@{request.user.username} reported a post ({report.get_reason_display()}).',
            notification_type=Notification.Type.REPORT,
            actor=request.user,
            post=post,
        )
        return Response(
            UserReportSerializer(report).data, status=status.HTTP_201_CREATED
        )


class MyReportsView(APIView):
    """GET /api/reports/mine/ - reports filed by the current user."""

    def get(self, request):
        queryset = request.user.filed_reports.select_related(
            'post', 'post__author', 'resolved_by'
        )
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = UserReportSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class TrendingCategoriesView(APIView):
    """GET /api/posts/categories/ - real post counts per category (right sidebar)."""

    def get(self, request):
        from django.db.models import Count
        data = (
            Post.objects.filter(status__in=[Post.Status.PUBLISHED, Post.Status.APPROVED])
            .values('category')
            .annotate(count=Count('id'))
            .order_by('-count')
        )
        return Response({'results': list(data)})


class NotificationListView(APIView):
    """GET /api/notifications/ - list notifications for the current user."""

    def get(self, request):
        queryset = request.user.notifications.select_related('actor', 'post')
        unread_only = request.query_params.get('unread') == '1'
        if unread_only:
            queryset = queryset.filter(is_read=False)
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = NotificationSerializer(page, many=True)
        unread_count = request.user.notifications.filter(is_read=False).count()
        return paginator.get_paginated_response(serializer.data)


class NotificationUnreadCountView(APIView):
    """GET /api/notifications/unread-count/"""

    def get(self, request):
        return Response({'count': request.user.notifications.filter(is_read=False).count()})


class MarkNotificationReadView(APIView):
    """POST /api/notifications/{id}/read/"""

    def post(self, request, pk):
        try:
            notification = request.user.notifications.get(pk=pk)
        except Notification.DoesNotExist:
            return Response({'detail': 'Notification not found.'}, status=status.HTTP_404_NOT_FOUND)
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        return Response(NotificationSerializer(notification).data)


class MarkAllNotificationsReadView(APIView):
    """POST /api/notifications/read-all/"""

    def post(self, request):
        updated = request.user.notifications.filter(is_read=False).update(is_read=True)
        return Response({'updated': updated})


class MyRecentPredictionsView(APIView):
    """GET /api/posts/my-recent-predictions/ - last 5 standalone analyses by
    the current user (used by the dashboard right sidebar)."""

    def get(self, request):
        from apps.ml.models import Prediction
        predictions = (
            Prediction.objects.filter(created_by=request.user, post__isnull=True)
            .select_related('model_version')
            .order_by('-created_at')[:5]
        )
        return Response({'results': PredictionSerializer(predictions, many=True).data})
