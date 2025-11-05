/**
 * Document Processing Service
 * 
 * This service routes documents to the appropriate OCR API based on document type:
 * - FPT.AI: ID Card, Passport
 * - AWS Bedrock: Legal Registration, Business Registration, Financial Statement
 */

const fptaiConfig = require('../config/fptai-config');
const bedrockConfig = require('../config/bedrock-config');
const { pool } = require('../db');

// Document type to API routing configuration
const DOCUMENT_ROUTING = {
  'ID Card': 'FPTAI',
  'Passport': 'FPTAI',
  'Legal Registration': 'BEDROCK',
  'Business Registration': 'BEDROCK',
  'Financial Statement': 'BEDROCK'
};

/**
 * Process document with appropriate OCR service
 * @param {Buffer} fileBuffer - File buffer to process
 * @param {String} fileName - Original file name
 * @param {String} documentType - Type of document
 * @param {String} documentId - Database document ID
 * @returns {Promise<Object>} - Processing result with extracted data
 */
async function processDocument(fileBuffer, fileName, documentType, documentId) {
  try {
    console.log(`\n🔄 Processing document ${documentId}: ${fileName} (${documentType})`);
    
    // Determine which API to use
    const apiType = DOCUMENT_ROUTING[documentType];
    
    if (!apiType) {
      throw new Error(`Unknown document type: ${documentType}`);
    }

    console.log(`📍 Routing to: ${apiType}`);

    let extractionResult;
    let parsedResult;

    // Route to appropriate API
    if (apiType === 'FPTAI') {
      // Process with FPT.AI
      extractionResult = await fptaiConfig.submitDocumentForOCR(
        fileBuffer, 
        fileName, 
        documentType, 
        documentId
      );

      if (!extractionResult.success) {
        throw new Error(`FPT.AI extraction failed: ${extractionResult.error}`);
      }

      // Parse FPT.AI result
      parsedResult = fptaiConfig.parseExtractionResult(
        extractionResult.data, 
        documentType
      );

    } else if (apiType === 'BEDROCK') {
      // Process with AWS Bedrock
      extractionResult = await bedrockConfig.submitDocumentForOCR(
        fileBuffer, 
        fileName, 
        documentType, 
        documentId
      );

      if (!extractionResult.success) {
        throw new Error(`Bedrock extraction failed: ${extractionResult.error}`);
      }

      // Parse Bedrock result
      parsedResult = bedrockConfig.parseExtractionResult(
        extractionResult.data, 
        documentType
      );
    }

    if (!parsedResult.success) {
      throw new Error(`Failed to parse extraction result: ${parsedResult.error}`);
    }

    // Update document in database with extraction results
    await updateDocumentWithExtractionResults(documentId, parsedResult, apiType);

    console.log(`✅ Document ${documentId} processed successfully`);
    console.log(`   - API Used: ${apiType}`);
    console.log(`   - Confidence: ${parsedResult.confidenceScore}%`);
    console.log(`   - Needs Review: ${parsedResult.needsManualReview ? 'YES' : 'NO'}`);

    return {
      success: true,
      documentId,
      apiUsed: apiType,
      confidenceScore: parsedResult.confidenceScore,
      needsManualReview: parsedResult.needsManualReview,
      extractedData: parsedResult.extractedData,
      message: 'Document processed successfully'
    };

  } catch (error) {
    console.error(`❌ Error processing document ${documentId}:`, error.message);
    
    // Update document status to indicate error
    try {
      await pool.query(
        `UPDATE documents 
         SET status = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE document_id = $2`,
        ['Uploaded', documentId] // Revert to Uploaded status on error
      );
    } catch (dbError) {
      console.error('❌ Failed to update document status:', dbError.message);
    }

    return {
      success: false,
      documentId,
      error: error.message,
      message: 'Document processing failed'
    };
  }
}

/**
 * Update document record with extraction results
 * @param {String} documentId - Document ID
 * @param {Object} parsedResult - Parsed extraction result
 * @param {String} apiUsed - Which API was used (FPTAI or BEDROCK)
 */
async function updateDocumentWithExtractionResults(documentId, parsedResult, apiUsed) {
  try {
    const updateQuery = `
      UPDATE documents 
      SET 
        status = $1,
        ocr_extracted_json = $2,
        confidence_score = $3,
        needs_manual_review = $4,
        extraction_completed_at = CURRENT_TIMESTAMP,
        textract_job_id = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE document_id = $6
      RETURNING *
    `;

    // Store API source in the JSON for reference
    const extractionData = {
      api_source: apiUsed,
      confidence_score: parsedResult.confidenceScore,
      needs_manual_review: parsedResult.needsManualReview,
      extracted_fields: parsedResult.extractedData,
      raw_response: parsedResult.rawResponse,
      processed_at: new Date().toISOString()
    };

    await pool.query(updateQuery, [
      'Extracted', // Update status to Extracted
      JSON.stringify(extractionData),
      parsedResult.confidenceScore,
      parsedResult.needsManualReview,
      `${apiUsed.toLowerCase()}-${Date.now()}`, // Job ID for tracking
      documentId
    ]);

    console.log(`💾 Database updated for document ${documentId}`);

  } catch (error) {
    console.error(`❌ Error updating document ${documentId}:`, error.message);
    throw error;
  }
}

/**
 * Get supported document types
 * @returns {Array} - List of supported document types
 */
function getSupportedDocumentTypes() {
  return Object.keys(DOCUMENT_ROUTING);
}

/**
 * Get API type for document type
 * @param {String} documentType - Document type
 * @returns {String} - API type (FPTAI or BEDROCK)
 */
function getAPIForDocumentType(documentType) {
  return DOCUMENT_ROUTING[documentType] || null;
}

/**
 * Validate document type
 * @param {String} documentType - Document type to validate
 * @returns {Boolean} - Whether document type is supported
 */
function isDocumentTypeSupported(documentType) {
  return Object.keys(DOCUMENT_ROUTING).includes(documentType);
}

module.exports = {
  processDocument,
  getSupportedDocumentTypes,
  getAPIForDocumentType,
  isDocumentTypeSupported,
  DOCUMENT_ROUTING
};

