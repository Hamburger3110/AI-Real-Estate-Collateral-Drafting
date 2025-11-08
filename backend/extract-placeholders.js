/**
 * Extract placeholders from DOCX template
 */
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const fs = require('fs');
const path = require('path');

function extractPlaceholders() {
  const templatePath = path.join(__dirname, '../frontend/public/contract_template.docx');
  
  if (!fs.existsSync(templatePath)) {
    console.error('❌ Template not found:', templatePath);
    return;
  }
  
  console.log('📋 Examining template placeholders in:', templatePath);
  console.log('='.repeat(80));
  
  try {
    const templateContent = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(templateContent);
    
    // Extract document.xml content to find placeholders
    const documentXml = zip.files['word/document.xml'].asText();
    
    // Find all placeholders in format {placeholder}
    const placeholderRegex = /\{([^}]+)\}/g;
    const placeholders = new Set();
    let match;
    
    while ((match = placeholderRegex.exec(documentXml)) !== null) {
      placeholders.add(match[1]);
    }
    
    console.log(`📊 Found ${placeholders.size} unique placeholders:\n`);
    
    // Group placeholders by category for better organization
    const categorized = {
      'Document Info': [],
      'Bank Info': [],
      'Customer Info': [], 
      'Property Info': [],
      'Loan Info': [],
      'Date/Time': [],
      'Other': []
    };
    
    [...placeholders].sort().forEach(placeholder => {
      if (placeholder.includes('doc_') || placeholder.includes('contract_')) {
        categorized['Document Info'].push(placeholder);
      } else if (placeholder.includes('bank_') || placeholder.includes('branch_')) {
        categorized['Bank Info'].push(placeholder);
      } else if (placeholder.includes('customer_') || placeholder.includes('borrower_') || placeholder.includes('lender_')) {
        categorized['Customer Info'].push(placeholder);
      } else if (placeholder.includes('property_') || placeholder.includes('prop_') || placeholder.includes('land_')) {
        categorized['Property Info'].push(placeholder);
      } else if (placeholder.includes('loan_') || placeholder.includes('amount_') || placeholder.includes('credit_')) {
        categorized['Loan Info'].push(placeholder);
      } else if (placeholder.includes('date') || placeholder.includes('time') || placeholder.includes('day') || placeholder.includes('month') || placeholder.includes('year')) {
        categorized['Date/Time'].push(placeholder);
      } else {
        categorized['Other'].push(placeholder);
      }
    });
    
    // Display categorized placeholders
    Object.entries(categorized).forEach(([category, items]) => {
      if (items.length > 0) {
        console.log(`📂 ${category}:`);
        items.forEach(item => {
          console.log(`   - {${item}}`);
        });
        console.log('');
      }
    });
    
    console.log('='.repeat(80));
    console.log('📋 All placeholders (for mapping):');
    [...placeholders].sort().forEach(placeholder => {
      console.log(`'${placeholder}': '',`);
    });
    
  } catch (error) {
    console.error('❌ Error extracting placeholders:', error);
  }
}

extractPlaceholders();