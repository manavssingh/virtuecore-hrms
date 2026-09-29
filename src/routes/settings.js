const express = require('express');
const router = express.Router();
const { db, logAudit } = require('../db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

// GET /api/settings
router.get('/', authenticateToken, (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {
    lateThreshold: '09:30',
    restrictIP: false,
    allowedIP: ''
  };

  rows.forEach(r => {
    if (r.key === 'restrictIP') settings.restrictIP = r.value === 'true';
    else settings[r.key] = r.value;
  });

  res.json(settings);
});

// PUT /api/settings (Admin only)
router.put('/', authenticateToken, requireRoles(['admin']), (req, res) => {
  const { lateThreshold, restrictIP, allowedIP } = req.body;
  const setSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

  if (lateThreshold !== undefined) {
    setSetting.run('lateThreshold', String(lateThreshold));
    logAudit(req.user.name, 'Settings Updated', 'Late Threshold', `Updated cutoff to ${lateThreshold}`);
  }

  if (restrictIP !== undefined) {
    setSetting.run('restrictIP', String(Boolean(restrictIP)));
    logAudit(req.user.name, 'Settings Updated', 'IP Restriction', `Restricted: ${restrictIP}`);
  }

  if (allowedIP !== undefined) {
    setSetting.run('allowedIP', String(allowedIP).trim());
    logAudit(req.user.name, 'Settings Updated', 'Allowed IP', `IP set to ${allowedIP}`);
  }

  res.json({ message: 'Settings updated successfully' });
});

// GET /api/settings/backup (Admin only - downloads clean snapshot of SQLite DB)
router.get('/backup', authenticateToken, requireRoles(['admin']), (req, res) => {
  const fs = require('fs');
  const config = require('../config');

  if (!fs.existsSync(config.dbPath)) {
    return res.status(404).json({ error: 'Database file not found' });
  }

  // Flush WAL changes to main DB file before download
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch (err) {
    console.error('WAL checkpoint warning:', err);
  }

  const filename = `virtuecore-backup-${new Date().toISOString().slice(0, 10)}.db`;
  res.download(config.dbPath, filename, (err) => {
    if (!err) {
      logAudit(req.user.name, 'Database Backup Downloaded', filename, 'SQLite database snapshot downloaded');
    }
  });
});

module.exports = router;
