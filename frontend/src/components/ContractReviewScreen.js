import React, { useState } from 'react';
import {
  Layout,
  Card,
  Form,
  Input,
  Button,
  Space,
  Typography,
  Row,
  Col,
  Divider,
  Table,
  Tag,
  Avatar,
  Badge,
  Modal,
  message,
  Tabs,
  Alert
} from 'antd';
import {
  UserOutlined,
  BellOutlined,
  EditOutlined,
  SaveOutlined,
  PrinterOutlined,
  SendOutlined,
  FileTextOutlined,
  HistoryOutlined
} from '@ant-design/icons';

const { Header, Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;

function ContractReviewScreen() {
  const [form] = Form.useForm();
  const [editing, setEditing] = useState(false);
  const [contractData, setContractData] = useState({
    contractId: 'CT-2024-001',
    customerName: 'John Smith',
    propertyAddress: '123 Main St, City, State 12345',
    loanAmount: 250000,
    interestRate: 4.5,
    loanTerm: 30,
    monthlyPayment: 1266.71,
    status: 'Draft'
  });

  const revisionHistory = [
    {
      id: 1,
      version: 'v1.3',
      date: '2024-10-25',
      editor: 'Nguyen Minh Anh',
      changes: 'Updated loan terms and interest rate',
      status: 'Current'
    },
    {
      id: 2,
      version: 'v1.2',
      date: '2024-10-22',
      editor: 'Le Quoc Anh',
      changes: 'Corrected property address',
      status: 'Previous'
    },
    {
      id: 3,
      version: 'v1.1',
      date: '2024-10-20',
      editor: 'Vu Thi Thanh Hien',
      changes: 'Initial draft creation',
      status: 'Previous'
    }
  ];

  const extractedFields = [
    { field: 'Customer Name', value: 'John Smith', confidence: 98, verified: true },
    { field: 'Property Address', value: '123 Main St, City, State 12345', confidence: 95, verified: true },
    { field: 'Loan Amount', value: '250,000 ₫', confidence: 99, verified: true },
    { field: 'Interest Rate', value: '4.5%', confidence: 92, verified: false },
    { field: 'Property Type', value: 'Single Family Home', confidence: 88, verified: false }
  ];

  const historyColumns = [
    {
      title: 'Version',
      dataIndex: 'version',
      key: 'version'
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date'
    },
    {
      title: 'Editor',
      dataIndex: 'editor',
      key: 'editor'
    },
    {
      title: 'Changes',
      dataIndex: 'changes',
      key: 'changes'
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'Current' ? 'green' : 'blue'}>{status}</Tag>
      )
    }
  ];

  const fieldsColumns = [
    {
      title: 'Field',
      dataIndex: 'field',
      key: 'field'
    },
    {
      title: 'Extracted Value',
      dataIndex: 'value',
      key: 'value'
    },
    {
      title: 'Confidence',
      dataIndex: 'confidence',
      key: 'confidence',
      render: (confidence) => `${confidence}%`
    },
    {
      title: 'Verified',
      dataIndex: 'verified',
      key: 'verified',
      render: (verified) => (
        <Tag color={verified ? 'green' : 'orange'}>
          {verified ? 'Verified' : 'Pending'}
        </Tag>
      )
    }
  ];

  const handleSave = () => {
    form.validateFields().then(values => {
      setContractData({ ...contractData, ...values });
      setEditing(false);
      message.success('Contract saved successfully');
    });
  };

  const handleSendForApproval = () => {
    Modal.confirm({
      title: 'Send for Approval',
      content: 'Are you sure you want to send this contract for approval?',
      onOk() {
        message.success('Contract sent for approval');
      }
    });
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
          Contract Review & Editing
        </div>
        <Space>
          <Badge count={1}>
            <BellOutlined style={{ color: 'white', fontSize: '18px' }} />
          </Badge>
          <Avatar icon={<UserOutlined />} />
          <span style={{ color: 'white' }}>Legal Officer</span>
        </Space>
      </Header>

      <Content style={{ padding: '24px' }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <Title level={3}>Contract Review - {contractData.contractId}</Title>
              <Text type="secondary">Customer: {contractData.customerName}</Text>
            </div>
            <Space>
              <Button icon={<PrinterOutlined />}>Print</Button>
              <Button 
                icon={<EditOutlined />} 
                onClick={() => setEditing(!editing)}
                type={editing ? 'default' : 'primary'}
              >
                {editing ? 'Cancel Edit' : 'Edit Contract'}
              </Button>
              {editing && (
                <Button icon={<SaveOutlined />} type="primary" onClick={handleSave}>
                  Save Changes
                </Button>
              )}
              <Button icon={<SendOutlined />} type="primary" onClick={handleSendForApproval}>
                Send for Approval
              </Button>
            </Space>
          </div>

          <Tabs defaultActiveKey="1">
            <TabPane tab="Contract Details" key="1">
              <Form
                form={form}
                layout="vertical"
                initialValues={contractData}
                disabled={!editing}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Contract ID" name="contractId">
                      <Input disabled />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Status" name="status">
                      <Input disabled />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Customer Name" name="customerName" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Property Address" name="propertyAddress" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item label="Loan Amount" name="loanAmount" rules={[{ required: true }]}>
                      <Input suffix="₫" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Interest Rate" name="interestRate" rules={[{ required: true }]}>
                      <Input suffix="%" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Loan Term" name="loanTerm" rules={[{ required: true }]}>
                      <Input suffix="years" />
                    </Form.Item>
                  </Col>
                </Row>

                <Divider />

                <Title level={4}>Contract Terms</Title>
                <Form.Item label="Special Conditions" name="specialConditions">
                  <TextArea rows={4} placeholder="Enter any special conditions..." />
                </Form.Item>

                <Form.Item label="Additional Notes" name="additionalNotes">
                  <TextArea rows={3} placeholder="Enter additional notes..." />
                </Form.Item>
              </Form>

              {editing && (
                <Alert
                  message="Edit Mode Active"
                  description="You are currently editing this contract. Make sure to save your changes."
                  type="info"
                  showIcon
                  style={{ marginTop: 16 }}
                />
              )}
            </TabPane>

            <TabPane tab="Extracted Data" key="2">
              <Alert
                message="AI-Extracted Information"
                description="The following data was automatically extracted from uploaded documents using AI/OCR technology."
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
              <Table
                columns={fieldsColumns}
                dataSource={extractedFields}
                rowKey="field"
                pagination={false}
              />
            </TabPane>

            <TabPane tab="Revision History" key="3">
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                <HistoryOutlined style={{ marginRight: 8 }} />
                <Title level={4} style={{ margin: 0 }}>Document History</Title>
              </div>
              <Table
                columns={historyColumns}
                dataSource={revisionHistory}
                rowKey="id"
                pagination={false}
              />
            </TabPane>

            <TabPane tab="Preview" key="4">
              <Card>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <Title level={2}>REAL ESTATE LOAN CONTRACT</Title>
                  <Text type="secondary">Contract No: {contractData.contractId}</Text>
                </div>

                <Divider />

                <Paragraph>
                  <strong>BORROWER INFORMATION:</strong><br />
                  Name: {contractData.customerName}<br />
                  Property Address: {contractData.propertyAddress}
                </Paragraph>

                <Paragraph>
                  <strong>LOAN DETAILS:</strong><br />
                  Principal Amount: {contractData.loanAmount?.toLocaleString()} ₫<br />
                  Interest Rate: {contractData.interestRate}% per annum<br />
                  Loan Term: {contractData.loanTerm} years<br />
                  Monthly Payment: {contractData.monthlyPayment?.toLocaleString()} ₫
                </Paragraph>

                <Paragraph>
                  <strong>TERMS AND CONDITIONS:</strong><br />
                  This contract represents a legally binding agreement between the lender and borrower
                  for the financing of real estate property located at the address specified above.
                </Paragraph>

                <div style={{ marginTop: 48, textAlign: 'center' }}>
                  <Text type="secondary">--- End of Contract Preview ---</Text>
                </div>
              </Card>
            </TabPane>
          </Tabs>
        </Card>
      </Content>
    </Layout>
  );
}

export default ContractReviewScreen;