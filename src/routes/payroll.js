const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db, logAudit } = require('../db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

// GET /api/payroll/batches (Admin/HR only)
router.get('/batches', authenticateToken, requireRoles(['admin', 'hr']), (req, res) => {
  const batches = db.prepare('SELECT * FROM payroll_batches ORDER BY monthYear DESC').all();
  const parsed = batches.map(b => ({
    ...b,
    records: b.records ? JSON.parse(b.records) : []
  }));
  res.json(parsed);
});

// GET /api/payroll/my-payslips (Employee personal payslips)
router.get('/my-payslips', authenticateToken, (req, res) => {
  const batches = db.prepare('SELECT * FROM payroll_batches ORDER BY monthYear DESC').all();
  const myPayslips = [];

  for (const b of batches) {
    const records = b.records ? JSON.parse(b.records) : [];
    const myRec = records.find(r => r.userId === req.user.id);
    if (myRec) {
      myPayslips.push({
        batchId: b.id,
        monthYear: b.monthYear,
        approvedAt: b.approvedAt,
        approvedBy: b.approvedBy,
        ...myRec
      });
    }
  }

  res.json(myPayslips);
});

// POST /api/payroll/process (Admin/HR only)
router.post('/process', authenticateToken, requireRoles(['admin', 'hr']), (req, res) => {
  const { month } = req.body;
  if (!month || !month.includes('-')) {
    return res.status(400).json({ error: 'Valid month in YYYY-MM format required' });
  }

  const [y, m] = month.split('-').map(Number);
  const totalDaysInMonth = new Date(y, m, 0).getDate();

  const eligibleEmployees = db.prepare("SELECT * FROM users WHERE role IN ('employee', 'supervisor') AND active = 1").all();
  const allApprovedLeaves = db.prepare("SELECT * FROM leaves WHERE status = 'approved' AND type = 'Unpaid Leave'").all();
  const holidays = db.prepare('SELECT date FROM holidays').all().map(h => h.date);

  let totalGross = 0;
  let totalLOP = 0;
  let totalStat = 0;
  let totalNet = 0;

  const records = eligibleEmployees.map(u => {
    const annualCTC = Number(u.annualCTC) || 480000;
    const monthlyCTC = Math.round(annualCTC / 12);
    const dailyRate = Math.round(monthlyCTC / totalDaysInMonth);

    const empLeaves = allApprovedLeaves.filter(l => l.userId === u.id);
    let unpaidDays = 0;

    empLeaves.forEach(l => {
      let cur = new Date(l.startDate + 'T12:00:00Z');
      const end = new Date(l.endDate + 'T12:00:00Z');

      while (cur <= end) {
        const curStr = cur.toISOString().split('T')[0];
        if (curStr.startsWith(month)) {
          const dow = cur.getDay();
          const isWeekend = (dow === 0 || dow === 6);
          const isHoliday = holidays.includes(curStr);

          // Weekends and holidays are exempt from LOP penalty
          if (!isWeekend && !isHoliday) {
            unpaidDays++;
          }
        }
        cur.setDate(cur.getDate() + 1);
      }
    });

    const lopDeduction = unpaidDays * dailyRate;
    const earnedGross = Math.max(0, monthlyCTC - lopDeduction);

    const pf = Math.round(monthlyCTC * 0.05);
    const pt = 200;
    const totalDeductions = lopDeduction + pf + pt;
    const netPay = Math.max(0, monthlyCTC - totalDeductions);

    totalGross += monthlyCTC;
    totalLOP += lopDeduction;
    totalStat += (pf + pt);
    totalNet += netPay;

    return {
      userId: u.id,
      name: u.name,
      empId: u.empId || 'N/A',
      department: u.department || 'Operations',
      designation: u.designation || 'Staff',
      annualCTC,
      monthlyCTC,
      totalDaysInMonth,
      unpaidDays,
      lopDeduction,
      earnedGross,
      pf,
      pt,
      totalDeductions,
      netPay,
      month
    };
  });

  res.json({
    month,
    summary: {
      totalGross,
      totalLOP,
      totalStat,
      totalNet,
      employeeCount: records.length
    },
    records
  });
});

// POST /api/payroll/lock (Admin/HR only)
router.post('/lock', authenticateToken, requireRoles(['admin', 'hr']), (req, res) => {
  const { month, records } = req.body;

  if (!month || !records || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Month and calculated records array required' });
  }

  const id = 'batch_' + month;
  const now = new Date().toISOString();
  const totalDisbursement = records.reduce((acc, r) => acc + (Number(r.netPay) || 0), 0);

  db.prepare(`
    INSERT OR REPLACE INTO payroll_batches (id, monthYear, processedAt, approvedAt, approvedBy, totalDisbursement, employeeCount, records)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, month, now, now, req.user.name, totalDisbursement, records.length, JSON.stringify(records)
  );

  logAudit(req.user.name, 'Payroll Approved', month, `Disbursed for ${records.length} employees (₹${totalDisbursement.toLocaleString('en-IN')})`);

  res.json({
    message: `Payroll locked and approved for ${month}! Payslips are now available.`,
    batchId: id
  });
});

module.exports = router;
