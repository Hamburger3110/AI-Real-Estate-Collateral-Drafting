/**
 * S3 Upload Service
 * Handles uploading files to AWS S3
 */

const AWS = require('aws-sdk');
const path = require('path');

// Configure AWS S3 - support both profiles and environment variables
let s3Config = {
  region: process.env.AWS_REGION || 'us-east-1'
};

if (process.env.AWS_PROFILE) {
  // Use AWS profile from credentials file
  const credentials = new AWS.SharedIniFileCredentials({ profile: process.env.AWS_PROFILE });
  s3Config.credentials = credentials;
} else if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  // Use environment variables (backward compatibility)
  s3Config.accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  s3Config.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
}
// Otherwise, use default AWS credential chain

const s3 = new AWS.S3(s3Config);

// Parse bucket name and default prefix from environment
const S3_BUCKET_CONFIG = process.env.S3_BUCKET_NAME || 'ai-real-estate-contracts';
const [BUCKET_NAME, DEFAULT_PREFIX] = S3_BUCKET_CONFIG.includes('/') 
  ? S3_BUCKET_CONFIG.split('/', 2)
  : [S3_BUCKET_CONFIG, ''];

class S3Service {
  /**
   * Upload file buffer to S3
   * @param {Buffer} fileBuffer - File buffer to upload
   * @param {string} fileName - Name for the file
   * @param {string} contentType - MIME type of the file
   * @param {string} folder - S3 folder/prefix (optional)
   * @returns {Promise<Object>} Upload result with S3 URL
   */
  async uploadFile(fileBuffer, fileName, contentType, folder = 'contracts') {
    try {
      console.log(`📤 Uploading file to S3: ${fileName}`);
      
      // Combine default prefix with folder and filename
      let key = fileName;
      if (folder) {
        key = `${folder}/${fileName}`;
      }
      if (DEFAULT_PREFIX) {
        key = `${DEFAULT_PREFIX}/${key}`;
      }
      
      const params = {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
        ServerSideEncryption: 'AES256',
        Metadata: {
          'uploaded-at': new Date().toISOString(),
          'uploaded-by': 'contract-generator'
        }
      };

      const result = await s3.upload(params).promise();
      
      console.log(`✅ File uploaded successfully to S3: ${result.Location}`);
      
      return {
        success: true,
        url: result.Location,
        key: result.Key,
        bucket: result.Bucket,
        etag: result.ETag
      };
      
    } catch (error) {
      console.error(`❌ S3 upload failed for ${fileName}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Upload contract document to S3
   * @param {Buffer} docxBuffer - DOCX file buffer
   * @param {Buffer} pdfBuffer - PDF file buffer
   * @param {string} contractId - Contract ID
   * @param {string} contractNumber - Contract number for filename
   * @returns {Promise<Object>} Upload results for both files
   */
  async uploadContract(docxBuffer, pdfBuffer, contractId, contractNumber) {
    try {
      console.log(`📄 Uploading contract files for ${contractNumber}...`);
      
      const timestamp = Date.now();
      const sanitizedContractNumber = contractNumber.replace(/[^a-zA-Z0-9-]/g, '_');
      
      const docxFileName = `${sanitizedContractNumber}_${timestamp}.docx`;
      const pdfFileName = `${sanitizedContractNumber}_${timestamp}.pdf`;
      
      // Upload both DOCX and PDF versions
      const [docxResult, pdfResult] = await Promise.all([
        this.uploadFile(docxBuffer, docxFileName, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'contracts/docx'),
        this.uploadFile(pdfBuffer, pdfFileName, 'application/pdf', 'contracts/pdf')
      ]);
      
      if (!docxResult.success || !pdfResult.success) {
        throw new Error(`Upload failed: DOCX=${docxResult.success}, PDF=${pdfResult.success}`);
      }
      
      console.log(`✅ Contract uploaded successfully - DOCX: ${docxResult.url}, PDF: ${pdfResult.url}`);
      
      return {
        success: true,
        docx: docxResult,
        pdf: pdfResult,
        contractId,
        contractNumber
      };
      
    } catch (error) {
      console.error(`❌ Contract upload failed:`, error);
      return {
        success: false,
        error: error.message,
        contractId,
        contractNumber
      };
    }
  }

  /**
   * Get signed URL for temporary access to S3 object
   * @param {string} key - S3 object key
   * @param {number} expiresIn - Expiration time in seconds (default: 1 hour)
   * @returns {Promise<string>} Signed URL
   */
  async getSignedUrl(key, expiresIn = 3600) {
    try {
      const params = {
        Bucket: BUCKET_NAME,
        Key: key,
        Expires: expiresIn
      };

      const url = await s3.getSignedUrlPromise('getObject', params);
      return url;
      
    } catch (error) {
      console.error(`❌ Failed to generate signed URL for ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete file from S3
   * @param {string} key - S3 object key
   * @returns {Promise<boolean>} Success status
   */
  async deleteFile(key) {
    try {
      const params = {
        Bucket: BUCKET_NAME,
        Key: key
      };

      await s3.deleteObject(params).promise();
      console.log(`✅ File deleted from S3: ${key}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to delete file from S3: ${key}`, error);
      return false;
    }
  }

  /**
   * Check if S3 is properly configured
   * @returns {Promise<boolean>} Configuration status
   */
  async checkConfiguration() {
    try {
      console.log('🔍 Checking S3 configuration...');
      
      // Debug: Show what credentials we have
      console.log('🔧 Debug info:');
      console.log(`   AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? 'Set (' + process.env.AWS_ACCESS_KEY_ID.substring(0, 8) + '...)' : 'Not set'}`);
      console.log(`   AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? 'Set (***...)' : 'Not set'}`);
      console.log(`   AWS_REGION: ${process.env.AWS_REGION || 'Not set (using default: us-east-1)'}`);
      console.log(`   S3_BUCKET_CONFIG: ${S3_BUCKET_CONFIG}`);
      console.log(`   Parsed BUCKET_NAME: ${BUCKET_NAME}`);
      console.log(`   Parsed DEFAULT_PREFIX: ${DEFAULT_PREFIX || 'None'}`);
      
      if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        console.log('⚠️ AWS credentials not configured in environment variables');
        return false;
      }
      
      // Try to list objects in the bucket (just to test connectivity)
      console.log(`🔗 Testing connection to bucket: ${BUCKET_NAME}...`);
      await s3.headBucket({ Bucket: BUCKET_NAME }).promise();
      
      console.log(`✅ S3 configuration valid - Bucket: ${BUCKET_NAME}`);
      return true;
      
    } catch (error) {
      console.error('❌ S3 configuration check failed:', error.message);
      console.error('   Error code:', error.code);
      console.error('   Status code:', error.statusCode);
      
      if (error.code === 'NoSuchBucket') {
        console.log(`💡 Bucket ${BUCKET_NAME} does not exist. You may need to create it.`);
      } else if (error.code === 'Forbidden' || error.statusCode === 403) {
        console.log(`💡 Access denied to bucket ${BUCKET_NAME}. Check IAM permissions.`);
      } else if (error.code === 'InvalidAccessKeyId') {
        console.log(`💡 Invalid AWS Access Key ID. Check your credentials.`);
      } else if (error.code === 'SignatureDoesNotMatch') {
        console.log(`💡 Invalid AWS Secret Access Key. Check your credentials.`);
      }
      
      return false;
    }
  }
}

module.exports = new S3Service();