# Kubernetes Deployment for Downlogger

Simple Kubernetes manifests for deploying Downlogger to production.

## Quick Start

### 1. Create Secret File

```bash
cd k8s/
cp secret.yaml.example secret.yaml
# Edit secret.yaml with your actual database credentials
```

### 2. Deploy

```bash
# From the project root directory
chmod +x build-and-deploy.sh
./build-and-deploy.sh
```

That's it! The script will build the Docker image, push it to the registry, and deploy everything to Kubernetes in the correct order.

## Manual Deployment

If you prefer to apply manifests manually:

```bash
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f secret.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml
kubectl apply -f hpa.yaml
```

## Check Status

```bash
# Get all resources
kubectl get all -n downlogger-prod

# Check pods
kubectl get pods -n downlogger-prod

# Check ingressroute
kubectl get ingressroute -n downlogger-prod

# Check HPA
kubectl get hpa -n downlogger-prod

# View logs
kubectl logs -f deployment/downlogger -n downlogger-prod
```

## Update Deployment

To update the image or configuration:

```bash
# Edit the manifest
vim deployment.yaml

# Apply changes
kubectl apply -f deployment.yaml

# Or update image directly
kubectl set image deployment/downlogger downlogger=downlogger:v1.2.3 -n downlogger-prod
```

## Rollback

```bash
# View rollout history
kubectl rollout history deployment/downlogger -n downlogger-prod

# Rollback to previous version
kubectl rollout undo deployment/downlogger -n downlogger-prod

# Rollback to specific revision
kubectl rollout undo deployment/downlogger --to-revision=2 -n downlogger-prod
```

## Scale Manually

```bash
# Scale to specific number of replicas
kubectl scale deployment/downlogger --replicas=10 -n downlogger-prod

# Note: HPA will override this if enabled
```

## Delete Deployment

```bash
kubectl delete -f .
# Or delete namespace (removes everything)
kubectl delete namespace downlogger-prod
```

## Configuration

### Environment Variables (ConfigMap)
Edit `configmap.yaml`:
- `PORT`: Application port (3000)
- `DB_HOST`: Database host
- `DB_PORT`: Database port (3306)
- `DB_NAME`: Database name

### Secrets
Edit `secret.yaml`:
- `DB_USER`: Database username
- `DB_PASSWORD`: Database password

### Resources
Edit `deployment.yaml`:
- CPU limits/requests
- Memory limits/requests
- Replica count (if HPA disabled)

### Auto-scaling
Edit `hpa.yaml`:
- `minReplicas`: Minimum pods (default: 5)
- `maxReplicas`: Maximum pods (default: 15)
- CPU/Memory thresholds

## Troubleshooting

### Pods not starting
```bash
kubectl describe pod <pod-name> -n downlogger-prod
kubectl logs <pod-name> -n downlogger-prod
```

### Check events
```bash
kubectl get events -n downlogger-prod --sort-by='.lastTimestamp'
```

### Exec into pod
```bash
kubectl exec -it deployment/downlogger -n downlogger-prod -- sh
```

## Production URL

https://downlogger.aks.scicomp.ihme.washington.edu

## Files

- `namespace.yaml` - Creates the downlogger-prod namespace
- `configmap.yaml` - Application configuration
- `secret.yaml.example` - Template for database credentials
- `deployment.yaml` - Main application deployment
- `service.yaml` - ClusterIP service
- `ingress.yaml` - Traefik IngressRoute with HTTPS redirect middleware
- `hpa.yaml` - Horizontal Pod Autoscaler
- `../build-and-deploy.sh` - Main build and deployment script
- `README.md` - This file

