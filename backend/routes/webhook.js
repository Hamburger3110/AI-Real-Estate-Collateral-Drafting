const express = require('express');
const { sendTextractComplete } = require('./events');
const router = express.Router();

// Webhook endpoint for AWS Lambda to notify Textract completion
router.post('/textract', (req, res) => {
  const { documentId } = req.body;
  if (!documentId) return res.status(400).json({ error: 'Missing documentId' });
  sendTextractComplete(documentId);
  res.json({ message: 'Textract completion event sent' });
});

module.exports = router;
