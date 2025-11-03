const express = require('express');
const router = express.Router();
const { runMigrations } = require('../db');

// Manual migration trigger endpoint for development
router.post('/run-migrations', async (req, res) => {
  try {
    console.log('🔄 Manually triggering database migrations...');
    await runMigrations();
    res.json({ 
      success: true, 
      message: 'Database migrations completed successfully' 
    });
  } catch (error) {
    console.error('❌ Manual migration failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;