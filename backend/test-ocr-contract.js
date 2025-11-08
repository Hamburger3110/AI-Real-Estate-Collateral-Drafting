/**
 * Test script to verify OCR data extraction and contract generation
 */

const { pool } = require('./db');
const contractGenerator = require('./services/contract-generator');
const { mapContractFields } = require('./services/field-mapper');

async function testContractGeneration() {
  console.log('🧪 Testing OCR data extraction and contract generation...\n');
  
  try {
    // Get a sample contract with documents
    const contractResult = await pool.query(`
      SELECT c.contract_id, c.contract_number, c.customer_name,
             COUNT(d.document_id) as document_count
      FROM contracts c
      LEFT JOIN documents d ON c.contract_id = d.contract_id
      WHERE d.ocr_extracted_json IS NOT NULL
      GROUP BY c.contract_id, c.contract_number, c.customer_name
      ORDER BY c.contract_id DESC
      LIMIT 1
    `);
    
    if (contractResult.rows.length === 0) {
      console.log('❌ No contracts found with OCR extracted data');
      return;
    }
    
    const contract = contractResult.rows[0];
    console.log(`📋 Testing with contract ${contract.contract_id}: ${contract.contract_number}`);
    console.log(`   Customer: ${contract.customer_name}`);
    console.log(`   Documents: ${contract.document_count}\n`);
    
    // Get documents for this contract
    const documentsResult = await pool.query(`
      SELECT document_id, document_type, file_name, 
             (ocr_extracted_json IS NOT NULL) as has_ocr_data,
             confidence_score
      FROM documents 
      WHERE contract_id = $1
      ORDER BY document_type
    `, [contract.contract_id]);
    
    console.log('📄 Documents:');
    documentsResult.rows.forEach(doc => {
      console.log(`   - ${doc.document_type}: ${doc.file_name} (OCR: ${doc.has_ocr_data ? '✅' : '❌'}, Confidence: ${doc.confidence_score || 'N/A'})`);
    });
    console.log('');
    
    // Test field mapping
    console.log('🔄 Testing field mapping...');
    const mappingResult = await mapContractFields(contract.contract_id, pool);
    
    if (mappingResult.success) {
      console.log(`✅ Field mapping successful:`);
      console.log(`   - Total fields: ${mappingResult.totalFields}`);
      console.log(`   - Filled fields: ${mappingResult.filledFields}`);
      console.log(`   - Completion: ${mappingResult.completionPercentage}%`);
      console.log(`   - Documents processed: ${mappingResult.documentsProcessed}\n`);
      
      console.log('📋 Mapped fields:');
      Object.entries(mappingResult.mappedFields).forEach(([key, value]) => {
        if (value && value.toString().trim() !== '') {
          console.log(`   ${key}: "${value}"`);
        }
      });
      console.log('');
      
      // Test contract generation
      console.log('📄 Testing contract generation...');
      const generationResult = await contractGenerator.generateContract(contract.contract_id, pool);
      
      if (generationResult.success) {
        console.log(`✅ Contract generation successful:`);
        console.log(`   - File size: ${generationResult.buffer.length} bytes`);
        console.log(`   - PDF generated: ${generationResult.pdfBuffer ? 'Yes' : 'No'}`);
        console.log(`   - S3 upload: ${generationResult.s3Upload?.success ? 'Success' : 'Failed/Skipped'}`);
        console.log(`   - Filename: ${generationResult.filename}`);
        
        if (generationResult.s3Upload?.success) {
          console.log(`   - S3 URLs:`);
          if (generationResult.s3Upload.docx) {
            console.log(`     DOCX: ${generationResult.s3Upload.docx.url}`);
          }
          if (generationResult.s3Upload.pdf) {
            console.log(`     PDF: ${generationResult.s3Upload.pdf.url}`);
          }
        }
      } else {
        console.log(`❌ Contract generation failed: ${generationResult.error}`);
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
if (require.main === module) {
  testContractGeneration().catch(console.error);
}

module.exports = { testContractGeneration };