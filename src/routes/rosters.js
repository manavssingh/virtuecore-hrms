const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db, logAudit } = require('../db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

// GET /api/rosters
router.get('/', authenticateToken, (req, res) => {
  const isMgmt = ['admin', 'hr', 'supervisor'].includes(req.user.role);

  if (isMgmt) {
    const rosters = db.prepare('SELECT * FROM rosters ORDER BY date ASC, startTime ASC').all();
    return res.json(rosters);
  }

  const myRosters = db.prepare('SELECT * FROM rosters WHERE userId = ? ORDER BY date ASC, startTime ASC').all(req.user.id);
  res.json(myRosters);
});

// POST /api/rosters (Admin/HR/Supervisor only)
router.post('/', authenticateToken, requireRoles(['admin', 'hr', 'supervisor']), (req, res) => {
  const { targetUserId, date, startTime, endTime } = req.body;

  if (!targetUserId || !date || !startTime || !endTime) {
    return res.status(400).json({ error: 'Target user, date, start time, and end time are required' });
  }

  const now = new Date().toISOString();
  let usersToAssign = [];

  if (targetUserId === 'ALL') {
    usersToAssign = db.prepare("SELECT id, name FROM users WHERE role = 'employee' AND active = 1").all();
  } else {
    const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(targetUserId);
    if (user) usersToAssign.push(user);
  }

  if (usersToAssign.length === 0) {
    return res.status(400).json({ error: 'No active employees found to assign shifts to' });
  }

  const insert = db.prepare(`
    INSERT INTO rosters (id, userId, userName, date, startTime, endTime, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const u of usersToAssign) {
    const id = 'ros_' + crypto.randomUUID();
    insert.run(id, u.id, u.name, date, startTime, endTime, now);
  }

  logAudit(req.user.name, 'Roster Assigned', targetUserId, `Date: ${date} (${startTime}-${endTime}) to ${usersToAssign.length} staff`);

  res.status(201).json({
    message: `Shift assigned to ${usersToAssign.length} employee(s)!`
  });
});

// PUT /api/rosters/:id (Admin/HR/Supervisor only)
router.put('/:id', authenticateToken, requireRoles(['admin', 'hr', 'supervisor']), (req, res) => {
  const { id } = req.params;
  const { date, startTime, endTime } = req.body;

  const roster = db.prepare('SELECT * FROM rosters WHERE id = ?').get(id);
  if (!roster) {
    return res.status(404).json({ error: 'Shift schedule not found' });
  }

  db.prepare(`
    UPDATE rosters SET
      date = COALESCE(?, date),
      startTime = COALESCE(?, startTime),
      endTime = COALESCE(?, endTime)
    WHERE id = ?
  `).run(date || null, startTime || null, endTime || null, id);

  logAudit(req.user.name, 'Roster Updated', roster.userName, `Updated shift for ${date || roster.date} (${startTime || roster.startTime}-${endTime || roster.endTime})`);

  res.json({ message: 'Shift schedule updated successfully' });
});

// DELETE /api/rosters/:id (Admin/HR/Supervisor only)
router.delete('/:id', authenticateToken, requireRoles(['admin', 'hr', 'supervisor']), (req, res) => {
  const { id } = req.params;
  const roster = db.prepare('SELECT * FROM rosters WHERE id = ?').get(id);

  if (!roster) {
    return res.status(404).json({ error: 'Shift schedule not found' });
  }

  db.prepare('DELETE FROM rosters WHERE id = ?').run(id);
  logAudit(req.user.name, 'Roster Deleted', roster.userName, `Deleted shift for ${roster.date}`);

  res.json({ message: 'Shift schedule deleted successfully' });
});

module.exports = router;
