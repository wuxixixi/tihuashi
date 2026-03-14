@echo off
chcp 65001 >nul
title 墨韵 AI
echo.
echo ╔══════════════════════════════════════════════╗
echo ║           墨 韵 A I                          ║
echo ║     AI 赏析中国画，为您题诗                   ║
echo ║                                              ║
echo ║     上海觉测信息科技有限公司 出品              ║
echo ╚══════════════════════════════════════════════╝
echo.
echo 正在启动服务...
echo.

cd /d "%~dp0"

:: 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

:: 检查 .env 配置
findstr "your-api-key-here" .env >nul
if %errorlevel% equ 0 (
    echo [警告] 请先编辑 .env 文件，填入您的 DMX_API_KEY
    echo.
)

:: 启动后端
cd backend
start /b node server.js

:: 等待后端启动
timeout /t 2 /nobreak >nul

:: 打开浏览器
echo 服务已启动，正在打开浏览器...
start http://localhost:3001

echo.
echo ══════════════════════════════════════════════
echo  服务已启动！
echo  访问地址: http://localhost:3001
echo  关闭此窗口即可停止服务
echo ══════════════════════════════════════════════
echo.
pause
