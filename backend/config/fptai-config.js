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
    console.log(`📋 Raw response:`, JSON.stringify(fptaiResponse, null, 2));
    
    // FPT.AI returns data in different structures for different document types
    // Common structure: { errorCode, errorMessage, data: [...], overall_score }
    
    if (fptaiResponse.errorCode && fptaiResponse.errorCode !== 0) {
      throw new Error(fptaiResponse.errorMessage || 'FPT.AI extraction error');
    }

    // Extract overall confidence score
    let confidenceScore = 0;
    
    if (fptaiResponse.overall_score) {
      // Use overall_score if available at root level (ID Card format)
      confidenceScore = parseFloat(fptaiResponse.overall_score);
    } else {
      // Check if overall_score is in the data array (Passport format)
      const extractedData = fptaiResponse.data || [];
      if (extractedData.length > 0 && extractedData[0].overall_score) {
        confidenceScore = parseFloat(extractedData[0].overall_score);
      } else {
        // Calculate average confidence from individual field probabilities
        let totalConfidence = 0;
        let fieldCount = 0;
        
        extractedData.forEach(item => {
          // Look for probability fields (e.g., id_prob, name_prob, etc.)
          Object.keys(item).forEach(key => {
            if (key.endsWith('_prob') && item[key] && item[key] !== 'N/A') {
              const probValue = parseFloat(item[key]);
              if (!isNaN(probValue)) {
                totalConfidence += probValue;
                fieldCount++;
              }
            }
          });
        });
        
        confidenceScore = fieldCount > 0 ? totalConfidence / fieldCount : 0;
      }
    }
    
    // Determine if manual review is needed
    const needsManualReview = confidenceScore < FPTAI_CONFIG.confidenceThreshold;

    // Format extracted fields into standardized format
    const extractedFields = [];
    const extractedData = fptaiResponse.data || [];
    
    extractedData.forEach(item => {
      // Extract common ID card fields
      if (item.name) {
        extractedFields.push({
          field_name: 'Full Name',
          field_value: item.name,
          confidence_score: parseFloat(item.name_prob || 0)
        });
      }
      
      if (item.id) {
        extractedFields.push({
          field_name: 'ID Number',
          field_value: item.id,
          confidence_score: parseFloat(item.id_prob || 0)
        });
      }
      
      if (item.dob) {
        extractedFields.push({
          field_name: 'Date of Birth',
          field_value: item.dob,
          confidence_score: parseFloat(item.dob_prob || 0)
        });
      }
      
      if (item.sex) {
        extractedFields.push({
          field_name: 'Gender',
          field_value: item.sex,
          confidence_score: parseFloat(item.sex_prob || 0)
        });
      }
      
      if (item.nationality) {
        extractedFields.push({
          field_name: 'Nationality',
          field_value: item.nationality,
          confidence_score: parseFloat(item.nationality_prob || 0)
        });
      }
      
      if (item.home) {
        extractedFields.push({
          field_name: 'Place of Origin',
          field_value: item.home,
          confidence_score: parseFloat(item.home_prob || 0)
        });
      }
      
      if (item.address) {
        extractedFields.push({
          field_name: 'Address',
          field_value: item.address,
          confidence_score: parseFloat(item.address_prob || 0)
        });
      }
      
      if (item.doe) {
        extractedFields.push({
          field_name: 'Date of Expiry',
          field_value: item.doe,
          confidence_score: parseFloat(item.doe_prob || 0)
        });
      }
    });

    console.log(`✅ Parsing complete - Overall Confidence: ${confidenceScore.toFixed(2)}%`);
    console.log(`   Extracted ${extractedFields.length} fields`);

    return {
      success: true,
      confidenceScore: parseFloat(confidenceScore.toFixed(2)),
      needsManualReview,
      extractedFields,
      rawResponse: fptaiResponse
    };

  } catch (error) {
    console.error('❌ Error parsing FPT.AI extraction result:', error);
    return {
      success: false,
      error: error.message,
      confidenceScore: 0,
      needsManualReview: true,
      extractedFields: [],
      rawResponse: fptaiResponse
    };
  }
}



module.exports = {
  FPTAI_CONFIG,
  submitDocumentForOCR,
  parseExtractionResult,
};

