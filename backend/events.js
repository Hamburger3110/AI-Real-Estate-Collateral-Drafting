const express = require('express');
const router = express.Router();

let clients = [];

// SSE endpoint for frontend to listen for events
router.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  clients.push(res);

  req.on('close', () => {
    clients = clients.filter(c => c !== res);
  });
});

// Function to send event to all clients
function sendTextractComplete(documentId) {
  const data = JSON.stringify({ type: 'textract_complete', documentId });
  clients.forEach(res => {
    res.write(`data: ${data}\n\n`);
  });
}

module.exports = { router, sendTextractComplete };
