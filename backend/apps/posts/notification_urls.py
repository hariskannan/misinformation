from django.urls import path

from . import views

urlpatterns = [
    path('', views.NotificationListView.as_view(), name='notifications'),
    path('unread-count/', views.NotificationUnreadCountView.as_view(), name='unread-count'),
    path('read-all/', views.MarkAllNotificationsReadView.as_view(), name='read-all'),
    path('<int:pk>/read/', views.MarkNotificationReadView.as_view(), name='mark-read'),
]
