const { createActivityLog } = require('../db');

/**
 * Activity logging middleware and helper functions
 */

// Extract client information from request
function getClientInfo(req) {
  return {
    ip_address: req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 
                (req.connection.socket ? req.connection.socket.remoteAddress : null),
    user_agent: req.get('User-Agent') || null
  };
}

// Log activity with automatic client info extraction
async function logActivity(req, activityData) {
  try {
    const clientInfo = getClientInfo(req);
    
    const logData = {
      user_id: activityData.user_id || req.user?.user_id,
      document_id: activityData.document_id || null,
      contract_id: activityData.contract_id || null,
      action: activityData.action,
      action_detail: activityData.action_detail || '',
      ip_address: clientInfo.ip_address,
      user_agent: clientInfo.user_agent
    };
    
    return await createActivityLog(logData);
  } catch (error) {
    console.error('Error logging activity:', error);
    // Don't throw - logging should not break the main functionality
    return null;
  }
}

// Activity types constants
const ACTIVITY_TYPES = {
  // Authentication
  LOGIN: 'login',
  LOGOUT: 'logout',
  
  // Document operations
  DOCUMENT_UPLOAD: 'document_upload',
  DOCUMENT_DELETE: 'document_delete',
  DOCUMENT_VIEW: 'document_view',
  DOCUMENT_VALIDATE: 'document_validate',
  FIELD_REVIEW: 'field_review',
  
  // Contract operations
  CONTRACT_CREATE: 'contract_create',
  CONTRACT_UPDATE: 'contract_update',
  CONTRACT_DELETE: 'contract_delete',
  CONTRACT_VIEW: 'contract_view',
  CONTRACT_GENERATE: 'contract_generate',
  
  // Approval workflow - General
  CONTRACT_APPROVE: 'contract_approve',
  CONTRACT_REJECT: 'contract_reject',
  WORKFLOW_ADVANCE: 'workflow_advance',
  
  // Approval workflow - Specific stages
  DOCUMENT_REVIEW_APPROVE: 'document_review_approve',
  DOCUMENT_REVIEW_REJECT: 'document_review_reject',
  CREDIT_ANALYSIS_APPROVE: 'credit_analysis_approve',
  CREDIT_ANALYSIS_REJECT: 'credit_analysis_reject',
  LEGAL_REVIEW_APPROVE: 'legal_review_approve',
  LEGAL_REVIEW_REJECT: 'legal_review_reject',
  RISK_ASSESSMENT_APPROVE: 'risk_assessment_approve',
  RISK_ASSESSMENT_REJECT: 'risk_assessment_reject',
  FINAL_APPROVAL_APPROVE: 'final_approval_approve',
  FINAL_APPROVAL_REJECT: 'final_approval_reject',
  
  // Workflow stage transitions
  WORKFLOW_STAGE_START: 'workflow_stage_start',
  WORKFLOW_STAGE_COMPLETE: 'workflow_stage_complete',
  WORKFLOW_COMPLETE: 'workflow_complete',
  
  // System operations
  EXPORT_DATA: 'export_data',
  SYSTEM_CONFIG: 'system_config'
};

// Pre-defined action descriptions
const ACTION_DESCRIPTIONS = {
  [ACTIVITY_TYPES.LOGIN]: 'User logged in',
  [ACTIVITY_TYPES.LOGOUT]: 'User logged out',
  [ACTIVITY_TYPES.DOCUMENT_UPLOAD]: 'Document uploaded',
  [ACTIVITY_TYPES.DOCUMENT_DELETE]: 'Document deleted',
  [ACTIVITY_TYPES.DOCUMENT_VIEW]: 'Document viewed',
  [ACTIVITY_TYPES.DOCUMENT_VALIDATE]: 'Document validated',
  [ACTIVITY_TYPES.FIELD_REVIEW]: 'Document fields reviewed',
  [ACTIVITY_TYPES.CONTRACT_CREATE]: 'Contract created',
  [ACTIVITY_TYPES.CONTRACT_UPDATE]: 'Contract updated',
  [ACTIVITY_TYPES.CONTRACT_DELETE]: 'Contract deleted',
  [ACTIVITY_TYPES.CONTRACT_VIEW]: 'Contract viewed',
  [ACTIVITY_TYPES.CONTRACT_GENERATE]: 'Contract document generated',
  [ACTIVITY_TYPES.CONTRACT_APPROVE]: 'Contract approved',
  [ACTIVITY_TYPES.CONTRACT_REJECT]: 'Contract rejected',
  [ACTIVITY_TYPES.WORKFLOW_ADVANCE]: 'Workflow stage advanced',
  
  // Specific approval stage actions
  [ACTIVITY_TYPES.DOCUMENT_REVIEW_APPROVE]: 'Document review stage approved',
  [ACTIVITY_TYPES.DOCUMENT_REVIEW_REJECT]: 'Document review stage rejected',
  [ACTIVITY_TYPES.CREDIT_ANALYSIS_APPROVE]: 'Credit analysis stage approved',
  [ACTIVITY_TYPES.CREDIT_ANALYSIS_REJECT]: 'Credit analysis stage rejected',
  [ACTIVITY_TYPES.LEGAL_REVIEW_APPROVE]: 'Legal review stage approved',
  [ACTIVITY_TYPES.LEGAL_REVIEW_REJECT]: 'Legal review stage rejected',
  [ACTIVITY_TYPES.RISK_ASSESSMENT_APPROVE]: 'Risk assessment stage approved',
  [ACTIVITY_TYPES.RISK_ASSESSMENT_REJECT]: 'Risk assessment stage rejected',
  [ACTIVITY_TYPES.FINAL_APPROVAL_APPROVE]: 'Final approval stage approved',
  [ACTIVITY_TYPES.FINAL_APPROVAL_REJECT]: 'Final approval stage rejected',
  
  // Workflow transitions
  [ACTIVITY_TYPES.WORKFLOW_STAGE_START]: 'Workflow stage started',
  [ACTIVITY_TYPES.WORKFLOW_STAGE_COMPLETE]: 'Workflow stage completed',
  [ACTIVITY_TYPES.WORKFLOW_COMPLETE]: 'Workflow completed',
  
  [ACTIVITY_TYPES.EXPORT_DATA]: 'Data exported',
  [ACTIVITY_TYPES.SYSTEM_CONFIG]: 'System configuration changed'
};

// Quick logging functions for common activities
const quickLog = {
  contractCreate: (req, contractId, contractNumber) => 
    logActivity(req, {
      action: ACTIVITY_TYPES.CONTRACT_CREATE,
      contract_id: contractId,
      action_detail: `Created contract ${contractNumber}`
    }),
    
  contractUpdate: (req, contractId, contractNumber, changes) => 
    logActivity(req, {
      action: ACTIVITY_TYPES.CONTRACT_UPDATE,
      contract_id: contractId,
      action_detail: `Updated contract ${contractNumber}. Changes: ${changes}`
    }),
    
  contractView: (req, contractId, contractNumber) => 
    logActivity(req, {
      action: ACTIVITY_TYPES.CONTRACT_VIEW,
      contract_id: contractId,
      action_detail: `Viewed contract ${contractNumber}`
    }),
    
  documentUpload: (req, documentId, fileName, contractId) => 
    logActivity(req, {
      action: ACTIVITY_TYPES.DOCUMENT_UPLOAD,
      document_id: documentId,
      contract_id: contractId,
      action_detail: `Uploaded document: ${fileName}`
    }),
    
  documentValidate: (req, documentId, fileName, contractId, result) => 
    logActivity(req, {
      action: ACTIVITY_TYPES.DOCUMENT_VALIDATE,
      document_id: documentId,
      contract_id: contractId,
      action_detail: `Validated document: ${fileName}. Result: ${result}`
    }),
    
  approvalAction: (req, contractId, contractNumber, action, stage, comments) => {
    // Map stage to specific activity type
    const getStageSpecificAction = (stage, action) => {
      const stageMap = {
        'document_review': action === 'approve' ? ACTIVITY_TYPES.DOCUMENT_REVIEW_APPROVE : ACTIVITY_TYPES.DOCUMENT_REVIEW_REJECT,
        'credit_analysis': action === 'approve' ? ACTIVITY_TYPES.CREDIT_ANALYSIS_APPROVE : ACTIVITY_TYPES.CREDIT_ANALYSIS_REJECT,
        'legal_review': action === 'approve' ? ACTIVITY_TYPES.LEGAL_REVIEW_APPROVE : ACTIVITY_TYPES.LEGAL_REVIEW_REJECT,
        'risk_assessment': action === 'approve' ? ACTIVITY_TYPES.RISK_ASSESSMENT_APPROVE : ACTIVITY_TYPES.RISK_ASSESSMENT_REJECT,
        'final_approval': action === 'approve' ? ACTIVITY_TYPES.FINAL_APPROVAL_APPROVE : ACTIVITY_TYPES.FINAL_APPROVAL_REJECT,
      };
      return stageMap[stage] || (action === 'approve' ? ACTIVITY_TYPES.CONTRACT_APPROVE : ACTIVITY_TYPES.CONTRACT_REJECT);
    };

    const stageNames = {
      'document_review': 'Document Review',
      'credit_analysis': 'Credit Analysis',
      'legal_review': 'Legal Review',
      'risk_assessment': 'Risk Assessment',
      'final_approval': 'Final Approval'
    };

    const stageName = stageNames[stage] || stage;
    const specificAction = getStageSpecificAction(stage, action);

    return logActivity(req, {
      action: specificAction,
      contract_id: contractId,
      action_detail: `${action === 'approve' ? 'Approved' : 'Rejected'} contract ${contractNumber} at ${stageName} stage. Comments: ${comments || 'None'}`
    });
  },

  // New detailed workflow logging functions
  workflowStageStart: (req, contractId, contractNumber, stage, assignedTo) => 
    logActivity(req, {
      action: ACTIVITY_TYPES.WORKFLOW_STAGE_START,
      contract_id: contractId,
      action_detail: `Started ${stage} stage for contract ${contractNumber}. Assigned to: ${assignedTo || 'System'}`
    }),

  workflowStageComplete: (req, contractId, contractNumber, stage, completedBy, duration) => 
    logActivity(req, {
      action: ACTIVITY_TYPES.WORKFLOW_STAGE_COMPLETE,
      contract_id: contractId,
      action_detail: `Completed ${stage} stage for contract ${contractNumber}. Completed by: ${completedBy}. Duration: ${duration || 'N/A'}`
    }),

  workflowComplete: (req, contractId, contractNumber, finalStatus, totalDuration) => 
    logActivity(req, {
      action: ACTIVITY_TYPES.WORKFLOW_COMPLETE,
      contract_id: contractId,
      action_detail: `Workflow completed for contract ${contractNumber}. Final status: ${finalStatus}. Total duration: ${totalDuration || 'N/A'}`
    }),

  // Enhanced contract view with stage context
  contractViewWithStage: (req, contractId, contractNumber, currentStage) => 
    logActivity(req, {
      action: ACTIVITY_TYPES.CONTRACT_VIEW,
      contract_id: contractId,
      action_detail: `Viewed contract ${contractNumber} currently at ${currentStage} stage`
    }),

  // Contract generation logging
  contractGenerate: (req, contractId, contractNumber) => 
    logActivity(req, {
      action: ACTIVITY_TYPES.CONTRACT_GENERATE,
      contract_id: contractId,
      action_detail: `Generated contract document for ${contractNumber}`
    })
};

module.exports = {
  logActivity,
  getClientInfo,
  ACTIVITY_TYPES,
  ACTION_DESCRIPTIONS,
  quickLog
};