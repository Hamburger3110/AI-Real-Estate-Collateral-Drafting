const AWS = require('aws-sdk');
const textract = new AWS.Textract();
const { saveExtractedData } = require('./db');

exports.handler = async (event) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = event.Records[0].s3.object.key;

  const params = {
    Document: {
      S3Object: {
        Bucket: bucket,
        Name: key,
      },
    },
    FeatureTypes: ['FORMS', 'TABLES'],
  };

  try {
    const result = await textract.analyzeDocument(params).promise();
    // Save extracted data to PostgreSQL
    await saveExtractedData(key, result);
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify(err),
    };
  }
};
