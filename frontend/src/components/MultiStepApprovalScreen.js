import React, { useState } from 'react';
import {
  Layout,
  Steps,
  Card,
  Button,
  Space,
  Form,
  Input,
  Select,
  Upload,
  Table,
  Tag,
  Avatar,
  Badge,
  Typography,
  Row,
  Col,
  Divider,
  Alert,
  Modal,
  message
} from 'antd';
import {
  UserOutlined,
  BellOutlined,
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  UploadOutlined,
  FileTextOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';

const { Header, Content } = Layout;
const { Step } = Steps;
const { TextArea } = Input;
const { Option } = Select;
const { Title, Text } = Typography;

function MultiStepApprovalScreen() {
  const [currentStep, setCurrentStep] = useState(1);
  const [form] = Form.useForm();
  const [approvalData, setApprovalData] = useState({
    contractId: 'CT-2024-001',
    customerName: 'John Smith',
    loanAmount: 250000,
    propertyAddress: '123 Main St, City, State'
  });

  const approvalSteps = [
    {
      title: 'Document Review',
      description: 'Review uploaded documents',
      status: 'finish'
    },
    {
      title: 'Credit Check',
      description: 'Verify credit information',
      status: 'process'
    },
    {
      title: 'Legal Review',
      description: 'Legal compliance check',
      status: 'wait'
    },
    {
      title: 'Final Approval',
      description: 'Manager approval',
      status: 'wait'
    }
  ];

  const documents = [
    {
      id: 1,
      name: 'Property Deed',
      type: 'Ownership Document',
      status: 'Verified',
      uploadDate: '2024-10-15',
      reviewer: 'Sarah Johnson'
    },
    {
      id: 2,
      name: 'Income Statement',
      type: 'Financial Document',
      status: 'Under Review',
      uploadDate: '2024-10-16',
      reviewer: 'Mike Wilson'
    },
    {
      id: 3,
      name: 'Credit Report',
      type: 'Credit Document',
      status: 'Pending',
      uploadDate: '2024-10-17',
      reviewer: '-'
    }
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'Verified': return 'green';
      case 'Under Review': return 'orange';
      case 'Pending': return 'blue';
      case 'Rejected': return 'red';
      default: return 'default';
    }
  };

  const documentColumns = [
    {
      title: 'Document',
      dataIndex: 'name',
      key: 'name',
      render: (text) => (
        <Space>
          <FileTextOutlined />
          {text}
        </Space>
      )
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type'
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <Tag color={getStatusColor(status)}>{status}</Tag>
    },
    {
      title: 'Upload Date',
      dataIndex: 'uploadDate',
      key: 'uploadDate'
    },
    {
      title: 'Reviewer',
      dataIndex: 'reviewer',
      key: 'reviewer'
    },
    {
      title: 'Actions',
      key: 'actions',
      render: () => (
        <Space>
          <Button type="link" icon={<EyeOutlined />}>View</Button>
          <Button type="link" icon={<CheckOutlined />}>Approve</Button>
          <Button type="link" icon={<CloseOutlined />}>Reject</Button>
        </Space>
      )
    }
  ];

  const handleApprove = () => {
    Modal.confirm({
      title: 'Approve Contract',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to approve this contract? This action cannot be undone.',
      onOk() {
        message.success('Contract approved successfully');
        setCurrentStep(currentStep + 1);
      }
    });
  };

  const handleReject = () => {
    Modal.confirm({
      title: 'Reject Contract',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to reject this contract? Please provide a reason.',
      onOk() {
        message.error('Contract rejected');
      }
    });
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <Card title="Document Review">
            <Table
              columns={documentColumns}
              dataSource={documents}
              rowKey="id"
              pagination={false}
            />
            <Divider />
            <Form form={form} layout="vertical">
              <Form.Item label="Review Comments" name="comments">
                <TextArea rows={4} placeholder="Enter your review comments..." />
              </Form.Item>
            </Form>
          </Card>
        );
      
      case 1:
        return (
          <Card title="Credit Check">
            <Row gutter={16}>
              <Col span={12}>
                <Card size="small" title="Credit Score">
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#52c41a' }}>750</div>
                    <Text type="secondary">Excellent</Text>
                  </div>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title="Debt-to-Income Ratio">
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#1B5E20' }}>28%</div>
                    <Text type="secondary">Good</Text>
                  </div>
                </Card>
              </Col>
            </Row>
            <Divider />
            <Alert
              message="Credit Check Passed"
              description="Customer meets all credit requirements for the loan amount."
              type="success"
              showIcon
            />
          </Card>
        );
      
      case 2:
        return (
          <Card title="Legal Review">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Alert
                message="Legal Compliance Check"
                description="All documents are being reviewed for legal compliance."
                type="info"
                showIcon
              />
              <Form form={form} layout="vertical">
                <Form.Item label="Legal Officer" name="legalOfficer">
                  <Select placeholder="Select legal officer">
                    <Option value="lisa">Lisa Chen - Senior Legal Officer</Option>
                    <Option value="david">David Park - Legal Counsel</Option>
                  </Select>
                </Form.Item>
                <Form.Item label="Priority" name="priority">
                  <Select placeholder="Select priority">
                    <Option value="high">High</Option>
                    <Option value="medium">Medium</Option>
                    <Option value="low">Low</Option>
                  </Select>
                </Form.Item>
                <Form.Item label="Legal Notes" name="legalNotes">
                  <TextArea rows={4} placeholder="Enter legal review notes..." />
                </Form.Item>
              </Form>
            </Space>
          </Card>
        );
      
      case 3:
        return (
          <Card title="Final Approval">
            <Row gutter={16}>
              <Col span={12}>
                <Card size="small">
                  <Title level={4}>Contract Summary</Title>
                  <p><strong>Customer:</strong> {approvalData.customerName}</p>
                  <p><strong>Property:</strong> {approvalData.propertyAddress}</p>
                  <p><strong>Loan Amount:</strong> ${approvalData.loanAmount.toLocaleString()}</p>
                  <p><strong>Contract ID:</strong> {approvalData.contractId}</p>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <Title level={4}>Approval History</Title>
                  <Space direction="vertical">
                    <div>✅ Document Review - Completed</div>
                    <div>✅ Credit Check - Passed</div>
                    <div>✅ Legal Review - Approved</div>
                    <div>⏳ Final Approval - Pending</div>
                  </Space>
                </Card>
              </Col>
            </Row>
          </Card>
        );
      
      default:
        return <div>Step content</div>;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ 
        background: 'linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%)', 
        padding: '0 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ color: 'white', fontSize: '18px', fontWeight: 'bold' }}>
          Multi-Step Approval Workspace
        </div>
        <Space>
          <Badge count={2}>
            <BellOutlined style={{ color: 'white', fontSize: '18px' }} />
          </Badge>
          <Avatar icon={<UserOutlined />} />
          <span style={{ color: 'white' }}>Credit Officer</span>
        </Space>
      </Header>

      <Content style={{ padding: '24px' }}>
        <Card>
          <Title level={3}>Contract Approval Process - {approvalData.contractId}</Title>
          <Text type="secondary">Customer: {approvalData.customerName}</Text>
          
          <Divider />
          
          <Steps current={currentStep} style={{ marginBottom: 24 }}>
            {approvalSteps.map((step, index) => (
              <Step
                key={index}
                title={step.title}
                description={step.description}
                status={index === currentStep ? 'process' : index < currentStep ? 'finish' : 'wait'}
              />
            ))}
          </Steps>

          {renderStepContent()}

          <Divider />

          <div style={{ textAlign: 'right' }}>
            <Space>
              {currentStep > 0 && (
                <Button onClick={() => setCurrentStep(currentStep - 1)}>
                  Previous
                </Button>
              )}
              <Button onClick={handleReject} danger>
                Reject
              </Button>
              <Button type="primary" onClick={handleApprove}>
                {currentStep === approvalSteps.length - 1 ? 'Final Approve' : 'Approve & Next'}
              </Button>
            </Space>
          </div>
        </Card>
      </Content>
    </Layout>
  );
}

export default MultiStepApprovalScreen;