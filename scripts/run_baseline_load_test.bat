@echo off
REM Baseline load test for backend (Windows)
REM Usage: scripts\run_baseline_load_test.bat [target_url]
SET TARGET=%1
IF "%TARGET%"=="" SET TARGET=http://localhost:3001/api/analyze
echo Running autocannon baseline load test against %TARGET%
echo Ensure Node and npx are installed.
npx autocannon -c 50 -d 30 -p 10 %TARGET% --output scripts\reports\autocannon-result.json
echo Report saved to scripts\reports\autocannon-result.json (create folder if not exists).
echo Done.
