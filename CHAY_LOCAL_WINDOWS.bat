@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Chua cai Node.js. Hay cai Node.js 20.
  pause
  exit /b 1
)
echo Mo game tai http://localhost:10000
start "" http://localhost:10000
node server.bundle.js
pause
