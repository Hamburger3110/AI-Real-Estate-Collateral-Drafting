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

// Get all activity logs with user and document details (protected)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { limit = 100, offset = 0, user_id, action, contract_id } = req.query;
    
    let query = `
      SELECT 
        al.*,
        u.full_name as user_name,
        u.role as user_role,
        d.file_name as document_name,
        d.document_type,
        c.contract_number,
        c.customer_name
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.user_id
      LEFT JOIN documents d ON al.document_id = d.document_id
      LEFT JOIN contracts c ON al.contract_id = c.contract_id
    `;
    
    let conditions = [];
    let params = [];
    let paramIndex = 1;
    
    if (user_id) {
      conditions.push(`al.user_id = $${paramIndex}`);
      params.push(user_id);
      paramIndex++;
    }
    
    if (action) {
      conditions.push(`al.action ILIKE $${paramIndex}`);
      params.push(`%${action}%`);
      paramIndex++;
    }
    
    if (contract_id && contract_id !== 'null') {
      conditions.push(`c.contract_id = $${paramIndex}`);
      params.push(contract_id);
      paramIndex++;
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ` ORDER BY al.timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    
    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) 
      FROM activity_logs al
      LEFT JOIN documents d ON al.document_id = d.document_id
      LEFT JOIN contracts c ON d.contract_id = c.contract_id
    `;
    
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }
    
    const countResult = await pool.query(countQuery, params.slice(0, -2));
    
    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
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

// Get activity logs for a specific contract (protected)
router.get('/contract/:contractId', authenticateToken, async (req, res) => {
  const { contractId } = req.params;
  const { limit = 50, offset = 0 } = req.query;
  
  try {
    const query = `
      SELECT 
        al.*,
        u.full_name as user_name,
        u.role as user_role,
        d.file_name as document_name,
        d.document_type,
        c.contract_number,
        c.customer_name
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.user_id
      LEFT JOIN documents d ON al.document_id = d.document_id
      LEFT JOIN contracts c ON al.contract_id = c.contract_id
      WHERE al.contract_id = $1
      ORDER BY al.timestamp DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await pool.query(query, [contractId, parseInt(limit), parseInt(offset)]);
    
    // Get total count for this contract
    const countQuery = `
      SELECT COUNT(*) 
      FROM activity_logs al
      WHERE al.contract_id = $1
    `;
    
    const countResult = await pool.query(countQuery, [contractId]);
    
    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
      contractId: contractId
    });
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
