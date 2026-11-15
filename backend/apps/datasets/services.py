"""Dataset ingestion, preview and validation services."""
from pathlib import Path

import numpy as np
import pandas as pd

MAX_DATASET_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB
ALLOWED_EXTENSIONS = ('csv', 'tsv', 'xlsx')


class DatasetServiceError(Exception):
    """Raised for any dataset ingestion problem."""


def validate_upload_file(file):
    """Validate an uploaded dataset file (extension + size)."""
    if file is None:
        raise DatasetServiceError('No file was uploaded.')
    name = file.name or ''
    extension = name.rsplit('.', 1)[-1].lower() if '.' in name else ''
    if extension not in ALLOWED_EXTENSIONS:
        raise DatasetServiceError(
            f'Unsupported file type ".{extension}". '
            f'Allowed formats: {", ".join(ALLOWED_EXTENSIONS)}.'
        )
    if file.size > MAX_DATASET_SIZE_BYTES:
        raise DatasetServiceError(
            f'The file is too large ({file.size / 1024 / 1024:.1f} MB). '
            f'Maximum size is 20 MB.'
        )
    return extension


def read_dataframe(path, file_format):
    """Load a dataset file into a pandas DataFrame."""
    try:
        if file_format == 'csv':
            return pd.read_csv(path)
        if file_format == 'tsv':
            return pd.read_csv(path, sep='\t')
        if file_format == 'xlsx':
            return pd.read_excel(path)
    except DatasetServiceError:
        raise
    except Exception as exc:
        raise DatasetServiceError(f'Could not parse the dataset file: {exc}')
    raise DatasetServiceError(f'Unsupported dataset format "{file_format}".')


def _json_safe(value):
    """Convert a pandas/numpy scalar into a JSON-serialisable value."""
    if value is None:
        return None
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return None if np.isnan(value) else round(float(value), 4)
    if isinstance(value, float) and np.isnan(value):
        return None
    text = str(value)
    return text[:200] if len(text) > 200 else text


def preview_dataset(version, sample_rows=8):
    """Build a preview payload for a dataset version."""
    source = version.cleaned_file or version.file
    if not source or not Path(source.path).exists():
        raise DatasetServiceError('The dataset file is missing on the server.')

    df = read_dataframe(source.path, version.file_format)

    columns = []
    for column, series in df.items():
        columns.append({
            'name': str(column),
            'dtype': str(series.dtype),
            'non_null': int(series.notna().sum()),
            'missing': int(series.isna().sum()),
            'unique_values': int(series.nunique(dropna=True)),
        })

    sample = df.head(sample_rows)
    sample_records = [
        {str(key): _json_safe(value) for key, value in row.items()}
        for _, row in sample.iterrows()
    ]

    label_values = None
    if version.label_column and version.label_column in df.columns:
        counts = df[version.label_column].astype(str).str.strip().value_counts()
        label_values = [
            {'value': str(value), 'count': int(count)}
            for value, count in counts.head(50).items()
        ]

    avg_text_length = None
    if version.text_column and version.text_column in df.columns:
        lengths = df[version.text_column].astype(str).str.len()
        avg_text_length = round(float(lengths.mean()), 1)

    duplicate_rows = int(df.duplicated().sum())

    return {
        'version_id': version.id,
        'version_number': version.version_number,
        'status': version.status,
        'file_format': version.file_format,
        'original_filename': version.original_filename,
        'row_count': int(len(df)),
        'column_count': int(df.shape[1]),
        'columns': columns,
        'sample_rows': sample_records,
        'duplicate_rows': duplicate_rows,
        'text_column': version.text_column,
        'label_column': version.label_column,
        'label_values': label_values,
        'avg_text_length': avg_text_length,
        'label_mapping': version.label_mapping,
        'stats': version.stats,
    }


def validate_and_clean(version, text_column, label_column, label_mapping,
                       drop_missing=True, drop_duplicates=True):
    """Validate column/mapping configuration and produce a cleaned version.

    Returns the updated stats dict. Writes a cleaned CSV and marks the
    version as validated.
    """
    from .models import DatasetVersion  # noqa: F811 - local import avoids cycles

    source = version.cleaned_file or version.file
    if not source or not Path(source.path).exists():
        raise DatasetServiceError('The dataset file is missing on the server.')

    df = read_dataframe(source.path, version.file_format)

    if text_column not in df.columns:
        raise DatasetServiceError(f'Text column "{text_column}" not found.')
    if label_column not in df.columns:
        raise DatasetServiceError(f'Label column "{label_column}" not found.')

    if not label_mapping:
        raise DatasetServiceError(
            'A label mapping is required so every original label is assigned '
            'to either "fake" (misinformation) or "real" (reliable).'
        )
    invalid_targets = [
        value for value in label_mapping.values()
        if value not in ('fake', 'real')
    ]
    if invalid_targets:
        raise DatasetServiceError(
            f'Invalid mapping targets: {invalid_targets}. Only "fake" and '
            '"real" are valid target classes.'
        )

    rows_before = len(df)

    # Missing values in the two relevant columns.
    missing_text = int(df[text_column].isna().sum())
    missing_label = int(df[label_column].isna().sum())

    if drop_missing:
        df = df[df[text_column].notna() & df[label_column].notna()]
    missing_dropped = rows_before - len(df)

    # Empty texts.
    text_series = df[text_column].astype(str).str.strip()
    empty_text_mask = text_series == ''
    empty_text = int(empty_text_mask.sum())
    df = df[~empty_text_mask]

    # Label mapping: drop rows whose label is not mapped.
    raw_labels = df[label_column].astype(str).str.strip()
    mapped = raw_labels.map(lambda value: label_mapping.get(value) or
                            label_mapping.get(value.lower()))
    unmapped_labels = int(mapped.isna().sum())
    unmapped_values = sorted(set(raw_labels[mapped.isna()].tolist()))[:20]
    df = df[mapped.notna()]
    df = df.assign(**{label_column: mapped[mapped.notna()]})

    # Duplicate records.
    duplicates_removed = 0
    if drop_duplicates:
        before = len(df)
        df = df.drop_duplicates(subset=[text_column, label_column])
        duplicates_removed = before - len(df)

    class_distribution = df[label_column].value_counts().to_dict()
    class_distribution = {str(k): int(v) for k, v in class_distribution.items()}

    if len(class_distribution) < 2:
        raise DatasetServiceError(
            'After applying the label mapping the dataset contains a single '
            'class. At least two classes are required for training.'
        )

    lengths = df[text_column].astype(str).str.len()
    stats = {
        'rows_before': rows_before,
        'rows_after': int(len(df)),
        'missing_text': missing_text,
        'missing_label': missing_label,
        'missing_dropped': missing_dropped,
        'empty_text_dropped': empty_text,
        'unmapped_labels_dropped': unmapped_labels,
        'unmapped_label_values': unmapped_values,
        'duplicates_removed': duplicates_removed,
        'class_distribution': class_distribution,
        'avg_text_length': round(float(lengths.mean()), 1) if len(df) else 0,
        'min_text_length': int(lengths.min()) if len(df) else 0,
        'text_column': text_column,
        'label_column': label_column,
    }

    if len(df) < 40:
        raise DatasetServiceError(
            f'Only {len(df)} usable records remain after cleaning. At least '
            '40 records are required to train and evaluate a model.'
        )

    # Persist the cleaned dataset as a new CSV.
    cleaned_df = df[[text_column, label_column]].copy()
    cleaned_df = cleaned_df.rename(columns={text_column: 'text', label_column: 'label'})
    from django.core.files.base import ContentFile
    import io
    buffer = io.StringIO()
    cleaned_df.to_csv(buffer, index=False)
    content = buffer.getvalue().encode('utf-8')
    filename = f'cleaned_{version.dataset.name.lower().replace(" ", "_")}_v{version.version_number}.csv'
    version.cleaned_file.save(filename, ContentFile(content), save=False)

    version.text_column = text_column
    version.label_column = label_column
    version.label_mapping = dict(label_mapping)
    version.stats = stats
    version.row_count = int(len(df))
    version.status = DatasetVersion.Status.VALIDATED
    version.save()

    # Store the mapping rows for documentation purposes.
    from .models import DatasetColumnMapping
    version.dataset.column_mappings.all().delete()
    for original, mapped_label in label_mapping.items():
        DatasetColumnMapping.objects.create(
            dataset=version.dataset,
            original_label=original,
            mapped_label=mapped_label,
        )
    return stats
