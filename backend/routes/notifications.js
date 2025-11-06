const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../db');

// Get user notifications
router.get('/', authenticateToken, async (req, res) => {
  const user_id = req.user.user_id;
  const { limit = 50, offset = 0, unread_only = false } = req.query;

  try {
    let query = `
      SELECT 
        n.notification_id,
        n.user_id,
        n.type,
        n.title,
        n.message,
        n.priority,
        n.read,
        n.contract_id,
        n.metadata,
        n.created_by,
        CASE 
          WHEN n.created_at::text ~ '[+-]\d{2}$' THEN n.created_at
          ELSE timezone('UTC', n.created_at)
        END as created_at,
        CASE 
          WHEN n.read_at IS NULL THEN NULL
          WHEN n.read_at::text ~ '[+-]\d{2}$' THEN n.read_at
          ELSE timezone('UTC', n.read_at)
        END as read_at,
        c.contract_number,
        u.full_name as creator_name
      FROM notifications n
      LEFT JOIN contracts c ON n.contract_id = c.contract_id
      LEFT JOIN users u ON n.created_by = u.user_id
      WHERE n.user_id = $1
    `;
    
    const params = [user_id];
    
    if (unread_only === 'true') {
      query += ' AND n.read = FALSE';
    }
    
    query += ` ORDER BY n.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get unread notification count
router.get('/unread-count', authenticateToken, async (req, res) => {
  const user_id = req.user.user_id;

  try {
    const result = await pool.query(
      'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = $1 AND read = FALSE',
      [user_id]
    );
    
    res.json({ unread_count: parseInt(result.rows[0].unread_count) });
  } catch (err) {
    console.error('Error fetching unread count:', err);
    res.status(500).json({ error: err.message });
  }
});

// Mark notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
  const notification_id = req.params.id;
  const user_id = req.user.user_id;

  try {
    const result = await pool.query(
      `UPDATE notifications 
       SET read = TRUE, read_at = CURRENT_TIMESTAMP 
       WHERE notification_id = $1 AND user_id = $2 
       RETURNING *`,
      [notification_id, user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found or not authorized' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ error: err.message });
  }
});

// Mark all notifications as read
router.put('/read-all', authenticateToken, async (req, res) => {
  const user_id = req.user.user_id;

  try {
    const result = await pool.query(
      `UPDATE notifications 
       SET read = TRUE, read_at = CURRENT_TIMESTAMP 
       WHERE user_id = $1 AND read = FALSE`,
      [user_id]
    );

    res.json({ 
      message: 'All notifications marked as read',
      updated_count: result.rowCount 
    });
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create a new notification (admin/manager only)
router.post('/', authenticateToken, async (req, res) => {
  const { user_id, contract_id, type, title, message, priority = 'MEDIUM' } = req.body;
  const created_by = req.user.user_id;

  // Check permissions (admin or manager can send notifications)
  if (!req.user.role || !['ADMIN', 'MANAGER'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions to send notifications' });
  }

  if (!user_id || !type || !title || !message) {
    return res.status(400).json({ error: 'Missing required fields: user_id, type, title, message' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO notifications (user_id, contract_id, type, title, message, priority, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [user_id, contract_id, type, title, message, priority, created_by]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating notification:', err);
    res.status(500).json({ error: err.message });
  }
});

// Bulk create notifications
router.post('/bulk', authenticateToken, async (req, res) => {
  const { user_ids, contract_id, type, title, message, priority = 'MEDIUM' } = req.body;
  const created_by = req.user.user_id;

  // Check permissions
  if (!req.user.role || !['ADMIN', 'MANAGER'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions to send notifications' });
  }

  if (!user_ids || !Array.isArray(user_ids) || !type || !title || !message) {
    return res.status(400).json({ error: 'Missing required fields: user_ids (array), type, title, message' });
  }

  try {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const notifications = [];
      
      for (const user_id of user_ids) {
        const result = await client.query(
          `INSERT INTO notifications (user_id, contract_id, type, title, message, priority, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [user_id, contract_id, type, title, message, priority, created_by]
        );
        notifications.push(result.rows[0]);
      }
      
      await client.query('COMMIT');
      
      res.status(201).json({
        message: `${notifications.length} notifications created successfully`,
        notifications
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error creating bulk notifications:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete notification
router.delete('/:id', authenticateToken, async (req, res) => {
  const notification_id = req.params.id;
  const user_id = req.user.user_id;

  try {
    const result = await pool.query(
      'DELETE FROM notifications WHERE notification_id = $1 AND user_id = $2 RETURNING *',
      [notification_id, user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found or not authorized' });
    }

    res.json({ message: 'Notification deleted successfully' });
  } catch (err) {
    console.error('Error deleting notification:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get notification preferences for user
router.get('/preferences', authenticateToken, async (req, res) => {
  const user_id = req.user.user_id;

  try {
    const result = await pool.query(
      'SELECT * FROM notification_preferences WHERE user_id = $1',
      [user_id]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching notification preferences:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update notification preferences
router.put('/preferences', authenticateToken, async (req, res) => {
  const user_id = req.user.user_id;
  const { preferences } = req.body; // Array of preference objects

  if (!preferences || !Array.isArray(preferences)) {
    return res.status(400).json({ error: 'Preferences must be an array' });
  }

  try {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const pref of preferences) {
        const { notification_type, email_enabled, browser_enabled } = pref;
        
        await client.query(
          `INSERT INTO notification_preferences (user_id, notification_type, email_enabled, browser_enabled)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, notification_type)
           DO UPDATE SET 
             email_enabled = EXCLUDED.email_enabled,
             browser_enabled = EXCLUDED.browser_enabled,
             updated_at = CURRENT_TIMESTAMP`,
          [user_id, notification_type, email_enabled, browser_enabled]
        );
      }
      
      await client.query('COMMIT');
      
      res.json({ message: 'Notification preferences updated successfully' });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error updating notification preferences:', err);
    res.status(500).json({ error: err.message });
  }
});

// Manual trigger for contract notifications (testing/admin use)
router.post('/trigger/:contract_id', authenticateToken, async (req, res) => {
  const contract_id = req.params.contract_id;
  const { type, custom_message } = req.body;
  
  // Admin only
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    // Get contract details
    const contractResult = await pool.query(
      'SELECT * FROM contracts WHERE contract_id = $1',
      [contract_id]
    );

    if (contractResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const contract = contractResult.rows[0];
    
    // Get template
    const templateResult = await pool.query(
      'SELECT * FROM notification_templates WHERE type = $1',
      [type]
    );

    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Notification template not found' });
    }

    const template = templateResult.rows[0];
    
    // Determine target users based on type
    let targetUsers = [];
    switch (type) {
      case 'CONTRACT_CREATED':
        const managersResult = await pool.query(
          "SELECT user_id FROM users WHERE role IN ('ADMIN', 'MANAGER')"
        );
        targetUsers = managersResult.rows.map(u => u.user_id);
        break;
      case 'APPROVAL_PENDING':
        // Target users based on current approval stage
        let roleFilter = '';
        switch (contract.current_approval_stage) {
          case 'credit_analysis':
            roleFilter = "role = 'CREDIT_OFFICER'";
            break;
          case 'legal_review':
            roleFilter = "role = 'LEGAL_OFFICER'";
            break;
          default:
            roleFilter = "role IN ('MANAGER', 'ADMIN')";
            break;
        }
        const stageUsersResult = await pool.query(`SELECT user_id FROM users WHERE ${roleFilter}`);
        targetUsers = stageUsersResult.rows.map(u => u.user_id);
        break;
      default:
        targetUsers = [contract.generated_by];
        break;
    }

    // Create notifications
    const notifications = [];
    for (const user_id of targetUsers) {
      const title = template.title_template.replace('{{contract_number}}', contract.contract_number);
      const message = custom_message || template.message_template
        .replace('{{contract_number}}', contract.contract_number)
        .replace('{{stage}}', contract.current_approval_stage);

      const result = await pool.query(
        `INSERT INTO notifications (user_id, contract_id, type, title, message, priority, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [user_id, contract_id, type, title, message, template.default_priority, req.user.user_id]
      );
      
      notifications.push(result.rows[0]);
    }

    res.json({
      message: `${notifications.length} notifications created`,
      notifications
    });
  } catch (err) {
    console.error('Error triggering notifications:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;