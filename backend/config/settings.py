"""
Django settings for the TruthGuard project.

TruthGuard - Early Misinformation Risk Prediction Using Data Mining.
"""
from datetime import timedelta
from pathlib import Path
import os

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

SECRET_KEY = os.getenv(
    'DJANGO_SECRET_KEY', 'django-insecure-dev-only-key-change-in-production'
)
DEBUG = os.getenv('DJANGO_DEBUG', '1').lower() in ('1', 'true', 'yes')
ALLOWED_HOSTS = [
    h.strip() for h in os.getenv('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',') if h.strip()
]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party
    'rest_framework',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'drf_spectacular',
    # Local apps
    'apps.core',
    'apps.accounts',
    'apps.posts',
    'apps.datasets',
    'apps.ml',
    'apps.moderation',
    'apps.analytics',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# -----------------------------------------------------------------------
# Database
# PostgreSQL is the primary database. USE_SQLITE=1 is a development-only
# fallback so the project can be evaluated without a PostgreSQL server.
# -----------------------------------------------------------------------
USE_SQLITE = os.getenv('USE_SQLITE', '0').lower() in ('1', 'true', 'yes')

if USE_SQLITE:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('DB_NAME', 'truthguard'),
            'USER': os.getenv('DB_USER', 'truthguard'),
            'PASSWORD': os.getenv('DB_PASSWORD', 'truthguard'),
            'HOST': os.getenv('DB_HOST', '127.0.0.1'),
            'PORT': os.getenv('DB_PORT', '5432'),
            'CONN_MAX_AGE': 60,
        }
    }

AUTH_USER_MODEL = 'accounts.User'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
     'OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# -----------------------------------------------------------------------
# Django REST Framework
# -----------------------------------------------------------------------
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'apps.core.pagination.DefaultPagination',
    'PAGE_SIZE': 10,
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.UserRateThrottle',
        'rest_framework.throttling.AnonRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'user': '240/min',
        'anon': '60/min',
    },
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'TruthGuard API',
    'DESCRIPTION': (
        'REST API for TruthGuard - Early Misinformation Risk Prediction '
        'Using Data Mining.'
    ),
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

# -----------------------------------------------------------------------
# CORS
# -----------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv(
        'CORS_ALLOWED_ORIGINS',
        'http://localhost:5173,http://127.0.0.1:5173',
    ).split(',') if o.strip()
]
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS[:]

# -----------------------------------------------------------------------
# Uploads / security
# -----------------------------------------------------------------------
DATA_UPLOAD_MAX_MEMORY_SIZE = 26_214_400  # 25 MB total per request
FILE_UPLOAD_MAX_MEMORY_SIZE = 26_214_400

# -----------------------------------------------------------------------
# TruthGuard ML and moderation policy
# -----------------------------------------------------------------------
# Probability at or above which a predicted "misinformation" post is
# classified as HIGH risk (held for moderator review).
TG_HIGH_RISK_THRESHOLD = float(os.getenv('TG_HIGH_RISK_THRESHOLD', '0.75'))
# Action for MEDIUM risk posts: 'publish' (with a visible warning) or
# 'hold' (send to the moderation queue like high risk posts).
TG_MEDIUM_RISK_ACTION = os.getenv('TG_MEDIUM_RISK_ACTION', 'publish')
# Canonical internal labels used by every trained model.
TG_LABEL_FAKE = 'fake'
TG_LABEL_REAL = 'real'

# Directory where trained model artifacts (joblib files) are stored.
# Never served publicly by the web server.
ML_STORE_DIR = BASE_DIR / 'mlstore'
