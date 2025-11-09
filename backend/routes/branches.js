const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Get all branches
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM branches ORDER BY branch_name ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching branches:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get branch by name
router.get('/:branchName', authenticateToken, async (req, res) => {
  try {
    const { branchName } = req.params;
    const result = await pool.query(
      'SELECT * FROM branches WHERE branch_name = $1',
      [decodeURIComponent(branchName)]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Branch not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching branch:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create new branch (admin only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      branch_name,
      branch_location,
      address,
      bizregcode,
      bizregissue,
      bizreg_first_issued_date,
      phone_number,
      fax,
      representative_name,
      representative_title
    } = req.body;

    if (!branch_name || !branch_location) {
      return res.status(400).json({ error: 'Branch name and location are required' });
    }

    const result = await pool.query(
      `INSERT INTO branches (
        branch_name, branch_location, address, bizregcode, bizregissue,
        bizreg_first_issued_date, phone_number, fax, representative_name, representative_title
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        branch_name,
        branch_location,
        address || null,
        bizregcode || null,
        bizregissue || null,
        bizreg_first_issued_date || null,
        phone_number || null,
        fax || null,
        representative_name || null,
        representative_title || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating branch:', err);
    if (err.code === '23505') { // Unique violation
      res.status(409).json({ error: 'Branch with this name already exists' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// Update branch (admin only)
router.put('/:branchId', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { branchId } = req.params;
    const {
      branch_name,
      branch_location,
      address,
      bizregcode,
      bizregissue,
      bizreg_first_issued_date,
      phone_number,
      fax,
      representative_name,
      representative_title
    } = req.body;

    const result = await pool.query(
      `UPDATE branches SET
        branch_name = COALESCE($1, branch_name),
        branch_location = COALESCE($2, branch_location),
        address = COALESCE($3, address),
        bizregcode = COALESCE($4, bizregcode),
        bizregissue = COALESCE($5, bizregissue),
        bizreg_first_issued_date = COALESCE($6, bizreg_first_issued_date),
        phone_number = COALESCE($7, phone_number),
        fax = COALESCE($8, fax),
        representative_name = COALESCE($9, representative_name),
        representative_title = COALESCE($10, representative_title),
        updated_at = CURRENT_TIMESTAMP
      WHERE branch_id = $11
      RETURNING *`,
      [
        branch_name,
        branch_location,
        address,
        bizregcode,
        bizregissue,
        bizreg_first_issued_date,
        phone_number,
        fax,
        representative_name,
        representative_title,
        branchId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating branch:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

