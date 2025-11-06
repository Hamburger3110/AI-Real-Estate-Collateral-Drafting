const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'real_estate_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function checkContractDocs() {
  try {
    const result = await pool.query(
      'SELECT id, generated_pot_uri, generated_docx_uri FROM contracts WHERE generated_pot_uri IS NOT NULL OR generated_docx_uri IS NOT NULL LIMIT 5'
    );
    console.log('Contracts with documents:');
    result.rows.forEach(row => {
      console.log(`Contract ID: ${row.id}`);
      console.log(`PDF URI: ${row.generated_pot_uri}`);
      console.log(`DOCX URI: ${row.generated_docx_uri}`);
      console.log('---');
    });
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkContractDocs();