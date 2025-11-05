# 🚀 EC2 Deployment Guide - AI Real Estate Collateral Drafting

## Quick Deployment Summary

Your application is ready to deploy to EC2 using your existing production environment. Here are the **three best deployment options**:

## Option 1: Deploy with Local Environment (Recommended) ⭐

This method uses your existing local `.env` file directly:

```bash
# From your local machine, run:
./deploy/deploy-with-local-env.sh ubuntu@your-ec2-ip
```

**What this does:**
- Copies your local `backend/.env` to the EC2 server
- Installs all dependencies automatically
- Sets up PM2 process management
- Configures Nginx reverse proxy
- Starts the application with your exact production settings

## Option 2: Manual Setup on EC2

1. **Connect to EC2:**
   ```bash
   ssh -i your-key.pem ubuntu@your-ec2-ip
   ```

2. **Copy your environment:**
   ```bash
   # On your local machine:
   scp backend/.env ubuntu@your-ec2-ip:/tmp/production.env
   ```

3. **Run deployment on EC2:**
   ```bash
   # On EC2 server:
   curl -o setup.sh https://raw.githubusercontent.com/Hamburger3110/AI-Real-Estate-Collateral-Drafting/main/deploy/setup-server.sh
   chmod +x setup.sh && sudo ./setup.sh
   
   curl -o deploy.sh https://raw.githubusercontent.com/Hamburger3110/AI-Real-Estate-Collateral-Drafting/main/deploy/deploy-app.sh
   chmod +x deploy.sh && ./deploy.sh
   
   # Copy your environment file
   cp /tmp/production.env ~/app/backend/.env
   pm2 restart all
   ```

## Option 3: Environment Variables via AWS Systems Manager

For maximum security, store your environment variables in AWS Systems Manager Parameter Store:

```bash
# Store parameters (run locally with AWS CLI configured)
aws ssm put-parameter --name "/ai-real-estate/PGHOST" --value "ai-collateral.cp4kyq4yeu8e.us-east-2.rds.amazonaws.com" --type "String"
aws ssm put-parameter --name "/ai-real-estate/PGUSER" --value "postgres" --type "String"
aws ssm put-parameter --name "/ai-real-estate/PGPASSWORD" --value "postgres" --type "SecureString"
aws ssm put-parameter --name "/ai-real-estate/PGDATABASE" --value "hackathon" --type "String"
aws ssm put-parameter --name "/ai-real-estate/JWT_SECRET" --value "your-jwt-secret" --type "SecureString"
aws ssm put-parameter --name "/ai-real-estate/AWS_ACCESS_KEY_ID" --value "your-access-key" --type "SecureString"
aws ssm put-parameter --name "/ai-real-estate/AWS_SECRET_ACCESS_KEY" --value "your-secret-key" --type "SecureString"
aws ssm put-parameter --name "/ai-real-estate/S3_BUCKET_NAME" --value "document-upload-vp/document" --type "String"
```

## EC2 Instance Requirements

### Instance Configuration
- **Type**: t3.medium or larger (for React build)
- **OS**: Ubuntu 20.04 LTS or Amazon Linux 2  
- **Storage**: 20GB minimum
- **Memory**: 4GB recommended

### Security Group
```
Port  Protocol  Source      Purpose
22    TCP       Your IP     SSH
80    TCP       0.0.0.0/0   HTTP
443   TCP       0.0.0.0/0   HTTPS (optional)
3000  TCP       0.0.0.0/0   Frontend (dev access)
5000  TCP       0.0.0.0/0   Backend API
```

## Your Production Configuration

Your application will use these settings on EC2:

- **Database**: `ai-collateral.cp4kyq4yeu8e.us-east-2.rds.amazonaws.com`
- **S3 Bucket**: `document-upload-vp/document`  
- **Region**: `us-east-2`
- **JWT Secret**: Your existing secret
- **AWS Credentials**: Your existing credentials

## Post-Deployment

After deployment, your application will be available at:

- **Frontend**: `http://your-ec2-ip` (via Nginx)
- **Backend**: `http://your-ec2-ip:5000` (direct)
- **API via Nginx**: `http://your-ec2-ip/api/*`

### Health Check
```bash
# Check if everything is running
curl http://your-ec2-ip:5000/health
curl http://your-ec2-ip
```

### Monitoring
```bash
pm2 status      # Check app status
pm2 logs        # View logs
pm2 restart all # Restart apps
```

## SSL Setup (Optional)

If you have a domain, add HTTPS:

```bash
# On EC2 server
./configure-ssl.sh your-domain.com
```

## Updates

To update your application:

```bash
# On EC2 server
./update-app.sh
```

## Troubleshooting

### Common Issues:

1. **Database connection failed**
   - Verify RDS security group allows EC2 access
   - Check if environment variables are correct

2. **File upload not working**  
   - Verify S3 bucket permissions
   - Check AWS credentials

3. **Application not starting**
   - Check PM2 logs: `pm2 logs`
   - Verify all dependencies installed: `npm install`

### Support Commands:
```bash
# View detailed logs
pm2 logs ai-real-estate-backend --lines 50

# Check Nginx status
sudo systemctl status nginx

# Test database connection
cd ~/app/backend && node test-db-connection.js

# Check available memory
free -h

# Check disk usage
df -h
```

## Security Notes

- Your `.env` file contains sensitive information and should never be committed to git
- Consider using AWS Systems Manager Parameter Store for production secrets
- Enable HTTPS for production use
- Regularly update system packages and Node.js

---

## Ready to Deploy? 🚀

**Fastest option:** Run `./deploy/deploy-with-local-env.sh ubuntu@your-ec2-ip` from your local machine!

This will copy your exact environment and deploy everything automatically.