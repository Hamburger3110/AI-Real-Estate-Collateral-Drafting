/**
 * AWS Bedrock Integration Configuration
 * 
 * This module handles configuration and API calls to AWS Bedrock for document OCR extraction
 * Supports: Legal Registration, Business Registration, Financial Statement
 */

const AWS = require('aws-sdk');

// AWS Bedrock Configuration
const BEDROCK_CONFIG = {
  // AWS Bedrock region
  region: process.env.AWS_REGION || 'us-east-1',
  
  // Model configuration (to be updated after testing)
  modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0',
  
  // Document types supported by Bedrock
  supportedDocumentTypes: [
    'Legal Registration',
    'Business Registration',
    'Financial Statement'
  ],
  
  // Confidence threshold for manual review
  confidenceThreshold: 95,
  
  // Request timeout (60 seconds for complex documents)
  timeout: 60000
};

// Initialize Bedrock Runtime client
const bedrockRuntime = new AWS.BedrockRuntime({
  region: BEDROCK_CONFIG.region,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

/**
 * Submit document to AWS Bedrock for OCR extraction
 * @param {Buffer} fileBuffer - File buffer to process
 * @param {String} fileName - Original file name
 * @param {String} documentType - Type of document (Legal Registration, Business Registration, Financial Statement)
 * @param {String} documentId - Internal document ID for tracking
 * @returns {Promise<Object>} - Bedrock extraction response
 */
async function submitDocumentForOCR(fileBuffer, fileName, documentType, documentId) {
  try {
    console.log(`📤 Submitting ${documentType} (document ${documentId}) to AWS Bedrock for OCR...`);
    
    // Check if document type is supported
    if (!BEDROCK_CONFIG.supportedDocumentTypes.includes(documentType)) {
      throw new Error(`Unsupported document type for Bedrock: ${documentType}`);
    }

    // Convert file buffer to base64 for Bedrock
    const base64Image = fileBuffer.toString('base64');
    
    // Determine the MIME type based on file extension
    const mimeType = getMimeType(fileName);
    
    // Create prompt based on document type
    const prompt = generatePromptForDocumentType(documentType);

    // Prepare request payload for Bedrock
    const requestBody = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType,
                data: base64Image
              }
            },
            {
              type: "text",
              text: prompt
            }
          ]
        }
      ]
    };

    // Invoke Bedrock model
    const params = {
      modelId: BEDROCK_CONFIG.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody)
    };

    console.log(`🔍 Invoking Bedrock model: ${BEDROCK_CONFIG.modelId}...`);
    
    const response = await bedrockRuntime.invokeModel(params).promise();
    
    // Parse Bedrock response
    const responseBody = JSON.parse(response.body.toString());
    
    console.log(`✅ Bedrock OCR completed successfully for document ${documentId}`);
    
    return {
      success: true,
      data: responseBody,
      documentId: documentId
    };

  } catch (error) {
    console.error(`❌ Bedrock OCR submission failed for document ${documentId}:`, error.message);
    if (error.response) {
      console.error(`   Status: ${error.$metadata?.httpStatusCode}`);
      console.error(`   Data:`, error.message);
    }
    return {
      success: false,
      error: error.message,
      details: error.$metadata
    };
  }
}

/**
 * Generate appropriate prompt based on document type
 * @param {String} documentType - Type of document
 * @returns {String} - Prompt for Bedrock
 */
function generatePromptForDocumentType(documentType) {
  const prompts = {
    'Legal Registration': `
      Analyze this legal registration document and extract the following information in JSON format:
      - Company Name
      - Registration Number
      - Registration Date
      - Registered Address
      - Legal Representative
      - Business Scope
      - Capital/Investment Amount
      
      For each field, provide:
      1. The extracted value
      2. A confidence score (0-1)
      
      Return ONLY a JSON object with this structure:
      {
        "fields": [
          {"name": "field_name", "value": "extracted_value", "confidence": 0.95}
        ],
        "overall_confidence": 0.93
      }
    `,
    'Business Registration': `
      Analyze this business registration document and extract the following information in JSON format:
      - Business Name
      - Business Registration Number
      - Tax Identification Number
      - Registration Date
      - Business Address
      - Owner/Representative Name
      - Business Type
      - Registration Authority
      
      For each field, provide:
      1. The extracted value
      2. A confidence score (0-1)
      
      Return ONLY a JSON object with this structure:
      {
        "fields": [
          {"name": "field_name", "value": "extracted_value", "confidence": 0.95}
        ],
        "overall_confidence": 0.93
      }
    `,
    'Financial Statement': `
      Analyze this financial statement document and extract the following information in JSON format:
      - Company Name
      - Statement Period
      - Total Assets
      - Total Liabilities
      - Total Equity
      - Revenue
      - Net Income/Loss
      - Cash Flow
      - Statement Date
      
      For each field, provide:
      1. The extracted value
      2. A confidence score (0-1)
      
      Return ONLY a JSON object with this structure:
      {
        "fields": [
          {"name": "field_name", "value": "extracted_value", "confidence": 0.95}
        ],
        "overall_confidence": 0.93
      }
    `
  };

  return prompts[documentType] || prompts['Business Registration'];
}

/**
 * Get MIME type from file name
 * @param {String} fileName - File name with extension
 * @returns {String} - MIME type
 */
function getMimeType(fileName) {
  const extension = fileName.toLowerCase().split('.').pop();
  const mimeTypes = {
    'pdf': 'application/pdf',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'tiff': 'image/tiff',
    'tif': 'image/tiff'
  };
  return mimeTypes[extension] || 'application/octet-stream';
}

/**
 * Parse Bedrock extraction result and extract confidence score
 * @param {Object} bedrockResponse - Raw response from Bedrock API
 * @param {String} documentType - Type of document
 * @returns {Object} - Parsed extraction data with confidence score
 */
function parseExtractionResult(bedrockResponse, documentType = 'Business Registration') {
  try {
    console.log(`📋 Parsing Bedrock response for ${documentType}...`);
    
    // Extract text content from Bedrock response
    let extractedText = '';
    
    if (bedrockResponse.content && Array.isArray(bedrockResponse.content)) {
      // Find text content in response
      const textContent = bedrockResponse.content.find(item => item.type === 'text');
      if (textContent && textContent.text) {
        extractedText = textContent.text;
      }
    }

    // Parse JSON from extracted text
    // Try to find JSON object in the response
    const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Bedrock response');
    }

    const extractedData = JSON.parse(jsonMatch[0]);
    
    // Calculate overall confidence score
    const overallConfidence = extractedData.overall_confidence 
      ? parseFloat(extractedData.overall_confidence) * 100 
      : 0;
    
    // Determine if manual review is needed
    const needsManualReview = overallConfidence < BEDROCK_CONFIG.confidenceThreshold;

    // Format extracted fields
    const extractedFields = {};
    if (extractedData.fields && Array.isArray(extractedData.fields)) {
      extractedData.fields.forEach(item => {
        if (item.name && item.value) {
          extractedFields[item.name] = {
            value: item.value,
            confidence: parseFloat(item.confidence) * 100
          };
        }
      });
    }

    console.log(`✅ Parsing complete - Confidence: ${overallConfidence.toFixed(2)}%`);

    return {
      success: true,
      confidenceScore: parseFloat(overallConfidence.toFixed(2)),
      needsManualReview,
      extractedData: extractedFields,
      rawResponse: bedrockResponse
    };

  } catch (error) {
    console.error('❌ Error parsing Bedrock extraction result:', error);
    return {
      success: false,
      error: error.message,
      confidenceScore: 0,
      needsManualReview: true,
      extractedData: {},
      rawResponse: bedrockResponse
    };
  }
}

module.exports = {
  BEDROCK_CONFIG,
  submitDocumentForOCR,
  parseExtractionResult
};

