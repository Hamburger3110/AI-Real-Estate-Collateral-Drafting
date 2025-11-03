const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Middleware to authenticate token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Simple login endpoint (for demo)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'User not found' });
    
    const user = result.rows[0];
    
    // For demo purposes, accept "password123" for all users
    if (password !== 'password123') {
      return res.status(401).json({ error: 'Invalid password' });
    }
    
    const token = jwt.sign({ 
      user_id: user.user_id, 
      email: user.email, 
      role: user.role,
      full_name: user.full_name 
    }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user profile endpoint
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    // For demo purposes, return mock user data based on token
    const demoUsers = {
      1: { id: 1, email: 'admin@vpbank.com', name: 'System Administrator', role: 'ADMIN' },
      2: { id: 2, email: 'credit.officer@vpbank.com', name: 'Sarah Johnson', role: 'CREDIT_OFFICER' },
      3: { id: 3, email: 'legal.officer@vpbank.com', name: 'Lisa Chen', role: 'LEGAL_OFFICER' },
      4: { id: 4, email: 'manager@vpbank.com', name: 'Mike Wilson', role: 'MANAGER' }
    };

    // Extract user ID from token (assuming it's demo-token-{id})
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const userId = token?.replace('demo-token-', '');
    
    const user = demoUsers[userId];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
