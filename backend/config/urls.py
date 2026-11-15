"""Root URL configuration for TruthGuard."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.analytics.views import PublicStatsView

urlpatterns = [
    path('admin/', admin.site.urls),
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

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
