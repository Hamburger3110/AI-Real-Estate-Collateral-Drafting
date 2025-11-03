import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  Space,
  Alert,
  Row,
  Col,
  Divider
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  LoginOutlined,
  SafetyOutlined
} from '@ant-design/icons';
import { useAuth } from './contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

function LoginScreen() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/contracts');
    }
  }, [isAuthenticated, navigate]);

  // Demo users for testing
  const demoUsers = [
    {
      email: 'admin@vpbank.com',
      password: 'password123',
      role: 'Admin',
      name: 'System Administrator'
    },
    {
      email: 'credit.officer@vpbank.com',
      password: 'password123',
      role: 'Credit Officer',
      name: 'Sarah Johnson'
    },
    {
      email: 'legal.officer@vpbank.com',
      password: 'password123',
      role: 'Legal Officer',
      name: 'Lisa Chen'
    },
    {
      email: 'manager@vpbank.com',
      password: 'password123',
      role: 'Manager',
      name: 'Mike Wilson'
    }
  ];

  const handleLogin = async (values) => {
    setLoading(true);
    const result = await login(values.email, values.password);
    setLoading(false);
    
    if (result.success) {
      // Navigate to main application after successful login
      console.log('Login successful, navigating to /contracts');
      navigate('/contracts');
    }
    // Error is already handled in the context if login fails
  };

  const handleDemoLogin = (user) => {
    form.setFieldsValue({
      email: user.email,
      password: user.password
    });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px'
    }}>
      <Row gutter={32} style={{ width: '100%', maxWidth: '1200px' }}>
        <Col xs={24} lg={12}>
          <Card style={{ height: '100%' }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <SafetyOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
              <Title level={2}>VPBank Real Estate System</Title>
              <Text type="secondary">
                AI-Powered Collateral Drafting & Document Management
              </Text>
            </div>

            <Form
              form={form}
              name="login"
              onFinish={handleLogin}
              layout="vertical"
              size="large"
            >
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Please enter your email!' },
                  { type: 'email', message: 'Please enter a valid email!' }
                ]}
              >
                <Input 
                  prefix={<UserOutlined />} 
                  placeholder="Enter your email"
                />
              </Form.Item>

              <Form.Item
                name="password"
                label="Password"
                rules={[
                  { required: true, message: 'Please enter your password!' }
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="Enter your password"
                />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  icon={<LoginOutlined />}
                  style={{ height: '45px' }}
                >
                  Sign In
                </Button>
              </Form.Item>
            </Form>

            <Alert
              message="Demo Environment"
              description="This is a demonstration system. Use the demo accounts provided on the right."
              type="info"
              showIcon
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Demo Accounts" style={{ height: '100%' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              Click on any demo account to auto-fill the login form:
            </Text>
            
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {demoUsers.map((user, index) => (
                <Card
                  key={index}
                  size="small"
                  hoverable
                  onClick={() => handleDemoLogin(user)}
                  style={{ cursor: 'pointer', border: '1px solid #d9d9d9' }}
                >
                  <Row align="middle">
                    <Col flex="auto">
                      <div>
                        <Text strong>{user.name}</Text>
                        <br />
                        <Text type="secondary">{user.role}</Text>
                      </div>
                    </Col>
                    <Col>
                      <Text code>{user.email}</Text>
                    </Col>
                  </Row>
                </Card>
              ))}
            </Space>

            <Divider />

            <div>
              <Title level={4}>Role Permissions:</Title>
              <ul style={{ fontSize: '12px', color: '#666' }}>
                <li><strong>Admin:</strong> Full system access</li>
                <li><strong>Credit Officer:</strong> Upload documents, review contracts</li>
                <li><strong>Legal Officer:</strong> Legal review and approval</li>
                <li><strong>Manager:</strong> Final approval authority</li>
              </ul>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default LoginScreen;