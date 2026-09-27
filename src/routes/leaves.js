const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db, logAudit } = require('../db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

// GET /api/leaves
router.get('/', authenticateToken, (req, res) => {
  const isMgmt = ['admin', 'hr', 'supervisor'].includes(req.user.role);

  if (isMgmt) {
    const leaves = db.prepare('SELECT * FROM leaves ORDER BY startDate DESC').all();
    return res.json(leaves);
  }

  const myLeaves = db.prepare('SELECT * FROM leaves WHERE userId = ? ORDER BY startDate DESC').all(req.user.id);
  res.json(myLeaves);
});

// POST /api/leaves
router.post('/', authenticateToken, (req, res) => {
  const { type, startDate, endDate, reason, targetUserId } = req.body;

  if (!type || !startDate || !endDate) {
    return res.status(400).json({ error: 'Leave type, start date, and end date are required.' });
  }

  if (startDate > endDate) {
    return res.status(400).json({ error: 'End date must be on or after start date.' });
  }

  const isMgmt = ['admin', 'hr', 'supervisor'].includes(req.user.role);
  let userId = req.user.id;
  let userName = req.user.name;

  if (isMgmt && targetUserId) {
    const target = db.prepare('SELECT id, name FROM users WHERE id = ?').get(targetUserId);
    if (target) {
      userId = target.id;
      userName = target.name;
    }
  }

  const id = 'leave_' + crypto.randomUUID();
  const now = new Date().toISOString();
  const initialStatus = isMgmt ? 'approved' : 'pending';

  db.prepare(`
    INSERT INTO leaves (id, userId, userName, type, startDate, endDate, reason, status, actionedBy, actionedAt, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, userId, userName, type, startDate, endDate,
    reason || '', initialStatus,
    isMgmt ? req.user.name : null,
    isMgmt ? now : null,
    now
  );

  logAudit(req.user.name, isMgmt ? 'Leave Granted' : 'Leave Applied', userName, `${type}: ${startDate} to ${endDate}`);

  res.status(201).json({
    message: isMgmt ? 'Leave granted successfully!' : 'Leave application submitted!',
    id
  });
});

// PUT /api/leaves/:id/status (Admin/HR/Supervisor only)
router.put('/:id/status', authenticateToken, requireRoles(['admin', 'hr', 'supervisor']), (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const leave = db.prepare('SELECT * FROM leaves WHERE id = ?').get(id);
  if (!leave) {
    return res.status(404).json({ error: 'Leave record not found' });
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE leaves SET status = ?, actionedBy = ?, actionedAt = ? WHERE id = ?').run(status, req.user.name, now, id);

  logAudit(req.user.name, `Leave ${status}`, leave.userName, `${leave.type} (${leave.startDate} to ${leave.endDate})`);

  res.json({ message: `Leave request marked as ${status}` });
});

// DELETE /api/leaves/:id (Admin/HR only)
router.delete('/:id', authenticateToken, requireRoles(['admin', 'hr']), (req, res) => {
  const { id } = req.params;
  const leave = db.prepare('SELECT * FROM leaves WHERE id = ?').get(id);

  if (!leave) {
    return res.status(404).json({ error: 'Leave record not found' });
  }

  db.prepare('DELETE FROM leaves WHERE id = ?').run(id);
  logAudit(req.user.name, 'Leave Deleted', leave.userName, `Deleted ${leave.type} (${leave.startDate} to ${leave.endDate})`);

  res.json({ message: 'Leave record deleted successfully' });
});

module.exports = router;
