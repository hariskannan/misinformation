from django.contrib.auth import get_user_model
from django.db.models import Q
from django.urls import path
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsAdminRole as IsAdminRolePermission
from apps.core.utils import log_audit
from apps.posts.models import Notification

from .serializers import (
    AdminPasswordResetSerializer,
    AdminUserSerializer,
    AdminUserUpdateSerializer,
)

User = get_user_model()


class IsAdminRole(permissions.BasePermission):
    message = 'Only administrators can manage users.'

    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and request.user.role == 'admin'
        )


class AdminUserListView(generics.ListAPIView):
    """GET /api/admin/users/ - list all users (search + filter by role)."""

    serializer_class = AdminUserSerializer
    permission_classes = [IsAdminRole]

    def get_queryset(self):
        queryset = User.objects.select_related('profile').order_by('-date_joined')
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(username__icontains=search)
                | Q(email__icontains=search)
                | Q(profile__full_name__icontains=search)
            )
        role = self.request.query_params.get('role')
        if role in User.Role.values:
            queryset = queryset.filter(role=role)
        return queryset


class AdminUserUpdateView(APIView):
    """PATCH /api/admin/users/{id}/ - change role / activation status."""

    permission_classes = [IsAdminRole]

    def patch(self, request, pk):
        try:
            target = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminUserUpdateSerializer(
            data=request.data, context={'request': request, 'target_user': target}
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if 'role' in data and data['role'] != target.role:
            target.role = data['role']
            target.is_staff = data['role'] == User.Role.ADMIN
            log_audit(request, 'user_role_changed', 'user', target.id,
                      {'new_role': data['role'], 'username': target.username})
            Notification.objects.create(
                recipient=target,
                verb='Your account role was changed',
                message=f'An administrator changed your role to {data["role"]}.',
                notification_type='system',
            )
        if 'is_active' in data and data['is_active'] != target.is_active:
            target.is_active = data['is_active']
            log_audit(request, 'user_status_changed', 'user', target.id,
                      {'is_active': data['is_active'], 'username': target.username})
        target.save()
        return Response(AdminUserSerializer(target).data)


class AdminPasswordResetView(APIView):
    """POST /api/admin/users/{id}/reset-password/ - set a new password for a user."""

    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        try:
            target = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminPasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target.set_password(serializer.validated_data['new_password'])
        target.save()
        log_audit(request, 'user_password_reset', 'user', target.id,
                  {'username': target.username})
        Notification.objects.create(
            recipient=target,
            verb='Your password was reset',
            message='An administrator reset your password. If this was unexpected, contact support.',
            notification_type='system',
        )
        return Response({'detail': f'Password reset for {target.username}.'})


urlpatterns = [
    path('', AdminUserListView.as_view(), name='admin-users'),
    path('<int:pk>/', AdminUserUpdateView.as_view(), name='admin-user-update'),
    path('<int:pk>/reset-password/', AdminPasswordResetView.as_view(),
         name='admin-user-reset-password'),
]
