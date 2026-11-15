from django.core.exceptions import ObjectDoesNotExist
from django.db.models import F, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.pagination import DefaultPagination
from apps.core.permissions import IsModeratorOrAdmin
from apps.core.utils import log_audit
from apps.ml.prediction import LIMITATIONS_TEXT, label_display
from apps.posts.models import Notification, Post, UserReport
from apps.posts.serializers import UserReportSerializer
from apps.posts.services import notify

from .models import ModerationReview
from .serializers import ModerationQueueItemSerializer, ModerationReviewSerializer


class ModerationStatsView(APIView):
    """GET /api/moderation/stats/ - dashboard statistics for moderators."""

    permission_classes = [IsModeratorOrAdmin]

    def get(self, request):
        return Response({
            'total_flagged': Post.objects.filter(
                status=Post.Status.PENDING_REVIEW).count(),
            'pending_reviews': Post.objects.filter(
                status=Post.Status.PENDING_REVIEW).count(),
            'approved_posts': Post.objects.filter(status=Post.Status.APPROVED).count(),
            'rejected_posts': Post.objects.filter(status=Post.Status.REJECTED).count(),
            'user_reports': UserReport.objects.count(),
            'open_reports': UserReport.objects.filter(
                status__in=[UserReport.Status.OPEN, UserReport.Status.IN_REVIEW]).count(),
            'total_reviews': ModerationReview.objects.count(),
            # Count every human decision that changed a post's risk level,
            # whether it happened during approval or through a later set-risk.
            'risk_overrides': (
                ModerationReview.objects
                .exclude(new_risk_level='')
                .exclude(previous_risk_level='')
                .exclude(new_risk_level=F('previous_risk_level'))
                .count()
            ),
        })


class ModerationQueueView(APIView):
    """GET /api/moderation/queue/ - posts awaiting review."""

    permission_classes = [IsModeratorOrAdmin]

    def get(self, request):
        queryset = (
            Post.objects.filter(status=Post.Status.PENDING_REVIEW)
            .select_related('author', 'author__profile', 'prediction',
                            'prediction__model_version')
            .prefetch_related('reports')
        )
        risk = request.query_params.get('risk')
        if risk in Post.RiskLevel.values:
            queryset = queryset.filter(risk_level=risk)
        category = request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)

        paginator = DefaultPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = ModerationQueueItemSerializer(
            page, many=True, context={'request': request}
        )
        return paginator.get_paginated_response(serializer.data)


class _ModerationActionBase(APIView):
    permission_classes = [IsModeratorOrAdmin]

    action = None

    def post(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        if post.status != Post.Status.PENDING_REVIEW:
            return Response(
                {'detail': 'This post is not awaiting review.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        remarks = (request.data.get('remarks') or '').strip()
        if self.action == ModerationReview.Action.REJECTED and not remarks:
            return Response(
                {'detail': 'Rejection remarks are required so the author understands '
                           'the decision.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # An approval may optionally lower (or raise) the post's risk level.
        # The original machine-learning Prediction is never modified.
        previous_risk = post.risk_level
        new_risk = ''
        if self.action == ModerationReview.Action.APPROVED:
            new_risk = (request.data.get('new_risk_level') or '').strip().lower()
            if new_risk and new_risk not in Post.RiskLevel.values:
                return Response(
                    {'detail': 'Invalid risk level. Use low, medium or high.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if new_risk == previous_risk:
                new_risk = ''

        risk_changed = bool(new_risk)
        review = ModerationReview.objects.create(
            post=post,
            moderator=request.user,
            action=self.action,
            remarks=remarks,
            previous_risk_level=previous_risk if risk_changed else '',
            new_risk_level=new_risk,
        )

        if self.action == ModerationReview.Action.APPROVED:
            post.status = Post.Status.APPROVED
            if risk_changed:
                post.risk_level = new_risk
            verb = 'Your post was approved'
            message = (
                'A moderator reviewed your flagged post and approved it. It is now '
                'publicly visible. ' + (f'Remarks: {remarks}' if remarks else '')
            )
            if risk_changed:
                message += (
                    f' The moderator also changed the risk level from '
                    f'{self._risk_label(previous_risk)} to '
                    f'{self._risk_label(new_risk)}; the original model prediction '
                    'remains on record.'
                )
            audit_action = 'post_approved'
        else:
            post.status = Post.Status.REJECTED
            verb = 'Your post was rejected'
            message = (
                'A moderator reviewed your flagged post and rejected it. It remains '
                'hidden from the feed. ' + (f'Remarks: {remarks}' if remarks else '')
            )
            audit_action = 'post_rejected'
        update_fields = ['status', 'updated_at']
        if risk_changed:
            update_fields.append('risk_level')
        post.save(update_fields=update_fields)

        notify(
            post.author, verb, message,
            notification_type=Notification.Type.MODERATION, post=post,
        )

        # Resolve any open user reports for this post.
        now = timezone.now()
        post.reports.filter(
            status__in=[UserReport.Status.OPEN, UserReport.Status.IN_REVIEW]
        ).update(
            status=UserReport.Status.RESOLVED,
            resolution_remarks=(
                f'Post was {"approved" if self.action == "approved" else "rejected"} '
                f'by a moderator.'
            ),
            resolved_by=request.user,
            resolved_at=now,
        )

        log_audit(request, audit_action, 'post', post.id,
                  {'moderator': request.user.username,
                   'remarks': remarks[:500],
                   'previous_risk_level': previous_risk,
                   'new_risk_level': new_risk or previous_risk})

        return Response({
            'detail': f'Post {"approved" if self.action == "approved" else "rejected"}.',
            'review': ModerationReviewSerializer(review).data,
        })

    @staticmethod
    def _risk_label(value):
        return dict(Post.RiskLevel.choices).get(value, value or 'unassessed')


class ApprovePostView(_ModerationActionBase):
    """POST /api/moderation/{id}/approve/"""

    action = ModerationReview.Action.APPROVED


class RejectPostView(_ModerationActionBase):
    """POST /api/moderation/{id}/reject/"""

    action = ModerationReview.Action.REJECTED


class SetPostRiskView(APIView):
    """POST /api/moderation/{id}/set-risk/ - override a post's risk level.

    This is a human moderation decision recorded separately from the model
    prediction. The linked Prediction row is never modified.
    """

    permission_classes = [IsModeratorOrAdmin]

    def post(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        if post.status == Post.Status.PENDING_REVIEW:
            return Response(
                {'detail': 'This post is still in the review queue. Use approve or '
                           'reject (approval accepts an optional new risk level).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        risk_level = (request.data.get('risk_level') or '').strip().lower()
        if risk_level not in Post.RiskLevel.values:
            return Response(
                {'detail': 'Invalid risk level. Use low, medium or high.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        remarks = (request.data.get('remarks') or '').strip()
        if len(remarks) < 10:
            return Response(
                {'detail': 'Please write at least 10 characters explaining the risk '
                           'change so the decision is auditable.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        previous_risk = post.risk_level
        if previous_risk == risk_level:
            return Response(
                {'detail': f'This post already has {risk_level} risk.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        post.risk_level = risk_level
        post.save(update_fields=['risk_level', 'updated_at'])

        review = ModerationReview.objects.create(
            post=post,
            moderator=request.user,
            action=ModerationReview.Action.RISK_OVERRIDDEN,
            remarks=remarks,
            previous_risk_level=previous_risk,
            new_risk_level=risk_level,
        )

        labels = dict(Post.RiskLevel.choices)
        share_note = (
            'The post is now eligible for social sharing.'
            if risk_level in (Post.RiskLevel.LOW, Post.RiskLevel.MEDIUM)
            else 'High-risk posts cannot be shared to social media.'
        )
        notify(
            post.author,
            'Risk level updated by a moderator',
            (
                f'A moderator changed the risk level of your post from '
                f'{labels.get(previous_risk, previous_risk or "unassessed")} to '
                f'{labels[risk_level]}. {share_note} The original model prediction '
                f'is unchanged and remains on record. Remarks: {remarks}'
            ),
            notification_type=Notification.Type.MODERATION,
            post=post,
        )

        log_audit(request, 'post_risk_overridden', 'post', post.id, {
            'moderator': request.user.username,
            'previous_risk_level': previous_risk,
            'new_risk_level': risk_level,
            'remarks': remarks[:500],
        })

        return Response({
            'detail': (
                f'Risk level changed from {previous_risk or "unassessed"} to '
                f'{risk_level}.'
            ),
            'review': ModerationReviewSerializer(review).data,
            'post': ModerationQueueItemSerializer(
                post, context={'request': request}
            ).data,
        })


class ModeratedPostsView(APIView):
    """GET /api/moderation/posts/ - posts that are no longer in the queue.

    Moderators use this list to review and adjust risk levels after a post has
    been published, approved or rejected.
    """

    permission_classes = [IsModeratorOrAdmin]

    def get(self, request):
        queryset = (
            Post.objects.filter(status__in=[
                Post.Status.PUBLISHED, Post.Status.APPROVED, Post.Status.REJECTED,
            ])
            .select_related('author', 'author__profile', 'prediction',
                            'prediction__model_version')
            .prefetch_related('reports', 'reviews__moderator')
        )
        post_status = request.query_params.get('status')
        if post_status in (Post.Status.PUBLISHED, Post.Status.APPROVED,
                           Post.Status.REJECTED):
            queryset = queryset.filter(status=post_status)
        risk = request.query_params.get('risk')
        if risk in Post.RiskLevel.values:
            queryset = queryset.filter(risk_level=risk)
        category = request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        search = request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(content__icontains=search)
            )

        paginator = DefaultPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = ModerationQueueItemSerializer(
            page, many=True, context={'request': request}
        )
        return paginator.get_paginated_response(serializer.data)


class ModerationReportsView(APIView):
    """GET /api/moderation/reports/ - user reports for moderators."""

    permission_classes = [IsModeratorOrAdmin]

    def get(self, request):
        queryset = UserReport.objects.select_related(
            'post', 'post__author', 'post__author__profile', 'reporter', 'resolved_by'
        )
        report_status = request.query_params.get('status')
        if report_status in UserReport.Status.values:
            queryset = queryset.filter(status=report_status)
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = UserReportSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class ResolveReportView(APIView):
    """POST /api/moderation/reports/{id}/resolve/ - act on a user report.

    Body: {action: resolve|dismiss|escalate, remarks}
    """

    permission_classes = [IsModeratorOrAdmin]

    def post(self, request, pk):
        report = get_object_or_404(UserReport, pk=pk)
        if report.status in (UserReport.Status.RESOLVED, UserReport.Status.DISMISSED):
            return Response(
                {'detail': 'This report was already handled.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        action = request.data.get('action', 'resolve')
        remarks = (request.data.get('remarks') or '').strip()
        if action not in ('resolve', 'dismiss', 'escalate'):
            return Response(
                {'detail': 'Invalid action. Use resolve, dismiss or escalate.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        report.resolved_by = request.user
        report.resolution_remarks = remarks
        report.resolved_at = timezone.now()

        if action == 'resolve':
            report.status = UserReport.Status.RESOLVED
            message = 'Your report was reviewed and resolved by a moderator.'
        elif action == 'dismiss':
            report.status = UserReport.Status.DISMISSED
            message = 'Your report was reviewed and dismissed by a moderator.'
        else:  # escalate: forward the post to the moderation queue
            report.status = UserReport.Status.IN_REVIEW
            report.resolved_at = None
            report.save()
            post = report.post
            if post.status in (Post.Status.PUBLISHED, Post.Status.APPROVED):
                post.status = Post.Status.PENDING_REVIEW
                post.save(update_fields=['status'])
                notify(
                    post.author,
                    'Your post is under moderator review',
                    'A user report was escalated and your post is temporarily '
                    'held for moderator review.',
                    notification_type=Notification.Type.MODERATION,
                    post=post,
                )
            notify(
                report.reporter, 'Your report is now in review',
                'A moderator escalated your report to the review queue.',
                notification_type=Notification.Type.REPORT,
                post=report.post,
            )
            log_audit(request, 'report_resolved', 'user_report', report.id,
                      {'action': action, 'moderator': request.user.username})
            return Response({'detail': 'Report escalated to the review queue.',
                             'report': UserReportSerializer(report).data})

        report.save()
        notify(
            report.reporter, 'Your report was handled', message,
            notification_type=Notification.Type.REPORT, post=report.post,
        )
        log_audit(request, 'report_resolved', 'user_report', report.id,
                  {'action': action, 'moderator': request.user.username})
        return Response({'detail': f'Report {action}d.',
                         'report': UserReportSerializer(report).data})


class ModerationHistoryView(APIView):
    """GET /api/moderation/history/ - moderation review history."""

    permission_classes = [IsModeratorOrAdmin]

    def get(self, request):
        queryset = ModerationReview.objects.select_related(
            'post', 'post__author', 'moderator'
        )
        mine_only = request.query_params.get('mine') == '1'
        if mine_only:
            queryset = queryset.filter(moderator=request.user)
        action = request.query_params.get('action')
        if action in ModerationReview.Action.values:
            queryset = queryset.filter(action=action)
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = ModerationReviewSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class ModerationPredictionDetailsView(APIView):
    """GET /api/moderation/{post_id}/prediction/ - full prediction details
    for a post in the queue."""

    permission_classes = [IsModeratorOrAdmin]

    def get(self, request, post_id):
        post = get_object_or_404(Post, pk=post_id)
        try:
            prediction = post.prediction
        except ObjectDoesNotExist:
            prediction = None
        if prediction is None:
            return Response({'detail': 'No prediction recorded for this post.'},
                            status=status.HTTP_404_NOT_FOUND)
        return Response({
            'id': prediction.id,
            'post_id': post.id,
            'input_text': prediction.input_text,
            'predicted_label': prediction.predicted_label,
            'predicted_label_display': label_display(prediction.predicted_label),
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
            'limitations': LIMITATIONS_TEXT,
        })
