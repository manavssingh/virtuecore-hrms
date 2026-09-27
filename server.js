const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./src/config');

// Initialize database & default seed data
require('./src/db');

const app = express();

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Serve Static Frontend Assets
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/attendance', require('./src/routes/attendance'));
app.use('/api/leaves', require('./src/routes/leaves'));
app.use('/api/regularizations', require('./src/routes/regularizations'));
app.use('/api/rosters', require('./src/routes/rosters'));
app.use('/api/documents', require('./src/routes/documents'));
app.use('/api/holidays', require('./src/routes/holidays'));
app.use('/api/announcements', require('./src/routes/announcements'));
app.use('/api/payroll', require('./src/routes/payroll'));
app.use('/api/audits', require('./src/routes/audits'));
app.use('/api/settings', require('./src/routes/settings'));
app.use('/api/demo', require('./src/routes/demo'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'Virtue Core Enterprise HRMS',
    timestamp: new Date().toISOString()
  });
});

// Fallback to index.html for frontend SPA routing
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  next();
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Server Uncaught Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

app.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Virtue Core Enterprise HRMS Server is Live!`);
  console.log(`📡 URL: http://localhost:${config.port}`);
  console.log(`🔒 Security: JWT Auth + bcrypt Password Hashing + RBAC`);
  console.log(`💾 Database: SQLite (Node Native Persistent Storage)`);
  console.log(`=======================================================`);
});
