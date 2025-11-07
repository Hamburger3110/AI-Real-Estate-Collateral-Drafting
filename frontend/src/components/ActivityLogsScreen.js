import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Input,
  Select,
  Space,
  Tag,
  Typography,
  Row,
  Col,
  Button,
  Tooltip,
  Avatar,
  message,
  Empty,
  Badge
} from 'antd';
import {
  SearchOutlined,
  FilterOutlined,
  ReloadOutlined,
  UserOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  EditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UploadOutlined,
  LoginOutlined,
  LogoutOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { formatLocalDateTime } from '../utils/timeUtils';

const { Title, Text } = Typography;
const { Option } = Select;

function ActivityLogsScreen() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalRecords, setTotalRecords] = useState(0);
  const [actionFilter, setActionFilter] = useState(null);
  const [userIdFilter, setUserIdFilter] = useState(null);
  const [contractIdFilter, setContractIdFilter] = useState(null);
  
  const { token } = useAuth();

  const getActionIcon = (action) => {
    const iconMap = {
      login: <LoginOutlined style={{ color: '#52c41a' }} />,
      logout: <LogoutOutlined style={{ color: '#faad14' }} />,
      document_upload: <UploadOutlined style={{ color: '#1890ff' }} />,
      document_delete: <CloseCircleOutlined style={{ color: '#f5222d' }} />,
      document_view: <EyeOutlined style={{ color: '#722ed1' }} />,
      document_validate: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
      field_review: <EditOutlined style={{ color: '#fa8c16' }} />,
      contract_create: <FileTextOutlined style={{ color: '#1B5E20' }} />,
      contract_update: <EditOutlined style={{ color: '#1B5E20' }} />,
      contract_delete: <CloseCircleOutlined style={{ color: '#f5222d' }} />,
      contract_view: <EyeOutlined style={{ color: '#1B5E20' }} />,
      contract_generate: <DownloadOutlined style={{ color: '#2E7D32' }} />,
      contract_approve: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
      contract_reject: <CloseCircleOutlined style={{ color: '#f5222d' }} />,
      workflow_advance: <ClockCircleOutlined style={{ color: '#1890ff' }} />,
      
      // Specific approval stage actions
      document_review_approve: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
      document_review_reject: <CloseCircleOutlined style={{ color: '#f5222d' }} />,
      credit_analysis_approve: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
      credit_analysis_reject: <CloseCircleOutlined style={{ color: '#f5222d' }} />,
      legal_review_approve: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
      legal_review_reject: <CloseCircleOutlined style={{ color: '#f5222d' }} />,
      risk_assessment_approve: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
      risk_assessment_reject: <CloseCircleOutlined style={{ color: '#f5222d' }} />,
      final_approval_approve: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
      final_approval_reject: <CloseCircleOutlined style={{ color: '#f5222d' }} />,
      
      // Workflow transitions
      workflow_stage_start: <ClockCircleOutlined style={{ color: '#1890ff' }} />,
      workflow_stage_complete: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
      workflow_complete: <CheckCircleOutlined style={{ color: '#2E7D32' }} />,
      
      export_data: <DownloadOutlined style={{ color: '#fa8c16' }} />,
      system_config: <EditOutlined style={{ color: '#722ed1' }} />,
    };
    return iconMap[action] || <ClockCircleOutlined />;
  };

  const getActionColor = (action) => {
    const colorMap = {
      login: 'green',
      logout: 'orange',
      document_upload: 'blue',
      document_delete: 'red',
      document_view: 'purple',
      document_validate: 'green',
      field_review: 'orange',
      contract_create: 'green',
      contract_update: 'blue',
      contract_delete: 'red',
      contract_view: 'purple',
      contract_generate: 'cyan',
      contract_approve: 'green',
      contract_reject: 'red',
      workflow_advance: 'blue',
      
      // Specific approval stage actions
      document_review_approve: 'green',
      document_review_reject: 'red',
      credit_analysis_approve: 'green',
      credit_analysis_reject: 'red',
      legal_review_approve: 'green',
      legal_review_reject: 'red',
      risk_assessment_approve: 'green',
      risk_assessment_reject: 'red',
      final_approval_approve: 'green',
      final_approval_reject: 'red',
      
      // Workflow transitions
      workflow_stage_start: 'blue',
      workflow_stage_complete: 'green',
      workflow_complete: 'green',
      
      export_data: 'orange',
      system_config: 'purple',
    };
    return colorMap[action] || 'default';
  };

  const fetchActivityLogs = useCallback(async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: ((currentPage - 1) * pageSize).toString(),
      });

      if (actionFilter) params.append('action', actionFilter);
      if (userIdFilter) params.append('user_id', userIdFilter);
      if (contractIdFilter) params.append('contract_id', contractIdFilter);

      const response = await fetch(
        `http://localhost:3001/activity_logs?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch activity logs');
      }

      const data = await response.json();
      setLogs(data.logs || []);
      setTotalRecords(data.total || 0);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      message.error('Failed to fetch activity logs');
    } finally {
      setLoading(false);
    }
  }, [token, currentPage, pageSize, actionFilter, userIdFilter, contractIdFilter]);

  useEffect(() => {
    fetchActivityLogs();
  }, [fetchActivityLogs]);

  const handleTableChange = (newPagination) => {
    setCurrentPage(newPagination.current);
    setPageSize(newPagination.pageSize);
  };

  const handleFilterChange = (key, value) => {
    if (key === 'action') setActionFilter(value);
    else if (key === 'user_id') setUserIdFilter(value);
    else if (key === 'contract_id') setContractIdFilter(value);
    
    setCurrentPage(1); // Reset to first page when filters change
  };

  const resetFilters = () => {
    setActionFilter(null);
    setUserIdFilter(null);
    setContractIdFilter(null);
    setCurrentPage(1);
  };

  const columns = [
    {
      title: 'Time',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 160,
      render: (timestamp) => (
        <Tooltip title={formatLocalDateTime(timestamp)}>
          <Text style={{ fontSize: '12px' }}>
            {formatLocalDateTime(timestamp)}
          </Text>
        </Tooltip>
      ),
      sorter: true,
    },
    {
      title: 'User',
      key: 'user',
      width: 200,
      render: (_, record) => (
        <Space>
          <Avatar 
            size="small" 
            icon={<UserOutlined />} 
            style={{ backgroundColor: '#1B5E20' }}
          />
          <div>
            <div style={{ fontWeight: 500 }}>
              {record.user_name || 'System'}
            </div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.user_role || 'N/A'}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 200,
      render: (action) => (
        <Space>
          {getActionIcon(action)}
          <Tag color={getActionColor(action)}>
            {action.replace(/_/g, ' ').toUpperCase()}
          </Tag>
        </Space>
      ),
      filters: [
        { text: 'Login', value: 'login' },
        { text: 'Document Upload', value: 'document_upload' },
        { text: 'Contract Create', value: 'contract_create' },
        { text: 'Contract Update', value: 'contract_update' },
        { text: 'Contract View', value: 'contract_view' },
        { text: 'Contract Approve', value: 'contract_approve' },
        { text: 'Contract Reject', value: 'contract_reject' },
        { text: 'Field Review', value: 'field_review' },
        
        // Approval Stage Actions
        { text: 'Document Review - Approve', value: 'document_review_approve' },
        { text: 'Document Review - Reject', value: 'document_review_reject' },
        { text: 'Credit Analysis - Approve', value: 'credit_analysis_approve' },
        { text: 'Credit Analysis - Reject', value: 'credit_analysis_reject' },
        { text: 'Legal Review - Approve', value: 'legal_review_approve' },
        { text: 'Legal Review - Reject', value: 'legal_review_reject' },
        { text: 'Risk Assessment - Approve', value: 'risk_assessment_approve' },
        { text: 'Risk Assessment - Reject', value: 'risk_assessment_reject' },
        
        // Workflow Transitions
        { text: 'Workflow Stage Start', value: 'workflow_stage_start' },
        { text: 'Workflow Stage Complete', value: 'workflow_stage_complete' },
        { text: 'Workflow Complete', value: 'workflow_complete' },
      ],
    },
    {
      title: 'Contract',
      key: 'contract',
      width: 150,
      render: (_, record) => {
        if (record.contract_number) {
          return (
            <div>
              <Text strong>{record.contract_number}</Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {record.customer_name}
              </Text>
            </div>
          );
        }
        return <Text type="secondary">N/A</Text>;
      },
    },
    // {
    //   title: 'Document',
    //   key: 'document',
    //   width: 150,
    //   render: (_, record) => {
    //     if (record.document_name) {
    //       return (
    //         <div>
    //           <Text>{record.document_name}</Text>
    //           <br />
    //           <Tag size="small" color="blue">
    //             {record.document_type}
    //           </Tag>
    //         </div>
    //       );
    //     }
    //     return <Text type="secondary">N/A</Text>;
    //   },
    // },
    {
      title: 'Details',
      dataIndex: 'action_detail',
      key: 'action_detail',
      ellipsis: {
        showTitle: false,
      },
      render: (detail) => (
        <Tooltip title={detail} placement="topLeft">
          <Text style={{ fontSize: '13px' }}>
            {detail || 'No details'}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: 'IP Address',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 120,
      render: (ip) => (
        <Text code style={{ fontSize: '11px' }}>
          {ip || 'Unknown'}
        </Text>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={24} style={{ marginBottom: '24px' }}>
        <Col span={24}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <Title level={2} style={{ margin: 0 }}>
                  <ClockCircleOutlined style={{ marginRight: '8px', color: '#1B5E20' }} />
                  Activity Logs
                </Title>
                <Text type="secondary">
                  Track all system activities and user actions
                </Text>
              </div>
              <Space>
                <Badge count={logs.length} showZero color="#1B5E20">
                  <Button 
                    icon={<ReloadOutlined />} 
                    onClick={fetchActivityLogs}
                    loading={loading}
                  >
                    Refresh
                  </Button>
                </Badge>
              </Space>
            </div>

            {/* Filters */}
            <Row gutter={16} style={{ marginBottom: '16px' }}>
              <Col xs={24} sm={6}>
                <Select
                  placeholder="Filter by Action"
                  style={{ width: '100%' }}
                  value={actionFilter}
                  onChange={(value) => handleFilterChange('action', value)}
                  allowClear
                >
                  <Option value="login">Login</Option>
                  <Option value="document_upload">Document Upload</Option>
                  <Option value="contract_create">Contract Create</Option>
                  <Option value="contract_update">Contract Update</Option>
                  <Option value="contract_view">Contract View</Option>
                  <Option value="contract_approve">Contract Approve</Option>
                  <Option value="contract_reject">Contract Reject</Option>
                  <Option value="field_review">Field Review</Option>
                  
                  {/* Approval Stage Actions */}
                  <Option value="document_review_approve">Document Review - Approve</Option>
                  <Option value="document_review_reject">Document Review - Reject</Option>
                  <Option value="credit_analysis_approve">Credit Analysis - Approve</Option>
                  <Option value="credit_analysis_reject">Credit Analysis - Reject</Option>
                  <Option value="legal_review_approve">Legal Review - Approve</Option>
                  <Option value="legal_review_reject">Legal Review - Reject</Option>
                  <Option value="risk_assessment_approve">Risk Assessment - Approve</Option>
                  <Option value="risk_assessment_reject">Risk Assessment - Reject</Option>
                  
                  {/* Workflow Transitions */}
                  <Option value="workflow_stage_start">Workflow Stage Start</Option>
                  <Option value="workflow_stage_complete">Workflow Stage Complete</Option>
                  <Option value="workflow_complete">Workflow Complete</Option>
                </Select>
              </Col>
              <Col xs={24} sm={6}>
                <Input
                  placeholder="Contract ID"
                  value={contractIdFilter}
                  onChange={(e) => handleFilterChange('contract_id', e.target.value)}
                  prefix={<SearchOutlined />}
                />
              </Col>
              <Col xs={24} sm={6}>
                <Input
                  placeholder="User ID"
                  value={userIdFilter}
                  onChange={(e) => handleFilterChange('user_id', e.target.value)}
                  prefix={<UserOutlined />}
                />
              </Col>
              <Col xs={24} sm={6}>
                <Button 
                  onClick={resetFilters}
                  icon={<FilterOutlined />}
                >
                  Clear Filters
                </Button>
              </Col>
            </Row>

            {/* Activity Logs Table */}
            <Table
              columns={columns}
              dataSource={logs}
              rowKey="log_id"
              loading={loading}
              pagination={{
                current: currentPage,
                pageSize: pageSize,
                total: totalRecords,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} of ${total} activities`,
              }}
              onChange={handleTableChange}
              scroll={{ x: 1200 }}
              size="small"
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No activity logs found"
                  />
                ),
              }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default ActivityLogsScreen;