/**
 * Google Cloud Vision OCR Service
 * Extracts text from images using Google Cloud Vision API
 */

const { ImageAnnotatorClient } = require('@google-cloud/vision');

let client = null;

/**
 * Initialize Google Cloud Vision client
 * 
 * The client automatically uses credentials in this order:
 * 1. GOOGLE_APPLICATION_CREDENTIALS environment variable (service account JSON path) ← RECOMMENDED
 * 2. Application Default Credentials from gcloud CLI (gcloud auth application-default login)
 * 3. Default service account (if running on Google Cloud)
 * 4. google-credentials.json in project root (fallback)
 */
function initClient() {
  if (!client) {
    try {
      // Check for explicit credentials first
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.log(`✅ Using Google credentials from: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
      } else {
        console.log(`⚠️  No GOOGLE_APPLICATION_CREDENTIALS found. Trying Application Default Credentials...`);
        console.log(`   If this fails, run: gcloud auth application-default login`);
        console.log(`   Or set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path`);
      }
      
      // No need to pass credentials - client uses Application Default Credentials automatically
      // This works with: gcloud auth application-default login
      client = new ImageAnnotatorClient();
    } catch (error) {
      const errorMsg = error.message || String(error);
      let helpfulMsg = `Failed to initialize Google Cloud Vision client: ${errorMsg}\n\n`;
      helpfulMsg += `💡 Authentication Setup Options:\n`;
      helpfulMsg += `   1. Service Account JSON (Recommended):\n`;
      helpfulMsg += `      - Create service account in Google Cloud Console\n`;
      helpfulMsg += `      - Download JSON key file\n`;
      helpfulMsg += `      - Set: $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\path\\to\\key.json"\n\n`;
      helpfulMsg += `   2. Application Default Credentials:\n`;
      helpfulMsg += `      - Run: gcloud auth application-default login\n`;
      helpfulMsg += `      - (Note: This is different from 'gcloud auth login')\n\n`;
      helpfulMsg += `   3. Place JSON file in backend/ as google-credentials.json`;
      
      throw new Error(helpfulMsg);
    }
  }
  return client;
}

/**
 * Extract text from image buffer using Google Cloud Vision OCR
 * @param {Buffer} imageBuffer - Image file buffer
 * @param {String} fileName - Original file name (for logging)
 * @returns {Promise<Object>} - { text: string, meta: object }
 */
async function extractTextWithGoogleVision(imageBuffer, fileName) {
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
    throw new Error('Invalid image buffer');
  }

  try {
    const visionClient = initClient();
    
    // Perform text detection
    const [result] = await visionClient.textDetection({
      image: { content: imageBuffer }
    });

    const detections = result.textAnnotations;
    
    if (!detections || detections.length === 0) {
      return {
        text: '',
        meta: {
          provider: 'google-cloud-vision',
          text_detected: false,
          confidence: 0
        }
      };
    }

    // The first detection contains the full text
    const fullText = detections[0].description || '';
    
    // Calculate average confidence from all detections
    let totalConfidence = 0;
    let confidenceCount = 0;
    
    detections.forEach((detection, index) => {
      if (index > 0 && detection.boundingPoly && detection.boundingPoly.vertices) {
        // Individual word/line detections (skip index 0 which is full text)
        if (detection.confidence !== undefined && detection.confidence !== null) {
          totalConfidence += detection.confidence;
          confidenceCount++;
        }
      }
    });

    const avgConfidence = confidenceCount > 0 
      ? (totalConfidence / confidenceCount) * 100 
      : 95; // Default high confidence if not available

    return {
      text: fullText,
      meta: {
        provider: 'google-cloud-vision',
        text_detected: true,
        confidence: Math.round(avgConfidence),
        detections_count: detections.length,
        language: result.textAnnotations?.[0]?.locale || 'unknown'
      }
    };
  } catch (error) {
    const errorMsg = error.message || String(error);
    
    // Check for authentication errors
    if (errorMsg.includes('Could not load the default credentials') || 
        errorMsg.includes('authentication') || 
        errorMsg.includes('credentials') ||
        errorMsg.includes('UNAUTHENTICATED')) {
      let authError = `Google Cloud Vision authentication failed: ${errorMsg}\n\n`;
      authError += `🔐 Setup Required:\n`;
      authError += `   Option 1 (Recommended): Service Account JSON\n`;
      authError += `     1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts\n`;
      authError += `     2. Create service account with "Cloud Vision API User" role\n`;
      authError += `     3. Download JSON key\n`;
      authError += `     4. Set: $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\path\\to\\key.json"\n\n`;
      authError += `   Option 2: Application Default Credentials\n`;
      authError += `     Run: gcloud auth application-default login\n`;
      authError += `     (This is different from 'gcloud auth login')\n`;
      
      throw new Error(authError);
    }
    
    throw new Error(`Google Cloud Vision OCR failed: ${errorMsg}`);
  }
}

module.exports = {
  extractTextWithGoogleVision,
  initClient
};

