const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db, logAudit } = require('../db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

// GET /api/documents
router.get('/', authenticateToken, (req, res) => {
  const isMgmt = ['admin', 'hr', 'supervisor'].includes(req.user.role);

  if (isMgmt) {
    const docs = db.prepare('SELECT * FROM documents ORDER BY timestamp DESC').all();
    return res.json(docs);
  }

  const myDocs = db.prepare('SELECT * FROM documents WHERE userId = ? ORDER BY timestamp DESC').all(req.user.id);
  res.json(myDocs);
});

// POST /api/documents
router.post('/', authenticateToken, (req, res) => {
  const { type, fileData } = req.body;

  if (!type || !fileData) {
    return res.status(400).json({ error: 'Document category and file data are required.' });
  }

  const id = 'doc_' + crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO documents (id, userId, userName, type, fileData, status, rejectionReason, timestamp, createdAt)
    VALUES (?, ?, ?, ?, ?, 'Pending', NULL, ?, ?)
  `).run(id, req.user.id, req.user.name, type, fileData, now, now);

  logAudit(req.user.name, 'Document Uploaded', type, `Uploaded file for verification`);

  res.status(201).json({
    message: 'Document submitted for HR verification!',
    id
  });
});

// PUT /api/documents/:id/verify (Admin/HR only)
router.put('/:id/verify', authenticateToken, requireRoles(['admin', 'hr']), (req, res) => {
  const { id } = req.params;
  const { status, rejectionReason } = req.body;

  if (!['Verified', 'Rejected'].includes(status)) {
    return res.status(400).json({ error: "Status must be 'Verified' or 'Rejected'" });
  }

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  db.prepare(`
    UPDATE documents SET
      status = ?,
      rejectionReason = ?
    WHERE id = ?
  `).run(status, rejectionReason || null, id);

  logAudit(req.user.name, `Document ${status}`, doc.userName, `${doc.type}: ${rejectionReason || 'Approved'}`);

  res.json({ message: `Document marked as ${status}` });
});

module.exports = router;
