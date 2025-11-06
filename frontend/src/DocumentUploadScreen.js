import React, { useState } from 'react';
import {
  Layout,
  Menu,
  Card,
  Upload,
  Button,
  Typography,
  Space,
  List,
  Avatar,
  Badge,
  notification,
  Progress,
  Select,
  Form,
  Divider,
  Alert
} from 'antd';
import {
  DashboardOutlined,
  BellOutlined,
  FileTextOutlined,
  InboxOutlined,
  DeleteOutlined,
  UserOutlined,
  LogoutOutlined,
  CheckCircleOutlined,
  EditOutlined,
  CloudUploadOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

const { Sider, Content, Header } = Layout;
const { Title, Text } = Typography;
const { Dragger } = Upload;

function DocumentUploadScreen() {
  const [fileList, setFileList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { user } = useAuth();

  const uploadProps = {
    name: 'file',
    multiple: true,
    fileList: fileList,
    accept: '.pdf,.jpg,.jpeg,.png,.tiff,.bmp', // Supported document formats
    beforeUpload: (file) => {
      // File size validation (max 50MB)
      const isLt50M = file.size / 1024 / 1024 < 50;
      if (!isLt50M) {
        notification.error({
          message: 'File too large',
          description: 'File size must be less than 50MB'
        });
        return false;
      }

      // File type validation
      const supportedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 'image/bmp'];
      if (!supportedTypes.includes(file.type)) {
        notification.error({
          message: 'Unsupported file type',
          description: 'Please upload PDF, JPG, PNG, or TIFF files only'
        });
        return false;
      }

      setFileList(prev => [...prev, file]);
      return false; // Prevent automatic upload
    },
    onRemove: (file) => {
      setFileList(prev => prev.filter(item => item.uid !== file.uid));
      // Remove from progress tracking
      setUploadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[file.uid];
        return newProgress;
      });
    },
  };

  const handleSubmit = async () => {
    if (fileList.length === 0) {
      notification.warning({
        message: 'No Files Selected',
        description: 'Please select at least one document to upload.',
      });
      return;
    }

    setLoading(true);
    const results = [];
    
    try {
      // Upload each file with progress tracking
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        setUploadProgress(prev => ({ ...prev, [file.uid]: { percent: 0, status: 'uploading' } }));
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('document_type', form.getFieldValue('document_type') || 'ID Card');
        formData.append('user_id', user?.id || 1);
        
        console.log(`📤 Uploading file ${i + 1}/${fileList.length}: ${file.name}`);
        
        const response = await fetch('http://localhost:3001/upload', {
          method: 'POST',
          body: formData,
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.details || result.error || 'Upload failed');
        }
        
        setUploadProgress(prev => ({ 
          ...prev, 
          [file.uid]: { percent: 100, status: 'success' } 
        }));
        
        results.push(result.data);
        console.log(`✅ File uploaded successfully: ${result.data.file_name}`);
      }
      
      // Update uploaded files list
      setUploadedFiles(prev => [...prev, ...results]);
      
      notification.success({
        message: 'Upload Successful',
        description: 'Documents have been submitted for AI extraction.',
      });
      
      setFileList([]);
    } catch (error) {
      notification.error({
        message: 'Upload Failed',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const menuItems = [
    {
      key: '1',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
      onClick: () => navigate('/contracts')
    },
    {
      key: '2',
      icon: <BellOutlined />,
      label: 'System Notifications',
    },
    {
      key: '3',
      icon: <FileTextOutlined />,
      label: 'Contract List',
      onClick: () => navigate('/contracts')
    },
    {
      key: '4',
      icon: <CheckCircleOutlined />,
      label: 'Multi-Step Approval',
      onClick: () => navigate('/approval')
    },
    {
      key: '5',
      icon: <EditOutlined />,
      label: 'Contract Review',
      onClick: () => navigate('/review')
    },
  ];

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
          Document Upload
        </div>
        <Space>
          <Badge count={5}>
            <BellOutlined style={{ color: 'white', fontSize: '18px' }} />
          </Badge>
          <Avatar icon={<UserOutlined />} />
          <span style={{ color: 'white' }}>{user?.full_name || user?.email || 'User'}</span>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
            ({user?.role || 'N/A'})
          </span>
        </Space>
      </Header>
      
      <Layout>
        <Sider width={250} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            defaultSelectedKeys={['1']}
            style={{ height: '100%', borderRight: 0 }}
            items={menuItems}
            onClick={({ key }) => {
              const item = menuItems.find(item => item.key === key);
              if (item && item.onClick) {
                item.onClick();
              }
            }}
          />
          
          <div style={{ 
            position: 'absolute', 
            bottom: 24, 
            left: 24, 
            right: 24 
          }}>
            <Button 
              type="primary" 
              danger 
              icon={<LogoutOutlined />}
              block
            >
              Logout
            </Button>
            <div style={{ 
              marginTop: 16, 
              padding: '8px 0',
              borderTop: '1px solid #f0f0f0',
              fontSize: '12px',
              color: '#666'
            }}>
              Welcome, Credit Officer!
            </div>
          </div>
        </Sider>
        
        <Layout style={{ padding: '24px' }}>
          <Content>
            <Card 
              title={
                <Space direction="vertical" size={0}>
                  <Title level={3} style={{ margin: 0 }}>
                    Upload Real Estate Collateral Documents
                  </Title>
                  <Text type="secondary">
                    Securely upload documents for AI-powered data extraction and verification. 
                    This process is exclusively for Credit Officers.
                  </Text>
                </Space>
              }
              style={{ height: '100%' }}
            >
              <div style={{ marginBottom: 24 }}>
                <Title level={4}>Document Details</Title>
                <Text type="secondary">
                  Provide necessary information for AI processing and future reference.
                </Text>
              </div>

              <Form form={form} layout="vertical" style={{ marginBottom: 24 }}>
                <Form.Item
                  label="Document Type"
                  name="document_type"
                  initialValue="ID Card"
                  rules={[{ required: true, message: 'Please select document type' }]}
                >
                  <Select placeholder="Select document type">
                    <Select.Option value="ID Card">ID Card</Select.Option>
                    <Select.Option value="Passport">Passport</Select.Option>
                    <Select.Option value="Legal Registration">Legal Registration</Select.Option>
                    <Select.Option value="Business Registration">Business Registration</Select.Option>
                    <Select.Option value="Financial Statement">Financial Statement</Select.Option>
                  </Select>
                </Form.Item>
              </Form>

              <Alert
                message="Supported Formats"
                description="PDF, JPG, PNG, TIFF files up to 50MB. Documents will be automatically processed using AI for data extraction."
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
              
              <Dragger {...uploadProps} style={{ marginBottom: 24 }}>
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">Drag and drop documents here</p>
                <p className="ant-upload-hint">
                  <Button type="link">Browse Files</Button>
                </p>
              </Dragger>
              
              {fileList.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <List
                    dataSource={fileList}
                    renderItem={(file) => (
                      <List.Item
                        actions={[
                          <Button 
                            type="text" 
                            icon={<DeleteOutlined />} 
                            onClick={() => uploadProps.onRemove(file)}
                          />
                        ]}
                      >
                        <List.Item.Meta
                          avatar={<FileTextOutlined style={{ fontSize: 20 }} />}
                          title={file.name}
                          description={`${(file.size / 1024).toFixed(1)} KB`}
                        />
                      </List.Item>
                    )}
                  />
                </div>
              )}

              {/* Upload Progress */}
              {Object.keys(uploadProgress).length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <Title level={5}>Upload Progress</Title>
                  {Object.entries(uploadProgress).map(([fileId, progress]) => {
                    const file = fileList.find(f => f.uid === fileId);
                    return (
                      <div key={fileId} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text>{file?.name}</Text>
                          <Text type="secondary">
                            {progress.status === 'success' ? '✅ Complete' : '📤 Uploading...'}
                          </Text>
                        </div>
                        <Progress 
                          percent={progress.percent} 
                          status={progress.status === 'success' ? 'success' : 'active'}
                          showInfo={false}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Successfully Uploaded Files */}
              {uploadedFiles.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <Divider />
                  <Title level={5}>📋 Recently Uploaded Documents</Title>
                  <List
                    dataSource={uploadedFiles}
                    renderItem={(doc) => (
                      <List.Item
                        actions={[
                          <Button 
                            key="view" 
                            type="link" 
                            icon={<EyeOutlined />}
                            onClick={() => navigate('/contracts')}
                          >
                            View in Contracts
                          </Button>
                        ]}
                      >
                        <List.Item.Meta
                          avatar={<CheckCircleOutlined style={{ fontSize: 20, color: '#52c41a' }} />}
                          title={doc.file_name}
                          description={
                            <Space direction="vertical" size={0}>
                              <Text type="secondary">
                                📁 {doc.document_type} • 
                                📏 {(doc.file_size / 1024 / 1024).toFixed(2)} MB • 
                                🆔 ID: {doc.document_id}
                              </Text>
                              <Badge status="success" text="Uploaded to AWS S3" />
                              <Badge status="processing" text="AI Processing Started" />
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                </div>
              )}
              
              <div style={{ textAlign: 'right' }}>
                <Space>
                  <Button onClick={() => {
                    setFileList([]);
                    setUploadProgress({});
                    setUploadedFiles([]);
                    form.resetFields();
                  }}>
                    Clear All
                  </Button>
                  <Button 
                    type="primary" 
                    loading={loading}
                    onClick={handleSubmit}
                    disabled={fileList.length === 0}
                    icon={<CloudUploadOutlined />}
                    style={{
                      background: '#52c41a',
                      borderColor: '#52c41a'
                    }}
                  >
                    {loading ? 'Uploading to AWS S3...' : `Upload ${fileList.length} Document(s)`}
                  </Button>
                </Space>
              </div>
            </Card>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}

export default DocumentUploadScreen;