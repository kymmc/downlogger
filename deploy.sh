#!/bin/bash

# GBD Logger Kubernetes Deployment Script

set -e

# Configuration
DOCKER_REGISTRY="your-registry.com"  # Replace with your container registry
IMAGE_NAME="gbd-logger"
IMAGE_TAG="latest"
FULL_IMAGE_NAME="${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"

echo "🏗️  Building Docker image..."
docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .

echo "🏷️  Tagging image for registry..."
docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${FULL_IMAGE_NAME}

echo "📤 Pushing to registry..."
docker push ${FULL_IMAGE_NAME}

echo "🎯 Updating deployment with new image..."
# Update the deployment.yaml with the full image name
sed -i "s|image: gbd-logger:latest|image: ${FULL_IMAGE_NAME}|g" k8s/deployment.yaml

echo "🚀 Deploying to Kubernetes..."
kubectl apply -f k8s/

echo "⏳ Waiting for rollout to complete..."
kubectl rollout status deployment/gbd-logger -n gbd-logger

echo "✅ Deployment complete!"
echo "📊 Get pod status:"
kubectl get pods -n gbd-logger
echo "🌐 Get service info:"
kubectl get svc -n gbd-logger
