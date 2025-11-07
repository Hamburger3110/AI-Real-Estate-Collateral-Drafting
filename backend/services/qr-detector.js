const axios = require('axios');
const FormData = require('form-data');

/**
 * Detect and decode a QR code using goQR.me API.
 * Docs: https://goqr.me/api/doc/read-qr-code/
 * Returns { found: boolean, payload?: any, meta?: object, error?: string }
 */
async function detect(buffer) {
  try {
    const form = new FormData();
    form.append('file', buffer, { filename: 'qr.jpg', contentType: 'image/jpeg' });

    const url = 'http://api.qrserver.com/v1/read-qr-code/?outputformat=json';
    const response = await axios.post(url, form, {
      headers: form.getHeaders(),
      maxContentLength: 1 * 1024 * 1024,
      timeout: 15000
    });

    const body = Array.isArray(response.data) ? response.data : [];
    const first = body[0] || {};
    const symbol = Array.isArray(first.symbol) ? first.symbol[0] : null;
    const data = symbol ? symbol.data : null;
    const error = symbol ? symbol.error : 'No symbol';

    if (!data || error) {
      return { found: false, meta: { provider: 'goqr', error } };
    }

    let payload = data;
    try {
      const trimmed = typeof payload === 'string' ? payload.trim() : payload;
      if (typeof trimmed === 'string' && trimmed.startsWith('{') && trimmed.endsWith('}')) {
        payload = JSON.parse(trimmed);
      }
    } catch (_) {}

    return { found: true, payload, meta: { provider: 'goqr' } };
  } catch (error) {
    return { found: false, error: error.message, meta: { provider: 'goqr' } };
  }
}

module.exports = { detect };


