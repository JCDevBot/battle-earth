@echo off
setlocal
cd /d "%~dp0"
set PORT=5173
set URL=http://localhost:%PORT%

echo === OSM Tactical Map launcher ===
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found.
  echo Please install Node.js 22 LTS from https://nodejs.org/ then run this file again.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Please reinstall Node.js with npm enabled.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing project dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
) else (
  echo Dependencies already installed. Skipping npm install.
)

start "" "%URL%"
echo Starting dev server at %URL% ...
echo Press Ctrl+C to stop the server.
call npm run dev -- --host 0.0.0.0 --port %PORT%
pause
