const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { createContract, pool } = require('../db');

// Create contract (protected & validated)
router.post('/', authenticateToken, async (req, res) => {
  const { document_id, contract_number, customer_name, property_address, loan_amount, generated_by } = req.body;
  if (!document_id || !contract_number || !customer_name || !property_address || loan_amount === undefined || !generated_by) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const contract = await createContract({
      document_id,
      contract_number,
      customer_name,
      property_address,
      loan_amount,
      generated_pot_uri: req.body.generated_pot_uri || '',
      generated_by,
      status: 'started'
    });
    res.json(contract);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all contracts (protected)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM contracts');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update contract by ID (protected)
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { contract_number, customer_name, property_address, loan_amount, generated_pot_uri, generated_by, status } = req.body;
  try {
    const result = await pool.query(
      'UPDATE contracts SET contract_number = $1, customer_name = $2, property_address = $3, loan_amount = $4, generated_pot_uri = $5, generated_by = $6, status = $7 WHERE contract_id = $8 RETURNING *',
      [contract_number, customer_name, property_address, loan_amount, generated_pot_uri, generated_by, status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contract not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete contract by ID (protected)
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM contracts WHERE contract_id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contract not found' });
    res.json({ message: 'Contract deleted', contract: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
