# GBD Logger Kubernetes Deployment Script for Windows

param(
    [string]$Registry = "your-registry.com",
    [string]$ImageName = "gbd-logger",
    [string]$ImageTag = "latest"
)

$ErrorActionPreference = "Stop"

$FullImageName = "$Registry/$ImageName`:$ImageTag"

Write-Host "🏗️  Building Docker image..." -ForegroundColor Green
docker build -t "$ImageName`:$ImageTag" .

Write-Host "🏷️  Tagging image for registry..." -ForegroundColor Green
docker tag "$ImageName`:$ImageTag" $FullImageName

Write-Host "📤 Pushing to registry..." -ForegroundColor Green
docker push $FullImageName

Write-Host "🎯 Updating deployment with new image..." -ForegroundColor Green
# Update the deployment.yaml with the full image name
(Get-Content k8s\deployment.yaml) -replace "image: gbd-logger:latest", "image: $FullImageName" | Set-Content k8s\deployment.yaml

Write-Host "🚀 Deploying to Kubernetes..." -ForegroundColor Green
kubectl apply -f k8s\

Write-Host "⏳ Waiting for rollout to complete..." -ForegroundColor Green
kubectl rollout status deployment/gbd-logger -n gbd-logger

Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host "📊 Get pod status:" -ForegroundColor Yellow
kubectl get pods -n gbd-logger
Write-Host "🌐 Get service info:" -ForegroundColor Yellow
kubectl get svc -n gbd-logger
