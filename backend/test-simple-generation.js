/**
 * Simple contract generation test using text template
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./db');
const fieldMapper = require('./services/field-mapper');

async function testSimpleGeneration() {
  console.log('🧪 Testing Simple Contract Generation...\n');
  
  try {
    const contractId = 41;
    
    // Test field mapping first
    console.log('📋 Testing field mapping...');
    const mappedFields = await fieldMapper.mapContractFields(contractId, pool);
    const validationResult = await fieldMapper.validateMappedFields(mappedFields);
    
    console.log(`✅ Field mapping complete: ${Object.keys(mappedFields).length} fields mapped`);
    console.log(`📊 Validation result: canGenerate = ${validationResult.canGenerate}`);
    
    if (validationResult.canGenerate) {
      console.log('🎉 SUCCESS: Validation bypass is working!');
      console.log('📝 Contract can be generated with missing fields');
      
      // Read the simple text template
      const templatePath = path.join(__dirname, '../frontend/public/contract_template.txt');
      let template = fs.readFileSync(templatePath, 'utf8');
      
      console.log('📄 Applying field replacements...');
      
      // Simple template replacement
      for (const [field, value] of Object.entries(mappedFields)) {
        if (value) {
          template = template.replace(new RegExp(`{{${field}}}`, 'g'), value);
        }
      }
      
      // Replace any remaining empty placeholders with "[Not Available]"
      template = template.replace(/{{[^}]+}}/g, '[Not Available]');
      
      console.log('✅ Contract generated successfully!');
      console.log(`📊 Sample content (first 200 chars):`);
      console.log(template.substring(0, 200) + '...');
      
    } else {
      console.log('❌ Validation is still blocking generation');
      console.log('Errors:', validationResult.errors);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    try {
      await pool.end();
    } catch (e) {
      console.error('Pool cleanup error:', e.message);
    }
  }
}

testSimpleGeneration();