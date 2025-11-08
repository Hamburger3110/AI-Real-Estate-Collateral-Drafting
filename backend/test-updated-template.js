/**
 * Test script to examine the updated contract_template_original.docx
 * with {} placeholders instead of {{}}
 */

const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const fs = require('fs');
const path = require('path');

async function testUpdatedTemplate() {
  console.log('🔍 Testing updated contract_template_original.docx with {} placeholders...\n');
  
  const templatePath = path.join(__dirname, '../frontend/public/contract_template_original.docx');
  
  if (!fs.existsSync(templatePath)) {
    console.error('❌ Template not found at:', templatePath);
    return;
  }
  
  try {
    // Read template
    const templateContent = fs.readFileSync(templatePath, 'binary');
    console.log(`✅ Template loaded (${templateContent.length} bytes)`);
    
    // Create docxtemplater instance
    const zip = new PizZip(templateContent);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });
    
    // Extract placeholders using the new format
    const templateText = zip.file('word/document.xml').asText();
    
    // Look for {} placeholders instead of {{}}
    const singleBracePlaceholders = templateText.match(/\{[^}]+\}/g) || [];
    
    console.log(`\n📋 Found ${singleBracePlaceholders.length} single-brace placeholders:`);
    singleBracePlaceholders.forEach((placeholder, index) => {
      console.log(`${index + 1}. ${placeholder}`);
    });
    
    // Also check if there are any remaining double-brace placeholders
    const doubleBracePlaceholders = templateText.match(/\{\{[^}]+\}\}/g) || [];
    if (doubleBracePlaceholders.length > 0) {
      console.log(`\n⚠️  Found ${doubleBracePlaceholders.length} remaining double-brace placeholders:`);
      doubleBracePlaceholders.forEach((placeholder, index) => {
        console.log(`${index + 1}. ${placeholder}`);
      });
    }
    
    // Test with sample data using single braces
    const testData = {
      'doc.number': 'TEST-001',
      'doc.signing_date': '08/11/2025',
      'mortgagor.name': 'NGUYỄN MẠNH CƯỜNG',
      'mortgagor.id.number': '001095020575',
      'mortgagee.legal_name': 'NGÂN HÀNG THƯƠNG MẠI CỔ PHẦN VIỆT NAM THỊNH VƯỢNG',
      'SO_GCN': 'GCN-TEST-123',
      'DIA_CHI_TAI_SAN': '123 Test Street, Hanoi',
      'GIA_TRI_TAI_SAN': '5,000,000,000',
      'loan_amount_formatted': '3,000,000,000 VND'
    };
    
    console.log('\n🧪 Testing template rendering with sample data...');
    
    // Try to render the document
    doc.render(testData);
    
    const buffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });
    
    console.log(`✅ Template rendering successful! Generated ${buffer.length} bytes`);
    
    // Save test output
    const outputPath = path.join(__dirname, 'test_generated_contract.docx');
    fs.writeFileSync(outputPath, buffer);
    console.log(`📄 Test contract saved to: ${outputPath}`);
    
    // Check for successful field replacement
    const generatedXml = new PizZip(buffer).file('word/document.xml').asText();
    const remainingPlaceholders = generatedXml.match(/\{[^}]+\}/g) || [];
    
    console.log(`\n📊 Template processing results:`);
    console.log(`• Original placeholders found: ${singleBracePlaceholders.length}`);
    console.log(`• Placeholders remaining after processing: ${remainingPlaceholders.length}`);
    console.log(`• Successfully replaced: ${singleBracePlaceholders.length - remainingPlaceholders.length}`);
    
    if (remainingPlaceholders.length > 0) {
      console.log(`\n📋 Remaining placeholders (need data):`);
      remainingPlaceholders.slice(0, 10).forEach((placeholder, index) => {
        console.log(`${index + 1}. ${placeholder}`);
      });
      if (remainingPlaceholders.length > 10) {
        console.log(`... and ${remainingPlaceholders.length - 10} more`);
      }
    }
    
  } catch (error) {
    console.error('❌ Template processing failed:', error.message);
    
    if (error.properties && error.properties.errors) {
      console.error('\n📋 Detailed errors:');
      error.properties.errors.forEach((err, index) => {
        console.error(`${index + 1}. ${err.message} at ${err.part}`);
      });
    }
  }
}

// Run the test
testUpdatedTemplate().catch(console.error);