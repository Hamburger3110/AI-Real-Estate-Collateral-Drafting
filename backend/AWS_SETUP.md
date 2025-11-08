# AWS Configuration Guide - Team Setup

This guide explains how to configure AWS credentials for the team to access AWS Bedrock and other AWS services.

## Team Shared Credentials

**The team uses shared AWS credentials** stored in environment variables. This allows all team members to use the same AWS account and access Bedrock.

## Quick Setup

1. **Get the team AWS credentials** from your team lead or shared password manager (1Password, LastPass, etc.)

2. **Create a `.env` file** in the `backend/` directory:
   ```bash
   cd backend
   cp env.example .env
   ```

3. **Add the team AWS credentials** to your `.env` file:
   ```env
   AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
   AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
   AWS_REGION=us-east-1
   ```

4. **Verify it works**:
   ```bash
   npm start
   ```
   You should see: `✅ Using team AWS credentials from environment variables`

## How It Works

The application prioritizes credentials in this order:

1. **Team Shared Credentials** (Primary) - `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` from `.env`
2. **Individual AWS Profile** (Fallback) - `AWS_PROFILE` from `.env` (for personal development)
3. **Default Credential Chain** - IAM roles, default profile, etc. (for production)

## Security Notes

⚠️ **Important Security Practices:**

- ✅ **DO**: Keep your `.env` file local and never commit it to git (it's already in `.gitignore`)
- ✅ **DO**: Use a secure password manager to share credentials with the team
- ✅ **DO**: Rotate credentials if they're accidentally exposed
- ❌ **DON'T**: Commit `.env` files to git
- ❌ **DON'T**: Share credentials via email, Slack, or other insecure channels
- ❌ **DON'T**: Hardcode credentials in source code

## Required AWS Permissions

The team AWS credentials need the following permissions:

### For Bedrock:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-sonnet-*"
    }
  ]
}
```

### For S3:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-bucket-name",
        "arn:aws:s3:::your-bucket-name/*"
      ]
    }
  ]
}
```

### For Textract (if used):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "textract:DetectDocumentText",
        "textract:AnalyzeDocument",
        "textract:StartDocumentAnalysis"
      ],
      "Resource": "*"
    }
  ]
}
```

## Troubleshooting

### Error: "Unable to locate credentials"
- **Solution**: Make sure your `.env` file exists in the `backend/` directory
- Verify that `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are set
- Check for typos in variable names

### Error: "Access Denied" or "UnauthorizedOperation"
- **Solution**: The credentials don't have the required permissions
- Contact your team lead to verify the credentials have the correct IAM policies

### Error: "Model not found" or "Model access denied"
- **Solution**: Bedrock model access needs to be enabled in the AWS account
- Go to AWS Bedrock → Model access → Request access to Claude models
- Contact your team lead if you don't have access to the AWS console

### Credentials not working
- **Solution**: Verify credentials are correct
- Test with AWS CLI: `aws sts get-caller-identity --profile default` (if using profile)
- Or test directly: `aws sts get-caller-identity` (if using environment variables)

## Alternative: Individual Development

If you need to use your own AWS account for development:

1. **Comment out** the team credentials in `.env`:
   ```env
   # AWS_ACCESS_KEY_ID=team_key
   # AWS_SECRET_ACCESS_KEY=team_secret
   ```

2. **Set your AWS profile**:
   ```env
   AWS_PROFILE=your-profile-name
   ```

3. **Configure AWS CLI**:
   ```bash
   aws configure --profile your-profile-name
   ```

The application will automatically fall back to using your profile.

## Environment Variables Reference

Your `.env` file should include:

```env
# Team AWS Credentials (REQUIRED)
AWS_ACCESS_KEY_ID=your_team_access_key
AWS_SECRET_ACCESS_KEY=your_team_secret_key
AWS_REGION=us-east-1

# Bedrock Configuration (optional - defaults provided)
BEDROCK_MODEL_ID=
BEDROCK_INFERENCE_PROFILE_ID=

# S3 Configuration
S3_BUCKET_NAME=ai-real-estate-contracts

# Database Configuration
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=your_password
PGDATABASE=real_estate_db

# Application
PORT=3001
JWT_SECRET=your_jwt_secret
```

## Getting Help

If you have issues:
1. Check this guide first
2. Verify your `.env` file is correctly configured
3. Contact your team lead for the correct credentials
4. Check AWS console for account/permission issues

## Additional Resources

- [AWS Credentials Documentation](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/setting-credentials-node.html)
- [AWS Bedrock Setup Guide](https://docs.aws.amazon.com/bedrock/latest/userguide/setting-up.html)
- [IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
