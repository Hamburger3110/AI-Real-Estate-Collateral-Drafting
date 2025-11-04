# AI Real Estate Collateral Drafting - EC2 Deployment Guide

## Overview
This guide will help you deploy the AI Real Estate Collateral Drafting application to AWS EC2 with proper production configurations.

## Architecture
- **Frontend**: React app served by Nginx
- **Backend**: Node.js API server with PM2 process manager
- **Database**: AWS RDS PostgreSQL
- **Storage**: AWS S3 for document uploads
- **SSL**: Let's Encrypt certificate
- **Domain**: Custom domain with Route 53

## Prerequisites
- AWS Account with appropriate permissions
- Domain name configured in Route 53 (optional but recommended)
- AWS CLI configured locally

## Step 1: Launch EC2 Instance

### Instance Configuration
- **AMI**: Amazon Linux 2 or Ubuntu 20.04 LTS
- **Instance Type**: t3.medium (minimum) or t3.large (recommended)
- **Storage**: 20GB gp3 root volume
- **Security Group**: Allow HTTP (80), HTTPS (443), SSH (22), and Custom (3001 for API)

### Security Group Rules
```
Type            Protocol    Port Range    Source
SSH             TCP         22            Your IP/0.0.0.0/0
HTTP            TCP         80            0.0.0.0/0
HTTPS           TCP         443           0.0.0.0/0
Custom TCP      TCP         3001          0.0.0.0/0
```

## Step 2: Connect to EC2 and Setup Environment

```bash
# Connect to your EC2 instance
ssh -i your-key.pem ec2-user@your-ec2-ip

# Update system
sudo yum update -y  # For Amazon Linux
# OR
sudo apt update && sudo apt upgrade -y  # For Ubuntu

# Install Node.js (18.x recommended)
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs  # For Amazon Linux
# OR
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs  # For Ubuntu

# Install Git
sudo yum install -y git  # For Amazon Linux
# OR
sudo apt install -y git  # For Ubuntu

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo yum install -y nginx  # For Amazon Linux
# OR
sudo apt install -y nginx  # For Ubuntu
```

## Step 3: Clone and Setup Application

```bash
# Clone the repository
cd /home/ec2-user  # or /home/ubuntu for Ubuntu
git clone https://github.com/Hamburger3110/AI-Real-Estate-Collateral-Drafting.git
cd AI-Real-Estate-Collateral-Drafting

# Setup backend
cd backend
npm install --production

# Setup frontend
cd ../frontend
npm install
npm run build
```

## Step 4: Environment Configuration

Create production environment files:

### Backend Environment (.env)
```bash
cd /home/ec2-user/AI-Real-Estate-Collateral-Drafting/backend
sudo nano .env
```

Add the following content:
```env
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
```

## Step 5: Database Setup (RDS PostgreSQL)

### Create RDS Instance
1. Go to AWS RDS Console
2. Create PostgreSQL database
3. Configure security group to allow connections from EC2
4. Note the endpoint and credentials

### Initialize Database
```bash
cd /home/ec2-user/AI-Real-Estate-Collateral-Drafting/backend
node -e "
const { createTables, runMigrations, seedDemoUsers } = require('./db');
async function init() {
  await createTables();
  await runMigrations();
  await seedDemoUsers();
  console.log('Database initialized successfully');
  process.exit(0);
}
init();
"
```

## Step 6: S3 Bucket Setup

### Create S3 Bucket
```bash
aws s3 mb s3://your-app-documents-bucket
```

### Configure CORS
```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": []
    }
]
```

## Step 7: PM2 Configuration

Create PM2 ecosystem file:
```bash
cd /home/ec2-user/AI-Real-Estate-Collateral-Drafting
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'ai-real-estate-backend',
    script: './backend/index.js',
    cwd: '/home/ec2-user/AI-Real-Estate-Collateral-Drafting',
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
```

## Step 8: Nginx Configuration

### Create Nginx config
```bash
sudo nano /etc/nginx/conf.d/ai-real-estate.conf
```

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;  # Replace with your domain
    
    # Frontend (React build)
    location / {
        root /home/ec2-user/AI-Real-Estate-Collateral-Drafting/frontend/build;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
        
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
    
    # Direct backend access (temporary for development)
    location ~* ^/(auth|contracts|documents|upload|extracted_fields|approvals|migrations|activity_logs) {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Step 9: SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo yum install -y certbot python3-certbot-nginx  # Amazon Linux
# OR
sudo apt install -y certbot python3-certbot-nginx  # Ubuntu

# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Verify auto-renewal
sudo certbot renew --dry-run
```

## Step 10: Deploy and Start Services

```bash
# Create log directories
sudo mkdir -p /var/log/pm2
sudo chown ec2-user:ec2-user /var/log/pm2  # or ubuntu:ubuntu for Ubuntu

# Start backend with PM2
cd /home/ec2-user/AI-Real-Estate-Collateral-Drafting
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Test Nginx configuration
sudo nginx -t
sudo systemctl reload nginx
```

## Step 11: Firewall Configuration

```bash
# For Amazon Linux (firewalld)
sudo systemctl start firewalld
sudo systemctl enable firewalld
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --reload

# For Ubuntu (ufw)
sudo ufw enable
sudo ufw allow 'Nginx Full'
sudo ufw allow ssh
sudo ufw allow 3001
```

## Step 12: Monitoring and Maintenance

### PM2 Monitoring
```bash
# Check application status
pm2 status
pm2 logs
pm2 monit

# Restart application
pm2 restart ai-real-estate-backend

# Update application
cd /home/ec2-user/AI-Real-Estate-Collateral-Drafting
git pull
cd frontend && npm run build
cd ../backend && npm install --production
pm2 restart ai-real-estate-backend
```

### System Monitoring
```bash
# Check system resources
htop
df -h
free -h

# Check Nginx
sudo systemctl status nginx
sudo nginx -t

# Check logs
sudo tail -f /var/log/nginx/error.log
pm2 logs ai-real-estate-backend
```

## Step 13: Auto-Deployment Script

Create a deployment script:
```bash
nano /home/ec2-user/deploy.sh
chmod +x /home/ec2-user/deploy.sh
```

```bash
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Navigate to project directory
cd /home/ec2-user/AI-Real-Estate-Collateral-Drafting

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
echo "🌐 Application is available at: https://your-domain.com"
```

## Troubleshooting

### Common Issues

1. **Port 3001 not accessible**
   - Check security group settings
   - Verify PM2 is running: `pm2 status`
   - Check firewall: `sudo firewall-cmd --list-all`

2. **Database connection failed**
   - Verify RDS security group allows EC2 connections
   - Check environment variables in `.env`
   - Test connection: `psql -h your-rds-endpoint -U username -d database`

3. **File upload not working**
   - Verify S3 bucket permissions
   - Check AWS credentials in `.env`
   - Verify CORS configuration on S3

4. **Nginx serving 404**
   - Check file permissions: `ls -la /home/ec2-user/AI-Real-Estate-Collateral-Drafting/frontend/build`
   - Verify Nginx configuration: `sudo nginx -t`
   - Check Nginx error logs: `sudo tail -f /var/log/nginx/error.log`

### Useful Commands
```bash
# Check all running services
sudo systemctl status nginx
pm2 status
sudo systemctl status firewalld

# Monitor logs in real-time
pm2 logs --lines 100
sudo tail -f /var/log/nginx/access.log

# Test API endpoints
curl -X GET https://your-domain.com/api/health
curl -X POST https://your-domain.com/auth/login -H "Content-Type: application/json" -d '{"email":"admin@vpbank.com","password":"password123"}'
```

## Security Considerations

1. **Environment Variables**: Never commit `.env` files to git
2. **Database**: Use strong passwords and restrict access
3. **S3**: Configure proper bucket policies and CORS
4. **SSL**: Always use HTTPS in production
5. **Firewall**: Only open necessary ports
6. **Updates**: Regularly update system packages and Node.js
7. **Backup**: Setup automated database and S3 backups

## Performance Optimization

1. **PM2 Clustering**: Increase instances in ecosystem.config.js
2. **Nginx Caching**: Add caching headers for static assets
3. **Database**: Setup read replicas for high traffic
4. **CDN**: Use CloudFront for static asset delivery
5. **Monitoring**: Setup CloudWatch alarms

Your application should now be successfully deployed and accessible via your domain name!