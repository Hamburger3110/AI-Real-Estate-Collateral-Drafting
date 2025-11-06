import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  Form, 
  Input, 
  Button, 
  Alert, 
  Space, 
  Typography, 
  Card, 
  Tag, 
  Row, 
  Col, 
  InputNumber,
  message 
} from 'antd';
import { CheckCircleOutlined, WarningOutlined, EditOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import { formatLocalDate } from '../utils/timeUtils';

const { Title, Text } = Typography;
const { TextArea } = Input;

const DocumentFieldReviewModal = ({ 
  visible, 
  onClose, 
  document, 
  onSave,
  loading = false 
}) => {
  const [form] = Form.useForm();
  const [extractedFields, setExtractedFields] = useState([]);
  const [validationStatus, setValidationStatus] = useState({});

  useEffect(() => {
    if (document && document.extracted_fields) {
      const fields = document.extracted_fields || [];
      setExtractedFields(fields);
      
      // Initialize form with extracted values
      const formData = {};
      const validation = {};
      
      fields.forEach(field => {
        formData[field.field_name] = field.field_value;
        validation[field.field_name] = field.confidence_score >= 95 ? 'validated' : 'needs_review';
      });
      
      form.setFieldsValue(formData);
      setValidationStatus(validation);
    }
  }, [document, form]);

  const getConfidenceColor = (confidence) => {
    if (confidence >= 95) return 'green';
    if (confidence >= 85) return 'orange';
    return 'red';
  };

  const getConfidenceIcon = (confidence) => {
    if (confidence >= 95) return <CheckCircleOutlined />;
    return <WarningOutlined />;
  };

  const handleFieldChange = (fieldName, value) => {
    const updatedFields = extractedFields.map(field => 
      field.field_name === fieldName 
        ? { ...field, field_value: value, manually_corrected: true }
        : field
    );
    setExtractedFields(updatedFields);
    
    // Mark field as manually validated
    setValidationStatus(prev => ({
      ...prev,
      [fieldName]: 'manually_validated'
    }));
  };

  const handleSave = async () => {
    try {
      const formValues = await form.validateFields();
      
      let updatedFields;
      
      if (extractedFields.length > 0) {
        // Update existing extracted fields
        updatedFields = extractedFields.map(field => ({
          ...field,
          field_value: formValues[field.field_name],
          validated: true,
          confidence_score: field.manually_corrected ? 100 : field.confidence_score
        }));
      } else {
        // Create fields from manual entry
        updatedFields = Object.keys(formValues).map(fieldName => ({
          field_name: fieldName,
          field_value: formValues[fieldName],
          confidence_score: 100, // Manual entry = 100% confidence
          validated: true,
          manually_corrected: true
        }));
      }

      await onSave({
        document_id: document.document_id,
        fields: updatedFields,
        overall_confidence: updatedFields.length > 0 ? Math.max(...updatedFields.map(f => f.confidence_score)) : 100,
        needs_manual_review: false
      });

      message.success('Document fields have been validated and saved successfully!');
      onClose();
      
    } catch (error) {
      console.error('Error saving fields:', error);
      message.error('Failed to save document fields. Please try again.');
    }
  };

  const handleReject = () => {
    Modal.confirm({
      title: 'Reject Document',
      content: 'Are you sure you want to reject this document? This action cannot be undone.',
      okText: 'Reject',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await onSave({
            document_id: document.document_id,
            fields: extractedFields,
            overall_confidence: 0,
            needs_manual_review: false,
            status: 'Rejected'
          });
          message.info('Document has been rejected.');
          onClose();
        } catch (error) {
          message.error('Failed to reject document.');
        }
      }
    });
  };

  if (!document) return null;

  const overallConfidence = extractedFields.length > 0 
    ? Math.round(extractedFields.reduce((sum, field) => sum + field.confidence_score, 0) / extractedFields.length)
    : 0;

  const needsReview = overallConfidence < 95;

  return (
    <Modal
      title={
        <Space>
          <EditOutlined />
          <span>Document Field Review</span>
          <Tag color={getConfidenceColor(overallConfidence)} icon={getConfidenceIcon(overallConfidence)}>
            {overallConfidence}% Confidence
          </Tag>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={800}
      centered
      maskClosable={false}
      destroyOnClose={true}
      zIndex={1000}
      footer={[
        <Button key="reject" danger onClick={handleReject}>
          <CloseOutlined /> Reject Document
        </Button>,
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button 
          key="save" 
          type="primary" 
          loading={loading}
          onClick={handleSave}
          icon={<SaveOutlined />}
        >
          Save & Validate
        </Button>
      ]}
    >
      <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {/* Document Info */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Text strong>Document:</Text> {document.file_name}
            </Col>
            <Col span={12}>
              <Text strong>Type:</Text> {document.document_type}
            </Col>
          </Row>
          <Row gutter={16} style={{ marginTop: 8 }}>
            <Col span={12}>
              <Text strong>Upload Date:</Text> {formatLocalDate(document.upload_date)}
            </Col>
            <Col span={12}>
              <Text strong>Status:</Text> 
              <Tag color={document.status === 'Extracted' ? 'blue' : 'default'} style={{ marginLeft: 8 }}>
                {document.status}
              </Tag>
            </Col>
          </Row>
        </Card>

        {/* Confidence Alert */}
        {needsReview && (
          <Alert
            message="Manual Review Required"
            description={`This document has a confidence score of ${overallConfidence}% which is below the 95% threshold. Please review and correct the extracted fields below.`}
            type="warning"
            icon={<WarningOutlined />}
            style={{ marginBottom: 16 }}
            showIcon
          />
        )}

        {!needsReview && (
          <Alert
            message="High Confidence Extraction"
            description={`This document has a confidence score of ${overallConfidence}% which meets the auto-approval threshold. You can review and save the fields directly.`}
            type="success"
            icon={<CheckCircleOutlined />}
            style={{ marginBottom: 16 }}
            showIcon
          />
        )}

        {/* Extracted Fields Form */}
        <Title level={4}>Extracted Fields</Title>
        <Form form={form} layout="vertical">
          {extractedFields.map((field, index) => (
            <Card 
              key={field.field_name || index}
              size="small" 
              style={{ marginBottom: 12 }}
              title={
                <Space>
                  <span>{field.field_name || `Field ${index + 1}`}</span>
                  <Tag 
                    color={getConfidenceColor(field.confidence_score)} 
                    icon={getConfidenceIcon(field.confidence_score)}
                  >
                    {field.confidence_score}%
                  </Tag>
                  {validationStatus[field.field_name] === 'manually_validated' && (
                    <Tag color="purple">Manually Corrected</Tag>
                  )}
                </Space>
              }
            >
              <Form.Item
                name={field.field_name}
                rules={[
                  { required: true, message: `Please provide a value for ${field.field_name}` }
                ]}
              >
                {field.field_name?.toLowerCase().includes('amount') ? (
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder={`Enter ${field.field_name}`}
                    onChange={(value) => handleFieldChange(field.field_name, value)}
                    formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={value => value.replace(/\$\s?|(,*)/g, '')}
                  />
                ) : field.field_name?.toLowerCase().includes('date') ? (
                  <Input
                    placeholder="YYYY-MM-DD or MM/DD/YYYY"
                    onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
                  />
                ) : field.field_name?.toLowerCase().includes('address') || 
                    field.field_value?.length > 50 ? (
                  <TextArea
                    rows={2}
                    placeholder={`Enter ${field.field_name}`}
                    onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
                  />
                ) : (
                  <Input
                    placeholder={`Enter ${field.field_name}`}
                    onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
                  />
                )}
              </Form.Item>
              
              {field.confidence_score < 95 && (
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  <WarningOutlined style={{ color: '#faad14', marginRight: 4 }} />
                  Low confidence - please verify this value
                </Text>
              )}
            </Card>
          ))}
        </Form>

        {extractedFields.length === 0 && (
          <div>
            <Alert
              message="No Fields Extracted"
              description="No fields were extracted from this document. Please add the required fields manually below."
              type="warning"
              style={{ marginTop: 16, marginBottom: 16 }}
            />
            
            {/* Manual field entry for common document types */}
            <Title level={5}>Add Document Fields Manually</Title>
            <Form form={form} layout="vertical">
              {document.document_type === 'ID Card' && (
                <>
                  <Form.Item name="full_name" label="Full Name" rules={[{ required: true }]}>
                    <Input placeholder="Enter full name from ID card" />
                  </Form.Item>
                  <Form.Item name="id_number" label="ID Number" rules={[{ required: true }]}>
                    <Input placeholder="Enter ID number" />
                  </Form.Item>
                  <Form.Item name="date_of_birth" label="Date of Birth" rules={[{ required: true }]}>
                    <Input placeholder="DD/MM/YYYY or MM/DD/YYYY" />
                  </Form.Item>
                  <Form.Item name="address" label="Address">
                    <TextArea rows={2} placeholder="Enter address from ID card" />
                  </Form.Item>
                </>
              )}
              
              {document.document_type === 'Passport' && (
                <>
                  <Form.Item name="full_name" label="Full Name" rules={[{ required: true }]}>
                    <Input placeholder="Enter full name from passport" />
                  </Form.Item>
                  <Form.Item name="passport_number" label="Passport Number" rules={[{ required: true }]}>
                    <Input placeholder="Enter passport number" />
                  </Form.Item>
                  <Form.Item name="nationality" label="Nationality" rules={[{ required: true }]}>
                    <Input placeholder="Enter nationality" />
                  </Form.Item>
                  <Form.Item name="date_of_birth" label="Date of Birth" rules={[{ required: true }]}>
                    <Input placeholder="DD/MM/YYYY or MM/DD/YYYY" />
                  </Form.Item>
                  <Form.Item name="expiry_date" label="Expiry Date" rules={[{ required: true }]}>
                    <Input placeholder="DD/MM/YYYY or MM/DD/YYYY" />
                  </Form.Item>
                </>
              )}
              
              {(document.document_type === 'Legal Registration' || 
                document.document_type === 'Business Registration') && (
                <>
                  <Form.Item name="company_name" label="Company Name" rules={[{ required: true }]}>
                    <Input placeholder="Enter company name" />
                  </Form.Item>
                  <Form.Item name="registration_number" label="Registration Number" rules={[{ required: true }]}>
                    <Input placeholder="Enter registration number" />
                  </Form.Item>
                  <Form.Item name="registration_date" label="Registration Date">
                    <Input placeholder="DD/MM/YYYY or MM/DD/YYYY" />
                  </Form.Item>
                  <Form.Item name="business_address" label="Business Address">
                    <TextArea rows={2} placeholder="Enter business address" />
                  </Form.Item>
                </>
              )}
              
              {document.document_type === 'Financial Statement' && (
                <>
                  <Form.Item name="company_name" label="Company Name" rules={[{ required: true }]}>
                    <Input placeholder="Enter company name" />
                  </Form.Item>
                  <Form.Item name="statement_period" label="Statement Period" rules={[{ required: true }]}>
                    <Input placeholder="e.g., Q1 2024, Year 2023" />
                  </Form.Item>
                  <Form.Item name="total_revenue" label="Total Revenue">
                    <InputNumber
                      style={{ width: '100%' }}
                      placeholder="Enter total revenue"
                      formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={value => value.replace(/\$\s?|(,*)/g, '')}
                    />
                  </Form.Item>
                  <Form.Item name="net_profit" label="Net Profit">
                    <InputNumber
                      style={{ width: '100%' }}
                      placeholder="Enter net profit"
                      formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={value => value.replace(/\$\s?|(,*)/g, '')}
                    />
                  </Form.Item>
                </>
              )}
            </Form>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default DocumentFieldReviewModal;