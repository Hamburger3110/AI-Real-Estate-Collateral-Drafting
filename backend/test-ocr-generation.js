/**
 * Test OCR contract generation with AWS database
 */
require('dotenv').config();

const { Pool } = require('pg');
const contractGenerator = require('./services/contract-generator');
const { mapContractFields } = require('./services/field-mapper');

const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
  ssl: process.env.PGHOST && process.env.PGHOST.includes('rds.amazonaws.com') ? {
    rejectUnauthorized: false
  } : false,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

async function testOCRContractGeneration() {
  console.log('🧪 Testing OCR data extraction and contract generation with AWS database...\n');
  
  try {
    // First, let's see what contracts exist
    const contractsResult = await pool.query(`
      SELECT c.contract_id, c.contract_number, c.customer_name, c.status,
             COUNT(d.document_id) as document_count,
             COUNT(CASE WHEN d.ocr_extracted_json IS NOT NULL THEN 1 END) as ocr_documents
      FROM contracts c
      LEFT JOIN documents d ON c.contract_id = d.contract_id
      GROUP BY c.contract_id, c.contract_number, c.customer_name, c.status
      ORDER BY c.contract_id DESC
      LIMIT 5
    `);
    
    console.log(`📋 Found ${contractsResult.rows.length} contracts:`);
    contractsResult.rows.forEach((contract, index) => {
      console.log(`   ${index + 1}. Contract ${contract.contract_id}: ${contract.contract_number || 'No number'}`);
      console.log(`      Customer: ${contract.customer_name || 'N/A'}`);
      console.log(`      Status: ${contract.status}`);
      console.log(`      Documents: ${contract.document_count} (${contract.ocr_documents} with OCR data)`);
    });
    console.log('');
    
    // Find a contract with OCR data
    const testContract = contractsResult.rows.find(c => c.ocr_documents > 0);
    
    if (!testContract) {
      console.log('❌ No contracts found with OCR extracted data');
      console.log('ℹ️  Please upload some documents and process them first');
      return;
    }
    
    console.log(`🎯 Testing with contract ${testContract.contract_id}: ${testContract.contract_number}`);
    console.log(`   Customer: ${testContract.customer_name}`);
    console.log(`   OCR Documents: ${testContract.ocr_documents}\n`);
    
    // Get sample OCR data for this contract
    const documentsResult = await pool.query(`
      SELECT document_id, document_type, file_name, 
             (ocr_extracted_json IS NOT NULL) as has_ocr_data,
             confidence_score,
             CASE 
               WHEN ocr_extracted_json IS NOT NULL 
               THEN jsonb_array_length(COALESCE(ocr_extracted_json->'data', '[]'::jsonb))
               ELSE 0 
             END as data_fields_count
      FROM documents 
      WHERE contract_id = $1
      ORDER BY document_type
    `, [testContract.contract_id]);
    
    console.log('📄 Documents for this contract:');
    documentsResult.rows.forEach(doc => {
      console.log(`   - ${doc.document_type}: ${doc.file_name}`);
      console.log(`     OCR: ${doc.has_ocr_data ? '✅' : '❌'}, Confidence: ${doc.confidence_score || 'N/A'}, Fields: ${doc.data_fields_count}`);
    });
    console.log('');
    
    // Test field mapping
    console.log('🔄 Testing field mapping...');
    const mappingResult = await mapContractFields(testContract.contract_id, pool);
    
    if (mappingResult.success) {
      console.log(`✅ Field mapping successful:`);
      console.log(`   - Total fields: ${mappingResult.totalFields}`);
      console.log(`   - Filled fields: ${mappingResult.filledFields}`);
      console.log(`   - Completion: ${mappingResult.completionPercentage}%`);
      console.log(`   - Documents processed: ${mappingResult.documentsProcessed}\n`);
      
      console.log('📋 Key mapped fields:');
      const importantFields = [
        'lender.name', 'lender.id.number', 'lender.address.original',
        'prop.address', 'prop.area', 'prop.value', 'prop.certID',
        'loan.amount', 'doc.number'
      ];
      
      importantFields.forEach(field => {
        const value = mappingResult.mappedFields[field];
        if (value && value.toString().trim() !== '') {
          console.log(`   ✅ ${field}: "${value}"`);
        } else {
          console.log(`   ⚠️  ${field}: (empty)`);
        }
      });
      console.log('');
      
      // Test contract generation preview
      console.log('👀 Testing contract generation preview...');
      const previewResult = await contractGenerator.getGenerationPreview(testContract.contract_id, pool);
      
      if (previewResult.success) {
        console.log(`✅ Preview generation successful`);
        console.log(`   - Template data keys: ${Object.keys(previewResult.templateData).length}`);
        console.log(`   - Non-empty fields: ${Object.values(previewResult.templateData).filter(v => v && v.toString().trim() !== '').length}`);
        
        // Show some template data
        console.log('📋 Sample template data:');
        Object.entries(previewResult.templateData).forEach(([key, value]) => {
          if (value && value.toString().trim() !== '' && !key.includes('_formatted')) {
            console.log(`   ${key}: "${value}"`);
          }
        });
        
      } else {
        console.log(`❌ Preview generation failed: ${previewResult.error}`);
      }
      
    } else {
      console.log(`❌ Field mapping failed: ${mappingResult.error}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testOCRContractGeneration().catch(console.error);