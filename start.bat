@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo == 检查依赖安装 ==
echo.

if not exist "backend\node_modules" (
  echo 正在安装后端依赖...
  cd backend
  call npm install
  cd ..
)

if not exist "frontend\node_modules" (
  echo 正在安装前端依赖...
  cd frontend
  call npm install
  cd ..
)

echo.
echo == 释放端口 ==
echo.

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173 "') do (
  echo 结束端口 5173 进程 PID=%%a
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

echo == 启动前端 (5173) ==
start "墨韵-前端" cmd /k "cd /d \"%~dp0frontend\" && npm run dev"

echo.
echo 前后端已在新窗口启动。
echo 后端: http://localhost:3001
echo 前端: http://localhost:5173
echo.
pause
