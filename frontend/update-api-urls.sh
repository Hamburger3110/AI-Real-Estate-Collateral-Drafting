#!/bin/sh

# Replace API URLs in frontend files for production deployment
echo "🔧 Updating API URLs for production deployment..."

# Only replace URLs in production builds (when REACT_APP_API_BASE_URL is set to production)
if [ "$REACT_APP_API_BASE_URL" != "http://localhost:3001" ] && [ -n "$REACT_APP_API_BASE_URL" ]; then
  echo "📡 Production build detected - updating URLs to: $REACT_APP_API_BASE_URL"
  find ./src -name "*.js" -type f -exec sed -i "s|http://localhost:3001|$REACT_APP_API_BASE_URL|g" {} \;
  echo "✅ API URLs updated for production!"
else
  echo "🏠 Development build - keeping localhost URLs"
fi