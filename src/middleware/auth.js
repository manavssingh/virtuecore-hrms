const jwt = require('jsonwebtoken');
const config = require('../config');
const { db } = require('../db');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  jwt.verify(token, config.jwtSecret, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired session token' });
    }

    const user = db.prepare('SELECT id, username, name, role, designation, department, empId, annualCTC, aadhar, pan, phone, email, address, joiningDate, profilePhoto, active FROM users WHERE id = ?').get(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'User account no longer exists' });
    }

    if (user.role !== 'admin' && user.active === 0) {
      return res.status(403).json({ error: 'Account has been deactivated. Contact HR/Admin.' });
    }

    req.user = user;
    next();
  });
}

function requireRoles(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Unauthorized: insufficient privileges' });
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  requireRoles
};
