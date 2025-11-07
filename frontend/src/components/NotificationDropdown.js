import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dropdown,
  Badge,
  List,
  Card,
  Typography,
  Button,
  Space,
  Empty,
  Spin,
  Tag,
  Modal,
  Avatar,
  Divider
} from 'antd';
import {
  BellOutlined,
  CheckOutlined,
  FileTextOutlined,
  UserOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useNotifications } from '../contexts/NotificationContext';
import { formatTimeAgo, formatLocalDateTime } from '../utils/timeUtils';

const { Text } = Typography;

const NotificationDropdown = () => {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    NOTIFICATION_TYPES,
    NOTIFICATION_PRIORITY
  } = useNotifications();

  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);



  useEffect(() => {
    if (dropdownVisible) {
      fetchNotifications();
    }
  }, [dropdownVisible, fetchNotifications]);

  const getNotificationIcon = (type) => {
    switch (type) {
      case NOTIFICATION_TYPES.CONTRACT_CREATED:
      case NOTIFICATION_TYPES.CONTRACT_APPROVED:
        return <FileTextOutlined style={{ color: '#52c41a' }} />;
      case NOTIFICATION_TYPES.CONTRACT_REJECTED:
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      case NOTIFICATION_TYPES.DOCUMENT_REVIEW_REQUIRED:
      case NOTIFICATION_TYPES.APPROVAL_PENDING:
        return <WarningOutlined style={{ color: '#faad14' }} />;
      case NOTIFICATION_TYPES.WORKFLOW_COMPLETED:
        return <CheckOutlined style={{ color: '#52c41a' }} />;
      case NOTIFICATION_TYPES.SYSTEM_ALERT:
      default:
        return <InfoCircleOutlined style={{ color: '#1B5E20' }} />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case NOTIFICATION_PRIORITY.URGENT:
        return '#ff4d4f';
      case NOTIFICATION_PRIORITY.HIGH:
        return '#fa8c16';
      case NOTIFICATION_PRIORITY.MEDIUM:
        return '#1B5E20';
      case NOTIFICATION_PRIORITY.LOW:
      default:
        return '#52c41a';
    }
  };



  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await markAsRead(notification.notification_id);
    }
    setSelectedNotification(notification);
    setDetailModalVisible(true);
    setDropdownVisible(false); // Close dropdown after clicking notification
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    setDropdownVisible(false);
  };

  const recentNotifications = notifications.slice(0, 10);

  const notificationList = (
    <Card 
      style={{ width: 400, maxHeight: 500, overflowY: 'auto' }}
      title={
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button 
              type="link" 
              size="small"
              onClick={handleMarkAllRead}
            >
              Mark all as read
            </Button>
          )}
        </Space>
      }
      bordered={false}
      bodyStyle={{ padding: 0 }}
    >
      {loading ? (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <Spin />
        </div>
      ) : recentNotifications.length === 0 ? (
        <Empty
          description="No notifications"
          style={{ padding: 24 }}
        />
      ) : (
        <List
          dataSource={recentNotifications}
          renderItem={(notification) => (
            <List.Item
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                backgroundColor: notification.read ? '#ffffff' : '#f6ffed',
                borderLeft: `3px solid ${getPriorityColor(notification.priority)}`
              }}
              onClick={() => handleNotificationClick(notification)}
            >
              <List.Item.Meta
                avatar={getNotificationIcon(notification.type)}
                title={
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Text strong={!notification.read} ellipsis style={{ flex: 1 }}>
                      {notification.title}
                    </Text>
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      {formatTimeAgo(notification.created_at)}
                    </Text>
                  </Space>
                }
                description={
                  <div>
                    <Text ellipsis style={{ fontSize: '12px' }}>
                      {notification.message}
                    </Text>
                    {notification.contract_number && (
                      <div style={{ marginTop: 4 }}>
                        <Tag size="small" color="blue">
                          {notification.contract_number}
                        </Tag>
                      </div>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}
      {notifications.length > 10 && (
        <div style={{ padding: 16, textAlign: 'center', borderTop: '1px solid #f0f0f0' }}>
          <Button type="link" size="small">
            View all notifications
          </Button>
        </div>
      )}
    </Card>
  );

  return (
    <>
      <Dropdown
        overlay={notificationList}
        trigger={['click']}
        placement="bottomRight"
        visible={dropdownVisible}
        onVisibleChange={setDropdownVisible}
        overlayStyle={{ zIndex: 1050 }}
        overlayClassName="notification-dropdown-overlay"
      >
        <Badge count={unreadCount} size="small">
          <BellOutlined 
            style={{ 
              color: '#FFFFFF', 
              fontSize: '18px',
              cursor: 'pointer'
            }} 
          />
        </Badge>
      </Dropdown>

      <Modal
        title={
          <Space>
            {selectedNotification && getNotificationIcon(selectedNotification.type)}
            <span>Notification Details</span>
            {selectedNotification && (
              <Tag color={getPriorityColor(selectedNotification.priority)}>
                {selectedNotification.priority}
              </Tag>
            )}
          </Space>
        }
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedNotification(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setDetailModalVisible(false);
            setSelectedNotification(null);
          }}>
            Close
          </Button>
        ]}
        width={500}
        zIndex={1100}
      >
        {selectedNotification && (
          <div>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong style={{ fontSize: '16px' }}>
                  {selectedNotification.title}
                </Text>
              </div>
              
              <Divider style={{ margin: '12px 0' }} />
              
              <div>
                <Text>{selectedNotification.message}</Text>
              </div>

              {selectedNotification.contract_number && (
                <div>
                  <Text type="secondary">Contract: </Text>
                  <Tag color="blue">{selectedNotification.contract_number}</Tag>
                </div>
              )}

              <div style={{ marginTop: 16 }}>
                <Space>
                  <Avatar size="small" icon={<UserOutlined />} />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {selectedNotification.creator_name || 'System'}
                  </Text>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    • {formatLocalDateTime(selectedNotification.created_at)}
                  </Text>
                </Space>
              </div>

              {selectedNotification.contract_id && (
                <div style={{ marginTop: 16 }}>
                  <Button 
                    type="primary" 
                    size="small"
                    onClick={() => {
                      // Close modal and navigate to contract approval workflow
                      setDetailModalVisible(false);
                      setSelectedNotification(null);
                      navigate(`/approvals/${selectedNotification.contract_id}`);
                    }}
                  >
                    View Contract
                  </Button>
                </div>
              )}
            </Space>
          </div>
        )}
      </Modal>
    </>
  );
};

export default NotificationDropdown;