# Virtue Core Business Solutions — Enterprise HRMS

A corporate-grade, full-stack Human Resource Management System (HRMS) featuring real-time attendance tracking with geolocation and office IP fencing, employee lifecycle management, leave approvals, shifts & rosters, document dossier verification, corporate appointment letter generation, and a monthly payroll engine.

---

## 🚀 Quickstart & Setup

### Prerequisites
- **Node.js**: v18.0.0 or later (v22+ recommended; tested on v26.8.2)
- **npm**: v9.0.0 or later

### Installation & Launch

```bash
# 1. Install dependencies
npm install

# 2. Start the production-ready server
npm start

# 3. For development with auto-reloading
npm run dev
```

Open your browser and navigate to:
```
http://localhost:3000
```

### Pre-configured Login Accounts

| Role | Username | Password | Access Level |
|---|---|---|---|
| **System Administrator** | `admin` | `admin` | Full system access, employee management, security settings, audits |
| **Site Supervisor** | `supervisor` | `supervisor` | Attendance oversight, leave approvals, roster assignments |
| **HR Specialist** | `hr` | `hr123` | Employee onboarding, document verification, leave & payroll runs |
| **Operations Executive** | `rohit.sharma` | `password123` | Personal clock-in/out, my payslips, leave applications, calendar |
| **Full Stack Engineer** | `priya.patel` | `password123` | Personal attendance, documents, requests |
| **Accounts Specialist** | `amit.verma` | `password123` | Personal attendance, payslips, leaves |
|
---

## ☁️ Cloud Hosting & Deployment (Render / Railway)

The repository comes pre-configured with **1-click blueprints** for **Render** (`render.yaml`), **Railway** (`railway.json`), and **Docker** (`Dockerfile`).

### Option 1: Deploy to Render.com (Free Tier)
1. Push this repository to your **GitHub** account:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git branch -M main
   git push -u origin main
   ```
2. Log into [Render.com](https://render.com) and click **"New +"** $\rightarrow$ **"Web Service"** (or **"Blueprint"**).
3. Connect your GitHub repository.
4. Render will automatically detect `render.yaml` or you can select:
   - **Environment**: `Node` (Node >= 22.5.0)
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health`
5. Click **"Deploy Web Service"**. In ~2 minutes, your HRMS will be live at `https://virtuecore-hrms-xxxx.onrender.com` with a free SSL certificate!

### Option 2: Deploy to Railway.app
1. Push this repository to **GitHub**.
2. Go to [Railway.app](https://railway.app), log in, and click **"New Project"** $\rightarrow$ **"Deploy from GitHub repo"**.
3. Select this repository. Railway reads `railway.json` / `package.json` and automatically builds and deploys.
4. Go to **Settings** $\rightarrow$ **Generate Domain** to get your public `https://xxxx.up.railway.app` URL.

---

## 📁 System Architecture

The single monolithic HTML file has been decoupled into an enterprise **Backend & Frontend Architecture**:

```
VC/
├── package.json                   # Project metadata and dependencies
├── server.js                      # Express HTTP server & static middleware
├── .env                           # Environment configuration
├── .env.example                   # Environment configuration template
├── data/
│   └── virtuecore.db              # High-performance SQLite database
├── src/
│   ├── config.js                  # Environment & runtime configuration
│   ├── db.js                      # SQLite schema, tables & automatic seed logic
│   ├── middleware/
│   │   └── auth.js                # JWT token verification & RBAC authorization
│   └── routes/
│       ├── auth.js                # Login, session validation, password changes
│       ├── users.js               # Employee directory & master record CRUD
│       ├── attendance.js          # Shift clocking, break tracking, geo & IP check
│       ├── leaves.js              # Leave applications, approvals & LOP deductions
│       ├── regularizations.js     # Shift regularizations & auto-attendance sync
│       ├── rosters.js             # Shift scheduling & bulk assignments
│       ├── documents.js           # Document dossier upload & verification
│       ├── holidays.js            # Corporate holiday master calendar
│       ├── announcements.js       # Departmental broadcast notices
│       ├── payroll.js             # Monthly salary computation & batch locking
│       ├── audits.js              # Security & administrative compliance trail
│       ├── settings.js            # Late arrival cutoff & office IP restrictions
│       └── demo.js                # Demo staff seeding & purging
├── public/                        # Client-side presentation layer
│   ├── index.html                 # UI markup matching exact corporate theme
│   ├── css/
│   │   └── style.css              # Custom styling, fonts, scrollbars & animations
│   └── js/
│       ├── api.js                 # JWT-authenticated REST client wrapper
│       └── app.js                 # State management, dashboards, jsPDF & Chart.js
├── virtue_core_enterprise_hrms.html # Original standalone file (fully debugged)
└── test-suite.js                  # 30-point automated integration test suite
```

---

## 🛠️ Bugs Identified & Fixed

During our deep audit of the original single-file implementation, multiple critical syntax, logic, and runtime errors were uncovered and resolved:

1. **File Truncation Midway Through Code**:
   - The original file was cut off at line 3499 inside `openEmpCreateModal`.
   - **Fix**: Rebuilt the complete employee modal logic, restored all closing braces, script tags, and HTML closing tags.

2. **Crashing Null Reference in Employee Modal (`emp-photo-base64`)**:
   - `openEmpCreateModal` tried to execute `document.getElementById('emp-photo-base64').value = ''`, but no element with ID `emp-photo-base64` existed in the markup, crashing the entire employee create/edit dialog.
   - **Fix**: Added the missing element to the modal and implemented safe optional access.

3. **Missing Approval Processing (`processApproval is not defined`)**:
   - The buttons to Approve/Reject regularizations and leaves called `processApproval()`, which was never defined globally or in window scope.
   - **Fix**: Implemented `processApproval` to approve/reject requests and automatically update the corresponding attendance record when a regularization is approved.

4. **Missing Shift Schedule Handlers (`openEditRosterModal`, `deleteRoster`)**:
   - Roster edit buttons threw `ReferenceError: openEditRosterModal is not defined` and delete threw `deleteRoster is not defined`.
   - Neither `edit-roster-form` nor `roster-form` had submit event listeners.
   - **Fix**: Built complete shift roster editing, assignment to individuals or ALL staff, deletion, and modal event binding.

5. **Missing Holiday Deletion (`deleteHoliday is not defined`)**:
   - Clicking delete on the company holiday table threw `ReferenceError: deleteHoliday is not defined`.
   - `holiday-form` lacked a submit listener.
   - **Fix**: Created the complete holiday submission and deletion workflow with custom confirmation dialogs.

6. **Missing User Administration Handlers (`toggleUserActive`, `resetUserPassword`)**:
   - Admin employee table action buttons for deactivating/reactivating users and resetting passwords threw `is not defined` errors.
   - **Fix**: Implemented `toggleUserActive` and `resetUserPassword` with audit logging.

7. **Dead Notification Bell (`btn-toggle-notif`)**:
   - The notification bell had no click listener, so clicking it never opened the notification drawer (`notif-drawer`).
   - **Fix**: Attached an event listener to toggle `notif-drawer` and close cleanly.

8. **Unbound Settings Buttons (`btn-save-late`, `btn-save-settings`)**:
   - The buttons to save the late threshold time and office IP restriction in the Settings tab had no event listeners.
   - **Fix**: Wired up event listeners to save settings to the backend and persist across sessions.

9. **Dead Password Change Form (`btn-save-password`)**:
   - The modal to change security passwords had an unbound button `btn-save-password`.
   - **Fix**: Implemented password validation (minimum 6 characters, password match check) and secure password updates.

10. **Missing Initializer Call (`initSystem()`)**:
    - Because the original file was truncated at the end, `initSystem()` was never called, causing the page to get stuck on "Connecting to Virtue Core Cloud...".
    - **Fix**: Ensured initialization triggers properly on page load.

---

## 🔒 Security Hardening Implemented

The original application had severe security vulnerabilities. Here is how each has been eliminated:

| Security Vector | Original Monolithic Implementation | New Backend Architecture |
|---|---|---|
| **Password Storage** | Plaintext passwords stored in Firestore and sent to client | Hashed with **bcryptjs** (10 salt rounds) on backend |
| **Authentication** | Client-side `array.find(u => u.username === u && u.password === p)` | Cryptographically signed **JWT tokens** with expiration |
| **Data Leakage** | All user passwords, Aadhaar, PAN, and salaries fetched into browser memory on page load | Strict **Role-Based Access Control (RBAC)**. Sensitive fields stripped from API responses |
| **Access Authorization** | Any user could modify any Firestore collection from browser console | Server-side token verification and role checks (`requireRoles`) |
| **IP Restriction Fencing** | Client-side JavaScript check (`fetch('api.ipify.org')`), easily bypassed | **Server-side validation** against incoming client IP address |
| **Data Protection** | Open client-side queries vulnerable to inspection and tampering | **SQL prepared statements** preventing SQL injection |
| **HTTP Headers** | No security headers | `nosniff`, `SAMEORIGIN`, `X-XSS-Protection`, strict CORS |

---

## 💡 What Features Are More Needed (Enterprise Roadmap)

To make Virtue Core HRMS a market-competing enterprise platform, the following features are recommended for next phases:

### 1. Hardware Biometric & Face Recognition Integration
- **ZKTeco / eSSL Device SDK Support**: Direct TCP/IP or webhook push integration with biometric thumb and face scanners so punches log directly to the server.
- **Geofenced Mobile Punching**: Enforce GPS radius fencing (e.g. 50-meter perimeter around office coordinates) for field staff.

### 2. Statutory Compliance & Payroll Engine Enhancements
- **Automated Tax Slabs**: Automated calculation for Indian New vs. Old Tax Regime with Form 16 generator.
- **Provident Fund (PF) & ESI Electronic Challan Cum Return (ECR)**: Direct export of EPFO/ESIC compliant monthly ECR text files.
- **Bonus, Gratuity & Arrears**: Automated computation of annual bonuses and arrears adjustments.

### 3. Multi-Level Approval Hierarchies
- **Configurable Workflows**: Multi-tier approvals for leaves and regularizations (e.g., Level 1: Reporting Manager $\rightarrow$ Level 2: Department Head $\rightarrow$ Level 3: HR).
- **Delegation of Authority**: Ability for managers to designate a temporary delegate while on leave.

### 4. Push & Email Notifications
- **Automated Email Dispatch**: Send PDF appointment letters and monthly payslips directly to employee corporate emails via SMTP/SendGrid.
- **Slack / Microsoft Teams / WhatsApp Bot**: Real-time alerts when a punch is missed or a leave is pending approval.

### 5. Performance Appraisal & KPI Management (PMS)
- **Quarterly / Annual Reviews**: Self-appraisal, manager evaluation, and 360-degree peer feedback.
- **Goal Cascading & OKRs**: Organization-wide objective tracking with progress meters.

### 6. Cloud Object Storage for Files
- **AWS S3 / Google Cloud Storage / Azure Blob**: Offload large document attachments (degree certificates, payslips, passports) to encrypted cloud storage with time-limited signed URLs.

### 7. Multi-Branch & Multi-Tenant Organization Structure
- **Branch / Entity Filtering**: Support multiple office branches, time zones, regional holiday lists, and departmental cost centers.

### 8. Two-Factor Authentication (2FA)
- **TOTP / Authenticator App**: Require Google Authenticator or SMS OTP for admin and payroll processing logins.

---

## 🧪 Verification & Testing

An automated test suite is included in [`test-suite.js`](file:///Users/manavsingh/Desktop/VC/test-suite.js). Run it anytime:

```bash
node test-suite.js
```

All 30 integration tests verify authentication, RBAC boundaries, punching, leaves, regularizations, payroll calculations, and audit logs.
