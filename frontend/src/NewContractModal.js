import React, { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  Steps,
  Upload,
  Select,
  InputNumber,
  Space,
  Card,
  List,
  Typography,
  message,
  Divider,
  Progress,
  Tag,
  Spin
} from 'antd';
import {
  InboxOutlined,
  FileTextOutlined,
  DollarOutlined,
  HomeOutlined,
  UserOutlined,
  DeleteOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { useAuth } from './contexts/AuthContext';

const { Dragger } = Upload;
const { Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const NewContractModal = ({ visible, onCancel, onSuccess }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [contractForm] = Form.useForm();
  const [documentForm] = Form.useForm();
  const [fileList, setFileList] = useState([]);
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [contractData, setContractData] = useState(null);
  const [autoCreating, setAutoCreating] = useState(false);
  const { user, token } = useAuth();

  // Generate unique contract number
  const generateContractNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const time = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
    return `CT-${year}${month}${day}-${time}`;
  };

  // Auto-create draft contract when modal opens
  React.useEffect(() => {
    const autoCreateDraftContract = async () => {
      if (visible && !contractData && !autoCreating) {
        setAutoCreating(true);
        setLoading(true);
        
        try {
          const contractNumber = generateContractNumber();
          console.log('Auto-creating draft contract:', contractNumber);
          
          const response = await fetch('http://localhost:3001/contracts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              contract_number: contractNumber,
              customer_name: 'Draft Contract',
              property_address: 'To be updated',
              loan_amount: 0,
              generated_by: user.user_id
            })
          });

          if (!response.ok) {
            throw new Error('Failed to create draft contract');
          }

          const contract = await response.json();
          console.log('Draft contract created:', contract);
          setContractData(contract);
          
          // Start at upload step (step 0 in new flow)
          setCurrentStep(0);
          
          message.success('Contract created! Please upload documents.');
        } catch (error) {
          console.error('Error creating draft contract:', error);
          message.error('Failed to create contract: ' + error.message);
          onCancel(); // Close modal on error
        } finally {
          setLoading(false);
          setAutoCreating(false);
        }
      }
    };

    autoCreateDraftContract();
  }, [visible, contractData, autoCreating, token, user, onCancel]);

  const steps = [
    {
      title: 'Upload Documents',
      content: 'Upload and extract documents',
      icon: <InboxOutlined />
    },
    {
      title: 'Review & Complete',
      content: 'Review uploaded documents',
      icon: <CheckCircleOutlined />
    }
  ];

  const documentTypes = [
    { value: 'ID Card', label: 'ID Card' },
    { value: 'Passport', label: 'Passport' },
    { value: 'Legal Registration', label: 'Legal Registration' },
    { value: 'Business Registration', label: 'Business Registration' },
    { value: 'Financial Statement', label: 'Financial Statement' }
  ];

  const handleContractSubmit = async (values) => {
    try {
      setLoading(true);
      
      console.log('Creating contract with values:', values);
      
      const response = await fetch('http://localhost:3001/contracts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...values,
          generated_by: user.user_id
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        
        if (errorData.error && errorData.error.includes('duplicate key value violates unique constraint')) {
          if (errorData.error.includes('contract_number')) {
            // Auto-generate a new contract number and suggest retry
            const newNumber = generateContractNumber();
            contractForm.setFieldsValue({ contract_number: newNumber });
            throw new Error('Contract number already exists. A new unique number has been generated. Please try again.');
          }
        }
        
        throw new Error(`Failed to create contract: ${errorData.error || 'Unknown error'}`);
      }

      const contract = await response.json();
      console.log('Contract created successfully:', contract);
      setContractData(contract);
      message.success('Contract created successfully! You can now upload documents.');
      
      // Move to next step
      setTimeout(() => {
        setCurrentStep(1);
      }, 500);
      
    } catch (error) {
      console.error('Error creating contract:', error);
      message.error('Failed to create contract: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const uploadProps = {
    name: 'file',
    multiple: true,
    showUploadList: false,
    beforeUpload: (file) => {
      console.log('File added to upload queue:', file.name, file);
      setFileList(prev => [...prev, { 
        file, 
        status: 'ready', 
        uid: file.uid,
        type: 'ID Card' // default type
      }]);
      return false; // Prevent automatic upload
    },
    onRemove: (file) => {
      setFileList(prev => prev.filter(item => item.uid !== file.uid));
    }
  };

  const handleDocumentUpload = (fileItem) => {
    return new Promise((resolve, reject) => {
      if (!contractData) {
        message.error('Please create contract first');
        reject(new Error('No contract data'));
        return;
      }

      if (!fileItem.file) {
        message.error('No file selected for upload');
        reject(new Error('No file selected'));
        return;
      }

      try {
        console.log('Preparing upload for:', fileItem.file.name, 'Size:', fileItem.file.size, 'Type:', fileItem.type);
        
        const formData = new FormData();
        formData.append('file', fileItem.file);
        formData.append('document_type', fileItem.type || 'ID Card');
        formData.append('user_id', user.user_id);

        setUploadProgress(prev => ({ ...prev, [fileItem.uid]: 0 }));
        
        const xhr = new XMLHttpRequest();
        
        // Set timeout to 30 seconds
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
            
            // Check if the response indicates success
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
                contract_id: contractData.contract_id
              })
            });

            if (!linkResponse.ok) {
              const linkError = await linkResponse.json();
              throw new Error(`Failed to link document: ${linkError.error || 'Unknown error'}`);
            }

            setUploadedDocuments(prev => [...prev, {
              ...result,
              type: fileItem.type,
              name: fileItem.file.name
            }]);
            
            setFileList(prev => prev.map(item => 
              item.uid === fileItem.uid 
                ? { ...item, status: 'done', document_id: result.document_id }
                : item
            ));
            
            // Show appropriate message based on extraction results
            if (result.status === 'Extracted') {
              if (result.needs_manual_review) {
                message.warning({
                  content: `${fileItem.file.name} uploaded and extracted (Confidence: ${result.confidence_score?.toFixed(1)}%). Manual review required.`,
                  duration: 5
                });
              } else {
                message.success({
                  content: `${fileItem.file.name} uploaded and extracted successfully (Confidence: ${result.confidence_score?.toFixed(1)}%)!`,
                  duration: 5
                });
              }
            } else if (result.status === 'Processing') {
              message.info(`${fileItem.file.name} uploaded. OCR processing in progress...`);
            } else {
              message.success(`${fileItem.file.name} uploaded and linked successfully!`);
            }
            
            resolve(result);
          } catch (parseError) {
            console.error('Error parsing upload response:', parseError);
            message.error(`Upload processing failed: ${parseError.message}`);
            setFileList(prev => prev.map(item => 
              item.uid === fileItem.uid 
                ? { ...item, status: 'error' }
                : item
            ));
            reject(parseError);
          }
        } else {
          // Handle HTTP error status codes
          let errorMessage = 'Upload failed';
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            errorMessage = errorResponse.error || errorResponse.message || errorMessage;
          } catch (e) {
            errorMessage = `HTTP ${xhr.status}: ${xhr.statusText}`;
          }
          
          message.error(`Upload failed: ${errorMessage}`);
          setFileList(prev => prev.map(item => 
            item.uid === fileItem.uid 
              ? { ...item, status: 'error' }
              : item
          ));
          reject(new Error(errorMessage));
        }
        setUploadProgress(prev => ({ ...prev, [fileItem.uid]: 100 }));
      };

      xhr.onerror = (event) => {
        console.error('XMLHttpRequest error:', event);
        message.error(`Network error while uploading ${fileItem.file.name}. Please check your connection.`);
        setFileList(prev => prev.map(item => 
          item.uid === fileItem.uid 
            ? { ...item, status: 'error' }
            : item
        ));
        setUploadProgress(prev => ({ ...prev, [fileItem.uid]: 0 }));
        reject(new Error('Network error'));
      };

      xhr.ontimeout = () => {
        console.error('XMLHttpRequest timeout');
        message.error(`Upload timeout for ${fileItem.file.name}. Please try again.`);
        setFileList(prev => prev.map(item => 
          item.uid === fileItem.uid 
            ? { ...item, status: 'error' }
            : item
        ));
        setUploadProgress(prev => ({ ...prev, [fileItem.uid]: 0 }));
        reject(new Error('Upload timeout'));
      };

      xhr.open('POST', 'http://localhost:3001/upload');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      
      console.log('Starting upload for:', fileItem.file.name, 'Type:', fileItem.type);
      xhr.send(formData);

      } catch (error) {
        console.error('Upload error:', error);
        message.error(`Failed to upload ${fileItem.file.name}: ${error.message}`);
        setFileList(prev => prev.map(item => 
          item.uid === fileItem.uid 
            ? { ...item, status: 'error' }
            : item
        ));
        reject(error);
      }
    });
  };

  const handleUploadAll = async () => {
    const pendingUploads = fileList.filter(item => item.status === 'ready');
    
    console.log('Starting upload for', pendingUploads.length, 'files');
    
    for (const fileItem of pendingUploads) {
      // Mark as uploading
      setFileList(prev => prev.map(item => 
        item.uid === fileItem.uid 
          ? { ...item, status: 'uploading' }
          : item
      ));
      
      await handleDocumentUpload(fileItem);
    }
  };

  const updateDocumentType = (uid, type) => {
    setFileList(prev => prev.map(item => 
      item.uid === uid ? { ...item, type } : item
    ));
  };

  const removeFile = (uid) => {
    setFileList(prev => prev.filter(item => item.uid !== uid));
  };

  const handleFinish = async () => {
    // Validate that at least one document has been uploaded and linked
    const uploadedDocs = uploadedDocuments.filter(doc => doc.document_id);
    
    if (uploadedDocs.length === 0) {
      message.error('Please upload at least one document before completing the contract creation.');
      return;
    }

    // Additional validation to ensure all uploaded documents are properly linked
    const successfulUploads = fileList.filter(item => item.status === 'done' && item.document_id);
    
    if (successfulUploads.length === 0) {
      message.error('No documents have been successfully uploaded and linked to this contract.');
      return;
    }

    try {
      setLoading(true);
      
      // Call backend validation endpoint
      const response = await fetch(`http://localhost:3001/contracts/${contractData.contract_id}/validate`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Contract validation failed');
      }

      const result = await response.json();
      message.success(`Contract completed successfully! ${result.document_count} document(s) verified and attached.`);
      onSuccess();
      handleCancel();
    } catch (error) {
      console.error('Contract validation error:', error);
      message.error(`Failed to complete contract: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setCurrentStep(0);
    setContractData(null);
    setFileList([]);
    setUploadedDocuments([]);
    setUploadProgress({});
    setAutoCreating(false);
    contractForm.resetFields();
    documentForm.resetFields();
    onCancel();
  };

  const renderContractForm = () => (
    <Form
      form={contractForm}
      layout="vertical"
      onFinish={handleContractSubmit}
    >
      <Form.Item
        label="Contract Number"
        name="contract_number"
        rules={[{ required: true, message: 'Please enter contract number' }]}
      >
        <Input 
          prefix={<FileTextOutlined />} 
          placeholder="Auto-generated unique number"
          readOnly
          addonAfter={
            <Button 
              type="link" 
              onClick={() => {
                const newNumber = generateContractNumber();
                contractForm.setFieldsValue({ contract_number: newNumber });
              }}
              style={{ padding: '0 8px', height: '100%' }}
            >
              Generate New
            </Button>
          }
        />
      </Form.Item>

      <Form.Item
        label="Customer Name"
        name="customer_name"
        rules={[{ required: true, message: 'Please enter customer name' }]}
      >
        <Input prefix={<UserOutlined />} placeholder="Full customer name" />
      </Form.Item>

      <Form.Item
        label="Property Address"
        name="property_address"
        rules={[{ required: true, message: 'Please enter property address' }]}
      >
        <TextArea 
          prefix={<HomeOutlined />} 
          placeholder="Complete property address"
          rows={3}
        />
      </Form.Item>

      <Form.Item
        label="Loan Amount"
        name="loan_amount"
        rules={[{ required: true, message: 'Please enter loan amount' }]}
      >
        <InputNumber
          prefix={<DollarOutlined />}
          style={{ width: '100%' }}
          placeholder="0.00"
          min={0}
          step={1000}
          formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={value => value.replace(/\$\s?|(,*)/g, '')}
        />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block>
          {loading ? 'Creating Contract...' : 'Create Contract & Continue'}
        </Button>
      </Form.Item>
    </Form>
  );

  const renderDocumentUpload = () => (
    <div>
      <Card title="Upload Supporting Documents" style={{ marginBottom: 16 }}>
        <Dragger {...uploadProps}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">Click or drag files to this area to upload</p>
          <p className="ant-upload-hint">
            Support for single or bulk upload. Upload property documents, financial records, etc.
          </p>
        </Dragger>
      </Card>

      {fileList.length > 0 && (
        <Card title="Selected Documents" style={{ marginBottom: 16 }}>
          <List
            dataSource={fileList}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button 
                    type="link" 
                    danger 
                    icon={<DeleteOutlined />}
                    onClick={() => removeFile(item.uid)}
                  >
                    Remove
                  </Button>
                ]}
              >
                <List.Item.Meta
                  avatar={<FileTextOutlined style={{ fontSize: 24 }} />}
                  title={item.file.name}
                  description={
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Select
                        value={item.type}
                        onChange={(value) => updateDocumentType(item.uid, value)}
                        style={{ width: '100%' }}
                        placeholder="Select document type"
                      >
                        {documentTypes.map(type => (
                          <Option key={type.value} value={type.value}>
                            {type.label}
                          </Option>
                        ))}
                      </Select>
                      {uploadProgress[item.uid] !== undefined && (
                        <Progress 
                          percent={uploadProgress[item.uid]} 
                          status={item.status === 'error' ? 'exception' : 'active'}
                          size="small"
                        />
                      )}
                      {item.status === 'done' && (
                        <Tag color="green" icon={<CheckCircleOutlined />}>
                          Uploaded
                        </Tag>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
          <Divider />
          <Button 
            type="primary" 
            block 
            onClick={handleUploadAll}
            disabled={fileList.filter(item => item.status === 'ready').length === 0}
            loading={fileList.some(item => item.status === 'uploading')}
          >
            {fileList.some(item => item.status === 'uploading') 
              ? 'Uploading...' 
              : `Upload ${fileList.filter(item => item.status === 'ready').length} Document(s)`
            }
          </Button>
        </Card>
      )}

      <Space>
        <Button 
          type="primary" 
          onClick={() => setCurrentStep(1)}
          disabled={uploadedDocuments.filter(doc => doc.document_id).length === 0}
        >
          {uploadedDocuments.filter(doc => doc.document_id).length === 0 
            ? 'Upload Documents to Continue' 
            : 'Continue to Review'
          }
        </Button>
      </Space>
    </div>
  );

  const renderReview = () => (
    <div>
      <Card title="Contract Summary" style={{ marginBottom: 16 }}>
        {contractData && (
          <div>
            <Text strong>Contract Number:</Text> {contractData.contract_number}<br />
            <Text strong>Customer:</Text> {contractData.customer_name}<br />
            <Text strong>Property:</Text> {contractData.property_address}<br />
            <Text strong>Loan Amount:</Text> ${contractData.loan_amount?.toLocaleString()}<br />
            <Text strong>Status:</Text> <Tag color="blue">{contractData.status}</Tag><br />
            <Text strong>Approval Stage:</Text> <Tag color="orange">{contractData.current_approval_stage}</Tag>
          </div>
        )}
      </Card>

      <Card title="Document Extraction Results" style={{ marginBottom: 16 }}>
        {uploadedDocuments.filter(doc => doc.document_id).length > 0 ? (
          <>
            <List
              dataSource={uploadedDocuments.filter(doc => doc.document_id)}
              renderItem={(item) => (
                <List.Item
                  style={{
                    border: item.needs_manual_review ? '1px solid #faad14' : '1px solid #d9d9d9',
                    padding: 16,
                    marginBottom: 12,
                    borderRadius: 8,
                    backgroundColor: item.needs_manual_review ? '#fffbf0' : '#ffffff'
                  }}
                >
                  <List.Item.Meta
                    avatar={
                      item.needs_manual_review ? (
                        <CheckCircleOutlined style={{ fontSize: 24, color: '#faad14' }} />
                      ) : (
                        <CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />
                      )
                    }
                    title={
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        <Text strong>{item.name}</Text>
                        <Space>
                          <Tag color="blue">{item.type}</Tag>
                          {item.status === 'Extracted' && item.confidence_score !== undefined && (
                            <>
                              {item.needs_manual_review ? (
                                <Tag color="warning" icon={<CheckCircleOutlined />}>
                                  Extracted - Confidence: {item.confidence_score?.toFixed(1)}%
                                </Tag>
                              ) : (
                                <Tag color="success" icon={<CheckCircleOutlined />}>
                                  Extracted - Confidence: {item.confidence_score?.toFixed(1)}%
                                </Tag>
                              )}
                            </>
                          )}
                          {item.status === 'Processing' && (
                            <Tag color="processing">Processing...</Tag>
                          )}
                          {!item.status || item.status === 'Uploaded' && (
                            <Tag color="default">Uploaded</Tag>
                          )}
                        </Space>
                      </Space>
                    }
                    description={
                      <div style={{ marginTop: 8 }}>
                        {item.needs_manual_review && (
                          <div style={{ 
                            padding: 8, 
                            backgroundColor: '#fff7e6', 
                            border: '1px solid #ffd591',
                            borderRadius: 4,
                            marginBottom: 8
                          }}>
                            <Text type="warning" strong>⚠️ Manual Review Required</Text>
                            <br />
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                              Confidence score is below 95%. Please review extracted information after completing contract creation.
                            </Text>
                          </div>
                        )}
                        
                        {item.extracted_data && Object.keys(item.extracted_data).length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <Text strong style={{ fontSize: '12px' }}>Extracted Information:</Text>
                            <div style={{ 
                              marginTop: 4, 
                              padding: 8, 
                              backgroundColor: '#f5f5f5',
                              borderRadius: 4,
                              fontSize: '12px'
                            }}>
                              {Object.entries(item.extracted_data).slice(0, 5).map(([key, value]) => {
                                const displayValue = typeof value === 'object' ? value.value : value;
                                return (
                                  <div key={key} style={{ marginBottom: 4 }}>
                                    <Text type="secondary">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</Text>{' '}
                                    <Text>{displayValue || 'N/A'}</Text>
                                  </div>
                                );
                              })}
                              {Object.keys(item.extracted_data).length > 5 && (
                                <Text type="secondary" style={{ fontStyle: 'italic' }}>
                                  ... and {Object.keys(item.extracted_data).length - 5} more fields
                                </Text>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {item.status === 'Extracted' && !item.needs_manual_review && (
                          <div style={{ 
                            marginTop: 8,
                            padding: 8, 
                            backgroundColor: '#f6ffed', 
                            border: '1px solid #b7eb8f',
                            borderRadius: 4
                          }}>
                            <Text type="success" style={{ fontSize: '12px' }}>
                              ✅ High confidence extraction - No manual review required
                            </Text>
                          </div>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
            <div style={{ marginTop: 16, padding: 12, backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6 }}>
              <Text type="success">
                ✅ {uploadedDocuments.filter(doc => doc.document_id).length} document(s) successfully processed
              </Text>
              {uploadedDocuments.some(doc => doc.needs_manual_review) && (
                <>
                  <br />
                  <Text type="warning">
                    ⚠️ {uploadedDocuments.filter(doc => doc.needs_manual_review).length} document(s) require manual review
                  </Text>
                </>
              )}
            </div>
          </>
        ) : (
          <div style={{ padding: 20, textAlign: 'center', backgroundColor: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 6 }}>
            <Text type="danger" style={{ fontSize: 16 }}>
              ⚠️ No documents are attached to this contract
            </Text>
            <br />
            <Text type="secondary">
              You must upload at least one document before completing the contract creation.
            </Text>
          </div>
        )}
      </Card>

      <Space>
        <Button onClick={() => setCurrentStep(0)}>Back to Documents</Button>
        <Button 
          type="primary" 
          onClick={handleFinish}
          disabled={uploadedDocuments.filter(doc => doc.document_id).length === 0}
        >
          {uploadedDocuments.filter(doc => doc.document_id).length === 0 
            ? 'Upload Documents Required' 
            : 'Complete Contract Creation'
          }
        </Button>
      </Space>
    </div>
  );

  return (
    <Modal
      title="Create New Contract"
      open={visible}
      onCancel={handleCancel}
      footer={null}
      width={800}
      destroyOnClose
    >
      <Steps current={currentStep} style={{ marginBottom: 24 }}>
        {steps.map((step, index) => (
          <Steps.Step
            key={index}
            title={step.title}
            description={step.content}
            icon={step.icon}
          />
        ))}
      </Steps>

      <div style={{ minHeight: 400 }}>
        {loading && !contractData ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <Spin size="large" />
            <p style={{ marginTop: 16 }}>Creating contract...</p>
          </div>
        ) : (
          <>
            {currentStep === 0 && renderDocumentUpload()}
            {currentStep === 1 && renderReview()}
          </>
        )}
      </div>
    </Modal>
  );
};

export default NewContractModal;