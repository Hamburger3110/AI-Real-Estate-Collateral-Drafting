#!/bin/bash

# AI Real Estate Collateral Drafting - Update Deployment Script
# This script updates the application with the latest code

set -e

APP_DIR="/home/$(whoami)/app"

echo "🔄 Updating AI Real Estate Collateral Drafting application..."

# Navigate to app directory
cd $APP_DIR

# Pull latest changes
echo "📥 Pulling latest changes from repository..."
git pull origin main

# Update backend
echo "🔧 Updating backend..."
cd $APP_DIR/backend

# Install/update backend dependencies
npm install --production

# Update frontend
echo "🔧 Updating frontend..."
cd $APP_DIR/frontend

# Install/update frontend dependencies
npm install

# Rebuild frontend
echo "🏗️ Rebuilding frontend..."
npm run build

# Restart applications
echo "🔄 Restarting applications..."
pm2 restart all

# Wait for applications to start
echo "⏳ Waiting for applications to restart..."
sleep 10

# Health check
echo "🏥 Performing health check..."

# Check backend
if curl -f -s http://localhost:5000/health > /dev/null; then
    echo "✅ Backend health check passed"
else
    echo "❌ Backend health check failed"
    echo "📋 Backend logs:"
    pm2 logs ai-real-estate-backend --lines 10
fi

# Check frontend
if curl -f -s http://localhost:3000 > /dev/null; then
    echo "✅ Frontend health check passed"
else
    echo "❌ Frontend health check failed"
    echo "📋 Frontend logs:"
    pm2 logs ai-real-estate-frontend --lines 10
fi

# Show current status
echo ""
echo "📊 Current application status:"
pm2 status

echo ""
echo "✅ Update completed successfully!"
echo "🌐 Application is available at your configured domain/IP"