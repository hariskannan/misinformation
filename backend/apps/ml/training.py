"""Model training pipeline for TruthGuard.

Algorithms: Decision Tree, Random Forest, Multinomial Naive Bayes and
Support Vector Machine (Linear SVC, probability-calibrated).

Feature extraction: TF-IDF with unigrams and bigrams over the
preprocessed text (see apps.ml.preprocessing).
"""
import time
from collections import Counter
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from django.conf import settings
from django.db import connection
from django.utils import timezone
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    precision_recall_fscore_support,
)
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC
from sklearn.tree import DecisionTreeClassifier

from .models import MLModelVersion, TrainingJob
from .preprocessing import preprocess_text

RANDOM_STATE = 42


class TrainingError(Exception):
    """Raised when a training job cannot be completed."""


ALGORITHM_INFO = {
    'decision_tree': {
        'label': 'Decision Tree',
        'description': (
            'A tree of if/then rules learned from TF-IDF features. Fast and '
            'interpretable, prone to overfitting on small datasets.'
        ),
        'params': {'max_depth': {'default': 50, 'min': 2, 'max': 200}},
    },
    'random_forest': {
        'label': 'Random Forest',
        'description': (
            'An ensemble of decision trees trained on random feature subsets. '
            'Usually more accurate and stable than a single tree.'
        ),
        'params': {
            'n_estimators': {'default': 200, 'min': 10, 'max': 500},
            'max_depth': {'default': 100, 'min': 2, 'max': 300},
        },
    },
    'naive_bayes': {
        'label': 'Multinomial Naive Bayes',
        'description': (
            'A probabilistic classifier based on word frequency independence. '
            'Very fast for text classification with TF-IDF features.'
        ),
        'params': {'alpha': {'default': 1.0, 'min': 0.01, 'max': 10.0}},
    },
    'svm': {
        'label': 'Support Vector Machine',
        'description': (
            'Linear SVC with sigmoid probability calibration. Often strong '
            'for high-dimensional sparse text features.'
        ),
        'params': {'C': {'default': 1.0, 'min': 0.01, 'max': 10.0}},
    },
}


def build_classifier(algorithm, params):
    """Build the estimator for one of the supported algorithms."""
    if algorithm == 'decision_tree':
        return DecisionTreeClassifier(
            max_depth=int(params.get('max_depth', 50)),
            random_state=RANDOM_STATE,
        )
    if algorithm == 'random_forest':
        return RandomForestClassifier(
            n_estimators=int(params.get('n_estimators', 200)),
            max_depth=int(params.get('max_depth', 100)),
            random_state=RANDOM_STATE,
            n_jobs=-1,
        )
    if algorithm == 'naive_bayes':
        return MultinomialNB(alpha=float(params.get('alpha', 1.0)))
    if algorithm == 'svm':
        return CalibratedClassifierCV(
            LinearSVC(C=float(params.get('C', 1.0)), random_state=RANDOM_STATE),
            cv=3,
            method='sigmoid',
        )
    raise TrainingError(f'Unknown algorithm "{algorithm}".')


def build_pipeline(algorithm, params):
    """TF-IDF (unigrams + bigrams) followed by the classifier."""
    params = params or {}
    max_features = int(params.get('max_features', 10000))
    if not 100 <= max_features <= 200000:
        raise TrainingError('max_features must be between 100 and 200000.')
    vectorizer = TfidfVectorizer(
        max_features=max_features,
        ngram_range=(1, 2),          # unigrams and bigrams
        preprocessor=preprocess_text,  # full preprocessing pipeline
        sublinear_tf=True,
    )
    return Pipeline([('tfidf', vectorizer), ('clf', build_classifier(algorithm, params))])


def load_training_data(dataset_version):
    """Load a dataset version and map labels to canonical classes.

    Returns (texts, labels) containing only rows whose label was mapped
    to a canonical training class ('fake' / 'real').
    """
    if dataset_version.status != 'validated':
        raise TrainingError(
            'The dataset version must be validated before it can be used for training.'
        )

    source = dataset_version.cleaned_file or dataset_version.file
    if not source or not Path(source.path).exists():
        raise TrainingError('The dataset file is missing on the server.')

    fmt = dataset_version.file_format
    try:
        if fmt == 'csv':
            df = pd.read_csv(source.path)
        elif fmt == 'tsv':
            df = pd.read_csv(source.path, sep='\t')
        elif fmt == 'xlsx':
            df = pd.read_excel(source.path)
        else:
            raise TrainingError(f'Unsupported dataset format "{fmt}".')
    except TrainingError:
        raise
    except Exception as exc:
        raise TrainingError(f'Could not read the dataset file: {exc}')

    text_column = dataset_version.text_column
    label_column = dataset_version.label_column
    if text_column not in df.columns:
        raise TrainingError(
            f'Text column "{text_column}" was not found in the dataset file.'
        )
    if label_column not in df.columns:
        raise TrainingError(
            f'Label column "{label_column}" was not found in the dataset file.'
        )

    mapping = dataset_version.label_mapping or {}
    texts, labels = [], []
    for raw_text, raw_label in zip(
        df[text_column].astype(str), df[label_column].astype(str).str.strip()
    ):
        mapped = mapping.get(raw_label) or mapping.get(raw_label.lower())
        if not mapped:
            continue
        texts.append(raw_text)
        labels.append(mapped)

    if not texts:
        raise TrainingError(
            'No usable records after label mapping. Check the dataset '
            'column mapping configuration.'
        )
    return texts, labels


def run_training_job(job_id):
    """Execute a TrainingJob. Runs inside a background worker thread."""
    job = TrainingJob.objects.select_related('dataset_version').filter(pk=job_id).first()
    if job is None:
        return
    job.status = TrainingJob.Status.RUNNING
    job.started_at = timezone.now()
    job.save(update_fields=['status', 'started_at'])
    try:
        _execute_training(job)
    except Exception as exc:
        job.status = TrainingJob.Status.FAILED
        job.error_message = str(exc)[:2000]
        job.finished_at = timezone.now()
        job.save(update_fields=['status', 'error_message', 'finished_at'])
    finally:
        connection.close()


def _execute_training(job):
    params = dict(job.params or {})
    algorithm = job.algorithm

    job.append_log('Loading and mapping dataset...')
    texts, labels = load_training_data(job.dataset_version)

    class_counts = Counter(labels)
    if len(class_counts) < 2:
        raise TrainingError(
            'The dataset must contain at least two classes for training, '
            f'found only: {sorted(class_counts)}.'
        )
    if min(class_counts.values()) < 10:
        raise TrainingError('Each class needs at least 10 samples to train and evaluate.')
    job.append_log(
        f'Loaded {len(texts)} usable records with class distribution {dict(class_counts)}.'
    )

    test_size = float(params.get('test_size', 0.2))
    if not 0.1 <= test_size <= 0.5:
        raise TrainingError('test_size must be between 0.1 and 0.5.')

    # Stratified split to avoid leakage and keep class balance.
    x_train, x_test, y_train, y_test = train_test_split(
        texts,
        labels,
        test_size=test_size,
        random_state=RANDOM_STATE,
        stratify=labels,
    )
    job.append_log(f'Split into {len(x_train)} training and {len(x_test)} test records.')

    pipeline = build_pipeline(algorithm, params)
    job.append_log(f'Training {ALGORITHM_INFO[algorithm]["label"]} model...')
    started = time.perf_counter()
    pipeline.fit(x_train, y_train)
    duration = time.perf_counter() - started
    job.append_log(f'Training finished in {duration:.1f} seconds.')

    # Evaluation on the held-out test split.
    y_pred = pipeline.predict(x_test)
    accuracy = accuracy_score(y_test, y_pred)
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_test, y_pred, average='weighted', zero_division=0
    )
    report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
    class_order = sorted(set(y_test) | set(y_pred))
    matrix = confusion_matrix(y_test, y_pred, labels=class_order)

    metrics = {
        'accuracy': round(float(accuracy), 4),
        'precision': round(float(precision), 4),
        'recall': round(float(recall), 4),
        'f1': round(float(f1), 4),
        'confusion_matrix': {'labels': class_order, 'matrix': matrix.tolist()},
        'classification_report': report,
        'class_distribution': dict(class_counts),
        'test_size': test_size,
    }
    job.append_log(
        f'Evaluation on {len(x_test)} held-out records: accuracy={metrics["accuracy"]:.4f}, '
        f'f1={metrics["f1"]:.4f}.'
    )

    # Persist the trained model artifact.
    store_dir = Path(settings.ML_STORE_DIR)
    store_dir.mkdir(parents=True, exist_ok=True)
    version_number = MLModelVersion.objects.filter(algorithm=algorithm).count() + 1
    version_tag = f'v{version_number}'
    file_path = store_dir / f'model_{algorithm}_{timezone.now():%Y%m%d%H%M%S}.joblib'
    joblib.dump(pipeline, str(file_path))
    job.append_log(f'Model artifact saved to {file_path.name}.')

    model_version = MLModelVersion.objects.create(
        name=f'{ALGORITHM_INFO[algorithm]["label"]} {version_tag}',
        algorithm=algorithm,
        version_tag=version_tag,
        dataset_version=job.dataset_version,
        metrics=metrics,
        file_path=str(file_path),
        train_rows=len(x_train),
        test_rows=len(x_test),
        feature_count=len(pipeline.named_steps['tfidf'].vocabulary_),
        training_duration_seconds=round(duration, 2),
        trained_by=job.created_by,
        status=MLModelVersion.Status.TRAINED,
    )
    job.status = TrainingJob.Status.COMPLETED
    job.model_version = model_version
    job.finished_at = timezone.now()
    job.append_log(
        f'Done. Model "{model_version.name}" was created and is available for activation.'
    )
    job.save(update_fields=['status', 'model_version', 'finished_at'])
