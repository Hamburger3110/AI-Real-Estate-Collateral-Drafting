/**
 * Create minimal working Word template
 */

const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

function createMinimalWordTemplate() {
  console.log('🔄 Creating minimal Word template...');
  
  // Minimal Word document structure
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>HỢP ĐỒNG TÍN DỤNG</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>Số hợp đồng: </w:t>
      </w:r>
      <w:r>
        <w:t>{doc_number}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>Họ tên: </w:t>
      </w:r>
      <w:r>
        <w:t>{lender_name}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>Số tiền vay: </w:t>
      </w:r>
      <w:r>
        <w:t>{loan_amount}</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;

  const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Contract Generator</Application>
</Properties>`;

  const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Contract Template</dc:title>
  <dc:creator>AI System</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">2024-01-01T00:00:00Z</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">2024-01-01T00:00:00Z</dcterms:modified>
</cp:coreProperties>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

  const mainRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

  // Create the zip structure
  const zip = new PizZip();
  
  // Add files to the zip
  zip.file('[Content_Types].xml', contentTypesXml);
  zip.file('_rels/.rels', mainRelsXml);
  zip.file('word/document.xml', documentXml);
  zip.file('docProps/core.xml', coreXml);
  zip.file('docProps/app.xml', appXml);
  
  // Generate the buffer and save
  const buffer = zip.generate({ type: 'nodebuffer' });
  const templatePath = path.join(__dirname, '../frontend/public/contract_template.docx');
  
  fs.writeFileSync(templatePath, buffer);
  
  console.log('✅ Minimal Word template created successfully!');
  console.log(`   📁 Saved to: ${templatePath}`);
  console.log('   📝 Template uses single braces {field.name} for docxtemplater');
  
  return templatePath;
}

// Create the template
createMinimalWordTemplate();