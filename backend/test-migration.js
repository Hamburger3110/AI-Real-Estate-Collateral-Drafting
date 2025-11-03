#!/usr/bin/env node

const { runMigrations } = require('./db');

async function testMigrations() {
  console.log('🚀 Testing database migrations...');
  
  try {
    await runMigrations();
    console.log('✅ Migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

testMigrations();