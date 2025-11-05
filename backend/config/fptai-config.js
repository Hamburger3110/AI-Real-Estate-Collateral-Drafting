/**
 * FPT.AI OCR Integration Configuration
 * 
 * This module handles configuration and API calls to FPT.AI for document OCR extraction
 */

const axios = require('axios');
const FormData = require('form-data');

// FPT.AI API Configuration
const FPTAI_CONFIG = {
  // API key for FPT.AI services (must be set in .env file)
  apiKey: process.env.FPTAI_API_KEY,
  
  // Document type specific endpoints
  endpoints: {
    'ID Card': 'https://api.fpt.ai/vision/idr/vnm',
    'Passport': 'https://api.fpt.ai/vision/passport/vnm'
  },
  
  // Confidence threshold for manual review
  confidenceThreshold: 95,
  
  // Request timeout (30 seconds)
  timeout: 30000
};

// Validate that API key is configured
if (!FPTAI_CONFIG.apiKey) {
  console.error('❌ FPTAI_API_KEY is not set in environment variables');
  console.error('   Please set FPTAI_API_KEY in your .env file');
  throw new Error('FPTAI_API_KEY environment variable is required');
}

/**
 * Submit document to FPT.AI for OCR extraction
 * @param {Buffer} fileBuffer - File buffer to process
 * @param {String} fileName - Original file name
 * @param {String} documentType - Type of document (ID Card, Passport, etc.)
 * @param {String} documentId - Internal document ID for tracking
 * @returns {Promise<Object>} - FPT.AI extraction response
 */
async function submitDocumentForOCR(fileBuffer, fileName, documentType, documentId) {
  try {
    console.log(`📤 Submitting ${documentType} (document ${documentId}) to FPT.AI for OCR...`);
    
    // Get the appropriate endpoint for document type
    const endpoint = FPTAI_CONFIG.endpoints[documentType];
    
    if (!endpoint) {
      throw new Error(`Unsupported document type for FPT.AI: ${documentType}`);
    }

    // Create form data with file buffer
    const formData = new FormData();
    formData.append('image', fileBuffer, fileName);

    // Make API call to FPT.AI
    const response = await axios.post(
      endpoint,
      formData,
      {
        headers: {
          'api-key': FPTAI_CONFIG.apiKey,
          ...formData.getHeaders()
        },
        timeout: FPTAI_CONFIG.timeout
      }
    );

    console.log(`✅ FPT.AI OCR completed successfully for document ${documentId}`);
    console.log(`   Response:`, JSON.stringify(response.data, null, 2));
    
    return {
      success: true,
      data: response.data,
      documentId: documentId
    };

  } catch (error) {
    console.error(`❌ FPT.AI OCR submission failed for document ${documentId}:`, error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, error.response.data);
    }
    return {
      success: false,
      error: error.message,
      details: error.response?.data
    };
  }
}

/**
 * Parse FPT.AI extraction result and extract confidence score
 * @param {Object} fptaiResponse - Raw response from FPT.AI API
 * @param {String} documentType - Type of document (ID Card, Passport, etc.)
 * @returns {Object} - Parsed extraction data with confidence score
 */
function parseExtractionResult(fptaiResponse, documentType = 'ID Card') {
  try {
    console.log(`📋 Parsing FPT.AI response for ${documentType}...`);
    
    // FPT.AI returns data in different structures for ID vs Passport
    // Common structure: { errorCode, errorMessage, data: [...] }
    
    if (fptaiResponse.errorCode && fptaiResponse.errorCode !== 0) {
      throw new Error(fptaiResponse.errorMessage || 'FPT.AI extraction error');
    }

    // Extract data array from response
    const extractedData = fptaiResponse.data || [];
    
    // Calculate average confidence from all fields
    let totalConfidence = 0;
    let fieldCount = 0;
    
    extractedData.forEach(item => {
      if (item.confidence !== undefined) {
        totalConfidence += parseFloat(item.confidence) * 100; // Convert to percentage
        fieldCount++;
      }
    });
    
    const confidenceScore = fieldCount > 0 ? totalConfidence / fieldCount : 0;
    
    // Determine if manual review is needed
    const needsManualReview = confidenceScore < FPTAI_CONFIG.confidenceThreshold;

    // Format extracted fields into key-value pairs
    const extractedFields = {};
    extractedData.forEach(item => {
      if (item.name && item.value) {
        extractedFields[item.name] = {
          value: item.value,
          confidence: parseFloat(item.confidence) * 100
        };
      }
    });

    console.log(`✅ Parsing complete - Confidence: ${confidenceScore.toFixed(2)}%`);

    return {
      success: true,
      confidenceScore: parseFloat(confidenceScore.toFixed(2)),
      needsManualReview,
      extractedData: extractedFields,
      rawResponse: fptaiResponse
    };

  } catch (error) {
    console.error('❌ Error parsing FPT.AI extraction result:', error);
    return {
      success: false,
      error: error.message,
      confidenceScore: 0,
      needsManualReview: true,
      extractedData: {},
      rawResponse: fptaiResponse
    };
  }
}



module.exports = {
  FPTAI_CONFIG,
  submitDocumentForOCR,
  parseExtractionResult,
};

