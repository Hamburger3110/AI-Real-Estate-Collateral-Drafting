import React from 'react';
import { Layout } from 'antd';
import NavigationHeader from './NavigationHeader';

const { Content } = Layout;

function AppLayout({ children }) {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <NavigationHeader />
      <Content style={{ 
        padding: '24px',
        background: '#f0f2f5',
        minHeight: 'calc(100vh - 64px)'
      }}>
        {children}
      </Content>
    </Layout>
  );
}

export default AppLayout;