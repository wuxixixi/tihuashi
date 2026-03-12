@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo == 释放 3000 / 3001 端口 ==
echo.

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 "') do (
  echo 结束端口 3000 进程 PID=%%a
  taskkill /PID %%a /F 2>nul
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001 "') do (
  echo 结束端口 3001 进程 PID=%%a
  taskkill /PID %%a /F 2>nul
)

timeout /t 1 /nobreak >nul

echo.
echo == 启动后端 (3001) ==
start "墨韵-后端" cmd /k "cd /d \"%~dp0backend\" && node server.js"

timeout /t 2 /nobreak >nul

echo == 启动前端 (3000) ==
start "墨韵-前端" cmd /k "cd /d \"%~dp0frontend\" && npm run dev"

echo.
echo 前后端已在新窗口启动。
echo 后端: http://localhost:3001
echo 前端: http://localhost:3000
echo.
pause
