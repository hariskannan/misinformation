from django.urls import path

from . import views

urlpatterns = [
    path('stats/', views.ModerationStatsView.as_view(), name='moderation-stats'),
    path('queue/', views.ModerationQueueView.as_view(), name='moderation-queue'),
    path('reports/', views.ModerationReportsView.as_view(), name='moderation-reports'),
    path('reports/<int:pk>/resolve/', views.ResolveReportView.as_view(),
         name='resolve-report'),
    path('history/', views.ModerationHistoryView.as_view(), name='moderation-history'),
    path('<int:pk>/approve/', views.ApprovePostView.as_view(), name='approve-post'),
    path('<int:pk>/reject/', views.RejectPostView.as_view(), name='reject-post'),
    path('<int:pk>/set-risk/', views.SetPostRiskView.as_view(), name='set-post-risk'),
    path('posts/', views.ModeratedPostsView.as_view(), name='moderated-posts'),
    path('<int:post_id>/prediction/', views.ModerationPredictionDetailsView.as_view(),
         name='moderation-prediction'),
]
