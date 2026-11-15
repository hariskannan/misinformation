@echo off
REM TruthGuard - start backend + frontend and open the app in your browser.
REM Just double-click this file. No PowerShell required.
setlocal
echo Starting TruthGuard...
start "TruthGuard Backend" cmd /k ""%~dp0start-backend.bat""
start "TruthGuard Frontend" cmd /k ""%~dp0start-frontend.bat""

echo Waiting for the servers to come up...
timeout /t 8 /nobreak >nul

start "" "http://localhost:5173"
echo.
echo TruthGuard should now be open at http://localhost:5173
echo Two terminal windows were opened - keep both running.
echo Close them (or press Ctrl+C in them) to stop the project.
timeout /t 5 /nobreak >nul
