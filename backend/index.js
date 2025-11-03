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

// Configure AWS with environment variables
AWS.config.update({ 
  region: process.env.AWS_REGION || 'us-east-2',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});
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
app.use('/events', eventsRouter);
app.use('/webhook', require('./routes/webhook'));

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

// Enhanced file upload endpoint with S3 and database integration
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { originalname, buffer, mimetype, size } = req.file;
    const { document_type = 'Ownership', user_id = 1 } = req.body; // Default values for demo
    
    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedName = originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const s3Key = `documents/${timestamp}_${sanitizedName}`;
    
    console.log(`📤 Uploading ${originalname} to S3...`);
    
    // Upload to S3 (with fallback to demo mode)
    let s3Result;
    let s3Location;
    
    try {
      const s3Params = {
        Bucket: process.env.S3_BUCKET_NAME || 'ai-real-estate-documents',
        Key: s3Key,
        Body: buffer,
        ContentType: mimetype,
        Metadata: {
          'original-name': originalname,
          'upload-timestamp': timestamp.toString(),
          'document-type': document_type,
          'file-size': size.toString()
        }
      };

      s3Result = await s3.upload(s3Params).promise();
      s3Location = s3Result.Location;
      console.log(`✅ File uploaded to S3: ${s3Location}`);
    } catch (s3Error) {
      if (s3Error.code === 'CredentialsError') {
        // Demo mode - simulate S3 upload
        console.log(`⚠️ AWS credentials not configured, running in DEMO mode`);
        s3Location = `https://demo-bucket.s3.us-east-2.amazonaws.com/${s3Key}`;
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

    // Start Textract job asynchronously (optional)
    if (s3Result) { // Only run Textract if actual S3 upload succeeded
      try {
        const textractParams = {
          DocumentLocation: {
            S3Object: {
              Bucket: process.env.S3_BUCKET_NAME || 'ai-real-estate-documents',
              Name: s3Key
            }
          },
          FeatureTypes: ['TABLES', 'FORMS'],
          JobTag: `doc_${dbResult.document_id}`
        };

        if (mimetype === 'application/pdf' || mimetype.startsWith('image/')) {
          console.log(`🔍 Starting Textract analysis for document ${dbResult.document_id}...`);
          const textractResult = await textract.startDocumentAnalysis(textractParams).promise();
          
          // Update document with Textract job ID
          // This would be handled by your documents route update function
          console.log(`📋 Textract job started: ${textractResult.JobId}`);
        }
      } catch (textractError) {
        console.log(`⚠️ Textract job failed (non-critical): ${textractError.message}`);
      }
    } else {
      console.log(`🎭 Skipping Textract in demo mode`);
    }

    // Return success response
    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        document_id: dbResult.document_id,
        file_name: originalname,
        s3_url: s3Location,
        s3_key: s3Key,
        file_size: size,
        document_type: document_type,
        status: 'Uploaded',
        upload_timestamp: new Date().toISOString()
      }
    });

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
