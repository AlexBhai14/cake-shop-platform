#!/usr/bin/env bash
# Creates the Kustomize overlay "ci": the base manifests with the Docker Hub images of ONE commit.
# Usage: scripts/ci-render-overlay.sh <dockerhub-user> <image-tag>
set -euo pipefail

USER_NAME="${1:?Docker Hub user name is missing}"
TAG="${2:?Image tag (commit SHA) is missing}"
DIR="infrastructure/kubernetes/overlays/ci"
APPS="api-gateway auth-service user-service product-service cart-service inventory-service order-service payment-service notification-service customer-app admin-app"

mkdir -p "$DIR"
{
  echo "apiVersion: kustomize.config.k8s.io/v1beta1"
  echo "kind: Kustomization"
  echo "resources:"
  echo "  - ../../base"
  echo "images:"
  for app in $APPS; do
    echo "  - name: cake-shop/$app"
    echo "    newName: $USER_NAME/cake-$app"
    echo "    newTag: \"$TAG\""
  done
} > "$DIR/kustomization.yaml"

echo "Wrote $DIR/kustomization.yaml for tag $TAG"
