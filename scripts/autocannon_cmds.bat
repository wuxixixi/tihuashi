@echo off
REM Usage: autocannon_cmds.bat "C:\absolute\path\to\backend\uploads\sample.jpg"
if "%~1"=="" (
  echo Usage: autocannon_cmds.bat "C:\path\to\backend\uploads\sample.jpg"
  exit /b 1
)
set IMAGE_PATH=%~1
echo Running autocannon against /api/analyze with image %IMAGE_PATH%
npx autocannon -c 10 -d 30 -m POST -H "Content-Type: application/json" -b "{\"imagePath\":\"%IMAGE_PATH%\"}" http://localhost:3001/api/analyze
pause
