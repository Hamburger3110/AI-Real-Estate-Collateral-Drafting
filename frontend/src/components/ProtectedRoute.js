import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Spin, Result } from 'antd';
import AppLayout from './AppLayout';

function ProtectedRoute({ children, requiredPermissions = [] }) {
  const { isAuthenticated, loading, hasAnyPermission } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check if user has any of the required permissions
  if (requiredPermissions.length > 0 && !hasAnyPermission(requiredPermissions)) {
    return (
      <AppLayout>
        <Result
          status="403"
          title="403"
          subTitle="Sorry, you are not authorized to access this page."
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {children}
    </AppLayout>
  );
}

export default ProtectedRoute;