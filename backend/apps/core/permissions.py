from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsAdminRole(BasePermission):
    """Allows access only to users with the administrator role."""

    message = 'Only administrators can perform this action.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'admin')


class IsModeratorOrAdmin(BasePermission):
    """Allows access to moderators and administrators."""

    message = 'Only moderators and administrators can perform this action.'

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in ('moderator', 'admin')
        )


class IsOwnerOrModeratorOrAdmin(BasePermission):
    """Object-level permission: owner, moderator or admin (read for owner)."""

    message = 'You do not have permission to access this object.'

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.role in ('moderator', 'admin'):
            return True
        owner = getattr(obj, 'author', None) or getattr(obj, 'user', None) or getattr(obj, 'reporter', None)
        return owner == user
