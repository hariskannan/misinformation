from django.db import transaction
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.pagination import DefaultPagination
from apps.core.permissions import IsAdminRole
from apps.core.utils import log_audit

from .models import Dataset, DatasetVersion
from .serializers import DatasetSerializer
from .services import (
    DatasetServiceError,
    preview_dataset,
    read_dataframe,
    validate_and_clean,
    validate_upload_file,
)


class DatasetListView(APIView):
    """GET /api/datasets/ - all datasets with their versions (admin)."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        queryset = Dataset.objects.prefetch_related('versions', 'column_mappings')
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = DatasetSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class DatasetUploadView(APIView):
    """POST /api/datasets/upload/ - upload a CSV/TSV/XLSX file (admin).

    The file is received, parsed and stored; a raw DatasetVersion is
    created. Validation (column selection + label mapping) is a separate
    step so the admin can inspect the preview first.
    """

    permission_classes = [IsAdminRole]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file = request.FILES.get('file')
        try:
            extension = validate_upload_file(file)
        except DatasetServiceError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        name = (request.data.get('name') or '').strip()
        if not name:
            name = (file.name or 'dataset').rsplit('.', 1)[0]

        with transaction.atomic():
            dataset, created = Dataset.objects.get_or_create(
                name=name,
                defaults={
                    'description': request.data.get('description', ''),
                    'source_url': request.data.get('source_url', ''),
                    'license_notes': request.data.get('license_notes', ''),
                    'uploaded_by': request.user,
                },
            )
            if not created:
                # Re-uploading under the same dataset name creates a new version.
                dataset.uploaded_by = request.user
                dataset.save(update_fields=['uploaded_by'])

            version_number = dataset.versions.count() + 1
            version = DatasetVersion.objects.create(
                dataset=dataset,
                version_number=version_number,
                file=file,
                original_filename=file.name,
                file_format=extension,
                created_by=request.user,
                notes=request.data.get('notes', ''),
                status=DatasetVersion.Status.RAW,
            )

        # Parse immediately so upload errors surface right away.
        try:
            df = read_dataframe(version.file.path, version.file_format)
            version.row_count = int(len(df))
            version.column_count = int(df.shape[1])
            version.save(update_fields=['row_count', 'column_count'])
        except DatasetServiceError as exc:
            version.delete()
            if created and dataset.versions.count() == 0:
                dataset.delete()
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        log_audit(request, 'dataset_uploaded', 'dataset_version', version.id,
                  {'name': dataset.name, 'rows': version.row_count,
                   'format': version.file_format})

        try:
            preview = preview_dataset(version)
        except DatasetServiceError as exc:
            preview = {'error': str(exc)}

        return Response(
            {'dataset': DatasetSerializer(dataset).data, 'preview': preview},
            status=status.HTTP_201_CREATED,
        )


class DatasetDetailView(APIView):
    """GET /api/datasets/{id}/ - dataset detail with versions (admin)."""

    permission_classes = [IsAdminRole]

    def get(self, request, pk):
        from django.shortcuts import get_object_or_404
        dataset = get_object_or_404(Dataset.objects.prefetch_related('versions'), pk=pk)
        return Response(DatasetSerializer(dataset).data)

    def delete(self, request, pk):
        from django.shortcuts import get_object_or_404
        dataset = get_object_or_404(Dataset, pk=pk)
        for version in dataset.versions.all():
            if version.file:
                version.file.delete(save=False)
            if version.cleaned_file:
                version.cleaned_file.delete(save=False)
        name = dataset.name
        dataset.delete()
        log_audit(request, 'dataset_deleted', 'dataset', pk, {'name': name})
        return Response({'detail': f'Dataset "{name}" deleted.'},
                        status=status.HTTP_200_OK)


class DatasetPreviewView(APIView):
    """GET /api/datasets/{id}/preview/ - parsed preview of a dataset (admin).

    Query params: ?version=<id> (default: latest version).
    """

    permission_classes = [IsAdminRole]

    def get(self, request, pk):
        from django.shortcuts import get_object_or_404
        dataset = get_object_or_404(Dataset, pk=pk)
        version_id = request.query_params.get('version')
        if version_id:
            version = dataset.versions.filter(pk=version_id).first()
            if version is None:
                return Response({'detail': 'Version not found.'},
                                status=status.HTTP_404_NOT_FOUND)
        else:
            version = dataset.versions.order_by('-version_number').first()
            if version is None:
                return Response({'detail': 'This dataset has no versions.'},
                                status=status.HTTP_404_NOT_FOUND)

        try:
            preview = preview_dataset(version)
        except DatasetServiceError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(preview)


class DatasetValidateView(APIView):
    """POST /api/datasets/{id}/validate/ - clean + validate a dataset (admin).

    Body:
      text_column, label_column,
      label_mapping: {"original": "fake"|"real", ...},
      drop_missing (bool), drop_duplicates (bool)
    """

    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        from django.shortcuts import get_object_or_404
        dataset = get_object_or_404(Dataset, pk=pk)
        version_id = request.data.get('version')
        version = (
            dataset.versions.filter(pk=version_id).first()
            if version_id
            else dataset.versions.order_by('-version_number').first()
        )
        if version is None:
            return Response({'detail': 'This dataset has no versions.'},
                            status=status.HTTP_404_NOT_FOUND)

        text_column = (request.data.get('text_column') or '').strip()
        label_column = (request.data.get('label_column') or '').strip()
        label_mapping = request.data.get('label_mapping') or {}
        if isinstance(label_mapping, dict):
            label_mapping = {str(k).strip(): str(v).strip() for k, v in label_mapping.items()}
        drop_missing = str(request.data.get('drop_missing', 'true')).lower() != 'false'
        drop_duplicates = str(request.data.get('drop_duplicates', 'true')).lower() != 'false'

        try:
            stats = validate_and_clean(
                version, text_column, label_column, label_mapping,
                drop_missing=drop_missing, drop_duplicates=drop_duplicates,
            )
        except DatasetServiceError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        log_audit(request, 'dataset_validated', 'dataset_version', version.id,
                  {'name': dataset.name, 'rows_after': stats['rows_after'],
                   'class_distribution': stats['class_distribution']})
        return Response({'dataset': DatasetSerializer(dataset).data, 'stats': stats})
