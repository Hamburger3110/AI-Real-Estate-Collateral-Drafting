const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { createContract, pool } = require('../db');

// Create sample contracts (development only)
router.post('/seed', authenticateToken, async (req, res) => {
  try {
    // Get user IDs for sample data
    const usersResult = await pool.query('SELECT user_id, full_name FROM users LIMIT 3');
    const users = usersResult.rows;
    
    if (users.length === 0) {
      return res.status(400).json({ error: 'No users found. Please seed users first.' });
    }

    // Check if contracts already exist
    const existingContracts = await pool.query('SELECT COUNT(*) FROM contracts');
    if (parseInt(existingContracts.rows[0].count) > 0) {
      return res.status(200).json({ message: 'Sample contracts already exist', count: existingContracts.rows[0].count });
    }

    const sampleContracts = [
      {
        contract_number: 'CT-2024-001',
        customer_name: 'John Smith',
        property_address: '123 Main St, Springfield, IL 62701',
        loan_amount: 250000,
        status: 'draft',
        current_approval_stage: 'document_review',
        priority: 'medium',
        generated_by: users[0].user_id
      },
      {
        contract_number: 'CT-2024-002',
        customer_name: 'Jane Doe',
        property_address: '456 Oak Avenue, Chicago, IL 60601',
        loan_amount: 180000,
        status: 'draft',
        current_approval_stage: 'credit_analysis',
        priority: 'high',
        generated_by: users[1] ? users[1].user_id : users[0].user_id
      },
      {
        contract_number: 'CT-2024-003',
        customer_name: 'Robert Brown',
        property_address: '789 Pine Road, Naperville, IL 60540',
        loan_amount: 320000,
        status: 'approved',
        current_approval_stage: 'completed',
        priority: 'low',
        generated_by: users[2] ? users[2].user_id : users[0].user_id,
        approved_by: users[0].user_id,
        approved_at: new Date()
      },
      {
        contract_number: 'CT-2024-004',
        customer_name: 'Emily Davis',
        property_address: '321 Elm Street, Peoria, IL 61601',
        loan_amount: 290000,
        status: 'draft',
        current_approval_stage: 'legal_review',
        priority: 'medium',
        generated_by: users[1] ? users[1].user_id : users[0].user_id
      }
    ];

    const createdContracts = [];
    for (const contractData of sampleContracts) {
      const result = await pool.query(
        'INSERT INTO contracts (contract_number, customer_name, property_address, loan_amount, status, current_approval_stage, priority, generated_by, approved_by, approved_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
        [
          contractData.contract_number,
          contractData.customer_name,
          contractData.property_address,
          contractData.loan_amount,
          contractData.status,
          contractData.current_approval_stage,
          contractData.priority,
          contractData.generated_by,
          contractData.approved_by || null,
          contractData.approved_at || null
        ]
      );
      createdContracts.push(result.rows[0]);
    }

    res.json({ 
      message: 'Sample contracts created successfully', 
      contracts: createdContracts,
      count: createdContracts.length 
    });
  } catch (err) {
    console.error('Error creating sample contracts:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create contract (protected & validated)
router.post('/', authenticateToken, async (req, res) => {
  const { document_ids, contract_number, customer_name, property_address, loan_amount, generated_by } = req.body;
  if (!contract_number || !customer_name || !property_address || loan_amount === undefined || !generated_by) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const contract = await createContract({
      contract_number,
      customer_name,
      property_address,
      loan_amount,
      generated_pot_uri: req.body.generated_pot_uri || '',
      generated_by,
      status: 'started'
    });

    // If document_ids are provided, link them to this contract
    if (document_ids && Array.isArray(document_ids)) {
      for (const documentId of document_ids) {
        await pool.query('UPDATE documents SET contract_id = $1 WHERE document_id = $2', [contract.contract_id, documentId]);
      }
    }

    res.json(contract);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Validate contract completion (protected) - ensures documents are attached
router.put('/:id/validate', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    // Check if contract exists
    const contractResult = await pool.query('SELECT * FROM contracts WHERE contract_id = $1', [id]);
    if (contractResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Check if contract has at least one attached document
    const documentsResult = await pool.query('SELECT COUNT(*) FROM documents WHERE contract_id = $1', [id]);
    const documentCount = parseInt(documentsResult.rows[0].count);

    if (documentCount === 0) {
      return res.status(400).json({ 
        error: 'Contract validation failed: At least one document must be attached to complete the contract.',
        document_count: documentCount
      });
    }

    // Update contract status if validation passes
    const updatedContract = await pool.query(
      'UPDATE contracts SET status = $1, current_approval_stage = $2 WHERE contract_id = $3 RETURNING *',
      ['completed', 'document_review_complete', id]
    );

    res.json({
      message: 'Contract validation successful',
      contract: updatedContract.rows[0],
      document_count: documentCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all contracts (protected) with user and document information
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.*,
        u_gen.full_name as generated_by_name,
        u_app.full_name as approved_by_name,
        COUNT(d.document_id) as document_count,
        ARRAY_AGG(d.file_name) FILTER (WHERE d.file_name IS NOT NULL) as document_file_names,
        ARRAY_AGG(d.document_type) FILTER (WHERE d.document_type IS NOT NULL) as document_types
      FROM contracts c
      LEFT JOIN users u_gen ON c.generated_by = u_gen.user_id
      LEFT JOIN users u_app ON c.approved_by = u_app.user_id
      LEFT JOIN documents d ON d.contract_id = c.contract_id
      GROUP BY c.contract_id, u_gen.full_name, u_app.full_name
      ORDER BY c.generated_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get contract by ID (protected)
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT 
        c.*,
        u_gen.full_name as generated_by_name,
        u_app.full_name as approved_by_name
      FROM contracts c
      LEFT JOIN users u_gen ON c.generated_by = u_gen.user_id
      LEFT JOIN users u_app ON c.approved_by = u_app.user_id
      WHERE c.contract_id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Get associated documents
    const documentsResult = await pool.query(`
      SELECT document_id, file_name, document_type, upload_date, status, ss_uri
      FROM documents 
      WHERE contract_id = $1
      ORDER BY upload_date DESC
    `, [id]);

    const contract = result.rows[0];
    contract.documents = documentsResult.rows;
    res.json(contract);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update contract by ID (protected)
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { contract_number, customer_name, property_address, loan_amount, generated_pot_uri, generated_by, status, approved_by } = req.body;
  
  try {
    // Get current contract data first
    const currentResult = await pool.query('SELECT * FROM contracts WHERE contract_id = $1', [id]);
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    const currentContract = currentResult.rows[0];
    
    // Update with provided values or keep existing ones
    const updateValues = {
      contract_number: contract_number !== undefined ? contract_number : currentContract.contract_number,
      customer_name: customer_name !== undefined ? customer_name : currentContract.customer_name,
      property_address: property_address !== undefined ? property_address : currentContract.property_address,
      loan_amount: loan_amount !== undefined ? loan_amount : currentContract.loan_amount,
      generated_pot_uri: generated_pot_uri !== undefined ? generated_pot_uri : currentContract.generated_pot_uri,
      generated_by: generated_by !== undefined ? generated_by : currentContract.generated_by,
      status: status !== undefined ? status : currentContract.status,
      approved_by: approved_by !== undefined ? approved_by : currentContract.approved_by,
      approved_at: status === 'approved' && !currentContract.approved_at ? new Date() : currentContract.approved_at
    };
    
    const result = await pool.query(
      'UPDATE contracts SET contract_number = $1, customer_name = $2, property_address = $3, loan_amount = $4, generated_pot_uri = $5, generated_by = $6, status = $7, approved_by = $8, approved_at = $9 WHERE contract_id = $10 RETURNING *',
      [
        updateValues.contract_number,
        updateValues.customer_name,
        updateValues.property_address,
        updateValues.loan_amount,
        updateValues.generated_pot_uri,
        updateValues.generated_by,
        updateValues.status,
        updateValues.approved_by,
        updateValues.approved_at,
        id
      ]
    );
    
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
