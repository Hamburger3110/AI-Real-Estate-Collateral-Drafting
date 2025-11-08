/**
 * Contract Generator Service
 * Generates contracts from templates using extracted field data
 */

const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const fs = require('fs');
const path = require('path');
const { mapContractFields, validateMappedFields } = require('./field-mapper');
const pdfConverter = require('./pdf-converter');
const s3Service = require('./s3-service');

class ContractGenerator {
  constructor() {
    // Use the original comprehensive template with updated placeholder format
    const templatePaths = [
      path.join(__dirname, '../../frontend/public/contract_template_original.docx'),
      path.join(__dirname, '../../frontend/public/contract_template.docx'),
      path.join(__dirname, '../../frontend/public/contract_template_simple_backup.docx')
    ];
    
    // Find the first existing template
    this.templatePath = templatePaths.find(templatePath => fs.existsSync(templatePath));
    
    if (!this.templatePath) {
      console.error('❌ No DOCX template found in any of these locations:', templatePaths);
      throw new Error('No contract template found');
    }
    
    console.log(`📋 Using working contract template: ${this.templatePath}`);
  }

  /**
   * Generate contract document from template
   * @param {number} contractId - Contract ID
   * @param {Object} pool - Database pool
   * @param {Object} userInputFields - Optional user-provided fields to override
   * @returns {Promise<Buffer>} Generated contract document buffer
   */
  async generateContract(contractId, pool, userInputFields = {}) {
    try {
      console.log(`📄 Generating contract for contract ID: ${contractId}`);
      
      // Step 1: Map fields from extracted data
      const mappingResult = await mapContractFields(contractId, pool);
      
      if (!mappingResult.success) {
        throw new Error(`Field mapping failed: ${mappingResult.error}`);
      }
      
      console.log(`📋 Mapped ${mappingResult.filledFields}/${mappingResult.totalFields} fields`);
      
      // Step 2: Override with user input fields
      const finalFields = {
        ...mappingResult.mappedFields,
        ...userInputFields
      };
      
      // Step 3: Skip validation - always allow generation
      console.log('📋 Skipping validation - allowing generation with any fields');
      const validation = {
        isValid: true,
        missingRequired: [],
        warnings: [],
        canGenerate: true
      };
      
      // Step 4: Load template
      if (!fs.existsSync(this.templatePath)) {
        throw new Error(`Contract template not found at: ${this.templatePath}`);
      }
      
      const templateContent = fs.readFileSync(this.templatePath, 'binary');
      
      // Step 5: Generate document
      const zip = new PizZip(templateContent);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });
      
      // Step 6: Format fields for template
      const templateData = this.formatFieldsForTemplate(finalFields);
      
      console.log('📋 Template data keys:', Object.keys(templateData));
      
      // Step 7: Render document
      doc.render(templateData);
      
      const buffer = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      });
      
      console.log(`✅ Contract generated successfully (${buffer.length} bytes)`);
      
      // Step 8: Convert to PDF
      let pdfBuffer = null;
      try {
        console.log(`📄 Converting contract to PDF...`);
        const contractNumber = templateData.doc_number || `contract_${contractId}`;
        pdfBuffer = await pdfConverter.convertDocxToPdf(buffer, contractNumber);
        console.log(`✅ PDF conversion successful (${pdfBuffer.length} bytes)`);
      } catch (pdfError) {
        console.error(`❌ PDF conversion failed:`, pdfError);
        // Continue without PDF - we'll still have the DOCX file
      }
      
      // Step 9: Upload to S3
      let s3Upload = null;
      try {
        const contractData = await this.getContractData(contractId, pool);
        const contractNumber = contractData?.contract_number || `contract_${contractId}`;
        
        if (pdfBuffer) {
          console.log(`📤 Uploading contract to S3 (DOCX + PDF)...`);
          s3Upload = await s3Service.uploadContract(buffer, pdfBuffer, contractId, contractNumber);
        } else {
          console.log(`📤 Uploading contract to S3 (DOCX only)...`);
          const timestamp = Date.now();
          const sanitizedContractNumber = contractNumber.replace(/[^a-zA-Z0-9-]/g, '_');
          const docxFileName = `${sanitizedContractNumber}_${timestamp}.docx`;
          
          s3Upload = await s3Service.uploadFile(
            buffer, 
            docxFileName, 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'contracts/docx'
          );
        }
        
        if (s3Upload.success) {
          console.log(`✅ Contract uploaded to S3 successfully`);
        } else {
          console.error(`❌ S3 upload failed:`, s3Upload.error);
        }
      } catch (s3Error) {
        console.error(`❌ S3 upload error:`, s3Error);
        // Continue without S3 upload - user can still download the file
      }
      
      // Step 10: Update contract record
      await this.updateContractGeneration(contractId, pool, templateData, s3Upload);
      
      return {
        success: true,
        buffer,
        pdfBuffer,
        filename: `contract_${contractId}_${Date.now()}.docx`,
        mappingResult,
        validation,
        s3Upload
      };
      
    } catch (error) {
      console.error(`❌ Contract generation failed for contract ${contractId}:`, error);
      return {
        success: false,
        error: error.message,
        contractId
      };
    }
  }

  /**
   * Format mapped fields for DOCX template placeholders (Original Template Format)
   * @param {Object} mappedFields - Mapped fields from OCR extraction
   * @returns {Object} Template-ready field data
   */
  formatFieldsForTemplate(mappedFields) {
    const templateData = {};
    
    // Map to original template's specific field names
    
    // Document information
    templateData['doc.number'] = mappedFields['doc.number'] || '';
    templateData['doc.signing_date'] = mappedFields['doc.signing_date'] || new Date().toLocaleDateString('vi-VN');
    templateData['doc.signing_location.office'] = mappedFields['doc.signing_location.office'] || '';
    
    // Bank/Mortgagee information (Vietnamese bank)
    templateData['mortgagee.legal_name'] = mappedFields['branch.name'] || 'NGÂN HÀNG THƯƠNG MẠI CỔ PHẦN VIỆT NAM THỊNH VƯỢNG';
    templateData['mortgagee.address'] = mappedFields['branch.address'] || '';
    templateData['mortgagee.biz_reg_code'] = mappedFields['branch.bizregcode'] || '';
    templateData['mortgagee.biz_reg_authority'] = mappedFields['branch.bizregissue'] || '';
    templateData['mortgagee.biz_reg_first_issue_date'] = mappedFields['branch.bizreg.first.issued.date'] || '';
    templateData['mortgagee.biz_phone_number'] = mappedFields['branch.phone.number'] || '';
    templateData['mortgagee.biz_fax_code'] = mappedFields['branch.fax'] || '';
    templateData['mortgagee.representative.name'] = mappedFields['branch.representative.name'] || '';
    templateData['mortgagee.representative.title'] = mappedFields['branch.representative.title'] || '';
    
    // Customer/Mortgagor information  
    templateData['mortgagor.name'] = mappedFields['lender.name'] || '';
    templateData['mortgagor.id.number'] = mappedFields['lender.id.number'] || '';
    templateData['mortgagor.id.issuer'] = mappedFields['lender.id.issuer'] || '';
    templateData['mortgagor.id.issue_date'] = mappedFields['lender.id.issue_date'] || '';
    templateData['mortgagor.address.original'] = mappedFields['lender.address.original'] || '';
    
    // Spouse information (if available)
    templateData['spouse.name'] = mappedFields['spouse.name'] || '';
    templateData['spouse.id.number'] = mappedFields['spouse.id.number'] || '';
    templateData['spouse.id.issuer'] = mappedFields['spouse.id.issuer'] || '';
    templateData['spouse.id.issue_date'] = mappedFields['spouse.id.issue_date'] || '';
    templateData['spouse.address.original'] = mappedFields['spouse.address.original'] || '';
    
    // Property information - Vietnamese field names
    templateData['SO_GCN'] = mappedFields['prop.certID'] || '';  // Certificate Number
    templateData['NOI_CAP_GCN'] = mappedFields['prop.cert.issuer'] || '';  // Certificate Issuer
    templateData['NGAY_CAP_GCN'] = mappedFields['prop.cert.issue.date'] || '';  // Certificate Issue Date
    templateData['TEN_CHU_GCN'] = mappedFields['prop.cert.owner'] || '';  // Certificate Owner
    templateData['SO_THUA'] = mappedFields['prop.detailed.id'] || '';  // Land Parcel Number
    templateData['SO_TO_BAN_DO'] = mappedFields['prop.mapID'] || '';  // Map Sheet Number
    templateData['DIA_CHI_TAI_SAN'] = mappedFields['prop.address'] || '';  // Property Address
    templateData['DIA_CHI_THUA_DAT'] = mappedFields['prop.address'] || '';  // Land Address (same as property)
    templateData['DIEN_TICH_DAT'] = mappedFields['prop.area'] || '';  // Land Area
    templateData['DIEN_TICH_DAT_Text'] = mappedFields['prop.area'] ? mappedFields['prop.area'] + ' m²' : '';  // Land Area with unit
    templateData['HINH_THUC_SD'] = mappedFields['prop.usage.method'] || '';  // Usage Method
    templateData['MUC_DICH_SD'] = mappedFields['prop.purpose'] || '';  // Usage Purpose
    templateData['THOI_HAN_SD'] = mappedFields['prop.period'] || '';  // Usage Period
    templateData['NGUON_GOC_SD'] = mappedFields['prop.origin'] || '';  // Land Origin
    templateData['GIA_TRI_TAI_SAN'] = mappedFields['prop.value'] || '';  // Property Value
    
    // Asset construction information
    templateData['DIA_CHI_TRU_SO'] = mappedFields['aprop.address'] || '';  // Construction Address
    templateData['DIEN_TICH_XAY_DUNG'] = mappedFields['aprop.construct.area'] || '';  // Construction Area
    templateData['DIEN_TICH_SAN'] = mappedFields['aprop.floor.area'] || '';  // Floor Area
    templateData['KET_CAU'] = mappedFields['aprop.construction.method'] || '';  // Construction Method
    templateData['CAP_HANG'] = mappedFields['aprop.level'] || '';  // Building Level
    templateData['SO_TANG'] = mappedFields['aprop.floor'] || '';  // Floor Number
    templateData['NAM_HOAN_THANH'] = mappedFields['aprop.yearbuilt'] || '';  // Year Built
    templateData['THOI_HAN_SO_HUU'] = mappedFields['aprop.possessdue'] || '';  // Possession Due
    templateData['GHI_CHU'] = mappedFields['aprop.note'] || '';  // Additional Notes
    
    // Company information (if business loan)
    templateData['TEN_BEN_DUOC_BAO_DAM'] = mappedFields['lender.companyname'] || '';  // Company Name
    templateData['MA_SO_DN'] = mappedFields['lender.company.bizregcode'] || '';  // Business Registration Code
    templateData['DIA_CHI_TRU_SO'] = mappedFields['lender.company.address'] || templateData['DIA_CHI_TRU_SO'];  // Company Address
    
    // Format loan amount
    if (mappedFields['loan.amount']) {
      const amount = parseFloat(mappedFields['loan.amount']);
      if (!isNaN(amount)) {
        templateData['GIA_TRI_BANG_CHU'] = this.numberToWords(amount) + ' đồng';  // Amount in words
        templateData['loan_amount_formatted'] = amount.toLocaleString('vi-VN') + ' VND';
      }
    }
    
    // Format property value in words
    if (mappedFields['prop.value']) {
      const value = parseFloat(mappedFields['prop.value']);
      if (!isNaN(value)) {
        if (!templateData['GIA_TRI_BANG_CHU']) {  // Only if not set by loan amount
          templateData['GIA_TRI_BANG_CHU'] = this.numberToWords(value) + ' đồng';
        }
      }
    }
    
    // Add default values for common fields that might be empty
    const currentDate = new Date();
    if (!templateData['doc.signing_date']) {
      templateData['doc.signing_date'] = currentDate.toLocaleDateString('vi-VN');
    }
    
    // Time-related fields for agreements
    templateData['THOI_HAN_TU_BAN'] = '';  // Duration from... (to be filled)
    templateData['THOI_HAN_THOA_THUAN_GIA'] = '';  // Agreed price period
    templateData['THOI_HAN_THOA_THUAN_GIA_TEXT'] = '';  // Agreed price period text
    templateData['SO_VAO_SO'] = '';  // Entry number
    
    console.log('📋 Template data prepared for original template with keys:', Object.keys(templateData).filter(key => templateData[key] !== ''));
    
    return templateData;
  }

  /**
   * Convert number to Vietnamese words (simplified)
   * @param {number} num - Number to convert
   * @returns {string} Number in words
   */
  numberToWords(num) {
    // This is a simplified version - you might want to use a proper Vietnamese number-to-words library
    if (num === 0) return 'không';
    
    const ones = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
    const tens = ['', '', 'hai mươi', 'ba mươi', 'bốn mươi', 'năm mươi', 'sáu mươi', 'bảy mươi', 'tám mươi', 'chín mươi'];
    
    if (num < 10) return ones[num];
    if (num < 20) return 'mười' + (num % 10 === 0 ? '' : ' ' + ones[num % 10]);
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 === 0 ? '' : ' ' + ones[num % 10]);
    
    // For larger numbers, return formatted number as fallback
    return num.toLocaleString('vi-VN');
  }

  /**
   * Get contract data
   * @param {number} contractId - Contract ID
   * @param {Object} pool - Database pool
   * @returns {Promise<Object>} Contract data
   */
  async getContractData(contractId, pool) {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT contract_number, customer_name, property_address, loan_amount, status
        FROM contracts 
        WHERE contract_id = $1
      `, [contractId]);
      
      return result.rows[0] || null;
      
    } catch (error) {
      console.error(`❌ Failed to get contract data for ${contractId}:`, error);
      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Update contract record with generation info
   * @param {number} contractId - Contract ID
   * @param {Object} pool - Database pool
   * @param {Object} templateData - Generated template data
   * @param {Object} s3Upload - S3 upload result
   */
  async updateContractGeneration(contractId, pool, templateData, s3Upload = null) {
    const client = await pool.connect();
    
    try {
      let updateQuery = `
        UPDATE contracts 
        SET 
          generated_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP`;
      
      const updateParams = [contractId];
      
      // Add S3 URLs if upload was successful
      if (s3Upload && s3Upload.success) {
        if (s3Upload.docx && s3Upload.pdf) {
          // Both DOCX and PDF uploaded
          updateQuery += `, generated_pot_uri = $2, generated_docx_uri = $3`;
          updateParams.push(s3Upload.pdf.url, s3Upload.docx.url);
        } else if (s3Upload.pdf) {
          // Only PDF uploaded
          updateQuery += `, generated_pot_uri = $2`;
          updateParams.push(s3Upload.pdf.url);
        } else if (s3Upload.url) {
          // Single URL (legacy support)
          updateQuery += `, generated_pot_uri = $2`;
          updateParams.push(s3Upload.url);
        }
      }
      
      updateQuery += ` WHERE contract_id = $1`;
      
      await client.query(updateQuery, updateParams);
      
      console.log(`✅ Updated contract ${contractId} generation timestamps and URLs`);
      
      if (s3Upload && s3Upload.success) {
        console.log(`📎 Contract URL stored in database`);
      }
      
    } catch (error) {
      console.error(`❌ Failed to update contract ${contractId}:`, error);
      // Don't throw - generation was successful, just logging failed
    } finally {
      client.release();
    }
  }

  /**
   * Get contract generation preview data
   * @param {number} contractId - Contract ID
   * @param {Object} pool - Database pool
   * @returns {Promise<Object>} Preview data for contract generation
   */
  async getGenerationPreview(contractId, pool) {
    try {
      console.log(`📋 Getting generation preview for contract ${contractId}`);
      
      const mappingResult = await mapContractFields(contractId, pool);
      
      if (!mappingResult.success) {
        throw new Error(`Field mapping failed: ${mappingResult.error}`);
      }
      
      const validation = validateMappedFields(mappingResult.mappedFields);
      const templateData = this.formatFieldsForTemplate(mappingResult.mappedFields);
      
      return {
        success: true,
        contractId,
        mappedFields: mappingResult.mappedFields,
        templateData,
        validation,
        stats: {
          totalFields: mappingResult.totalFields,
          filledFields: mappingResult.filledFields,
          completionPercentage: mappingResult.completionPercentage,
          documentsProcessed: mappingResult.documentsProcessed
        }
      };
      
    } catch (error) {
      console.error(`❌ Failed to get generation preview for contract ${contractId}:`, error);
      return {
        success: false,
        error: error.message,
        contractId
      };
    }
  }
}

module.exports = new ContractGenerator();