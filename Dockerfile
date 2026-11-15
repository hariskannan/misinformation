# ---------------------------------------------------------------------------
# TruthGuard - single-image deployment (frontend + backend)
# Build:  docker build -t truthguard .
# Run:    docker run -p 8000:8000 -e DJANGO_DEBUG=0 truthguard
# ---------------------------------------------------------------------------

# ---- Stage 1: build the React frontend ----
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci || npm install
COPY frontend/ ./
# Same-origin API calls: the Django process serves /api, /media and the SPA.
RUN npm run build

# ---- Stage 2: Django application ----
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist ./frontend_dist

# Collect Django admin / API-docs static files for WhiteNoise.
RUN python manage.py collectstatic --noinput

EXPOSE 8000
CMD ["sh", "docker-entrypoint.sh"]
