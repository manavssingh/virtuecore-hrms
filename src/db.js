const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(config.dbPath);

// Enable WAL mode and foreign keys for performance and reliability
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee',
    designation TEXT,
    department TEXT,
    empId TEXT,
    annualCTC REAL DEFAULT 480000,
    aadhar TEXT,
    pan TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    joiningDate TEXT,
    profilePhoto TEXT,
    active INTEGER DEFAULT 1,
    isDemo INTEGER DEFAULT 0,
    createdAt TEXT,
    updatedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    userName TEXT NOT NULL,
    date TEXT NOT NULL,
    punchIn TEXT,
    punchOut TEXT,
    sessions TEXT,
    breaks TEXT,
    status TEXT DEFAULT 'working',
    location TEXT,
    isRegularized INTEGER DEFAULT 0,
    createdAt TEXT,
    updatedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS leaves (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    userName TEXT NOT NULL,
    type TEXT NOT NULL,
    startDate TEXT NOT NULL,
    endDate TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'approved',
    actionedBy TEXT,
    actionedAt TEXT,
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS regularizations (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    userName TEXT NOT NULL,
    attendanceId TEXT,
    date TEXT NOT NULL,
    reqPunchIn TEXT NOT NULL,
    reqPunchOut TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    submittedAt TEXT,
    actionedBy TEXT,
    actionedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS rosters (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    userName TEXT NOT NULL,
    date TEXT NOT NULL,
    startTime TEXT NOT NULL,
    endTime TEXT NOT NULL,
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    userName TEXT NOT NULL,
    type TEXT NOT NULL,
    fileData TEXT,
    status TEXT DEFAULT 'Pending',
    rejectionReason TEXT,
    timestamp TEXT,
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS audits (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT,
    details TEXT
  );

  CREATE TABLE IF NOT EXISTS holidays (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'National Holiday',
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    department TEXT DEFAULT 'ALL',
    message TEXT NOT NULL,
    author TEXT NOT NULL,
    targetType TEXT DEFAULT 'ALL',
    targetUserId TEXT,
    targetUserName TEXT,
    requiresAck INTEGER DEFAULT 0,
    acknowledgements TEXT DEFAULT '[]',
    timestamp TEXT,
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS payroll_batches (
    id TEXT PRIMARY KEY,
    monthYear TEXT NOT NULL,
    processedAt TEXT,
    approvedAt TEXT,
    approvedBy TEXT,
    totalDisbursement REAL,
    employeeCount INTEGER,
    records TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Audit logger helper
function logAudit(actor, action, target, details) {
  try {
    const id = 'aud_' + crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const stmt = db.prepare('INSERT INTO audits (id, timestamp, actor, action, target, details) VALUES (?, ?, ?, ?, ?, ?)');
    stmt.run(id, timestamp, actor || 'System', action, target || '', details || '');
  } catch (err) {
    console.error('Failed to log audit:', err);
  }
}

// Initial System Seeding
function initDefaultData() {
  // Settings
  const getSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
  const setSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

  if (!getSetting.get('lateThreshold')) {
    setSetting.run('lateThreshold', '09:30');
  }
  if (!getSetting.get('restrictIP')) {
    setSetting.run('restrictIP', 'false');
  }
  if (!getSetting.get('allowedIP')) {
    setSetting.run('allowedIP', '');
  }

  // System Accounts
  const getUser = db.prepare('SELECT * FROM users WHERE username = ?');
  const insertUser = db.prepare(`
    INSERT INTO users (id, username, password_hash, name, role, designation, department, empId, annualCTC, active, isDemo, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?)
  `);

  const now = new Date().toISOString();

  // Admin
  if (!getUser.get('admin')) {
    const hash = bcrypt.hashSync('admin', 10);
    insertUser.run('sys_admin', 'admin', hash, 'System Administrator', 'admin', 'Chief Administrator', 'Executive', 'VC-ADM-01', 1200000, now);
    logAudit('System', 'System Init', 'sys_admin', 'Initial system administrator initialized');
  }

  // Supervisor
  if (!getUser.get('supervisor')) {
    const hash = bcrypt.hashSync('supervisor', 10);
    insertUser.run('sys_supervisor', 'supervisor', hash, 'Site Supervisor', 'supervisor', 'Ops Supervisor', 'Operations', 'VC-SUP-01', 540000, now);
  }

  // HR Manager
  if (!getUser.get('hr')) {
    const hash = bcrypt.hashSync('hr123', 10);
    insertUser.run('sys_hr', 'hr', hash, 'HR Manager', 'hr', 'HR Lead', 'HR', 'VC-HR-01', 600000, now);
  }

  // Auto seed demo employees if not present
  const checkDemo = db.prepare("SELECT COUNT(*) as count FROM users WHERE isDemo = 1").get();
  if (!checkDemo || checkDemo.count === 0) {
    seedDemoEmployees(false);
  }
}

function seedDemoEmployees(reseed = false) {
  if (reseed) {
    purgeDemoEmployees();
  }

  const now = new Date().toISOString();
  const hash = bcrypt.hashSync('password123', 10);
  const insertUser = db.prepare(`
    INSERT OR REPLACE INTO users (id, username, password_hash, name, role, designation, department, empId, annualCTC, aadhar, pan, phone, email, active, isDemo, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)
  `);

  const demoUsers = [
    ['demo_emp_01', 'rohit.sharma', hash, 'Rohit Sharma', 'employee', 'Operations Executive', 'Operations', 'VC-EMP-01', 480000, '123412341234', 'ABCDE1234F', '9876543210', 'rohit.sharma@virtuecore.com', now],
    ['demo_emp_02', 'priya.patel', hash, 'Priya Patel', 'employee', 'Full Stack Engineer', 'IT', 'VC-EMP-02', 600000, '234523452345', 'BCDEF2345G', '9876543211', 'priya.patel@virtuecore.com', now],
    ['demo_emp_03', 'amit.verma', hash, 'Amit Verma', 'employee', 'Accounts Specialist', 'Finance', 'VC-EMP-03', 360000, '345634563456', 'CDEFG3456H', '9876543212', 'amit.verma@virtuecore.com', now]
  ];

  for (const u of demoUsers) {
    insertUser.run(...u);
  }

  // Seed 30 days of realistic attendance for September 2026
  const insertAtt = db.prepare(`
    INSERT OR REPLACE INTO attendance (id, userId, userName, date, punchIn, punchOut, sessions, breaks, status, location, isRegularized, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (let i = 1; i <= 28; i++) {
    const d = `2026-09-${String(i).padStart(2, '0')}`;
    const dow = new Date(d + 'T12:00:00Z').getDay();
    if (dow === 0 || dow === 6) continue; // Skip weekends

    // Rohit
    insertAtt.run(
      `att_rohit_${d}`, 'demo_emp_01', 'Rohit Sharma', d,
      `${d}T09:15:00Z`, `${d}T18:15:00Z`,
      JSON.stringify([{ in: `${d}T09:15:00Z`, out: `${d}T18:15:00Z` }]),
      JSON.stringify([{ type: 'lunch', start: `${d}T13:00:00Z`, end: `${d}T14:00:00Z` }]),
      'completed', JSON.stringify({ lat: 28.6139, lng: 77.2090, accuracy: 15 }), 0, now
    );

    // Priya
    if (!['2026-09-03', '2026-09-04', '2026-09-15', '2026-09-16'].includes(d)) {
      insertAtt.run(
        `att_priya_${d}`, 'demo_emp_02', 'Priya Patel', d,
        `${d}T09:48:00Z`, `${d}T18:45:00Z`,
        JSON.stringify([{ in: `${d}T09:48:00Z`, out: `${d}T18:45:00Z` }]),
        JSON.stringify([{ type: 'lunch', start: `${d}T13:00:00Z`, end: `${d}T14:00:00Z` }]),
        'completed', JSON.stringify({ lat: 28.6139, lng: 77.2090, accuracy: 12 }), 0, now
      );
    }

    // Amit
    if (d !== '2026-09-22') {
      insertAtt.run(
        `att_amit_${d}`, 'demo_emp_03', 'Amit Verma', d,
        `${d}T09:20:00Z`, `${d}T18:25:00Z`,
        JSON.stringify([{ in: `${d}T09:20:00Z`, out: `${d}T18:25:00Z` }]),
        JSON.stringify([{ type: 'lunch', start: `${d}T13:00:00Z`, end: `${d}T14:00:00Z` }]),
        'completed', JSON.stringify({ lat: 28.6139, lng: 77.2090, accuracy: 10 }), 0, now
      );
    }
  }

  // Today's live shifts
  const today = new Date().toLocaleDateString('en-CA');
  insertAtt.run(
    `att_rohit_${today}`, 'demo_emp_01', 'Rohit Sharma', today,
    `${today}T09:12:00Z`, null,
    JSON.stringify([{ in: `${today}T09:12:00Z`, out: null }]),
    JSON.stringify([]),
    'working', JSON.stringify({ lat: 28.6139, lng: 77.2090 }), 0, now
  );

  insertAtt.run(
    `att_priya_${today}`, 'demo_emp_02', 'Priya Patel', today,
    `${today}T09:42:00Z`, null,
    JSON.stringify([{ in: `${today}T09:42:00Z`, out: null }]),
    JSON.stringify([{ type: 'lunch', start: `${today}T13:05:00Z`, end: null }]),
    'lunch', JSON.stringify({ lat: 28.6139, lng: 77.2090 }), 0, now
  );

  insertAtt.run(
    `att_amit_${today}`, 'demo_emp_03', 'Amit Verma', today,
    `${today}T09:05:00Z`, `${today}T18:10:00Z`,
    JSON.stringify([{ in: `${today}T09:05:00Z`, out: `${today}T18:10:00Z` }]),
    JSON.stringify([]),
    'completed', JSON.stringify({ lat: 28.6139, lng: 77.2090 }), 0, now
  );

  // Seed demo leaves
  const insertLeave = db.prepare(`
    INSERT OR REPLACE INTO leaves (id, userId, userName, type, startDate, endDate, reason, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertLeave.run('leave_rohit_01', 'demo_emp_01', 'Rohit Sharma', 'Casual Leave', '2026-09-08', '2026-09-09', 'Family Function', 'approved', now);
  insertLeave.run('leave_priya_01', 'demo_emp_02', 'Priya Patel', 'Sick Leave', '2026-09-03', '2026-09-04', 'Fever', 'approved', now);
  insertLeave.run('leave_priya_02', 'demo_emp_02', 'Priya Patel', 'Unpaid Leave', '2026-09-15', '2026-09-16', 'Personal Emergency (LOP)', 'approved', now);
  insertLeave.run('leave_amit_01', 'demo_emp_03', 'Amit Verma', 'Unpaid Leave', '2026-09-22', '2026-09-22', 'Personal Leave (LOP)', 'approved', now);

  // Seed company holidays
  const insertHoliday = db.prepare(`
    INSERT OR IGNORE INTO holidays (id, date, name, type, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertHoliday.run('hol_01', '2026-01-26', 'Republic Day', 'National Holiday', now);
  insertHoliday.run('hol_02', '2026-08-15', 'Independence Day', 'National Holiday', now);
  insertHoliday.run('hol_03', '2026-10-02', 'Gandhi Jayanti', 'National Holiday', now);
  insertHoliday.run('hol_04', '2026-11-08', 'Diwali', 'Festival', now);

  // Seed an announcement
  const insertAnn = db.prepare(`
    INSERT OR IGNORE INTO announcements (id, title, department, message, author, timestamp, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertAnn.run(
    'ann_welcome',
    'Virtue Core Enterprise HRMS Online',
    'ALL',
    'Welcome to the unified corporate attendance, payroll, and workforce governance portal.',
    'System Administrator',
    now,
    now
  );
}

function purgeDemoEmployees() {
  const demoIds = ['demo_emp_01', 'demo_emp_02', 'demo_emp_03'];
  for (const id of demoIds) {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    db.prepare('DELETE FROM attendance WHERE userId = ?').run(id);
    db.prepare('DELETE FROM leaves WHERE userId = ?').run(id);
    db.prepare('DELETE FROM regularizations WHERE userId = ?').run(id);
    db.prepare('DELETE FROM rosters WHERE userId = ?').run(id);
    db.prepare('DELETE FROM documents WHERE userId = ?').run(id);
  }
}

initDefaultData();

module.exports = {
  db,
  logAudit,
  seedDemoEmployees,
  purgeDemoEmployees
};
