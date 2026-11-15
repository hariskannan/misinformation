import threading

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsAdminRole
from apps.core.utils import log_audit

from .models import MLModelVersion, TrainingJob
from .serializers import (
    MLModelVersionSerializer,
    TrainingJobSerializer,
    algorithm_info_payload,
)
from .training import ALGORITHM_INFO, run_training_job


class ModelListView(APIView):
    """GET /api/models/ - list all trained model versions (admin)."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        queryset = MLModelVersion.objects.select_related(
            'dataset_version', 'trained_by', 'activated_by'
        )
        algorithm = request.query_params.get('algorithm')
        if algorithm in MLModelVersion.Algorithm.values:
            queryset = queryset.filter(algorithm=algorithm)
        model_status = request.query_params.get('status')
        if model_status in MLModelVersion.Status.values:
            queryset = queryset.filter(status=model_status)
        from apps.core.pagination import DefaultPagination
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = MLModelVersionSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class AlgorithmInfoView(APIView):
    """GET /api/models/algorithms/ - supported algorithms and parameters."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        return Response({'results': algorithm_info_payload()})


class TrainModelView(APIView):
    """POST /api/models/train/ - start a new training job (admin).

    Body: {dataset_version, algorithm, params: {...}}
    Training runs in a background thread; poll training-status/{id}/.
    """

    permission_classes = [IsAdminRole]

    def post(self, request):
        from apps.datasets.models import DatasetVersion

        algorithm = request.data.get('algorithm')
        if algorithm not in ALGORITHM_INFO:
            return Response(
                {
                    'detail': f'Invalid algorithm. Choose one of: '
                              f'{", ".join(ALGORITHM_INFO)}.'
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        dataset_version_id = request.data.get('dataset_version')
        try:
            dataset_version = DatasetVersion.objects.get(pk=dataset_version_id)
        except (TypeError, ValueError, DatasetVersion.DoesNotExist):
            return Response(
                {'detail': 'Dataset version not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        if dataset_version.status != 'validated':
            return Response(
                {
                    'detail': (
                        'The dataset version must pass validation before it can '
                        'be used for training.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw_params = request.data.get('params') or {}
        allowed = {'max_features', 'test_size', 'n_estimators', 'max_depth', 'alpha', 'C'}
        params = {}
        for key, value in raw_params.items():
            if key not in allowed:
                continue
            try:
                params[key] = float(value) if '.' in str(value) else int(value)
            except (TypeError, ValueError):
                return Response(
                    {'detail': f'Invalid value for parameter "{key}".'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        job = TrainingJob.objects.create(
            algorithm=algorithm,
            dataset_version=dataset_version,
            params=params,
            created_by=request.user,
        )
        log_audit(
            request, 'model_training_started', 'training_job', job.id,
            {'algorithm': algorithm, 'dataset_version': dataset_version_id,
             'params': params},
        )

        thread = threading.Thread(
            target=run_training_job, args=(job.pk,), daemon=True,
            name=f'training-job-{job.pk}',
        )
        thread.start()

        return Response(
            TrainingJobSerializer(job).data, status=status.HTTP_202_ACCEPTED
        )


class TrainingStatusView(APIView):
    """GET /api/models/training-status/{id}/ - poll job progress (admin)."""

    permission_classes = [IsAdminRole]

    def get(self, request, pk):
        job = get_object_or_404(TrainingJob.objects.select_related(
            'model_version', 'dataset_version', 'created_by'
        ), pk=pk)
        return Response(TrainingJobSerializer(job).data)


class TrainingHistoryView(APIView):
    """GET /api/models/training-history/ - all training jobs (admin)."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        from apps.core.pagination import DefaultPagination
        queryset = TrainingJob.objects.select_related(
            'model_version', 'dataset_version', 'created_by'
        )
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = TrainingJobSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class ActivateModelView(APIView):
    """POST /api/models/{id}/activate/ - activate a trained model (admin)."""

    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        model_version = get_object_or_404(MLModelVersion, pk=pk)
        if model_version.status == MLModelVersion.Status.ACTIVE:
            return Response(
                {'detail': 'This model is already active.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if model_version.status != MLModelVersion.Status.TRAINED and \
                model_version.status != MLModelVersion.Status.DEPRECATED:
            return Response(
                {'detail': 'Only successfully trained models can be activated.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not model_version.metrics or 'accuracy' not in model_version.metrics:
            return Response(
                {'detail': 'This model has no evaluation metrics and cannot be activated.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Deactivate the currently active model first.
        MLModelVersion.objects.filter(status=MLModelVersion.Status.ACTIVE).update(
            status=MLModelVersion.Status.DEPRECATED
        )
        from django.utils import timezone
        model_version.status = MLModelVersion.Status.ACTIVE
        model_version.activated_by = request.user
        model_version.activated_at = timezone.now()
        model_version.save(update_fields=['status', 'activated_by', 'activated_at'])

        log_audit(request, 'model_activated', 'ml_model', model_version.id,
                  {'name': model_version.name, 'algorithm': model_version.algorithm})
        return Response(MLModelVersionSerializer(model_version).data)


class DeactivateModelView(APIView):
    """POST /api/models/{id}/deactivate/ - deactivate a model (admin)."""

    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        model_version = get_object_or_404(MLModelVersion, pk=pk)
        if model_version.status != MLModelVersion.Status.ACTIVE:
            return Response(
                {'detail': 'This model is not active.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        model_version.status = MLModelVersion.Status.DEPRECATED
        model_version.save(update_fields=['status'])
        log_audit(request, 'model_deactivated', 'ml_model', model_version.id,
                  {'name': model_version.name})
        return Response(MLModelVersionSerializer(model_version).data)


class ModelCompareView(APIView):
    """GET /api/models/compare/?ids=1,2,3 - metrics of selected models (admin).
    Without ids, returns all models for comparison."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        queryset = MLModelVersion.objects.select_related('dataset_version')
        ids_param = request.query_params.get('ids')
        if ids_param:
            ids = []
            for chunk in ids_param.split(','):
                try:
                    ids.append(int(chunk))
                except ValueError:
                    pass
            if ids:
                queryset = queryset.filter(pk__in=ids)
        serializer = MLModelVersionSerializer(queryset, many=True)
        models = serializer.data
        # Ranking by F1 (weighted), the primary comparison metric.
        models_sorted = sorted(
            models, key=lambda m: (m.get('metrics') or {}).get('f1', 0), reverse=True
        )
        return Response({'results': models_sorted})
