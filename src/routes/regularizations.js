const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db, logAudit } = require('../db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

// GET /api/regularizations
router.get('/', authenticateToken, (req, res) => {
  const isMgmt = ['admin', 'hr', 'supervisor'].includes(req.user.role);

  if (isMgmt) {
    const records = db.prepare('SELECT * FROM regularizations ORDER BY date DESC, submittedAt DESC').all();
    return res.json(records);
  }

  const myRecords = db.prepare('SELECT * FROM regularizations WHERE userId = ? ORDER BY date DESC').all(req.user.id);
  res.json(myRecords);
});

// POST /api/regularizations
router.post('/', authenticateToken, (req, res) => {
  const { attendanceId, date, reqPunchIn, reqPunchOut, reason } = req.body;

  if (!date || !reqPunchIn || !reqPunchOut || !reason) {
    return res.status(400).json({ error: 'Date, punch in time, punch out time, and reason are required.' });
  }

  if (new Date(reqPunchOut) <= new Date(reqPunchIn)) {
    return res.status(400).json({ error: 'Punch out time must be after punch in time.' });
  }

  const id = 'reg_' + crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO regularizations (
      id, userId, userName, attendanceId, date, reqPunchIn, reqPunchOut,
      reason, status, submittedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
  `).run(
    id, req.user.id, req.user.name, attendanceId || '',
    date, reqPunchIn, reqPunchOut, reason.trim(), now
  );

  logAudit(req.user.name, 'Regularization Submitted', date, `Requested ${reqPunchIn} to ${reqPunchOut}`);

  res.status(201).json({
    message: 'Regularization request submitted successfully',
    id
  });
});

// PUT /api/regularizations/:id/status (Admin/HR/Supervisor only)
router.put('/:id/status', authenticateToken, requireRoles(['admin', 'hr', 'supervisor']), (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status must be approved or rejected' });
  }

  const reg = db.prepare('SELECT * FROM regularizations WHERE id = ?').get(id);
  if (!reg) {
    return res.status(404).json({ error: 'Regularization request not found' });
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE regularizations SET status = ?, actionedBy = ?, actionedAt = ? WHERE id = ?').run(status, req.user.name, now, id);

  if (status === 'approved') {
    const sessions = JSON.stringify([{ in: reg.reqPunchIn, out: reg.reqPunchOut }]);

    if (reg.attendanceId) {
      const existing = db.prepare('SELECT id FROM attendance WHERE id = ?').get(reg.attendanceId);
      if (existing) {
        db.prepare(`
          UPDATE attendance SET
            punchIn = ?,
            punchOut = ?,
            status = 'completed',
            isRegularized = 1,
            sessions = ?,
            updatedAt = ?
          WHERE id = ?
        `).run(reg.reqPunchIn, reg.reqPunchOut, sessions, now, reg.attendanceId);
      }
    } else {
      // Check if user has an attendance record for that date
      const existingByDate = db.prepare('SELECT id FROM attendance WHERE userId = ? AND date = ?').get(reg.userId, reg.date);
      if (existingByDate) {
        db.prepare(`
          UPDATE attendance SET
            punchIn = ?,
            punchOut = ?,
            status = 'completed',
            isRegularized = 1,
            sessions = ?,
            updatedAt = ?
          WHERE id = ?
        `).run(reg.reqPunchIn, reg.reqPunchOut, sessions, now, existingByDate.id);
      } else {
        const attId = 'att_' + crypto.randomUUID();
        db.prepare(`
          INSERT INTO attendance (id, userId, userName, date, punchIn, punchOut, sessions, breaks, status, isRegularized, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, '[]', 'completed', 1, ?, ?)
        `).run(attId, reg.userId, reg.userName, reg.date, reg.reqPunchIn, reg.reqPunchOut, sessions, now, now);
      }
    }
  }

  logAudit(req.user.name, `Regularization ${status}`, reg.userName, `Date: ${reg.date} (${status})`);

  res.json({ message: `Regularization request ${status} successfully` });
});

module.exports = router;
