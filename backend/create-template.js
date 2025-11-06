const fs = require('fs');
const path = require('path');
const docx = require('docx');

/**
 * Create a simple contract template with all required placeholders
 */
async function createSimpleTemplate() {
  const { Document, Paragraph, TextRun, AlignmentType, HeadingLevel } = docx;
  
  // Create a simple document with all the expected placeholders
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: "HỢP ĐỒNG TÍN DỤNG",
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
        }),
        
        new Paragraph({
          text: "",
        }),
        
        new Paragraph({
          children: [
            new TextRun("Số hợp đồng: "),
            new TextRun("{{doc.number}}")
          ]
        }),
        
        new Paragraph({
          children: [
            new TextRun("Ngày ký: "),
            new TextRun("{{doc.signing_date}}")
          ]
        }),
        
        new Paragraph({
          children: [
            new TextRun("Nơi ký: "),
            new TextRun("{{doc.signing_location.office}}")
          ]
        }),
        
        new Paragraph({
          text: "",
        }),
        
        new Paragraph({
          text: "1. THÔNG TIN BÊN CHO VAY:",
          heading: HeadingLevel.HEADING_2,
        }),
        
        new Paragraph({
          children: [
            new TextRun("Tên ngân hàng: "),
            new TextRun("{{branch.name}}")
          ]
        }),
        
        new Paragraph({
          children: [
            new TextRun("Địa chỉ: "),
            new TextRun("{{branch.address}}")
          ]
        }),
        
        new Paragraph({
          text: "2. THÔNG TIN BÊN VAY:",
          heading: HeadingLevel.HEADING_2,
        }),
        
        new Paragraph({
          children: [
            new TextRun("Họ tên: "),
            new TextRun("{{lender.name}}")
          ]
        }),
        
        new Paragraph({
          children: [
            new TextRun("Số CMND/CCCD: "),
            new TextRun("{{lender.id.number}}")
          ]
        }),
        
        new Paragraph({
          children: [
            new TextRun("Nơi cấp: "),
            new TextRun("{{lender.id.issuer}}")
          ]
        }),
        
        new Paragraph({
          children: [
            new TextRun("Ngày cấp: "),
            new TextRun("{{lender.id.issue_date}}")
          ]
        }),
        
        new Paragraph({
          children: [
            new TextRun("Địa chỉ: "),
            new TextRun("{{lender.address.original}}")
          ]
        }),
        
        new Paragraph({
          text: "3. THÔNG TIN TÀI SAN ĐẢM BẢO:",
          heading: HeadingLevel.HEADING_2,
        }),
        
        new Paragraph({
          children: [
            new TextRun("Địa chỉ tài sản: "),
            new TextRun("{{prop.address}}")
          ]
        }),
        
        new Paragraph({
          children: [
            new TextRun("Diện tích: "),
            new TextRun("{{prop.area}}")
          ]
        }),
        
        new Paragraph({
          children: [
            new TextRun("Giá trị: "),
            new TextRun("{{prop.value}}")
          ]
        }),
        
        new Paragraph({
          children: [
            new TextRun("Số giấy chứng nhận: "),
            new TextRun("{{prop.certID}}")
          ]
        }),
        
        new Paragraph({
          text: "4. THÔNG TIN KHOẢN VAY:",
          heading: HeadingLevel.HEADING_2,
        }),
        
        new Paragraph({
          children: [
            new TextRun("Số tiền vay: "),
            new TextRun("{{loan.amount}}")
          ]
        }),
        
        new Paragraph({
          text: "",
        }),
        
        new Paragraph({
          text: "Ký tên:",
          alignment: AlignmentType.RIGHT,
        }),
        
        new Paragraph({
          text: "",
        }),
        
        new Paragraph({
          text: "{{lender.name}}",
          alignment: AlignmentType.RIGHT,
        }),
      ],
    }],
  });
  
  return doc;
}

// Generate and save the template
async function generateTemplate() {
  try {
    console.log('🔄 Creating new contract template...');
    
    const doc = await createSimpleTemplate();
    const buffer = await docx.Packer.toBuffer(doc);
    
    const templatePath = path.join(__dirname, '../frontend/public/contract_template.docx');
    fs.writeFileSync(templatePath, buffer);
    
    console.log('✅ New contract template created successfully!');
    console.log(`   📁 Saved to: ${templatePath}`);
    console.log('   📝 Template includes all required placeholders');
    
  } catch (error) {
    console.error('❌ Error creating template:', error);
  }
}

// Run if called directly
if (require.main === module) {
  generateTemplate();
}

module.exports = { generateTemplate };