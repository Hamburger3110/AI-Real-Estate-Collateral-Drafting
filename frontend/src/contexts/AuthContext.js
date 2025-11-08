import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { message } from 'antd';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Role definitions
const ROLES = {
  ADMIN: 'ADMIN',
  CREDIT_OFFICER: 'CREDIT_OFFICER',
  LEGAL_OFFICER: 'LEGAL_OFFICER',
  MANAGER: 'MANAGER',
  VIEWER: 'VIEWER'
};

// Permission definitions
const PERMISSIONS = {
  // Document permissions
  UPLOAD_DOCUMENTS: 'UPLOAD_DOCUMENTS',
  VIEW_DOCUMENTS: 'VIEW_DOCUMENTS',
  DELETE_DOCUMENTS: 'DELETE_DOCUMENTS',
  
  // Contract permissions
  CREATE_CONTRACTS: 'CREATE_CONTRACTS',
  VIEW_CONTRACTS: 'VIEW_CONTRACTS',
  EDIT_CONTRACTS: 'EDIT_CONTRACTS',
  APPROVE_CONTRACTS: 'APPROVE_CONTRACTS',
  DELETE_CONTRACTS: 'DELETE_CONTRACTS',
  
  // Review permissions
  CREDIT_REVIEW: 'CREDIT_REVIEW',
  LEGAL_REVIEW: 'LEGAL_REVIEW',
  
  // System permissions
  MANAGE_USERS: 'MANAGE_USERS',
  VIEW_ACTIVITY_LOGS: 'VIEW_ACTIVITY_LOGS',
  SYSTEM_CONFIG: 'SYSTEM_CONFIG',
  
  // Notification permissions
  RECEIVE_NOTIFICATIONS: 'RECEIVE_NOTIFICATIONS',
  SEND_NOTIFICATIONS: 'SEND_NOTIFICATIONS'
};

// Role-based permissions mapping
const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: [
    PERMISSIONS.UPLOAD_DOCUMENTS,
    PERMISSIONS.VIEW_DOCUMENTS,
    PERMISSIONS.DELETE_DOCUMENTS,
    PERMISSIONS.CREATE_CONTRACTS,
    PERMISSIONS.VIEW_CONTRACTS,
    PERMISSIONS.EDIT_CONTRACTS,
    PERMISSIONS.APPROVE_CONTRACTS,
    PERMISSIONS.DELETE_CONTRACTS,
    PERMISSIONS.CREDIT_REVIEW,
    PERMISSIONS.LEGAL_REVIEW,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.VIEW_ACTIVITY_LOGS,
    PERMISSIONS.SYSTEM_CONFIG,
    PERMISSIONS.RECEIVE_NOTIFICATIONS,
    PERMISSIONS.SEND_NOTIFICATIONS
  ],
  [ROLES.CREDIT_OFFICER]: [
    PERMISSIONS.UPLOAD_DOCUMENTS,
    PERMISSIONS.VIEW_DOCUMENTS,
    PERMISSIONS.CREATE_CONTRACTS,
    PERMISSIONS.VIEW_CONTRACTS,
    PERMISSIONS.EDIT_CONTRACTS,
    PERMISSIONS.CREDIT_REVIEW,
    PERMISSIONS.RECEIVE_NOTIFICATIONS
  ],
  [ROLES.LEGAL_OFFICER]: [
    PERMISSIONS.VIEW_DOCUMENTS,
    PERMISSIONS.VIEW_CONTRACTS,
    PERMISSIONS.EDIT_CONTRACTS,
    PERMISSIONS.LEGAL_REVIEW,
    PERMISSIONS.RECEIVE_NOTIFICATIONS
  ],
  [ROLES.MANAGER]: [
    PERMISSIONS.VIEW_DOCUMENTS,
    PERMISSIONS.VIEW_CONTRACTS,
    PERMISSIONS.EDIT_CONTRACTS,
    PERMISSIONS.APPROVE_CONTRACTS,
    PERMISSIONS.VIEW_ACTIVITY_LOGS,
    PERMISSIONS.RECEIVE_NOTIFICATIONS,
    PERMISSIONS.SEND_NOTIFICATIONS
  ],
  [ROLES.VIEWER]: [
    PERMISSIONS.VIEW_DOCUMENTS,
    PERMISSIONS.VIEW_CONTRACTS,
    PERMISSIONS.RECEIVE_NOTIFICATIONS
  ]
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is authenticated
  const isAuthenticated = !!user && !!token;

  // API login function
  const login = async (email, password) => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔐 Attempting login for:', email);

      // Make API call to backend for authentication
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001'}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Login failed');
      }

      const { token } = await response.json();
      
      // Decode the token to get user info (simple JWT decode for display)
      const tokenPayload = JSON.parse(atob(token.split('.')[1]));
      
      const userData = {
        user_id: tokenPayload.user_id,
        email: tokenPayload.email,
        role: tokenPayload.role,
        full_name: tokenPayload.full_name || email.split('@')[0],
      };

      // Store token and user data
      localStorage.setItem('authToken', token);
      localStorage.setItem('userData', JSON.stringify(userData));

      setUser(userData);
      setToken(token);
      console.log('✅ User logged in successfully:', userData);
      message.success(`Welcome back, ${userData.full_name || userData.email}!`);
      
      return { success: true, user: userData, token };
    } catch (err) {
      console.error('❌ Login error:', err);
      const errorMessage = err.message || 'Login failed';
      setError(errorMessage);
      message.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    setUser(null);
    setToken(null);
    setError(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    message.success('Logged out successfully');
  };

  // Check if user has specific permission
  const hasPermission = (permission) => {
    if (!user || !user.role) return false;
    const userPermissions = ROLE_PERMISSIONS[user.role] || [];
    return userPermissions.includes(permission);
  };

  // Check if user has any of the specified permissions
  const hasAnyPermission = (permissions) => {
    if (!permissions || permissions.length === 0) return true;
    return permissions.some(permission => hasPermission(permission));
  };

  // Get user permissions
  const getUserPermissions = () => {
    if (!user || !user.role) return [];
    return ROLE_PERMISSIONS[user.role] || [];
  };

  // Fetch user profile from token (on app initialization)
  const fetchUserProfile = useCallback(async () => {
    try {
      const storedToken = localStorage.getItem('authToken');
      const userData = localStorage.getItem('userData');
      
      if (storedToken && userData) {
        const parsedUserData = JSON.parse(userData);
        setUser(parsedUserData);
        setToken(storedToken);
        console.log('🔄 Restored user session:', parsedUserData);
      }
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
      // Clear invalid data
      localStorage.removeItem('authToken');
      localStorage.removeItem('userData');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize auth state on app load
  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  const value = {
    user,
    token,
    isAuthenticated,
    loading,
    login,
    logout,
    hasPermission,
    hasAnyPermission,
    getUserPermissions,
    // Export constants for use in components
    ROLES,
    PERMISSIONS
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};