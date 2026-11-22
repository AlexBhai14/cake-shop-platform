# Builds the Docker image of every service for the local Kubernetes cluster.
# Usage (from the project root):  powershell -ExecutionPolicy Bypass -File scripts\build-images.ps1
# Optional parameter -ApiUrl is baked into the two React apps (default: http://localhost:3000).
param(
  [string]$ApiUrl = "http://localhost:3000",
  [string]$Tag = "local"
)
$ErrorActionPreference = "Stop"

$backends = "api-gateway","auth-service","user-service","product-service","cart-service","inventory-service","order-service","payment-service","notification-service"
foreach ($name in $backends) {
  Write-Host "Building cake-$name`:$Tag ..." -ForegroundColor Cyan
  docker build -t "cake-$name`:$Tag" "backend/$name"
  if ($LASTEXITCODE -ne 0) { throw "Build failed for $name" }
}
foreach ($app in "customer-app","admin-app") {
  Write-Host "Building cake-$app`:$Tag (API address $ApiUrl) ..." -ForegroundColor Cyan
  docker build --build-arg "VITE_API_URL=$ApiUrl" -t "cake-$app`:$Tag" "frontend/$app"
  if ($LASTEXITCODE -ne 0) { throw "Build failed for $app" }
}
Write-Host "All images built." -ForegroundColor Green
