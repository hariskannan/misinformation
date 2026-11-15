"""Prediction service - runs the active ML model over raw post text."""
import joblib
import numpy as np
from django.conf import settings

from .models import MLModelVersion, Prediction
from .preprocessing import TextValidationError, preprocess_text, validate_text


class NoActiveModelError(Exception):
    """No model is currently activated by an administrator."""


class PredictionInputError(Exception):
    """The submitted text cannot be analyzed (invalid or empty after cleaning)."""


class PredictionServiceError(Exception):
    """The prediction pipeline failed unexpectedly."""


LIMITATIONS_TEXT = (
    'This result is an automated risk signal produced by a statistical model, '
    'not proof that the content is true or false. Models can make mistakes, '
    'and predictions should be treated as one moderation input among others, '
    'never as a final verdict.'
)


def get_active_model():
    return (
        MLModelVersion.objects.filter(status=MLModelVersion.Status.ACTIVE)
        .select_related('dataset_version', 'trained_by')
        .first()
    )


def predict_probabilities(pipeline, texts):
    """Probability matrix for a list of texts.

    Uses predict_proba when available. For SVM-style estimators without
    probability support, converts decision function scores into a
    normalized confidence distribution.
    """
    if hasattr(pipeline, 'predict_proba'):
        return pipeline.predict_proba(texts)
    decision = pipeline.decision_function(texts)
    if np.ndim(decision) == 1:
        # Binary case: logistic transform of the decision margin.
        positive = 1.0 / (1.0 + np.exp(-decision))
        return np.vstack([1.0 - positive, positive]).T
    # Multiclass case: softmax over decision scores.
    shifted = decision - decision.max(axis=1, keepdims=True)
    exp_scores = np.exp(shifted)
    return exp_scores / exp_scores.sum(axis=1, keepdims=True)


def _risk_from_prediction(predicted_label, confidence):
    """Map a model prediction to the TruthGuard risk levels.

    - Predicted reliable  -> LOW risk.
    - Predicted misinformation with confidence >= threshold -> HIGH risk.
    - Predicted misinformation below the threshold -> MEDIUM risk.
    """
    if predicted_label == settings.TG_LABEL_FAKE:
        if confidence >= settings.TG_HIGH_RISK_THRESHOLD:
            return 'high'
        return 'medium'
    return 'low'


def predict_text(text, user=None, post=None, persist=True):
    """Analyze raw text with the active model and persist a Prediction."""
    active_model = get_active_model()
    if active_model is None:
        raise NoActiveModelError(
            'No machine learning model is currently active. An administrator '
            'must train and activate a model before posts can be analyzed.'
        )

    try:
        validate_text(text)
        if not preprocess_text(text).strip():
            raise TextValidationError(
                'After preprocessing (removing URLs, special characters and '
                'stop-words) no analysable text remained.'
            )
    except TextValidationError as exc:
        raise PredictionInputError(str(exc))

    try:
        pipeline = joblib.load(active_model.file_path)
        probabilities = predict_probabilities(pipeline, [text])[0]
    except Exception as exc:  # noqa: BLE001 - surfaced to API clients
        raise PredictionServiceError(
            f'The prediction service failed while running the model: {exc}'
        )

    classes = [str(c) for c in pipeline.classes_]
    best_index = int(np.argmax(probabilities))
    predicted_label = classes[best_index]
    confidence = float(probabilities[best_index])
    probability_map = {
        label: round(float(score), 4) for label, score in zip(classes, probabilities)
    }
    risk_level = _risk_from_prediction(predicted_label, confidence)

    if not persist:
        return {
            'model_version': active_model,
            'predicted_label': predicted_label,
            'risk_level': risk_level,
            'confidence': confidence,
            'probabilities': probability_map,
        }

    return Prediction.objects.create(
        post=post,
        input_text=str(text)[:5000],
        model_version=active_model,
        predicted_label=predicted_label,
        risk_level=risk_level,
        confidence=confidence,
        probabilities=probability_map,
        created_by=user,
    )


# Convenient alias used by the posts app.
predict_for_post = predict_text


def label_display(label):
    if label == settings.TG_LABEL_FAKE:
        return 'Potential misinformation'
    if label == settings.TG_LABEL_REAL:
        return 'Likely reliable'
    return label
