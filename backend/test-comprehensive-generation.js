/**
 * Test comprehensive contract generation with real OCR data
 */

const { pool } = require('./db');
const contractGenerator = require('./services/contract-generator');

async function testWithRealData() {
  console.log('🧪 Testing comprehensive contract generation with real OCR data...\n');
  
  try {
    // Test with contract ID 1 (which should have OCR data)
    const contractId = 1;
    
    console.log(`📄 Generating contract for contract ID: ${contractId}`);
    
    const result = await contractGenerator.generateContract(contractId, pool);
    
    if (result.success) {
      console.log('\n✅ Contract generation successful!');
      console.log(`📄 Generated file: ${result.filename}`);
      console.log(`📊 Field mapping: ${result.mappingResult.filledFields}/${result.mappingResult.totalFields} fields (${result.mappingResult.completionPercentage}%)`);
      
      if (result.pdfBuffer) {
        console.log(`📄 PDF conversion: ✅ (${result.pdfBuffer.length} bytes)`);
      } else {
        console.log(`📄 PDF conversion: ❌ (DOCX only)`);
      }
      
      if (result.s3Upload && result.s3Upload.success) {
        console.log(`📤 S3 upload: ✅`);
        if (result.s3Upload.docx) console.log(`   DOCX: ${result.s3Upload.docx.url}`);
        if (result.s3Upload.pdf) console.log(`   PDF: ${result.s3Upload.pdf.url}`);
      } else {
        console.log(`📤 S3 upload: ❌`);
      }
      
      // Show filled template data
      console.log('\n📋 Key template data filled:');
      const templateData = result.mappingResult.mappedFields;
      const importantFields = [
        'lender.name', 'lender.id.number', 'lender.address.original',
        'prop.certID', 'prop.address', 'prop.value', 'loan.amount'
      ];
      
      importantFields.forEach(field => {
        if (templateData[field]) {
          console.log(`   ${field}: ${templateData[field]}`);
        }
      });
      
    } else {
      console.error('\n❌ Contract generation failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testWithRealData().catch(console.error);