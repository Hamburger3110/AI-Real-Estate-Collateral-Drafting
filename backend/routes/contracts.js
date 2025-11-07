const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { createContract, pool } = require('../db');
const { quickLog } = require('../middleware/activityLogger');

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
  if (!contract_number || !customer_name || loan_amount === undefined || !generated_by) {
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

    // Log activity
    await quickLog.contractCreate(req, contract.contract_id, contract.contract_number);
    
    // Log workflow start - contracts typically start at document_review stage
    await quickLog.workflowStageStart(req, contract.contract_id, contract.contract_number, 'Document Review', 'System');

    res.json(contract);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Validate contract completion (protected) - ensures documents are attached and starts approval workflow
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

    // Start approval workflow instead of marking as completed
    const updatedContract = await pool.query(
      'UPDATE contracts SET status = $1, current_approval_stage = $2 WHERE contract_id = $3 RETURNING *',
      ['processing', 'document_review', id]
    );

    res.json({
      message: 'Contract validated successfully. Approval workflow has been started.',
      contract: updatedContract.rows[0],
      document_count: documentCount,
      workflow_status: 'started'
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

    // Log contract view activity
    await quickLog.contractView(req, contract.contract_id, contract.contract_number);

    res.json(contract);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update contract by ID (protected)
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { contract_number, customer_name, property_address, loan_amount, generated_pot_uri, generated_by, status, approved_by, current_approval_stage } = req.body;
  
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
      approved_at: status === 'approved' && !currentContract.approved_at ? new Date() : currentContract.approved_at,
      current_approval_stage: current_approval_stage !== undefined ? current_approval_stage : currentContract.current_approval_stage
    };
    
    const result = await pool.query(
      'UPDATE contracts SET contract_number = $1, customer_name = $2, property_address = $3, loan_amount = $4, generated_pot_uri = $5, generated_by = $6, status = $7, approved_by = $8, approved_at = $9, current_approval_stage = $10 WHERE contract_id = $11 RETURNING *',
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
        updateValues.current_approval_stage,
        id
      ]
    );
    
    // Log contract update activity
    const updatedContract = result.rows[0];
    const changedFields = Object.keys(req.body).join(', ');
    await quickLog.contractUpdate(req, updatedContract.contract_id, updatedContract.contract_number, changedFields);

    res.json(updatedContract);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete contract by ID (protected)
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // First check if contract exists
    const contractCheck = await client.query('SELECT * FROM contracts WHERE contract_id = $1', [id]);
    if (contractCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    const contract = contractCheck.rows[0];
    
    // Safety check: Only allow deletion of draft contracts or contracts in early stages
    const safeDeletionStatuses = ['draft', 'started', 'processing'];
    if (contract.status && !safeDeletionStatuses.includes(contract.status.toLowerCase())) {
      await client.query('ROLLBACK');
      return res.status(403).json({ 
        error: 'Cannot delete contract', 
        message: `Contract with status '${contract.status}' cannot be deleted. Only draft or early-stage contracts can be deleted.` 
      });
    }
    
    // Delete related activity logs first to avoid foreign key constraint
    await client.query('DELETE FROM activity_logs WHERE contract_id = $1', [id]);
    
    // Delete related documents if any
    await client.query('UPDATE documents SET contract_id = NULL WHERE contract_id = $1', [id]);
    
    // Now delete the contract
    const result = await client.query('DELETE FROM contracts WHERE contract_id = $1 RETURNING *', [id]);
    
    await client.query('COMMIT');
    
    console.log(`✅ Contract ${id} deleted successfully with all related records`);
    
    // Log the deletion activity (if we have user context)
    if (req.user) {
      try {
        const { createActivityLog } = require('../db');
        await createActivityLog({
          user_id: req.user.user_id,
          contract_id: null, // Contract no longer exists
          action: 'CONTRACT_DELETED',
          action_detail: `Deleted contract ${contractCheck.rows[0].contract_number || id} and all related records`
        });
      } catch (logError) {
        console.warn('Failed to log contract deletion:', logError);
      }
    }
    
    res.json({ 
      message: 'Contract and related records deleted successfully', 
      contract: result.rows[0] 
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error deleting contract:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Contract Generation Endpoints

// Get contract generation preview - shows mapped fields and readiness
router.get('/:id/generation-preview', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const contractGenerator = require('../services/contract-generator');
  
  try {
    console.log(`📋 Getting generation preview for contract ${id}`);
    
    const preview = await contractGenerator.getGenerationPreview(parseInt(id), pool);
    
    if (!preview.success) {
      return res.status(400).json({ 
        error: preview.error,
        contractId: id 
      });
    }
    
    res.json({
      success: true,
      contractId: id,
      preview: {
        mappedFields: preview.mappedFields,
        templateData: preview.templateData,
        validation: preview.validation,
        stats: preview.stats
      }
    });
    
  } catch (error) {
    console.error(`❌ Error getting generation preview for contract ${id}:`, error);
    res.status(500).json({ 
      error: 'Failed to get contract generation preview',
      details: error.message 
    });
  }
});

// Generate contract document from extracted fields
router.post('/:id/generate', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { userInputFields = {} } = req.body;
  const contractGenerator = require('../services/contract-generator');
  
  try {
    console.log(`📄 Generating contract document for contract ${id}`);
    
    const result = await contractGenerator.generateContract(parseInt(id), pool, userInputFields);
    
    if (!result.success) {
      return res.status(400).json({ 
        error: result.error,
        contractId: id 
      });
    }
    
    // Log contract generation activity
    await quickLog.contractGenerate(req, result.contractId, result.contractNumber || `Contract-${id}`);
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.buffer.length);
    
    // Send the generated document
    res.send(result.buffer);
    
  } catch (error) {
    console.error(`❌ Error generating contract for contract ${id}:`, error);
    res.status(500).json({ 
      error: 'Failed to generate contract document',
      details: error.message 
    });
  }
});

// Get field mapping for a contract - useful for manual field editing
router.get('/:id/field-mapping', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { mapContractFields } = require('../services/field-mapper');
  
  try {
    console.log(`📋 Getting field mapping for contract ${id}`);
    
    const mappingResult = await mapContractFields(parseInt(id), pool);
    
    if (!mappingResult.success) {
      return res.status(400).json({ 
        error: mappingResult.error,
        contractId: id 
      });
    }
    
    res.json({
      success: true,
      contractId: id,
      mapping: {
        fields: mappingResult.mappedFields,
        stats: {
          totalFields: mappingResult.totalFields,
          filledFields: mappingResult.filledFields,
          completionPercentage: mappingResult.completionPercentage,
          documentsProcessed: mappingResult.documentsProcessed
        }
      }
    });
    
  } catch (error) {
    console.error(`❌ Error getting field mapping for contract ${id}:`, error);
    res.status(500).json({ 
      error: 'Failed to get contract field mapping',
      details: error.message 
    });
  }
});

// Contract Document Access Endpoints

/**
 * Stream contract document directly from S3
 * GET /contracts/:contractId/document/:type
 * type: 'pdf' or 'docx'
 */
router.get('/:contractId/document/:type', authenticateToken, async (req, res) => {
  const { contractId, type } = req.params;
  const AWS = require('aws-sdk');
  
  try {
    // Validate type
    if (!['pdf', 'docx'].includes(type)) {
      return res.status(400).json({ error: 'Invalid document type. Must be pdf or docx' });
    }
    
    // Get contract from database
    const contractResult = await pool.query(`
      SELECT 
        contract_id,
        contract_number,
        generated_pot_uri as pdf_url,
        generated_docx_uri as docx_url,
        status
      FROM contracts 
      WHERE contract_id = $1
    `, [contractId]);
    
    if (contractResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    const contract = contractResult.rows[0];
    
    // Check if contract has been generated
    if (contract.status !== 'generated' && contract.status !== 'approved') {
      return res.status(400).json({ error: 'Contract has not been generated yet' });
    }
    
    // Get the appropriate URL
    const documentUrl = type === 'pdf' ? contract.pdf_url : contract.docx_url;
    
    if (!documentUrl) {
      return res.status(404).json({ error: `${type.toUpperCase()} document not found for this contract` });
    }
    
    // Extract S3 key from URL
    let s3Key;
    try {
      const url = new URL(documentUrl);
      if (url.hostname.includes('.s3.')) {
        // Format: https://bucket-name.s3.region.amazonaws.com/key
        s3Key = url.pathname.substring(1); // Remove leading slash
      } else if (url.hostname.startsWith('s3.')) {
        // Format: https://s3.region.amazonaws.com/bucket-name/key
        const pathParts = url.pathname.substring(1).split('/');
        s3Key = pathParts.slice(1).join('/'); // Remove bucket name, keep the rest
      } else {
        throw new Error('Unknown S3 URL format');
      }
    } catch (error) {
      console.error('Failed to parse S3 URL:', documentUrl, error);
      return res.status(500).json({ error: 'Invalid document URL format' });
    }
    
    // Stream file directly from S3
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION
    });
    
    const s3Params = {
      Bucket: 'document-upload-vp',
      Key: s3Key
    };
    
    // Get object metadata first to set proper headers
    const headResult = await s3.headObject(s3Params).promise();
    
    // Set appropriate headers
    res.setHeader('Content-Type', headResult.ContentType || (type === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'));
    res.setHeader('Content-Length', headResult.ContentLength);
    res.setHeader('Content-Disposition', `inline; filename="${contract.contract_number}_${type}.${type}"`);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Expires', '-1');
    res.setHeader('Pragma', 'no-cache');
    
    // Stream the file
    const s3Stream = s3.getObject(s3Params).createReadStream();
    
    s3Stream.on('error', (error) => {
      console.error('S3 stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream document' });
      }
    });
    
    s3Stream.pipe(res);
    
    console.log(`✅ Streaming document for contract ${contractId} ${type}: ${s3Key}`);
    
  } catch (error) {
    console.error('Error streaming document:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

/**
 * Get contract document URLs (direct streaming endpoints)
 * GET /contracts/:contractId/documents
 */
router.get('/:contractId/documents', authenticateToken, async (req, res) => {
  const { contractId } = req.params;
  
  try {
    // Get contract from database
    const contractResult = await pool.query(`
      SELECT 
        contract_id,
        contract_number,
        generated_pot_uri as pdf_url,
        generated_docx_uri as docx_url,
        status
      FROM contracts 
      WHERE contract_id = $1
    `, [contractId]);
    
    if (contractResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    const contract = contractResult.rows[0];
    
    // Check if contract has been generated
    if (!contract.pdf_url && !contract.docx_url) {
      return res.status(400).json({ error: 'Contract has not been generated yet' });
    }
    
    const result = {
      success: true,
      contractId,
      contractNumber: contract.contract_number,
      documents: {}
    };
    
    // Generate direct streaming URLs for available documents
    const baseUrl = `${req.protocol}://${req.get('host')}/contracts/${contractId}/document`;
    
    if (contract.pdf_url) {
      result.documents.pdf_url = `${baseUrl}/pdf`;
    }
    
    if (contract.docx_url) {
      result.documents.docx_url = `${baseUrl}/docx`;
    }
    
    console.log(`✅ Generated streaming URLs for contract ${contractId}`);
    res.json(result);
    
  } catch (error) {
    console.error('Error generating streaming URLs:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
