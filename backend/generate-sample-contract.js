/**
 * Generate actual contract with OCR data
 */
require('dotenv').config();

const { Pool } = require('pg');
const contractGenerator = require('./services/contract-generator');
const fs = require('fs');
const path = require('path');

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

async function generateSampleContract() {
  try {
    console.log('📄 Generating actual contract with OCR data...\n');
    
    // Use contract 92 which has OCR data
    const contractId = 92;
    
    console.log(`🎯 Generating contract for ID: ${contractId}`);
    
    // Generate the contract
    const result = await contractGenerator.generateContract(contractId, pool);
    
    if (result.success) {
      console.log(`✅ Contract generation successful!`);
      console.log(`   - File size: ${result.buffer.length} bytes`);
      console.log(`   - PDF generated: ${result.pdfBuffer ? 'Yes (' + result.pdfBuffer.length + ' bytes)' : 'No'}`);
      console.log(`   - S3 upload: ${result.s3Upload?.success ? 'Success' : 'Failed/Skipped'}`);
      
      // Save the contract locally for testing
      const outputDir = path.join(__dirname, 'generated_contracts');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
      }
      
      const docxPath = path.join(outputDir, `contract_${contractId}_${Date.now()}.docx`);
      fs.writeFileSync(docxPath, result.buffer);
      console.log(`📁 Contract saved locally: ${docxPath}`);
      
      if (result.pdfBuffer) {
        const pdfPath = path.join(outputDir, `contract_${contractId}_${Date.now()}.pdf`);
        fs.writeFileSync(pdfPath, result.pdfBuffer);
        console.log(`📁 PDF saved locally: ${pdfPath}`);
      }
      
      // Show mapping summary
      console.log(`\n📊 Mapping Summary:`);
      console.log(`   - Total fields: ${result.mappingResult.totalFields}`);
      console.log(`   - Filled fields: ${result.mappingResult.filledFields}`);
      console.log(`   - Completion: ${result.mappingResult.completionPercentage}%`);
      
      if (result.s3Upload?.success) {
        console.log(`\n📤 S3 Upload URLs:`);
        if (result.s3Upload.docx) {
          console.log(`   - DOCX: ${result.s3Upload.docx.url}`);
        }
        if (result.s3Upload.pdf) {
          console.log(`   - PDF: ${result.s3Upload.pdf.url}`);
        }
      }
      
    } else {
      console.log(`❌ Contract generation failed: ${result.error}`);
    }
    
  } catch (error) {
    console.error('❌ Error generating contract:', error);
  } finally {
    await pool.end();
  }
}

generateSampleContract().catch(console.error);