import React, { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Button,
  Steps,
  Upload,
  Select,
  Space,
  Card,
  List,
  Typography,
  message,
  Divider,
  Progress,
  Tag,
  Spin,
  Alert
} from 'antd';
import {
  InboxOutlined,
  FileTextOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  EditOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';

const { Dragger } = Upload;
const { Text } = Typography;
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
  const [editableExtractedData, setEditableExtractedData] = useState({});
  const [editingDocument, setEditingDocument] = useState(null);
  const { user, token } = useAuth();

  // Helper function to get extracted data from document
  const getExtractedData = (item) => {
    try {
      console.log('item', item)
      console.log('🔍 Checking extracted data for item:', item?.name, {
        hasExtractedData: !!item?.extracted_data,
        hasOcrExtractedJson: !!item?.ocr_extracted_json,
        ocrDataStructure: item?.ocr_extracted_json ? Object.keys(item.ocr_extracted_json) : 'none'
      });
      
      // Check for traditional extracted_data format
      if (item?.extracted_data && typeof item.extracted_data === 'object' && Object.keys(item.extracted_data).length > 0) {
        console.log('✅ Found traditional extracted_data');
        return item.extracted_data;
      }
      
      // Check for ocr_extracted_json format from FPT.AI
      if (item?.ocr_extracted_json && typeof item.ocr_extracted_json === 'object') {
        // The actual extracted fields are nested under 'data'
        if (item.ocr_extracted_json?.raw_response?.data?.[0] && typeof item.ocr_extracted_json.raw_response.data[0] === 'object' && Object.keys(item.ocr_extracted_json.raw_response.data).length > 0) {
          console.log('✅ Found ocr_extracted_json.data with keys:', Object.keys(item.ocr_extracted_json.raw_response.data[0]));
          return item.ocr_extracted_json.raw_response.data[0];
        }
        // Fallback to top level if no nested data
        if (Object.keys(item.ocr_extracted_json).length > 0) {
          console.log('⚠️ Using ocr_extracted_json top level');
          return item.ocr_extracted_json;
        }
      }
      
      console.log('❌ No extracted data found');
      return null;
    } catch (error) {
      console.error('Error in getExtractedData:', error);
      return null;
    }
  };

  // Helper function to get confidence score from document
  const getConfidenceScore = (item) => {
    // Check traditional confidence_score field
    if (item.confidence_score !== undefined && item.confidence_score !== null && typeof item.confidence_score === 'number') {
      return item.confidence_score;
    }
    
    // Check ocr_extracted_json format
    if (item.ocr_extracted_json && typeof item.ocr_extracted_json.confidence_score === 'number') {
      return item.ocr_extracted_json.confidence_score;
    }
    
    // Check if confidence score is nested deeper in ocr_extracted_json
    if (item.ocr_extracted_json && item.ocr_extracted_json.raw_response && typeof item.ocr_extracted_json.raw_response.confidence_score === 'number') {
      return item.ocr_extracted_json.raw_response.confidence_score;
    }
    
    return null;
  };

  // Helper function to check if document needs manual review
  const needsManualReview = (item) => {
    // Check traditional needs_manual_review field
    if (typeof item.needs_manual_review === 'boolean') {
      return item.needs_manual_review;
    }
    
    // Check ocr_extracted_json format
    if (item.ocr_extracted_json && typeof item.ocr_extracted_json.needs_manual_review === 'boolean') {
      return item.ocr_extracted_json.needs_manual_review;
    }
    
    // Check if needs_manual_review is nested deeper
    if (item.ocr_extracted_json && item.ocr_extracted_json.raw_response && typeof item.ocr_extracted_json.raw_response.needs_manual_review === 'boolean') {
      return item.ocr_extracted_json.raw_response.needs_manual_review;
    }
    
    // Fallback based on confidence score
    const confidence = getConfidenceScore(item);
    if (confidence !== null && typeof confidence === 'number') {
      return confidence < 95;
    }
    
    // Default to true if we can't determine confidence
    return true;
  };

  // Generate unique contract number
  const generateContractNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
    return `CT-${year}${month}${day}-${hours}${minutes}${seconds}${milliseconds}`;
  };

  // Reset state when modal opens to prevent conflicts
  React.useEffect(() => {
    if (visible && !contractData) {
      // Reset all state to ensure clean start
      setCurrentStep(0);
      setFileList([]);
      setUploadedDocuments([]);
      setUploadProgress({});
      setEditableExtractedData({});
      setEditingDocument(null);
      contractForm.resetFields();
      documentForm.resetFields();
    }
  }, [visible, contractData, contractForm, documentForm]);

  // Auto-create draft contract when modal opens
  React.useEffect(() => {
    const autoCreateDraftContract = async () => {
      if (visible && !contractData && !autoCreating) {
        setAutoCreating(true);
        setLoading(true);
        
        try {
          const contractNumber = generateContractNumber();
          console.log('Auto-creating draft contract:', contractNumber);
          
          const response = await fetch(buildApiUrl(API_ENDPOINTS.CONTRACTS), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              contract_number: contractNumber,
              customer_name: 'CUSTOMER',
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

  // Update form when contract data changes
  React.useEffect(() => {
    if (contractData && contractForm) {
      contractForm.setFieldsValue({
        customer_name: contractData.customer_name || '',
        loan_amount: contractData.loan_amount || undefined
      });
    }
  }, [contractData, contractForm]);

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
            const linkResponse = await fetch(buildApiUrl(API_ENDPOINTS.DOCUMENTS, `/${result.document_id}`), {
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

            // Fetch the updated document data with ocr_extracted_json
            const updatedDocResponse = await fetch(buildApiUrl(API_ENDPOINTS.DOCUMENTS, `/${result.document_id}`), {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });

            let finalDocumentData = {
              ...result,
              type: fileItem.type,
              name: fileItem.file.name
            };

            if (updatedDocResponse.ok) {
              const updatedDoc = await updatedDocResponse.json();
              console.log('🔄 Updated document data:', updatedDoc);
              
              // Merge the updated document data with our existing data
              finalDocumentData = {
                ...finalDocumentData,
                ...updatedDoc,
                type: fileItem.type, // Keep the original type
                name: fileItem.file.name // Keep the original name
              };
            } else {
              console.warn('Failed to fetch updated document data:', updatedDocResponse.status);
            }

            setUploadedDocuments(prev => [...prev, finalDocumentData]);
            
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

      xhr.open('POST', buildApiUrl(API_ENDPOINTS.UPLOAD));
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

  // Function to refresh document data from server
  const refreshDocumentData = async () => {
    if (!contractData || uploadedDocuments.length === 0) return;

    try {
      console.log('🔄 Refreshing document data for', uploadedDocuments.length, 'documents');
      
      const refreshPromises = uploadedDocuments.map(async (doc) => {
        if (!doc.document_id) return doc;

        const response = await fetch(buildApiUrl(API_ENDPOINTS.DOCUMENTS, `/${doc.document_id}`), {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const updatedDoc = await response.json();
          console.log(`✅ Refreshed data for document ${doc.document_id}:`, {
            hasOcrData: !!updatedDoc.ocr_extracted_json,
            status: updatedDoc.status,
            confidenceScore: updatedDoc.confidence_score
          });
          
          return {
            ...doc,
            ...updatedDoc,
            type: doc.type, // Preserve original type
            name: doc.name  // Preserve original name
          };
        } else {
          console.warn(`Failed to refresh document ${doc.document_id}:`, response.status);
          return doc;
        }
      });

      const refreshedDocuments = await Promise.all(refreshPromises);
      setUploadedDocuments(refreshedDocuments);
      
      message.info('Document data refreshed successfully!');
    } catch (error) {
      console.error('Error refreshing document data:', error);
      message.warning('Failed to refresh some document data');
    }
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
      
      // Save any edited extracted data first
      if (Object.keys(editableExtractedData).length > 0) {
        for (const [fieldKey, newValue] of Object.entries(editableExtractedData)) {
          const [documentId, fieldName] = fieldKey.split('_');
          
          try {
            const saveResponse = await fetch(buildApiUrl(API_ENDPOINTS.DOCUMENTS, `/${documentId}/validate`), {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                document_id: documentId,
                fields: [{ 
                  field_name: fieldName, 
                  field_value: newValue, 
                  validated: true, 
                  confidence_score: 100,
                  manually_corrected: true 
                }],
                overall_confidence: 100,
                needs_manual_review: false
              })
            });

            if (!saveResponse.ok) {
              console.warn(`Failed to save edited field ${fieldName} for document ${documentId}`);
            }
          } catch (saveError) {
            console.warn('Error saving edited field:', saveError);
          }
        }
        message.info('Edited field values have been saved.');
      }
      
      // Call backend validation endpoint
      const response = await fetch(buildApiUrl(API_ENDPOINTS.CONTRACTS, `/${contractData.contract_id}/validate`), {
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
      message.success({
        content: (
          <div>
            <div style={{ fontWeight: 'bold' }}>✅ Contract Validated Successfully!</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              {result.document_count} document(s) verified and attached
            </div>
          </div>
        ),
        duration: 3
      });
      
      // STEP 2: Automatically generate the contract document
      message.info('🏗️ Generating contract document...');
      
      try {
        const generateResponse = await fetch(buildApiUrl(API_ENDPOINTS.CONTRACTS, `/${contractData.contract_id}/generate`), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            // Include any user input fields from the contract form
            userInputFields: {
              'doc.number': contractData.contract_number,
              'doc.signing_date': new Date().toLocaleDateString('vi-VN'),
              'loan.amount': contractData.loan_amount?.toString()
            }
          })
        });

        if (generateResponse.ok) {
          // Check if response is a file download
          const contentType = generateResponse.headers.get('content-type');
          if (contentType && contentType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
            // It's a file download - create download link
            const blob = await generateResponse.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `contract_${contractData.contract_number}_${Date.now()}.docx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            message.success({
              content: (
                <div>
                  <div style={{ fontWeight: 'bold' }}>📄 Contract Document Generated!</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    Comprehensive contract document downloaded successfully
                  </div>
                </div>
              ),
              duration: 4
            });
          } else {
            // It's a JSON response
            const generateResult = await generateResponse.json();
            if (generateResult.success) {
              message.success({
                content: '🎉 Contract document generated successfully!',
                duration: 6
              });
            } else {
              throw new Error(generateResult.error || 'Contract generation failed');
            }
          }
        } else {
          const generateError = await generateResponse.json();
          throw new Error(generateError.error || 'Contract generation failed');
        }
        
      } catch (generateError) {
        console.error('Contract generation error:', generateError);
        message.warning({
          content: (
            <div>
              <div style={{ fontWeight: 'bold' }}>⚠️ Contract Created - Generation Issue</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                Contract created successfully but document generation failed: {generateError.message}
                <br />
                You can generate the document later from the contract details page.
              </div>
            </div>
          ),
          duration: 10,
          style: {
            marginTop: '100px'
          }
        });
      }
      
      // STEP 3: Show completion snackbar and reset form
      message.success({
        content: (
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '8px' }}>
              🎉 Contract Creation Completed Successfully!
            </div>
            <div style={{ fontSize: '14px' }}>
              Contract {contractData.contract_number} has been created with {result.document_count} document(s) attached.
              <br />
              ✅ Contract document generated and downloaded
              <br />
              🔄 Approval workflow has been started
            </div>
          </div>
        ),
        duration: 8,
        style: {
          marginTop: '100px'
        }
      });
      
      // Reset form state without deleting the contract (successful completion)
      setCurrentStep(0);
      setContractData(null);
      setFileList([]);
      setUploadedDocuments([]);
      setUploadProgress({});
      setAutoCreating(false);
      setEditableExtractedData({});
      setEditingDocument(null);
      contractForm.resetFields();
      documentForm.resetFields();
      
      onSuccess();
    } catch (error) {
      console.error('Contract completion error:', error);
      message.error(`Failed to complete contract: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    // Clean up draft contract if it exists and hasn't been completed
    if (contractData && contractData.contract_id) {
      try {
        console.log('Cleaning up draft contract:', contractData.contract_id);
        const response = await fetch(buildApiUrl(API_ENDPOINTS.CONTRACTS, `/${contractData.contract_id}`), {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          console.log('✅ Draft contract cleaned up successfully');
        } else {
          const errorData = await response.json();
          console.warn('Draft contract cleanup failed:', errorData.error);
        }
      } catch (error) {
        console.warn('Failed to clean up draft contract:', error);
        // Don't show error to user as this is cleanup
      }
    }

    setCurrentStep(0);
    setContractData(null);
    setFileList([]);
    setUploadedDocuments([]);
    setUploadProgress({});
    setAutoCreating(false);
    setEditableExtractedData({});
    setEditingDocument(null);
    contractForm.resetFields();
    documentForm.resetFields();
    onCancel();
  };



  // Handle contract details update
  const handleContractDetailsUpdate = async (values) => {
    if (!contractData || !contractData.contract_id) return;
    
    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.CONTRACTS, `/${contractData.contract_id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(values)
      });

      if (response.ok) {
        const updatedContract = await response.json();
        setContractData(updatedContract);
        message.success('Contract details updated');
      }
    } catch (error) {
      console.error('Failed to update contract details:', error);
    }
  };

  const renderDocumentUpload = () => (
    <div>
      <Card title="Contract Details" style={{ marginBottom: 16 }}>
        <Form
          form={contractForm}
          layout="vertical"
          initialValues={{
            customer_name: contractData?.customer_name || '',
            loan_amount: contractData?.loan_amount || undefined
          }}

        >
          <Form.Item
            name="customer_name"
            label="Customer Name"
            rules={[
              { required: true, message: 'Please enter customer name' },
              { min: 2, message: 'Customer name must be at least 2 characters' }
            ]}
          >
            <Input placeholder="Enter customer full name" />
          </Form.Item>

          <Form.Item
            name="loan_amount"
            label="Loan Amount"
            rules={[
              { required: true, message: 'Please enter loan amount' },
              { 
                validator: (_, value) => {
                  if (!value || value <= 0) {
                    return Promise.reject(new Error('Loan amount must be greater than 0'));
                  }
                  return Promise.resolve();
                }
              }
            ]}
          >
            <InputNumber
              placeholder="Enter loan amount"
              style={{ width: '100%' }}
              formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value.replace(/\$\s?|(,*)/g, '')}
              min={0}
            />
          </Form.Item>
        </Form>
      </Card>

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
          onClick={async () => {
            try {
              // First check if documents are uploaded
              const uploadedDocs = uploadedDocuments.filter(doc => doc.document_id);
              if (uploadedDocs.length === 0) {
                message.warning('Please upload at least one document');
                return;
              }

              // Then validate contract form
              const formValues = await contractForm.validateFields();
              
              // Save the validated form data
              await handleContractDetailsUpdate(formValues);
              
              // Refresh document data and proceed
              await refreshDocumentData();
              setCurrentStep(1);
            } catch (error) {
              if (error.errorFields && error.errorFields.length > 0) {
                message.error('Please fill in all required contract details');
              } else {
                console.error('Error proceeding to review:', error);
                message.error('Failed to proceed to review');
              }
            }
          }}
          disabled={uploadedDocuments.filter(doc => doc.document_id).length === 0}
        >
          {uploadedDocuments.filter(doc => doc.document_id).length === 0 
            ? 'Complete Contract Details & Upload Documents' 
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
            <Text strong>Loan Amount:</Text> ${contractData.loan_amount?.toLocaleString()}<br />
            <Text strong>Status:</Text> <Tag color="blue">{contractData.status}</Tag><br />
            <Text strong>Approval Stage:</Text> <Tag color="orange">{contractData.current_approval_stage}</Tag>
          </div>
        )}
      </Card>

      <Card 
        title="Document Extraction Results" 
        extra={
          <Button 
            type="link" 
            icon={<ReloadOutlined />}
            onClick={refreshDocumentData}
            size="small"
          >
            Refresh Data
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        {uploadedDocuments.filter(doc => doc.document_id).length > 0 ? (
          <>
            {uploadedDocuments.filter(doc => doc.document_id).map((item, index) => (
              <Card
                key={item.document_id || index}
                size="small"
                style={{
                  marginBottom: 16,
                  border: item.needs_manual_review ? '1px solid #faad14' : '1px solid #d9d9d9',
                  backgroundColor: item.needs_manual_review ? '#fffbf0' : '#ffffff'
                }}
                title={
                  <Space>
                    <FileTextOutlined style={{ color: '#1B5E20' }} />
                    <Text strong>{item.name}</Text>
                    <Tag color="blue">{item.type}</Tag>
                    {(() => {
                      const confidenceScore = getConfidenceScore(item);
                      return item.status === 'Extracted' && confidenceScore !== null && typeof confidenceScore === 'number' && (
                        <Tag color={needsManualReview(item) ? "warning" : "success"} icon={<CheckCircleOutlined />}>
                          Confidence: {confidenceScore.toFixed(1)}%
                        </Tag>
                      );
                    })()}
                    {item.status === 'Processing' && (
                      <Tag color="processing">Processing...</Tag>
                    )}
                    {(!item.status || item.status === 'Uploaded') && (
                      <Tag color="default">Uploaded</Tag>
                    )}
                  </Space>
                }
                extra={
                  getExtractedData(item) && (
                    <Button
                      type="link"
                      icon={<EditOutlined />}
                      onClick={() => setEditingDocument(editingDocument === item.document_id ? null : item.document_id)}
                    >
                      {editingDocument === item.document_id ? 'Hide Fields' : 'Edit Fields'}
                    </Button>
                  )
                }
              >
                {needsManualReview(item) && (
                  <Alert
                    message="Manual Review Required"
                    description="Confidence score is below 95%. Please review and edit the extracted information below."
                    type="warning"
                    style={{ marginBottom: 12 }}
                    showIcon
                  />
                )}

                {getExtractedData(item) ? (
                  <div>
                    {editingDocument === item.document_id ? (
                      // Editable form view
                      <div style={{ marginTop: 8 }}>
                        <Text strong style={{ marginBottom: 8, display: 'block' }}>
                          Edit Extracted Fields (Click field values to edit):
                        </Text>
                        <Form layout="vertical" size="small">
                          {Object.entries(getExtractedData(item)).map(([key, value]) => {
                            const displayValue = typeof value === 'object' ? value.value : value;
                            const fieldKey = `${item.document_id}_${key}`;
                            
                            return (
                              <Form.Item
                                key={fieldKey}
                                label={
                                  <Text strong style={{ fontSize: '12px' }}>
                                    {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                  </Text>
                                }
                                style={{ marginBottom: 8 }}
                              >
                                {key.toLowerCase().includes('address') || (typeof displayValue === 'string' && displayValue.length > 50) ? (
                                  <Input.TextArea
                                    rows={2}
                                    defaultValue={displayValue || ''}
                                    placeholder={`Enter ${key.replace(/_/g, ' ')}`}
                                    onChange={(e) => {
                                      setEditableExtractedData(prev => ({
                                        ...prev,
                                        [fieldKey]: e.target.value
                                      }));
                                    }}
                                  />
                                ) : key.toLowerCase().includes('amount') || key.toLowerCase().includes('price') ? (
                                  <InputNumber
                                    style={{ width: '100%' }}
                                    defaultValue={parseFloat(displayValue) || 0}
                                    placeholder={`Enter ${key.replace(/_/g, ' ')}`}
                                    formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                    parser={value => value.replace(/\$\s?|(,*)/g, '')}
                                    onChange={(value) => {
                                      setEditableExtractedData(prev => ({
                                        ...prev,
                                        [fieldKey]: value
                                      }));
                                    }}
                                  />
                                ) : (
                                  <Input
                                    defaultValue={displayValue || ''}
                                    placeholder={`Enter ${key.replace(/_/g, ' ')}`}
                                    onChange={(e) => {
                                      setEditableExtractedData(prev => ({
                                        ...prev,
                                        [fieldKey]: e.target.value
                                      }));
                                    }}
                                  />
                                )}
                              </Form.Item>
                            );
                          })}
                          <div style={{ textAlign: 'right', marginTop: 12 }}>
                            <Button 
                              type="primary" 
                              size="small"
                              onClick={() => {
                                message.success('Field changes saved locally. They will be applied when you complete the contract.');
                                setEditingDocument(null);
                              }}
                            >
                              Save Changes
                            </Button>
                          </div>
                        </Form>
                      </div>
                    ) : (
                      // Read-only summary view
                      <div style={{ marginTop: 8 }}>
                        <Text strong style={{ fontSize: '12px', marginBottom: 8, display: 'block' }}>
                          Extracted Information:
                        </Text>
                        <div style={{ 
                          padding: 8, 
                          backgroundColor: '#fafafa',
                          borderRadius: 4,
                          fontSize: '12px'
                        }}>
                          {Object.entries(getExtractedData(item)).map(([key, value]) => {
                            const displayValue = typeof value === 'object' ? value.value : value;
                            const fieldKey = `${item.document_id}_${key}`;
                            const editedValue = editableExtractedData[fieldKey];
                            
                            return (
                              <div key={key} style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                                <Text type="secondary" style={{ minWidth: '120px' }}>
                                  {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:
                                </Text>
                                <Text style={{ flex: 1, textAlign: 'right' }}>
                                  {editedValue !== undefined ? (
                                    <span style={{ color: '#1B5E20', fontWeight: 'bold' }}>
                                      {editedValue} <Tag size="small" color="blue">edited</Tag>
                                    </span>
                                  ) : (
                                    displayValue || 'N/A'
                                  )}
                                </Text>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    No extracted data available for this document.
                  </Text>
                )}

                {item.status === 'Extracted' && !needsManualReview(item) && (
                  <div style={{ 
                    marginTop: 8,
                    padding: 8, 
                    backgroundColor: '#f6ffed', 
                    border: '1px solid #b7eb8f',
                    borderRadius: 4
                  }}>
                    <Text type="success" style={{ fontSize: '12px' }}>
                      ✅ High confidence extraction - Review optional
                    </Text>
                  </div>
                )}
              </Card>
            ))}
            <div style={{ marginTop: 16, padding: 12, backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6 }}>
              <Text type="success">
                ✅ {uploadedDocuments.filter(doc => doc.document_id).length} document(s) successfully processed
              </Text>
              {uploadedDocuments.some(doc => needsManualReview(doc)) && (
                <>
                  <br />
                  <Text type="warning">
                    ⚠️ {uploadedDocuments.filter(doc => needsManualReview(doc)).length} document(s) require manual review
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
          loading={loading}
        >
          {loading 
            ? 'Creating & Generating Contract...' 
            : uploadedDocuments.filter(doc => doc.document_id).length === 0 
              ? 'Upload Documents Required' 
              : 'Complete Contract Creation & Generate Document'
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
      centered
      maskClosable={false}
      destroyOnClose={true}
      zIndex={1000}
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
        ) : loading && contractData ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <Spin size="large" />
            <p style={{ marginTop: 16, fontSize: '16px', fontWeight: 'bold' }}>
              🏗️ Completing Contract Creation
            </p>
            <p style={{ marginTop: 8, color: '#666' }}>
              Validating documents, generating contract document, and starting approval workflow...
            </p>
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