const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { createExtractedField, pool } = require('../db');

// Store extracted fields (protected & validated)
router.post('/', authenticateToken, async (req, res) => {
  const { document_id, field_name, field_value, confidence_score } = req.body;
  if (!document_id || !field_name || !field_value || confidence_score === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const field = await createExtractedField({
      document_id,
      field_name,
      field_value,
      confidence_score,
      validated: false,
      validated_by: null,
      validated_at: null
    });
    res.json(field);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all extracted fields (protected)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM extracted_fields');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update extracted field by ID (protected)
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { document_id, field_name, field_value, confidence_score, validated, validated_by, validated_at } = req.body;
  try {
    const result = await pool.query(
      'UPDATE extracted_fields SET document_id = $1, field_name = $2, field_value = $3, confidence_score = $4, validated = $5, validated_by = $6, validated_at = $7 WHERE field_id = $8 RETURNING *',
      [document_id, field_name, field_value, confidence_score, validated, validated_by, validated_at, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Extracted field not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete extracted field by ID (protected)
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM extracted_fields WHERE field_id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Extracted field not found' });
    res.json({ message: 'Extracted field deleted', field: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
