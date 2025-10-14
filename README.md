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

### Kubernetes (Recommended)
Containerized deployment with Docker and Kubernetes manifests for scalable cluster deployment.

**Quick Kubernetes Deploy:**
```bash
# Build and deploy
.\deploy.ps1 -Registry "your-registry.com"

# Or manually
npm run docker:build
npm run k8s:deploy
```

**Key Features:**
- 🐳 **Docker containerization** for consistent deployments
- ⚖️ **Horizontal auto-scaling** (2-10 replicas)
- 🔒 **Secure secrets management** for database credentials
- 🌐 **Ingress routing** with custom domain support
- 📊 **Health checks** and monitoring
- 🔄 **Rolling updates** with zero downtime

See `KUBERNETES_DEPLOYMENT.md` for detailed deployment instructions.

### Alternative: Azure App Service
*Legacy deployment option - Kubernetes recommended for new deployments*

See `AZURE_DEPLOYMENT.md` if Azure App Service deployment is required.

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

## Build and Deploy Commands

```bash
# Local development
npm start                 # Start local server
npm run dev              # Start with auto-reload

# Docker and Kubernetes
npm run docker:build     # Build Docker image
npm run k8s:deploy       # Deploy to Kubernetes
npm run k8s:delete       # Remove from Kubernetes
npm run k8s:logs         # View application logs
npm run k8s:status       # Check deployment status
```

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
- Ensure App Service VNet integration is configured

### Performance Issues
- Monitor connection pool usage in logs
- Check cache hit rates for optimization opportunities
- Consider database indexing for large datasets

### Deployment Issues
- Verify all environment variables are set in Azure
- Check App Service logs for detailed error messages
- Ensure proper VNet configuration for database access

## License

MIT License - Internal IHME use
