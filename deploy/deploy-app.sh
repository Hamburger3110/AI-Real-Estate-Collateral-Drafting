#!/bin/bash

# AI Real Estate Collateral Drafting - Application Deployment Script
# This script deploys the application using existing production environment

set -e

# Configuration - using existing production settings
REPO_URL="https://github.com/Hamburger3110/AI-Real-Estate-Collateral-Drafting.git"
APP_DIR="/home/$(whoami)/app"
BACKEND_PORT=5000
FRONTEND_PORT=3000

echo "🚀 Deploying AI Real Estate Collateral Drafting application..."

# Detect user
if [ "$(whoami)" = "ec2-user" ]; then
    USER="ec2-user"
elif [ "$(whoami)" = "ubuntu" ]; then
    USER="ubuntu"
else
    USER="$(whoami)"
fi

echo "👤 Deploying for user: $USER"

# Create app directory if it doesn't exist
mkdir -p $APP_DIR
cd $APP_DIR

# Clone or update repository
if [ -d ".git" ]; then
    echo "📥 Updating existing repository..."
    git pull origin main
else
    echo "📥 Cloning repository..."
    git clone $REPO_URL .
fi

# Setup Backend
echo "🔧 Setting up backend..."
cd $APP_DIR/backend

# Install backend dependencies
npm install --production

# Create production environment file using existing settings
echo "📝 Creating production environment configuration..."

# Copy the existing .env file from backend if it exists, otherwise create new one
if [ -f "$APP_DIR/../backend/.env" ]; then
    echo "📋 Using existing backend .env configuration..."
    cp "$APP_DIR/../backend/.env" .env
    # Ensure production settings
    echo "" >> .env
    echo "# Server Configuration" >> .env
    echo "NODE_ENV=production" >> .env
    echo "PORT=5000" >> .env
else
    echo "📝 Creating new production environment file..."
    cat > .env << 'EOF'
# Database Configuration (Production RDS)
PGUSER=postgres
PGPASSWORD=postgres
PGHOST=ai-collateral.cp4kyq4yeu8e.us-east-2.rds.amazonaws.com
PGDATABASE=hackathon
PGPORT=5432

# JWT Configuration
JWT_SECRET=vpbank_real_estate_jwt_secret_2024

# AWS S3 Configuration (Production) - Replace with your actual credentials
AWS_REGION=us-east-2
S3_BUCKET_NAME=document-upload-vp/document
AWS_ACCESS_KEY_ID=your-aws-access-key-here
AWS_SECRET_ACCESS_KEY=your-aws-secret-key-here

# Server Configuration
NODE_ENV=production
PORT=5000
EOF
    
    echo "⚠️  Please update the AWS credentials in .env file:"
    echo "   AWS_ACCESS_KEY_ID=your-actual-access-key"
    echo "   AWS_SECRET_ACCESS_KEY=your-actual-secret-key"
fi

# Set proper permissions for env file
chmod 600 .env

# Test database connection
echo "🔍 Testing database connection..."
if node -e "
const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  password: 'postgres',
  host: 'ai-collateral.cp4kyq4yeu8e.us-east-2.rds.amazonaws.com',
  database: 'hackathon',
  port: 5432,
});
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  } else {
    console.log('✅ Database connection successful');
    process.exit(0);
  }
});
"; then
    echo "✅ Database connection verified"
else
    echo "❌ Database connection failed. Please check your RDS configuration."
    exit 1
fi

# Setup Frontend
echo "🔧 Setting up frontend..."
cd $APP_DIR/frontend

# Install frontend dependencies
npm install

# Create production environment for frontend
cat > .env << 'EOF'
REACT_APP_API_BASE_URL=http://localhost:5000
GENERATE_SOURCEMAP=false
EOF

# Build frontend for production
echo "🏗️ Building frontend for production..."
npm run build

# Create PM2 ecosystem configuration
echo "📝 Creating PM2 configuration..."
cd $APP_DIR
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'ai-real-estate-backend',
      script: './backend/index.js',
      cwd: '/home/USER_PLACEHOLDER/app',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    },
    {
      name: 'ai-real-estate-frontend',
      script: 'serve',
      args: '-s build -l 3000',
      cwd: '/home/USER_PLACEHOLDER/app/frontend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
EOF

# Replace USER_PLACEHOLDER with actual user
sed -i "s/USER_PLACEHOLDER/$USER/g" ecosystem.config.js

# Install serve globally for frontend
sudo npm install -g serve

# Stop existing PM2 processes if any
pm2 delete all 2>/dev/null || true

# Start applications with PM2
echo "🚀 Starting applications with PM2..."
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
echo "🔧 Setting up PM2 startup script..."
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp /home/$USER

# Create Nginx configuration
echo "🌐 Configuring Nginx..."
sudo tee /etc/nginx/sites-available/ai-real-estate 2>/dev/null << 'EOF' || sudo tee /etc/nginx/conf.d/ai-real-estate.conf << 'EOF'
server {
    listen 80;
    server_name _;

    # Frontend (React app)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Handle client-side routing
        try_files $uri $uri/ @fallback;
    }

    # Fallback for client-side routing
    location @fallback {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        rewrite ^/api/(.*)$ /$1 break;
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        
        # Handle preflight requests
        if ($request_method = 'OPTIONS') {
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
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:5000/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
EOF

# Enable the site (Ubuntu/Debian style)
if [ -d "/etc/nginx/sites-available" ]; then
    sudo ln -sf /etc/nginx/sites-available/ai-real-estate /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
fi

# Test and reload Nginx
echo "🔍 Testing Nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration is valid"
    sudo systemctl reload nginx
else
    echo "❌ Nginx configuration error"
    exit 1
fi

# Display deployment status
echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "📊 Application Status:"
pm2 status

echo ""
echo "🌐 Application URLs:"
echo "   Frontend: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):80"
echo "   Backend:  http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):5000"
echo "   Via Nginx: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
echo ""
echo "🔍 Monitoring Commands:"
echo "   pm2 status          # Check application status"
echo "   pm2 logs            # View application logs"
echo "   pm2 restart all     # Restart all applications"
echo "   sudo systemctl status nginx  # Check Nginx status"
echo ""
echo "📝 Important Notes:"
echo "   - Database: Connected to existing RDS instance"
echo "   - Storage: Using existing S3 bucket"
echo "   - Environment: Production configuration applied"
echo "   - PM2 startup script configured for auto-start"

# Final health check
echo ""
echo "🏥 Performing health check..."
sleep 10

# Check if backend is responding
if curl -f -s http://localhost:5000/health > /dev/null; then
    echo "✅ Backend health check passed"
else
    echo "⚠️  Backend health check failed - checking logs..."
    pm2 logs ai-real-estate-backend --lines 10
fi

# Check if frontend is responding
if curl -f -s http://localhost:3000 > /dev/null; then
    echo "✅ Frontend health check passed"
else
    echo "⚠️  Frontend health check failed - checking logs..."
    pm2 logs ai-real-estate-frontend --lines 10
fi

echo ""
echo "🎉 Deployment process completed!"
echo "🌐 Your application should be accessible at: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"