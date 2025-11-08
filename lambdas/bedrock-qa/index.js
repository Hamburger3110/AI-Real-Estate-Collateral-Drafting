const AWS = require('aws-sdk');

const bedrock = new AWS.BedrockRuntime({ region: process.env.AWS_REGION || 'us-east-2' });
const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0';

exports.handler = async (event) => {
  try {
    const text = event.text || (event.qa && event.qa.text) || (event.ocr && event.ocr.text);
    if (!text) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing text' }) };
    }

    const prompt = `
Hãy đọc kỹ văn bản tiếng Việt dưới đây về giấy chứng nhận quyền sử dụng đất và TRÍCH XUẤT thành JSON theo ví dụ sau đây (chỉ trả về JSON, không giải thích):
{  "fields": 
    [  {"name": "Tên người sử dụng đất 1", "value": "...", "confidence": 0.95},    
       {"name": "Thửa đất số", "value": "...", "confidence": 0.92},    
       {"name": "Tờ bản đồ số", "value": "...", "confidence": 0.90},    
       {"name": "Diện tích", "value": "...", "confidence": 0.90},    
       {"name": "Loại đất", "value": ["Đất ở tại nông thôn", "Đất trồng cây lâu năm", "Đất nuôi trồng thủy sản"], "confidence": 0.90},
       {"name": "Thời hạn sử dụng đất", 
        "value":"{
                "Đất ở tại nông thôn": "lâu dài",
                "Đất trồng cây lâu năm": "15/10/2043",
                "Đất nuôi trồng thủy sản": "15/10/2043"
                }", 
        "confidence": 0.90},
       {"name": "Hình thức sử dụng đất", "value": "Sử dụng riêng", "confidence": 0.90},
       {"name": "Nguồn gốc sử dụng đất", 
        "value":"{
                "Đất ở tại nông thôn": "Nhà nước công nhận quyền sử dụng đất như giao đất có thu tiền sử dụng đất",
                "Đất trồng cây lâu năm": "Nhà nước công nhận quyền sử dụng đất như giao đất không thu tiền sử dụng đất",
                "Đất nuôi trồng thủy sản": "Nhà nước công nhận quyền sử dụng đất như giao đất không thu tiền sử dụng đất"
                }", 
        "confidence": 0.90},
       {"name": "Địa chỉ", "value": "...", "confidence": 0.90},
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
       {"name": "Ghi chú", "value": "...", "confidence": 0.90},
    ],  
    "overall_confidence": 0.90}
    
Yêu cầu:- Nếu không tìm thấy trường, để value = "" và confidence = 0.0.
- overall_confidence là mức tin cậy tổng thể (0–1).
- Chỉ trả về JSON hợp lệ.`;

    const body = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: text },
            { type: 'text', text: prompt }
          ]
        }
      ]
    };

    const resp = await bedrock.invokeModel({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(body)
    }).promise();

    const data = JSON.parse(resp.body.toString());
    let extractedText = '';
    if (data && Array.isArray(data.content)) {
      const item = data.content.find((it) => it.type === 'text');
      if (item) extractedText = item.text;
    }
    const match = extractedText.match(/\{[\s\S]*\}/);
    if (!match) {
      return { statusCode: 200, body: JSON.stringify({ fields: [], overall_confidence: 0, raw: data }) };
    }
    const json = JSON.parse(match[0]);
    return { statusCode: 200, body: JSON.stringify(json) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};


