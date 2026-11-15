@echo off
REM TruthGuard - start the React frontend (Windows Command Prompt / double-click)
setlocal
cd /d "%~dp0frontend"

if not exist "node_modules" (
    echo [TruthGuard] Installing frontend dependencies...
    call npm install
    if errorlevel 1 goto :error
)

echo.
echo [TruthGuard] Frontend starting at http://localhost:5173
echo [TruthGuard] Keep this window open. Press Ctrl+C to stop.
echo.
call npm run dev
goto :eof

:error
echo.
echo [TruthGuard] Could not start the frontend. Read the error above.
pause
