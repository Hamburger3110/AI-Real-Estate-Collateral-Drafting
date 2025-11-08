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


