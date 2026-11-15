from django.urls import path

from . import views

urlpatterns = [
    path('', views.DatasetListView.as_view(), name='datasets'),
    path('upload/', views.DatasetUploadView.as_view(), name='dataset-upload'),
    path('<int:pk>/', views.DatasetDetailView.as_view(), name='dataset-detail'),
    path('<int:pk>/preview/', views.DatasetPreviewView.as_view(), name='dataset-preview'),
    path('<int:pk>/validate/', views.DatasetValidateView.as_view(), name='dataset-validate'),
]
