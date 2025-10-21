const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { createDocument, pool } = require('../db');

// Upload document metadata (protected & validated)
router.post('/', authenticateToken, async (req, res) => {
  const { file_name, ss_uri, document_type, upload_user_id, textract_job_id, status } = req.body;
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
    res.json(document);
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

// Update document by ID (protected)
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { file_name, ss_uri, document_type, upload_user_id, textract_job_id, status } = req.body;
  try {
    const result = await pool.query(
      'UPDATE documents SET file_name = $1, ss_uri = $2, document_type = $3, upload_user_id = $4, textract_job_id = $5, status = $6 WHERE document_id = $7 RETURNING *',
      [file_name, ss_uri, document_type, upload_user_id, textract_job_id, status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Document not found' });
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


module.exports = router;
