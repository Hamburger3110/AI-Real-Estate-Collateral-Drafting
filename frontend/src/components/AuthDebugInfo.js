import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, Descriptions, Button, Space } from 'antd';

function AuthDebugInfo() {
  const { user, isAuthenticated, loading, hasPermission, getUserPermissions } = useAuth();

  if (loading) {
    return <div>Loading auth state...</div>;
  }

  return (
    <Card title="Authentication Debug Info" style={{ margin: '20px', maxWidth: '600px' }}>
      <Descriptions bordered>
        <Descriptions.Item label="Is Authenticated" span={3}>
          {isAuthenticated ? '✅ Yes' : '❌ No'}
        </Descriptions.Item>
        <Descriptions.Item label="Loading" span={3}>
          {loading ? 'Yes' : 'No'}
        </Descriptions.Item>
        <Descriptions.Item label="User ID" span={3}>
          {user?.id || 'N/A'}
        </Descriptions.Item>
        <Descriptions.Item label="Name" span={3}>
          {user?.name || 'N/A'}
        </Descriptions.Item>
        <Descriptions.Item label="Email" span={3}>
          {user?.email || 'N/A'}
        </Descriptions.Item>
        <Descriptions.Item label="Role" span={3}>
          {user?.role || 'N/A'}
        </Descriptions.Item>
        <Descriptions.Item label="Permissions" span={3}>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {getUserPermissions().map(permission => (
              <li key={permission}>{permission}</li>
            ))}
          </ul>
        </Descriptions.Item>
      </Descriptions>
      
      <div style={{ marginTop: '16px' }}>
        <h4>Permission Checks:</h4>
        <Space direction="vertical">
          <div>VIEW_CONTRACTS: {hasPermission('VIEW_CONTRACTS') ? '✅' : '❌'}</div>
          <div>UPLOAD_DOCUMENTS: {hasPermission('UPLOAD_DOCUMENTS') ? '✅' : '❌'}</div>
          <div>CREDIT_REVIEW: {hasPermission('CREDIT_REVIEW') ? '✅' : '❌'}</div>
        </Space>
      </div>
      
      <div style={{ marginTop: '16px' }}>
        <Button onClick={() => window.location.reload()}>Refresh Page</Button>
      </div>
    </Card>
  );
}

export default AuthDebugInfo;