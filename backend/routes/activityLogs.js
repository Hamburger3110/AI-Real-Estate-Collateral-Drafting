const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { createActivityLog, pool } = require('../db');

// Log activity (protected & validated)
router.post('/', authenticateToken, async (req, res) => {
  const { user_id, document_id, action, action_detail } = req.body;
  if (!user_id || !document_id || !action) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const log = await createActivityLog({
      user_id,
      document_id,
      action,
      action_detail: action_detail || ''
    });
    res.json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all activity logs (protected)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM activity_logs');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update activity log by ID (protected)
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { user_id, document_id, action, action_detail } = req.body;
  try {
    const result = await pool.query(
      'UPDATE activity_logs SET user_id = $1, document_id = $2, action = $3, action_detail = $4 WHERE log_id = $5 RETURNING *',
      [user_id, document_id, action, action_detail, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Activity log not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete activity log by ID (protected)
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM activity_logs WHERE log_id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Activity log not found' });
    res.json({ message: 'Activity log deleted', log: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
