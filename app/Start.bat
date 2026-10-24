@echo off
rem Starts a small local web server for the player and opens it in your browser.
cd /d "%~dp0"
set PORT=8765
title Plex custom player - keep this window open while you use the app

where py >nul 2>nul
if %errorlevel%==0 (
  start "" cmd /c "timeout /t 2 >nul & start http://localhost:%PORT%"
  py -m http.server %PORT% --bind 127.0.0.1
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  start "" cmd /c "timeout /t 2 >nul & start http://localhost:%PORT%"
  python -m http.server %PORT% --bind 127.0.0.1
  goto :eof
)

echo Python was not found on this computer.
echo Install it from https://www.python.org/downloads/ and run Start.bat again.
pause
