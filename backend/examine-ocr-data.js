/**
 * Examine OCR extracted data format
 */
require('dotenv').config();

const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
  ssl: process.env.PGHOST && process.env.PGHOST.includes('rds.amazonaws.com') ? {
    rejectUnauthorized: false
  } : false,
});

async function examineOCRData() {
  try {
    console.log('📊 Examining OCR extracted data format...\n');
    
    // Get sample OCR data
    const result = await pool.query(`
      SELECT 
        d.document_id,
        d.document_type,
        d.file_name,
        d.confidence_score,
        d.ocr_extracted_json
      FROM documents d
      WHERE d.ocr_extracted_json IS NOT NULL
      ORDER BY d.document_id DESC
      LIMIT 3
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No documents with OCR data found');
      return;
    }
    
    console.log(`📄 Found ${result.rows.length} documents with OCR data:\n`);
    
    result.rows.forEach((doc, index) => {
      console.log(`${index + 1}. Document ${doc.document_id}: ${doc.file_name}`);
      console.log(`   Type: ${doc.document_type}`);
      console.log(`   Confidence: ${doc.confidence_score}%`);
      console.log(`   OCR Data Structure:`);
      
      const ocrData = doc.ocr_extracted_json;
      console.log(`   - Keys: ${Object.keys(ocrData).join(', ')}`);
      
      if (ocrData.data) {
        console.log(`   - Data type: ${Array.isArray(ocrData.data) ? 'Array' : 'Object'}`);
        if (Array.isArray(ocrData.data)) {
          console.log(`   - Data array length: ${ocrData.data.length}`);
          if (ocrData.data.length > 0) {
            console.log(`   - First item keys: ${Object.keys(ocrData.data[0]).join(', ')}`);
            console.log(`   - Sample data:`, JSON.stringify(ocrData.data[0], null, 4));
          }
        } else {
          console.log(`   - Data object keys: ${Object.keys(ocrData.data).join(', ')}`);
          console.log(`   - Sample data:`, JSON.stringify(ocrData.data, null, 4));
        }
      } else {
        console.log(`   - Raw data keys: ${Object.keys(ocrData).join(', ')}`);
        console.log(`   - Sample data:`, JSON.stringify(ocrData, null, 2));
      }
      
      console.log('\n' + '='.repeat(80) + '\n');
    });
    
  } catch (error) {
    console.error('❌ Error examining OCR data:', error);
  } finally {
    await pool.end();
  }
}

examineOCRData().catch(console.error);