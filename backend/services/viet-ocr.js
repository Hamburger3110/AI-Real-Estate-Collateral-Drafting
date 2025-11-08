const axios = require('axios');
const http = require('http');
const https = require('https');

/**
 * VietOCR adapter.
 * Prefers an HTTP endpoint (VIETOCR_HTTP_ENDPOINT) that accepts { fileName, dataBase64 } and returns { text }.
 * If not configured, returns a graceful fallback with empty text.
 */
async function extractTextWithVietOCR(buffer, fileName) {
  const endpoint = process.env.VIETOCR_HTTP_ENDPOINT;
  const startedAt = Date.now();

  if (!endpoint) {
    return {
      text: '',
      meta: {
        provider: 'vietocr-http',
        configured: false,
        duration_ms: Date.now() - startedAt,
        note: 'VIETOCR_HTTP_ENDPOINT not set; returning empty text'
      }
    };
  }

  try {
    const payload = {
      fileName: fileName || 'document',
      dataBase64: buffer.toString('base64')
    };

    const res = await axios.post(endpoint, payload, { 
      timeout: 180000, // 3 minutes - first request may download model weights
      // Prevent socket hang up
      httpAgent: new http.Agent({ keepAlive: true }),
      httpsAgent: new https.Agent({ keepAlive: true })
    });
    const text = (res && res.data && typeof res.data.text === 'string') ? res.data.text : '';

    return {
      text,
      meta: {
        provider: 'vietocr-http',
        configured: true,
        duration_ms: Date.now() - startedAt,
        status: res && res.status
      }
    };
  } catch (error) {
    return {
      text: '',
      meta: {
        provider: 'vietocr-http',
        configured: true,
        duration_ms: Date.now() - startedAt,
        error: error.message
      }
    };
  }
}

module.exports = { extractTextWithVietOCR };


