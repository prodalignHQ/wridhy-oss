#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Wridhy Docker Build & Push Script
# Builds the Docker image for Wridhy and pushes it to Docker Hub
# Default image: rohanmallya/wridhy:latest
# ==============================================================================

IMAGE_NAME="rohanmallya/wridhy"
TAG="${1:-latest}"
FULL_IMAGE="${IMAGE_NAME}:${TAG}"
LATEST_IMAGE="${IMAGE_NAME}:latest"

echo "=================================================="
echo "🚀 Building Wridhy Docker Image"
echo "📦 Target: ${FULL_IMAGE}"
echo "=================================================="

# Check if multi-platform build is requested (via MULTI_ARCH=true or second argument)
MULTI_ARCH="${MULTI_ARCH:-false}"
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"

if [ "${MULTI_ARCH}" = "true" ] || [ "${2:-}" = "--multi-arch" ]; then
  echo "🌐 Multi-platform build enabled for architectures: ${PLATFORMS}"
  
  TAG_ARGS=(-t "${FULL_IMAGE}")
  if [ "${TAG}" != "latest" ]; then
    TAG_ARGS+=(-t "${LATEST_IMAGE}")
  fi

  echo "🔨 Building and pushing multi-arch image via buildx..."
  docker buildx build \
    --platform "${PLATFORMS}" \
    "${TAG_ARGS[@]}" \
    --push \
    .

  echo "=================================================="
  echo "✅ Successfully built and pushed multi-arch image:"
  echo "   - ${FULL_IMAGE}"
  if [ "${TAG}" != "latest" ]; then
    echo "   - ${LATEST_IMAGE}"
  fi
  echo "=================================================="
else
  echo "🔨 Building Docker image: ${FULL_IMAGE}..."
  docker build -t "${FULL_IMAGE}" .

  if [ "${TAG}" != "latest" ]; then
    echo "🏷️ Tagging image as ${LATEST_IMAGE}..."
    docker tag "${FULL_IMAGE}" "${LATEST_IMAGE}"
  fi

  echo "📤 Pushing image to Docker Hub..."
  docker push "${FULL_IMAGE}"

  if [ "${TAG}" != "latest" ]; then
    docker push "${LATEST_IMAGE}"
  fi

  echo "=================================================="
  echo "✅ Successfully built and pushed:"
  echo "   - ${FULL_IMAGE}"
  if [ "${TAG}" != "latest" ]; then
    echo "   - ${LATEST_IMAGE}"
  fi
  echo "=================================================="
fi
