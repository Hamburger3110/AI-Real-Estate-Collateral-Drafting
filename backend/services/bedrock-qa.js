const AWS = require('aws-sdk');
const axios = require('axios');

const REGION = process.env.AWS_REGION || 'us-east-1';
// Use inference profile ID instead of model ID (required for on-demand models)
// Inference profile ID for Claude 3.5 Sonnet: us.anthropic.claude-3-5-sonnet-20240620-v1:0
const MODEL_ID = process.env.BEDROCK_MODEL_ID || process.env.BEDROCK_INFERENCE_PROFILE_ID || 'us.anthropic.claude-3-5-sonnet-20240620-v1:0';
const BEARER_TOKEN = process.env.AWS_BEARER_TOKEN_BEDROCK;

// Initialize Bedrock client - use API key if available, otherwise fall back to AWS credentials
let bedrockRuntime;
if (BEARER_TOKEN) {
  // API key authentication - will use axios directly
  bedrockRuntime = null;
} else {
  // Support both AWS profiles and environment variables
  if (process.env.AWS_PROFILE) {
    // Use AWS profile from credentials file
    const credentials = new AWS.SharedIniFileCredentials({ profile: process.env.AWS_PROFILE });
    bedrockRuntime = new AWS.BedrockRuntime({
      region: REGION,
      credentials: credentials
    });
  } else if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    // Use environment variables (backward compatibility)
    bedrockRuntime = new AWS.BedrockRuntime({
      region: REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    });
  } else {
    // Use default AWS credential chain
    bedrockRuntime = new AWS.BedrockRuntime({
      region: REGION
    });
  }
}

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

  if (BEARER_TOKEN) {
    // Use API key authentication via direct HTTP call
    // For inference profiles, use /inference-profiles/ endpoint instead of /model/
    const isInferenceProfile = MODEL_ID.startsWith('us.') || MODEL_ID.startsWith('global.');
    const endpoint = isInferenceProfile 
      ? `https://bedrock-runtime.${REGION}.amazonaws.com/inference-profiles/${MODEL_ID}/invoke`
      : `https://bedrock-runtime.${REGION}.amazonaws.com/model/${MODEL_ID}/invoke`;
    const response = await axios.post(endpoint, requestBody, {
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 60000
    });
    return { raw: response.data };
  } else {
    // Use AWS SDK with credentials
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
}

module.exports = { qaWithBedrockText };


