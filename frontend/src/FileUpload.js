import React from 'react';

function FileUpload() {
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    await fetch('http://localhost:3001/upload', {
      method: 'POST',
      body: formData,
    });
    alert('File uploaded!');
  };

  return (
    <div>
      <h2>Upload Legal Document</h2>
      <input type="file" onChange={handleUpload} />
    </div>
  );
}

export default FileUpload;
