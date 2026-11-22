# Starts the 9 backend services and the 2 React apps, each in its own PowerShell window.
# Run it from the project root:  powershell -ExecutionPolicy Bypass -File scripts\start-all.ps1
# Stop everything by closing those windows (or press Ctrl+C in each).
$ErrorActionPreference = "Stop"
$rootPath = (Get-Location).Path

$targets = @(
  @{ dir = "backend/auth-service";         cmd = "npm run start:dev" },
  @{ dir = "backend/user-service";         cmd = "npm run start:dev" },
  @{ dir = "backend/product-service";      cmd = "npm run start:dev" },
  @{ dir = "backend/cart-service";         cmd = "npm run start:dev" },
  @{ dir = "backend/inventory-service";    cmd = "npm run start:dev" },
  @{ dir = "backend/order-service";        cmd = "npm run start:dev" },
  @{ dir = "backend/payment-service";      cmd = "npm run start:dev" },
  @{ dir = "backend/notification-service"; cmd = "npm run start:dev" },
  @{ dir = "backend/api-gateway";          cmd = "npm run start:dev" },
  @{ dir = "frontend/customer-app";        cmd = "npm run dev" },
  @{ dir = "frontend/admin-app";           cmd = "npm run dev" }
)

foreach ($t in $targets) {
  $path = Join-Path $rootPath $t.dir
  $title = Split-Path $t.dir -Leaf
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle = '$title'; Set-Location '$path'; $($t.cmd)"
  Start-Sleep -Milliseconds 800
}

Write-Host "Started 11 windows. Wait about a minute, then open:" -ForegroundColor Green
Write-Host "  Customer shop   http://localhost:5173"
Write-Host "  Admin panel     http://localhost:5174"
Write-Host "  API gateway     http://localhost:3000/health"
Write-Host "  Test inbox      http://localhost:8025"
