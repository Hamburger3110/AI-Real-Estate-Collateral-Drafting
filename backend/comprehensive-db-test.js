require('dotenv').config();
const { Pool } = require('pg');
const dns = require('dns').promises;
const net = require('net');

async function comprehensiveDatabaseTest() {
  console.log('🔍 Comprehensive AWS RDS Diagnostic Test');
  console.log('==========================================');
  console.log('📍 Host:', process.env.PGHOST);
  console.log('👤 User:', process.env.PGUSER);
  console.log('🗄️  Database:', process.env.PGDATABASE);
  console.log('🔌 Port:', process.env.PGPORT);
  console.log('==========================================');

  // Step 1: DNS Resolution Test
  console.log('\n🔍 Step 1: DNS Resolution Test');
  try {
    const addresses = await dns.lookup(process.env.PGHOST);
    console.log('✅ DNS Resolution successful!');
    console.log('   IP Address:', addresses.address);
    console.log('   Address Family:', addresses.family === 4 ? 'IPv4' : 'IPv6');
  } catch (dnsError) {
    console.log('❌ DNS Resolution failed!');
    console.log('   Error:', dnsError.message);
    console.log('   This means the RDS endpoint hostname cannot be resolved.');
    return;
  }

  // Step 2: Network Connectivity Test
  console.log('\n🔍 Step 2: Network Connectivity Test');
  const testNetworkConnection = () => {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      const timeout = 10000; // 10 seconds

      socket.setTimeout(timeout);
      
      socket.on('connect', () => {
        console.log('✅ Network connection successful!');
        console.log('   Port 5432 is reachable');
        socket.destroy();
        resolve(true);
      });

      socket.on('timeout', () => {
        console.log('❌ Network connection timeout!');
        console.log('   Port 5432 is not reachable within 10 seconds');
        console.log('   This suggests firewall/security group issues');
        socket.destroy();
        reject(new Error('Connection timeout'));
      });

      socket.on('error', (err) => {
        console.log('❌ Network connection error!');
        console.log('   Error:', err.message);
        if (err.code === 'ECONNREFUSED') {
          console.log('   The port is closed or filtered');
        }
        reject(err);
      });

      console.log('⏳ Testing network connection to port 5432...');
      socket.connect(parseInt(process.env.PGPORT), process.env.PGHOST);
    });
  };

  try {
    await testNetworkConnection();
  } catch (netError) {
    console.log('\n🔧 Network Troubleshooting Steps:');
    console.log('   1. Check RDS Security Groups:');
    console.log('      • Inbound rule for port 5432');
    console.log('      • Source: Your IP address or 0.0.0.0/0 (for testing)');
    console.log('   2. Check VPC Settings:');
    console.log('      • RDS must be in public subnet for external access');
    console.log('      • Public accessibility must be enabled');
    console.log('   3. Check Network ACLs:');
    console.log('      • Allow inbound/outbound on port 5432');
    console.log('   4. Check Route Tables:');
    console.log('      • Internet Gateway route for public subnets');
    return;
  }

  // Step 3: PostgreSQL Connection Test
  console.log('\n🔍 Step 3: PostgreSQL Authentication Test');
  
  const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 15000,
    query_timeout: 10000,
  });

  try {
    console.log('⏳ Testing PostgreSQL connection...');
    const client = await pool.connect();
    
    console.log('✅ PostgreSQL connection successful!');
    
    // Test queries
    const result = await client.query('SELECT NOW() as current_time, current_database() as db_name, current_user as user_name');
    console.log('✅ Query execution successful!');
    console.log('   Current time:', result.rows[0].current_time);
    console.log('   Database name:', result.rows[0].db_name);
    console.log('   Connected as user:', result.rows[0].user_name);
    
    client.release();
    console.log('\n🎉 All tests passed! Your RDS connection is working perfectly!');
    
  } catch (pgError) {
    console.log('❌ PostgreSQL connection failed!');
    console.log('   Error Code:', pgError.code);
    console.log('   Error Message:', pgError.message);
    
    if (pgError.code === '28P01') {
      console.log('\n🔧 Authentication Troubleshooting:');
      console.log('   • Verify master username is "postgres"');
      console.log('   • Check master password is correct');
      console.log('   • Try resetting the master password in AWS console');
    } else if (pgError.code === '3D000') {
      console.log('\n🔧 Database Troubleshooting:');
      console.log('   • Database "' + process.env.PGDATABASE + '" does not exist');
      console.log('   • Try connecting to "postgres" database first');
      console.log('   • Create the database using SQL: CREATE DATABASE ' + process.env.PGDATABASE + ';');
    } else if (pgError.message && pgError.message.includes('timeout')) {
      console.log('\n🔧 Connection Timeout Troubleshooting:');
      console.log('   • This happened after network connection succeeded');
      console.log('   • Likely an SSL/TLS handshake issue');
      console.log('   • Try connecting without SSL first (not recommended for production)');
    }
  } finally {
    await pool.end();
  }

  // Step 4: Alternative connection test with different SSL settings
  console.log('\n🔍 Step 4: Testing without SSL (for diagnosis only)');
  
  const poolNoSSL = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
    ssl: false,
    connectionTimeoutMillis: 10000,
  });

  try {
    console.log('⏳ Testing connection without SSL...');
    const client = await poolNoSSL.connect();
    console.log('✅ Non-SSL connection successful!');
    console.log('   Note: SSL might not be required for your RDS instance');
    client.release();
  } catch (noSslError) {
    console.log('❌ Non-SSL connection also failed');
    console.log('   This confirms the issue is not SSL-related');
  } finally {
    await poolNoSSL.end();
  }

  console.log('\n==========================================');
  console.log('🏁 Diagnostic test completed!');
}

comprehensiveDatabaseTest().catch(console.error);