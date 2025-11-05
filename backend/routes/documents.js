const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { createDocument, pool } = require('../db');
const fptaiProcessor = require('../services/fptai-processor');

// Upload document metadata (protected & validated)
router.post('/', authenticateToken, async (req, res) => {
  const { file_name, ss_uri, document_type, upload_user_id, textract_job_id, status, auto_process } = req.body;
  if (!file_name || !ss_uri || !document_type || !upload_user_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const document = await createDocument({
      file_name,
      ss_uri,
      document_type,
      upload_user_id,
      textract_job_id,
      status: status || 'Uploaded'
    });
    
    // If auto_process is true and document type supports FPT AI, start processing
    if (auto_process && ['ID Card', 'Passport', 'Driver License'].includes(document_type)) {
      // Don't wait for processing to complete, process in background
      setImmediate(async () => {
        try {
          await fptaiProcessor.processDocumentFromUpload(document.document_id);
          console.log(`✅ Background processing completed for document ${document.document_id}`);
        } catch (error) {
          console.error(`❌ Background processing failed for document ${document.document_id}:`, error);
        }
      });
      
      res.json({
        ...document,
        message: 'Document uploaded and processing started'
      });
    } else {
      res.json(document);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all documents (protected)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM documents');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single document by ID (protected)
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query(`
      SELECT d.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   'field_id', ef.field_id,
                   'field_name', ef.field_name,
                   'field_value', ef.field_value,
                   'confidence_score', ef.confidence_score,
                   'validated', ef.validated,
                   'validated_by', ef.validated_by,
                   'validated_at', ef.validated_at
                 )
               ) FILTER (WHERE ef.field_id IS NOT NULL), 
               '[]'
             ) as extracted_fields
      FROM documents d
      LEFT JOIN extracted_fields ef ON d.document_id = ef.document_id
      WHERE d.document_id = $1
      GROUP BY d.document_id
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching document:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update document by ID (protected)
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    // Get current document data first
    const currentDoc = await pool.query('SELECT * FROM documents WHERE document_id = $1', [id]);
    if (currentDoc.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const current = currentDoc.rows[0];
    const { file_name, ss_uri, document_type, upload_user_id, textract_job_id, status, contract_id } = req.body;
    
    // Use current values if not provided in request
    const result = await pool.query(
      'UPDATE documents SET file_name = $1, ss_uri = $2, document_type = $3, upload_user_id = $4, textract_job_id = $5, status = $6, contract_id = $7, updated_at = CURRENT_TIMESTAMP WHERE document_id = $8 RETURNING *',
      [
        file_name !== undefined ? file_name : current.file_name,
        ss_uri !== undefined ? ss_uri : current.ss_uri,
        document_type !== undefined ? document_type : current.document_type,
        upload_user_id !== undefined ? upload_user_id : current.upload_user_id,
        textract_job_id !== undefined ? textract_job_id : current.textract_job_id,
        status !== undefined ? status : current.status,
        contract_id !== undefined ? contract_id : current.contract_id,
        id
      ]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete document by ID (protected)
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM documents WHERE document_id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Document not found' });
    res.json({ message: 'Document deleted', document: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Process document with FPT AI extraction and confidence scoring
router.post('/:id/extract', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { extracted_data, overall_confidence } = req.body;
  
  try {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Update document with extraction results
      const needsReview = overall_confidence < 95;
      await client.query(
        `UPDATE documents SET 
         ocr_extracted_json = $1, 
         confidence_score = $2, 
         needs_manual_review = $3,
         status = $4,
         extraction_completed_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
         WHERE document_id = $5`,
        [
          JSON.stringify(extracted_data),
          overall_confidence,
          needsReview,
          needsReview ? 'Needs Review' : 'Extracted',
          id
        ]
      );
      
      // If confidence >= 95%, automatically save extracted fields
      if (!needsReview && extracted_data.fields) {
        for (const field of extracted_data.fields) {
          await client.query(
            `INSERT INTO extracted_fields 
             (document_id, field_name, field_value, confidence_score, validated, validated_at)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
             ON CONFLICT (document_id, field_name) 
             DO UPDATE SET field_value = $3, confidence_score = $4, validated = $5, validated_at = CURRENT_TIMESTAMP`,
            [id, field.field_name, field.field_value, field.confidence_score, true]
          );
        }
        
        // Update document status to validated
        await client.query(
          'UPDATE documents SET status = $1 WHERE document_id = $2',
          ['Validated', id]
        );
      }
      
      await client.query('COMMIT');
      
      // Get updated document with fields
      const result = await client.query(`
        SELECT d.*, 
               COALESCE(
                 json_agg(
                   json_build_object(
                     'field_id', ef.field_id,
                     'field_name', ef.field_name,
                     'field_value', ef.field_value,
                     'confidence_score', ef.confidence_score,
                     'validated', ef.validated,
                     'validated_at', ef.validated_at
                   )
                 ) FILTER (WHERE ef.field_id IS NOT NULL), 
                 '[]'
               ) as extracted_fields
        FROM documents d
        LEFT JOIN extracted_fields ef ON d.document_id = ef.document_id
        WHERE d.document_id = $1
        GROUP BY d.document_id
      `, [id]);
      
      res.json({
        document: result.rows[0],
        needs_manual_review: needsReview,
        message: needsReview 
          ? 'Document extracted but requires manual review due to low confidence score'
          : 'Document extracted and automatically validated'
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (err) {
    console.error('Extraction processing error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get document with extracted fields (protected)
router.get('/:id/fields', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query(`
      SELECT d.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   'field_id', ef.field_id,
                   'field_name', ef.field_name,
                   'field_value', ef.field_value,
                   'confidence_score', ef.confidence_score,
                   'validated', ef.validated,
                   'validated_by', ef.validated_by,
                   'validated_at', ef.validated_at
                 )
               ) FILTER (WHERE ef.field_id IS NOT NULL), 
               '[]'
             ) as extracted_fields
      FROM documents d
      LEFT JOIN extracted_fields ef ON d.document_id = ef.document_id
      WHERE d.document_id = $1
      GROUP BY d.document_id
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save manually validated fields (protected)
router.post('/:id/validate', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { fields, overall_confidence, needs_manual_review, status } = req.body;
  const user_id = req.user.user_id;
  
  try {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Update document
      await client.query(
        `UPDATE documents SET 
         confidence_score = $1, 
         needs_manual_review = $2,
         status = $3,
         updated_at = CURRENT_TIMESTAMP
         WHERE document_id = $4`,
        [overall_confidence, needs_manual_review || false, status || 'Validated', id]
      );
      
      // Save/update extracted fields
      if (fields && fields.length > 0) {
        for (const field of fields) {
          if (field.field_id) {
            // Update existing field
            await client.query(
              `UPDATE extracted_fields SET 
               field_value = $1, 
               confidence_score = $2, 
               validated = $3,
               validated_by = $4,
               validated_at = CURRENT_TIMESTAMP
               WHERE field_id = $5`,
              [field.field_value, field.confidence_score, true, user_id, field.field_id]
            );
          } else {
            // Insert new field
            await client.query(
              `INSERT INTO extracted_fields 
               (document_id, field_name, field_value, confidence_score, validated, validated_by, validated_at)
               VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
              [id, field.field_name, field.field_value, field.confidence_score, true, user_id]
            );
          }
        }
      }
      
      await client.query('COMMIT');
      
      // Get updated document
      const result = await client.query(`
        SELECT d.*, 
               COALESCE(
                 json_agg(
                   json_build_object(
                     'field_id', ef.field_id,
                     'field_name', ef.field_name,
                     'field_value', ef.field_value,
                     'confidence_score', ef.confidence_score,
                     'validated', ef.validated,
                     'validated_by', ef.validated_by,
                     'validated_at', ef.validated_at
                   )
                 ) FILTER (WHERE ef.field_id IS NOT NULL), 
                 '[]'
               ) as extracted_fields
        FROM documents d
        LEFT JOIN extracted_fields ef ON d.document_id = ef.document_id
        WHERE d.document_id = $1
        GROUP BY d.document_id
      `, [id]);
      
      res.json({
        document: result.rows[0],
        message: 'Document fields validated and saved successfully'
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (err) {
    console.error('Field validation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Process document with FPT AI (protected)
router.post('/:id/process', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    // Check if document exists and get details
    const docResult = await pool.query(
      'SELECT document_id, document_type, status FROM documents WHERE document_id = $1',
      [id]
    );
    
    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    const document = docResult.rows[0];
    
    // Check if document type supports FPT AI processing
    if (!['ID Card', 'Passport', 'Driver License'].includes(document.document_type)) {
      return res.status(400).json({ 
        error: `Document type '${document.document_type}' is not supported for FPT AI processing` 
      });
    }
    
    // Check if already processing
    if (document.status === 'Processing') {
      return res.status(400).json({ error: 'Document is already being processed' });
    }
    
    // Start processing
    const result = await fptaiProcessor.processDocumentFromUpload(id);
    
    res.json({
      message: 'Document processed successfully',
      document_id: id,
      confidence_score: result.confidenceScore,
      needs_manual_review: result.needsManualReview,
      extracted_fields_count: result.extractedFields?.length || 0
    });
    
  } catch (err) {
    console.error('Document processing error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get documents that need manual review (protected)
router.get('/review/pending', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   'field_id', ef.field_id,
                   'field_name', ef.field_name,
                   'field_value', ef.field_value,
                   'confidence_score', ef.confidence_score,
                   'validated', ef.validated
                 )
               ) FILTER (WHERE ef.field_id IS NOT NULL), 
               '[]'
             ) as extracted_fields
      FROM documents d
      LEFT JOIN extracted_fields ef ON d.document_id = ef.document_id
      WHERE d.needs_manual_review = true AND d.status != 'Rejected'
      GROUP BY d.document_id
      ORDER BY d.upload_date DESC
    `);
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
