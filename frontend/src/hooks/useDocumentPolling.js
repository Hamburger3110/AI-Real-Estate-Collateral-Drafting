import { useEffect, useRef, useCallback } from 'react';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';

/**
 * Custom hook for polling document extraction status
 * @param {Array} documents - Array of documents to check
 * @param {Function} onStatusChange - Callback when status changes
 * @param {Number} interval - Polling interval in milliseconds (default: 5000)
 */
const useDocumentPolling = (documents, onStatusChange, interval = 5000) => {
  const intervalRef = useRef(null);
  const previousStatusRef = useRef({});

  // Check status for all processing documents
  const checkDocumentStatus = useCallback(async (token) => {
    // Find documents with "Processing" status
    const processingDocs = documents.filter(doc => 
      doc.status === 'Processing' || doc.rawStatus === 'Processing'
    );

    if (processingDocs.length === 0) {
      return; // Nothing to poll
    }

    console.log(`📊 Polling status for ${processingDocs.length} document(s)...`);

    for (const doc of processingDocs) {
      try {
        const response = await fetch(buildApiUrl(API_ENDPOINTS.FPTAI, `/extraction-status/${doc.documentId || doc.id}`), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          
          // Check if status changed
          const previousStatus = previousStatusRef.current[doc.id];
          const currentStatus = data.status;

          if (previousStatus !== currentStatus && currentStatus === 'Extracted') {
            console.log(`✅ Document ${doc.id} extraction complete!`);
            
            // Trigger callback with updated document info
            if (onStatusChange) {
              onStatusChange({
                documentId: doc.id,
                status: data.status,
                confidenceScore: data.confidence_score,
                needsManualReview: data.needs_manual_review,
                extractedData: data.extracted_data,
                fileName: data.file_name
              });
            }

            // Helper function to safely format confidence scores
            const formatConfidenceScore = (score) => {
              if (score === null || score === undefined) return 'N/A';
              const numScore = typeof score === 'number' ? score : parseFloat(score);
              return isNaN(numScore) ? 'N/A' : numScore.toFixed(1);
            };

            // Show browser notification
            if (Notification.permission === 'granted') {
              new Notification('Document Extraction Complete', {
                body: `${data.file_name} has been processed. Confidence: ${formatConfidenceScore(data.confidence_score)}%`,
                icon: '/logo192.png',
                tag: `doc-${doc.id}` // Prevent duplicate notifications
              });
            }
          }

          // Update previous status
          previousStatusRef.current[doc.id] = currentStatus;
        }
      } catch (error) {
        console.error(`Error checking status for document ${doc.id}:`, error);
      }
    }
  }, [documents, onStatusChange]);

  useEffect(() => {
    // Request notification permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission);
      });
    }
  }, []);

  useEffect(() => {
    const processingDocs = documents.filter(doc => 
      doc.status === 'Processing' || doc.rawStatus === 'Processing'
    );

    if (processingDocs.length > 0) {
      console.log(`🔄 Starting polling for ${processingDocs.length} processing document(s)`);
      
      // Get token from localStorage (assuming it's stored there)
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        console.warn('⚠️ No auth token found, polling disabled');
        return;
      }

      // Initial check
      checkDocumentStatus(token);

      // Set up interval
      intervalRef.current = setInterval(() => {
        checkDocumentStatus(token);
      }, interval);

      // Cleanup on unmount or when dependencies change
      return () => {
        if (intervalRef.current) {
          console.log('🛑 Stopping document polling');
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    } else {
      // Clear interval if no processing documents
      if (intervalRef.current) {
        console.log('✅ No processing documents, stopping polling');
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [documents, interval, checkDocumentStatus]);

  return null;
};

export default useDocumentPolling;

