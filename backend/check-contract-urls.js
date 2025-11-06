/**
 * Check contract URLs in database
 */

require('dotenv').config();
const { pool } = require('./db');

async function checkContractUrls() {
  console.log('🔍 Checking contract URLs in database...\n');
  
  try {
    const result = await pool.query(`
      SELECT 
        contract_id,
        contract_number,
        generated_pot_uri as pdf_url,
        generated_docx_uri as docx_url,
        status,
        generated_at
      FROM contracts 
      WHERE contract_id = 41
    `);
    
    if (result.rows.length > 0) {
      const contract = result.rows[0];
      console.log('📋 Contract 41 URLs:');
      console.log(`   PDF URL: ${contract.pdf_url || 'Not available'}`);
      console.log(`   DOCX URL: ${contract.docx_url || 'Not available'}`);
      console.log(`   Status: ${contract.status}`);
      console.log(`   Generated: ${contract.generated_at}`);
    } else {
      console.log('❌ Contract 41 not found');
    }
    
  } catch (error) {
    console.error('❌ Error checking URLs:', error.message);
  } finally {
    await pool.end();
  }
}

checkContractUrls();