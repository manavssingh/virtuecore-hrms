const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db, logAudit } = require('../db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

// GET /api/announcements
router.get('/', authenticateToken, (req, res) => {
  const isMgmt = ['admin', 'hr', 'supervisor'].includes(req.user.role);

  let rows = [];
  if (isMgmt) {
    rows = db.prepare('SELECT * FROM announcements ORDER BY timestamp DESC').all();
  } else {
    const dept = req.user.department || 'Operations';
    rows = db.prepare(`
      SELECT * FROM announcements
      WHERE targetType = 'ALL'
         OR (targetType = 'DEPARTMENT' AND (department = 'ALL' OR department = ?))
         OR (targetType = 'USER' AND targetUserId = ?)
         OR (targetType IS NULL AND (department = 'ALL' OR department = ?))
      ORDER BY timestamp DESC
    `).all(dept, req.user.id, dept);
  }

  const formatted = rows.map(a => {
    let acks = [];
    try {
      acks = a.acknowledgements ? JSON.parse(a.acknowledgements) : [];
    } catch {
      acks = [];
    }

    const myAck = acks.find(x => x.userId === req.user.id);

    return {
      ...a,
      requiresAck: Boolean(a.requiresAck),
      acknowledgements: acks,
      ackCount: acks.length,
      hasAcknowledged: Boolean(myAck),
      acknowledgedAt: myAck ? myAck.timestamp : null
    };
  });

  res.json(formatted);
});

// POST /api/announcements (Admin/HR only)
router.post('/', authenticateToken, requireRoles(['admin', 'hr']), (req, res) => {
  const {
    title,
    message,
    targetType = 'ALL',
    department = 'ALL',
    targetUserId = null,
    requiresAck = false
  } = req.body;

  if (!title || !message) {
    return res.status(400).json({ error: 'Title and message content are required' });
  }

  let targetUserName = null;
  if (targetType === 'USER') {
    if (!targetUserId) {
      return res.status(400).json({ error: 'Target employee must be selected for Direct Message' });
    }
    const targetUser = db.prepare('SELECT id, name FROM users WHERE id = ?').get(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Target employee not found' });
    }
    targetUserName = targetUser.name;
  }

  const id = 'ann_' + crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO announcements (
      id, title, department, message, author,
      targetType, targetUserId, targetUserName, requiresAck, acknowledgements,
      timestamp, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?)
  `).run(
    id, title.trim(), department, message.trim(), req.user.name,
    targetType, targetUserId || null, targetUserName || null,
    requiresAck ? 1 : 0, now, now
  );

  const targetDesc = targetType === 'USER' ? `User: ${targetUserName}` : targetType === 'DEPARTMENT' ? `Dept: ${department}` : 'All Staff';
  logAudit(req.user.name, 'Announcement Posted', title.trim(), `${targetDesc} (Ack required: ${Boolean(requiresAck)})`);

  res.status(201).json({
    message: 'Announcement published successfully!',
    id
  });
});

// POST /api/announcements/:id/acknowledge
router.post('/:id/acknowledge', authenticateToken, (req, res) => {
  const { id } = req.params;
  const ann = db.prepare('SELECT * FROM announcements WHERE id = ?').get(id);

  if (!ann) {
    return res.status(404).json({ error: 'Announcement not found' });
  }

  let acks = [];
  try {
    acks = ann.acknowledgements ? JSON.parse(ann.acknowledgements) : [];
  } catch {
    acks = [];
  }

  const now = new Date().toISOString();
  const existingIdx = acks.findIndex(x => x.userId === req.user.id);

  if (existingIdx === -1) {
    acks.push({
      userId: req.user.id,
      userName: req.user.name,
      timestamp: now
    });

    db.prepare('UPDATE announcements SET acknowledgements = ? WHERE id = ?').run(JSON.stringify(acks), id);
    logAudit(req.user.name, 'Announcement Acknowledged', ann.title, `Acknowledged receipt at ${now}`);
  }

  res.json({
    message: 'Receipt acknowledged successfully!',
    acknowledgedAt: now
  });
});

module.exports = router;
