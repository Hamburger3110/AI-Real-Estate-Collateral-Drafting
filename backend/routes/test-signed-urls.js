const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const s3Service = require('../services/s3-service');

// Test endpoint to debug signed URLs without authentication
router.get('/test-signed-url/:contractId', async (req, res) => {
  try {
    const contractId = req.params.contractId;
    console.log('Testing signed URL for contract:', contractId);
    
    // Get contract details
    const contractQuery = 'SELECT * FROM contracts WHERE contract_id = $1';
    const contractResult = await pool.query(contractQuery, [contractId]);
    
    if (contractResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    const contract = contractResult.rows[0];
    console.log('Contract found:', {
      contract_id: contract.contract_id,
      pdf_url: contract.generated_pot_uri,
      docx_url: contract.generated_docx_uri
    });
    
    if (!contract.generated_pot_uri && !contract.generated_docx_uri) {
      return res.status(400).json({ error: 'Contract has not been generated yet' });
    }
    
    const documents = {};
    
    // Generate signed URL for PDF
    if (contract.generated_pot_uri) {
      try {
        const s3Key = contract.generated_pot_uri.split('.com/')[1];
        console.log('PDF S3 key:', s3Key);
        const signedUrl = await s3Service.getSignedUrl(s3Key);
        console.log('PDF signed URL generated:', signedUrl);
        documents.pdf_url = signedUrl;
      } catch (err) {
        console.error('Error generating PDF signed URL:', err);
        documents.pdf_error = err.message;
      }
    }
    
    // Generate signed URL for DOCX
    if (contract.generated_docx_uri) {
      try {
        const s3Key = contract.generated_docx_uri.split('.com/')[1];
        console.log('DOCX S3 key:', s3Key);
        const signedUrl = await s3Service.getSignedUrl(s3Key);
        console.log('DOCX signed URL generated:', signedUrl);
        documents.docx_url = signedUrl;
      } catch (err) {
        console.error('Error generating DOCX signed URL:', err);
        documents.docx_error = err.message;
      }
    }
    
    res.json({
      contract_id: contractId,
      original_urls: {
        pdf: contract.generated_pot_uri,
        docx: contract.generated_docx_uri
      },
      signed_urls: documents
    });
    
  } catch (error) {
    console.error('Error in test endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;