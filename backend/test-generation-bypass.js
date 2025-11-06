/**
 * Simple test to verify contract generation bypass works
 */

require('dotenv').config();
const contractGenerator = require('./services/contract-generator');
const { pool } = require('./db');

async function testContractGenerationBypass() {
  console.log('🧪 Testing Contract Generation with Missing Fields...\n');
  
  try {
    // Test with a contract ID that might exist
    const contractId = 41; // From the error screenshot
    
    console.log(`📋 Testing contract generation for contract ID: ${contractId}`);
    
    const result = await contractGenerator.generateContract(contractId, pool, {});
    
    if (result.success) {
      console.log('✅ Contract generation successful!');
      console.log(`   - File size: ${result.buffer ? result.buffer.length + ' bytes' : 'No buffer'}`);
      console.log(`   - Filename: ${result.filename}`);
      console.log(`   - PDF generated: ${result.pdfBuffer ? 'Yes' : 'No'}`);
      console.log(`   - S3 upload: ${result.s3Upload?.success ? 'Success' : 'Failed/Skipped'}`);
    } else {
      console.log('❌ Contract generation failed:');
      console.log(`   Error: ${result.error}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed with exception:', error.message);
  } finally {
    try {
      await pool.end();
    } catch (poolError) {
      console.error('Pool cleanup error:', poolError.message);
    }
  }
}

// Run test
testContractGenerationBypass();