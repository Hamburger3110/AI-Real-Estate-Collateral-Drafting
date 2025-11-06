require('dotenv').config();
const { pool } = require('./db');

async function checkContracts() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking contracts in AWS database...');
    
    const result = await client.query(`
      SELECT 
        contract_id, 
        contract_number, 
        customer_name, 
        generated_pot_uri,
        generated_docx_uri,
        status,
        generated_at
      FROM contracts 
      ORDER BY contract_id DESC 
      LIMIT 10
    `);
    
    console.log(`📋 Found ${result.rows.length} contracts:`);
    result.rows.forEach(contract => {
      console.log(`
        ID: ${contract.contract_id}
        Number: ${contract.contract_number}
        Customer: ${contract.customer_name}
        Status: ${contract.status}
        PDF URL: ${contract.generated_pot_uri ? 'Yes' : 'No'}
        DOCX URL: ${contract.generated_docx_uri ? 'Yes' : 'No'}
        Generated: ${contract.generated_at}
      `);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

checkContracts();