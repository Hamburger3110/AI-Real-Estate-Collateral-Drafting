const path = require('path');
const axios = require('axios');

/**
 * Legal Registration Processor
 * Orchestrates: QR detection -> (if none) Google Cloud Vision OCR text -> Bedrock QA to JSON.
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
 *   extractTextWithGoogleVision: (buffer, fileName) => Promise<{ text: string, meta?: any }>,
 *   qaWithBedrockText: (text, documentType) => Promise<{ raw: any }>,
 *   parseBedrockResult: (raw, documentType) => ({ success, confidenceScore, needsManualReview, extractedData, rawResponse })
 * }
 */
async function processLegalRegistration(buffer, fileName, documentId, deps) {
  console.log('🚀 [Legal Registration Pipeline] Starting processing...');
  console.log(`   📄 File: ${fileName || 'unknown'}`);
  console.log(`   🆔 Document ID: ${documentId || 'N/A'}`);
  
  if (!buffer || !Buffer.isBuffer(buffer)) {
    console.error('❌ [Legal Registration Pipeline] Invalid buffer provided');
    throw new Error('Invalid buffer');
  }

  const safeFileName = fileName || `document_${documentId || 'unknown'}`;
  const documentType = 'Legal Registration';

  const {
    detectQr,
    extractTextWithGoogleVision,
    qaWithBedrockText,
    parseBedrockResult
  } = deps || {};

  if (typeof detectQr !== 'function') {
    console.error('❌ [Legal Registration Pipeline] Missing dependency: detectQr');
    throw new Error('Missing dependency: detectQr');
  }

  // Try QR path first
  console.log('🔍 [Legal Registration Pipeline] Stage 1: QR Code Detection...');
  const qrResult = await detectQr(buffer).catch(() => ({ found: false }));
  
  if (qrResult && qrResult.found) {
    console.log('✅ [Legal Registration Pipeline] QR Code detected!');
    console.log(`   📦 QR Payload type: ${typeof qrResult.payload}`);
    const payload = qrResult.payload;

    // If payload is a URL, fetch and extract text, then use Bedrock QA
    if (typeof payload === 'string' && /^https?:\/\//i.test(payload)) {
      console.log('🌐 [Legal Registration Pipeline] Stage 2: QR contains URL, fetching content...');
      console.log(`   🔗 URL: ${payload}`);
      let pageText = '';
      try {
        console.log('   ⏳ Fetching URL content...');
        const resp = await axios.get(payload, { timeout: 15000 });
        const body = typeof resp.data === 'string' ? resp.data : '';
        console.log(`   ✅ URL fetched successfully (${body.length} chars)`);
        console.log('   🔄 Extracting text from HTML...');
        // crude HTML -> text fallback without extra deps
        pageText = body
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        console.log(`   ✅ Text extracted (${pageText.length} chars)`);
      } catch (e) {
        console.warn(`   ⚠️ URL fetch failed: ${e.message}, using payload as plain text`);
        // If fetch fails, fall back to treating payload as plain text
        pageText = String(payload);
      }

      if (process.env.NO_BEDROCK_TEST === '1') {
        console.log('⚠️ [Legal Registration Pipeline] NO_BEDROCK_TEST mode - skipping Bedrock QA');
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

      console.log('🤖 [Legal Registration Pipeline] Stage 3: Sending text to Bedrock QA...');
      console.log(`   📝 Text length: ${pageText.length} characters`);
      const qaRaw = await qaWithBedrockText(pageText, documentType);
      console.log('✅ [Legal Registration Pipeline] Bedrock QA response received');
      console.log('🤖 [Legal Registration Pipeline] Full Bedrock QA Output:');
      console.log(JSON.stringify(qaRaw, null, 2));
      console.log('🔄 [Legal Registration Pipeline] Stage 4: Parsing Bedrock result...');
      const parsed = parseBedrockResult(qaRaw && qaRaw.raw ? qaRaw.raw : qaRaw, documentType);

      if (!parsed || parsed.success !== true) {
        console.error('❌ [Legal Registration Pipeline] Failed to parse Bedrock QA result');
        return {
          success: false,
          document_id: documentId,
          pipeline: 'qr+bedrock',
          error: 'Failed to parse Bedrock QA result from QR URL content',
          raw: { qr_payload: payload, page_text: pageText, bedrock_output: qaRaw }
        };
      }

      console.log('✅ [Legal Registration Pipeline] Bedrock result parsed successfully');
      console.log(`   📊 Confidence Score: ${parsed.confidenceScore || 'N/A'}`);
      console.log(`   👀 Needs Manual Review: ${parsed.needsManualReview ? 'Yes' : 'No'}`);
      console.log(`   📋 Extracted Fields: ${Object.keys(parsed.extractedData || {}).length} fields`);
      console.log('🎉 [Legal Registration Pipeline] Processing complete via QR+Bedrock pipeline');
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
    console.log('✅ [Legal Registration Pipeline] QR contains structured data, returning directly');
    console.log(`   📦 Payload type: ${typeof payload === 'object' ? 'JSON Object' : 'Text'}`);
    const confidenceScore = 98;
    const needsManualReview = false;
    console.log('🎉 [Legal Registration Pipeline] Processing complete via QR-only pipeline');
    return normalizeResult({
      documentId,
      pipeline: 'qr',
      extractedJson: typeof payload === 'object' ? payload : { qr_text: String(payload || '') },
      confidenceScore,
      needsManualReview,
      raw: { qr: { meta: qrResult.meta || {}, payload } }
    });
  }

  // Fallback: Google Cloud Vision OCR -> Bedrock QA
  console.log('⚠️ [Legal Registration Pipeline] No QR code found, falling back to OCR pipeline');
  if (typeof extractTextWithGoogleVision !== 'function') {
    console.error('❌ [Legal Registration Pipeline] Missing dependency: extractTextWithGoogleVision');
    throw new Error('Missing dependency: extractTextWithGoogleVision');
  }
  if (typeof qaWithBedrockText !== 'function') {
    console.error('❌ [Legal Registration Pipeline] Missing dependency: qaWithBedrockText');
    throw new Error('Missing dependency: qaWithBedrockText');
  }
  if (typeof parseBedrockResult !== 'function') {
    console.error('❌ [Legal Registration Pipeline] Missing dependency: parseBedrockResult');
    throw new Error('Missing dependency: parseBedrockResult');
  }

  console.log('👁️ [Legal Registration Pipeline] Stage 2: Google Cloud Vision OCR...');
  console.log(`   📄 Processing file: ${safeFileName}`);
  const ocr = await extractTextWithGoogleVision(buffer, safeFileName);
  const ocrText = (ocr && typeof ocr.text === 'string') ? ocr.text : '';
  console.log('✅ [Legal Registration Pipeline] OCR completed');
  console.log(`   📝 Extracted text length: ${ocrText.length} characters`);
  console.log('📄 [Legal Registration Pipeline] Full Google Vision OCR Output:');
  console.log(JSON.stringify(ocr, null, 2));
  if (ocrText.length === 0) {
    console.warn('⚠️ [Legal Registration Pipeline] Warning: No text extracted from OCR');
  }

  console.log('🤖 [Legal Registration Pipeline] Stage 3: Sending OCR text to Bedrock QA...');
  const qaRaw = await qaWithBedrockText(ocrText, documentType);
  console.log('✅ [Legal Registration Pipeline] Bedrock QA response received');
  console.log('🤖 [Legal Registration Pipeline] Full Bedrock QA Output:');
  console.log(JSON.stringify(qaRaw, null, 2));
  console.log('🔄 [Legal Registration Pipeline] Stage 4: Parsing Bedrock result...');
  const parsed = parseBedrockResult(qaRaw && qaRaw.raw ? qaRaw.raw : qaRaw, documentType);

  if (!parsed || parsed.success !== true) {
    console.error('❌ [Legal Registration Pipeline] Failed to parse Bedrock QA result');
    return {
      success: false,
      document_id: documentId,
      pipeline: 'ocr+bedrock',
      error: 'Failed to parse Bedrock QA result',
      raw: { ocr_text: ocrText, bedrock_output: qaRaw }
    };
  }

  console.log('✅ [Legal Registration Pipeline] Bedrock result parsed successfully');
  console.log(`   📊 Confidence Score: ${parsed.confidenceScore || 'N/A'}`);
  console.log(`   👀 Needs Manual Review: ${parsed.needsManualReview ? 'Yes' : 'No'}`);
  console.log(`   📋 Extracted Fields: ${Object.keys(parsed.extractedData || {}).length} fields`);
  console.log('🎉 [Legal Registration Pipeline] Processing complete via OCR+Bedrock pipeline');
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


