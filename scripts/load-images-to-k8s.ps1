# The Docker Desktop cluster runs inside its own container (a "kind" node) and has its own image store,
# so images built with "docker build" are not visible to Kubernetes automatically.
# This script copies them into the node. (We save to a file first: piping binary data through
# PowerShell would corrupt the image.)
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\load-images-to-k8s.ps1
param(
  [string]$Node = "desktop-control-plane",
  [string]$Tag = "local"
)
$ErrorActionPreference = "Stop"

$images = "api-gateway","auth-service","user-service","product-service","cart-service","inventory-service","order-service","payment-service","notification-service","customer-app","admin-app"
$tmp = Join-Path $env:TEMP "cake-images"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

foreach ($name in $images) {
  $image = "cake-$name`:$Tag"
  $file = Join-Path $tmp "$name.tar"
  Write-Host "Loading $image into $Node ..." -ForegroundColor Cyan
  docker save -o $file $image
  if ($LASTEXITCODE -ne 0) { throw "docker save failed for $image (did you run build-images.ps1?)" }
  docker cp $file "${Node}:/tmp/$name.tar"
  docker exec $Node ctr --namespace=k8s.io images import "/tmp/$name.tar"
  if ($LASTEXITCODE -ne 0) { throw "import failed for $image" }
  docker exec $Node rm -f "/tmp/$name.tar"
  Remove-Item $file -Force
}
Write-Host "All images are available inside the cluster." -ForegroundColor Green
