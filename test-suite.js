const http = require('http');

async function runTests() {
  console.log('🧪 Starting Virtue Core Enterprise HRMS Test Suite...\n');

  // Launch server in-process
  require('./server');
  await new Promise(r => setTimeout(r, 600));

  const BASE_URL = 'http://localhost:3000/api';

  async function api(path, options = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
  }

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Health check
    console.log('--- 1. Health & Server Check ---');
    const health = await api('/health');
    assert(health.status === 200 && health.data.status === 'online', 'Health endpoint returns 200 online');

    // 2. Auth Tests
    console.log('\n--- 2. Authentication & Security ---');
    const invalidLogin = await api('/auth/login', {
      method: 'POST',
      body: { username: 'admin', password: 'wrongpassword' }
    });
    assert(invalidLogin.status === 401, 'Rejects invalid login credentials with 401');

    const adminLogin = await api('/auth/login', {
      method: 'POST',
      body: { username: 'admin', password: 'admin' }
    });
    assert(adminLogin.status === 200 && !!adminLogin.data.token, 'Admin login succeeds with JWT token');
    assert(adminLogin.data.user.password_hash === undefined, 'Password hash is NOT leaked in login response');
    const adminToken = adminLogin.data.token;

    const me = await api('/auth/me', { headers: { Authorization: `Bearer ${adminToken}` } });
    assert(me.status === 200 && me.data.user.username === 'admin', 'Get current session profile /auth/me');

    // Demo Employee Login
    const empLogin = await api('/auth/login', {
      method: 'POST',
      body: { username: 'rohit.sharma', password: 'password123' }
    });
    assert(empLogin.status === 200 && empLogin.data.user.role === 'employee', 'Employee login succeeds');
    const empToken = empLogin.data.token;

    // 3. User Directory & Privacy Isolation
    console.log('\n--- 3. RBAC & Data Privacy ---');
    const adminUsers = await api('/users', { headers: { Authorization: `Bearer ${adminToken}` } });
    assert(adminUsers.status === 200 && adminUsers.data.length >= 4, 'Admin can view all employee records');
    assert(adminUsers.data[0].annualCTC !== undefined, 'Admin can see annual CTC');

    const empUsers = await api('/users', { headers: { Authorization: `Bearer ${empToken}` } });
    assert(empUsers.status === 200, 'Employee can view public directory');
    const otherEmp = empUsers.data.find(u => u.name !== 'Rohit Sharma');
    assert(otherEmp && otherEmp.aadhar === undefined && otherEmp.pan === undefined && otherEmp.annualCTC === undefined, 'Sensitive fields (Aadhaar, PAN, CTC) hidden from employee view');

    // 4. Attendance & Punching
    console.log('\n--- 4. Attendance Clock & Location ---');
    const punchIn = await api('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${empToken}` },
      body: { action: 'punch_in', location: { lat: 28.6139, lng: 77.2090 } }
    });
    assert(punchIn.status === 200 && punchIn.data.status === 'working', 'Employee can punch in with GPS coordinates');

    const punchLunch = await api('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${empToken}` },
      body: { action: 'start_lunch' }
    });
    assert(punchLunch.status === 200 && punchLunch.data.status === 'lunch', 'Employee can start lunch break');

    const punchEndLunch = await api('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${empToken}` },
      body: { action: 'end_break' }
    });
    assert(punchEndLunch.status === 200 && punchEndLunch.data.status === 'working', 'Employee can end break and resume work');

    const punchOut = await api('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${empToken}` },
      body: { action: 'punch_out' }
    });
    assert(punchOut.status === 200 && punchOut.data.status === 'completed', 'Employee can punch out at end of shift');

    // 5. Leaves & Approvals
    console.log('\n--- 5. Leaves & Deductions ---');
    const applyLeave = await api('/leaves', {
      method: 'POST',
      headers: { Authorization: `Bearer ${empToken}` },
      body: { type: 'Casual Leave', startDate: '2026-10-15', endDate: '2026-10-16', reason: 'Personal work' }
    });
    assert(applyLeave.status === 201 && !!applyLeave.data.id, 'Employee can apply for leave');
    const leaveId = applyLeave.data.id;

    const approveLeave = await api(`/leaves/${leaveId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'approved' }
    });
    assert(approveLeave.status === 200, 'Admin can approve leave request');

    // 6. Regularization Requests & Attendance Auto-Update
    console.log('\n--- 6. Regularization & Shift Calibration ---');
    const regReq = await api('/regularizations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${empToken}` },
      body: {
        date: '2026-09-20',
        reqPunchIn: '2026-09-20T09:00:00Z',
        reqPunchOut: '2026-09-20T18:00:00Z',
        reason: 'Client site direct visit'
      }
    });
    assert(regReq.status === 201 && !!regReq.data.id, 'Employee can submit regularization request');
    const regId = regReq.data.id;

    const approveReg = await api(`/regularizations/${regId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'approved' }
    });
    assert(approveReg.status === 200, 'Admin can approve regularization request');

    // Verify attendance was updated or created
    const attCheck = await api('/attendance?date=2026-09-20', {
      headers: { Authorization: `Bearer ${empToken}` }
    });
    const regAtt = attCheck.data.find(r => r.date === '2026-09-20');
    assert(regAtt && regAtt.isRegularized === true, 'Attendance is automatically regularized in DB');

    // 7. Payroll Engine Calculation & Disbursement
    console.log('\n--- 7. Payroll Engine & Statutory Deductions ---');
    const payrollRun = await api('/payroll/process', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { month: '2026-09' }
    });
    assert(payrollRun.status === 200 && payrollRun.data.records.length >= 3, 'Calculates monthly payroll run for all employees');
    assert(payrollRun.data.summary.totalGross > 0 && payrollRun.data.summary.totalNet > 0, 'Computes gross and net disbursements');

    const lockPayroll = await api('/payroll/lock', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { month: '2026-09', records: payrollRun.data.records }
    });
    assert(lockPayroll.status === 200, 'Admin locks and approves payroll batch');

    const myPayslips = await api('/payroll/my-payslips', {
      headers: { Authorization: `Bearer ${empToken}` }
    });
    assert(myPayslips.status === 200 && myPayslips.data.length >= 1, 'Employee can retrieve disbursed payslip statement');

    // 8. Holidays & Announcements
    console.log('\n--- 8. Holidays & Announcements ---');
    const addHol = await api('/holidays', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { name: 'New Year Day', date: '2027-01-01', type: 'National Holiday' }
    });
    assert(addHol.status === 201, 'Admin can add holiday');

    const holList = await api('/holidays', { headers: { Authorization: `Bearer ${empToken}` } });
    assert(holList.status === 200 && holList.data.some(h => h.name === 'New Year Day'), 'Employee can view holiday calendar');

    const addAnn = await api('/announcements', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { title: 'Q4 Strategy Meeting', department: 'ALL', message: 'All-hands meeting scheduled for Friday 4 PM.' }
    });
    assert(addAnn.status === 201, 'Admin can post company announcement');

    const annList = await api('/announcements', { headers: { Authorization: `Bearer ${empToken}` } });
    assert(annList.status === 200 && annList.data.some(a => a.title === 'Q4 Strategy Meeting'), 'Employee receives announcement');

    // 9. Audits & Compliance
    console.log('\n--- 9. Audits & Compliance Trail ---');
    const audits = await api('/audits', { headers: { Authorization: `Bearer ${adminToken}` } });
    assert(audits.status === 200 && audits.data.length > 5, 'Comprehensive audit trail captured in DB');

    // 10. Settings & IP Policy
    console.log('\n--- 10. Global Settings ---');
    const updateSettings = await api('/settings', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { lateThreshold: '09:45', restrictIP: false, allowedIP: '192.168.1.1' }
    });
    assert(updateSettings.status === 200, 'Admin can update global HRMS policies');

    const settingsCheck = await api('/settings', { headers: { Authorization: `Bearer ${empToken}` } });
    assert(settingsCheck.data.lateThreshold === '09:45', 'Settings verified across system');

    console.log(`\n========================================`);
    console.log(`📊 Test Summary: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);

    process.exit(failed === 0 ? 0 : 1);
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runTests();
