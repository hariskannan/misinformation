#!/bin/sh
# Container start-up: prepare the database, load demo data, then serve.
set -e

python manage.py migrate --noinput

# Both seed commands are idempotent. seed_demo trains the real ML models on
# first boot and creates the demo accounts; seed_extra adds extra content.
python manage.py seed_demo
python manage.py seed_extra

exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers "${WEB_CONCURRENCY:-2}" \
  --timeout 120 \
  --access-logfile -
