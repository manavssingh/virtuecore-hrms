const express = require('express');
const router = express.Router();
const { seedDemoEmployees, purgeDemoEmployees, logAudit } = require('../db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

// POST /api/demo/seed (Admin only)
router.post('/seed', authenticateToken, requireRoles(['admin']), (req, res) => {
  seedDemoEmployees(true);
  logAudit(req.user.name, 'Demo Seeded', 'Demo Staff', 'Seeded 3 demo employees & attendance records');
  res.json({ message: 'Demo staff and attendance records seeded successfully!' });
});

// POST /api/demo/purge (Admin only)
router.post('/purge', authenticateToken, requireRoles(['admin']), (req, res) => {
  purgeDemoEmployees();
  logAudit(req.user.name, 'Demo Purged', 'Demo Staff', 'Purged all demo records');
  res.json({ message: 'All demo staff and associated records purged successfully!' });
});

module.exports = router;
