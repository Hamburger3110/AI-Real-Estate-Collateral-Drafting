#!/bin/bash

# AI Real Estate Collateral Drafting - Docker Deployment Script
# This script builds and deploys the containerized application

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <action> [options]"
    echo "Actions:"
    echo "  build        - Build Docker images"
    echo "  deploy       - Deploy to EC2 using Docker"
    echo "  local        - Run locally with Docker Compose"
    echo "  clean        - Clean up Docker resources"
    echo ""
    echo "Examples:"
    echo "  $0 build"
    echo "  $0 deploy ubuntu@3.134.252.155"
    echo "  $0 local"
    exit 1
fi

ACTION=$1

case $ACTION in
    "build")
        echo "🏗️ Building Docker images..."
        
        # Build backend image
        echo "📦 Building backend image..."
        docker build -t ai-real-estate-backend:latest ./backend
        
        # Build frontend image
        echo "📦 Building frontend image..."
        docker build -t ai-real-estate-frontend:latest ./frontend
        
        echo "✅ Docker images built successfully!"
        docker images | grep ai-real-estate
        ;;
        
    "local")
        echo "🚀 Starting application locally with Docker Compose..."
        
        # Check if .env file exists
        if [ ! -f "./backend/.env" ]; then
            echo "❌ Backend .env file not found"
            echo "   Please create backend/.env with your configuration"
            exit 1
        fi
        
        # Start services
        docker-compose up -d
        
        echo "✅ Application started!"
        echo "🌐 Frontend: http://localhost:3000"
        echo "🔧 Backend: http://localhost:5000"
        echo "🌍 Nginx: http://localhost:80"
        echo ""
        echo "📊 Container status:"
        docker-compose ps
        ;;
        
    "deploy")
        if [ "$#" -ne 2 ]; then
            echo "Usage: $0 deploy <ec2-user@ip-address>"
            exit 1
        fi
        
        SERVER=$2
        echo "🚀 Deploying to $SERVER using Docker..."
        
        # Check if .env file exists
        if [ ! -f "./backend/.env" ]; then
            echo "❌ Backend .env file not found"
            exit 1
        fi
        
        # Build images first
        echo "🏗️ Building images locally..."
        docker build -t ai-real-estate-backend:latest ./backend
        docker build -t ai-real-estate-frontend:latest ./frontend
        
        # Save images to tar files
        echo "📦 Saving Docker images..."
        docker save ai-real-estate-backend:latest | gzip > backend-image.tar.gz
        docker save ai-real-estate-frontend:latest | gzip > frontend-image.tar.gz
        
        # Copy files to server
        echo "📤 Copying files to server..."
        scp -i ~/.ssh/ai-collateral-ec2-key-pair.pem backend-image.tar.gz $SERVER:/tmp/
        scp -i ~/.ssh/ai-collateral-ec2-key-pair.pem frontend-image.tar.gz $SERVER:/tmp/
        scp -i ~/.ssh/ai-collateral-ec2-key-pair.pem docker-compose.prod.yml $SERVER:/tmp/
        scp -i ~/.ssh/ai-collateral-ec2-key-pair.pem -r nginx $SERVER:/tmp/
        scp -i ~/.ssh/ai-collateral-ec2-key-pair.pem backend/.env $SERVER:/tmp/backend.env
        
        # Deploy on server
        echo "🚀 Deploying on server..."
        ssh -i ~/.ssh/ai-collateral-ec2-key-pair.pem $SERVER << 'ENDSSH'
        
        # Install Docker if not present
        if ! command -v docker &> /dev/null; then
            echo "📦 Installing Docker..."
            sudo apt-get update
            sudo apt-get install -y docker.io docker-compose-plugin
            sudo systemctl start docker
            sudo systemctl enable docker
            sudo usermod -aG docker $USER
        fi
        
        # Install Docker Compose if not present
        if ! command -v docker-compose &> /dev/null; then
            echo "📦 Installing Docker Compose..."
            sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
            sudo chmod +x /usr/local/bin/docker-compose
        fi
        
        # Create app directory
        mkdir -p ~/docker-app/backend
        cd ~/docker-app
        
        # Load Docker images
        echo "📥 Loading Docker images..."
        gunzip -c /tmp/backend-image.tar.gz | docker load
        gunzip -c /tmp/frontend-image.tar.gz | docker load
        
        # Copy configuration files
        cp /tmp/docker-compose.prod.yml ./docker-compose.yml
        cp -r /tmp/nginx .
        mkdir -p ./backend
        cp /tmp/backend.env ./backend/.env
        
        # Stop existing containers
        echo "🛑 Stopping existing containers..."
        docker-compose down 2>/dev/null || true
        
        # Start new containers
        echo "🚀 Starting containers..."
        docker-compose up -d
        
        # Wait for services to be ready
        echo "⏳ Waiting for services to start..."
        sleep 10
        
        # Check status
        echo "📊 Container status:"
        docker-compose ps
        
        # Test health endpoints
        echo "🏥 Testing health endpoints..."
        curl -s http://localhost:5000/health || echo "Backend health check failed"
        curl -s http://localhost:80/nginx-health || echo "Nginx health check failed"
        
ENDSSH
        
        # Clean up local files
        rm -f backend-image.tar.gz frontend-image.tar.gz
        
        echo ""
        echo "✅ Deployment completed successfully!"
        echo "🌐 Your application should be available at: http://$SERVER"
        ;;
        
    "clean")
        echo "🧹 Cleaning up Docker resources..."
        
        # Stop and remove containers
        docker-compose down 2>/dev/null || true
        
        # Remove images
        docker rmi ai-real-estate-backend:latest 2>/dev/null || true
        docker rmi ai-real-estate-frontend:latest 2>/dev/null || true
        
        # Clean up unused resources
        docker system prune -f
        
        echo "✅ Cleanup completed!"
        ;;
        
    *)
        echo "❌ Unknown action: $ACTION"
        echo "Valid actions: build, deploy, local, clean"
        exit 1
        ;;
esac