from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('action', 'actor', 'target_type', 'target_id', 'ip_address', 'created_at')
    list_filter = ('action', 'created_at')
    search_fields = ('action', 'target_type', 'target_id', 'actor__username')
    readonly_fields = [f.name for f in AuditLog._meta.fields]
