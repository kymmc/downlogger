# Azure App Service Deployment Guide

## Prerequisites
1. Azure subscription
2. Azure CLI installed (or use Azure Cloud Shell)
3. VS Code with Azure App Service extension (already installed)

## Option 1: Deploy via VS Code (Easiest)

1. **Sign in to Azure**:
   - Press `Ctrl+Shift+P`
   - Type "Azure: Sign In"
   - Follow the authentication flow

2. **Deploy your app**:
   - Right-click on your project folder in VS Code Explorer
   - Select "Deploy to Web App..."
   - Choose "Create new Web App"
   - Follow the prompts:
     - App name: `gbd-results-logger-[your-initials]`
     - Resource Group: Create new or use existing
     - Location: Choose closest to your database (likely West US 2)
     - Pricing tier: F1 (Free) for testing, or B1 (Basic) for production

3. **Configure environment variables** (after deployment):
   - In VS Code Azure extension, right-click your app
   - Select "Open in Portal"
   - Go to Settings → Environment variables
   - Add your database credentials

## Option 2: Deploy via Azure CLI

```bash
# Login to Azure
az login

# Create resource group
az group create --name gbd-logger-rg --location westus2

# Create App Service plan
az appservice plan create --name gbd-logger-plan --resource-group gbd-logger-rg --sku B1 --is-linux

# Create web app
az webapp create --resource-group gbd-logger-rg --plan gbd-logger-plan --name gbd-results-logger-[your-initials] --runtime "NODE|18-lts"

# Deploy code
az webapp deployment source config-zip --resource-group gbd-logger-rg --name gbd-results-logger-[your-initials] --src deploy.zip
```

## Step 4: Configure Database Connection

After deployment, you need to set up environment variables:

### In Azure Portal:
1. Go to your App Service
2. Settings → Environment variables
3. Add these variables:
   - `DB_HOST`: apputils-unmanaged-db-p01.db.ihme.washington.edu
   - `DB_USER`: [your database username]
   - `DB_PASSWORD`: [your database password]  
   - `DB_NAME`: download_tracking
   - `PORT`: 8080

### Configure VNet Integration (for internal database access):
1. In Azure Portal → Your App Service
2. Settings → Networking
3. Click "VNet integration"
4. Set up connection to IHME network (you may need IT help)

## Step 5: Test Your Deployment

Your app will be available at:
`https://gbd-results-logger-[your-initials].azurewebsites.net`

## Troubleshooting

1. **Check logs**: App Service → Monitoring → Log stream
2. **Database connectivity**: Ensure VNet integration is configured
3. **Environment variables**: Verify all DB credentials are set

## Next Steps

1. **Custom domain**: Add your organization's domain
2. **SSL certificate**: Enable HTTPS with custom certificate
3. **Scaling**: Configure auto-scaling if needed
4. **Monitoring**: Set up Application Insights

Would you like me to help with any specific step?
