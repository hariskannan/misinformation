@echo off
REM Expose the running TruthGuard dev servers through a public HTTPS URL.
REM Start start-project.bat first (backend :8000 + frontend :5173), then run
REM this file. Keep the window open while people are using the link.
setlocal
set "ROOT=%~dp0"
set "TOOLS=%ROOT%tools"
set "CF=%TOOLS%\cloudflared.exe"

if not exist "%TOOLS%" mkdir "%TOOLS%"

if not exist "%CF%" (
  echo Downloading cloudflared ^(one-time, ~55 MB^)...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '%CF%'"
)

if not exist "%CF%" (
  echo Could not download cloudflared. Check your internet connection.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo  Starting a public HTTPS tunnel to http://localhost:5173
echo  Copy the https://....trycloudflare.com address printed below.
echo  Keep this window open. Press Ctrl+C to stop sharing.
echo ============================================================
echo.

"%CF%" tunnel --url http://localhost:5173 --no-autoupdate
pause
