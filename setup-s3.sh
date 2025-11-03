#!/bin/bash

# AWS S3 Bucket Setup Script for AI Real Estate Collateral System
# This script creates an S3 bucket for document storage

echo "🔧 Setting up AWS S3 bucket for document storage..."

# Configuration
BUCKET_NAME="ai-real-estate-documents-$(date +%s)"
REGION="us-east-2"

echo "📍 Region: $REGION"
echo "📦 Bucket name: $BUCKET_NAME"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI not configured. Please run: aws configure"
    exit 1
fi

# Create S3 bucket
echo "🔨 Creating S3 bucket..."
if aws s3 mb s3://$BUCKET_NAME --region $REGION; then
    echo "✅ S3 bucket created successfully!"
else
    echo "❌ Failed to create S3 bucket"
    exit 1
fi

# Configure bucket policy for document storage
echo "🔒 Setting up bucket policy..."
cat > bucket-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowDocumentUpload",
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):root"
            },
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject"
            ],
            "Resource": "arn:aws:s3:::$BUCKET_NAME/documents/*"
        }
    ]
}
EOF

aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy file://bucket-policy.json

# Enable versioning
echo "📋 Enabling versioning..."
aws s3api put-bucket-versioning --bucket $BUCKET_NAME --versioning-configuration Status=Enabled

# Configure lifecycle policy
echo "♻️ Setting up lifecycle policy..."
cat > lifecycle-policy.json << EOF
{
    "Rules": [
        {
            "ID": "DocumentArchiving",
            "Status": "Enabled",
            "Filter": {
                "Prefix": "documents/"
            },
            "Transitions": [
                {
                    "Days": 30,
                    "StorageClass": "STANDARD_IA"
                },
                {
                    "Days": 90,
                    "StorageClass": "GLACIER"
                }
            ]
        }
    ]
}
EOF

aws s3api put-bucket-lifecycle-configuration --bucket $BUCKET_NAME --lifecycle-configuration file://lifecycle-policy.json

# Update .env file
echo "📝 Updating backend .env file..."
if [ -f "../backend/.env" ]; then
    # Update existing S3 bucket name
    if grep -q "S3_BUCKET_NAME=" ../backend/.env; then
        sed -i.bak "s/S3_BUCKET_NAME=.*/S3_BUCKET_NAME=$BUCKET_NAME/" ../backend/.env
    else
        echo "S3_BUCKET_NAME=$BUCKET_NAME" >> ../backend/.env
    fi
    echo "✅ Updated S3_BUCKET_NAME in .env file"
else
    echo "⚠️ Backend .env file not found. Please update manually:"
    echo "   S3_BUCKET_NAME=$BUCKET_NAME"
fi

# Clean up temporary files
rm -f bucket-policy.json lifecycle-policy.json

echo ""
echo "🎉 S3 bucket setup complete!"
echo "📦 Bucket name: $BUCKET_NAME"
echo "📍 Region: $REGION"
echo "🔗 Bucket URL: https://$BUCKET_NAME.s3.$REGION.amazonaws.com"
echo ""
echo "📋 Next steps:"
echo "1. Update your AWS credentials in the .env file if needed"
echo "2. Restart your backend server to apply changes"
echo "3. Test file upload functionality"
echo ""
echo "💡 Test commands:"
echo "   aws s3 ls s3://$BUCKET_NAME"
echo "   curl http://localhost:3001/health"