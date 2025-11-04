#!/bin/bash

# AI Real Estate Collateral Drafting - Server Setup Script
# This script sets up the EC2 instance with all required dependencies

set -e

echo "🚀 Setting up EC2 server for AI Real Estate Collateral Drafting..."

# Detect OS
if [ -f /etc/redhat-release ]; then
    OS="centos"
    PACKAGE_MANAGER="yum"
    USER="ec2-user"
elif [ -f /etc/lsb-release ]; then
    OS="ubuntu"
    PACKAGE_MANAGER="apt"
    USER="ubuntu"
else
    echo "❌ Unsupported OS"
    exit 1
fi

echo "📋 Detected OS: $OS"

# Update system
echo "📦 Updating system packages..."
if [ "$OS" = "ubuntu" ]; then
    sudo apt update && sudo apt upgrade -y
    sudo apt install -y curl wget git build-essential
else
    sudo yum update -y
    sudo yum groupinstall -y "Development Tools"
    sudo yum install -y curl wget git
fi

# Install Node.js 18.x
echo "📦 Installing Node.js 18.x..."
if [ "$OS" = "ubuntu" ]; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
    sudo yum install -y nodejs
fi

# Verify Node.js installation
echo "✅ Node.js version: $(node --version)"
echo "✅ NPM version: $(npm --version)"

# Install PM2 globally
echo "📦 Installing PM2 process manager..."
sudo npm install -g pm2

# Install Nginx
echo "📦 Installing Nginx..."
if [ "$OS" = "ubuntu" ]; then
    sudo apt install -y nginx
else
    sudo yum install -y nginx
fi

# Install PostgreSQL client for database testing
echo "📦 Installing PostgreSQL client..."
if [ "$OS" = "ubuntu" ]; then
    sudo apt install -y postgresql-client
else
    sudo yum install -y postgresql
fi

# Create application directory
echo "📁 Creating application directory..."
sudo mkdir -p /home/$USER/app
sudo chown $USER:$USER /home/$USER/app

# Create log directories
echo "📁 Creating log directories..."
sudo mkdir -p /var/log/pm2
sudo mkdir -p /var/log/nginx
sudo chown $USER:$USER /var/log/pm2

# Setup firewall
echo "🔥 Configuring firewall..."
if [ "$OS" = "ubuntu" ]; then
    sudo ufw --force enable
    sudo ufw allow ssh
    sudo ufw allow 'Nginx Full'
    sudo ufw allow 3000
    sudo ufw allow 5000
else
    sudo systemctl start firewalld
    sudo systemctl enable firewalld
    sudo firewall-cmd --permanent --add-service=http
    sudo firewall-cmd --permanent --add-service=https
    sudo firewall-cmd --permanent --add-service=ssh
    sudo firewall-cmd --permanent --add-port=3000/tcp
    sudo firewall-cmd --permanent --add-port=5000/tcp
    sudo firewall-cmd --reload
fi

# Enable and start Nginx
echo "🌐 Starting Nginx..."
sudo systemctl enable nginx
sudo systemctl start nginx

echo "✅ Server setup completed successfully!"
echo "📋 Next steps:"
echo "   1. Run the deployment script: ./deploy-app.sh"
echo "   2. Configure domain and SSL if needed"
echo ""
echo "🔍 Verify installation:"
echo "   Node.js: $(node --version)"
echo "   NPM: $(npm --version)"
echo "   PM2: $(pm2 --version)"
echo "   Nginx: $(nginx -v 2>&1)"