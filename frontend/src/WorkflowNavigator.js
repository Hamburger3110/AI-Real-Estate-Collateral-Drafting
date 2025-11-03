import React, { useState } from 'react';
import { Layout, Menu, Avatar, Badge, Dropdown, Space } from 'antd';
import {
  DashboardOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  EditOutlined,
  UploadOutlined,
  TeamOutlined,
  UserOutlined,
  BellOutlined,
  SettingOutlined,
  LogoutOutlined
} from '@ant-design/icons';

import DocumentUploadScreen from './DocumentUploadScreen';
import ContractListScreen from './ContractListScreen';
import MultiStepApprovalScreen from './MultiStepApprovalScreen';
import ContractReviewScreen from './ContractReviewScreen';

const { Header, Sider, Content } = Layout;

function WorkflowNavigator() {
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);

  const userMenu = (
    <Menu>
      <Menu.Item key="profile" icon={<UserOutlined />}>
        Profile Settings
      </Menu.Item>
      <Menu.Item key="settings" icon={<SettingOutlined />}>
        System Settings
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="logout" icon={<LogoutOutlined />}>
        Logout
      </Menu.Item>
    </Menu>
  );

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: 'upload',
      icon: <UploadOutlined />,
      label: 'Document Upload'
    },
    {
      key: 'contracts',
      icon: <FileTextOutlined />,
      label: 'Contract List'
    },
    {
      key: 'approval',
      icon: <CheckCircleOutlined />,
      label: 'Multi-Step Approval'
    },
    {
      key: 'review',
      icon: <EditOutlined />,
      label: 'Contract Review'
    },
    {
      key: 'users',
      icon: <TeamOutlined />,
      label: 'Role Management'
    }
  ];

  const renderContent = () => {
    switch (currentScreen) {
      case 'upload':
        return <DocumentUploadScreen />;
      case 'contracts':
        return <ContractListScreen />;
      case 'approval':
        return <MultiStepApprovalScreen />;
      case 'review':
        return <ContractReviewScreen />;
      case 'dashboard':
      default:
        return <ContractListScreen />; // Default to contract list as main dashboard
    }
  };

  // If current screen has its own layout, render it directly
  if (['upload', 'contracts', 'approval', 'review'].includes(currentScreen)) {
    return renderContent();
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ 
        background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)', 
        padding: '0 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ color: 'white', fontSize: '18px', fontWeight: 'bold' }}>
          AI Real Estate Collateral Drafting System
        </div>
        <Space>
          <Badge count={5}>
            <BellOutlined style={{ color: 'white', fontSize: '18px' }} />
          </Badge>
          <Dropdown overlay={userMenu} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} />
              <span style={{ color: 'white' }}>Credit Officer</span>
            </Space>
          </Dropdown>
        </Space>
      </Header>
      
      <Layout>
        <Sider 
          collapsible 
          collapsed={collapsed} 
          onCollapse={setCollapsed}
          style={{ background: '#fff' }}
          width={250}
        >
          <Menu
            mode="inline"
            selectedKeys={[currentScreen]}
            onClick={({ key }) => setCurrentScreen(key)}
            style={{ height: '100%', borderRight: 0 }}
            items={menuItems}
          />
        </Sider>
        
        <Layout style={{ padding: '24px' }}>
          <Content>
            {renderContent()}
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}

export default WorkflowNavigator;