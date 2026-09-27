const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db, logAudit } = require('../db');
const { authenticateToken } = require('../middleware/auth');

function getTodayString() {
  return new Date().toLocaleDateString('en-CA');
}

// GET /api/attendance
router.get('/', authenticateToken, (req, res) => {
  const isMgmt = ['admin', 'hr', 'supervisor'].includes(req.user.role);
  const { date, startDate, endDate, userId } = req.query;

  let query = 'SELECT * FROM attendance WHERE 1=1';
  const params = [];

  if (!isMgmt) {
    query += ' AND userId = ?';
    params.push(req.user.id);
  } else if (userId) {
    query += ' AND userId = ?';
    params.push(userId);
  }

  if (date) {
    query += ' AND date = ?';
    params.push(date);
  } else {
    if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate);
    }
  }

  query += ' ORDER BY date DESC, punchIn DESC';

  const rows = db.prepare(query).all(...params);

  const parsed = rows.map(r => ({
    ...r,
    sessions: r.sessions ? JSON.parse(r.sessions) : [],
    breaks: r.breaks ? JSON.parse(r.breaks) : [],
    location: r.location ? JSON.parse(r.location) : null,
    isRegularized: Boolean(r.isRegularized)
  }));

  res.json(parsed);
});

// POST /api/attendance/punch
router.post('/punch', authenticateToken, (req, res) => {
  const { action, location } = req.body;
  const today = getTodayString();
  const now = new Date().toISOString();

  // 1. IP Restriction Check
  const restrictSetting = db.prepare("SELECT value FROM settings WHERE key = 'restrictIP'").get();
  const allowedIpSetting = db.prepare("SELECT value FROM settings WHERE key = 'allowedIP'").get();

  const isRestricted = restrictSetting && restrictSetting.value === 'true';
  const allowedIP = allowedIpSetting ? allowedIpSetting.value.trim() : '';

  if (action === 'punch_in' && isRestricted && allowedIP) {
    const clientIP = req.headers['x-forwarded-for']
      ? req.headers['x-forwarded-for'].split(',')[0].trim()
      : req.socket.remoteAddress;

    // Allow localhost/loopback in dev mode if matching
    const isLoopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientIP);
    if (!isLoopback && clientIP !== allowedIP) {
      return res.status(403).json({ error: 'Punch denied: You must be connected to the Office Wi-Fi network.' });
    }
  }

  let record = db.prepare('SELECT * FROM attendance WHERE userId = ? AND date = ?').get(req.user.id, today);

  let sessions = record && record.sessions ? JSON.parse(record.sessions) : [];
  let breaks = record && record.breaks ? JSON.parse(record.breaks) : [];

  if (action === 'punch_in') {
    if (!record) {
      const id = 'att_' + crypto.randomUUID();
      sessions = [{ in: now, out: null }];
      breaks = [];

      db.prepare(`
        INSERT INTO attendance (id, userId, userName, date, punchIn, punchOut, sessions, breaks, status, location, isRegularized, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, NULL, ?, ?, 'working', ?, 0, ?, ?)
      `).run(
        id, req.user.id, req.user.name, today, now,
        JSON.stringify(sessions), JSON.stringify(breaks),
        location ? JSON.stringify(location) : null,
        now, now
      );

      logAudit(req.user.name, 'Punch In', today, 'First shift punch in');
      return res.json({ message: 'Punched in successfully!', status: 'working' });
    } else {
      // Resume shift if previously punched out
      sessions.push({ in: now, out: null });
      db.prepare(`
        UPDATE attendance SET
          status = 'working',
          punchOut = NULL,
          sessions = ?,
          updatedAt = ?
        WHERE id = ?
      `).run(JSON.stringify(sessions), now, record.id);

      logAudit(req.user.name, 'Punch In (Resume)', today, 'Resumed active shift');
      return res.json({ message: 'Resumed shift!', status: 'working' });
    }
  }

  if (!record) {
    return res.status(400).json({ error: 'No punch-in recorded for today.' });
  }

  if (action === 'punch_out') {
    if (sessions.length > 0 && sessions[sessions.length - 1].out === null) {
      sessions[sessions.length - 1].out = now;
    }
    // Also close any ongoing break
    if (breaks.length > 0 && breaks[breaks.length - 1].end === null) {
      breaks[breaks.length - 1].end = now;
    }

    db.prepare(`
      UPDATE attendance SET
        punchOut = ?,
        status = 'completed',
        sessions = ?,
        breaks = ?,
        updatedAt = ?
      WHERE id = ?
    `).run(now, JSON.stringify(sessions), JSON.stringify(breaks), now, record.id);

    logAudit(req.user.name, 'Punch Out', today, 'Shift clocked out');
    return res.json({ message: 'Punched out. Great job today!', status: 'completed' });
  }

  if (action.startsWith('start_')) {
    const breakType = action.split('_')[1]; // 'lunch' or 'tea'
    breaks.push({ type: breakType, start: now, end: null });

    db.prepare(`
      UPDATE attendance SET
        status = ?,
        breaks = ?,
        updatedAt = ?
      WHERE id = ?
    `).run(breakType, JSON.stringify(breaks), now, record.id);

    return res.json({ message: `${breakType.toUpperCase()} break started`, status: breakType });
  }

  if (action === 'end_break') {
    if (breaks.length > 0 && breaks[breaks.length - 1].end === null) {
      breaks[breaks.length - 1].end = now;
    }

    db.prepare(`
      UPDATE attendance SET
        status = 'working',
        breaks = ?,
        updatedAt = ?
      WHERE id = ?
    `).run(JSON.stringify(breaks), now, record.id);

    return res.json({ message: 'Break ended. Resumed work!', status: 'working' });
  }

  res.status(400).json({ error: 'Unknown punch action' });
});

module.exports = router;
