@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Chưa cài Node.js. Hãy cài Node.js 20 hoặc mới hơn.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Đang cài thư viện...
  call npm install
  if errorlevel 1 (
    echo Cài thư viện thất bại.
    pause
    exit /b 1
  )
)
echo Mở game tại http://localhost:10000
start "" http://localhost:10000
call npm start
pause
