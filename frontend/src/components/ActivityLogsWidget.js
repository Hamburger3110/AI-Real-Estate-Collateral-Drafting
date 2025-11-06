import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  List,
  Avatar,
  Typography,
  Space,
  Tag,
  Tooltip,
  Button,
  Empty
} from 'antd';
import {
  ClockCircleOutlined,
  EyeOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  UploadOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { formatLocalDateTime } from '../utils/timeUtils';

const { Text } = Typography;

function ActivityLogsWidget({ contractId, maxItems = 5 }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();

  const fetchContractActivities = useCallback(async () => {
    try {
      const response = await fetch(`/api/activity-logs/contract/${contractId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities.slice(0, 5)); // Show only latest 5 activities
      }
    } catch (error) {
      console.error('Error fetching contract activities:', error);
    } finally {
      setLoading(false);
    }
  }, [contractId, token]);

  useEffect(() => {
    if (contractId && token) {
      fetchContractActivities();
    }
  }, [contractId, token, fetchContractActivities]);

  useEffect(() => {
    if (contractId && token) {
      fetchContractActivities();
    }
  }, [contractId, token, fetchContractActivities]);  const getActionIcon = (action) => {
    const iconMap = {
      document_upload: <UploadOutlined style={{ color: '#1890ff' }} />,
      document_view: <EyeOutlined style={{ color: '#722ed1' }} />,
      document_validate: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
      field_review: <EditOutlined style={{ color: '#fa8c16' }} />,
      contract_create: <FileTextOutlined style={{ color: '#1B5E20' }} />,
      contract_update: <EditOutlined style={{ color: '#1B5E20' }} />,
      contract_view: <EyeOutlined style={{ color: '#1B5E20' }} />,
      contract_generate: <FileTextOutlined style={{ color: '#2E7D32' }} />,
      contract_approve: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
      contract_reject: <CloseCircleOutlined style={{ color: '#f5222d' }} />,
      workflow_advance: <ClockCircleOutlined style={{ color: '#1890ff' }} />,
    };
    return iconMap[action] || <ClockCircleOutlined />;
  };

  const getActionColor = (action) => {
    const colorMap = {
      document_upload: 'blue',
      document_view: 'purple',
      document_validate: 'green',
      field_review: 'orange',
      contract_create: 'green',
      contract_update: 'blue',
      contract_view: 'purple',
      contract_generate: 'cyan',
      contract_approve: 'green',
      contract_reject: 'red',
      workflow_advance: 'blue',
    };
    return colorMap[action] || 'default';
  };

  return (
    <Card 
      title={
        <Space>
          <ClockCircleOutlined style={{ color: '#1B5E20' }} />
          <span>Recent Activity</span>
        </Space>
      }
      size="small"
      extra={
        <Button 
          type="link" 
          size="small"
          onClick={() => window.open(`/activity-logs?contract_id=${contractId}`, '_blank')}
        >
          View All
        </Button>
      }
    >
      {activities.length === 0 ? (
        <Empty 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No recent activity"
          style={{ margin: '20px 0' }}
        />
      ) : (
        <List
          loading={loading}
          dataSource={activities}
          renderItem={(activity) => (
            <List.Item style={{ padding: '8px 0', border: 'none' }}>
              <List.Item.Meta
                avatar={
                  <Avatar 
                    size="small" 
                    icon={getActionIcon(activity.action)}
                    style={{ backgroundColor: 'transparent' }}
                  />
                }
                title={
                  <Space size={4} wrap>
                    <Text strong style={{ fontSize: '12px' }}>
                      {activity.user_name || 'System'}
                    </Text>
                    <Tag 
                      size="small" 
                      color={getActionColor(activity.action)}
                      style={{ fontSize: '10px', margin: 0 }}
                    >
                      {activity.action.replace(/_/g, ' ').toUpperCase()}
                    </Tag>
                  </Space>
                }
                description={
                  <div>
                    <Text 
                      style={{ 
                        fontSize: '11px', 
                        color: '#666',
                        display: 'block',
                        marginTop: '2px'
                      }}
                    >
                      {activity.action_detail || 'No details'}
                    </Text>
                    <Tooltip title={formatLocalDateTime(activity.timestamp)}>
                      <Text 
                        type="secondary" 
                        style={{ fontSize: '10px', marginTop: '4px', display: 'block' }}
                      >
                        {formatLocalDateTime(activity.timestamp)}
                      </Text>
                    </Tooltip>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}

export default ActivityLogsWidget;