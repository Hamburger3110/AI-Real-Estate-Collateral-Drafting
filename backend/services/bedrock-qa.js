const AWS = require('aws-sdk');
const axios = require('axios');

const REGION = process.env.AWS_REGION || 'us-east-1';
// Model ID for Claude 3.5 Sonnet
// Format: anthropic.claude-3-5-sonnet-20240620-v1:0 (without 'us.' prefix for endpoint)
const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-3-5-sonnet-20241022-v2:0';
const BEARER_TOKEN = process.env.AWS_BEARER_TOKEN_BEDROCK;

// Initialize Bedrock client for credential access (only needed for AWS signature v4)
// We always use HTTP endpoints, not AWS SDK's invokeModel()
let bedrockRuntime = null;
if (!BEARER_TOKEN) {
  // Only initialize if we need AWS credentials for signing
  if (process.env.AWS_PROFILE) {
    const credentials = new AWS.SharedIniFileCredentials({ profile: process.env.AWS_PROFILE });
    bedrockRuntime = new AWS.BedrockRuntime({
      region: REGION,
      credentials: credentials
    });
  } else if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    bedrockRuntime = new AWS.BedrockRuntime({
      region: REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    });
  } else {
    bedrockRuntime = new AWS.BedrockRuntime({
      region: REGION
    });
  }
}

function buildPrompt(documentType) {
  // Keep aligned with config/bedrock-config.js expected JSON schema
  return `Hãy đọc kỹ văn bản tiếng Việt dưới đây về giấy chứng nhận quyền sử dụng đất và TRÍCH XUẤT thành JSON theo ví dụ sau đây (chỉ trả về JSON, không giải thích):
{  "fields": 
    [  {"name": "Tên người sử dụng đất 1", "value": "...", "confidence": 0.95},    
       {"name": "Thửa đất số", "value": "...", "confidence": 0.92},    
       {"name": "Tờ bản đồ số", "value": "...", "confidence": 0.95},    
       {"name": "Diện tích", "value": "...", "confidence": 0.90},    
       {"name": "Loại đất", "value": ["Đất ở tại nông thôn", "Đất trồng cây lâu năm", "Đất nuôi trồng thủy sản"], "confidence": 0.90},
       {"name": "Thời hạn sử dụng đất", 
        "value":"{
                "Đất ở tại nông thôn": "lâu dài",
                "Đất trồng cây lâu năm": "15/10/2043",
                "Đất nuôi trồng thủy sản": "15/10/2043"
                }", 
        "confidence": 0.90},
       {"name": "Hình thức sử dụng đất", "value": "Sử dụng riêng", "confidence": 0.96},
       {"name": "Nguồn gốc sử dụng đất", 
        "value":"{
                "Đất ở tại nông thôn": "Nhà nước công nhận quyền sử dụng đất như giao đất có thu tiền sử dụng đất",
                "Đất trồng cây lâu năm": "Nhà nước công nhận quyền sử dụng đất như giao đất không thu tiền sử dụng đất",
                "Đất nuôi trồng thủy sản": "Nhà nước công nhận quyền sử dụng đất như giao đất không thu tiền sử dụng đất"
                }", 
        "confidence": 0.90},
       {"name": "Địa chỉ", "value": "...", "confidence": 0.98},
       {"name": "Tên tài sản gắn liền với đất 1",
        "value": "{
            "Diện tích xây dựng":"150",
            "Diện tích sàn hoặc công suất":"",
            "Kết cấu chủ yếu":"Bê tông, cốt thép",
            "Cấp công trình":"4",
            "Số tầng":"2",
            "Năm HT xây dựng":"2023",
            "Thời hạn sở hữu":"",
            }",
        "confidence": 0.90},
       {"name": "Tên tài sản gắn liền với đất 2", "value": "...", "confidence": 0.90},
       {"name": "Ghi chú", "value": "...", "confidence": 0.94},
    ],  
    "overall_confidence": 0.98}
    
Yêu cầu:- Nếu không tìm thấy trường, để value = "" và confidence = 0.0.
- overall_confidence là mức tin cậy tổng thể (0–1).
- Chỉ trả về JSON hợp lệ.`;
}

async function qaWithBedrockText(text, documentType = 'Legal Registration') {
  // Ensure we always have a string for the document text
  if (text === undefined || text === null) {
    console.error('❌ [Bedrock QA] qaWithBedrockText called with null/undefined text');
    text = '';
  }
  if (typeof text !== 'string') {
    console.error('❌ [Bedrock QA] qaWithBedrockText expected string text, got:', typeof text);
    text = String(text);
  }

  const prompt = buildPrompt(documentType);
  const requestBody = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'text', text: `\n\nDocument Text:\n${text}` }
        ]
      }
    ]
  };

  // Use standard Bedrock model endpoint format
  // Format: /model/{modelId}/invoke
  const endpoint = `https://bedrock-runtime.${REGION}.amazonaws.com/model/${MODEL_ID}/converse`;

  if (BEARER_TOKEN) {
    // Use Bearer token authentication
    try {
      const response = await axios.post(endpoint, requestBody, {
        headers: {
          'Authorization': `Bearer ${BEARER_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 60000
      });
      
      // Check for error responses from Bedrock
      if (response.data && response.data.Output && response.data.Output.__type) {
        const errorType = response.data.Output.__type;
        const errorMessage = response.data.Output.message || response.data.Output.Message || 'Unknown Bedrock API error';
        console.error(`❌ [Bedrock QA] Bedrock API error: ${errorType}`);
        console.error(`   Error message: ${errorMessage}`);
        throw new Error(`Bedrock API error (${errorType}): ${errorMessage}`);
      }
      
      return { raw: response.data };
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        const statusText = error.response.statusText;
        const errorData = error.response.data;
        
        console.error(`❌ [Bedrock QA] HTTP error: ${status} ${statusText}`);
        console.error(`   Response data:`, JSON.stringify(errorData, null, 2));
        console.error(`   Endpoint: ${endpoint}`);
        console.error(`   Auth method: Bearer token`);
        
        if (status === 403) {
          const errorMsg = errorData?.Message || errorData?.message || 'Authentication failed';
          let helpMsg = `Bedrock API authentication failed (403): ${errorMsg}\n\n`;
          helpMsg += `💡 Troubleshooting Bearer Token:\n`;
          helpMsg += `   1. Verify AWS_BEARER_TOKEN_BEDROCK is set correctly in .env\n`;
          helpMsg += `   2. Check if the token has expired\n`;
          helpMsg += `   3. Ensure the token has Bedrock permissions\n`;
          helpMsg += `   4. Try regenerating the token from AWS Console\n\n`;
          helpMsg += `💡 Alternative: Use AWS IAM credentials instead:\n`;
          helpMsg += `   - Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY\n`;
          helpMsg += `   - Ensure IAM user/role has bedrock:InvokeModel permission\n`;
          helpMsg += `   - Remove AWS_BEARER_TOKEN_BEDROCK to use IAM auth`;
          throw new Error(helpMsg);
        } else if (status === 401) {
          throw new Error(`Bedrock API unauthorized (401): Invalid or expired Bearer token. Please check AWS_BEARER_TOKEN_BEDROCK.`);
        } else {
          throw new Error(`Bedrock API HTTP error: ${status} - ${JSON.stringify(errorData)}`);
        }
      }
      throw error;
    }
  } else {
    // Use AWS credentials with signature v4 signing
    // Get AWS credentials
    let credentials;
    if (process.env.AWS_PROFILE) {
      credentials = new AWS.SharedIniFileCredentials({ profile: process.env.AWS_PROFILE });
    } else if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      credentials = new AWS.Credentials({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      });
    } else {
      // Use default credential chain
      credentials = bedrockRuntime?.config?.credentials || new AWS.EnvironmentCredentials('AWS');
    }
    
    // Ensure credentials are loaded and valid before signing
    try {
      await credentials.getPromise();
    } catch (credError) {
      console.error('❌ [Bedrock QA] Failed to load AWS credentials:', credError.message);
      const helpMsg = `AWS credentials not available: ${credError.message}.\n\n` +
        `💡 Solutions:\n` +
        `   1. Set AWS_BEARER_TOKEN_BEDROCK (easiest - no signing required)\n` +
        `   2. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY\n` +
        `   3. Set AWS_PROFILE to use credentials file\n` +
        `   4. Run: aws configure (for default credentials)`;
      throw new Error(helpMsg);
    }
    
    // Validate that credentials have required values (critical for signing)
    if (!credentials.accessKeyId || !credentials.secretAccessKey) {
      const missing = [];
      if (!credentials.accessKeyId) missing.push('accessKeyId');
      if (!credentials.secretAccessKey) missing.push('secretAccessKey');
      console.error(`❌ [Bedrock QA] AWS credentials missing required fields: ${missing.join(', ')}`);
      console.error(`   Current credentials object keys:`, Object.keys(credentials));
      const helpMsg = `AWS credentials incomplete: missing ${missing.join(' and ')}.\n\n` +
        `💡 Solutions:\n` +
        `   1. Set AWS_BEARER_TOKEN_BEDROCK (easiest - bypasses credential signing)\n` +
        `   2. Ensure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are both set\n` +
        `   3. Check AWS_PROFILE configuration if using profile\n` +
        `   4. Verify credentials with: aws sts get-caller-identity`;
      throw new Error(helpMsg);
    }
    
    // Create a request object for signing
    const endpointUrl = new URL(endpoint);
    const bodyString = JSON.stringify(requestBody) || ''; // Ensure string, never undefined
    
    if (!bodyString || bodyString.length === 0) {
      throw new Error('Failed to stringify request body for Bedrock QA');
    }
    
    const request = {
      method: 'POST',
      protocol: endpointUrl.protocol,
      hostname: endpointUrl.hostname,
      port: endpointUrl.port || 443,
      path: endpointUrl.pathname,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Host': endpointUrl.hostname,
        'Content-Length': Buffer.byteLength(bodyString)
      },
      body: bodyString
    };
    
    // Sign the request using AWS SDK's V4 signer
    const signer = new AWS.Signers.V4(request, 'bedrock');
    signer.addAuthorization(credentials, new Date());
    
    // Make the request using axios with signed headers
    // IMPORTANT: Use bodyString (the stringified version) that we signed, not requestBody (the object)
    try {
      const response = await axios.post(endpoint, bodyString, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': request.headers.Authorization,
          'X-Amz-Date': request.headers['X-Amz-Date'],
          'Host': endpointUrl.hostname,
          'Content-Length': Buffer.byteLength(bodyString)
        },
        timeout: 60000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      });
      
      // Check for error responses from Bedrock
      if (response.data && response.data.Output && response.data.Output.__type) {
        const errorType = response.data.Output.__type;
        const errorMessage = response.data.Output.message || response.data.Output.Message || 'Unknown Bedrock API error';
        console.error(`❌ [Bedrock QA] Bedrock API error: ${errorType}`);
        console.error(`   Error message: ${errorMessage}`);
        console.error(`   Full response:`, JSON.stringify(response.data, null, 2));
        throw new Error(`Bedrock API error (${errorType}): ${errorMessage}`);
      }
      
      return { raw: response.data };
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        const statusText = error.response.statusText;
        const errorData = error.response.data;
        
        console.error(`❌ [Bedrock QA] HTTP error: ${status} ${statusText}`);
        console.error(`   Response data:`, JSON.stringify(errorData, null, 2));
        console.error(`   Endpoint: ${endpoint}`);
        console.error(`   Auth method: AWS Signature V4`);
        console.error(`   Region: ${REGION}`);
        console.error(`   Model ID: ${MODEL_ID}`);
        
        if (status === 403) {
          const errorMsg = errorData?.Message || errorData?.message || 'Access denied';
          let helpMsg = `Bedrock API access denied (403): ${errorMsg}\n\n`;
          helpMsg += `💡 Troubleshooting AWS IAM Credentials:\n`;
          helpMsg += `   1. Verify AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are correct\n`;
          helpMsg += `   2. Check IAM permissions - user/role needs bedrock:InvokeModel\n`;
          helpMsg += `   3. Verify the model ID is available in region ${REGION}\n`;
          helpMsg += `   4. Test credentials: aws sts get-caller-identity\n`;
          helpMsg += `   5. Check Bedrock access: aws bedrock list-foundation-models --region ${REGION}\n\n`;
          helpMsg += `💡 Required IAM Policy:\n`;
          helpMsg += `   {\n`;
          helpMsg += `     "Effect": "Allow",\n`;
          helpMsg += `     "Action": "bedrock:InvokeModel",\n`;
          helpMsg += `     "Resource": "arn:aws:bedrock:${REGION}::foundation-model/${MODEL_ID}"\n`;
          helpMsg += `   }\n\n`;
          helpMsg += `💡 Alternative: Use Bearer Token (if available):\n`;
          helpMsg += `   - Set AWS_BEARER_TOKEN_BEDROCK in .env`;
          throw new Error(helpMsg);
        } else if (status === 401) {
          throw new Error(`Bedrock API unauthorized (401): Invalid AWS credentials. Please verify AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.`);
        } else {
          throw new Error(`Bedrock API HTTP error: ${status} - ${JSON.stringify(errorData)}`);
        }
      }
      throw error;
    }
  }
}

module.exports = { qaWithBedrockText };


