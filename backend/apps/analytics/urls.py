from django.urls import path

from . import views

urlpatterns = [
    path('overview/', views.AnalyticsOverviewView.as_view(), name='overview'),
    path('risk-distribution/', views.RiskDistributionView.as_view(),
         name='risk-distribution'),
    path('activity/', views.ActivityView.as_view(), name='activity'),
    path('moderation-stats/', views.ModerationStatsView.as_view(),
         name='moderation-stats'),
    path('model-performance/', views.ModelPerformanceView.as_view(),
         name='model-performance'),
    path('export/', views.AnalyticsExportView.as_view(), name='export'),
]
