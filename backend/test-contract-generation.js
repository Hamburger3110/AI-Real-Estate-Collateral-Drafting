/**
 * Test script for contract generation system
 * This script tests the field mapping and contract generation functionality
 */

const { pool } = require('./db');
const { mapContractFields } = require('./services/field-mapper');
const contractGenerator = require('./services/contract-generator');

async function testContractGeneration() {
  console.log('🧪 Testing Contract Generation System...\n');
  
  try {
    // Step 1: Find a contract with documents
    console.log('📋 Step 1: Finding contracts with documents...');
    const contractsResult = await pool.query(`
      SELECT DISTINCT c.contract_id, c.contract_number, c.customer_name
      FROM contracts c
      JOIN documents d ON c.contract_id = d.contract_id
      WHERE d.ocr_extracted_json IS NOT NULL
      LIMIT 5
    `);
    
    if (contractsResult.rows.length === 0) {
      console.log('❌ No contracts found with extracted document data');
      console.log('💡 Creating test data...');
      await createTestData();
      return;
    }
    
    console.log(`✅ Found ${contractsResult.rows.length} contracts with document data:`);
    contractsResult.rows.forEach(contract => {
      console.log(`   - ${contract.contract_number}: ${contract.customer_name} (ID: ${contract.contract_id})`);
    });
    
    // Step 2: Test field mapping for first contract
    const testContract = contractsResult.rows[0];
    console.log(`\n📋 Step 2: Testing field mapping for contract ${testContract.contract_number}...`);
    
    const mappingResult = await mapContractFields(testContract.contract_id, pool);
    
    if (mappingResult.success) {
      console.log(`✅ Field mapping successful:`);
      console.log(`   - Completion: ${mappingResult.completionPercentage}%`);
      console.log(`   - Fields: ${mappingResult.filledFields}/${mappingResult.totalFields}`);
      console.log(`   - Documents: ${mappingResult.documentsProcessed}`);
      
      console.log('\n📄 Mapped fields:');
      Object.entries(mappingResult.mappedFields).forEach(([key, value]) => {
        if (value && value.toString().trim() !== '') {
          console.log(`   ✅ ${key}: ${value}`);
        }
      });
    } else {
      console.log(`❌ Field mapping failed: ${mappingResult.error}`);
      return;
    }
    
    // Step 3: Test generation preview
    console.log(`\n📋 Step 3: Testing generation preview...`);
    
    const preview = await contractGenerator.getGenerationPreview(testContract.contract_id, pool);
    
    if (preview.success) {
      console.log(`✅ Generation preview successful:`);
      console.log(`   - Can generate: ${preview.validation.canGenerate}`);
      console.log(`   - Missing required: ${preview.validation.missingRequired.length}`);
      console.log(`   - Warnings: ${preview.validation.warnings.length}`);
      
      if (preview.validation.missingRequired.length > 0) {
        console.log('\n❌ Missing required fields:');
        preview.validation.missingRequired.forEach(field => {
          console.log(`   - ${field}`);
        });
      }
    } else {
      console.log(`❌ Generation preview failed: ${preview.error}`);
      return;
    }
    
    // Step 4: Test contract generation (if possible)
    if (preview.validation.canGenerate) {
      console.log(`\n📄 Step 4: Testing contract generation...`);
      
      const generateResult = await contractGenerator.generateContract(testContract.contract_id, pool);
      
      if (generateResult.success) {
        console.log(`✅ Contract generation successful:`);
        console.log(`   - File size: ${generateResult.buffer.length} bytes`);
        console.log(`   - Filename: ${generateResult.filename}`);
      } else {
        console.log(`❌ Contract generation failed: ${generateResult.error}`);
      }
    } else {
      console.log(`⚠️ Step 4: Skipping contract generation (missing required fields)`);
    }
    
    console.log('\n✅ Contract generation system test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

async function createTestData() {
  console.log('📦 Creating test contract with sample extracted data...');
  
  try {
    // Create a test contract
    const contractResult = await pool.query(`
      INSERT INTO contracts (
        contract_number, 
        customer_name, 
        property_address, 
        loan_amount, 
        status,
        generated_by
      ) VALUES (
        'CT-TEST-' || EXTRACT(EPOCH FROM NOW())::bigint,
        'Nguyen Van Test',
        '123 Test Street, Ho Chi Minh City',
        500000000,
        'draft',
        1
      ) RETURNING contract_id, contract_number
    `);
    
    const testContract = contractResult.rows[0];
    console.log(`✅ Created test contract: ${testContract.contract_number} (ID: ${testContract.contract_id})`);
    
    // Create a test document with sample extracted data
    const documentResult = await pool.query(`
      INSERT INTO documents (
        file_name,
        ss_uri,
        document_type,
        contract_id,
        status,
        ocr_extracted_json,
        confidence_score,
        upload_user_id
      ) VALUES (
        'test_id_card.jpg',
        'https://example.com/test.jpg',
        'ID Card',
        $1,
        'Validated',
        $2,
        95.5,
        1
      ) RETURNING document_id
    `, [
      testContract.contract_id,
      JSON.stringify({
        errorCode: 0,
        data: [{
          name: 'NGUYEN VAN TEST',
          id: '123456789012',
          dob: '01/01/1990',
          sex: 'Nam',
          nationality: 'Việt Nam',
          home: 'Hà Nội',
          address: '123 Test Street, Ho Chi Minh City',
          doe: '01/01/2030',
          name_prob: 98.5,
          id_prob: 99.2,
          dob_prob: 97.8,
          address_prob: 96.5
        }],
        overall_score: 95.5
      })
    ]);
    
    console.log(`✅ Created test document with sample extracted data (ID: ${documentResult.rows[0].document_id})`);
    
    // Add some extracted fields
    await pool.query(`
      INSERT INTO extracted_fields (document_id, field_name, field_value, confidence_score, validated) VALUES
      ($1, 'Full Name', 'NGUYEN VAN TEST', 98.5, true),
      ($1, 'ID Number', '123456789012', 99.2, true),
      ($1, 'Address', '123 Test Street, Ho Chi Minh City', 96.5, true),
      ($1, 'Date of Birth', '01/01/1990', 97.8, true)
    `, [documentResult.rows[0].document_id]);
    
    console.log('✅ Added validated extracted fields');
    console.log('\n🔄 Now testing field mapping with test data...\n');
    
    // Test with the created data
    const mappingResult = await mapContractFields(testContract.contract_id, pool);
    
    if (mappingResult.success) {
      console.log(`✅ Test field mapping successful:`);
      console.log(`   - Completion: ${mappingResult.completionPercentage}%`);
      console.log(`   - Fields: ${mappingResult.filledFields}/${mappingResult.totalFields}`);
      
      console.log('\n📄 Sample mapped fields:');
      Object.entries(mappingResult.mappedFields).forEach(([key, value]) => {
        if (value && value.toString().trim() !== '') {
          console.log(`   ✅ ${key}: ${value}`);
        }
      });
    } else {
      console.log(`❌ Test field mapping failed: ${mappingResult.error}`);
    }
    
  } catch (error) {
    console.error('❌ Failed to create test data:', error);
  }
}

// Run the test
if (require.main === module) {
  testContractGeneration();
}

module.exports = { testContractGeneration };