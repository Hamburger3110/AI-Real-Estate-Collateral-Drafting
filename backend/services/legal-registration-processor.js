const path = require('path');
const axios = require('axios');

/**
 * Legal Registration Processor
 * Orchestrates: QR detection -> (if none) VietOCR text -> Bedrock QA to JSON.
 * This module returns a normalized result; persistence is handled by callers.
 */

function normalizeResult(params) {
  const {
    documentId,
    pipeline,
    extractedJson,
    confidenceScore,
    needsManualReview,
    raw
  } = params;

  return {
    success: true,
    document_id: documentId,
    pipeline,
    extracted_json: extractedJson || {},
    confidence_score: typeof confidenceScore === 'number' ? confidenceScore : 0,
    needs_manual_review: Boolean(needsManualReview),
    raw: raw || {}
  };
}

/**
 * Process a Legal Registration file buffer.
 * Dependencies are injected to decouple implementations and ease testing.
 *
 * deps: {
 *   detectQr: (buffer) => Promise<{ found: boolean, payload?: any, meta?: any }>,
 *   extractTextWithVietOCR: (buffer, fileName) => Promise<{ text: string, meta?: any }>,
 *   qaWithBedrockText: (text, documentType) => Promise<{ raw: any }>,
 *   parseBedrockResult: (raw, documentType) => ({ success, confidenceScore, needsManualReview, extractedData, rawResponse })
 * }
 */
async function processLegalRegistration(buffer, fileName, documentId, deps) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Invalid buffer');
  }

  const safeFileName = fileName || `document_${documentId || 'unknown'}`;
  const documentType = 'Legal Registration';

  const {
    detectQr,
    extractTextWithVietOCR,
    qaWithBedrockText,
    parseBedrockResult
  } = deps || {};

  if (typeof detectQr !== 'function') {
    throw new Error('Missing dependency: detectQr');
  }

  // Try QR path first
  const qrResult = await detectQr(buffer).catch(() => ({ found: false }));
  if (qrResult && qrResult.found) {
    const payload = qrResult.payload;

    // If payload is a URL, fetch and extract text, then use Bedrock QA
    if (typeof payload === 'string' && /^https?:\/\//i.test(payload)) {
      let pageText = '';
      try {
        const resp = await axios.get(payload, { timeout: 15000 });
        const body = typeof resp.data === 'string' ? resp.data : '';
        // crude HTML -> text fallback without extra deps
        pageText = body
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      } catch (e) {
        // If fetch fails, fall back to treating payload as plain text
        pageText = String(payload);
      }

      if (process.env.NO_BEDROCK_TEST === '1') {
        return {
          success: true,
          document_id: documentId,
          pipeline: 'qr+page-text',
          extracted_json: {},
          confidence_score: 0,
          needs_manual_review: true,
          raw: { qr_url: payload, page_text: pageText }
        };
      }

      const qaRaw = await qaWithBedrockText(pageText, documentType);
      const parsed = parseBedrockResult(qaRaw && qaRaw.raw ? qaRaw.raw : qaRaw, documentType);

      if (!parsed || parsed.success !== true) {
        return {
          success: false,
          document_id: documentId,
          pipeline: 'qr+bedrock',
          error: 'Failed to parse Bedrock QA result from QR URL content',
          raw: { qr_payload: payload, page_text: pageText, bedrock_output: qaRaw }
        };
      }

      return normalizeResult({
        documentId,
        pipeline: 'qr+bedrock',
        extractedJson: parsed.extractedData,
        confidenceScore: parsed.confidenceScore,
        needsManualReview: parsed.needsManualReview,
        raw: { qr_url: payload, page_text: pageText, bedrock: parsed.rawResponse }
      });
    }

    // Otherwise, if the QR contains structured data (JSON or text), return directly
    const confidenceScore = 98;
    const needsManualReview = false;
    return normalizeResult({
      documentId,
      pipeline: 'qr',
      extractedJson: typeof payload === 'object' ? payload : { qr_text: String(payload || '') },
      confidenceScore,
      needsManualReview,
      raw: { qr: { meta: qrResult.meta || {}, payload } }
    });
  }

  // Fallback: VietOCR -> Bedrock QA
  if (typeof extractTextWithVietOCR !== 'function') {
    throw new Error('Missing dependency: extractTextWithVietOCR');
  }
  if (typeof qaWithBedrockText !== 'function') {
    throw new Error('Missing dependency: qaWithBedrockText');
  }
  if (typeof parseBedrockResult !== 'function') {
    throw new Error('Missing dependency: parseBedrockResult');
  }

  const ocr = await extractTextWithVietOCR(buffer, safeFileName);
  const ocrText = (ocr && typeof ocr.text === 'string') ? ocr.text : '';

  const qaRaw = await qaWithBedrockText(ocrText, documentType);
  const parsed = parseBedrockResult(qaRaw && qaRaw.raw ? qaRaw.raw : qaRaw, documentType);

  if (!parsed || parsed.success !== true) {
    return {
      success: false,
      document_id: documentId,
      pipeline: 'ocr+bedrock',
      error: 'Failed to parse Bedrock QA result',
      raw: { ocr_text: ocrText, bedrock_output: qaRaw }
    };
  }

  return normalizeResult({
    documentId,
    pipeline: 'ocr+bedrock',
    extractedJson: parsed.extractedData,
    confidenceScore: parsed.confidenceScore,
    needsManualReview: parsed.needsManualReview,
    raw: {
      ocr: { meta: (ocr && ocr.meta) || {}, text: ocrText },
      bedrock: parsed.rawResponse
    }
  });
}

module.exports = {
  processLegalRegistration
};


