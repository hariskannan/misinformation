from django.urls import path

from . import views

urlpatterns = [
    path('', views.ModelListView.as_view(), name='models'),
    path('algorithms/', views.AlgorithmInfoView.as_view(), name='algorithms'),
    path('train/', views.TrainModelView.as_view(), name='train'),
    path('training-status/<int:pk>/', views.TrainingStatusView.as_view(),
         name='training-status'),
    path('training-history/', views.TrainingHistoryView.as_view(),
         name='training-history'),
    path('compare/', views.ModelCompareView.as_view(), name='compare'),
    path('<int:pk>/activate/', views.ActivateModelView.as_view(), name='activate'),
    path('<int:pk>/deactivate/', views.DeactivateModelView.as_view(), name='deactivate'),
]
