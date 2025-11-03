import React, { useState, useEffect, useCallback } from 'react';
import {
  Layout,
  Table,
  Button,
  Space,
  Tag,
  Input,
  Select,
  Card,
  Avatar,
  Badge,
  Dropdown,
  Menu,
  Progress,
  message,
  notification
} from 'antd';
import {
  SearchOutlined,
  FilterOutlined,
  EyeOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
  MoreOutlined,
  UserOutlined,
  BellOutlined,
  DownloadOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useAuth } from './contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const { Header, Content } = Layout;
const { Option } = Select;

function ContractListScreen() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { user, token } = useAuth();
  const navigate = useNavigate();

  // Fetch contracts from API
  const fetchContracts = useCallback(async () => {
    console.log('🔍 Fetching contracts...', { user, token: token ? 'exists' : 'missing' });
    
    if (!token) {
      console.log('❌ No token available, skipping fetch');
      return;
    }
    
    setLoading(true);
    try {
      console.log('📡 Making API call to fetch contracts...');
      const response = await fetch('http://localhost:3001/contracts', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Contracts fetched successfully:', data);
      
      // Transform the database data to match our component's expected format
      const transformedContracts = data.map(contract => ({
        id: contract.contract_id,
        contractNumber: contract.contract_number,
        customerName: contract.customer_name,
        propertyAddress: contract.property_address,
        loanAmount: parseFloat(contract.loan_amount),
        status: formatStatus(contract.status),
        progress: calculateProgress(contract.status, contract.approved_at),
        assignedTo: contract.generated_by_name || 'Unassigned',
        approvedBy: contract.approved_by_name,
        createdDate: new Date(contract.generated_at).toLocaleDateString(),
        lastUpdated: new Date(contract.generated_at).toLocaleDateString(),
        documentType: contract.document_type,
        documentFileName: contract.document_file_name,
        rawStatus: contract.status
      }));

      console.log('📊 Transformed contracts:', transformedContracts);
      setContracts(transformedContracts);
    } catch (error) {
      console.error('❌ Error fetching contracts:', error);
      notification.error({
        message: 'Error',
        description: 'Failed to fetch contracts. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  // Helper functions to transform database values
  const formatStatus = (dbStatus) => {
    const statusMap = {
      'started': 'Draft',
      'processing': 'Under Review',
      'approved': 'Approved',
      'rejected': 'Rejected',
      'pending_documents': 'Pending Documents'
    };
    return statusMap[dbStatus] || dbStatus;
  };

  const calculateProgress = (status, approvedAt) => {
    const progressMap = {
      'started': 25,
      'processing': 50,
      'approved': 100,
      'rejected': 0,
      'pending_documents': 15
    };
    return progressMap[status] || 0;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Draft': return 'blue';
      case 'Under Review': return 'orange';
      case 'Approved': return 'green';
      case 'Rejected': return 'red';
      case 'Pending Documents': return 'purple';
      default: return 'default';
    }
  };

  // Handle contract actions
  const handleContractAction = async (action, record) => {
    switch (action) {
      case 'approve':
        await updateContractStatus(record.id, 'approved');
        break;
      case 'reject':
        await updateContractStatus(record.id, 'rejected');
        break;
      case 'workflow':
        navigate(`/approvals/${record.id}`);
        break;
      case 'view':
        // Navigate to contract details (implement later)
        message.info(`Viewing contract ${record.contractNumber}`);
        break;
      case 'edit':
        message.info(`Editing contract ${record.contractNumber}`);
        break;
      case 'download':
        message.info(`Downloading contract ${record.contractNumber}`);
        break;
      default:
        break;
    }
  };

  const updateContractStatus = async (contractId, newStatus) => {
    try {
      const response = await fetch(`http://localhost:3001/contracts/${contractId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: newStatus,
          ...(newStatus === 'approved' && { approved_by: user.user_id })
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      message.success(`Contract ${newStatus} successfully`);
      fetchContracts(); // Refresh the list
    } catch (error) {
      console.error('Error updating contract:', error);
      notification.error({
        message: 'Error',
        description: `Failed to ${newStatus} contract. Please try again.`
      });
    }
  };

  const actionMenu = (record) => (
    <Menu onClick={({ key }) => handleContractAction(key, record)}>
      <Menu.Item key="view" icon={<EyeOutlined />}>
        View Details
      </Menu.Item>
      <Menu.Item key="workflow" icon={<EditOutlined />}>
        Approval Workflow
      </Menu.Item>
      <Menu.Item key="edit" icon={<EditOutlined />}>
        Edit Contract
      </Menu.Item>
      {record.rawStatus !== 'approved' && record.rawStatus !== 'rejected' && (
        <>
          <Menu.Item key="approve" icon={<CheckOutlined />}>
            Approve
          </Menu.Item>
          <Menu.Item key="reject" icon={<CloseOutlined />}>
            Reject
          </Menu.Item>
        </>
      )}
      <Menu.Item key="download" icon={<DownloadOutlined />}>
        Download PDF
      </Menu.Item>
    </Menu>
  );

  const columns = [
    {
      title: 'Contract #',
      dataIndex: 'contractNumber',
      key: 'contractNumber',
      sorter: (a, b) => a.contractNumber.localeCompare(b.contractNumber),
      render: (text, record) => (
        <Button 
          type="link" 
          onClick={() => handleContractAction('view', record)}
        >
          {text || 'N/A'}
        </Button>
      )
    },
    {
      title: 'Customer',
      dataIndex: 'customerName',
      key: 'customerName',
      sorter: (a, b) => a.customerName.localeCompare(b.customerName),
      render: (text) => text || 'N/A'
    },
    {
      title: 'Property Address',
      dataIndex: 'propertyAddress',
      key: 'propertyAddress',
      ellipsis: true,
      render: (text) => text || 'N/A'
    },
    {
      title: 'Loan Amount',
      dataIndex: 'loanAmount',
      key: 'loanAmount',
      sorter: (a, b) => a.loanAmount - b.loanAmount,
      render: (amount) => amount ? `$${amount.toLocaleString()}` : 'N/A'
    },
    {
      title: 'Document Type',
      dataIndex: 'documentType',
      key: 'documentType',
      render: (type) => type ? <Tag>{type}</Tag> : <Tag color="default">N/A</Tag>
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      filters: [
        { text: 'Draft', value: 'Draft' },
        { text: 'Under Review', value: 'Under Review' },
        { text: 'Approved', value: 'Approved' },
        { text: 'Rejected', value: 'Rejected' },
        { text: 'Pending Documents', value: 'Pending Documents' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status) => <Tag color={getStatusColor(status)}>{status}</Tag>
    },
    {
      title: 'Progress',
      dataIndex: 'progress',
      key: 'progress',
      render: (progress) => (
        <Progress 
          percent={progress} 
          size="small" 
          status={progress === 100 ? 'success' : progress === 0 ? 'exception' : 'active'}
        />
      )
    },
    {
      title: 'Assigned To',
      dataIndex: 'assignedTo',
      key: 'assignedTo',
      render: (text) => text || 'Unassigned'
    },
    {
      title: 'Created Date',
      dataIndex: 'createdDate',
      key: 'createdDate',
      sorter: (a, b) => new Date(a.createdDate) - new Date(b.createdDate)
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <Dropdown overlay={actionMenu(record)} trigger={['click']}>
          <Button icon={<MoreOutlined />} />
        </Dropdown>
      )
    }
  ];

  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = contract.customerName.toLowerCase().includes(searchText.toLowerCase()) ||
                         contract.contractNumber.toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus = statusFilter === 'all' || contract.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Debug: Log when component renders
  console.log('ContractListScreen is rendering');

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
          Contract Management System
        </div>
        <Space>
          <Badge count={contracts.length}>
            <BellOutlined style={{ color: 'white', fontSize: '18px' }} />
          </Badge>
          <Avatar icon={<UserOutlined />} />
          <span style={{ color: 'white' }}>{user?.full_name || user?.email || 'User'}</span>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
            ({user?.role || 'N/A'})
          </span>
        </Space>
      </Header>

      <Content style={{ padding: '24px' }}>
        <Card>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2>Contract List</h2>
              <p style={{ color: '#666', margin: 0 }}>
                Total: {contracts.length} contracts | 
                Filtered: {filteredContracts.length} contracts
              </p>
            </div>
            <Space>
              <Input
                placeholder="Search contracts..."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 250 }}
                allowClear
              />
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 150 }}
                suffixIcon={<FilterOutlined />}
              >
                <Option value="all">All Status</Option>
                <Option value="Draft">Draft</Option>
                <Option value="Under Review">Under Review</Option>
                <Option value="Approved">Approved</Option>
                <Option value="Rejected">Rejected</Option>
                <Option value="Pending Documents">Pending Documents</Option>
              </Select>
              <Button 
                icon={<ReloadOutlined />} 
                onClick={fetchContracts}
                loading={loading}
                title="Refresh contracts"
              >
                Refresh
              </Button>
              <Button 
                onClick={() => {
                  console.log('🔧 Debug info:', { user, token: token ? 'Token exists' : 'No token' });
                  fetchContracts();
                }}
                type="default"
              >
                Debug Fetch
              </Button>
              <Button type="primary">New Contract</Button>
            </Space>
          </div>

          <Table
            columns={columns}
            dataSource={filteredContracts}
            loading={loading}
            rowKey="id"
            pagination={{
              total: filteredContracts.length,
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} contracts`
            }}
          />
        </Card>
      </Content>
    </Layout>
  );
}

export default ContractListScreen;