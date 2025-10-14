#!/bin/bash

# Build and Deploy Pipeline for Downlogger
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
# Option 1: IHME Artifactory (requires API token)
REGISTRY="docker-scicomp.artifactory.ihme.washington.edu"
# Option 2: Docker Hub (easier authentication)
# REGISTRY="docker.io"
# Option 3: Use your Docker Hub username
# REGISTRY="your-dockerhub-username"

IMAGE_NAME="downlogger"
TAG="${1:-latest}"
FULL_IMAGE="${REGISTRY}/${IMAGE_NAME}:${TAG}"

echo -e "${BLUE}🚀 Downlogger Build and Deploy Pipeline${NC}"
echo -e "${BLUE}=======================================${NC}"
echo ""

# Step 1: Build Docker Image
echo -e "${GREEN}📦 Step 1: Building Docker image...${NC}"
echo "Image: ${FULL_IMAGE}"
echo ""

docker build -t ${IMAGE_NAME}:${TAG} .

# Tag for both latest and specific version
LATEST_IMAGE="${REGISTRY}/${IMAGE_NAME}:latest"
docker tag ${IMAGE_NAME}:${TAG} ${LATEST_IMAGE}
docker tag ${IMAGE_NAME}:${TAG} ${FULL_IMAGE}

echo -e "${GREEN}✅ Docker image built successfully${NC}"
echo ""

# Step 2: Login to Registry
echo -e "${GREEN}🔐 Step 2: Logging into Artifactory...${NC}"
echo "Registry: ${REGISTRY}"
echo ""

# Check if already logged in
if ! docker info | grep -q "${REGISTRY}"; then
    echo -e "${YELLOW}Authentication required for ${REGISTRY}${NC}"
    echo ""
    echo -e "${BLUE}For SSO users:${NC}"
    echo "1. Go to: https://${REGISTRY}"
    echo "2. Sign in with SSO"
    echo "3. Generate an API token from your profile"
    echo "4. Use your username and API token (not SSO password)"
    echo ""
    
    # Prompt for credentials
    read -p "Enter your username: " USERNAME
    read -s -p "Enter your API token (not SSO password): " PASSWORD
    echo ""
    
    # Login to registry
    echo "Logging in..."
    echo "$PASSWORD" | docker login ${REGISTRY} -u "$USERNAME" --password-stdin
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Successfully logged in${NC}"
    else
        echo -e "${RED}❌ Login failed. Please check your credentials.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Already logged in to ${REGISTRY}${NC}"
fi

# Step 3: Push Image
echo -e "${GREEN}📤 Step 3: Pushing image to registry...${NC}"

# Always push latest tag
LATEST_IMAGE="${REGISTRY}/${IMAGE_NAME}:latest"
echo "Pushing latest tag: ${LATEST_IMAGE}"
docker push ${LATEST_IMAGE}

# Also push with specific tag
echo "Pushing specific tag: ${FULL_IMAGE}"
docker push ${FULL_IMAGE}

echo -e "${GREEN}✅ Image pushed successfully${NC}"
echo ""

# Step 4: Update Kubernetes Deployment
echo -e "${GREEN}🚀 Step 4: Updating Kubernetes deployment...${NC}"

# Update the deployment with the new image
kubectl set image deployment/downlogger downlogger=${FULL_IMAGE} -n downlogger-prod

echo -e "${GREEN}✅ Deployment updated${NC}"
echo ""

# Step 5: Wait for Rollout
echo -e "${GREEN}⏳ Step 5: Waiting for rollout to complete...${NC}"
kubectl rollout status deployment/downlogger -n downlogger-prod --timeout=300s

echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}📊 Deployment Status:${NC}"
kubectl get pods -n downlogger-prod
echo ""
echo -e "${BLUE}🌐 Application URL:${NC}"
echo "https://downlogger.aks.scicomp.ihme.washington.edu"
echo ""
echo -e "${BLUE}📝 Useful Commands:${NC}"
echo "View logs:    kubectl logs -f deployment/downlogger -n downlogger-prod"
echo "Check status: kubectl get all -n downlogger-prod"
echo "Rollback:     kubectl rollout undo deployment/downlogger -n downlogger-prod"
