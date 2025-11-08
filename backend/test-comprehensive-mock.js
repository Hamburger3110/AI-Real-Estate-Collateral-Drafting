/**
 * Test comprehensive contract generation with mock OCR data
 * to verify the fixed template works properly
 */

const contractGenerator = require('./services/contract-generator');

async function testWithMockData() {
  console.log('🧪 Testing comprehensive contract generation with mock OCR data...\n');
  
  try {
    // Create mock mapped fields that simulate real OCR data
    const mockMappedFields = {
      // Customer information from ID card OCR
      'lender.name': 'NGUYỄN MẠNH CƯỜNG',
      'lender.id.number': '001095020575',
      'lender.id.issuer': 'CA HÀ NỘI',
      'lender.id.issue_date': '15/05/2018',
      'lender.address.original': 'Số 123, Phố Hoàng Quốc Việt, Quận Cầu Giấy, Hà Nội',
      
      // Property certificate information
      'prop.certID': 'GCN-HN-2023-001234',
      'prop.cert.issuer': 'UBND Quận Cầu Giấy',
      'prop.cert.issue.date': '20/08/2023',
      'prop.cert.owner': 'NGUYỄN MẠNH CƯỜNG',
      'prop.address': 'Lô A1, KĐT Mới Cầu Giấy, Quận Cầu Giấy, Hà Nội',
      'prop.area': '120',
      'prop.value': '5000000000',
      'prop.detailed.id': 'Thửa 15',
      'prop.mapID': 'Tờ bản đồ số 25',
      'prop.usage.method': 'Quyền sở hữu',
      'prop.purpose': 'Đất ở tại đô thị',
      'prop.period': 'Lâu dài',
      'prop.origin': 'Giao đất có thu tiền sử dụng đất',
      
      // Construction details
      'aprop.address': 'Lô A1, KĐT Mới Cầu Giấy, Quận Cầu Giấy, Hà Nội',
      'aprop.construct.area': '80',
      'aprop.floor.area': '160',
      'aprop.construction.method': 'Khung beton cốt thép',
      'aprop.level': 'Cấp 4',
      'aprop.floor': '2',
      'aprop.yearbuilt': '2022',
      'aprop.possessdue': 'Lâu dài',
      
      // Bank information
      'branch.name': 'NGÂN HÀNG THƯƠNG MẠI CỔ PHẦN VIỆT NAM THỊNH VƯỢNG',
      'branch.address': '89 Láng Hạ, Đống Đa, Hà Nội',
      'branch.bizregcode': '0100100004',
      'branch.bizregissue': 'Sở KH&ĐT TP. Hà Nội',
      'branch.bizreg.first.issued.date': '15/05/2008',
      'branch.phone.number': '1900 55 88 18',
      'branch.fax': '(84-24) 3927 6148',
      'branch.representative.name': 'NGUYỄN VĂN A',
      'branch.representative.title': 'Giám đốc Chi nhánh',
      
      // Document and loan information
      'doc.number': 'HĐ-BĐ-001234-2025',
      'doc.signing_date': '08/11/2025',
      'doc.signing_location.office': 'Chi nhánh Cầu Giấy - VPBank',
      'loan.amount': '3000000000'
    };
    
    console.log(`📄 Testing template with comprehensive mock data...`);
    
    // Use the formatFieldsForTemplate method directly to test template data preparation
    const templateData = contractGenerator.formatFieldsForTemplate(mockMappedFields);
    
    console.log(`📋 Template data prepared with ${Object.keys(templateData).filter(key => templateData[key] !== '').length} filled fields`);
    
    // Test template loading and basic processing
    const fs = require('fs');
    const path = require('path');
    const PizZip = require('pizzip');
    const Docxtemplater = require('docxtemplater');
    
    const templatePath = path.join(__dirname, '../frontend/public/contract_template_original.docx');
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found at: ${templatePath}`);
    }
    
    const templateContent = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(templateContent);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });
    
    console.log('📋 Rendering document with mock data...');
    doc.render(templateData);
    
    const buffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });
    
    // Save the generated contract
    const outputPath = path.join(__dirname, 'comprehensive_test_contract.docx');
    fs.writeFileSync(outputPath, buffer);
    
    console.log(`✅ Comprehensive contract generated successfully!`);
    console.log(`📄 Generated file: ${outputPath} (${buffer.length} bytes)`);
    
    // Analyze field coverage
    const generatedXml = new PizZip(buffer).file('word/document.xml').asText();
    const remainingPlaceholders = generatedXml.match(/\{[^}]+\}/g) || [];
    
    console.log(`\n📊 Template processing results:`);
    console.log(`• Total template data keys: ${Object.keys(templateData).length}`);
    console.log(`• Filled template data keys: ${Object.keys(templateData).filter(key => templateData[key] !== '').length}`);
    console.log(`• Remaining placeholders: ${remainingPlaceholders.length}`);
    
    if (remainingPlaceholders.length > 0) {
      console.log(`\n📋 Unfilled placeholders (need more data):`);
      const uniquePlaceholders = [...new Set(remainingPlaceholders)];
      uniquePlaceholders.slice(0, 15).forEach((placeholder, index) => {
        console.log(`${index + 1}. ${placeholder}`);
      });
      if (uniquePlaceholders.length > 15) {
        console.log(`... and ${uniquePlaceholders.length - 15} more`);
      }
    }
    
    // Show some key filled fields
    console.log(`\n📋 Key information successfully filled:`);
    const keyFields = {
      'Customer Name': templateData['mortgagor.name'],
      'ID Number': templateData['mortgagor.id.number'],
      'Property Certificate': templateData['SO_GCN'],
      'Property Address': templateData['DIA_CHI_TAI_SAN'],
      'Property Value': templateData['GIA_TRI_TAI_SAN'],
      'Land Area': templateData['DIEN_TICH_DAT'],
      'Bank Name': templateData['mortgagee.legal_name'],
      'Contract Number': templateData['doc.number'],
      'Signing Date': templateData['doc.signing_date']
    };
    
    Object.entries(keyFields).forEach(([label, value]) => {
      if (value) {
        console.log(`   ${label}: ${value}`);
      }
    });
    
    const filledPercentage = Math.round(
      (Object.keys(templateData).filter(key => templateData[key] !== '').length / Object.keys(templateData).length) * 100
    );
    
    console.log(`\n🎯 Overall completion: ${filledPercentage}% of template fields filled`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.properties && error.properties.errors) {
      console.error('\n📋 Template errors:');
      error.properties.errors.forEach((err, index) => {
        console.error(`${index + 1}. ${err.message} at ${err.part}`);
      });
    }
  }
}

// Run the test
testWithMockData().catch(console.error);