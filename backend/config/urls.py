"""Root URL configuration for TruthGuard."""
import os

from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve as static_serve
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.analytics.views import PublicStatsView

from .views import health, spa_index

urlpatterns = [
    path('admin/', admin.site.urls),
    # Health check used by hosting platforms
    path('health', health, name='health'),
    path('api/health/', health, name='api-health'),
    # API documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='api-docs'),
    # Authentication
    path('api/auth/', include('apps.accounts.urls')),
    path('api/admin/users/', include('apps.accounts.admin_urls')),
    path('api/admin/audit-logs/', include('apps.core.urls')),
    # Social feed
    path('api/posts/', include('apps.posts.urls')),
    path('api/notifications/', include('apps.posts.notification_urls')),
    path('api/reports/', include('apps.posts.report_urls')),
    # Predictions & ML model management
    path('api/predictions/', include('apps.ml.prediction_urls')),
    path('api/models/', include('apps.ml.urls')),
    # Moderation
    path('api/moderation/', include('apps.moderation.urls')),
    # Dataset management
    path('api/datasets/', include('apps.datasets.urls')),
    # Analytics
    path('api/analytics/', include('apps.analytics.urls')),
    # Public landing page counters
    path('api/public/stats/', PublicStatsView.as_view(), name='public-stats'),
]

# User-uploaded images. Fine for a demo deployment; use object storage when
# running at scale. Served in both development and production.
urlpatterns += [
    re_path(
        r'^media/(?P<path>.*)$',
        static_serve,
        {'document_root': settings.MEDIA_ROOT},
    ),
]

# Built React app (Docker/Render single-service deployment). API, admin,
# static and media requests are matched above or by WhiteNoise.
urlpatterns += [
    re_path(
        r'^(?P<path>(?!api/|admin/|static/|media/).*)$',
        spa_index,
        name='frontend',
    ),
]
