#!/bin/sh

# Replace API URLs in frontend files for production deployment
echo "🔧 Updating API URLs for production deployment..."

# Find all JavaScript files in src directory and replace localhost:3001 with the production URL
find ./src -name "*.js" -type f -exec sed -i 's|http://localhost:3001|http://3.134.252.155|g' {} \;

echo "✅ API URLs updated successfully!"