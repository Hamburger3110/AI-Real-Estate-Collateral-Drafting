#!/bin/bash
set -e

#!/bin/bash

# AI Real Estate Collateral Drafting - Quick Deploy Script
# One-command deployment for EC2

set -e

echo "🚀 Quick Deploy - AI Real Estate Collateral Drafting"
echo "=================================================="

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    echo "❌ Please do not run this script as root"
    echo "   Run as: ./quick-deploy.sh"
    exit 1
fi

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

echo "📍 Script directory: $SCRIPT_DIR"
echo "👤 Current user: $(whoami)"
echo "🖥️  Server IP: $(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo 'Not on EC2')"
echo ""

# Check if we're on EC2
if ! curl -s http://169.254.169.254/latest/meta-data/instance-id > /dev/null 2>&1; then
    echo "⚠️  Warning: This script is designed for EC2 instances"
    echo "   Continuing anyway..."
fi

# Step 1: Server Setup
echo "📋 Step 1: Server Setup"
echo "======================="

if command -v node &> /dev/null && command -v npm &> /dev/null && command -v pm2 &> /dev/null && command -v nginx &> /dev/null; then
    echo "✅ Required software already installed"
else
    echo "📦 Installing required software..."
    
    if [ -f "$SCRIPT_DIR/setup-server.sh" ]; then
        chmod +x "$SCRIPT_DIR/setup-server.sh"
        "$SCRIPT_DIR/setup-server.sh"
    else
        echo "❌ setup-server.sh not found in $SCRIPT_DIR"
        exit 1
    fi
fi

echo ""

# Step 2: Application Deployment
echo "📋 Step 2: Application Deployment"
echo "================================="

if [ -f "$SCRIPT_DIR/deploy-app.sh" ]; then
    chmod +x "$SCRIPT_DIR/deploy-app.sh"
    "$SCRIPT_DIR/deploy-app.sh"
else
    echo "❌ deploy-app.sh not found in $SCRIPT_DIR"
    exit 1
fi

echo ""

# Step 3: SSL Configuration (Optional)
echo "📋 Step 3: SSL Configuration (Optional)"
echo "======================================="

read -p "🔒 Do you want to configure SSL with a domain? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "🌐 Enter your domain name (e.g., myapp.example.com): " DOMAIN
    
    if [ ! -z "$DOMAIN" ]; then
        if [ -f "$SCRIPT_DIR/configure-ssl.sh" ]; then
            chmod +x "$SCRIPT_DIR/configure-ssl.sh"
            "$SCRIPT_DIR/configure-ssl.sh" "$DOMAIN"
        else
            echo "❌ configure-ssl.sh not found in $SCRIPT_DIR"
        fi
    else
        echo "❌ No domain provided, skipping SSL configuration"
    fi
else
    echo "⏭️  Skipping SSL configuration"
fi

echo ""

# Final Summary
echo "🎉 Quick Deploy Completed!"
echo "=========================="

SERVER_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo 'localhost')

echo ""
echo "🌐 Your application is now available at:"
if [[ ! -z "$DOMAIN" ]]; then
    echo "   Primary: https://$DOMAIN"
    echo "   Alternative: https://www.$DOMAIN"
fi
echo "   Direct: http://$SERVER_IP"
echo ""

echo "📊 Application Status:"
pm2 status

echo ""
echo "🔧 Useful Commands:"
echo "   pm2 status          # Check application status"
echo "   pm2 logs            # View logs"
echo "   pm2 restart all     # Restart applications"
echo "   ./update-app.sh     # Update application"
echo ""

echo "🔍 Health Check URLs:"
echo "   Backend: http://$SERVER_IP:5000/health"
echo "   Frontend: http://$SERVER_IP:3000"
echo ""

echo "📝 Configuration Details:"
echo "   Database: ai-collateral.cp4kyq4yeu8e.us-east-2.rds.amazonaws.com"
echo "   S3 Bucket: document-upload-vp/document"
echo "   Region: us-east-2"
echo "   Environment: Production"
echo ""

echo "✅ Deployment completed successfully!"
echo "🚀 Your AI Real Estate Collateral Drafting application is ready!"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

BRANCH=${1:-main}
APP_DIR="/home/$(whoami)/AI-Real-Estate-Collateral-Drafting"

echo -e "${BLUE}🚀 Quick Deploy Started${NC}"
echo "Branch: $BRANCH"
echo "Time: $(date)"

# Navigate to project directory
cd "$APP_DIR"

# Backup current state
echo -e "${BLUE}📦 Creating backup...${NC}"
BACKUP_DIR="/tmp/ai-real-estate-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r frontend/build "$BACKUP_DIR/" 2>/dev/null || echo "No existing build to backup"

# Pull latest changes
echo -e "${BLUE}📥 Pulling latest changes from $BRANCH...${NC}"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

# Install backend dependencies (only if package.json changed)
echo -e "${BLUE}📦 Checking backend dependencies...${NC}"
cd backend
if [ package.json -nt node_modules/.package-lock.json ] 2>/dev/null; then
    echo "Installing backend dependencies..."
    npm ci --only=production
else
    echo "Backend dependencies up to date"
fi

# Install frontend dependencies and build
echo -e "${BLUE}🏗️ Building frontend...${NC}"
cd ../frontend
if [ package.json -nt node_modules/.package-lock.json ] 2>/dev/null; then
    echo "Installing frontend dependencies..."
    npm ci
else
    echo "Frontend dependencies up to date"
fi

# Build frontend
npm run build

# Check if PM2 is running the application
echo -e "${BLUE}🔄 Restarting services...${NC}"
if pm2 list | grep -q "ai-real-estate-backend"; then
    pm2 restart ai-real-estate-backend
    pm2 save
else
    echo -e "${YELLOW}⚠️ PM2 process not found, starting fresh...${NC}"
    cd "$APP_DIR"
    pm2 start ecosystem.config.js
    pm2 save
fi

# Reload Nginx
echo -e "${BLUE}🔄 Reloading Nginx...${NC}"
sudo nginx -t && sudo systemctl reload nginx

# Check application health
echo -e "${BLUE}🏥 Health check...${NC}"
sleep 3
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend health check passed${NC}"
else
    echo -e "${YELLOW}⚠️ Backend health check failed${NC}"
fi

# Get public IP
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${GREEN}🌐 Application URL: http://$PUBLIC_IP${NC}"
echo -e "${BLUE}📊 PM2 Status:${NC}"
pm2 status

# Show recent logs
echo -e "${BLUE}📝 Recent logs:${NC}"
pm2 logs ai-real-estate-backend --lines 10 --nostream