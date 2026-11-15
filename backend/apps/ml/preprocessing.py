"""Text preprocessing pipeline used for training and prediction.

The pipeline:
  1. Validate non-empty input
  2. Lowercase conversion
  3. URL removal (replaced with the token 'url')
  4. HTML tag stripping
  5. Special character handling (keep letters, digits and whitespace)
  6. Tokenization on whitespace
  7. Stop-word removal (NLTK when the corpus is available, built-in fallback list otherwise)
  8. Re-join into normalized text

NLTK is used when its 'stopwords' corpus is installed. When the corpus is
not available (e.g. fully offline machines) an embedded fallback list of
common English stop-words is used so behaviour stays deterministic.
"""
import re

try:
    import nltk
    from nltk.corpus import stopwords as _nltk_stopwords
except Exception:  # pragma: no cover - nltk is optional at runtime
    nltk = None
    _nltk_stopwords = None

_FALLBACK_STOPWORDS = {
    'a', 'about', 'above', 'after', 'again', 'all', 'am', 'an', 'and', 'any',
    'are', "aren't", 'as', 'at', 'be', 'because', 'been', 'before', 'being',
    'below', 'between', 'both', 'but', 'by', "can't", 'cannot', 'could',
    "couldn't", 'did', "didn't", 'do', 'does', "doesn't", 'doing', "don't",
    'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had',
    "hadn't", 'has', "hasn't", 'have', "haven't", 'having', 'he', "he'd",
    "he'll", "he's", 'her', 'here', "here's", 'hers', 'herself', 'him',
    'himself', 'his', 'how', "how's", 'i', "i'd", "i'll", "i'm", "i've",
    'if', 'in', 'into', 'is', "isn't", 'it', "it's", 'its', 'itself',
    "let's", 'me', 'more', 'most', "mustn't", 'my', 'myself', 'no', 'nor',
    'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought',
    'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', "shan't",
    'she', "she'd", "she'll", "she's", 'should', "shouldn't", 'so', 'some',
    'such', 'than', 'that', "that's", 'the', 'their', 'theirs', 'them',
    'themselves', 'then', 'there', "there's", 'these', 'they', "they'd",
    "they'll", "they're", "they've", 'this', 'those', 'through', 'to', 'too',
    'under', 'until', 'up', 'very', 'was', "wasn't", 'we', "we'd", "we'll",
    "we're", "we've", 'were', "weren't", 'what', "what's", 'when',
    "when's", 'where', "where's", 'which', 'while', 'who', "who's", 'whom',
    'why', "why's", 'with', "won't", 'would', "wouldn't", 'you', "you'd",
    "you'll", "you're", "you've", 'your', 'yours', 'yourself', 'yourselves',
}


def _get_stopwords():
    """Return the English stop-word set, preferring NLTK's corpus."""
    if _nltk_stopwords is not None:
        try:
            return set(_nltk_stopwords.words('english'))
        except Exception:
            pass
    return _FALLBACK_STOPWORDS


try:
    STOPWORDS = _get_stopwords()
except Exception:
    STOPWORDS = _FALLBACK_STOPWORDS


_URL_RE = re.compile(r'https?://\S+|www\.\S+')
_HTML_TAG_RE = re.compile(r'<[^>]+>')
_HTML_ENTITY_RE = re.compile(r'&[a-z]+;')
_SPECIAL_CHARS_RE = re.compile(r'[^a-z0-9\s]')
_WHITESPACE_RE = re.compile(r'\s+')

# Tokens that carry no meaning after cleaning.
_DROP_TOKENS = {'', 'url', 'rt', 'via'}


class TextValidationError(ValueError):
    """Raised when input text cannot be preprocessed (e.g. empty)."""


def validate_text(text):
    """Ensure raw text is a usable string."""
    if text is None:
        raise TextValidationError('No text was provided.')
    if not isinstance(text, str):
        text = str(text)
    text = text.strip()
    if not text:
        raise TextValidationError('The text is empty.')
    if len(text) > 50000:
        raise TextValidationError('The text exceeds the maximum length of 50000 characters.')
    return text


def preprocess_text(raw_text):
    """Apply the full preprocessing pipeline and return normalized text."""
    text = validate_text(raw_text)

    # 1. Lowercase
    text = text.lower()

    # 2. URL removal / normalization
    text = _URL_RE.sub(' url ', text)

    # 3. HTML handling
    text = _HTML_TAG_RE.sub(' ', text)
    text = _HTML_ENTITY_RE.sub(' ', text)

    # 4. Special characters (keep letters, digits, whitespace)
    text = _SPECIAL_CHARS_RE.sub(' ', text)

    # 5. Tokenize on whitespace
    tokens = _WHITESPACE_RE.split(text)

    # 6. Stop-word removal and short/noise token filtering
    tokens = [
        token for token in tokens
        if token not in _DROP_TOKENS
        and token not in STOPWORDS
        and len(token) > 1
    ]

    # 7. Normalize whitespace and join
    return ' '.join(tokens)


def preprocess_corpus(texts):
    """Validate + preprocess a list of documents for training."""
    cleaned = []
    dropped = 0
    for text in texts:
        try:
            result = preprocess_text(text)
        except TextValidationError:
            result = ''
        if result:
            cleaned.append(result)
        else:
            dropped += 1
            cleaned.append('')  # keep alignment with labels
    return cleaned, dropped
