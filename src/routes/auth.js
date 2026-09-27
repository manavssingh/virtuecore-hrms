const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { db, logAudit } = require('../db');
const { authenticateToken } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(username.trim());

  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const validPassword = bcrypt.compareSync(password.trim(), user.password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  if (user.role !== 'admin' && user.active === 0) {
    return res.status(403).json({ error: 'Account deactivated. Please contact Admin/HR.' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    config.jwtSecret,
    { expiresIn: '24h' }
  );

  const { password_hash, ...safeUser } = user;
  safeUser.active = Boolean(safeUser.active);
  safeUser.isDemo = Boolean(safeUser.isDemo);

  logAudit(user.name, 'User Login', user.username, `Successful login from ${req.ip || 'web'}`);

  res.json({
    token,
    user: safeUser
  });
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  res.json({
    user: {
      ...req.user,
      active: Boolean(req.user.active),
      isDemo: Boolean(req.user.isDemo)
    }
  });
});

// POST /api/auth/change-password
router.post('/change-password', authenticateToken, (req, res) => {
  const { newPassword } = req.body;

  if (!newPassword || newPassword.trim().length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  const hash = bcrypt.hashSync(newPassword.trim(), 10);
  const now = new Date().toISOString();

  db.prepare('UPDATE users SET password_hash = ?, updatedAt = ? WHERE id = ?').run(hash, now, req.user.id);
  logAudit(req.user.name, 'Password Changed', req.user.username, 'User updated account password');

  res.json({ message: 'Password updated successfully' });
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, (req, res) => {
  logAudit(req.user.name, 'User Logout', req.user.username, 'User logged out');
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
