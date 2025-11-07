// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

// API endpoints with /api prefix
export const API_ENDPOINTS = {
  AUTH: '/api/auth',
  CONTRACTS: '/api/contracts',
  DOCUMENTS: '/api/documents',
  APPROVALS: '/api/approvals',
  ACTIVITY_LOGS: '/api/activity_logs',
  UPLOAD: '/api/upload',
  NOTIFICATIONS: '/api/notifications',
  EXTRACTED_FIELDS: '/api/extracted_fields',
  FPTAI: '/api/fptai',
  WEBHOOK: '/api/webhook',
  EVENTS: '/api/events',
  MIGRATIONS: '/api/migrations'
};

// Helper function to build full API URL
export const buildApiUrl = (endpoint, path = '') => {
  return `${API_BASE_URL}${endpoint}${path}`;
};

export default API_BASE_URL;