require('dotenv').config();
const express = require('express');
const cors = require('cors');
const AWS = require('aws-sdk');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const app = express();
const PORT = process.env.PORT || 3001;
const { createTables, runMigrations, seedDemoUsers, testConnection, createDocument, createActivityLog } = require('./db');
const { router: eventsRouter, sendTextractComplete } = require('./events');
const { processDocument, getAPIForDocumentType } = require('./services/document-processor');

// Configure AWS - support both profiles and environment variables
if (process.env.AWS_PROFILE) {
  // Use AWS profile from credentials file
  const credentials = new AWS.SharedIniFileCredentials({ profile: process.env.AWS_PROFILE });
  AWS.config.update({
    region: process.env.AWS_REGION || 'us-east-2',
    credentials: credentials
  });
  console.log(`✅ Using AWS profile: ${process.env.AWS_PROFILE}`);
} else if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  // Use environment variables (backward compatibility)
  AWS.config.update({ 
    region: process.env.AWS_REGION || 'us-east-2',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  });
  console.log(`✅ Using AWS credentials from environment variables`);
} else {
  // Try default AWS credential chain (includes profiles)
  AWS.config.update({
    region: process.env.AWS_REGION || 'us-east-2'
  });
  console.log(`✅ Using AWS default credential chain`);
}
const s3 = new AWS.S3();
const textract = new AWS.Textract();

app.use(cors());
app.use(express.json());

app.use('/auth', require('./routes/auth'));
app.use('/documents', require('./routes/documents'));
app.use('/extracted_fields', require('./routes/extractedFields'));
app.use('/contracts', require('./routes/contracts'));
app.use('/approvals', require('./routes/approvals'));
app.use('/migrations', require('./routes/migrations'));
app.use('/activity_logs', require('./routes/activityLogs'));
app.use('/test', require('./routes/test-signed-urls'));
app.use('/events', eventsRouter);
app.use('/webhook', require('./routes/webhook'));
app.use('/fptai', require('./routes/fptai'));
app.use('/notifications', require('./routes/notifications'));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealthy = await testConnection();
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: dbHealthy ? 'Connected' : 'Disconnected',
      environment: {
        pgHost: process.env.PGHOST,
        pgDatabase: process.env.PGDATABASE,
        pgUser: process.env.PGUSER,
        pgPort: process.env.PGPORT
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      database: 'Error',
      error: error.message
    });
  }
});

// Quick QR test endpoint
app.post('/qr-test', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    const { detect } = require('./services/qr-detector');
    const result = await detect(req.file.buffer);
    return res.status(200).json({ success: true, result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Synchronous test endpoint for Legal Registration pipeline (no DB write)
app.post('/legal-test', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    if (req.query && req.query.no_bedrock === '1') {
      process.env.NO_BEDROCK_TEST = '1';
    }
    const { processLegalRegistration } = require('./services/legal-registration-processor');
    const { detect } = require('./services/qr-detector');
    const { extractTextWithGoogleVision } = require('./services/google-vision-ocr');
    const { qaWithBedrockText } = require('./services/bedrock-qa');
    const { parseExtractionResult } = require('./config/bedrock-config');

    const result = await processLegalRegistration(
      req.file.buffer,
      req.file.originalname,
      null,
      {
        detectQr: detect,
        extractTextWithGoogleVision,
        qaWithBedrockText,
        parseBedrockResult: parseExtractionResult
      }
    );

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Initialize database on startup
async function initializeDatabase() {
  console.log('🔄 Initializing database connection...');
  
  // Test connection first
  const connectionSuccess = await testConnection();
  if (!connectionSuccess) {
    console.error('❌ Failed to connect to AWS RDS.');
    console.error('📋 Troubleshooting steps:');
    console.error('   1. Check RDS instance is running and accessible');
    console.error('   2. Verify security group allows inbound connections on port 5432');
    console.error('   3. Ensure the database name exists: ai_real_estate_db');
    console.error('   4. Verify username/password credentials');
    console.error('   5. Check if RDS is in a public subnet (for external access)');
    console.error('🚀 Server will continue running without database connection.');
    return;
  }

  try {
    // Run database migrations first
    await runMigrations();
    
    // Create tables
    await createTables();
    console.log('✅ Database tables created/verified successfully.');
    
    // Seed demo users
    await seedDemoUsers();
    
  } catch (err) {
    console.error('❌ Error initializing database:', err);
    console.error('🚀 Server will continue running with limited functionality.');
  }
}

// Initialize database when server starts (non-blocking)
initializeDatabase().catch(err => {
  console.error('Database initialization failed:', err);
  console.log('🚀 Server continuing without database connection.');
});

// Enhanced file upload endpoint with S3 and OCR integration
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { originalname, buffer, mimetype, size } = req.file;
    const { document_type = 'ID Card', user_id = 1, contract_id = null } = req.body;
    
    // Generate unique filename with contract_id if provided
    const timestamp = Date.now();
    const sanitizedName = originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const s3Key = contract_id 
      ? `documents/${contract_id}/${timestamp}_${sanitizedName}`
      : `documents/${timestamp}_${sanitizedName}`;
    
    console.log(`📤 Uploading ${originalname} (${document_type}) to S3...`);
    
    // Upload to S3 (with fallback to demo mode)
    let s3Result;
    let s3Location;
    
    try {
      const s3Params = {
        Bucket: process.env.S3_BUCKET_NAME || 'document-upload-vp',
        Key: s3Key,
        Body: buffer,
        ContentType: mimetype,
        Metadata: {
          'original-name': originalname,
          'upload-timestamp': timestamp.toString(),
          'document-type': document_type,
          'file-size': size.toString(),
          'contract-id': contract_id ? contract_id.toString() : 'none'
        }
      };

      s3Result = await s3.upload(s3Params).promise();
      s3Location = s3Result.Location;
      console.log(`✅ File uploaded to S3: ${s3Location}`);
    } catch (s3Error) {
      if (s3Error.code === 'CredentialsError') {
        // Demo mode - simulate S3 upload
        console.log(`⚠️ AWS credentials not configured, running in DEMO mode`);
        s3Location = `https://document-upload-vp.s3.us-east-2.amazonaws.com/${s3Key}`;
        console.log(`🎭 Demo upload simulated: ${s3Location}`);
      } else {
        throw s3Error; // Re-throw other S3 errors
      }
    }

    // Save document metadata to database
    const documentData = {
      file_name: originalname,
      ss_uri: s3Location,
      document_type: document_type,
      upload_user_id: user_id,
      status: 'Uploaded',
      textract_job_id: null
    };

    const dbResult = await createDocument(documentData);
    console.log(`✅ Document saved to database with ID: ${dbResult.document_id}`);

    // Log activity
    await createActivityLog({
      user_id: user_id,
      document_id: dbResult.document_id,
      action: 'DOCUMENT_UPLOADED',
      action_detail: `Uploaded document: ${originalname} (${(size / 1024 / 1024).toFixed(2)} MB)`
    });

    // Determine processing strategy based on document type
    const apiType = getAPIForDocumentType(document_type);
    console.log(`🔍 Document type "${document_type}" will be processed by: ${apiType}`);

    // Process document based on API type
    if (apiType === 'FPTAI') {
      // FPT.AI processing (ID Card, Passport) - Immediate/Synchronous
      console.log(`⚡ Processing ${document_type} with FPT.AI immediately...`);
      
      try {
        const processingResult = await processDocument(
          buffer,
          originalname,
          document_type,
          dbResult.document_id
        );

        if (processingResult.success) {
          // Return immediate results with extraction data
          return res.status(201).json({
            success: true,
            message: 'File uploaded and extracted successfully',
            data: {
              document_id: dbResult.document_id,
              file_name: originalname,
              s3_url: s3Location,
              s3_key: s3Key,
              file_size: size,
              document_type: document_type,
              status: 'Extracted',
              confidence_score: processingResult.confidenceScore,
              needs_manual_review: processingResult.needsManualReview,
              extracted_data: processingResult.extractedData,
              upload_timestamp: new Date().toISOString()
            }
          });
        } else {
          // Processing failed, but upload succeeded
          console.error(`⚠️ FPT.AI processing failed: ${processingResult.error}`);
          return res.status(201).json({
            success: true,
            message: 'File uploaded but extraction failed',
            data: {
              document_id: dbResult.document_id,
              file_name: originalname,
              s3_url: s3Location,
              s3_key: s3Key,
              file_size: size,
              document_type: document_type,
              status: 'Uploaded',
              extraction_error: processingResult.error,
              upload_timestamp: new Date().toISOString()
            }
          });
        }
      } catch (processingError) {
        console.error(`❌ Error during FPT.AI processing:`, processingError);
        // Return upload success even if processing fails
        return res.status(201).json({
          success: true,
          message: 'File uploaded but extraction encountered an error',
          data: {
            document_id: dbResult.document_id,
            file_name: originalname,
            s3_url: s3Location,
            s3_key: s3Key,
            file_size: size,
            document_type: document_type,
            status: 'Uploaded',
            extraction_error: processingError.message,
            upload_timestamp: new Date().toISOString()
          }
        });
      }

    } else if (apiType === 'BEDROCK') {
      // Bedrock processing (Legal/Business/Financial) - Asynchronous via Lambda
      console.log(`⏳ ${document_type} will be processed asynchronously by Lambda/Bedrock`);
      console.log(`📁 S3 path: ${s3Key} (will trigger Lambda via SQS)`);

      // Return immediately with "Processing" status
      // Lambda will be triggered by S3 event automatically
      return res.status(201).json({
        success: true,
        message: 'File uploaded successfully. OCR processing in progress.',
        data: {
          document_id: dbResult.document_id,
          file_name: originalname,
          s3_url: s3Location,
          s3_key: s3Key,
          file_size: size,
          document_type: document_type,
          status: 'Processing',
          processing_method: 'Lambda/Bedrock',
          message: 'Document is being processed. You will be notified when complete.',
          upload_timestamp: new Date().toISOString()
        }
      });

    } else {
      // Unknown document type - should not happen due to validation
      throw new Error(`Unsupported document type: ${document_type}`);
    }

  } catch (error) {
    console.error('❌ Upload error:', error);
    
    let errorMessage = 'Upload failed';
    let details = error.message;
    
    if (error.code === 'CredentialsError') {
      errorMessage = 'AWS credentials not configured';
      details = 'Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in your .env file, or configure AWS CLI';
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      details: details,
      code: error.code
    });
  }
});

app.get('/', (req, res) => {
  res.send('Express backend is running!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
