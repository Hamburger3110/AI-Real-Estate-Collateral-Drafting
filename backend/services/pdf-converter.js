/**
 * PDF Conversion Service
 * Converts DOCX files to PDF format
 */

const mammoth = require('mammoth');
const htmlPdf = require('html-pdf-node');
const fs = require('fs');
const path = require('path');

class PDFConverterService {
  /**
   * Convert DOCX buffer to PDF buffer
   * @param {Buffer} docxBuffer - DOCX file buffer
   * @param {string} contractNumber - Contract number for filename
   * @returns {Promise<Buffer>} PDF buffer
   */
  async convertDocxToPdf(docxBuffer, contractNumber = 'contract') {
    try {
      console.log(`📄 Converting DOCX to PDF for ${contractNumber}...`);
      
      // Step 1: Convert DOCX to HTML using mammoth
      console.log('   🔄 Converting DOCX to HTML...');
      const result = await mammoth.convertToHtml({ buffer: docxBuffer });
      let htmlContent = result.value;
      
      if (result.messages && result.messages.length > 0) {
        console.log('   ⚠️ Conversion warnings:', result.messages.map(m => m.message));
      }
      
      // Step 2: Enhance HTML with proper styling for Vietnamese content
      const styledHtml = this.addPdfStyling(htmlContent, contractNumber);
      
      // Step 3: Convert HTML to PDF
      console.log('   🔄 Converting HTML to PDF...');
      const pdfOptions = {
        format: 'A4',
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        printBackground: true,
        preferCSSPageSize: true
      };
      
      const file = { content: styledHtml };
      const pdfBuffer = await htmlPdf.generatePdf(file, pdfOptions);
      
      console.log(`✅ PDF conversion completed (${pdfBuffer.length} bytes)`);
      
      return pdfBuffer;
      
    } catch (error) {
      console.error(`❌ PDF conversion failed for ${contractNumber}:`, error);
      throw new Error(`PDF conversion failed: ${error.message}`);
    }
  }

  /**
   * Add proper styling to HTML for PDF generation
   * @param {string} htmlContent - Raw HTML content from DOCX
   * @param {string} contractNumber - Contract number for title
   * @returns {string} Styled HTML content
   */
  addPdfStyling(htmlContent, contractNumber) {
    return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contract ${contractNumber}</title>
    <style>
        @page {
            size: A4;
            margin: 20mm 15mm;
        }
        
        body {
            font-family: 'Times New Roman', serif;
            font-size: 12pt;
            line-height: 1.5;
            color: #000;
            margin: 0;
            padding: 0;
        }
        
        .container {
            max-width: 100%;
            margin: 0 auto;
        }
        
        h1, h2, h3, h4, h5, h6 {
            font-weight: bold;
            margin: 20px 0 10px 0;
            page-break-after: avoid;
        }
        
        h1 {
            font-size: 16pt;
            text-align: center;
            text-transform: uppercase;
            margin-bottom: 30px;
        }
        
        h2 {
            font-size: 14pt;
        }
        
        h3 {
            font-size: 13pt;
        }
        
        p {
            margin: 10px 0;
            text-align: justify;
            text-indent: 1cm;
        }
        
        .no-indent {
            text-indent: 0;
        }
        
        .center {
            text-align: center;
            text-indent: 0;
        }
        
        .right {
            text-align: right;
            text-indent: 0;
        }
        
        .bold {
            font-weight: bold;
        }
        
        .underline {
            text-decoration: underline;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            page-break-inside: avoid;
        }
        
        table, th, td {
            border: 1px solid #000;
        }
        
        th, td {
            padding: 8px;
            text-align: left;
            vertical-align: top;
        }
        
        th {
            background-color: #f5f5f5;
            font-weight: bold;
            text-align: center;
        }
        
        .signature-section {
            margin-top: 40px;
            page-break-inside: avoid;
        }
        
        .signature-table {
            width: 100%;
            border: none;
        }
        
        .signature-table td {
            border: none;
            text-align: center;
            padding: 20px;
            vertical-align: top;
        }
        
        .page-break {
            page-break-before: always;
        }
        
        /* Handle Vietnamese text properly */
        .vietnamese {
            font-family: 'Times New Roman', 'Arial Unicode MS', serif;
        }
        
        /* Print specific styles */
        @media print {
            body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
        }
    </style>
</head>
<body class="vietnamese">
    <div class="container">
        ${htmlContent}
    </div>
</body>
</html>`;
  }

  /**
   * Create a simple PDF from text content (fallback method)
   * @param {string} textContent - Plain text content
   * @param {string} title - Document title
   * @returns {Promise<Buffer>} PDF buffer
   */
  async createSimplePdf(textContent, title = 'Contract Document') {
    try {
      console.log(`📄 Creating simple PDF: ${title}...`);
      
      const htmlContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        body {
            font-family: 'Times New Roman', serif;
            font-size: 12pt;
            line-height: 1.6;
            margin: 40px;
            color: #000;
        }
        h1 {
            text-align: center;
            font-size: 18pt;
            margin-bottom: 30px;
            text-transform: uppercase;
        }
        .content {
            white-space: pre-wrap;
            text-align: justify;
        }
    </style>
</head>
<body>
    <h1>${title}</h1>
    <div class="content">${textContent}</div>
</body>
</html>`;

      const pdfOptions = {
        format: 'A4',
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' }
      };
      
      const file = { content: htmlContent };
      const pdfBuffer = await htmlPdf.generatePdf(file, pdfOptions);
      
      console.log(`✅ Simple PDF created (${pdfBuffer.length} bytes)`);
      return pdfBuffer;
      
    } catch (error) {
      console.error(`❌ Simple PDF creation failed:`, error);
      throw error;
    }
  }

  /**
   * Test PDF conversion capabilities
   * @returns {Promise<boolean>} Test result
   */
  async testPdfConversion() {
    try {
      console.log('🧪 Testing PDF conversion capabilities...');
      
      const testContent = 'Test content for PDF conversion\nThis is a simple test.';
      const pdfBuffer = await this.createSimplePdf(testContent, 'Test Document');
      
      if (pdfBuffer && pdfBuffer.length > 0) {
        console.log('✅ PDF conversion test passed');
        return true;
      } else {
        console.log('❌ PDF conversion test failed - empty buffer');
        return false;
      }
      
    } catch (error) {
      console.error('❌ PDF conversion test failed:', error);
      return false;
    }
  }
}

module.exports = new PDFConverterService();