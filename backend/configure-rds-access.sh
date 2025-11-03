#!/bin/bash

echo "🔧 AWS RDS Security Group Configuration Tool"
echo "============================================"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed or not in PATH"
    echo "Please install AWS CLI and configure your credentials first."
    exit 1
fi

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI is not configured or credentials are invalid"
    echo "Please run 'aws configure' to set up your credentials."
    exit 1
fi

echo "✅ AWS CLI is configured"
echo ""

# Get your current public IP
YOUR_IP=$(curl -s ifconfig.me)
echo "🌐 Your current public IP: $YOUR_IP"
echo ""

# Get the RDS instance security group
echo "🔍 Finding security group for RDS instance 'ai-collateral'..."
SECURITY_GROUP_ID=$(aws rds describe-db-instances \
  --db-instance-identifier ai-collateral \
  --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' \
  --output text 2>/dev/null)

if [ $? -ne 0 ] || [ -z "$SECURITY_GROUP_ID" ] || [ "$SECURITY_GROUP_ID" = "None" ]; then
    echo "❌ Could not find RDS instance 'ai-collateral' or retrieve security group ID"
    echo "Please check:"
    echo "  1. The RDS instance exists and is named 'ai-collateral'"
    echo "  2. You have proper IAM permissions to describe RDS instances"
    echo "  3. You're in the correct AWS region (us-east-2)"
    exit 1
fi

echo "✅ Found security group: $SECURITY_GROUP_ID"
echo ""

# Show current security group rules
echo "📋 Current inbound rules for security group $SECURITY_GROUP_ID:"
aws ec2 describe-security-groups \
  --group-ids $SECURITY_GROUP_ID \
  --query 'SecurityGroups[0].IpPermissions[?FromPort==`5432`]' \
  --output table

echo ""
echo "Choose an option for database access:"
echo "1. Allow access from your current IP only (${YOUR_IP}/32) - RECOMMENDED"
echo "2. Allow access from all IPs (0.0.0.0/0) - NOT RECOMMENDED for production"
echo "3. Exit without making changes"
echo ""
read -p "Enter your choice (1, 2, or 3): " choice

case $choice in
  1)
    CIDR_BLOCK="${YOUR_IP}/32"
    DESCRIPTION="Access from current IP"
    echo ""
    echo "🔒 Adding security group rule for your IP only: $YOUR_IP"
    ;;
  2)
    CIDR_BLOCK="0.0.0.0/0"
    DESCRIPTION="Access from anywhere"
    echo ""
    echo "⚠️  WARNING: This will allow database access from ANY IP address!"
    echo "⚠️  This is a SECURITY RISK and should only be used for testing!"
    echo ""
    read -p "Are you absolutely sure you want to proceed? Type 'YES' to confirm: " confirm
    if [[ $confirm != "YES" ]]; then
      echo "Operation cancelled for security."
      exit 0
    fi
    echo ""
    echo "🌐 Adding security group rule for ALL IPs (0.0.0.0/0)"
    ;;
  3)
    echo "Operation cancelled by user."
    exit 0
    ;;
  *)
    echo "❌ Invalid choice. Exiting."
    exit 1
    ;;
esac

# Check if the rule already exists
EXISTING_RULE=$(aws ec2 describe-security-groups \
  --group-ids $SECURITY_GROUP_ID \
  --query "SecurityGroups[0].IpPermissions[?FromPort==\`5432\` && IpRanges[?CidrIp==\`$CIDR_BLOCK\`]]" \
  --output text)

if [ ! -z "$EXISTING_RULE" ]; then
  echo "ℹ️  Rule already exists for $CIDR_BLOCK on port 5432"
  echo "✅ No changes needed - you should be able to connect!"
else
  echo "➕ Adding new security group rule..."
  
  aws ec2 authorize-security-group-ingress \
    --group-id $SECURITY_GROUP_ID \
    --protocol tcp \
    --port 5432 \
    --cidr $CIDR_BLOCK \
    2>/dev/null

  if [ $? -eq 0 ]; then
    echo "✅ Security group rule added successfully!"
    echo "   CIDR block: $CIDR_BLOCK"
    echo "   Description: $DESCRIPTION"
  else
    echo "❌ Failed to add security group rule."
    echo "   This might be because:"
    echo "   • The rule already exists"
    echo "   • You don't have EC2 permissions"
    echo "   • There's a VPC limit reached"
  fi
fi

echo ""
echo "📋 Updated security group rules:"
aws ec2 describe-security-groups \
  --group-ids $SECURITY_GROUP_ID \
  --query 'SecurityGroups[0].IpPermissions[?FromPort==`5432`]' \
  --output table

echo ""
echo "🧪 Testing database connection..."
echo "================================"

# Test the connection
cd "$(dirname "$0")"
if [ -f "comprehensive-db-test.js" ]; then
  node comprehensive-db-test.js
else
  echo "⚠️  Connection test script not found."
  echo "You can test manually with: psql -h ai-collateral.cp4kyq4yeu8e.us-east-2.rds.amazonaws.com -U postgres -d hackathon"
fi

echo ""
echo "🏁 Configuration complete!"