# Creates the Kubernetes Secret "cake-secrets" from your local .env file.
# The passwords never enter Git: .env is ignored by Git, and the Secret exists only inside the cluster.
# Usage (project root):  powershell -ExecutionPolicy Bypass -File scripts\create-k8s-secret.ps1
param(
  [string]$EnvFile = ".env",
  [string]$Namespace = "cake-shop"
)
$ErrorActionPreference = "Stop"

if (-not (Test-Path $EnvFile)) { throw "$EnvFile not found. Copy .env.example to .env and set the passwords first." }

kubectl create namespace $Namespace --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic cake-secrets --from-env-file=$EnvFile -n $Namespace --dry-run=client -o yaml | kubectl apply -f -
Write-Host "Secret cake-secrets is ready in namespace $Namespace." -ForegroundColor Green
Write-Host "Keys stored (values are hidden):"
kubectl get secret cake-secrets -n $Namespace -o jsonpath="{.data}" | ConvertFrom-Json | Get-Member -MemberType NoteProperty | ForEach-Object { "  " + $_.Name }
