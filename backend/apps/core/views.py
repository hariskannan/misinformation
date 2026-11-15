from django.contrib.auth import get_user_model
from rest_framework import generics, permissions

from .models import AuditLog
from .serializers import AuditLogSerializer

User = get_user_model()


class IsAdminRole(permissions.BasePermission):
    message = 'Only administrators can access audit logs.'

    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and request.user.role == 'admin'
        )


class AuditLogListView(generics.ListAPIView):
    """GET /api/admin/audit-logs/ - system activity and audit trail (admin)."""

    serializer_class = AuditLogSerializer
    permission_classes = [IsAdminRole]

    def get_queryset(self):
        queryset = AuditLog.objects.select_related('actor').all()
        action = self.request.query_params.get('action')
        if action:
            queryset = queryset.filter(action=action)
        search = self.request.query_params.get('search')
        if search:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(action__icontains=search)
                | Q(target_type__icontains=search)
                | Q(actor__username__icontains=search)
            )
        return queryset
