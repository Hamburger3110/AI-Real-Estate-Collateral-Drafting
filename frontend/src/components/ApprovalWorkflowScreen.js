import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Steps,
  Button,
  Space,
  Tag,
  Typography,
  Row,
  Col,
  Modal,
  Form,
  Input,
  message,
  notification,
  Statistic,
  Avatar,
  Divider,
  Alert,
} from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  ClockCircleOutlined,
  UserOutlined,
  FileTextOutlined,
  SafetyOutlined,
  BankOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext";
import { useParams, useNavigate } from "react-router-dom";
import { formatLocalDate, formatLocalDateTime } from "../utils/timeUtils";
import { calculateWorkflowProgress } from "../utils/progressUtils";
import { buildApiUrl, API_ENDPOINTS } from '../config/api';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;
const { TextArea } = Input;

function ApprovalWorkflowScreen() {
  const [workflow, setWorkflow] = useState(null);
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentAction, setCurrentAction] = useState(null);
  const [contractDocuments, setContractDocuments] = useState(null);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [form] = Form.useForm();

  const { token } = useAuth();
  const { contractId } = useParams();
  const navigate = useNavigate();

  const fetchWorkflow = useCallback(async () => {
    if (!contractId || !token) return;

    setLoading(true);
    try {
      const response = await fetch(
        buildApiUrl(API_ENDPOINTS.APPROVAL_WORKFLOW, `/${contractId}`),
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Workflow data received:', data);
      setWorkflow(data.workflow);
      setContract(data.contract);
    } catch (error) {
      console.error("Error fetching workflow:", error);
      notification.error({
        message: "Error",
        description: "Failed to fetch approval workflow",
      });
    } finally {
      setLoading(false);
    }
  }, [contractId, token]);

  const loadContractDocuments = useCallback(async () => {
    if (!contractId) return;
    
    setDocumentsLoading(true);
    try {
      const response = await fetch(`/contracts/${contractId}/documents`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const documents = await response.json();
        setContractDocuments(documents);
      } else {
        console.error('Failed to load contract documents');
      }
    } catch (error) {
      console.error('Error loading contract documents:', error);
    } finally {
      setDocumentsLoading(false);
    }
  }, [contractId, token]);

  useEffect(() => {
    fetchWorkflow();
    loadContractDocuments();
  }, [fetchWorkflow, loadContractDocuments]);

  const handleAction = async (action, stage) => {
    setCurrentAction({ action, stage });
    setModalVisible(true);
  };

  const submitAction = async (values) => {
    if (!currentAction) return;

    setActionLoading(true);
    try {
      const response = await fetch(
        buildApiUrl(API_ENDPOINTS.APPROVAL_STAGE, `/${contractId}/stage/${currentAction.stage}`),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: currentAction.action,
            comments: values.comments,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Action failed");
      }

      const result = await response.json();

      message.success(result.message);
      setModalVisible(false);
      form.resetFields();
      await fetchWorkflow(); // Refresh the workflow
    } catch (error) {
      console.error("Error submitting action:", error);
      notification.error({
        message: "Error",
        description: error.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const getStageIcon = (stage) => {
    const icons = {
      document_review: <FileTextOutlined />,
      credit_analysis: <BankOutlined />,
      legal_review: <SafetyOutlined />,
      risk_assessment: <ClockCircleOutlined />,
    };
    return icons[stage] || <FileTextOutlined />;
  };

  const getProgressPercent = () => {
    const progress = calculateWorkflowProgress(workflow);
    
    console.log('Progress calculation:', {
      totalStages: workflow?.length || 0,
      progress,
      workflow: workflow?.map(s => ({ stage: s.stage, status: s.status, approvedAt: s.approvedAt })) || []
    });
    
    return progress;
  };

  if (loading) {
    return (
      // <AppLayout>
        <div
          style={{
            padding: "24px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <LoadingOutlined style={{ fontSize: 48 }} />
        </div>
      // </AppLayout>
    );
  }

  if (!contract || !workflow) {
    return (
      // <AppLayout>
        <div
          style={{
            padding: "24px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Alert
            message="Contract Not Found"
            description="The requested contract could not be found."
            type="error"
            showIcon
            action={
              <Button size="small" onClick={() => navigate("/contracts")}>
                Back to Contracts
              </Button>
            }
          />
        </div>
      // </AppLayout>
    );
  }

  return (
    <React.Fragment>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <Card style={{ marginBottom: "24px" }}>
          <Row align="middle" justify="space-between">
            <Col>
              <Title level={2} style={{ margin: 0 }}>
                Contract Approval Workflow
              </Title>
              <Text type="secondary">Contract: {contract.contract_number}</Text>
            </Col>
            <Col>
              <Button onClick={() => navigate("/contracts")}>
                Back to Contracts
              </Button>
            </Col>
          </Row>
        </Card>

        <Row gutter={24}>
          {/* Contract Details */}
          <Col xs={24} lg={8}>
            <Card title="Contract Details" style={{ marginBottom: "24px" }}>
              <Space direction="vertical" style={{ width: "100%" }}>
                <div>
                  <Text strong>Customer:</Text>
                  <br />
                  <Text>{contract.customer_name}</Text>
                </div>
                <div>
                  <Text strong>Property:</Text>
                  <br />
                  <Text>{contract.property_address}</Text>
                </div>
                <div>
                  <Text strong>Loan Amount:</Text>
                  <br />
                  <Text>
                    ${parseFloat(contract.loan_amount).toLocaleString()}
                  </Text>
                </div>
                <div>
                  <Text strong>Created By:</Text>
                  <br />
                  <Text>{contract.generated_by_name}</Text>
                </div>
                <div>
                  <Text strong>Created:</Text>
                  <br />
                  <Text>{formatLocalDate(contract.generated_at)}</Text>
                </div>
                <div>
                  <Text strong>Priority:</Text>
                  <br />
                  <Tag
                    color={
                      contract.priority === "high"
                        ? "red"
                        : contract.priority === "medium"
                        ? "orange"
                        : "green"
                    }
                  >
                    {contract.priority?.toUpperCase() || "MEDIUM"}
                  </Tag>
                </div>
              </Space>
            </Card>

            {/* Contract Documents */}
            {(contractDocuments || (contract.pdf_url || contract.docx_url)) && (
              <Card title="Generated Contract" style={{ marginBottom: "24px" }} loading={documentsLoading}>
                <Space direction="vertical" style={{ width: "100%" }}>
                  {contractDocuments ? (
                    <>
                      {contractDocuments.pdf_url && (
                        <div>
                          <Text strong>PDF Contract:</Text>
                          <br />
                          <Button
                            type="primary"
                            icon={<FileTextOutlined />}
                            onClick={() => window.open(contractDocuments.pdf_url, '_blank')}
                            style={{ marginTop: "8px" }}
                          >
                            View PDF Contract
                          </Button>
                        </div>
                      )}
                      {contractDocuments.docx_url && (
                        <div>
                          <Text strong>Word Document:</Text>
                          <br />
                          <Button
                            icon={<FileTextOutlined />}
                            onClick={() => window.open(contractDocuments.docx_url, '_blank')}
                            style={{ marginTop: "8px" }}
                          >
                            Download DOCX
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {contract.pdf_url && (
                        <div>
                          <Text strong>PDF Contract:</Text>
                          <br />
                          <Button
                            type="primary"
                            icon={<FileTextOutlined />}
                            onClick={() => window.open(contract.pdf_url, '_blank')}
                            style={{ marginTop: "8px" }}
                          >
                            View PDF Contract
                          </Button>
                        </div>
                      )}
                      {contract.docx_url && (
                        <div>
                          <Text strong>Word Document:</Text>
                          <br />
                          <Button
                            icon={<FileTextOutlined />}
                            onClick={() => window.open(contract.docx_url, '_blank')}
                            style={{ marginTop: "8px" }}
                          >
                            Download DOCX
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                  <Text type="secondary" style={{ fontSize: "12px" }}>
                    Generated on {formatLocalDate(contract.generated_at)}
                  </Text>
                </Space>
              </Card>
            )}

            <Card title="Progress Overview">
              <Statistic
                title="Overall Progress"
                value={getProgressPercent()}
                suffix="%"
                valueStyle={{
                  color: getProgressPercent() === 100 ? "#2E7D32" : "#1B5E20",
                }}
              />
              <Divider />
              <div>
                <Text strong>Current Status:</Text>
                <br />
                <Tag
                  color={
                    contract.status === "approved"
                      ? "green"
                      : contract.status === "rejected"
                      ? "red"
                      : "blue"
                  }
                >
                  {contract.status === "approved" 
                    ? "APPROVED" 
                    : contract.status === "rejected" 
                    ? "REJECTED" 
                    : workflow?.find(stage => stage.isActive)?.stageName?.toUpperCase() || contract.status?.toUpperCase()}
                </Tag>
              </div>
            </Card>
          </Col>

          {/* Workflow Steps */}
          <Col xs={24} lg={16}>
            {/* Contract Preview Section */}
            {(contractDocuments || (contract.pdf_url || contract.docx_url)) && (
              <Card title="Contract Review" style={{ marginBottom: "24px" }} loading={documentsLoading}>
                <Row gutter={16}>
                  {contractDocuments ? (
                    <>
                      {contractDocuments.pdf_url && (
                        <Col xs={24} sm={12}>
                          <Button
                            type="primary"
                            size="large"
                            icon={<FileTextOutlined />}
                            block
                            onClick={() => window.open(contractDocuments.pdf_url, '_blank')}
                          >
                            📄 Review PDF Contract
                          </Button>
                        </Col>
                      )}
                      {contractDocuments.docx_url && (
                        <Col xs={24} sm={12}>
                          <Button
                            size="large"
                            icon={<FileTextOutlined />}
                            block
                            onClick={() => window.open(contractDocuments.docx_url, '_blank')}
                          >
                            📝 Download Word Document
                          </Button>
                        </Col>
                      )}
                    </>
                  ) : (
                    <>
                      {contract.pdf_url && (
                        <Col xs={24} sm={12}>
                          <Button
                            type="primary"
                            size="large"
                            icon={<FileTextOutlined />}
                            block
                            onClick={() => window.open(contract.pdf_url, '_blank')}
                          >
                            📄 Review PDF Contract
                          </Button>
                        </Col>
                      )}
                      {contract.docx_url && (
                        <Col xs={24} sm={12}>
                          <Button
                            size="large"
                            icon={<FileTextOutlined />}
                            block
                            onClick={() => window.open(contract.docx_url, '_blank')}
                          >
                            📝 Download Word Document
                          </Button>
                        </Col>
                      )}
                    </>
                  )}
                </Row>
                <Alert
                  message="Review Required"
                  description="Please review the generated contract documents before proceeding with the approval workflow."
                  type="info"
                  showIcon
                  style={{ marginTop: "16px" }}
                />
              </Card>
            )}

            <Card title="Approval Workflow">
              <Steps
                direction="vertical"
                current={workflow.findIndex((stage) => stage.isActive)}
                status={contract.status === "rejected" ? "error" : "process"}
              >
                {workflow.map((stage, index) => (
                  <Step
                    key={stage.stage}
                    title={stage.stageName}
                    icon={getStageIcon(stage.stage)}
                    status={
                      stage.status?.toLowerCase() === "approved" || 
                      stage.status?.toLowerCase() === "completed" ||
                      stage.approvedAt
                        ? "finish"
                        : stage.status?.toLowerCase() === "rejected"
                        ? "error"
                        : stage.isActive
                        ? "process"
                        : "wait"
                    }
                    description={
                      <div>
                        {stage.approver && (
                          <div style={{ marginBottom: "8px" }}>
                            <Avatar
                              size="small"
                              icon={<UserOutlined />}
                              style={{ marginRight: "8px" }}
                            />
                            <Text>{stage.approver.name}</Text>
                            <Tag size="small" style={{ marginLeft: "8px" }}>
                              {stage.approver.role}
                            </Tag>
                          </div>
                        )}

                        {stage.comments && (
                          <Paragraph
                            type="secondary"
                            style={{ fontSize: "12px", margin: "4px 0" }}
                          >
                            "{stage.comments}"
                          </Paragraph>
                        )}

                        {stage.approvedAt && (
                          <Text type="secondary" style={{ fontSize: "12px" }}>
                            {formatLocalDateTime(stage.approvedAt)}
                          </Text>
                        )}

                        {stage.isActive &&
                          stage.canApprove &&
                          stage.status === "pending" && (
                            <div style={{ marginTop: "12px" }}>
                              <Space>
                                <Button
                                  type="primary"
                                  size="small"
                                  icon={<CheckOutlined />}
                                  onClick={() =>
                                    handleAction("approve", stage.stage)
                                  }
                                >
                                  Approve
                                </Button>
                                <Button
                                  danger
                                  size="small"
                                  icon={<CloseOutlined />}
                                  onClick={() =>
                                    handleAction("reject", stage.stage)
                                  }
                                >
                                  Reject
                                </Button>
                              </Space>
                            </div>
                          )}

                        {stage.isActive &&
                          !stage.canApprove &&
                          stage.status === "pending" && (
                            <Alert
                              message="Waiting for approval"
                              description={`This stage requires ${
                                stage.stage.includes("legal")
                                  ? "Legal Officer"
                                  : stage.stage.includes("credit")
                                  ? "Credit Officer"
                                  : "Manager"
                              } approval`}
                              type="info"
                              size="small"
                              style={{ marginTop: "8px" }}
                            />
                          )}
                      </div>
                    }
                  />
                ))}
              </Steps>
            </Card>
          </Col>
        </Row>
      </div>

      {/* Action Modal */}
      <Modal
        title={`${
          currentAction?.action === "approve" ? "Approve" : "Reject"
        } Stage`}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form form={form} onFinish={submitAction} layout="vertical">
          <Form.Item
            name="comments"
            label="Comments"
            rules={[
              {
                required: true,
                message: "Please provide comments for your decision",
              },
            ]}
          >
            <TextArea
              rows={4}
              placeholder={`Please provide your reasoning for ${
                currentAction?.action === "approve" ? "approving" : "rejecting"
              } this stage...`}
            />
          </Form.Item>

          <Form.Item style={{ textAlign: "right", marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>Cancel</Button>
              <Button
                type={
                  currentAction?.action === "approve" ? "primary" : "default"
                }
                danger={currentAction?.action === "reject"}
                htmlType="submit"
                loading={actionLoading}
              >
                {currentAction?.action === "approve" ? "Approve" : "Reject"}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </React.Fragment>
  );
}

export default ApprovalWorkflowScreen;
