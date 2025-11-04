# EC2 Deployment Scripts

This directory contains all the scripts needed to deploy the AI Real Estate Collateral Drafting application to AWS EC2 using your existing production environment configuration.

## Quick Start

For the fastest deployment, use the one-command deployment:

```bash
curl -o quick-deploy.sh https://raw.githubusercontent.com/Hamburger3110/AI-Real-Estate-Collateral-Drafting/main/deploy/quick-deploy.sh
chmod +x quick-deploy.sh
./quick-deploy.sh
```

## Scripts Overview

### 1. `quick-deploy.sh` - One-Command Deployment
- **Purpose**: Complete deployment in a single command
- **Usage**: `./quick-deploy.sh`
- **What it does**: 
  - Runs server setup
  - Deploys the application
  - Optionally configures SSL
  - Shows final status and URLs

### 2. `setup-server.sh` - Server Setup
- **Purpose**: Install all required dependencies on EC2
- **Usage**: `./setup-server.sh`
- **Installs**:
  - Node.js 18.x
  - PM2 process manager
  - Nginx web server
  - PostgreSQL client
  - Git and build tools

### 3. `deploy-app.sh` - Application Deployment
- **Purpose**: Deploy the application with production configuration
- **Usage**: `./deploy-app.sh`
- **What it does**:
  - Clones/updates the repository
  - Installs dependencies
  - Creates production `.env` file with your existing settings
  - Builds frontend for production
  - Configures PM2 for process management
  - Sets up Nginx reverse proxy
  - Runs health checks

### 4. `configure-ssl.sh` - SSL Configuration
- **Purpose**: Add HTTPS support with Let's Encrypt
- **Usage**: `./configure-ssl.sh your-domain.com`
- **What it does**:
  - Installs Certbot
  - Obtains SSL certificate
  - Updates Nginx for HTTPS
  - Sets up auto-renewal
  - Updates frontend to use HTTPS APIs

### 5. `update-app.sh` - Application Updates
- **Purpose**: Update the application with latest code
- **Usage**: `./update-app.sh`
- **What it does**:
  - Pulls latest code from repository
  - Updates dependencies
  - Rebuilds frontend
  - Restarts applications
  - Runs health checks

## Environment Configuration

All scripts use your existing production environment:

```env
# Database (Your existing RDS)
PGHOST=ai-collateral.cp4kyq4yeu8e.us-east-2.rds.amazonaws.com
PGDATABASE=hackathon
PGUSER=postgres
PGPASSWORD=postgres

# AWS S3 (Your existing bucket)
AWS_REGION=us-east-2
S3_BUCKET_NAME=document-upload-vp/document
AWS_ACCESS_KEY_ID=your-existing-access-key-id
AWS_SECRET_ACCESS_KEY=your-existing-secret-access-key

# JWT Secret
JWT_SECRET=vpbank_real_estate_jwt_secret_2024
```

## EC2 Requirements

### Instance Specifications
- **Type**: t3.medium or larger (for React build process)
- **OS**: Ubuntu 20.04 LTS or Amazon Linux 2
- **Storage**: 20GB minimum
- **Memory**: 4GB recommended

### Security Group Settings
```
Port  Protocol  Source      Purpose
22    TCP       Your IP     SSH access
80    HTTP      0.0.0.0/0   HTTP traffic
443   HTTPS     0.0.0.0/0   HTTPS traffic
3000  TCP       0.0.0.0/0   Frontend (development)
5000  TCP       0.0.0.0/0   Backend API
```

## Step-by-Step Deployment

### Option 1: Quick Deploy (Recommended)
```bash
# Connect to your EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Download and run quick deploy
curl -o quick-deploy.sh https://raw.githubusercontent.com/Hamburger3110/AI-Real-Estate-Collateral-Drafting/main/deploy/quick-deploy.sh
chmod +x quick-deploy.sh
./quick-deploy.sh
```

### Option 2: Manual Step-by-Step
```bash
# 1. Setup server
curl -o setup-server.sh https://raw.githubusercontent.com/Hamburger3110/AI-Real-Estate-Collateral-Drafting/main/deploy/setup-server.sh
chmod +x setup-server.sh
sudo ./setup-server.sh

# 2. Deploy application
curl -o deploy-app.sh https://raw.githubusercontent.com/Hamburger3110/AI-Real-Estate-Collateral-Drafting/main/deploy/deploy-app.sh
chmod +x deploy-app.sh
./deploy-app.sh

# 3. Configure SSL (optional)
curl -o configure-ssl.sh https://raw.githubusercontent.com/Hamburger3110/AI-Real-Estate-Collateral-Drafting/main/deploy/configure-ssl.sh
chmod +x configure-ssl.sh
./configure-ssl.sh your-domain.com
```

## After Deployment

### Application URLs
- **Frontend**: `http://your-ec2-ip` (via Nginx)
- **Backend**: `http://your-ec2-ip:5000` (direct access)
- **API via Nginx**: `http://your-ec2-ip/api/*`

### Monitoring Commands
```bash
# Check application status
pm2 status

# View logs
pm2 logs

# Restart applications
pm2 restart all

# Check Nginx
sudo systemctl status nginx
sudo nginx -t

# Update application
./update-app.sh
```

### Health Check
```bash
# Backend health
curl http://your-ec2-ip:5000/health

# Frontend via Nginx
curl http://your-ec2-ip

# API via Nginx
curl http://your-ec2-ip/api/health
```

## Troubleshooting

### Common Issues

1. **Database connection failed**
   - Verify RDS security group allows EC2 access
   - Check environment variables

2. **File upload not working**
   - Verify S3 bucket permissions
   - Check AWS credentials

3. **Nginx 502 error**
   - Check if PM2 applications are running: `pm2 status`
   - Check PM2 logs: `pm2 logs`

4. **SSL certificate failed**
   - Ensure domain points to EC2 IP
   - Check ports 80 and 443 are open

### Logs Locations
- PM2 logs: `pm2 logs`
- Nginx logs: `/var/log/nginx/error.log`
- System logs: `/var/log/syslog`

## Maintenance

### Regular Updates
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update application
./update-app.sh

# Restart services if needed
pm2 restart all
sudo systemctl restart nginx
```

### SSL Certificate Renewal
SSL certificates automatically renew via cron job. To test:
```bash
sudo certbot renew --dry-run
```

## Support

If you encounter issues:

1. Check the deployment guide: `ec2-deployment-guide.md`
2. Review application logs: `pm2 logs`
3. Verify configuration: Environment variables in `/home/ubuntu/app/backend/.env`
4. Test database connection: `cd /home/ubuntu/app/backend && node test-db-connection.js`