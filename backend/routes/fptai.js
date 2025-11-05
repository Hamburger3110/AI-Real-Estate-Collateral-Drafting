const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { parseExtractionResult, validateWebhookSignature } = require('../config/fptai-config');

/**
 * Webhook endpoint to receive FPT.AI OCR extraction completion callbacks
 * POST /fptai/webhook
 * 
 * Expected payload from FPT.AI:
 * {
 *   document_id: "123",
 *   job_id: "fptai-job-xyz",
 *   status: "completed",
 *   confidence: 96.5,
 *   data: { ... extracted fields ... }
 * }
 */
router.post('/webhook', async (req, res) => {
  try {
    console.log('📨 Received FPT.AI webhook callback');
    
    // Note: FPT.AI does not support webhooks - this endpoint is for future use or manual testing
    // Signature validation is skipped since FPT.AI doesn't provide webhook signatures

    const { document_id, job_id, status, ...extractionData } = req.body;

    if (!document_id) {
      console.error('❌ Missing document_id in webhook payload');
      return res.status(400).json({ error: 'Missing document_id' });
    }

    // Check if document exists
    const documentResult = await pool.query(
      'SELECT * FROM documents WHERE document_id = $1',
      [document_id]
    );

    if (documentResult.rows.length === 0) {
      console.error(`❌ Document ${document_id} not found`);
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = documentResult.rows[0];
    console.log(`📄 Processing OCR result for document: ${document.file_name}`);

    // Parse FPT.AI extraction result
    const parsedResult = parseExtractionResult(req.body, document.document_type);

    if (!parsedResult.success) {
      console.error(`❌ Failed to parse FPT.AI extraction result for document ${document_id}`);
      // Update document status to error
      await pool.query(
        `UPDATE documents 
         SET status = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE document_id = $2`,
        ['Uploaded', document_id] // Keep as Uploaded if extraction failed
      );
      return res.status(500).json({ error: 'Failed to parse extraction result' });
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Update document with extraction results
      const updateQuery = `
        UPDATE documents 
        SET 
          status = $1,
          ocr_extracted_json = $2,
          confidence_score = $3,
          needs_manual_review = $4,
          extraction_completed_at = CURRENT_TIMESTAMP,
          textract_job_id = $5,
          updated_at = CURRENT_TIMESTAMP
        WHERE document_id = $6
        RETURNING *
      `;

      const updatedDocument = await client.query(updateQuery, [
        parsedResult.needsManualReview ? 'Needs Review' : 'Extracted', // Status based on confidence
        JSON.stringify(parsedResult.rawResponse), // Store full FPT.AI response
        parsedResult.confidenceScore,
        parsedResult.needsManualReview,
        job_id || 'fptai-job',
        document_id
      ]);
      
      // If confidence is high (≥95%), automatically store extracted fields
      if (!parsedResult.needsManualReview && parsedResult.extractedFields) {
        for (const field of parsedResult.extractedFields) {
          await client.query(
            `INSERT INTO extracted_fields 
             (document_id, field_name, field_value, confidence_score, validated, validated_at)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
             ON CONFLICT (document_id, field_name) 
             DO UPDATE SET field_value = $3, confidence_score = $4, validated = $5, validated_at = CURRENT_TIMESTAMP`,
            [document_id, field.field_name, field.field_value, field.confidence_score, true]
          );
        }
        
        // Update document status to validated
        await client.query(
          'UPDATE documents SET status = $1 WHERE document_id = $2',
          ['Validated', document_id]
        );
      }
      
      await client.query('COMMIT');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    console.log(`✅ Document ${document_id} extraction completed:`);
    console.log(`   - Confidence Score: ${parsedResult.confidenceScore}%`);
    console.log(`   - Needs Manual Review: ${parsedResult.needsManualReview ? 'YES' : 'NO'}`);

    // If this document is linked to a contract, we could trigger notifications here
    if (document.contract_id) {
      console.log(`📋 Document is linked to contract ${document.contract_id}`);
      // TODO: Trigger notification to frontend via WebSocket or polling
    }

    res.json({
      success: true,
      message: 'Extraction result processed successfully',
      document_id,
      confidence_score: parsedResult.confidenceScore,
      needs_manual_review: parsedResult.needsManualReview
    });

  } catch (error) {
    console.error('❌ Error processing FPT.AI webhook:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: error.message 
    });
  }
});

/**
 * Get extraction status for a document
 * GET /fptai/extraction-status/:documentId
 * 
 * Used for polling by frontend to check if extraction is complete
 */
router.get('/extraction-status/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;

    const result = await pool.query(
      `SELECT 
        document_id,
        file_name,
        status,
        confidence_score,
        needs_manual_review,
        extraction_completed_at,
        ocr_extracted_json
      FROM documents 
      WHERE document_id = $1`,
      [documentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = result.rows[0];

    res.json({
      success: true,
      document_id: document.document_id,
      file_name: document.file_name,
      status: document.status,
      extraction_completed: document.status === 'Extracted',
      confidence_score: document.confidence_score,
      needs_manual_review: document.needs_manual_review,
      extraction_completed_at: document.extraction_completed_at,
      extracted_data: document.ocr_extracted_json
    });

  } catch (error) {
    console.error('❌ Error fetching extraction status:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: error.message 
    });
  }
});

/**
 * Validate and save manually corrected extraction data
 * POST /fptai/validate-extraction/:documentId
 * 
 * Used when credit officer manually reviews and corrects extracted data
 */
router.post('/validate-extraction/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { correctedData, validatedBy } = req.body;

    if (!correctedData) {
      return res.status(400).json({ error: 'Missing correctedData' });
    }

    // Get current document
    const documentResult = await pool.query(
      'SELECT * FROM documents WHERE document_id = $1',
      [documentId]
    );

    if (documentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const currentDocument = documentResult.rows[0];
    const currentExtraction = currentDocument.ocr_extracted_json || {};

    // Merge corrected data with original extraction
    const updatedExtraction = {
      ...currentExtraction,
      corrected_data: correctedData,
      manually_validated: true,
      validated_at: new Date().toISOString(),
      validated_by: validatedBy
    };

    // Update document
    const updateResult = await pool.query(
      `UPDATE documents 
       SET 
         ocr_extracted_json = $1,
         status = $2,
         needs_manual_review = $3,
         updated_at = CURRENT_TIMESTAMP
       WHERE document_id = $4
       RETURNING *`,
      [
        JSON.stringify(updatedExtraction),
        'Validated', // Change status to Validated
        false, // No longer needs manual review
        documentId
      ]
    );

    console.log(`✅ Document ${documentId} validation completed by user ${validatedBy}`);

    res.json({
      success: true,
      message: 'Extraction data validated and saved',
      document: updateResult.rows[0]
    });

  } catch (error) {
    console.error('❌ Error validating extraction:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: error.message 
    });
  }
});

module.exports = router;

