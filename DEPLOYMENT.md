# Downlogger Deployment Guide
## Manual Steps

## Registry Information

- **Registry**: `docker-scicomp.artifactory.ihme.washington.edu`
- **Image**: `docker-scicomp.artifactory.ihme.washington.edu/downlogger:latest`
- **Namespace**: `downlogger-prod`

## Environment Setup

### Prerequisites
- Docker installed and running
- kubectl configured for your cluster
- Access to IHME Artifactory registry

### First Time Setup

1. **Login to Artifactory:**
```bash
docker login docker-scicomp.artifactory.ihme.washington.edu
```

2. **Create secrets file:**
```bash
cd k8s/
cp secret.yaml.example secret.yaml
# Edit secret.yaml with your database credentials
```

3. **Initial deployment:**
```bash
cd k8s/
./deploy.sh
```

## Deployment Pipeline

The `build-and-deploy.sh` script automates the entire process:

1. **Build** Docker image locally
2. **Tag** image for Artifactory registry
3. **Push** image to registry
4. **Update** Kubernetes deployment
5. **Wait** for rollout completion
6. **Verify** deployment status

## Monitoring

### Check Deployment Status
```bash
kubectl get all -n downlogger-prod
kubectl get pods -n downlogger-prod
```

### View Logs
```bash
kubectl logs -f deployment/downlogger -n downlogger-prod
```

### Check Application
- **URL**: https://downlogger.aks.scicomp.ihme.washington.edu
- **Health Check**: https://downlogger.aks.scicomp.ihme.washington.edu/api/stats

## Troubleshooting

### Image Pull Errors
```bash
# Check if image exists in registry
docker pull docker-scicomp.artifactory.ihme.washington.edu/downlogger:latest

# Verify login
docker info | grep docker-scicomp.artifactory.ihme.washington.edu
```

### Pod Issues
```bash
# Describe pod for details
kubectl describe pod <pod-name> -n downlogger-prod

# Check events
kubectl get events -n downlogger-prod --sort-by='.lastTimestamp'
```

### Rollback
```bash
# Rollback to previous version
kubectl rollout undo deployment/downlogger -n downlogger-prod

# Rollback to specific revision
kubectl rollout undo deployment/downlogger --to-revision=2 -n downlogger-prod
```
