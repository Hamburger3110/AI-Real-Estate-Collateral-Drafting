// Utility functions for calculating contract progress consistently across components

/**
 * Calculate progress percentage based on workflow stages
 * @param {Array} workflow - Array of workflow stages
 * @returns {number} Progress percentage (0-100)
 */
export const calculateWorkflowProgress = (workflow) => {
  if (!workflow || workflow.length === 0) return 0;
  
  // Count stages that are completed (approved in any format)
  const completedStages = workflow.filter((stage) => {
    const status = stage.status?.toLowerCase() || '';
    return status === 'approved' || 
           status === 'completed' || 
           status === 'finish' ||
           stage.approvedAt || // If there's an approval timestamp, consider it approved
           stage.approved_at; // Handle both camelCase and snake_case
  }).length;
  
  return Math.round((completedStages / workflow.length) * 100);
};

/**
 * Fallback progress calculation based on contract status
 * Used when workflow data is not available
 * @param {string} status - Contract status
 * @param {string} approvedAt - Approval timestamp
 * @returns {number} Progress percentage (0-100)
 */
export const calculateStatusProgress = (status, approvedAt) => {
  const progressMap = {
    draft: 10,
    started: 25,
    processing: 50,
    'under_review': 50,
    'under review': 50,
    approved: 100,
    rejected: 0,
    pending_documents: 15,
    completed: 100,
  };
  
  const normalizedStatus = status?.toLowerCase() || '';
  return progressMap[normalizedStatus] || 0;
};

/**
 * Get progress with workflow data prioritized over status
 * @param {Array} workflow - Workflow stages array
 * @param {string} status - Contract status (fallback)
 * @param {string} approvedAt - Approval timestamp (fallback)
 * @returns {number} Progress percentage (0-100)
 */
export const getContractProgress = (workflow, status, approvedAt) => {
  // If we have workflow data, use it for more accurate calculation
  if (workflow && workflow.length > 0) {
    return calculateWorkflowProgress(workflow);
  }
  
  // Otherwise fall back to status-based calculation
  return calculateStatusProgress(status, approvedAt);
};