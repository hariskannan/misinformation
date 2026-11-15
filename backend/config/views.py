"""Views that serve the built React single-page application.

In development Vite serves the frontend. In the Docker/Render deployment the
frontend is compiled into ``frontend_dist`` and Django serves it from the same
origin as the API, which keeps the deployment to a single web service.
"""
import mimetypes
from pathlib import Path

from django.conf import settings
from django.db import connection
from django.http import FileResponse, Http404, JsonResponse


def spa_index(request, path=''):
    """Return a static file from the frontend build, or index.html.

    React Router handles client-side routes such as /post/12, so unknown paths
    return index.html rather than a 404. API, admin, media and static URLs are
    excluded in config/urls.py and never reach this view.
    """
    base = Path(settings.FRONTEND_DIST).resolve()
    index = base / 'index.html'
    if not index.is_file():
        raise Http404(
            'The frontend build is missing. Run "npm run build" in frontend/ '
            'and copy dist/ to backend/frontend_dist/, or use the Docker image.'
        )

    if path:
        candidate = (base / path).resolve()
        try:
            candidate.relative_to(base)
        except ValueError:
            # Path traversal attempt: never serve outside the build directory.
            raise Http404('File not found.')
        if candidate.is_file():
            content_type, _ = mimetypes.guess_type(str(candidate))
            return FileResponse(
                candidate.open('rb'),
                content_type=content_type or 'application/octet-stream',
            )

    return FileResponse(index.open('rb'), content_type='text/html')


def health(request):
    """Lightweight health check for hosting platforms."""
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
        return JsonResponse({'status': 'ok', 'database': True})
    except Exception:
        return JsonResponse(
            {'status': 'degraded', 'database': False}, status=503
        )
