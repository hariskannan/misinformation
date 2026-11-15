"""Analytics endpoints - every number is computed live from the database."""
import csv

from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Count, Q
from django.db.models.functions import TruncDate, TruncMonth, TruncWeek
from django.http import HttpResponse
from django.utils import timezone
from datetime import timedelta
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsAdminRole, IsModeratorOrAdmin
from apps.ml.models import MLModelVersion, Prediction, TrainingJob
from apps.ml.prediction import get_active_model
from apps.moderation.models import ModerationReview
from apps.posts.models import Comment, Like, Notification, Post, UserReport

User = get_user_model()


def _parse_date_filters(request):
    """Optional ?start=YYYY-MM-DD&end=YYYY-MM-DD range filter."""
    start, end = None, None
    raw_start = request.query_params.get('start')
    raw_end = request.query_params.get('end')
    if raw_start:
        try:
            from datetime import datetime
            start = datetime.strptime(raw_start, '%Y-%m-%d')
        except ValueError:
            pass
    if raw_end:
        try:
            from datetime import datetime, time as dt_time
            end = datetime.combine(
                datetime.strptime(raw_end, '%Y-%m-%d'), dt_time.max
            )
        except ValueError:
            pass
    return start, end


def _range_filter(queryset, start, end, field='created_at'):
    if start:
        queryset = queryset.filter(**{f'{field}__gte': start})
    if end:
        queryset = queryset.filter(**{f'{field}__lte': end})
    return queryset


class AnalyticsOverviewView(APIView):
    """GET /api/analytics/overview/ - headline numbers (admin)."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        start, end = _parse_date_filters(request)

        posts = _range_filter(Post.objects.all(), start, end)
        users = _range_filter(User.objects.all(), start, end, field='date_joined')

        posts_by_status = dict(posts.values_list('status').annotate(c=Count('id')))
        posts_by_risk = dict(posts.values_list('risk_level').annotate(c=Count('id')))

        predictions = _range_filter(Prediction.objects.all(), start, end)
        active_model = get_active_model()

        overview = {
            'users_total': users.count(),
            'users_by_role': dict(
                User.objects.values_list('role').annotate(c=Count('id'))
            ),
            'posts_total': posts.count(),
            'posts_published': posts_by_status.get('published', 0),
            'posts_pending': posts_by_status.get('pending_review', 0),
            'posts_approved': posts_by_status.get('approved', 0),
            'posts_rejected': posts_by_status.get('rejected', 0),
            'posts_low_risk': posts_by_risk.get('low', 0),
            'posts_medium_risk': posts_by_risk.get('medium', 0),
            'posts_high_risk': posts_by_risk.get('high', 0),
            'predictions_total': predictions.count(),
            'predictions_by_risk': dict(
                predictions.values_list('risk_level').annotate(c=Count('id'))
            ),
            'comments_total': _range_filter(
                Comment.objects.all(), start, end).count(),
            'likes_total': _range_filter(
                Like.objects.all(), start, end).count(),
            'reports_total': _range_filter(
                UserReport.objects.all(), start, end).count(),
            'reports_open': UserReport.objects.filter(
                status__in=['open', 'in_review']).count(),
            'models_trained': MLModelVersion.objects.count(),
            'training_jobs_total': TrainingJob.objects.count(),
            'reviews_total': ModerationReview.objects.count(),
            'active_model': {
                'id': active_model.id,
                'name': active_model.name,
                'algorithm': active_model.get_algorithm_display(),
                'version_tag': active_model.version_tag,
                'trained_at': active_model.trained_at,
                'metrics': active_model.metrics,
            } if active_model else None,
            'range': {
                'start': start.strftime('%Y-%m-%d') if start else None,
                'end': end.strftime('%Y-%m-%d') if end else None,
            },
        }
        return Response(overview)


class RiskDistributionView(APIView):
    """GET /api/analytics/risk-distribution/ - posts by risk level (admin)."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        start, end = _parse_date_filters(request)
        posts = _range_filter(Post.objects.exclude(risk_level=''), start, end)
        rows = list(
            posts.values('risk_level').annotate(count=Count('id')).order_by('risk_level')
        )
        for row in rows:
            row['label'] = dict(Post.RiskLevel.choices).get(
                row['risk_level'], row['risk_level'])
        return Response({'results': rows})


class ActivityView(APIView):
    """GET /api/analytics/activity/?days=30&bucket=daily|weekly|monthly (admin)."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        try:
            days = int(request.query_params.get('days', 30))
        except (TypeError, ValueError):
            days = 30
        days = max(1, min(days, 730))
        bucket = request.query_params.get('bucket', 'daily')
        if bucket not in ('daily', 'weekly', 'monthly'):
            bucket = 'daily'

        since = timezone.now() - timedelta(days=days)
        trunc = {'daily': TruncDate, 'weekly': TruncWeek, 'monthly': TruncMonth}[bucket]

        posts_series = (
            Post.objects.filter(created_at__gte=since)
            .annotate(period=trunc('created_at'))
            .values('period')
            .annotate(
                total=Count('id'),
                low=Count('id', filter=Q(risk_level='low')),
                medium=Count('id', filter=Q(risk_level='medium')),
                high=Count('id', filter=Q(risk_level='high')),
            )
            .order_by('period')
        )
        users_series = (
            User.objects.filter(date_joined__gte=since)
            .annotate(period=trunc('date_joined'))
            .values('period')
            .annotate(new_users=Count('id'))
            .order_by('period')
        )
        users_map = {
            row['period']: row['new_users'] for row in users_series
        }

        results = []
        for row in posts_series:
            period = row['period']
            results.append({
                'date': period.strftime('%Y-%m-%d'),
                'total': row['total'],
                'low': row['low'],
                'medium': row['medium'],
                'high': row['high'],
                'new_users': users_map.get(period, 0),
            })
        return Response({'bucket': bucket, 'days': days, 'results': results})


class ModerationStatsView(APIView):
    """GET /api/analytics/moderation-stats/ - moderation outcomes (admin)."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        start, end = _parse_date_filters(request)
        reviews = _range_filter(ModerationReview.objects.all(), start, end)
        by_action = dict(reviews.values_list('action').annotate(c=Count('id')))
        per_moderator = list(
            reviews.values('moderator__username')
            .annotate(count=Count('id'))
            .order_by('-count')[:10]
        )
        report_stats = dict(UserReport.objects.values_list('status').annotate(c=Count('id')))
        return Response({
            'approved': by_action.get('approved', 0),
            'rejected': by_action.get('rejected', 0),
            'per_moderator': [
                {'moderator': row['moderator__username'], 'count': row['count']}
                for row in per_moderator
            ],
            'report_stats': report_stats,
        })


class ModelPerformanceView(APIView):
    """GET /api/analytics/model-performance/ - evaluation metrics of every
    trained model version, for the comparison charts (admin)."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        models = MLModelVersion.objects.select_related('dataset_version').order_by(
            '-trained_at'
        )
        results = []
        for model in models:
            metrics = model.metrics or {}
            results.append({
                'id': model.id,
                'name': model.name,
                'algorithm': model.algorithm,
                'algorithm_display': model.get_algorithm_display(),
                'version_tag': model.version_tag,
                'status': model.status,
                'dataset': f'{model.dataset_version.dataset.name} '
                           f'v{model.dataset_version.version_number}',
                'trained_at': model.trained_at,
                'accuracy': metrics.get('accuracy'),
                'precision': metrics.get('precision'),
                'recall': metrics.get('recall'),
                'f1': metrics.get('f1'),
                'train_rows': model.train_rows,
                'test_rows': model.test_rows,
                'feature_count': model.feature_count,
                'training_duration_seconds': model.training_duration_seconds,
            })
        return Response({'results': results})


class AnalyticsExportView(APIView):
    """GET /api/analytics/export/?type=overview|posts - CSV export (admin)."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        export_type = request.query_params.get('type', 'overview')
        now_label = timezone.now().strftime('%Y%m%d_%H%M%S')

        if export_type == 'posts':
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = (
                f'attachment; filename="truthguard_posts_{now_label}.csv"'
            )
            writer = csv.writer(response)
            writer.writerow([
                'id', 'author', 'title', 'category', 'status', 'risk_level',
                'predicted_label', 'confidence', 'created_at',
            ])
            for post in Post.objects.select_related(
                'author', 'prediction'
            ).order_by('-created_at'):
                try:
                    prediction = post.prediction
                except ObjectDoesNotExist:
                    prediction = None
                writer.writerow([
                    post.id,
                    post.author.username,
                    post.title,
                    post.category,
                    post.status,
                    post.risk_level,
                    prediction.predicted_label if prediction else '',
                    prediction.confidence if prediction else '',
                    post.created_at.isoformat(),
                ])
            return response

        start, end = _parse_date_filters(request)
        posts = _range_filter(Post.objects.all(), start, end)
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = (
            f'attachment; filename="truthguard_overview_{now_label}.csv"'
        )
        writer = csv.writer(response)
        writer.writerow(['metric', 'value'])
        writer.writerow(['users_total', User.objects.count()])
        writer.writerow(['posts_total', posts.count()])
        writer.writerow(['posts_low_risk', posts.filter(risk_level='low').count()])
        writer.writerow(['posts_medium_risk', posts.filter(risk_level='medium').count()])
        writer.writerow(['posts_high_risk', posts.filter(risk_level='high').count()])
        writer.writerow(['posts_pending_review', posts.filter(status='pending_review').count()])
        writer.writerow(['posts_approved', posts.filter(status='approved').count()])
        writer.writerow(['posts_rejected', posts.filter(status='rejected').count()])
        writer.writerow(['predictions_total', Prediction.objects.count()])
        writer.writerow(['reports_total', UserReport.objects.count()])
        writer.writerow(['models_trained', MLModelVersion.objects.count()])
        active = get_active_model()
        writer.writerow(['active_model', active.name if active else 'none'])
        return response


class PublicStatsView(APIView):
    """GET /api/public/stats/ - small live counters for the landing page."""

    permission_classes = [AllowAny]

    def get(self, request):
        active_model = get_active_model()
        return Response({
            'users_total': User.objects.filter(is_active=True).count(),
            'posts_total': Post.objects.filter(
                status__in=['published', 'approved']).count(),
            'predictions_total': Prediction.objects.count(),
            'models_trained': MLModelVersion.objects.count(),
            'algorithms_available': 4,
            'active_model': {
                'name': active_model.name,
                'algorithm': active_model.get_algorithm_display(),
                'trained_at': active_model.trained_at,
            } if active_model else None,
        })
