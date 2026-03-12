# Mo-Yun AI startup: kill ports 3000/3001, then start backend and frontend
# Run: .\start.ps1  or  pwsh -File start.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }

$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"

function Kill-Port {
  param([int]$Port)
  $found = $false
  try {
    $out = netstat -ano 2>$null
    $lines = $out | Select-String ":\s*$Port\s"
    foreach ($line in $lines) {
      $parts = ($line -split "\s+")
      $pid = $parts[-1]
      if ($pid -match "^\d+$") {
        Write-Host "Kill port $Port PID=$pid"
        taskkill /PID $pid /F 2>$null
        $found = $true
      }
    }
  } catch {}
  if (-not $found) { Write-Host "Port $Port not in use" }
}

Write-Host "`nFree ports 3000, 3001..."
Kill-Port 3000
Kill-Port 3001
Start-Sleep -Seconds 1

Write-Host "`nStart backend (3001)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendDir'; node server.js"
Start-Sleep -Seconds 2

Write-Host "Start frontend (3000)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendDir'; npm run dev"

Write-Host "`nBackend: http://localhost:3001"
Write-Host "Frontend: http://localhost:3000"
Write-Host ""
