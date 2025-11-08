/**
 * Generate a contract using the comprehensive template system
 * This demonstrates the full contract generation workflow
 */

const contractGenerator = require('./services/contract-generator');

async function generateContract() {
  console.log('🏗️ Generating contract with comprehensive template...\n');
  
  try {
    // Prepare comprehensive user input data
    const userInputFields = {
      // Document information
      'doc.number': 'HĐ-BĐ-DEMO-2025-001',
      'doc.signing_date': '08/11/2025',
      'doc.signing_location.office': 'Chi nhánh Cầu Giấy - VPBank',
      
      // Customer information
      'lender.name': 'NGUYỄN MẠNH CƯỜNG',
      'lender.id.number': '001095020575',
      'lender.id.issuer': 'CA HÀ NỘI',
      'lender.id.issue_date': '15/05/2018',
      'lender.address.original': 'Số 123, Phố Hoàng Quốc Việt, Quận Cầu Giấy, Hà Nội',
      
      // Property information
      'prop.certID': 'GCN-HN-2023-001234',
      'prop.cert.issuer': 'UBND Quận Cầu Giấy',
      'prop.cert.issue.date': '20/08/2023',
      'prop.cert.owner': 'NGUYỄN MẠNH CƯỜNG',
      'prop.address': 'Lô A1, Khu đô thị mới Cầu Giấy, Phường Nghĩa Đô, Quận Cầu Giấy, Hà Nội',
      'prop.area': '120',
      'prop.value': '5000000000',
      'prop.detailed.id': 'Thửa đất số 15',
      'prop.mapID': 'Tờ bản đồ số 25',
      'prop.usage.method': 'Quyền sở hữu',
      'prop.purpose': 'Đất ở tại đô thị',
      'prop.period': 'Lâu dài',
      'prop.origin': 'Giao đất có thu tiền sử dụng đất',
      
      // Construction details
      'aprop.address': 'Lô A1, Khu đô thị mới Cầu Giấy, Phường Nghĩa Đô, Quận Cầu Giấy, Hà Nội',
      'aprop.construct.area': '80',
      'aprop.floor.area': '160',
      'aprop.construction.method': 'Khung beton cốt thép',
      'aprop.level': 'Cấp 4',
      'aprop.floor': '2',
      'aprop.yearbuilt': '2022',
      'aprop.possessdue': 'Lâu dài',
      'aprop.note': 'Nhà ở riêng lẻ, xây dựng theo đúng giấy phép',
      
      // Bank information
      'branch.name': 'NGÂN HÀNG THƯƠNG MẠI CỔ PHẦN VIỆT NAM THỊNH VƯỢNG',
      'branch.address': '89 Láng Hạ, Đống Đa, Hà Nội',
      'branch.bizregcode': '0100100004',
      'branch.bizregissue': 'Sở Kế hoạch và Đầu tư TP. Hà Nội',
      'branch.bizreg.first.issued.date': '15/05/2008',
      'branch.phone.number': '1900 55 88 18',
      'branch.fax': '(84-24) 3927 6148',
      'branch.representative.name': 'NGUYỄN VĂN A',
      'branch.representative.title': 'Giám đốc Chi nhánh Cầu Giấy',
      
      // Loan information
      'loan.amount': '3000000000'
    };
    
    console.log(`📋 Input data prepared with ${Object.keys(userInputFields).length} fields`);
    
    // Format fields for template
    const templateData = contractGenerator.formatFieldsForTemplate(userInputFields);
    console.log(`📋 Template data prepared with ${Object.keys(templateData).filter(key => templateData[key] !== '').length} filled fields`);
    
    // Load and process the template
    const fs = require('fs');
    const path = require('path');
    const PizZip = require('pizzip');
    const Docxtemplater = require('docxtemplater');
    
    const templatePath = path.join(__dirname, '../frontend/public/contract_template_original.docx');
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found at: ${templatePath}`);
    }
    
    console.log('📄 Loading comprehensive template...');
    const templateContent = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(templateContent);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });
    
    console.log('🖨️ Rendering contract document...');
    doc.render(templateData);
    
    const buffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });
    
    // Save the generated contract
    const timestamp = Date.now();
    const outputPath = path.join(__dirname, `contract_demo_${timestamp}.docx`);
    fs.writeFileSync(outputPath, buffer);
    
    console.log(`\n✅ Contract generated successfully!`);
    console.log(`📄 Generated file: ${outputPath}`);
    console.log(`📊 File size: ${buffer.length} bytes`);
    
    // Analyze completion
    const generatedXml = new PizZip(buffer).file('word/document.xml').asText();
    const remainingPlaceholders = generatedXml.match(/\{[^}]+\}/g) || [];
    
    console.log(`\n📈 Generation Statistics:`);
    console.log(`• Template fields: ${Object.keys(templateData).length}`);
    console.log(`• Fields with data: ${Object.keys(templateData).filter(key => templateData[key] !== '').length}`);
    console.log(`• Remaining placeholders: ${remainingPlaceholders.length}`);
    console.log(`• Completion rate: ${Math.round(((Object.keys(templateData).filter(key => templateData[key] !== '').length) / Object.keys(templateData).length) * 100)}%`);
    
    // Show key contract details
    console.log(`\n📋 Contract Summary:`);
    console.log(`• Contract Number: ${templateData['doc.number']}`);
    console.log(`• Customer: ${templateData['mortgagor.name']}`);
    console.log(`• Property Certificate: ${templateData['SO_GCN']}`);
    console.log(`• Property Address: ${templateData['DIA_CHI_TAI_SAN']}`);
    console.log(`• Property Value: ${templateData['GIA_TRI_TAI_SAN']} VND`);
    console.log(`• Loan Amount: ${templateData['loan_amount_formatted']}`);
    console.log(`• Bank: ${templateData['mortgagee.legal_name']}`);
    
    console.log(`\n🎉 Contract generation completed successfully!`);
    
  } catch (error) {
    console.error('❌ Contract generation failed:', error.message);
    if (error.properties && error.properties.errors) {
      console.error('\n📋 Template errors:');
      error.properties.errors.forEach((err, index) => {
        console.error(`${index + 1}. ${err.message}`);
      });
    }
  }
}

// Run the contract generation
generateContract().catch(console.error);