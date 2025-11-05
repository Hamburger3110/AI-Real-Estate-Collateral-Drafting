#!/bin/bash

# AI Real Estate Collateral Drafting - Deploy with Local Environment
# This script copies your local .env to the production server

set -e

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <ec2-user@your-ec2-ip>"
    echo "Example: $0 ubuntu@54.123.456.789"
    exit 1
fi

SERVER=$1

echo "🚀 Deploying with your local environment configuration to $SERVER"

# Check if local .env exists
if [ ! -f "../backend/.env" ]; then
    echo "❌ Local .env file not found at ../backend/.env"
    echo "   Please ensure you're running this from the deploy directory"
    exit 1
fi

echo "📋 Found local .env file"

# Copy local .env to server
echo "📤 Copying local .env to server..."
scp ../backend/.env $SERVER:/tmp/production.env

# Run deployment with the copied environment
echo "🚀 Running deployment on server..."
ssh $SERVER << 'ENDSSH'
# Update system and install dependencies if needed
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js and dependencies..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    sudo npm install -g pm2
    sudo apt install -y nginx git
fi

# Create app directory
mkdir -p ~/app
cd ~/app

# Clone or update repository
if [ -d ".git" ]; then
    echo "📥 Updating repository..."
    git pull origin main
else
    echo "📥 Cloning repository..."
    git clone https://github.com/Hamburger3110/AI-Real-Estate-Collateral-Drafting.git .
fi

# Setup backend with local environment
echo "🔧 Setting up backend..."
cd backend
npm install --production

# Use the copied environment file
cp /tmp/production.env .env
chmod 600 .env

# Test database connection
echo "🔍 Testing database connection..."
node -e "
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool();
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  } else {
    console.log('✅ Database connection successful');
    process.exit(0);
  }
});
"

# Setup frontend
echo "🔧 Setting up frontend..."
cd ../frontend
npm install

# Create frontend environment
cat > .env << 'EOF'
REACT_APP_API_BASE_URL=http://localhost:5000
GENERATE_SOURCEMAP=false
EOF

# Build frontend
echo "🏗️ Building frontend..."
npm run build

# Install serve for frontend
sudo npm install -g serve

# Create PM2 config
cd ..
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'ai-real-estate-backend',
      script: './backend/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    },
    {
      name: 'ai-real-estate-frontend',
      script: 'serve',
      args: '-s build -l 3000',
      cwd: process.cwd() + '/frontend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M'
    }
  ]
};
EOF

# Stop existing processes
pm2 delete all 2>/dev/null || true

# Start applications
echo "🚀 Starting applications..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup | grep -E '^sudo' | bash || true

# Configure Nginx
echo "🌐 Configuring Nginx..."
sudo tee /etc/nginx/sites-available/ai-real-estate << 'NGINX_EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/ {
        rewrite ^/api/(.*)$ /$1 break;
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
    }

    location ~ ^/(auth|contracts|documents|upload|extracted_fields|approvals|migrations|activity_logs|webhook) {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
    }
}
NGINX_EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/ai-real-estate /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
sudo nginx -t && sudo systemctl reload nginx

echo "✅ Deployment completed!"
echo "📊 Application status:"
pm2 status

ENDSSH

echo ""
echo "✅ Deployment completed successfully!"
echo "🌐 Your application should be available at: http://$SERVER"