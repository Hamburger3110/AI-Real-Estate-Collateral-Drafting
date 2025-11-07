#!/bin/sh

# Replace API URLs in frontend files for production deployment
echo "🔧 Updating API URLs for production deployment..."

# Replace localhost:3001 with localhost:5000 first (port change)
echo "🔄 Updating port from 3001 to 5000..."
find ./src -name "*.js" -type f -exec sed -i "s|http://localhost:3001|http://localhost:5000|g" {} \;

# Add /api prefix to all endpoint URLs
echo "🔄 Adding /api prefix to endpoints..."
find ./src -name "*.js" -type f -exec sed -i "s|http://localhost:5000/auth|http://localhost:5000/api/auth|g" {} \;
find ./src -name "*.js" -type f -exec sed -i "s|http://localhost:5000/contracts|http://localhost:5000/api/contracts|g" {} \;
find ./src -name "*.js" -type f -exec sed -i "s|http://localhost:5000/documents|http://localhost:5000/api/documents|g" {} \;
find ./src -name "*.js" -type f -exec sed -i "s|http://localhost:5000/approvals|http://localhost:5000/api/approvals|g" {} \;
find ./src -name "*.js" -type f -exec sed -i "s|http://localhost:5000/activity_logs|http://localhost:5000/api/activity_logs|g" {} \;
find ./src -name "*.js" -type f -exec sed -i "s|http://localhost:5000/upload|http://localhost:5000/api/upload|g" {} \;
find ./src -name "*.js" -type f -exec sed -i "s|http://localhost:5000/notifications|http://localhost:5000/api/notifications|g" {} \;
find ./src -name "*.js" -type f -exec sed -i "s|http://localhost:5000/extracted_fields|http://localhost:5000/api/extracted_fields|g" {} \;
find ./src -name "*.js" -type f -exec sed -i "s|http://localhost:5000/fptai|http://localhost:5000/api/fptai|g" {} \;
find ./src -name "*.js" -type f -exec sed -i "s|http://localhost:5000/events|http://localhost:5000/api/events|g" {} \;
find ./src -name "*.js" -type f -exec sed -i "s|http://localhost:5000/webhook|http://localhost:5000/api/webhook|g" {} \;

# Only replace the base URL for production builds
if [ "$REACT_APP_API_BASE_URL" != "http://localhost:5000" ] && [ -n "$REACT_APP_API_BASE_URL" ]; then
  echo "📡 Production build detected - updating URLs to: $REACT_APP_API_BASE_URL"
  find ./src -name "*.js" -type f -exec sed -i "s|http://localhost:5000|$REACT_APP_API_BASE_URL|g" {} \;
  echo "✅ API URLs updated for production!"
else
  echo "🏠 Development build - keeping localhost URLs with /api prefix"
fi