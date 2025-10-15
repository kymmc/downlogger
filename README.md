# GBD Results Download Logger

A professional dashboard application for monitoring and analyzing GBD (Global Burden of Disease) results download activity. Built with IHME branding and designed for tracking user downloads, analyzing usage patterns, and providing detailed logging insights.

## Features

- 📊 **Dual-View Dashboard** - User Summary and Detailed Logs views
- 👥 **User Analytics** - Track download activity by user with role-based breakdowns
- 🔗 **Cross-View Navigation** - Click users in summary to drill down to their detailed logs
- 🎨 **IHME Branding** - Official IHME color palette and styling
- 🔍 **Advanced Filtering** - Filter by role, date range, and search across multiple fields
- ⚡ **Performance Optimized** - Connection pooling, caching, and concurrent queries
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile devices
- 🔒 **Secure** - Designed for internal IHME network deployment

## Architecture

### Frontend
- **Vanilla JavaScript** - No framework dependencies
- **CSS Grid & Flexbox** - Modern responsive layouts
- **Font Awesome Icons** - Professional iconography
- **Google Fonts (Archivo)** - IHME standard typography

### Backend
- **Node.js + Express** - RESTful API server
- **MySQL2** - Database connectivity with connection pooling
- **Performance Features** - 5-minute TTL caching, concurrent query execution

### Database Schema
Connects to existing `download_tracking.user_info` table with:
- User email and role information
- Download timestamps and row counts
- Success/failure tracking
- Permalink references

## Prerequisites

### Local Development
- Node.js (v14 or higher)
- Access to IHME MySQL database (`apputils-unmanaged-db-p01.db.ihme.washington.edu`)
- Network connectivity to IHME internal systems

### Production Deployment (Kubernetes)
- Docker Desktop for containerization
- kubectl configured for your Kubernetes cluster
- Container registry access (Docker Hub, Azure Container Registry, etc.)
- Kubernetes cluster with ingress controller (nginx, traefik, etc.)
- Network connectivity from cluster to IHME database

## Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure database connection:**
   Create a `.env` file with your credentials:
   ```
   DB_HOST=apputils-unmanaged-db-p01.db.ihme.washington.edu
   DB_USER=your_username
   DB_PASSWORD=your_password
   DB_NAME=download_tracking
   PORT=3000
   ```

3. **Start the application:**
   ```bash
   npm start
   ```
   
   For development with auto-reload:
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   ```
   http://localhost:3000
   ```

5. **Test Docker build (optional):**
   ```bash
   # Build and test Docker image locally
   docker build -t gbd-logger:latest .
   docker run -p 3001:3000 --env-file .env gbd-logger:latest
   
   # Test at http://localhost:3001
   ```

## Deployment

This application is designed for **Kubernetes deployment** with Docker containerization for scalable, production-ready hosting.

### Registry Information

- **Registry**: `docker-scicomp.artifactory.ihme.washington.edu`
- **Namespace**: `downlogger-prod`
- **Application URL**: https://downlogger.aks.scicomp.ihme.washington.edu

### Deployment Methods

#### Option 1: Jenkins Pipeline (Recommended)

This is the **easiest method** for deployment:

1. Push your code changes to the `main` branch
2. Go to https://jenkins.scicomp.ihme.washington.edu/job/Downlogger/
3. Make sure you are logged in
4. Click **"Build Now"** in the left menu

The Jenkins pipeline will automatically:
- Build multi-platform Docker image (AMD64 + ARM64)
- Push to Artifactory registry
- Deploy to Kubernetes cluster
- Perform rolling update with zero downtime
- Verify deployment health

#### Option 2: Local Machine Deployment

If deploying from your local machine, you need:

**Prerequisites:**
- Docker Desktop installed and running
- Access to IHME Artifactory registry
- kubectl configured for the cluster

**Steps:**

1. **Create secrets file:**
   ```bash
   cd k8s/
   cp secret.yaml.example secret.yaml
   # Edit secret.yaml with your database credentials
   ```

2. **Login to Docker registry:**
   ```bash
   docker login docker-scicomp.artifactory.ihme.washington.edu
   ```

3. **Run the build and deploy script:**
   ```bash
   chmod +x build-and-deploy.sh
   ./build-and-deploy.sh
   ```

The script will:
- Setup multi-platform Docker builder
- Build and push Docker image for both AMD64 and ARM64
- Deploy to Kubernetes cluster
- Wait for rollout completion

### Key Features

- 🐳 **Docker containerization** for consistent deployments
- ⚖️ **Horizontal auto-scaling** (2-10 replicas)
- 🔒 **Secure secrets management** for database credentials
- 🌐 **Ingress routing** with custom domain support
- 📊 **Health checks** and monitoring
- 🔄 **Rolling updates** with zero downtime
- 🏗️ **Multi-platform builds** (AMD64 + ARM64 support)
- 🚀 **CI/CD pipeline** via Jenkins

### Monitoring

**Check Deployment Status:**
```bash
kubectl get all -n downlogger-prod
```

**View Logs:**
```bash
kubectl logs -f deployment/downlogger -n downlogger-prod
```

**Check Application:**
- **URL**: https://downlogger.aks.scicomp.ihme.washington.edu
- **Health Check**: https://downlogger.aks.scicomp.ihme.washington.edu/api/stats

### Advanced Operations

**Rollback:**
```bash
# View rollout history
kubectl rollout history deployment/downlogger -n downlogger-prod

# Rollback to previous version
kubectl rollout undo deployment/downlogger -n downlogger-prod

# Rollback to specific revision
kubectl rollout undo deployment/downlogger --to-revision=2 -n downlogger-prod
```

**Exec into Pod:**
```bash
kubectl exec -it deployment/downlogger -n downlogger-prod -- sh
```

### Configuration

**Environment Variables (ConfigMap):**
Edit `k8s/configmap.yaml`:
- `PORT`: Application port (3000)
- `DB_HOST`: Database host
- `DB_PORT`: Database port (3306)
- `DB_NAME`: Database name

**Secrets:**
Edit `k8s/secret.yaml`:
- `DB_USER`: Database username
- `DB_PASSWORD`: Database password

> **Note**: Azure App Service deployment is a legacy option. See `AZURE_DEPLOYMENT.md` if needed, but Kubernetes is recommended for all new deployments.

## Usage

### User Summary View (Default)
- **Overview**: Users sorted by total data downloaded
- **Metrics**: Download counts, row totals, first/last activity
- **Drill-down**: Click any email to view detailed logs for that user

### Detailed Logs View
- **Individual Records**: Each download request with timestamps
- **Full Details**: IP addresses, queue names, row counts, permalinks
- **Filter Integration**: Seamlessly filter from User Summary selections

### Key Features
- **Smart Sorting**: Default to most relevant columns (total rows, timestamps)
- **Visual Feedback**: Filter indicators show active searches
- **Role-Based Stats**: Dashboard cards break down usage by user roles
- **Cross-View Navigation**: Seamless workflow between summary and details

## API Endpoints

- `GET /api/logs` - Detailed logs with pagination and filtering
- `GET /api/user-summary` - Aggregated user statistics
- `GET /api/stats` - Dashboard metrics and role breakdowns
- `GET /api/levels` - Available user roles

## Performance Features

- **Connection Pooling**: 15 concurrent database connections
- **Query Caching**: 5-minute TTL for repeated requests
- **Concurrent Execution**: Parallel query processing
- **Optimized WHERE Clauses**: Efficient database filtering

## Customization

### Styling
- IHME color palette defined in `public/styles.css`
- Responsive breakpoints for mobile compatibility
- CSS custom properties for easy theme modifications

### Database Queries
- Optimized for `user_info` table structure
- Filtered for 2023 data and successful outcomes
- Easily adaptable for different date ranges or criteria

## Troubleshooting

### Connection Issues
- Verify VPN/network access to IHME systems
- Check database credentials in environment variables
- Ensure proper network configuration for database access

### Performance Issues
- Monitor connection pool usage in logs
- Check cache hit rates for optimization opportunities
- Consider database indexing for large datasets

### Deployment Issues

**Image Pull Errors:**
```bash
# Check if image exists in registry
docker pull docker-scicomp.artifactory.ihme.washington.edu/downlogger:latest

# Verify login
docker info | grep docker-scicomp.artifactory.ihme.washington.edu
```

**Pod Issues:**
```bash
# Describe pod for details
kubectl describe pod <pod-name> -n downlogger-prod

# Check events
kubectl get events -n downlogger-prod --sort-by='.lastTimestamp'
```

**General Kubernetes Issues:**
- Verify all environment variables are set in ConfigMap and Secrets
- Check Kubernetes logs for detailed error messages
- Ensure proper network configuration for database access
- Verify image platform compatibility (AMD64/ARM64)

## License

MIT License - Internal IHME use
