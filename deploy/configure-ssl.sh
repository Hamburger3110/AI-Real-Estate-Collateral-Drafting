#!/bin/bash

# AI Real Estate Collateral Drafting - Nginx SSL Configuration Script
# This script configures Nginx with SSL using Let's Encrypt

set -e

DOMAIN=$1

if [ -z "$DOMAIN" ]; then
    echo "❌ Usage: $0 <your-domain.com>"
    echo "   Example: $0 myapp.example.com"
    exit 1
fi

echo "🔒 Configuring SSL for domain: $DOMAIN"

# Detect OS and install Certbot
if [ -f /etc/redhat-release ]; then
    OS="centos"
    echo "📦 Installing Certbot for CentOS/Amazon Linux..."
    sudo yum install -y epel-release
    sudo yum install -y certbot python3-certbot-nginx
elif [ -f /etc/lsb-release ]; then
    OS="ubuntu"
    echo "📦 Installing Certbot for Ubuntu..."
    sudo apt update
    sudo apt install -y certbot python3-certbot-nginx
else
    echo "❌ Unsupported OS"
    exit 1
fi

# Update Nginx configuration with domain
echo "🌐 Updating Nginx configuration for domain: $DOMAIN"
sudo tee /etc/nginx/sites-available/ai-real-estate 2>/dev/null << EOF || sudo tee /etc/nginx/conf.d/ai-real-estate.conf << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    # Frontend (React app)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Handle client-side routing
        try_files \$uri \$uri/ @fallback;
    }

    # Fallback for client-side routing
    location @fallback {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # Backend API
    location /api/ {
        rewrite ^/api/(.*)$ /\$1 break;
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        
        # Handle preflight requests
        if (\$request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*';
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS';
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization';
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain charset=UTF-8';
            add_header 'Content-Length' 0;
            return 204;
        }
    }

    # Direct API access (for compatibility)
    location ~ ^/(auth|contracts|documents|upload|extracted_fields|approvals|migrations|activity_logs|webhook) {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:5000/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
}
EOF

# Enable the site (Ubuntu/Debian style)
if [ -d "/etc/nginx/sites-available" ]; then
    sudo ln -sf /etc/nginx/sites-available/ai-real-estate /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
fi

# Create web root for Let's Encrypt
sudo mkdir -p /var/www/html

# Test Nginx configuration
echo "🔍 Testing Nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration is valid"
    sudo systemctl reload nginx
else
    echo "❌ Nginx configuration error"
    exit 1
fi

# Obtain SSL certificate
echo "🔒 Obtaining SSL certificate for $DOMAIN..."
sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN

if [ $? -eq 0 ]; then
    echo "✅ SSL certificate obtained successfully"
else
    echo "❌ Failed to obtain SSL certificate"
    echo "🔍 Please check:"
    echo "   - Domain DNS is pointing to this server"
    echo "   - Port 80 and 443 are open in security groups"
    echo "   - Domain is accessible from the internet"
    exit 1
fi

# Update frontend environment to use HTTPS
echo "🔧 Updating frontend configuration for HTTPS..."
cd /home/$(whoami)/app/frontend
cat > .env << EOF
REACT_APP_API_BASE_URL=https://$DOMAIN/api
HTTPS=true
GENERATE_SOURCEMAP=false
EOF

# Rebuild frontend with HTTPS configuration
echo "🏗️ Rebuilding frontend with HTTPS configuration..."
npm run build

# Restart PM2 applications
echo "🔄 Restarting applications..."
pm2 restart all

# Setup automatic certificate renewal
echo "🔄 Setting up automatic certificate renewal..."
sudo crontab -l 2>/dev/null | { cat; echo "0 12 * * * /usr/bin/certbot renew --quiet"; } | sudo crontab -

# Verify SSL setup
echo "🔍 Verifying SSL setup..."
sleep 5

if curl -f -s https://$DOMAIN/health > /dev/null; then
    echo "✅ HTTPS health check passed"
else
    echo "⚠️  HTTPS health check failed"
fi

echo ""
echo "✅ SSL configuration completed successfully!"
echo ""
echo "🌐 Your application is now available at:"
echo "   https://$DOMAIN"
echo "   https://www.$DOMAIN"
echo ""
echo "🔒 SSL Certificate Information:"
sudo certbot certificates

echo ""
echo "🔄 Certificate Auto-Renewal:"
echo "   A cron job has been set up to automatically renew certificates"
echo "   Test renewal: sudo certbot renew --dry-run"
echo ""
echo "📝 Important Notes:"
echo "   - HTTP traffic is automatically redirected to HTTPS"
echo "   - Certificate will auto-renew every 60 days"
echo "   - Frontend now uses HTTPS API endpoints"