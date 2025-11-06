/**
 * Add generated_docx_uri column to contracts table
 */

require('dotenv').config();
const { pool } = require('./db');

async function addDocxUriColumn() {
  console.log('🔄 Adding generated_docx_uri column to contracts table...');
  
  try {
    // Check if column already exists
    const checkResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'contracts' 
      AND column_name = 'generated_docx_uri'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('✅ Column generated_docx_uri already exists');
      return;
    }
    
    // Add the column
    await pool.query('ALTER TABLE contracts ADD COLUMN generated_docx_uri TEXT');
    
    console.log('✅ Successfully added generated_docx_uri column to contracts table');
    
  } catch (error) {
    console.error('❌ Error adding column:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration
addDocxUriColumn();