#!/bin/bash
set -e

# SSL Certificate Setup Script for Let's Encrypt
# This script sets up SSL certificates for your domain

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if domain is provided
if [ -z "$1" ]; then
    print_error "Usage: $0 <domain-name> [www.domain-name]"
    print_error "Example: $0 example.com www.example.com"
    exit 1
fi

DOMAIN=$1
WWW_DOMAIN=${2:-www.$1}

print_status "Setting up SSL certificate for $DOMAIN and $WWW_DOMAIN"

# Detect OS and install Certbot
print_status "Installing Certbot..."
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
else
    print_error "Cannot detect OS"
    exit 1
fi

if [[ "$OS" == *"Amazon Linux"* ]]; then
    # Amazon Linux 2
    sudo yum update -y
    sudo yum install -y certbot python3-certbot-nginx
elif [[ "$OS" == *"Ubuntu"* ]]; then
    # Ubuntu
    sudo apt update
    sudo apt install -y certbot python3-certbot-nginx
else
    print_error "Unsupported OS: $OS"
    exit 1
fi

# Update Nginx configuration with domain
print_status "Updating Nginx configuration with domain..."
sudo sed -i "s/server_name _;/server_name $DOMAIN $WWW_DOMAIN;/" /etc/nginx/conf.d/ai-real-estate.conf

# Test Nginx configuration
print_status "Testing Nginx configuration..."
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Check if domain resolves to this server
print_status "Checking DNS resolution..."
SERVER_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
DOMAIN_IP=$(dig +short $DOMAIN | tail -n1)

if [ "$SERVER_IP" != "$DOMAIN_IP" ]; then
    print_warning "DNS Warning: Domain $DOMAIN resolves to $DOMAIN_IP but server IP is $SERVER_IP"
    print_warning "Make sure your domain's A record points to $SERVER_IP"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Aborted. Please update your DNS records first."
        exit 1
    fi
fi

# Get SSL certificate
print_status "Obtaining SSL certificate from Let's Encrypt..."
sudo certbot --nginx -d $DOMAIN -d $WWW_DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN

# Verify certificate installation
print_status "Verifying SSL certificate..."
if sudo certbot certificates | grep -q "$DOMAIN"; then
    print_success "SSL certificate installed successfully!"
else
    print_error "SSL certificate installation failed"
    exit 1
fi

# Setup auto-renewal
print_status "Setting up automatic certificate renewal..."
# Test renewal
sudo certbot renew --dry-run

# Add cron job for auto-renewal (if not already exists)
if ! sudo crontab -l 2>/dev/null | grep -q "certbot renew"; then
    (sudo crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | sudo crontab -
    print_success "Auto-renewal cron job added"
else
    print_success "Auto-renewal cron job already exists"
fi

# Update Nginx configuration for better SSL settings
print_status "Optimizing SSL configuration..."
sudo tee -a /etc/nginx/conf.d/ssl-params.conf > /dev/null << 'EOF'
# SSL Configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers on;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;
ssl_ecdh_curve secp384r1;
ssl_session_timeout 10m;
ssl_session_cache shared:SSL:10m;
ssl_session_tickets off;
ssl_stapling on;
ssl_stapling_verify on;

# Security headers
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
add_header X-Frame-Options DENY;
add_header X-Content-Type-Options nosniff;
add_header X-XSS-Protection "1; mode=block";
EOF

# Test final configuration
print_status "Testing final Nginx configuration..."
sudo nginx -t
sudo systemctl reload nginx

print_success "✅ SSL setup completed successfully!"
print_success "🔒 Your site is now available at:"
print_success "   https://$DOMAIN"
print_success "   https://$WWW_DOMAIN"
echo ""
print_status "SSL Certificate Details:"
sudo certbot certificates | grep -A 10 "$DOMAIN"
echo ""
print_status "Auto-renewal test (should show success):"
sudo certbot renew --dry-run
echo ""
print_success "🎉 Your application is now secured with SSL!"