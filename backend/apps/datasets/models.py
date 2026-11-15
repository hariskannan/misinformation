from django.conf import settings
from django.db import models

from apps.ml.models import MLModelVersion


class Dataset(models.Model):
    """An uploaded dataset (a collection of versions)."""

    name = models.CharField(max_length=150, unique=True)
    description = models.TextField(blank=True)
    source_url = models.URLField(blank=True)
    license_notes = models.TextField(
        blank=True,
        help_text='License / usage notes for this dataset.',
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='uploaded_datasets',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class DatasetVersion(models.Model):
    """One uploaded (and possibly cleaned) version of a dataset file."""

    class Status(models.TextChoices):
        RAW = 'raw', 'Raw upload'
        VALIDATED = 'validated', 'Validated'

    dataset = models.ForeignKey(Dataset, on_delete=models.CASCADE, related_name='versions')
    version_number = models.PositiveIntegerField(default=1)
    file = models.FileField(upload_to='datasets/%Y/%m/')
    original_filename = models.CharField(max_length=255)
    file_format = models.CharField(max_length=10)  # csv / tsv / xlsx
    row_count = models.IntegerField(default=0)
    column_count = models.IntegerField(default=0)
    text_column = models.CharField(max_length=150, blank=True)
    label_column = models.CharField(max_length=150, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.RAW)
    cleaned_file = models.FileField(upload_to='datasets/cleaned/%Y/%m/', blank=True, null=True)
    label_mapping = models.JSONField(
        default=dict, blank=True,
        help_text='Map of original label values to canonical classes (fake / real).',
    )
    stats = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='uploaded_dataset_versions',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['dataset', '-version_number'])]

    def __str__(self):
        return f'{self.dataset.name} v{self.version_number} ({self.status})'


class DatasetColumnMapping(models.Model):
    """Maps an original label value of a dataset to a canonical class."""

    class MappedLabel(models.TextChoices):
        FAKE = 'fake', 'Misinformation / fake'
        REAL = 'real', 'Reliable / real'

    dataset = models.ForeignKey(
        Dataset, on_delete=models.CASCADE, related_name='column_mappings'
    )
    original_label = models.CharField(max_length=150)
    mapped_label = models.CharField(max_length=10, choices=MappedLabel.choices)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['dataset', 'original_label'], name='unique_label_mapping'
            )
        ]

    def __str__(self):
        return f'{self.dataset.name}: "{self.original_label}" -> {self.mapped_label}'
