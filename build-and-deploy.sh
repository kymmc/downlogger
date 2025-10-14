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

# Step 1: Setup Buildx Builder
echo -e "${GREEN}🔧 Step 1: Setting up multi-platform builder...${NC}"

# Create a new builder if it doesn't exist
if ! docker buildx ls | grep -q "multiarch"; then
    echo "Creating multi-platform builder..."
    docker buildx create --name multiarch --driver docker-container --use
else
    echo "Using existing multi-platform builder..."
    docker buildx use multiarch
fi

# Bootstrap the builder
docker buildx inspect --bootstrap

echo -e "${GREEN}✅ Builder setup complete${NC}"
echo ""

# Step 2: Login to Registry
echo -e "${GREEN}🔐 Step 2: Logging into Artifactory...${NC}"
echo "Registry: ${REGISTRY}"
echo ""

# Check if already logged in by examining Docker config
if ! grep -q "\"${REGISTRY}\"" ~/.docker/config.json 2>/dev/null; then
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

echo ""

# Step 3: Build and Push Multi-Platform Image
echo -e "${GREEN}📦 Step 3: Building and pushing multi-platform image...${NC}"
echo "Image: ${FULL_IMAGE}"
echo "Platforms: linux/amd64,linux/arm64"
echo ""

docker buildx build --platform linux/amd64,linux/arm64 --no-cache -t ${FULL_IMAGE} --push .

echo -e "${GREEN}✅ Docker image built and pushed successfully${NC}"
echo ""

# Step 4: Update Kubernetes Deployment
echo -e "${GREEN}🚀 Step 4: Updating Kubernetes deployment...${NC}"

# Apply all Kubernetes manifests (this ensures IngressRoute, middleware, etc. are updated)
kubectl apply -f k8s/

echo -e "${GREEN}✅ Kubernetes manifests applied${NC}"
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