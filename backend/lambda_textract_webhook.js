const AWS = require('aws-sdk');
const https = require('https');

const textract = new AWS.Textract();

exports.handler = async (event) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = event.Records[0].s3.object.key;
  const documentId = key; // Or use your own mapping

  // Textract logic
  const params = {
    Document: {
      S3Object: {
        Bucket: bucket,
        Name: key,
      },
    },
    FeatureTypes: ['FORMS', 'TABLES'],
  };

  let textractResult;
  try {
    textractResult = await textract.analyzeDocument(params).promise();
    // Save textractResult to your DB here if needed
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify(err) };
  }

  // Notify backend via webhook
  const postData = JSON.stringify({ documentId });
  const options = {
    hostname: 'your-backend-domain-or-ip', // e.g., 'localhost' for local, or your deployed server
    port: 3001,
    path: '/webhook/textract',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  await new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', resolve);
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });

  return { statusCode: 200, body: 'Textract processed and webhook sent' };
};
