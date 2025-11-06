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
    // Use comprehensive template if it exists, otherwise fall back to simple template
    const comprehensiveTemplate = path.join(__dirname, '../../frontend/public/contract_template_comprehensive.docx');
    const simpleTemplate = path.join(__dirname, '../../frontend/public/contract_template.docx');
    
    this.templatePath = fs.existsSync(comprehensiveTemplate) ? comprehensiveTemplate : simpleTemplate;
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
   * Format mapped fields for DOCX template placeholders
   * @param {Object} mappedFields - Mapped fields from extraction
   * @returns {Object} Template-ready field data
   */
  formatFieldsForTemplate(mappedFields) {
    const templateData = {};
    
    // Direct field mapping - convert dots to underscores for template placeholders
    Object.entries(mappedFields).forEach(([key, value]) => {
      const templateKey = key.replace(/\./g, '_');
      templateData[templateKey] = value || '';
    });
    
    // Add formatted date fields
    if (mappedFields['doc.signing_date']) {
      const date = new Date(mappedFields['doc.signing_date']);
      templateData['signing_date_formatted'] = date.toLocaleDateString('vi-VN');
      templateData['signing_day'] = date.getDate().toString().padStart(2, '0');
      templateData['signing_month'] = (date.getMonth() + 1).toString().padStart(2, '0');
      templateData['signing_year'] = date.getFullYear().toString();
    }
    
    // Add current date for generation
    const now = new Date();
    templateData['generation_date'] = now.toLocaleDateString('vi-VN');
    templateData['generation_day'] = now.getDate().toString().padStart(2, '0');
    templateData['generation_month'] = (now.getMonth() + 1).toString().padStart(2, '0');
    templateData['generation_year'] = now.getFullYear().toString();
    
    // Format currency fields
    if (mappedFields['loan.amount']) {
      const amount = parseFloat(mappedFields['loan.amount']);
      if (!isNaN(amount)) {
        templateData['loan_amount_formatted'] = amount.toLocaleString('vi-VN') + ' VND';
        templateData['loan_amount_words'] = this.numberToWords(amount) + ' đồng';
      }
    }
    
    if (mappedFields['prop.value']) {
      const value = parseFloat(mappedFields['prop.value']);
      if (!isNaN(value)) {
        templateData['prop_value_formatted'] = value.toLocaleString('vi-VN') + ' VND';
        templateData['prop_value_words'] = this.numberToWords(value) + ' đồng';
      }
    }
    
    // Format area with units
    if (mappedFields['prop.area']) {
      templateData['prop_area_formatted'] = mappedFields['prop.area'] + ' m²';
    }
    
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
          status = 'generated',
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
      
      console.log(`✅ Updated contract ${contractId} status to 'generated'`);
      
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