from django.urls import path

from . import views

urlpatterns = [
    path('mine/', views.MyReportsView.as_view(), name='my-reports'),
]
