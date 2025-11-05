import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  notification,
  Modal,
  Form,
  Row,
  Col,
  Typography,
  Descriptions,
  Popconfirm,
  List,
  Spin,
  Upload
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
  ReloadOutlined,
  FileTextOutlined,
  DollarOutlined,
  HomeOutlined,
  CalendarOutlined,
  PlusOutlined,
  InboxOutlined,
  DeleteOutlined,
  SyncOutlined
} from '@ant-design/icons';
import { useAuth } from './contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import NewContractModal from './NewContractModal';
import useDocumentPolling from './hooks/useDocumentPolling';
import DocumentReviewPanel from './components/DocumentReviewPanel';

const { Header, Content } = Layout;
const { Option } = Select;
const { Text } = Typography;

function ContractListScreen() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [newContractModalVisible, setNewContractModalVisible] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [contractDetails, setContractDetails] = useState(null);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [addDocumentModalVisible, setAddDocumentModalVisible] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [fileList, setFileList] = useState([]);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedDocumentForReview, setSelectedDocumentForReview] = useState(null);
  const [editForm] = Form.useForm();
  const { user, token } = useAuth();
  const navigate = useNavigate();

  // Track all documents for polling (flatten from contract details)
  const [allDocuments, setAllDocuments] = useState([]);

  // Refs to avoid circular dependencies in useCallback
  const fetchContractsRef = useRef(null);
  const fetchContractDetailsRef = useRef(null);

  // Callback when document status changes (from polling)
  const handleDocumentStatusChange = useCallback((updatedDoc) => {
    console.log('📢 Document status changed:', updatedDoc);
    
    // Show success notification
    const reviewText = updatedDoc.needsManualReview 
      ? ' - Manual review required' 
      : '';
    
    notification.success({
      message: 'Document Extraction Complete',
      description: `${updatedDoc.fileName} has been processed. Confidence: ${updatedDoc.confidenceScore?.toFixed(1)}%${reviewText}`,
      duration: 5
    });

    // Refresh contracts to get updated data
    if (fetchContractsRef.current) {
      fetchContractsRef.current();
    }
    
    // If viewing contract details, refresh those too
    if (viewModalVisible && selectedContract && fetchContractDetailsRef.current) {
      fetchContractDetailsRef.current(selectedContract.id);
    }
  }, [viewModalVisible, selectedContract]);

  // Use polling hook for processing documents
  useDocumentPolling(allDocuments, handleDocumentStatusChange, 5000);

  // Fetch contracts from API
  const fetchContracts = useCallback(async () => {
    fetchContractsRef.current = fetchContracts;
    console.log('🔍 Fetching contracts...', { 
      user: user ? `${user.full_name} (${user.role})` : 'not logged in', 
      token: token ? `exists (${token.substring(0, 20)}...)` : 'missing',
      localStorage_token: localStorage.getItem('authToken') ? 'exists' : 'missing'
    });
    
    if (!token) {
      console.log('❌ No token available, skipping fetch');
      console.log('🔧 Try logging in again or check localStorage:', localStorage.getItem('authToken'));
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
        const errorText = await response.text();
        console.error('❌ API Error:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Raw API response:', data);
      console.log('📊 Number of contracts received:', data.length);
      
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
        documentTypes: contract.document_types || [],
        documentFileNames: contract.document_file_names || [],
        documentCount: parseInt(contract.document_count) || 0,
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

  // Fetch detailed contract information including documents
  const fetchContractDetails = useCallback(async (contractId) => {
    fetchContractDetailsRef.current = fetchContractDetails;
    setDocumentsLoading(true);
    try {
      const response = await fetch(`http://localhost:3001/contracts/${contractId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch contract details: ${response.status}`);
      }

      const data = await response.json();
      setContractDetails(data);
      
      // Update allDocuments for polling if any documents are processing
      if (data.documents && Array.isArray(data.documents)) {
        const processingDocs = data.documents
          .filter(doc => doc.status === 'Processing')
          .map(doc => ({
            id: doc.document_id,
            documentId: doc.document_id,
            status: doc.status,
            fileName: doc.file_name
          }));
        
        if (processingDocs.length > 0) {
          setAllDocuments(prev => {
            // Merge with existing, avoiding duplicates
            const existingIds = prev.map(d => d.id);
            const newDocs = processingDocs.filter(d => !existingIds.includes(d.id));
            return [...prev, ...newDocs];
          });
        }
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching contract details:', error);
      notification.error({
        message: 'Error',
        description: 'Failed to fetch contract details. Please try again.'
      });
      return null;
    } finally {
      setDocumentsLoading(false);
    }
  }, [token]);

  // Handle document upload for existing contract
  const handleDocumentUpload = async (fileItem) => {
    if (!selectedContract || !contractDetails) {
      message.error('No contract selected');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', fileItem.file);
      formData.append('document_type', fileItem.type || 'ID Card');
      formData.append('user_id', user.user_id);

      setUploadProgress(prev => ({ ...prev, [fileItem.uid]: 0 }));

      const xhr = new XMLHttpRequest();
      xhr.timeout = 30000;

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(prev => ({ ...prev, [fileItem.uid]: percentComplete }));
        }
      });

      xhr.onload = async () => {
        if (xhr.status === 200 || xhr.status === 201) {
          try {
            const response = JSON.parse(xhr.responseText);
            if (!response.success || !response.data) {
              throw new Error(response.error || 'Invalid response format');
            }

            const result = response.data;

            // Link document to contract
            const linkResponse = await fetch(`http://localhost:3001/documents/${result.document_id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                contract_id: contractDetails.contract_id
              })
            });

            if (!linkResponse.ok) {
              const linkError = await linkResponse.json();
              throw new Error(`Failed to link document: ${linkError.error || 'Unknown error'}`);
            }

            setFileList(prev => prev.map(item => 
              item.uid === fileItem.uid 
                ? { ...item, status: 'done', document_id: result.document_id }
                : item
            ));

            message.success(`${fileItem.file.name} uploaded and linked successfully!`);
            
            // Refresh contract details to show new document
            fetchContractDetails(contractDetails.contract_id);
          } catch (parseError) {
            console.error('Error processing upload:', parseError);
            message.error(`Upload failed: ${parseError.message}`);
          }
        } else {
          let errorMessage = 'Upload failed';
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            errorMessage = errorResponse.error || errorResponse.message || errorMessage;
          } catch (e) {
            errorMessage = `HTTP ${xhr.status}: ${xhr.statusText}`;
          }
          message.error(`Upload failed: ${errorMessage}`);
        }
      };

      xhr.onerror = () => {
        message.error(`Network error while uploading ${fileItem.file.name}`);
      };

      xhr.ontimeout = () => {
        message.error(`Upload timeout for ${fileItem.file.name}`);
      };

      xhr.open('POST', 'http://localhost:3001/upload');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);

    } catch (error) {
      console.error('Upload error:', error);
      message.error(`Failed to upload ${fileItem.file.name}: ${error.message}`);
    }
  };

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
        setSelectedContract(record);
        setViewModalVisible(true);
        fetchContractDetails(record.id);
        break;
      case 'edit':
        setSelectedContract(record);
        editForm.setFieldsValue({
          customer_name: record.customerName,
          property_address: record.propertyAddress,
          loan_amount: record.loanAmount,
          contract_number: record.contractNumber
        });
        setEditModalVisible(true);
        break;
      case 'download':
        await handleDownloadPDF(record);
        break;
      default:
        break;
    }
  };

  // Handle contract editing
  const handleEditContract = async (values) => {
    try {
      const response = await fetch(`http://localhost:3001/contracts/${selectedContract.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      message.success('Contract updated successfully');
      setEditModalVisible(false);
      editForm.resetFields();
      fetchContracts(); // Refresh the list
    } catch (error) {
      console.error('Error updating contract:', error);
      notification.error({
        message: 'Error',
        description: 'Failed to update contract. Please try again.'
      });
    }
  };

  // Handle PDF download
  const handleDownloadPDF = async (record) => {
    try {
      // For now, create a simple text-based contract document
      const contractContent = `
        CONTRACT DETAILS
        ================

        Contract Number: ${record.contractNumber}
        Customer Name: ${record.customerName}
        Property Address: ${record.propertyAddress}
        Loan Amount: $${record.loanAmount?.toLocaleString()}
        Status: ${record.status}
        Created Date: ${record.createdDate}
        Assigned To: ${record.assignedTo}

        Generated on: ${new Date().toLocaleString()}
        Generated by: VPBank Real Estate System
      `.trim();

      // Create and download the file
      const blob = new Blob([contractContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Contract_${record.contractNumber}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      message.success(`Contract ${record.contractNumber} downloaded successfully`);
    } catch (error) {
      console.error('Error downloading contract:', error);
      message.error('Failed to download contract');
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
    <Menu>
      <Menu.Item key="view" icon={<EyeOutlined />} onClick={() => handleContractAction('view', record)}>
        View Details
      </Menu.Item>
      <Menu.Item key="workflow" icon={<FileTextOutlined />} onClick={() => handleContractAction('workflow', record)}>
        Approval Workflow
      </Menu.Item>
      <Menu.Item key="edit" icon={<EditOutlined />} onClick={() => handleContractAction('edit', record)}>
        Edit Contract
      </Menu.Item>
      <Menu.Divider />
      {record.rawStatus !== 'approved' && record.rawStatus !== 'rejected' && (
        <>
          <Menu.Item key="approve" icon={<CheckOutlined />}>
            <Popconfirm
              title="Approve Contract"
              description={`Are you sure you want to approve contract ${record.contractNumber}?`}
              onConfirm={() => handleContractAction('approve', record)}
              okText="Yes, Approve"
              cancelText="Cancel"
            >
              Approve
            </Popconfirm>
          </Menu.Item>
          <Menu.Item key="reject" icon={<CloseOutlined />}>
            <Popconfirm
              title="Reject Contract"
              description={`Are you sure you want to reject contract ${record.contractNumber}?`}
              onConfirm={() => handleContractAction('reject', record)}
              okText="Yes, Reject"
              cancelText="Cancel"
              okType="danger"
            >
              Reject
            </Popconfirm>
          </Menu.Item>
          <Menu.Divider />
        </>
      )}
      <Menu.Item key="download" icon={<DownloadOutlined />} onClick={() => handleContractAction('download', record)}>
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
                  console.log('🔧 Debug info:', { 
                    user, 
                    token: token ? 'Token exists' : 'No token',
                    localStorage: localStorage.getItem('authToken') ? 'Has stored token' : 'No stored token'
                  });
                  fetchContracts();
                }}
                type="default"
              >
                Debug Fetch
              </Button>
              <Button 
                onClick={() => {
                  localStorage.removeItem('authToken');
                  localStorage.removeItem('userData');
                  window.location.href = '/login';
                }}
                type="default"
                danger
              >
                Force Re-login
              </Button>
              <Button 
                type="primary" 
                onClick={() => setNewContractModalVisible(true)}
              >
                New Contract
              </Button>
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

      {/* View Contract Details Modal */}
      <Modal
        title={
          <Space>
            <FileTextOutlined />
            <span>Contract Details</span>
          </Space>
        }
        open={viewModalVisible}
        onCancel={() => {
          setViewModalVisible(false);
          setContractDetails(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setViewModalVisible(false);
            setContractDetails(null);
          }}>
            Close
          </Button>,
          <Button 
            key="add-document" 
            icon={<PlusOutlined />}
            onClick={() => {
              setAddDocumentModalVisible(true);
            }}
          >
            Add Document
          </Button>,
          <Button 
            key="workflow" 
            type="primary" 
            icon={<FileTextOutlined />}
            onClick={() => {
              setViewModalVisible(false);
              navigate(`/approvals/${selectedContract?.id}`);
            }}
          >
            View Workflow
          </Button>
        ]}
        width={700}
      >
        {selectedContract && (
          <div>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Contract Number" span={2}>
                <Text strong>{selectedContract.contractNumber}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={<Space><UserOutlined />Customer</Space>}>
                {selectedContract.customerName}
              </Descriptions.Item>
              <Descriptions.Item label={<Space><DollarOutlined />Loan Amount</Space>}>
                ${selectedContract.loanAmount?.toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label={<Space><HomeOutlined />Property</Space>} span={2}>
                {selectedContract.propertyAddress}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={getStatusColor(selectedContract.status)}>
                  {selectedContract.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Progress">
                <Progress 
                  percent={selectedContract.progress} 
                  size="small" 
                  status={selectedContract.progress === 100 ? 'success' : selectedContract.progress === 0 ? 'exception' : 'active'}
                />
              </Descriptions.Item>
              <Descriptions.Item label="Assigned To">
                {selectedContract.assignedTo}
              </Descriptions.Item>
              <Descriptions.Item label={<Space><CalendarOutlined />Created</Space>}>
                {selectedContract.createdDate}
              </Descriptions.Item>
              <Descriptions.Item label="Documents" span={2}>
                {documentsLoading ? (
                  <Spin size="small" />
                ) : contractDetails?.documents && contractDetails.documents.length > 0 ? (
                  <div>
                    <Text strong>{contractDetails.documents.length} document(s) attached</Text>
                    <List
                      size="small"
                      dataSource={contractDetails.documents}
                      renderItem={(doc) => (
                        <List.Item
                          actions={[
                            doc.needs_manual_review && doc.status === 'Extracted' ? (
                              <Button 
                                type="primary" 
                                size="small"
                                danger
                                onClick={() => {
                                  setSelectedDocumentForReview(doc);
                                  setReviewModalVisible(true);
                                }}
                              >
                                Review
                              </Button>
                            ) : null,
                            <Button 
                              type="link" 
                              size="small"
                              icon={<EyeOutlined />}
                              disabled={!doc.ss_uri}
                              onClick={() => {
                                if (doc.ss_uri) {
                                  window.open(doc.ss_uri, '_blank');
                                } else {
                                  message.warning('Document file not available for viewing');
                                }
                              }}
                            >
                              {doc.ss_uri ? 'View' : 'N/A'}
                            </Button>
                          ].filter(Boolean)}
                        >
                          <List.Item.Meta
                            avatar={<FileTextOutlined style={{ color: '#1890ff' }} />}
                            title={doc.file_name}
                            description={
                              <Space direction="vertical" size={4}>
                                <Space>
                                  <Tag color="blue">{doc.document_type}</Tag>
                                  {doc.status === 'Processing' && (
                                    <Tag color="processing" icon={<SyncOutlined spin />}>
                                      Processing...
                                    </Tag>
                                  )}
                                  {doc.status === 'Extracted' && doc.confidence_score && (
                                    <>
                                      {doc.needs_manual_review ? (
                                        <Tag color="warning">
                                          Extracted ({doc.confidence_score.toFixed(1)}%) - Needs Review
                                        </Tag>
                                      ) : (
                                        <Tag color="success">
                                          Extracted ({doc.confidence_score.toFixed(1)}%)
                                        </Tag>
                                      )}
                                    </>
                                  )}
                                  {doc.status === 'Uploaded' && (
                                    <Tag color="default">Uploaded</Tag>
                                  )}
                                </Space>
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                  Uploaded: {new Date(doc.upload_date).toLocaleDateString()}
                                </Text>
                              </Space>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  </div>
                ) : (
                  <div>
                    <Text type="secondary">No documents attached</Text>
                    <br />
                    <Button 
                      type="dashed" 
                      size="small" 
                      icon={<PlusOutlined />}
                      style={{ marginTop: 8 }}
                      onClick={() => {
                        setAddDocumentModalVisible(true);
                      }}
                    >
                      Add First Document
                    </Button>
                  </div>
                )}
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>

      {/* Edit Contract Modal */}
      <Modal
        title={
          <Space>
            <EditOutlined />
            <span>Edit Contract</span>
          </Space>
        }
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          editForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleEditContract}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="contract_number"
                label="Contract Number"
                rules={[{ required: true, message: 'Please enter contract number' }]}
              >
                <Input prefix={<FileTextOutlined />} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="customer_name"
                label="Customer Name"
                rules={[{ required: true, message: 'Please enter customer name' }]}
              >
                <Input prefix={<UserOutlined />} />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item
            name="property_address"
            label="Property Address"
            rules={[{ required: true, message: 'Please enter property address' }]}
          >
            <Input.TextArea 
              rows={2} 
              prefix={<HomeOutlined />}
              placeholder="Enter complete property address"
            />
          </Form.Item>
          
          <Form.Item
            name="loan_amount"
            label="Loan Amount"
            rules={[
              { required: true, message: 'Please enter loan amount' },
              { type: 'number', min: 0, message: 'Loan amount must be positive' }
            ]}
          >
            <Input 
              type="number" 
              prefix={<DollarOutlined />}
              placeholder="Enter loan amount"
              addonBefore="$"
            />
          </Form.Item>

          <Form.Item style={{ textAlign: 'right', marginTop: '24px' }}>
            <Space>
              <Button onClick={() => {
                setEditModalVisible(false);
                editForm.resetFields();
              }}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit">
                Update Contract
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Document Modal */}
      <Modal
        title={
          <Space>
            <PlusOutlined />
            <span>Add Documents to Contract</span>
          </Space>
        }
        open={addDocumentModalVisible}
        onCancel={() => {
          setAddDocumentModalVisible(false);
          setFileList([]);
          setUploadProgress({});
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setAddDocumentModalVisible(false);
            setFileList([]);
            setUploadProgress({});
          }}>
            Cancel
          </Button>,
          <Button 
            key="upload" 
            type="primary" 
            disabled={fileList.length === 0}
            onClick={async () => {
              for (const fileItem of fileList.filter(item => item.status === 'ready')) {
                setFileList(prev => prev.map(item => 
                  item.uid === fileItem.uid ? { ...item, status: 'uploading' } : item
                ));
                await handleDocumentUpload(fileItem);
              }
              // Close modal after all uploads complete
              setTimeout(() => {
                setAddDocumentModalVisible(false);
                setFileList([]);
                setUploadProgress({});
              }, 1000);
            }}
          >
            Upload {fileList.length} Document(s)
          </Button>
        ]}
        width={600}
      >
        {selectedContract && (
          <div>
            <p>Adding documents to: <Text strong>{selectedContract.contractNumber}</Text></p>
            
            <Upload.Dragger
              multiple
              showUploadList={false}
              beforeUpload={(file) => {
                setFileList(prev => [...prev, {
                  file,
                  status: 'ready',
                  uid: file.uid,
                  type: 'ID Card' // default type
                }]);
                return false; // Prevent automatic upload
              }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">Click or drag files to this area to upload</p>
              <p className="ant-upload-hint">
                Support for single or bulk upload. Supported formats: PDF, JPG, PNG, TIFF
              </p>
            </Upload.Dragger>

            {fileList.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Text strong>Selected Files:</Text>
                <List
                  size="small"
                  dataSource={fileList}
                  renderItem={(item) => (
                    <List.Item
                      actions={[
                        <Button 
                          type="link" 
                          danger 
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => {
                            setFileList(prev => prev.filter(f => f.uid !== item.uid));
                          }}
                        >
                          Remove
                        </Button>
                      ]}
                    >
                      <List.Item.Meta
                        avatar={<FileTextOutlined />}
                        title={item.file.name}
                        description={
                          <Space>
                            <Select
                              value={item.type}
                              onChange={(value) => {
                                setFileList(prev => prev.map(f => 
                                  f.uid === item.uid ? { ...f, type: value } : f
                                ));
                              }}
                              size="small"
                              style={{ width: 200 }}
                            >
                              <Select.Option value="ID Card">ID Card</Select.Option>
                              <Select.Option value="Passport">Passport</Select.Option>
                              <Select.Option value="Legal Registration">Legal Registration</Select.Option>
                              <Select.Option value="Business Registration">Business Registration</Select.Option>
                              <Select.Option value="Financial Statement">Financial Statement</Select.Option>
                            </Select>
                            {item.status === 'uploading' && (
                              <Progress 
                                percent={uploadProgress[item.uid] || 0} 
                                size="small" 
                                style={{ width: 100 }}
                              />
                            )}
                            {item.status === 'done' && (
                              <Tag color="green">Uploaded</Tag>
                            )}
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* New Contract Modal */}
      <NewContractModal
        visible={newContractModalVisible}
        onCancel={() => setNewContractModalVisible(false)}
        onSuccess={() => {
          fetchContracts(); // Refresh the contracts list
          setNewContractModalVisible(false);
        }}
      />

      {/* Document Review Modal */}
      <Modal
        title="Manual Document Review"
        open={reviewModalVisible}
        onCancel={() => {
          setReviewModalVisible(false);
          setSelectedDocumentForReview(null);
        }}
        footer={null}
        width={1200}
        destroyOnClose
      >
        {selectedDocumentForReview && (
          <DocumentReviewPanel
            document={selectedDocumentForReview}
            token={token}
            onSave={(correctedData) => {
              message.success('Document corrections saved!');
              setReviewModalVisible(false);
              setSelectedDocumentForReview(null);
              // Refresh contract details to show updated data
              if (selectedContract) {
                fetchContractDetails(selectedContract.id);
              }
            }}
            onCancel={() => {
              setReviewModalVisible(false);
              setSelectedDocumentForReview(null);
            }}
          />
        )}
      </Modal>
    </Layout>
  );
}

export default ContractListScreen;