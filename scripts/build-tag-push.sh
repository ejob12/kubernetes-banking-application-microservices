#!/usr/bin/env sh
set -eu

NAMESPACE="${DOCKERHUB_NAMESPACE:-${1:-}}"
TAG="${IMAGE_TAG:-${2:-1.0.0}}"

if [ -z "$NAMESPACE" ]; then
  echo "Set DOCKERHUB_NAMESPACE or pass your Docker Hub namespace as the first argument." >&2
  exit 1
fi

build_and_push() {
  name="$1"
  dockerfile="$2"
  image="$NAMESPACE/liontech-finance-$name:$TAG"
  echo "Building $image"
  docker build -f "$dockerfile" -t "$image" .
  echo "Pushing $image"
  docker push "$image"
}

build_and_push frontend frontend/Dockerfile
build_and_push gateway gateway/Dockerfile
build_and_push auth services/auth/Dockerfile
build_and_push profile services/profile/Dockerfile
build_and_push accounts services/accounts/Dockerfile
build_and_push balancer services/balancer/Dockerfile
build_and_push notifications services/notifications/Dockerfile
build_and_push deposits services/deposits/Dockerfile
build_and_push transfers services/transfers/Dockerfile
build_and_push analytics services/analytics/Dockerfile
build_and_push ai services/ai/Dockerfile
build_and_push admin services/admin/Dockerfile

echo "LionTech Finance images are ready."
