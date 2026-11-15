from django.urls import path

from . import views

urlpatterns = [
    path('', views.PostFeedView.as_view(), name='post-feed'),
    path('mine/', views.MyPostsView.as_view(), name='my-posts'),
    path('categories/', views.TrendingCategoriesView.as_view(), name='trending-categories'),
    path('my-recent-predictions/', views.MyRecentPredictionsView.as_view(),
         name='my-recent-predictions'),
    path('<int:pk>/', views.PostDetailView.as_view(), name='post-detail'),
    path('<int:pk>/like/', views.LikeToggleView.as_view(), name='post-like'),
    path('<int:pk>/comments/', views.CommentView.as_view(), name='post-comments'),
    path('<int:pk>/comment/', views.CommentView.as_view(), name='post-comment'),
    path('<int:pk>/report/', views.ReportPostView.as_view(), name='post-report'),
]
