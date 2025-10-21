require('dotenv').config();
const express = require('express');
const AWS = require('aws-sdk');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const app = express();
const PORT = process.env.PORT || 3001;
const { createTables } = require('./db');
const { router: eventsRouter, sendTextractComplete } = require('./events');

AWS.config.update({ region: 'us-east-1' }); // Change to your region
const s3 = new AWS.S3();

app.use(express.json());

app.use('/auth', require('./routes/auth'));
app.use('/documents', require('./routes/documents'));
app.use('/extracted_fields', require('./routes/extractedFields'));
app.use('/contracts', require('./routes/contracts'));
app.use('/activity_logs', require('./routes/activityLogs'));
app.use('/events', eventsRouter);
app.use('/webhook', require('./routes/webhook'));

// Ensure DB tables exist on startup
createTables().then(() => {
  console.log('Database tables ensured.');
}).catch((err) => {
  console.error('Error ensuring tables:', err);
});

app.post('/upload', upload.single('file'), async (req, res) => {
  const params = {
    Bucket: 'your-s3-bucket', // Change to your S3 bucket name
    Key: req.file.originalname,
    Body: req.file.buffer,
    ContentType: req.file.mimetype,
  };
  try {
    await s3.upload(params).promise();
    res.send('File uploaded to S3');
  } catch (err) {
    res.status(500).send(err);
  }
});

app.get('/', (req, res) => {
  res.send('Express backend is running!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
