const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db, logAudit } = require('../db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

// GET /api/holidays
router.get('/', authenticateToken, (req, res) => {
  const holidays = db.prepare('SELECT * FROM holidays ORDER BY date ASC').all();
  res.json(holidays);
});

// POST /api/holidays (Admin/HR only)
router.post('/', authenticateToken, requireRoles(['admin', 'hr']), (req, res) => {
  const { name, date, type = 'National Holiday' } = req.body;

  if (!name || !date) {
    return res.status(400).json({ error: 'Holiday name and date are required' });
  }

  const id = 'hol_' + crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO holidays (id, date, name, type, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, date, name.trim(), type, now);

  logAudit(req.user.name, 'Holiday Added', name.trim(), `Date: ${date}, Type: ${type}`);

  res.status(201).json({
    message: 'Holiday added to corporate calendar!',
    id
  });
});

// DELETE /api/holidays/:id (Admin/HR only)
router.delete('/:id', authenticateToken, requireRoles(['admin', 'hr']), (req, res) => {
  const { id } = req.params;
  const holiday = db.prepare('SELECT * FROM holidays WHERE id = ?').get(id);

  if (!holiday) {
    return res.status(404).json({ error: 'Holiday not found' });
  }

  db.prepare('DELETE FROM holidays WHERE id = ?').run(id);
  logAudit(req.user.name, 'Holiday Deleted', holiday.name, `Deleted holiday for ${holiday.date}`);

  res.json({ message: 'Holiday deleted successfully' });
});

module.exports = router;
