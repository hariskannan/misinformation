from django.urls import path
from rest_framework import status as http_status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsModeratorOrAdmin

from .models import MLModelVersion, Prediction
from .prediction import (
    NoActiveModelError,
    PredictionInputError,
    PredictionServiceError,
    get_active_model,
    predict_text,
)
from .serializers import MLModelVersionSerializer, PredictionSerializer


class AnalyzeView(APIView):
    """POST /api/predictions/analyze/ - analyze text without publishing it."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        text = request.data.get('text')
        try:
            prediction = predict_text(text, user=request.user)
        except NoActiveModelError as exc:
            return Response({'detail': str(exc)}, status=http_status.HTTP_409_CONFLICT)
        except PredictionInputError as exc:
            return Response({'detail': str(exc)}, status=http_status.HTTP_400_BAD_REQUEST)
        except PredictionServiceError as exc:
            return Response(
                {'detail': str(exc)}, status=http_status.HTTP_503_SERVICE_UNAVAILABLE
            )
        return Response(PredictionSerializer(prediction).data,
                         status=http_status.HTTP_201_CREATED)


class PredictionDetailView(APIView):
    """GET /api/predictions/{id}/ - prediction details.

    Accessible by the user who triggered it and by staff.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            prediction = Prediction.objects.select_related(
                'model_version', 'created_by', 'post'
            ).get(pk=pk)
        except Prediction.DoesNotExist:
            return Response({'detail': 'Prediction not found.'},
                            status=http_status.HTTP_404_NOT_FOUND)

        user = request.user
        if user.role not in ('moderator', 'admin'):
            if prediction.created_by_id != user.id and (
                prediction.post is None or prediction.post.author_id != user.id
            ):
                return Response(
                    {'detail': 'You do not have access to this prediction.'},
                    status=http_status.HTTP_403_FORBIDDEN,
                )
        return Response(PredictionSerializer(prediction).data)


class ActiveModelView(APIView):
    """GET /api/predictions/active-model/ - the currently active model."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        active = get_active_model()
        if active is None:
            return Response(
                {'detail': 'No model is currently active.'},
                status=http_status.HTTP_404_NOT_FOUND,
            )
        return Response(MLModelVersionSerializer(active).data)


urlpatterns = [
    path('analyze/', AnalyzeView.as_view(), name='analyze'),
    path('active-model/', ActiveModelView.as_view(), name='active-model'),
    path('<int:pk>/', PredictionDetailView.as_view(), name='prediction-detail'),
]
