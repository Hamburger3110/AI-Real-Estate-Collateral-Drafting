#!/bin/bash
set -e

# AI Real Estate Collateral Drafting - EC2 Setup Script
# This script automates the initial setup of the application on EC2

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please don't run this script as root"
    exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
else
    print_error "Cannot detect OS"
    exit 1
fi

print_status "Detected OS: $OS"

# Update system
print_status "Updating system packages..."
if [[ "$OS" == *"Amazon Linux"* ]]; then
    sudo yum update -y
    PACKAGE_MANAGER="yum"
elif [[ "$OS" == *"Ubuntu"* ]]; then
    sudo apt update && sudo apt upgrade -y
    PACKAGE_MANAGER="apt"
else
    print_error "Unsupported OS: $OS"
    exit 1
fi

# Install Node.js 18.x
print_status "Installing Node.js 18.x..."
if [[ "$PACKAGE_MANAGER" == "yum" ]]; then
    curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
    sudo yum install -y nodejs
elif [[ "$PACKAGE_MANAGER" == "apt" ]]; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Verify Node.js installation
node_version=$(node --version)
npm_version=$(npm --version)
print_success "Node.js $node_version and npm $npm_version installed"

# Install Git
print_status "Installing Git..."
if [[ "$PACKAGE_MANAGER" == "yum" ]]; then
    sudo yum install -y git
elif [[ "$PACKAGE_MANAGER" == "apt" ]]; then
    sudo apt install -y git
fi

# Install PM2 globally
print_status "Installing PM2..."
sudo npm install -g pm2

# Install Nginx
print_status "Installing Nginx..."
if [[ "$PACKAGE_MANAGER" == "yum" ]]; then
    sudo yum install -y nginx
elif [[ "$PACKAGE_MANAGER" == "apt" ]]; then
    sudo apt install -y nginx
fi

# Install additional tools
print_status "Installing additional tools..."
if [[ "$PACKAGE_MANAGER" == "yum" ]]; then
    sudo yum install -y htop curl wget unzip
elif [[ "$PACKAGE_MANAGER" == "apt" ]]; then
    sudo apt install -y htop curl wget unzip
fi

# Create application directory
APP_DIR="/home/$(whoami)/AI-Real-Estate-Collateral-Drafting"
print_status "Creating application directory at $APP_DIR"

# Clone repository if it doesn't exist
if [ ! -d "$APP_DIR" ]; then
    print_status "Cloning repository..."
    git clone https://github.com/Hamburger3110/AI-Real-Estate-Collateral-Drafting.git "$APP_DIR"
else
    print_warning "Repository already exists, pulling latest changes..."
    cd "$APP_DIR"
    git pull origin main
fi

# Install dependencies
print_status "Installing backend dependencies..."
cd "$APP_DIR/backend"
npm install --production

print_status "Installing frontend dependencies..."
cd "$APP_DIR/frontend"
npm install

# Build frontend
print_status "Building frontend..."
npm run build

# Create PM2 ecosystem file
print_status "Creating PM2 ecosystem configuration..."
cat > "$APP_DIR/ecosystem.config.js" << EOF
module.exports = {
  apps: [{
    name: 'ai-real-estate-backend',
    script: './backend/index.js',
    cwd: '$APP_DIR',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/var/log/pm2/ai-real-estate-backend-error.log',
    out_file: '/var/log/pm2/ai-real-estate-backend-out.log',
    log_file: '/var/log/pm2/ai-real-estate-backend.log'
  }]
};
EOF

# Create log directories
print_status "Creating log directories..."
sudo mkdir -p /var/log/pm2
sudo chown $(whoami):$(whoami) /var/log/pm2

# Create sample environment file
print_status "Creating sample environment file..."
cat > "$APP_DIR/backend/.env.example" << EOF
# Database Configuration
PGHOST=your-rds-endpoint.region.rds.amazonaws.com
PGPORT=5432
PGDATABASE=your-database-name
PGUSER=your-db-username
PGPASSWORD=your-db-password

# AWS Configuration
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=your-s3-bucket-name

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key-here

# Server Configuration
NODE_ENV=production
PORT=3001
EOF

# Create Nginx configuration
print_status "Creating Nginx configuration..."
sudo tee /etc/nginx/conf.d/ai-real-estate.conf > /dev/null << EOF
server {
    listen 80;
    server_name _;  # Replace with your domain
    
    # Frontend (React build)
    location / {
        root $APP_DIR/frontend/build;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001/;
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
    
    # Direct backend access
    location ~* ^/(auth|contracts|documents|upload|extracted_fields|approvals|migrations|activity_logs) {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Test Nginx configuration
print_status "Testing Nginx configuration..."
sudo nginx -t

# Create deployment script
print_status "Creating deployment script..."
cat > "$APP_DIR/deploy.sh" << 'EOF'
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Navigate to project directory
APP_DIR="/home/$(whoami)/AI-Real-Estate-Collateral-Drafting"
cd "$APP_DIR"

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install --production

# Build frontend
echo "🏗️ Building frontend..."
cd ../frontend
npm install
npm run build

# Restart backend
echo "🔄 Restarting backend..."
pm2 restart ai-real-estate-backend

# Reload Nginx
echo "🔄 Reloading Nginx..."
sudo systemctl reload nginx

echo "✅ Deployment completed successfully!"
echo "🌐 Application is available at: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
EOF

chmod +x "$APP_DIR/deploy.sh"

# Setup firewall
print_status "Configuring firewall..."
if [[ "$PACKAGE_MANAGER" == "yum" ]]; then
    # Amazon Linux (firewalld)
    if command -v firewall-cmd &> /dev/null; then
        sudo systemctl start firewalld
        sudo systemctl enable firewalld
        sudo firewall-cmd --permanent --add-service=http
        sudo firewall-cmd --permanent --add-service=https
        sudo firewall-cmd --permanent --add-port=3001/tcp
        sudo firewall-cmd --reload
        print_success "Firewalld configured"
    else
        print_warning "Firewalld not available, using iptables"
        # Basic iptables rules
        sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
        sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
        sudo iptables -A INPUT -p tcp --dport 3001 -j ACCEPT
    fi
elif [[ "$PACKAGE_MANAGER" == "apt" ]]; then
    # Ubuntu (ufw)
    sudo ufw --force enable
    sudo ufw allow 'Nginx Full'
    sudo ufw allow ssh
    sudo ufw allow 3001
    print_success "UFW configured"
fi

# Enable and start services
print_status "Starting services..."
sudo systemctl enable nginx
sudo systemctl start nginx

print_success "✅ Setup completed successfully!"
print_warning "⚠️  IMPORTANT NEXT STEPS:"
echo ""
echo "1. Configure your environment variables:"
echo "   cp $APP_DIR/backend/.env.example $APP_DIR/backend/.env"
echo "   nano $APP_DIR/backend/.env"
echo ""
echo "2. Setup your RDS PostgreSQL database and update the .env file"
echo ""
echo "3. Create and configure your S3 bucket for file uploads"
echo ""
echo "4. Initialize the database:"
echo "   cd $APP_DIR/backend"
echo "   node -e \"const { createTables, runMigrations, seedDemoUsers } = require('./db'); async function init() { await createTables(); await runMigrations(); await seedDemoUsers(); console.log('Database initialized'); process.exit(0); } init();\""
echo ""
echo "5. Start the application:"
echo "   cd $APP_DIR"
echo "   pm2 start ecosystem.config.js"
echo "   pm2 save"
echo "   pm2 startup"
echo ""
echo "6. Test your application:"
echo "   Public IP: $(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo 'Unable to get public IP')"
echo "   URL: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo 'your-server-ip')"
echo ""
echo "7. Optional: Setup SSL certificate with Let's Encrypt (if you have a domain)"
echo ""
print_success "Setup script completed! Follow the steps above to complete deployment."