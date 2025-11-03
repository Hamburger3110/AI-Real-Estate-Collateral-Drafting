import React, { useState, useEffect, useCallback } from 'react';
import {
  Layout,
  Card,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Row,
  Col,
  Statistic,
  Alert,
  message,
  notification
} from 'antd';
import {
  EyeOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { useAuth } from './contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const { Content } = Layout;
const { Title, Text } = Typography;

function ApprovalDashboard() {
  const [pendingContracts, setPendingContracts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const fetchPendingApprovals = useCallback(async () => {
    if (!token) return;
    
    try {
      const response = await fetch('http://localhost:3001/approvals/pending', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setPendingContracts(data);
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
      notification.error({
        message: 'Error',
        description: 'Failed to fetch pending approvals'
      });
    }
  }, [token]);

  const fetchStats = useCallback(async () => {
    if (!token) return;
    
    try {
      const response = await fetch('http://localhost:3001/approvals/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, [token]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchPendingApprovals(), fetchStats()]);
      setLoading(false);
    };
    
    fetchData();
  }, [fetchPendingApprovals, fetchStats]);

  const handleViewWorkflow = (contractId) => {
    navigate(`/approvals/${contractId}`);
  };

  const getStageIcon = (stage) => {
    const icons = {
      'document_review': <FileTextOutlined />,
      'credit_analysis': <CheckCircleOutlined />,
      'legal_review': <ExclamationCircleOutlined />,
      'risk_assessment': <ClockCircleOutlined />,
      'final_approval': <CheckCircleOutlined />
    };
    return icons[stage] || <FileTextOutlined />;
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'red';
      case 'medium': return 'orange';
      case 'low': return 'green';
      default: return 'blue';
    }
  };

  const columns = [
    {
      title: 'Contract #',
      dataIndex: 'contract_number',
      key: 'contract_number',
      render: (text, record) => (
        <Button 
          type="link" 
          onClick={() => handleViewWorkflow(record.contract_id)}
        >
          {text}
        </Button>
      )
    },
    {
      title: 'Customer',
      dataIndex: 'customer_name',
      key: 'customer_name'
    },
    {
      title: 'Loan Amount',
      dataIndex: 'loan_amount',
      key: 'loan_amount',
      render: (amount) => `$${parseFloat(amount).toLocaleString()}`
    },
    {
      title: 'Current Stage',
      dataIndex: 'stage_name',
      key: 'stage_name',
      render: (text, record) => (
        <Space>
          {getStageIcon(record.current_approval_stage)}
          <Text>{text}</Text>
        </Space>
      )
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority) => (
        <Tag color={getPriorityColor(priority)}>
          {(priority || 'medium').toUpperCase()}
        </Tag>
      )
    },
    {
      title: 'Created',
      dataIndex: 'generated_at',
      key: 'generated_at',
      render: (date) => new Date(date).toLocaleDateString()
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewWorkflow(record.contract_id)}
        >
          Review
        </Button>
      )
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Content style={{ padding: '24px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          {/* Header */}
          <Card style={{ marginBottom: '24px' }}>
            <Title level={2} style={{ margin: 0 }}>
              Approval Dashboard
            </Title>
            <Text type="secondary">
              Welcome back, {user?.full_name || user?.email}! 
              You have {pendingContracts.length} contracts pending your approval.
            </Text>
          </Card>

          {/* Statistics */}
          {stats && (
            <Row gutter={16} style={{ marginBottom: '24px' }}>
              <Col xs={24} sm={6}>
                <Card>
                  <Statistic
                    title="Total Contracts"
                    value={stats.overview.total_contracts}
                    prefix={<FileTextOutlined />}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={6}>
                <Card>
                  <Statistic
                    title="Approved"
                    value={stats.overview.approved}
                    valueStyle={{ color: '#3f8600' }}
                    prefix={<CheckCircleOutlined />}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={6}>
                <Card>
                  <Statistic
                    title="Pending"
                    value={stats.overview.pending}
                    valueStyle={{ color: '#1890ff' }}
                    prefix={<ClockCircleOutlined />}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={6}>
                <Card>
                  <Statistic
                    title="Avg. Approval Time"
                    value={parseFloat(stats.overview.avg_approval_days || 0).toFixed(1)}
                    suffix="days"
                    prefix={<ClockCircleOutlined />}
                  />
                </Card>
              </Col>
            </Row>
          )}

          {/* Stage Breakdown */}
          {stats?.stageBreakdown && stats.stageBreakdown.length > 0 && (
            <Card title="Contracts by Stage" style={{ marginBottom: '24px' }}>
              <Row gutter={16}>
                {stats.stageBreakdown.map((stage) => (
                  <Col key={stage.stage} xs={24} sm={8} md={6} lg={4}>
                    <Card size="small">
                      <Statistic
                        title={stage.stageName}
                        value={stage.count}
                        prefix={getStageIcon(stage.stage)}
                      />
                    </Card>
                  </Col>
                ))}
              </Row>
            </Card>
          )}

          {/* Pending Approvals Table */}
          <Card 
            title={
              <Space>
                <ClockCircleOutlined />
                <span>Pending Your Approval ({pendingContracts.length})</span>
              </Space>
            }
            extra={
              <Button 
                onClick={() => {
                  fetchPendingApprovals();
                  fetchStats();
                  message.success('Data refreshed');
                }}
                loading={loading}
              >
                Refresh
              </Button>
            }
          >
            {pendingContracts.length === 0 ? (
              <Alert
                message="No Pending Approvals"
                description="You don't have any contracts pending your approval at this time."
                type="info"
                showIcon
                style={{ margin: '20px 0' }}
              />
            ) : (
              <Table
                columns={columns}
                dataSource={pendingContracts}
                rowKey="contract_id"
                loading={loading}
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total, range) => 
                    `${range[0]}-${range[1]} of ${total} contracts`
                }}
              />
            )}
          </Card>
        </div>
      </Content>
    </Layout>
  );
}

export default ApprovalDashboard;