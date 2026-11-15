@echo off
REM TruthGuard - start the Django backend (Windows Command Prompt / double-click)
setlocal
cd /d "%~dp0backend"

if not exist "venv\Scripts\python.exe" (
    echo [TruthGuard] Virtual environment not found - creating it...
    python -m venv venv
    if errorlevel 1 goto :error
    echo [TruthGuard] Installing Python dependencies...
    "venv\Scripts\python.exe" -m pip install --upgrade pip
    "venv\Scripts\python.exe" -m pip install -r requirements.txt
    if errorlevel 1 goto :error
)

if not exist ".env" (
    echo [TruthGuard] No .env found - creating one from .env.example...
    copy ".env.example" ".env" >nul
    echo [TruthGuard] NOTE: edit backend\.env and set USE_SQLITE=1 for a quick local demo,
    echo [TruthGuard]       or configure PostgreSQL and leave USE_SQLITE=0.
)

echo [TruthGuard] Applying database migrations...
"venv\Scripts\python.exe" manage.py migrate
if errorlevel 1 goto :error

echo.
echo [TruthGuard] Backend starting at http://localhost:8000
echo [TruthGuard] API docs:  http://localhost:8000/api/docs/
echo [TruthGuard] Keep this window open. Press Ctrl+C to stop.
echo.
"venv\Scripts\python.exe" manage.py runserver 8000 --noreload
goto :eof

:error
echo.
echo [TruthGuard] Could not start the backend. Read the error above.
pause
