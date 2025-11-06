// Utility functions for handling timezone conversion

/**
 * Convert UTC timestamp from PostgreSQL to local time
 * @param {string} timestamp - PostgreSQL timestamp string
 * @returns {Date} - Local Date object
 */
export const convertUTCToLocal = (timestamp) => {
  if (!timestamp) return new Date();
  
  // If already has timezone info, use as is
  if (timestamp.includes('Z') || timestamp.includes('+') || timestamp.includes('-')) {
    return new Date(timestamp);
  }
  
  // PostgreSQL TIMESTAMP format without timezone - treat as UTC
  // Format: "2025-11-06 02:42:26.591095" or "2025-11-06 02:42:26"
  let isoString = timestamp;
  
  // Replace space with T for ISO format
  if (timestamp.includes(' ')) {
    isoString = timestamp.replace(' ', 'T');
  }
  
  // Add Z to indicate UTC
  if (!isoString.endsWith('Z')) {
    isoString += 'Z';
  }
  
  return new Date(isoString);
};

/**
 * Format timestamp as relative time (e.g., "5m ago", "2h ago")
 * @param {string} timestamp - PostgreSQL timestamp string
 * @returns {string} - Formatted relative time
 */
export const formatTimeAgo = (timestamp) => {
  const now = new Date();
  const adjustedTime = convertUTCToLocal(timestamp);
  
  const diffInSeconds = Math.floor((now - adjustedTime) / 1000);

  if (diffInSeconds < 10) return 'Just now';
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  
  return adjustedTime.toLocaleDateString();
};

/**
 * Format timestamp as full local date and time
 * @param {string} timestamp - PostgreSQL timestamp string
 * @returns {string} - Formatted local date and time
 */
export const formatLocalDateTime = (timestamp) => {
  const localTime = convertUTCToLocal(timestamp);
  return localTime.toLocaleString();
};

/**
 * Format timestamp as local date only
 * @param {string} timestamp - PostgreSQL timestamp string
 * @returns {string} - Formatted local date
 */
export const formatLocalDate = (timestamp) => {
  const localTime = convertUTCToLocal(timestamp);
  return localTime.toLocaleDateString();
};

/**
 * Format timestamp as local time only
 * @param {string} timestamp - PostgreSQL timestamp string
 * @returns {string} - Formatted local time
 */
export const formatLocalTime = (timestamp) => {
  const localTime = convertUTCToLocal(timestamp);
  return localTime.toLocaleTimeString();
};