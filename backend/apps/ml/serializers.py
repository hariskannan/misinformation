from rest_framework import serializers

from .models import MLModelVersion, Prediction, TrainingJob
from .prediction import LIMITATIONS_TEXT, label_display
from .training import ALGORITHM_INFO


class DatasetVersionBriefSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    version_number = serializers.IntegerField()
    status = serializers.CharField()
    row_count = serializers.IntegerField()
    text_column = serializers.CharField()
    label_column = serializers.CharField()


class MLModelVersionSerializer(serializers.ModelSerializer):
    algorithm_display = serializers.CharField(source='get_algorithm_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    trained_by_username = serializers.CharField(
        source='trained_by.username', read_only=True, default=None
    )
    activated_by_username = serializers.CharField(
        source='activated_by.username', read_only=True, default=None
    )
    dataset = DatasetVersionBriefSerializer(source='dataset_version', read_only=True)

    class Meta:
        model = MLModelVersion
        fields = [
            'id', 'name', 'algorithm', 'algorithm_display', 'version_tag', 'status',
            'status_display', 'metrics', 'train_rows', 'test_rows', 'feature_count',
            'training_duration_seconds', 'trained_at', 'trained_by_username',
            'activated_at', 'activated_by_username', 'dataset',
        ]


class TrainingJobSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    algorithm_display = serializers.CharField(source='get_algorithm_display', read_only=True)
    created_by_username = serializers.CharField(
        source='created_by.username', read_only=True, default=None
    )
    dataset = DatasetVersionBriefSerializer(source='dataset_version', read_only=True)
    model_version = MLModelVersionSerializer(read_only=True)

    class Meta:
        model = TrainingJob
        fields = [
            'id', 'algorithm', 'algorithm_display', 'status', 'status_display',
            'params', 'log', 'error_message', 'created_by_username', 'dataset',
            'model_version', 'created_at', 'started_at', 'finished_at',
        ]


class PredictionModelInfoSerializer(serializers.ModelSerializer):
    algorithm_display = serializers.CharField(source='get_algorithm_display', read_only=True)

    class Meta:
        model = MLModelVersion
        fields = [
            'id', 'name', 'algorithm', 'algorithm_display', 'version_tag',
            'trained_at', 'accuracy', 'f1_score',
        ]


class PredictionSerializer(serializers.ModelSerializer):
    predicted_label_display = serializers.SerializerMethodField()
    risk_level = serializers.CharField()
    model = PredictionModelInfoSerializer(source='model_version', read_only=True)
    limitations = serializers.SerializerMethodField()
    post_id = serializers.IntegerField(source='post.id', read_only=True, default=None)

    class Meta:
        model = Prediction
        fields = [
            'id', 'post_id', 'input_text', 'predicted_label', 'predicted_label_display',
            'risk_level', 'confidence', 'probabilities', 'model', 'created_at',
            'limitations',
        ]

    def get_predicted_label_display(self, obj):
        return label_display(obj.predicted_label)

    def get_limitations(self, obj):
        return LIMITATIONS_TEXT


class AlgorithmInfoSerializer(serializers.Serializer):
    """Metadata describing the supported training algorithms."""

    key = serializers.CharField()
    label = serializers.CharField()
    description = serializers.CharField()
    params = serializers.DictField()


def algorithm_info_payload():
    return [
        {'key': key, 'label': info['label'], 'description': info['description'],
         'params': info['params']}
        for key, info in ALGORITHM_INFO.items()
    ]
