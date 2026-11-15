from rest_framework import serializers

from .models import Dataset, DatasetColumnMapping, DatasetVersion


class DatasetColumnMappingSerializer(serializers.ModelSerializer):
    class Meta:
        model = DatasetColumnMapping
        fields = ['id', 'original_label', 'mapped_label']


class DatasetVersionSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(
        source='created_by.username', read_only=True, default=None
    )
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = DatasetVersion
        fields = [
            'id', 'version_number', 'original_filename', 'file_format',
            'status', 'status_display', 'row_count', 'column_count',
            'text_column', 'label_column', 'label_mapping', 'stats', 'notes',
            'created_by_username', 'created_at', 'updated_at',
        ]


class DatasetSerializer(serializers.ModelSerializer):
    uploaded_by_username = serializers.CharField(
        source='uploaded_by.username', read_only=True, default=None
    )
    versions = DatasetVersionSerializer(many=True, read_only=True)
    column_mappings = DatasetColumnMappingSerializer(many=True, read_only=True)
    latest_version = serializers.SerializerMethodField()

    class Meta:
        model = Dataset
        fields = [
            'id', 'name', 'description', 'source_url', 'license_notes',
            'uploaded_by_username', 'created_at', 'updated_at',
            'versions', 'column_mappings', 'latest_version',
        ]

    def get_latest_version(self, obj):
        version = obj.versions.order_by('-version_number').first()
        return DatasetVersionSerializer(version).data if version else None
