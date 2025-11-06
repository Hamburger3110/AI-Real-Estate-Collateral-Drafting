import React, { useState } from 'react';

function DocumentUploadAndReview() {
  const [file, setFile] = useState(null);
  const [extractedFields, setExtractedFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const token = localStorage.getItem('token');

  // Upload document to backend
  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch('http://localhost:3001/upload', {
        method: 'POST',
        body: formData,
      });
      if (!uploadRes.ok) throw new Error('Upload failed');
      // Listen for extraction completion via SSE (webhook triggers backend to push event)
      const eventSource = new window.EventSource('http://localhost:3001/events');
      eventSource.onmessage = async (event) => {
        const { type, documentId } = JSON.parse(event.data);
        if (type === 'textract_complete') {
          // Fetch extracted fields for the completed document
          const fieldsRes = await fetch('http://localhost:3001/extracted_fields', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const fields = await fieldsRes.json();
          setExtractedFields(fields);
          setLoading(false);
          eventSource.close();
        }
      };
      eventSource.onerror = () => {
        setError('Error receiving extraction status.');
        setLoading(false);
        eventSource.close();
      };
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Handle field value change
  const handleFieldChange = (idx, value) => {
    setExtractedFields(fields => fields.map((f, i) => i === idx ? { ...f, field_value: value } : f));
  };

  // Update field value via API
  const handleUpdateField = async (field) => {
    try {
      const res = await fetch(`http://localhost:3001/extracted_fields/${field.field_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(field),
      });
      if (!res.ok) throw new Error('Update failed');
      alert('Field updated!');
    } catch (err) {
      alert('Error updating field: ' + err.message);
    }
  };

  return (
    <div>
      <h2>Upload Document & Review Extracted Data</h2>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={loading || !file}>Upload</button>
      {loading && <div>Processing document, please wait...</div>}
      {error && <div style={{ color: 'red' }}>Error: {error}</div>}
      {extractedFields.length > 0 && (
        <div>
          <h3>Extracted Fields</h3>
          <ul>
            {extractedFields.map((field, idx) => (
              <li key={field.field_id}>
                <strong>{field.field_name}:</strong>
                <input
                  type="text"
                  value={field.field_value || ''}
                  onChange={e => handleFieldChange(idx, e.target.value)}
                />
                <button onClick={() => handleUpdateField(field)}>Update</button>
                <span style={{ marginLeft: 10 }}>Confidence: {field.confidence_score}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default DocumentUploadAndReview;
