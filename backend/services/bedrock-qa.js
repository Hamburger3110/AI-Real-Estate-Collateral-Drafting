const AWS = require('aws-sdk');
const axios = require('axios');

const REGION = process.env.AWS_REGION || 'us-east-1';
// Inference profile ID for Claude 3.5 Sonnet (required for on-demand models)
const INFERENCE_PROFILE_ID = process.env.BEDROCK_MODEL_ID || process.env.BEDROCK_INFERENCE_PROFILE_ID || 'us.anthropic.claude-3-5-sonnet-20240620-v1:0';
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

  // Always use inference-profiles endpoint (Claude 3.5 uses inference profiles)
  const endpoint = `https://bedrock-runtime.${REGION}.amazonaws.com/inference-profiles/${INFERENCE_PROFILE_ID}/invoke`;

  if (BEARER_TOKEN) {
    // Use Bearer token authentication
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
    
    // Create a request object for signing
    const url = require('url');
    const endpointUrl = new URL(endpoint);
    const bodyString = JSON.stringify(requestBody);
    
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
    await credentials.getPromise(); // Ensure credentials are loaded
    signer.addAuthorization(credentials, new Date());
    
    // Make the request using axios with signed headers
    const response = await axios.post(endpoint, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': request.headers.Authorization,
        'X-Amz-Date': request.headers['X-Amz-Date'],
        'Host': endpointUrl.hostname
      },
      timeout: 60000
    });
    return { raw: response.data };
  }
}

module.exports = { qaWithBedrockText };


