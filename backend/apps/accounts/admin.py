from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User, UserProfile


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False


@admin.register(User)
class TruthGuardUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'role', 'is_active', 'date_joined')
    list_filter = ('role', 'is_active')
    search_fields = ('username', 'email')
    inlines = (UserProfileInline,)
    fieldsets = UserAdmin.fieldsets + (
        ('TruthGuard', {'fields': ('role',)}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('TruthGuard', {'fields': ('role',)}),
    )
