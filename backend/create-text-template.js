/**
 * Create a simple text-based contract template for testing
 */

const fs = require('fs');
const path = require('path');

function createSimpleTextTemplate() {
  const templateContent = `HỢP ĐỒNG TÍN DỤNG

Số hợp đồng: {{doc.number}}
Ngày ký: {{doc.signing_date}}
Nơi ký: {{doc.signing_location.office}}

1. THÔNG TIN BÊN CHO VAY:
Tên ngân hàng: {{branch.name}}
Địa chỉ: {{branch.address}}

2. THÔNG TIN BÊN VAY:
Họ tên: {{lender.name}}
Số CMND/CCCD: {{lender.id.number}}
Nơi cấp: {{lender.id.issuer}}
Ngày cấp: {{lender.id.issue_date}}
Địa chỉ: {{lender.address.original}}

3. THÔNG TIN TÀI SẢN ĐẢM BẢO:
Địa chỉ tài sản: {{prop.address}}
Diện tích: {{prop.area}}
Giá trị: {{prop.value}}
Số giấy chứng nhận: {{prop.certID}}

4. THÔNG TIN KHOẢN VAY:
Số tiền vay: {{loan.amount}}

Ký tên:
{{lender.name}}
`;

  const templatePath = path.join(__dirname, '../frontend/public/contract_template.txt');
  fs.writeFileSync(templatePath, templateContent, 'utf8');
  
  console.log('✅ Simple text template created successfully!');
  console.log(`   📁 Saved to: ${templatePath}`);
  
  return templatePath;
}

// Generate the text template
createSimpleTextTemplate();