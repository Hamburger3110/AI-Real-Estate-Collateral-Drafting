import React from "react";
import {
  Layout,
  Menu,
  Dropdown,
  Avatar,
  Typography,
  Space,
  Button,
} from "antd";
import {
  UserOutlined,
  LogoutOutlined,
  FileTextOutlined,
  CloudUploadOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  DownOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import NotificationDropdown from "./NotificationDropdown";

const { Header } = Layout;
const { Text } = Typography;

function NavigationHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, hasPermission } = useAuth();

  // Debug: Log user data
  console.log("NavigationHeader - User data:", user);

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Create menu items based on user permissions
  const menuItems = [];

  if (hasPermission("VIEW_CONTRACTS")) {
    menuItems.push({
      key: "/contracts",
      icon: <FileTextOutlined />,
      label: "Contract Management",
    });
  }

  // if (hasPermission('UPLOAD_DOCUMENTS')) {
  //   menuItems.push({
  //     key: '/upload',
  //     icon: <CloudUploadOutlined />,
  //     label: 'Document Upload'
  //   });
  // }

  if (
    hasPermission("CREDIT_REVIEW") ||
    hasPermission("LEGAL_REVIEW") ||
    hasPermission("FINAL_APPROVAL")
  ) {
    menuItems.push({
      key: "/approvals",
      icon: <CheckCircleOutlined />,
      label: "Approval Dashboard",
    });
  }

  if (hasPermission("VIEW_ACTIVITY_LOGS")) {
    menuItems.push({
      key: "/activity-logs",
      icon: <ClockCircleOutlined />,
      label: "Activity Logs",
    });
  }

  // if (hasPermission('VIEW_CONTRACTS')) {
  //   menuItems.push({
  //     key: '/review',
  //     icon: <EyeOutlined />,
  //     label: 'Contract Review'
  //   });
  // }

  const userMenuItems = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: "Profile",
      disabled: true,
    },
    {
      type: "divider",
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Logout",
      onClick: handleLogout,
    },
  ];

  const getRoleBadgeColor = (role) => {
    const colors = {
      ADMIN: "#D32F2F",
      CREDIT_OFFICER: "#1B5E20",
      LEGAL_OFFICER: "#2E7D32",
      MANAGER: "#388E3C",
      VIEWER: "#757575",
    };
    return colors[role] || "#757575";
  };

  return (
    <Header
      style={{
        background: "linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%)",
        padding: "0 24px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <div
          style={{
            fontWeight: "bold",
            fontSize: "18px",
            color: "#FFFFFF",
            marginRight: "32px",
          }}
        >
          VPBank Real Estate System
        </div>

        <Menu
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{
            border: "none",
            backgroundColor: "transparent",
            minWidth: "400px",
          }}
          theme="dark"
        />
      </div>

      <Space size="middle" style={{ alignItems: "center" }}>
        <NotificationDropdown />

        <div style={{ textAlign: "right", minWidth: "120px", display:'flex', flexDirection:'column', alignItems:'flex-end' }}>
          <Text strong style={{ whiteSpace: "nowrap", color: "#FFFFFF" }}>
            {user?.full_name || user?.email || "User"}
          </Text>
          <Text
            style={{
              fontSize: "12px",
              color: "#FFB300",
              fontWeight: 500,
              whiteSpace: "nowrap",
            }}
          >
            {user?.role?.replace("_", " ") || "LEGAL_OFFICER"}
          </Text>
        </div>

        <Dropdown
          menu={{ items: userMenuItems }}
          trigger={["click"]}
          placement="bottomRight"
        >
          <Button type="text" style={{ height: "40px", padding: "0 8px" }}>
            <Space>
              <Avatar
                icon={<UserOutlined />}
                style={{ backgroundColor: getRoleBadgeColor(user?.role) }}
                size="small"
              />
              <DownOutlined style={{ fontSize: "12px" }} />
            </Space>
          </Button>
        </Dropdown>
      </Space>
    </Header>
  );
}

export default NavigationHeader;
