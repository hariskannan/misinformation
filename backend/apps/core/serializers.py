from rest_framework import serializers

from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source='actor.username', read_only=True, default=None)

    class Meta:
        model = AuditLog
        fields = [
            'id', 'action', 'actor', 'actor_username', 'target_type',
            'target_id', 'details', 'ip_address', 'created_at',
        ]
