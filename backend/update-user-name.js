require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT || 5432,
  ssl: process.env.PGHOST && process.env.PGHOST.includes('rds.amazonaws.com') ? {
    rejectUnauthorized: false
  } : false,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000,
});

async function updateUserName() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking current user data...');
    console.log('=====================================');
    
    // First, check current value
    const checkResult = await client.query(
      'SELECT user_id, full_name, email, role FROM users WHERE email = $1',
      ['credit.officer@vpbank.com']
    );
    
    if (checkResult.rows.length === 0) {
      console.log('❌ User not found with email: credit.officer@vpbank.com');
      console.log('📋 Available users:');
      const allUsers = await client.query('SELECT user_id, full_name, email, role FROM users');
      allUsers.rows.forEach(user => {
        console.log(`   - ${user.full_name} (${user.email}) - ${user.role}`);
      });
      return;
    }
    
    const currentUser = checkResult.rows[0];
    console.log('📋 Current user data:');
    console.log(`   User ID: ${currentUser.user_id}`);
    console.log(`   Full Name: ${currentUser.full_name}`);
    console.log(`   Email: ${currentUser.email}`);
    console.log(`   Role: ${currentUser.role}`);
    console.log('=====================================');
    
    if (currentUser.full_name === 'Nguyen Minh Anh') {
      console.log('✅ User name is already "Nguyen Minh Anh". No update needed.');
      return;
    }
    
    // Update the name
    console.log('⏳ Updating user name...');
    const updateResult = await client.query(
      'UPDATE users SET full_name = $1 WHERE email = $2 RETURNING *',
      ['Nguyen Minh Anh', 'credit.officer@vpbank.com']
    );
    
    console.log('✅ Update successful!');
    console.log('=====================================');
    console.log('📋 Updated user data:');
    console.log(`   User ID: ${updateResult.rows[0].user_id}`);
    console.log(`   Full Name: ${updateResult.rows[0].full_name}`);
    console.log(`   Email: ${updateResult.rows[0].email}`);
    console.log(`   Role: ${updateResult.rows[0].role}`);
    console.log('=====================================');
    console.log('⚠️  IMPORTANT: You need to log out and log back in for the change to appear in the UI.');
    
  } catch (error) {
    console.error('❌ Error updating user:', error);
    console.error('   Code:', error.code);
    console.error('   Message:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

updateUserName();