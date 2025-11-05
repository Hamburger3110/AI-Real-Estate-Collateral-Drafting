#!/bin/bash

# Database Migration and Health Check Script
# Run this to verify database migrations and health

set -e

echo "🔍 AI Real Estate Collateral Drafting - Database Health Check"
echo "============================================================"

# Navigate to backend directory
cd "$(dirname "$0")/../backend"

# Load environment
if [ -f ".env" ]; then
    echo "✅ Environment file found"
else
    echo "❌ Environment file not found!"
    echo "   Please ensure .env file exists with database credentials"
    exit 1
fi

# Test database connection and run migrations
echo ""
echo "🔍 Testing database connection and running migrations..."

node -e "
require('dotenv').config();
const { testConnection, runMigrations, seedDemoUsers } = require('./db');

async function healthCheck() {
  try {
    console.log('🔗 Testing database connection...');
    const connected = await testConnection();
    
    if (!connected) {
      console.log('❌ Database connection failed');
      process.exit(1);
    }
    
    console.log('\\n🔄 Running database migrations...');
    await runMigrations();
    
    console.log('\\n👥 Seeding demo users...');
    await seedDemoUsers();
    
    console.log('\\n✅ Database health check completed successfully!');
    console.log('\\n📊 Database is ready for production deployment');
    
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    process.exit(1);
  }
  process.exit(0);
}

healthCheck();
"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Database health check passed!"
    echo "🚀 Your application is ready for deployment"
else
    echo ""
    echo "❌ Database health check failed!"
    echo "   Please check your database configuration and try again"
    exit 1
fi