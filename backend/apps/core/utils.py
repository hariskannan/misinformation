def get_client_ip(request):
    """Best-effort extraction of the client IP from a request."""
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def log_audit(request, action, target_type='', target_id='', details=None):
    """Create an AuditLog entry for the current request.

    Never raises: audit logging must not break the main request flow.
    """
    from .models import AuditLog

    user = getattr(request, 'user', None)
    if user is not None and not user.is_authenticated:
        user = None
    try:
        return AuditLog.objects.create(
            actor=user,
            action=action,
            target_type=target_type,
            target_id=str(target_id or ''),
            details=details or {},
            ip_address=get_client_ip(request) if request else None,
        )
    except Exception:
        return None
