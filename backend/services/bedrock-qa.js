const AWS = require('aws-sdk');
const axios = require('axios');

// Use same region and credentials as other Bedrock usage
const REGION = process.env.AWS_REGION || 'us-east-1';
const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-sonnet-4-5-20250929-v1:0';
const BEARER = process.env.AWS_BEARER_TOKEN_BEDROCK;

const bedrockRuntime = (!BEARER)
  ? new AWS.BedrockRuntime({
      region: REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    })
  : null;

function buildPrompt(documentType) {
  // Keep aligned with config/bedrock-config.js expected JSON schema
  return `You are a precise information extraction system.
Given the following plain text from a ${documentType}, extract fields and return ONLY a JSON object with:
{
  "fields": [ { "name": "field_name", "value": "extracted_value", "confidence": 0.95 } ],
  "overall_confidence": 0.93
}
If a field is absent, omit it.`;
}

async function qaWithBedrockText(text, documentType = 'Legal Registration') {
  const prompt = buildPrompt(documentType);
  const requestBody = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'text', text: `\n\nDocument Text:\n${text || ''}` }
        ]
      }
    ]
  };

  // If bearer token provided, call HTTPS endpoint directly
  if (BEARER) {
    const url = `https://bedrock-runtime.${REGION}.amazonaws.com/model/${encodeURIComponent(MODEL_ID)}/invoke`;
    const resp = await axios.post(url, requestBody, {
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json',
        'x-amz-bedrock-bearer-token': BEARER
      },
      timeout: 60000
    });
    return { raw: resp.data };
  }

  // Otherwise, use AWS SDK v2 with key/secret or EC2 role
  const params = {
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(requestBody)
  };
  const response = await bedrockRuntime.invokeModel(params).promise();
  const responseBody = JSON.parse(response.body.toString());
  return { raw: responseBody };
}

module.exports = { qaWithBedrockText };


