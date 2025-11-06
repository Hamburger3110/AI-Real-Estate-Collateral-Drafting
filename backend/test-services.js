/**
 * Test S3 and PDF conversion services
 */

require('dotenv').config();
const pdfConverter = require('./services/pdf-converter');
const s3Service = require('./services/s3-service');
const fs = require('fs');
const path = require('path');

async function testServices() {
  console.log('🧪 Testing S3 and PDF Conversion Services...\n');
  
  try {
    // Test 1: Check S3 configuration
    console.log('📋 Test 1: Checking S3 configuration...');
    const s3Status = await s3Service.checkConfiguration();
    console.log(`S3 Configuration: ${s3Status ? '✅ Valid' : '❌ Invalid'}\n`);
    
    // Test 2: Test PDF conversion
    console.log('📋 Test 2: Testing PDF conversion...');
    const pdfStatus = await pdfConverter.testPdfConversion();
    console.log(`PDF Conversion: ${pdfStatus ? '✅ Working' : '❌ Failed'}\n`);
    
    // Test 3: Test simple file upload to S3 (if configured)
    if (s3Status) {
      console.log('📋 Test 3: Testing S3 file upload...');
      
      const testContent = 'This is a test file for S3 upload functionality.';
      const testBuffer = Buffer.from(testContent, 'utf8');
      
      const uploadResult = await s3Service.uploadFile(
        testBuffer,
        `test_${Date.now()}.txt`,
        'text/plain',
        'test'
      );
      
      if (uploadResult.success) {
        console.log(`✅ S3 upload successful: ${uploadResult.url}`);
        
        // Clean up test file
        try {
          const deleteResult = await s3Service.deleteFile(uploadResult.key);
          console.log(`🗑️ Test file cleaned up: ${deleteResult ? 'Success' : 'Failed'}`);
        } catch (cleanupError) {
          console.log(`⚠️ Cleanup warning: ${cleanupError.message}`);
        }
      } else {
        console.log(`❌ S3 upload failed: ${uploadResult.error}`);
      }
    } else {
      console.log('⏭️ Skipping S3 upload test (not configured)');
    }
    
    console.log('\n✅ Service tests completed!');
    console.log('\n📋 Service Status Summary:');
    console.log(`   S3 Service: ${s3Status ? '✅ Ready' : '❌ Not configured'}`);
    console.log(`   PDF Converter: ${pdfStatus ? '✅ Ready' : '❌ Not working'}`);
    
    if (!s3Status) {
      console.log('\n💡 To enable S3 uploads, set these environment variables:');
      console.log('   - AWS_ACCESS_KEY_ID');
      console.log('   - AWS_SECRET_ACCESS_KEY');
      console.log('   - AWS_REGION (optional, defaults to us-east-1)');
      console.log('   - S3_BUCKET_NAME (optional, defaults to ai-real-estate-contracts)');
    }
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Run the test if called directly
if (require.main === module) {
  testServices();
}

module.exports = { testServices };