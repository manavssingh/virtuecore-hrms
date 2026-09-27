const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { db, logAudit } = require('../db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

// GET /api/users
router.get('/', authenticateToken, (req, res) => {
  const isMgmt = ['admin', 'hr', 'supervisor'].includes(req.user.role);

  if (isMgmt) {
    const users = db.prepare(`
      SELECT id, username, name, role, designation, department, empId, annualCTC,
             aadhar, pan, phone, email, address, joiningDate, profilePhoto, active, isDemo, createdAt, updatedAt
      FROM users
      ORDER BY name ASC
    `).all();

    const formatted = users.map(u => ({
      ...u,
      active: Boolean(u.active),
      isDemo: Boolean(u.isDemo)
    }));

    return res.json(formatted);
  }

  // Employee view: only public directory
  const directory = db.prepare(`
    SELECT id, name, role, designation, department, empId, phone, email, profilePhoto, active
    FROM users
    WHERE active = 1
    ORDER BY name ASC
  `).all();

  const formatted = directory.map(u => ({
    ...u,
    active: Boolean(u.active)
  }));

  res.json(formatted);
});

// POST /api/users (Admin only)
router.post('/', authenticateToken, requireRoles(['admin']), (req, res) => {
  const {
    username, password, name, role = 'employee', designation, department,
    empId, annualCTC, aadhar, pan, phone, email, address, joiningDate, profilePhoto
  } = req.body;

  if (!username || !password || !name || !email || !phone || !empId) {
    return res.status(400).json({ error: 'Required fields missing: username, password, name, email, phone, empId' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(username.trim());
  if (existing) {
    return res.status(409).json({ error: 'Username already taken. Please choose another.' });
  }

  const id = 'emp_' + crypto.randomUUID();
  const passwordHash = bcrypt.hashSync(password.trim(), 10);
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO users (
      id, username, password_hash, name, role, designation, department,
      empId, annualCTC, aadhar, pan, phone, email, address, joiningDate,
      profilePhoto, active, isDemo, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)
  `);

  stmt.run(
    id, username.trim(), passwordHash, name.trim(), role,
    designation || '', department || 'Operations', empId.trim(),
    Number(annualCTC) || 480000, aadhar || '', pan || '',
    phone.trim(), email.trim(), address || '', joiningDate || '',
    profilePhoto || '', now, now
  );

  logAudit(req.user.name, 'Employee Created', name.trim(), `Added employee ${empId} (${role})`);

  res.status(201).json({
    message: 'Employee created successfully',
    id
  });
});

// PUT /api/users/:id (Admin only)
router.put('/:id', authenticateToken, requireRoles(['admin']), (req, res) => {
  const { id } = req.params;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const {
    username, password, name, role, designation, department,
    empId, annualCTC, aadhar, pan, phone, email, address, joiningDate, profilePhoto
  } = req.body;

  const now = new Date().toISOString();
  let passwordHash = user.password_hash;
  if (password && password.trim().length >= 6) {
    passwordHash = bcrypt.hashSync(password.trim(), 10);
  }

  // Check unique username if updated
  if (username && username.trim().toLowerCase() !== user.username.toLowerCase()) {
    const dup = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?').get(username.trim(), id);
    if (dup) {
      return res.status(409).json({ error: 'Username already exists' });
    }
  }

  const stmt = db.prepare(`
    UPDATE users SET
      username = COALESCE(?, username),
      password_hash = ?,
      name = COALESCE(?, name),
      role = COALESCE(?, role),
      designation = COALESCE(?, designation),
      department = COALESCE(?, department),
      empId = COALESCE(?, empId),
      annualCTC = COALESCE(?, annualCTC),
      aadhar = COALESCE(?, aadhar),
      pan = COALESCE(?, pan),
      phone = COALESCE(?, phone),
      email = COALESCE(?, email),
      address = COALESCE(?, address),
      joiningDate = COALESCE(?, joiningDate),
      profilePhoto = COALESCE(?, profilePhoto),
      updatedAt = ?
    WHERE id = ?
  `);

  stmt.run(
    username ? username.trim() : null,
    passwordHash,
    name ? name.trim() : null,
    role || null,
    designation || null,
    department || null,
    empId ? empId.trim() : null,
    annualCTC ? Number(annualCTC) : null,
    aadhar || null,
    pan || null,
    phone ? phone.trim() : null,
    email ? email.trim() : null,
    address || null,
    joiningDate || null,
    profilePhoto !== undefined ? profilePhoto : null,
    now,
    id
  );

  logAudit(req.user.name, 'Employee Updated', name || user.name, `Updated master record for ${id}`);

  res.json({ message: 'User updated successfully' });
});

// POST /api/users/:id/toggle-active (Admin only)
router.post('/:id/toggle-active', authenticateToken, requireRoles(['admin']), (req, res) => {
  const { id } = req.params;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (user.role === 'admin') {
    return res.status(400).json({ error: 'Cannot deactivate Administrator account' });
  }

  const newStatus = user.active ? 0 : 1;
  const now = new Date().toISOString();

  db.prepare('UPDATE users SET active = ?, updatedAt = ? WHERE id = ?').run(newStatus, now, id);
  logAudit(req.user.name, newStatus ? 'User Reactivated' : 'User Deactivated', user.name, `Changed active to ${newStatus}`);

  res.json({
    message: `User ${newStatus ? 'activated' : 'deactivated'} successfully`,
    active: Boolean(newStatus)
  });
});

// POST /api/users/:id/reset-password (Admin only)
router.post('/:id/reset-password', authenticateToken, requireRoles(['admin']), (req, res) => {
  const { id } = req.params;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const defaultPassword = 'password123';
  const hash = bcrypt.hashSync(defaultPassword, 10);
  const now = new Date().toISOString();

  db.prepare('UPDATE users SET password_hash = ?, updatedAt = ? WHERE id = ?').run(hash, now, id);
  logAudit(req.user.name, 'Password Reset', user.name, 'Password reset to default (password123)');

  res.json({
    message: `Password for ${user.name} reset to default ('password123')`
  });
});

module.exports = router;
