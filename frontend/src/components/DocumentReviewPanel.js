import React, { useState } from 'react';
import {
  Row,
  Col,
  Form,
  Input,
  Button,
  Alert,
  Space,
  Typography,
  message,
  Spin,
  Card
} from 'antd';
import { SaveOutlined, WarningOutlined } from '@ant-design/icons';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';

const { Text, Title } = Typography;

/**
 * Document Review Panel Component
 * Shows document preview on LEFT and editable extracted fields on RIGHT
 */
const DocumentReviewPanel = ({ document, onSave, onCancel, token }) => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  // Parse extracted data from document
  const extractedData = document.ocr_extracted_json?.extracted_fields || 
                       document.ocr_extracted_json?.corrected_data || 
                       {};
  
  const confidenceScore = document.confidence_score || 0;
  const needsReview = document.needs_manual_review;

  // Initialize form with extracted data
  React.useEffect(() => {
    const formValues = {};
    Object.entries(extractedData).forEach(([key, field]) => {
      // Handle both object format {value: "...", confidence: 0.95} and simple string
      formValues[key] = typeof field === 'object' ? field.value : field;
    });
    form.setFieldsValue(formValues);
  }, [extractedData, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      // Call API to save corrections
      const response = await fetch(buildApiUrl(API_ENDPOINTS.VALIDATE_EXTRACTION, `/${document.document_id}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          correctedData: values,
          validatedBy: document.upload_user_id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save corrections');
      }

      message.success('Document corrections saved successfully!');
      
      if (onSave) {
        onSave(values);
      }
    } catch (error) {
      console.error('Error saving corrections:', error);
      message.error('Failed to save corrections: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
      {/* Header with confidence score */}
      {needsReview && (
        <Alert
          message={
            <Space>
              <WarningOutlined />
              <Text strong>Manual Review Required - Confidence: {confidenceScore.toFixed(1)}%</Text>
            </Space>
          }
          description="The confidence score is below 95%. Please review the extracted information and correct any errors."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {!needsReview && (
        <Alert
          message={`Extraction Confidence: ${confidenceScore.toFixed(1)}%`}
          description="The data was extracted with high confidence. You can still review and edit if needed."
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Split View: Document LEFT, Fields RIGHT */}
      <Row gutter={16} style={{ flex: 1, overflow: 'hidden' }}>
        {/* LEFT: Document Preview */}
        <Col span={12} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Card 
            title="Document Preview" 
            size="small"
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            bodyStyle={{ flex: 1, overflow: 'auto', padding: 0 }}
          >
            {document.ss_uri ? (
              <div style={{ 
                width: '100%', 
                height: '100%', 
                display: 'flex', 
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: '#f5f5f5',
                padding: '8px'
              }}>
                {document.ss_uri.toLowerCase().endsWith('.pdf') ? (
                  // PDF viewer
                  <iframe
                    src={`${document.ss_uri}#toolbar=0`}
                    title="Document Preview"
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none'
                    }}
                  />
                ) : (
                  // Image viewer
                  <img
                    src={document.ss_uri}
                    alt="Document"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain'
                    }}
                  />
                )}
              </div>
            ) : (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                height: '100%',
                color: '#999'
              }}>
                <Text type="secondary">No document preview available</Text>
              </div>
            )}
          </Card>
        </Col>

        {/* RIGHT: Extracted Fields (Editable) */}
        <Col span={12} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Card 
            title="Extracted Information" 
            size="small"
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            bodyStyle={{ flex: 1, overflow: 'auto' }}
          >
            {Object.keys(extractedData).length > 0 ? (
              <Form
                form={form}
                layout="vertical"
                style={{ height: '100%' }}
              >
                {Object.entries(extractedData).map(([key, field]) => {
                  const value = typeof field === 'object' ? field.value : field;
                  const fieldConfidence = typeof field === 'object' ? field.confidence : null;
                  
                  // Show warning for low confidence fields
                  const isLowConfidence = fieldConfidence && fieldConfidence < 95;
                  
                  return (
                    <Form.Item
                      key={key}
                      name={key}
                      label={
                        <Space>
                          <Text>{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</Text>
                          {isLowConfidence && (
                            <WarningOutlined style={{ color: '#faad14' }} title="Low confidence field" />
                          )}
                        </Space>
                      }
                      initialValue={value}
                    >
                      <Input
                        placeholder={`Enter ${key.replace(/_/g, ' ')}`}
                        size="large"
                      />
                    </Form.Item>
                  );
                })}
              </Form>
            ) : (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                height: '100%'
              }}>
                <Text type="secondary">No extracted data available</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Action Buttons */}
      <div style={{ 
        marginTop: 16, 
        textAlign: 'right', 
        borderTop: '1px solid #f0f0f0', 
        paddingTop: 16 
      }}>
        <Space>
          <Button onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
            disabled={Object.keys(extractedData).length === 0}
          >
            {saving ? 'Saving...' : 'Save Corrections'}
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default DocumentReviewPanel;

