import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { notification, message } from 'antd';
import { useAuth } from './AuthContext';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

// Notification types
export const NOTIFICATION_TYPES = {
  CONTRACT_CREATED: 'CONTRACT_CREATED',
  CONTRACT_APPROVED: 'CONTRACT_APPROVED',
  CONTRACT_REJECTED: 'CONTRACT_REJECTED',
  DOCUMENT_REVIEW_REQUIRED: 'DOCUMENT_REVIEW_REQUIRED',
  APPROVAL_PENDING: 'APPROVAL_PENDING',
  WORKFLOW_COMPLETED: 'WORKFLOW_COMPLETED',
  SYSTEM_ALERT: 'SYSTEM_ALERT'
};

// Notification priority levels
export const NOTIFICATION_PRIORITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT'
};

export const NotificationProvider = ({ children }) => {
  const { user, token, hasPermission, PERMISSIONS } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Fetch notifications from backend
  const fetchNotifications = useCallback(async () => {
    if (!token || !hasPermission(PERMISSIONS.RECEIVE_NOTIFICATIONS)) return;

    try {
      setLoading(true);
      const response = await fetch(buildApiUrl(API_ENDPOINTS.NOTIFICATIONS), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.read).length);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [token, hasPermission, PERMISSIONS.RECEIVE_NOTIFICATIONS]);

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    if (!token) return;

    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.NOTIFICATIONS, `/${notificationId}/read`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setNotifications(prev => 
          prev.map(n => 
            n.notification_id === notificationId 
              ? { ...n, read: true, read_at: new Date().toISOString() }
              : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!token) return;

    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.NOTIFICATIONS, '/read-all'), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setNotifications(prev => 
          prev.map(n => ({ ...n, read: true, read_at: new Date().toISOString() }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  // Send notification (for admin/manager roles)
  const sendNotification = async (notificationData) => {
    if (!token || !hasPermission(PERMISSIONS.SEND_NOTIFICATIONS)) {
      message.error('You do not have permission to send notifications');
      return false;
    }

    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.NOTIFICATIONS), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(notificationData)
      });

      if (response.ok) {
        message.success('Notification sent successfully');
        return true;
      } else {
        const error = await response.json();
        message.error(`Failed to send notification: ${error.error}`);
        return false;
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      message.error('Failed to send notification');
      return false;
    }
  };

  // Show browser notification
  const showBrowserNotification = (title, options = {}) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options
      });
    }
  };

  // Show antd notification
  const showNotification = (type, title, description, duration = 4.5) => {
    const config = {
      message: title,
      description,
      duration,
      placement: 'topRight'
    };

    switch (type) {
      case 'success':
        notification.success(config);
        break;
      case 'error':
        notification.error(config);
        break;
      case 'warning':
        notification.warning(config);
        break;
      case 'info':
      default:
        notification.info(config);
        break;
    }
  };

  // Handle real-time notifications via WebSocket or polling
  const handleRealTimeNotification = useCallback((notificationData) => {
    // Add to local state
    setNotifications(prev => [notificationData, ...prev]);
    setUnreadCount(prev => prev + 1);

    // Show UI notification
    const { type, title, message: msg, priority } = notificationData;
    
    let notificationType = 'info';
    let duration = 4.5;

    // Map notification types to UI types
    switch (type) {
      case NOTIFICATION_TYPES.CONTRACT_APPROVED:
        notificationType = 'success';
        break;
      case NOTIFICATION_TYPES.CONTRACT_REJECTED:
        notificationType = 'error';
        break;
      case NOTIFICATION_TYPES.DOCUMENT_REVIEW_REQUIRED:
      case NOTIFICATION_TYPES.APPROVAL_PENDING:
        notificationType = 'warning';
        break;
      default:
        notificationType = 'info';
        break;
    }

    // Adjust duration based on priority
    switch (priority) {
      case NOTIFICATION_PRIORITY.URGENT:
        duration = 10;
        break;
      case NOTIFICATION_PRIORITY.HIGH:
        duration = 7;
        break;
      case NOTIFICATION_PRIORITY.MEDIUM:
        duration = 4.5;
        break;
      case NOTIFICATION_PRIORITY.LOW:
        duration = 3;
        break;
      default:
        duration = 4.5;
        break;
    }

    showNotification(notificationType, title, msg, duration);
    showBrowserNotification(title, { body: msg });
  }, []);

  // Request browser notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  };

  // Polling for new notifications (fallback if WebSocket is not available)
  useEffect(() => {
    if (!user || !token) return;

    fetchNotifications();

    // Set up polling every 30 seconds for new notifications
    const interval = setInterval(fetchNotifications, 30000);

    return () => clearInterval(interval);
  }, [user, token, fetchNotifications]);

  // Request notification permission on mount
  useEffect(() => {
    if (user) {
      requestNotificationPermission();
    }
  }, [user]);

  const value = {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    sendNotification,
    showNotification,
    showBrowserNotification,
    handleRealTimeNotification,
    requestNotificationPermission,
    NOTIFICATION_TYPES,
    NOTIFICATION_PRIORITY
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};