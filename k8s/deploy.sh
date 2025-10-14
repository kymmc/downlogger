#!/bin/bash

# Simple deployment script for Downlogger
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🚀 Deploying Downlogger to Production${NC}"
echo ""

# Check if secret.yaml exists
if [ ! -f "secret.yaml" ]; then
    echo -e "${RED}❌ Error: secret.yaml not found${NC}"
    echo -e "${YELLOW}Please create secret.yaml from secret.yaml.example with your database credentials${NC}"
    echo ""
    echo "Example:"
    echo "  cp secret.yaml.example secret.yaml"
    echo "  # Edit secret.yaml with actual credentials"
    exit 1
fi

# Apply manifests in order
echo -e "${GREEN}📦 Creating namespace...${NC}"
kubectl apply -f namespace.yaml

echo -e "${GREEN}🔧 Creating ConfigMap...${NC}"
kubectl apply -f configmap.yaml

echo -e "${GREEN}🔐 Creating Secret...${NC}"
kubectl apply -f secret.yaml

echo -e "${GREEN}🚀 Creating Deployment...${NC}"
kubectl apply -f deployment.yaml

echo -e "${GREEN}🌐 Creating Service...${NC}"
kubectl apply -f service.yaml

echo -e "${GREEN}🌍 Creating Ingress...${NC}"
kubectl apply -f ingress.yaml

echo -e "${GREEN}📊 Creating HPA...${NC}"
kubectl apply -f hpa.yaml

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Check status with:"
echo "  kubectl get all -n downlogger-prod"
echo ""
echo "View logs with:"
echo "  kubectl logs -f deployment/downlogger -n downlogger-prod"
echo ""
echo "Access the application at:"
echo "  https://downlogger.aks.scicomp.ihme.washington.edu"

