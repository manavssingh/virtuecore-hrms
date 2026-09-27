const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

// GET /api/audits (Admin/HR only)
router.get('/', authenticateToken, requireRoles(['admin', 'hr']), (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const rows = db.prepare('SELECT * FROM audits ORDER BY timestamp DESC LIMIT ?').all(limit);
  res.json(rows);
});

module.exports = router;
