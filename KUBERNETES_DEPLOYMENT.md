# Kubernetes Deployment Guide for GBD Logger

This guide explains how to deploy the GBD Results Download Logger to a Kubernetes cluster.

## Prerequisites

- Docker installed and configured
- kubectl configured to access your Kubernetes cluster
- Access to a container registry (Docker Hub, Azure Container Registry, etc.)
- Kubernetes cluster with ingress controller (nginx, traefik, etc.)

## Quick Start

1. **Update Configuration:**
   ```bash
   # Edit k8s/secret.yaml with your database credentials (base64 encoded)
   echo -n "your_username" | base64
   echo -n "your_password" | base64
   
   # Edit k8s/ingress.yaml with your domain
   # Edit deploy.ps1 or deploy.sh with your container registry
   ```

2. **Deploy:**
   ```bash
   # Using PowerShell (Windows)
   .\deploy.ps1 -Registry "your-registry.com"
   
   # Using Bash (Linux/macOS)
   chmod +x deploy.sh
   ./deploy.sh
   ```

3. **Manual Deployment:**
   ```bash
   # Build and push image
   docker build -t gbd-logger:latest .
   docker tag gbd-logger:latest your-registry.com/gbd-logger:latest
   docker push your-registry.com/gbd-logger:latest
   
   # Update deployment.yaml with your image
   # Deploy to Kubernetes
   kubectl apply -f k8s/
   ```

## Configuration

### Database Credentials
Update `k8s/secret.yaml` with base64-encoded credentials:
```bash
echo -n "your_db_username" | base64
echo -n "your_db_password" | base64
```

### Domain Configuration
Update `k8s/ingress.yaml` with your domain name.

### Resource Limits
Adjust CPU/memory limits in `k8s/deployment.yaml` based on your cluster capacity.

## Monitoring

```bash
# Check deployment status
kubectl get all -n gbd-logger

# View logs
kubectl logs -f deployment/gbd-logger -n gbd-logger

# Check pod health
kubectl describe pods -n gbd-logger

# Port forward for local testing
kubectl port-forward service/gbd-logger-service 8080:80 -n gbd-logger
```

## Scaling

The application includes Horizontal Pod Autoscaler (HPA) configuration:
- Minimum replicas: 2
- Maximum replicas: 10
- CPU threshold: 70%
- Memory threshold: 80%

Manually scale:
```bash
kubectl scale deployment gbd-logger --replicas=5 -n gbd-logger
```

## Troubleshooting

### Database Connectivity
1. Verify secrets are correctly base64 encoded
2. Check if your cluster can reach the IHME database
3. Consider network policies or VPC configurations

### Pod Issues
```bash
# Get detailed pod information
kubectl describe pod <pod-name> -n gbd-logger

# Execute into running pod
kubectl exec -it <pod-name> -n gbd-logger -- /bin/sh

# Check environment variables
kubectl exec <pod-name> -n gbd-logger -- env
```

### Ingress Issues
1. Verify ingress controller is installed
2. Check DNS configuration
3. Verify TLS certificates if using HTTPS

## Security Considerations

- Database credentials stored in Kubernetes secrets
- Non-root container execution
- Resource limits applied
- Security contexts configured
- ReadOnlyRootFilesystem option available

## Clean Up

```bash
# Remove all resources
kubectl delete -f k8s/

# Or use npm script
npm run k8s:delete
```
