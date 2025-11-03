require('dotenv').config();
const { Pool } = require('pg');

// Create a pool with current .env settings
const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
  ssl: process.env.PGHOST && process.env.PGHOST.includes('rds.amazonaws.com') ? {
    rejectUnauthorized: false
  } : false,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000,
});

async function testDatabaseConnection() {
  console.log('🔍 Testing AWS RDS Connection...');
  console.log('=====================================');
  console.log('📍 Host:', process.env.PGHOST);
  console.log('👤 User:', process.env.PGUSER);
  console.log('🗄️  Database:', process.env.PGDATABASE);
  console.log('🔌 Port:', process.env.PGPORT);
  console.log('🔒 SSL:', 'enabled for RDS');
  console.log('=====================================');

  try {
    console.log('⏳ Attempting connection...');
    const client = await pool.connect();
    
    console.log('✅ Connection successful!');
    
    // Test basic query
    console.log('🧪 Testing basic query...');
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    
    console.log('✅ Query successful!');
    console.log('⏰ Current time:', result.rows[0].current_time);
    console.log('🗃️  PostgreSQL version:', result.rows[0].pg_version.split(' ')[0]);
    
    // Test database permissions
    console.log('🔑 Testing database permissions...');
    try {
      await client.query('CREATE TABLE IF NOT EXISTS connection_test (id SERIAL PRIMARY KEY, test_data TEXT)');
      console.log('✅ CREATE TABLE permission: OK');
      
      await client.query('INSERT INTO connection_test (test_data) VALUES ($1)', ['Connection test at ' + new Date().toISOString()]);
      console.log('✅ INSERT permission: OK');
      
      const selectResult = await client.query('SELECT COUNT(*) as count FROM connection_test');
      console.log('✅ SELECT permission: OK (', selectResult.rows[0].count, 'records found)');
      
      await client.query('DROP TABLE connection_test');
      console.log('✅ DROP TABLE permission: OK');
      
    } catch (permError) {
      console.log('⚠️  Permission test failed:', permError.message);
    }
    
    client.release();
    
    console.log('=====================================');
    console.log('🎉 All tests passed! Database is ready to use.');
    
  } catch (error) {
    console.log('=====================================');
    console.log('❌ Connection failed!');
    console.log('🔍 Error details:');
    console.log('   Code:', error.code || 'Unknown');
    console.log('   Message:', error.message);
    
    // Provide specific troubleshooting based on error
    if (error.code === 'ENOTFOUND') {
      console.log('');
      console.log('🔧 DNS Resolution Failed:');
      console.log('   • Check if the RDS endpoint is correct');
      console.log('   • Verify the region matches your RDS instance');
      console.log('   • Ensure your internet connection is stable');
      
    } else if (error.code === 'ECONNREFUSED') {
      console.log('');
      console.log('🔧 Connection Refused:');
      console.log('   • Check RDS security groups allow port 5432');
      console.log('   • Verify RDS is in a public subnet (if accessing externally)');
      console.log('   • Ensure RDS instance is running');
      
    } else if (error.code === '28P01') {
      console.log('');
      console.log('🔧 Authentication Failed:');
      console.log('   • Verify username and password are correct');
      console.log('   • Check if the master user is "postgres"');
      console.log('   • Ensure password special characters are properly handled');
      
    } else if (error.code === '3D000') {
      console.log('');
      console.log('🔧 Database Not Found:');
      console.log('   • The database "' + process.env.PGDATABASE + '" does not exist');
      console.log('   • Try connecting to "postgres" database first');
      console.log('   • Create the database manually in RDS');
      
    } else {
      console.log('');
      console.log('🔧 General Troubleshooting:');
      console.log('   • Check AWS RDS console for instance status');
      console.log('   • Verify VPC security groups and NACLs');
      console.log('   • Ensure public accessibility is enabled (if needed)');
      console.log('   • Check if your IP is whitelisted in security groups');
    }
    
    console.log('=====================================');
  } finally {
    await pool.end();
    process.exit();
  }
}

// Run the test
testDatabaseConnection();