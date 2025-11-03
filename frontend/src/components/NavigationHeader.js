import React from 'react';
import { Layout, Menu, Dropdown, Avatar, Typography, Space, Button } from 'antd';
import {
  UserOutlined,
  LogoutOutlined,
  FileTextOutlined,
  CloudUploadOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  DownOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const { Header } = Layout;
const { Text } = Typography;

function NavigationHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, hasPermission } = useAuth();

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Create menu items based on user permissions
  const menuItems = [];
  
  if (hasPermission('VIEW_CONTRACTS')) {
    menuItems.push({
      key: '/contracts',
      icon: <FileTextOutlined />,
      label: 'Contract Management'
    });
  }
  
  if (hasPermission('UPLOAD_DOCUMENTS')) {
    menuItems.push({
      key: '/upload',
      icon: <CloudUploadOutlined />,
      label: 'Document Upload'
    });
  }
  
  if (hasPermission('CREDIT_REVIEW') || hasPermission('LEGAL_REVIEW') || hasPermission('FINAL_APPROVAL')) {
    menuItems.push({
      key: '/approvals',
      icon: <CheckCircleOutlined />,
      label: 'Approval Dashboard'
    });
  }
  
  if (hasPermission('VIEW_CONTRACTS')) {
    menuItems.push({
      key: '/review',
      icon: <EyeOutlined />,
      label: 'Contract Review'
    });
  }

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile',
      disabled: true
    },
    {
      type: 'divider'
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: handleLogout
    }
  ];

  const getRoleBadgeColor = (role) => {
    const colors = {
      'ADMIN': '#f50',
      'CREDIT_OFFICER': '#2db7f5',
      'LEGAL_OFFICER': '#87d068',
      'MANAGER': '#108ee9',
      'VIEWER': '#999'
    };
    return colors[role] || '#999';
  };

  return (
    <Header style={{ 
      background: '#fff', 
      padding: '0 24px', 
      boxShadow: '0 2px 8px #f0f1f2',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ 
          fontWeight: 'bold', 
          fontSize: '18px', 
          color: '#1890ff',
          marginRight: '32px'
        }}>
          VPBank Real Estate System
        </div>
        
        <Menu
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ 
            border: 'none',
            backgroundColor: 'transparent',
            minWidth: '400px'
          }}
        />
      </div>

      <Space>
        <div style={{ textAlign: 'right', marginRight: '16px' }}>
          <div>
            <Text strong>{user?.name}</Text>
          </div>
          <div>
            <Text 
              style={{ 
                fontSize: '12px', 
                color: getRoleBadgeColor(user?.role),
                fontWeight: 500
              }}
            >
              {user?.role?.replace('_', ' ')}
            </Text>
          </div>
        </div>
        
        <Dropdown
          menu={{ items: userMenuItems }}
          trigger={['click']}
          placement="bottomRight"
        >
          <Button type="text" style={{ height: '40px' }}>
            <Space>
              <Avatar 
                icon={<UserOutlined />} 
                style={{ backgroundColor: getRoleBadgeColor(user?.role) }}
              />
              <DownOutlined style={{ fontSize: '12px' }} />
            </Space>
          </Button>
        </Dropdown>
      </Space>
    </Header>
  );
}

export default NavigationHeader;