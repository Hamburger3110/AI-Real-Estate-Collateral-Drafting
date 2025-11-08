import React, { useState, useEffect } from "react";
import {
  Card,
  Button,
  Space,
  Typography,
  Row,
  Col,
  Table,
  Tag,
  Progress,
  Modal,
  Form,
  Input,
  message,
  Spin,
  Alert,
  Descriptions,
  Divider,
  Tooltip,
} from "antd";
import {
  FileTextOutlined,
  DownloadOutlined,
  EditOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { buildApiUrl, API_ENDPOINTS } from '../config/api';

const { Title, Text } = Typography;
const { confirm } = Modal;

function ContractGenerationScreen() {
  const { contractId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [contract, setContract] = useState(null);
  const [preview, setPreview] = useState(null);
  const [fieldEditModal, setFieldEditModal] = useState(false);
  const [editForm] = Form.useForm();

  useEffect(() => {
    if (contractId && token) {
      loadContractData();
      loadGenerationPreview();
    }
  }, [contractId, token]);

  const loadContractData = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        buildApiUrl(API_ENDPOINTS.CONTRACTS, `/${contractId}`),
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to load contract data");
      }

      const data = await response.json();
      setContract(data);
    } catch (error) {
      console.error("Error loading contract:", error);
      message.error("Failed to load contract data");
    } finally {
      setLoading(false);
    }
  };

  const loadGenerationPreview = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        buildApiUrl(API_ENDPOINTS.GENERATION_PREVIEW, `/${contractId}`),
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to load generation preview");
      }

      const data = await response.json();
      setPreview(data.preview);
    } catch (error) {
      console.error("Error loading preview:", error);
      message.error("Failed to load contract generation preview");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateContract = async (userInputFields = {}) => {
    try {
      setGenerating(true);
      const response = await fetch(
        buildApiUrl(API_ENDPOINTS.GENERATE_CONTRACT, `/${contractId}`),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userInputFields }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate contract");
      }

      // Handle file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `contract_${contractId}_${Date.now()}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      message.success(
        "Contract generated, downloaded, and uploaded to S3 successfully!"
      );

      // Refresh preview after generation
      await loadGenerationPreview();
    } catch (error) {
      console.error("Error generating contract:", error);
      message.error(error.message || "Failed to generate contract");
    } finally {
      setGenerating(false);
    }
  };

  const handleEditFields = () => {
    if (preview && preview.mappedFields) {
      editForm.setFieldsValue(preview.mappedFields);
      setFieldEditModal(true);
    }
  };

  const handleSaveEditedFields = async () => {
    try {
      const editedFields = await editForm.validateFields();

      confirm({
        title: "Generate Contract with Edited Fields?",
        content:
          "This will generate a new contract document with your edited field values.",
        okText: "Generate",
        cancelText: "Cancel",
        onOk: () => {
          setFieldEditModal(false);
          handleGenerateContract(editedFields);
        },
      });
    } catch (error) {
      console.error("Form validation failed:", error);
    }
  };

  const getFieldColumns = () => [
    {
      title: "Field",
      dataIndex: "key",
      key: "key",
      render: (text) => <Text strong>{text.replace(/\./g, " › ")}</Text>,
    },
    {
      title: "Value",
      dataIndex: "value",
      key: "value",
      render: (text) => text || <Text type="secondary">Not available</Text>,
    },
    {
      title: "Status",
      key: "status",
      render: (_, record) => {
        if (record.value && record.value.trim() !== "") {
          return (
            <Tag color="green" icon={<CheckCircleOutlined />}>
              Available
            </Tag>
          );
        } else {
          return (
            <Tag color="red" icon={<ExclamationCircleOutlined />}>
              Missing
            </Tag>
          );
        }
      },
    },
  ];

  const getFieldTableData = () => {
    if (!preview || !preview.mappedFields) return [];

    return Object.entries(preview.mappedFields).map(([key, value]) => ({
      key,
      value,
      id: key,
    }));
  };

  if (loading && !preview) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Spin size="large" />
        <div style={{ marginTop: "20px" }}>
          <Text>Loading contract generation data...</Text>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px" }}>
      <div style={{ marginBottom: "24px" }}>
        <Button
          onClick={() => navigate("/contracts")}
          style={{ marginBottom: "16px" }}
        >
          ← Back to Contracts
        </Button>

        <Title level={2}>
          <FileTextOutlined /> Contract Generation
        </Title>
        <Text type="secondary">
          Generate contract document from extracted field data
        </Text>
      </div>

      <Row gutter={24}>
        {/* Contract Information */}
        <Col xs={24} lg={8}>
          <Card title="Contract Information" style={{ marginBottom: "24px" }}>
            {contract && (
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Contract Number">
                  {contract.contract_number}
                </Descriptions.Item>
                <Descriptions.Item label="Customer">
                  {contract.customer_name}
                </Descriptions.Item>
                <Descriptions.Item label="Property">
                  {contract.property_address}
                </Descriptions.Item>
                <Descriptions.Item label="Loan Amount">
                  ${contract.loan_amount?.toLocaleString()}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color="blue">{contract.status}</Tag>
                </Descriptions.Item>
              </Descriptions>
            )}
          </Card>

          {/* Generation Status */}
          <Card title="Generation Status">
            {preview && (
              <>
                <div style={{ marginBottom: "16px" }}>
                  <Text strong>Field Completion</Text>
                  <Progress
                    percent={preview.stats?.completionPercentage || 0}
                    status={
                      preview.validation?.canGenerate ? "success" : "exception"
                    }
                    format={(percent) =>
                      `${preview.stats?.filledFields || 0}/${
                        preview.stats?.totalFields || 0
                      }`
                    }
                  />
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <Text strong>Documents Processed: </Text>
                  <Text>{preview.stats?.documentsProcessed || 0}</Text>
                </div>

                {preview.validation?.missingRequired?.length > 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    message="Missing Required Fields"
                    description={
                      <ul style={{ marginBottom: 0, paddingLeft: "20px" }}>
                        {preview.validation.missingRequired.map((field) => (
                          <li key={field}>{field.replace(/\./g, " › ")}</li>
                        ))}
                      </ul>
                    }
                    style={{ marginBottom: "16px" }}
                  />
                )}

                {preview.validation?.warnings?.length > 0 && (
                  <Alert
                    type="info"
                    showIcon
                    message={`${preview.validation.warnings.length} Warning(s)`}
                    description="Some optional fields are missing but contract can still be generated."
                    style={{ marginBottom: "16px" }}
                  />
                )}

                <Space direction="vertical" style={{ width: "100%" }}>
                  <Button
                    type="primary"
                    icon={<DownloadOutlined />}
                    onClick={() => handleGenerateContract()}
                    loading={generating}
                    block
                  >
                    Generate Contract
                  </Button>

                  <Button
                    icon={<EditOutlined />}
                    onClick={handleEditFields}
                    block
                  >
                    Edit Fields
                  </Button>
                </Space>
              </>
            )}
          </Card>
        </Col>

        {/* Field Mapping Table */}
        <Col xs={24} lg={16}>
          <Card
            title="Extracted Fields"
            extra={
              <Space>
                <Tooltip title="Refresh field data">
                  <Button
                    icon={<EyeOutlined />}
                    onClick={loadGenerationPreview}
                    loading={loading}
                  >
                    Refresh
                  </Button>
                </Tooltip>
              </Space>
            }
          >
            <Table
              columns={getFieldColumns()}
              dataSource={getFieldTableData()}
              pagination={{ pageSize: 10 }}
              size="small"
              scroll={{ y: 400 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Field Edit Modal */}
      <Modal
        title="Edit Contract Fields"
        open={fieldEditModal}
        onOk={handleSaveEditedFields}
        onCancel={() => setFieldEditModal(false)}
        width={800}
        okText="Generate with Edited Fields"
        okButtonProps={{ loading: generating }}
      >
        <Alert
          type="info"
          message="Edit field values below. Empty fields will be left blank in the contract."
          style={{ marginBottom: "16px" }}
        />

        <Form
          form={editForm}
          layout="vertical"
          style={{ maxHeight: "400px", overflowY: "auto" }}
        >
          {preview &&
            Object.entries(preview.mappedFields).map(([key, value]) => (
              <Form.Item key={key} name={key} label={key.replace(/\./g, " › ")}>
                <Input placeholder={`Enter ${key.replace(/\./g, " ")}`} />
              </Form.Item>
            ))}
        </Form>
      </Modal>
    </div>
  );
}

export default ContractGenerationScreen;
