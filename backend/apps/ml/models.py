from django.conf import settings
from django.db import models


class MLModelVersion(models.Model):
    """A trained ML model version produced by a training job."""

    class Algorithm(models.TextChoices):
        DECISION_TREE = 'decision_tree', 'Decision Tree'
        RANDOM_FOREST = 'random_forest', 'Random Forest'
        NAIVE_BAYES = 'naive_bayes', 'Multinomial Naive Bayes'
        SVM = 'svm', 'Support Vector Machine (Linear SVC)'

    class Status(models.TextChoices):
        TRAINED = 'trained', 'Trained'
        ACTIVE = 'active', 'Active'
        DEPRECATED = 'deprecated', 'Deprecated'

    name = models.CharField(max_length=150)
    algorithm = models.CharField(max_length=30, choices=Algorithm.choices)
    version_tag = models.CharField(max_length=30)
    dataset_version = models.ForeignKey(
        'datasets.DatasetVersion', on_delete=models.PROTECT, related_name='models'
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.TRAINED)

    metrics = models.JSONField(default=dict, blank=True)
    file_path = models.CharField(max_length=500)

    train_rows = models.IntegerField(default=0)
    test_rows = models.IntegerField(default=0)
    feature_count = models.IntegerField(default=0)
    training_duration_seconds = models.FloatField(default=0.0)

    trained_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='trained_models',
    )
    trained_at = models.DateTimeField(auto_now_add=True)
    activated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='activated_models',
    )
    activated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-trained_at']
        verbose_name = 'ML model version'
        verbose_name_plural = 'ML model versions'

    def __str__(self):
        return f'{self.name} ({self.get_algorithm_display()}) [{self.status}]'

    @property
    def accuracy(self):
        return (self.metrics or {}).get('accuracy')

    @property
    def f1_score(self):
        return (self.metrics or {}).get('f1')


class TrainingJob(models.Model):
    """Tracks the lifecycle of one model training run."""

    class Status(models.TextChoices):
        QUEUED = 'queued', 'Queued'
        RUNNING = 'running', 'Running'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'

    algorithm = models.CharField(max_length=30, choices=MLModelVersion.Algorithm.choices)
    dataset_version = models.ForeignKey(
        'datasets.DatasetVersion', on_delete=models.CASCADE, related_name='training_jobs'
    )
    params = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    log = models.TextField(blank=True)
    error_message = models.TextField(blank=True)
    model_version = models.ForeignKey(
        MLModelVersion, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='jobs',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='training_jobs',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Training job #{self.pk} ({self.algorithm}) - {self.status}'

    def append_log(self, message):
        from django.utils import timezone
        self.log = (self.log or '') + f'[{timezone.now():%H:%M:%S}] {message}\n'
        self.save(update_fields=['log'])


class Prediction(models.Model):
    """One risk prediction produced by the active ML model."""

    post = models.OneToOneField(
        'posts.Post', null=True, blank=True, on_delete=models.SET_NULL, related_name='prediction'
    )
    input_text = models.TextField(blank=True)
    model_version = models.ForeignKey(
        MLModelVersion, on_delete=models.PROTECT, related_name='predictions'
    )
    predicted_label = models.CharField(max_length=20)
    risk_level = models.CharField(max_length=10)
    confidence = models.FloatField()
    probabilities = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='predictions',
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Prediction #{self.pk}: {self.predicted_label} ({self.risk_level})'
