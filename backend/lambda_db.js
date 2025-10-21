const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
});

async function saveExtractedData(documentId, textractResult) {
  // Example: Save to documents table
  await pool.query(
    'UPDATE documents SET ocr_extracted_json = $1, status = $2 WHERE file_name = $3',
    [textractResult, 'Extracted', documentId]
  );
}

module.exports = { saveExtractedData };
