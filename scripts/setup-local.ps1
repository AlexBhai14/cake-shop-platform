# One-time local setup of ALL services (run it from the project root, AFTER the infrastructure is running):
#   docker compose up -d mysql redis rabbitmq mailpit
#   powershell -ExecutionPolicy Bypass -File scripts\setup-local.ps1
#
# For each service it
#   1. creates backend\<service>\.env from .env.example, filling in the passwords from the root .env
#   2. runs npm install
#   3. creates (or applies) the database migrations
# Then it creates the admin account and the demo cakes.
param(
  [switch]$Force   # overwrite existing .env files of the services
)
$ErrorActionPreference = "Stop"

if (-not (Test-Path ".env")) { throw "Root .env not found. Run: Copy-Item .env.example .env   (then change the passwords)" }

# read the root .env into a table
$root = @{}
Get-Content ".env" | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$') { $root[$Matches[1]] = $Matches[2].Trim() }
}

$dbServices = @{
  "auth-service"         = @("Auth",         "AUTH")
  "user-service"         = @("User",         "USER")
  "product-service"      = @("Product",      "PRODUCT")
  "cart-service"         = @("Cart",         "CART")
  "inventory-service"    = @("Inventory",    "INVENTORY")
  "order-service"        = @("Order",        "ORDER")
  "payment-service"      = @("Payment",      "PAYMENT")
  "notification-service" = @("Notification", "NOTIFICATION")
}
$allBackends = @("api-gateway") + $dbServices.Keys

function New-ServiceEnv([string]$name) {
  $dir = "backend/$name"
  $target = "$dir/.env"
  if ((Test-Path $target) -and -not $Force) { Write-Host "  .env exists, kept ($name)"; return }
  $text = Get-Content "$dir/.env.example" -Raw
  if ($dbServices.ContainsKey($name)) {
    $cap = $dbServices[$name][0]; $up = $dbServices[$name][1]
    $pw = $root["${up}_DB_PASSWORD"]
    if (-not $pw) { throw "${up}_DB_PASSWORD is missing in the root .env" }
    $text = $text.Replace("ChangeMe${cap}123", $pw)
  }
  $text = $text.Replace("change-this-to-a-long-random-string-at-least-32-chars", $root["JWT_ACCESS_SECRET"])
  if ($root["RABBITMQ_USER"] -and $root["RABBITMQ_PASSWORD"]) {
    $text = $text.Replace("amqp://cake:ChangeMeRabbit123@", "amqp://$($root['RABBITMQ_USER']):$($root['RABBITMQ_PASSWORD'])@")
  }
  Set-Content -Path $target -Value $text -NoNewline
  Write-Host "  .env created ($name)"
}

foreach ($name in $allBackends) {
  Write-Host "== $name" -ForegroundColor Cyan
  New-ServiceEnv $name
  Push-Location "backend/$name"
  try {
    npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "npm install failed in $name" }
    if (Test-Path "prisma/schema.prisma") {
      if (Test-Path "prisma/migrations") { npx prisma migrate deploy } else { npx prisma migrate dev --name init }
      if ($LASTEXITCODE -ne 0) { throw "Prisma migration failed in $name (is MySQL running and healthy?)" }
    }
  } finally { Pop-Location }
}

foreach ($app in @("customer-app", "admin-app")) {
  Write-Host "== $app" -ForegroundColor Cyan
  if (-not (Test-Path "frontend/$app/.env")) { Copy-Item "frontend/$app/.env.example" "frontend/$app/.env" }
  Push-Location "frontend/$app"
  try { npm install --no-audit --no-fund; if ($LASTEXITCODE -ne 0) { throw "npm install failed in $app" } } finally { Pop-Location }
}

Write-Host "== Admin account and demo cakes" -ForegroundColor Cyan
Push-Location "backend/auth-service";    try { npm run seed } finally { Pop-Location }
Push-Location "backend/product-service"; try { npm run seed } finally { Pop-Location }

Write-Host ""
Write-Host "Setup finished. Next: powershell -ExecutionPolicy Bypass -File scripts\start-all.ps1" -ForegroundColor Green
