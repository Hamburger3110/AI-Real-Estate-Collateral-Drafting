const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../db');
const { quickLog } = require('../middleware/activityLogger');

// Approval workflow stages and their order
const APPROVAL_STAGES = {
  DOCUMENT_REVIEW: 'document_review',
  CREDIT_ANALYSIS: 'credit_analysis', 
  LEGAL_REVIEW: 'legal_review',
  RISK_ASSESSMENT: 'risk_assessment',
  FINAL_APPROVAL: 'final_approval',
  COMPLETED: 'completed'
};

const STAGE_ORDER = [
  APPROVAL_STAGES.DOCUMENT_REVIEW,
  APPROVAL_STAGES.CREDIT_ANALYSIS,
  APPROVAL_STAGES.LEGAL_REVIEW,
  APPROVAL_STAGES.RISK_ASSESSMENT,
  APPROVAL_STAGES.FINAL_APPROVAL,
  APPROVAL_STAGES.COMPLETED
];

// Role permissions for each stage
const STAGE_PERMISSIONS = {
  [APPROVAL_STAGES.DOCUMENT_REVIEW]: ['ADMIN', 'CREDIT_OFFICER'],
  [APPROVAL_STAGES.CREDIT_ANALYSIS]: ['ADMIN', 'CREDIT_OFFICER'],
  [APPROVAL_STAGES.LEGAL_REVIEW]: ['ADMIN', 'LEGAL_OFFICER'],
  [APPROVAL_STAGES.RISK_ASSESSMENT]: ['ADMIN', 'MANAGER'],
  [APPROVAL_STAGES.FINAL_APPROVAL]: ['ADMIN', 'MANAGER']
};

// Get approval workflow for a contract
router.get('/contract/:contractId', authenticateToken, async (req, res) => {
  const { contractId } = req.params;
  
  try {
    // Get contract info including contract URLs
    const contractResult = await pool.query(`
      SELECT c.*, u.full_name as generated_by_name,
             c.generated_pot_uri as pdf_url,
             COALESCE(c.generated_docx_uri, c.generated_pot_uri) as docx_url
      FROM contracts c
      LEFT JOIN users u ON c.generated_by = u.user_id
      WHERE c.contract_id = $1
    `, [contractId]);

    if (contractResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const contract = contractResult.rows[0];

    // Get all approvals for this contract
    const approvalsResult = await pool.query(`
      SELECT ca.*, u.full_name as approver_name, u.role as approver_role
      FROM contract_approvals ca
      LEFT JOIN users u ON ca.approver_id = u.user_id
      WHERE ca.contract_id = $1
      ORDER BY ca.created_at ASC
    `, [contractId]);

    // Build workflow status
    const workflow = STAGE_ORDER.map(stage => {
      const stageApproval = approvalsResult.rows.find(a => a.stage === stage);
      return {
        stage,
        stageName: formatStageName(stage),
        status: stageApproval ? stageApproval.status : 'pending',
        approver: stageApproval ? {
          name: stageApproval.approver_name,
          role: stageApproval.approver_role
        } : null,
        comments: stageApproval ? stageApproval.comments : null,
        approvedAt: stageApproval ? stageApproval.updated_at : null,
        canApprove: canUserApproveStage(req.user.role, stage),
        isActive: contract.current_approval_stage === stage
      };
    });

    res.json({
      contract,
      workflow,
      currentStage: contract.current_approval_stage,
      overallStatus: contract.status
    });
  } catch (err) {
    console.error('Error getting approval workflow:', err);
    res.status(500).json({ error: err.message });
  }
});

// Submit approval/rejection for a stage
router.post('/contract/:contractId/stage/:stage', authenticateToken, async (req, res) => {
  const { contractId, stage } = req.params;
  const { action, comments } = req.body; // action: 'approve' or 'reject'
  const userId = req.user.user_id;
  const userRole = req.user.role;

  try {
    // Validate user can approve this stage
    if (!canUserApproveStage(userRole, stage)) {
      return res.status(403).json({ error: 'Insufficient permissions for this approval stage' });
    }

    // Get current contract
    const contractResult = await pool.query('SELECT * FROM contracts WHERE contract_id = $1', [contractId]);
    if (contractResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const contract = contractResult.rows[0];

    // Validate this is the current stage
    if (contract.current_approval_stage !== stage) {
      return res.status(400).json({ error: 'This stage is not currently active' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Record the approval/rejection
      await client.query(`
        INSERT INTO contract_approvals (contract_id, stage, approver_id, status, comments)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (contract_id, stage) 
        DO UPDATE SET 
          approver_id = $3, 
          status = $4, 
          comments = $5, 
          updated_at = CURRENT_TIMESTAMP
      `, [contractId, stage, userId, action, comments || '']);

      let newStage = stage;
      let newStatus = contract.status;

      if (action === 'approve') {
        // Move to next stage
        const currentIndex = STAGE_ORDER.indexOf(stage);
        if (currentIndex < STAGE_ORDER.length - 1) {
          newStage = STAGE_ORDER[currentIndex + 1];
          // Update status to reflect current workflow stage
          newStatus = 'processing';
        } else {
          newStage = APPROVAL_STAGES.COMPLETED;
          newStatus = 'approved';
        }
      } else if (action === 'reject') {
        newStatus = 'rejected';
        newStage = 'rejected';
      }

      // Update contract
      await client.query(`
        UPDATE contracts 
        SET current_approval_stage = $1, status = $2, updated_at = CURRENT_TIMESTAMP
        WHERE contract_id = $3
      `, [newStage, newStatus, contractId]);

      await client.query('COMMIT');

      // Log the specific approval action
      await quickLog.approvalAction(req, contractId, contract.contract_number, action, stage, comments);
      
      // Log workflow stage transitions
      if (action === 'approve') {
        // Log stage completion
        await quickLog.workflowStageComplete(req, contractId, contract.contract_number, formatStageName(stage), req.user.full_name);
        
        // If moving to next stage, log stage start
        if (newStage !== APPROVAL_STAGES.COMPLETED) {
          await quickLog.workflowStageStart(req, contractId, contract.contract_number, formatStageName(newStage), 'System');
        } else {
          // Log workflow completion
          await quickLog.workflowComplete(req, contractId, contract.contract_number, 'approved');
        }
      } else if (action === 'reject') {
        // Log workflow completion with rejection
        await quickLog.workflowComplete(req, contractId, contract.contract_number, 'rejected');
      }

      res.json({
        success: true,
        message: `Contract ${action}ed successfully`,
        newStage,
        newStatus
      });

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

  } catch (err) {
    console.error('Error processing approval:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get contracts pending approval for current user
router.get('/pending', authenticateToken, async (req, res) => {
  const userRole = req.user.role;
  
  try {
    // Get stages this user can approve
    const userStages = Object.keys(STAGE_PERMISSIONS).filter(stage => 
      STAGE_PERMISSIONS[stage].includes(userRole)
    );

    if (userStages.length === 0) {
      return res.json([]);
    }

    const result = await pool.query(`
      SELECT 
        c.*,
        u_gen.full_name as generated_by_name,
        COUNT(d.document_id) as document_count,
        ARRAY_AGG(d.file_name) FILTER (WHERE d.file_name IS NOT NULL) as document_file_names
      FROM contracts c
      LEFT JOIN users u_gen ON c.generated_by = u_gen.user_id
      LEFT JOIN documents d ON d.contract_id = c.contract_id
      WHERE c.current_approval_stage = ANY($1)
        AND c.status NOT IN ('approved', 'rejected')
        AND c.contract_id NOT IN (
          SELECT contract_id FROM contract_approvals 
          WHERE stage = c.current_approval_stage AND approver_id = $2
        )
      GROUP BY c.contract_id, u_gen.full_name
      ORDER BY c.generated_at ASC
    `, [userStages, req.user.user_id]);

    const contractsWithStageInfo = result.rows.map(contract => ({
      ...contract,
      stage_name: formatStageName(contract.current_approval_stage),
      can_approve: true
    }));

    res.json(contractsWithStageInfo);
  } catch (err) {
    console.error('Error getting pending approvals:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get approval statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_contracts,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN status NOT IN ('approved', 'rejected') THEN 1 END) as pending,
        AVG(CASE WHEN status = 'approved' THEN 
          EXTRACT(DAY FROM (approved_at - generated_at)) 
        END) as avg_approval_days
      FROM contracts
    `);

    const stageStats = await pool.query(`
      SELECT 
        current_approval_stage,
        COUNT(*) as count
      FROM contracts 
      WHERE status NOT IN ('approved', 'rejected')
      GROUP BY current_approval_stage
    `);

    res.json({
      overview: stats.rows[0],
      stageBreakdown: stageStats.rows.map(row => ({
        stage: row.current_approval_stage,
        stageName: formatStageName(row.current_approval_stage),
        count: parseInt(row.count)
      }))
    });
  } catch (err) {
    console.error('Error getting approval stats:', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper functions
function canUserApproveStage(userRole, stage) {
  return STAGE_PERMISSIONS[stage]?.includes(userRole) || false;
}

function formatStageName(stage) {
  const names = {
    [APPROVAL_STAGES.DOCUMENT_REVIEW]: 'Document Review',
    [APPROVAL_STAGES.CREDIT_ANALYSIS]: 'Credit Analysis',
    [APPROVAL_STAGES.LEGAL_REVIEW]: 'Legal Review',
    [APPROVAL_STAGES.RISK_ASSESSMENT]: 'Risk Assessment',
    [APPROVAL_STAGES.FINAL_APPROVAL]: 'Final Approval',
    [APPROVAL_STAGES.COMPLETED]: 'Completed'
  };
  return names[stage] || stage;
}

module.exports = router;