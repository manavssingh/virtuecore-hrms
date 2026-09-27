// Virtue Core Enterprise HRMS - Enterprise Frontend Application Engine
// Secured with Backend REST API + JWT Authentication + SQLite Storage

// Primary Date & Formatting Utilities
const getTodayString = () => new Date().toLocaleDateString('en-CA');
const formatTime = (iso) => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '--';
const formatCurrency = (amt) => '₹' + Number(amt || 0).toLocaleString('en-IN');

const state = {
    isSystemReady: false,
    currentUser: null,
    allUsers: [],
    allRecords: [],
    allLeaves: [],
    allReqs: [],
    allRosters: [],
    allDocs: [],
    allAudits: [],
    allHolidays: [],
    allAnnouncements: [],
    payrollBatches: [],
    currentPayrollRun: [],
    settings: { restrictIP: false, allowedIP: '', lateThreshold: '09:30' },
    dashboardFilter: { preset: 'today', startDate: getTodayString(), endDate: getTodayString() },
    myIP: null,
    charts: { weekly: null, monthly: null, late: null, leave: null }
};

const DOM = {
    loginView: document.getElementById('login-view'),
    appView: document.getElementById('app-view'),
    initLoading: document.getElementById('init-loading'),
    loginForm: document.getElementById('login-form'),
    toastContainer: document.getElementById('toast-container')
};

// Custom Confirm & Prompt Promise Wrappers (Zero browser confirm/alert)
window.customConfirm = (msg, title = "Confirm Action") => {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm-modal');
        document.getElementById('confirm-modal-title').textContent = title;
        document.getElementById('confirm-modal-msg').textContent = msg;
        modal.classList.remove('hidden');

        const btnOk = document.getElementById('confirm-modal-btn-ok');
        const btnCancel = document.getElementById('confirm-modal-btn-cancel');

        const cleanup = (val) => {
            modal.classList.add('hidden');
            btnOk.removeEventListener('click', onOk);
            btnCancel.removeEventListener('click', onCancel);
            resolve(val);
        };

        const onOk = () => cleanup(true);
        const onCancel = () => cleanup(false);

        btnOk.addEventListener('click', onOk);
        btnCancel.addEventListener('click', onCancel);
    });
};

window.customPrompt = (msg, title = "Provide Details") => {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-prompt-modal');
        document.getElementById('prompt-modal-title').textContent = title;
        document.getElementById('prompt-modal-msg').textContent = msg;
        const input = document.getElementById('prompt-modal-input');
        input.value = '';
        modal.classList.remove('hidden');
        input.focus();

        const btnOk = document.getElementById('prompt-modal-btn-ok');
        const btnCancel = document.getElementById('prompt-modal-btn-cancel');

        const cleanup = (val) => {
            modal.classList.add('hidden');
            btnOk.removeEventListener('click', onOk);
            btnCancel.removeEventListener('click', onCancel);
            resolve(val);
        };

        const onOk = () => cleanup(input.value.trim());
        const onCancel = () => cleanup(null);

        btnOk.addEventListener('click', onOk);
        btnCancel.addEventListener('click', onCancel);
    });
};

window.closeModal = (id) => {
    const m = document.getElementById(id);
    if (m) m.classList.add('hidden');
};

window.togglePasswordVisibility = (inputId, iconId) => {
    const inp = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (!inp) return;
    if (inp.type === 'password') {
        inp.type = 'text';
        if (icon) { icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash'); }
    } else {
        inp.type = 'password';
        if (icon) { icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); }
    }
};

window.showToast = (message, type = 'success') => {
    const container = DOM.toastContainer || document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
    const border = type === 'success' ? 'border-emerald-500 bg-white text-emerald-900' : type === 'error' ? 'border-rose-500 bg-white text-rose-900' : 'border-blue-500 bg-white text-blue-900';

    toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border-l-4 ${border} text-xs font-semibold toast-enter`;
    toast.innerHTML = `<i class="fas ${icon} text-base"></i><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('toast-enter');
        toast.classList.add('toast-leave');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
};

// Geo Location Helper
const getGeo = () => new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        () => resolve(null),
        { timeout: 5000, enableHighAccuracy: true }
    );
});


const JOB_RESPONSIBILITIES_LIBRARY = {
            "Chief Operating Officer (COO)": [
                "Direct company-wide daily operational governance, quality benchmarks, and cross-functional performance metrics.",
                "Formulate and execute business scaling strategies, capacity-planning frameworks, and client delivery lifecycles.",
                "Ensure enterprise risk mitigation, regulatory compliance, and fiscal discipline across departments.",
                "Report directly to the Board of Directors on operational KPIs and organizational milestones."
            ],
            "Operations Executive": [
                "Execute day-to-day corporate operations, service fulfillment, and client coordination.",
                "Maintain accurate logging of shifts, tasks, and operational performance metrics.",
                "Collaborate with team leads to resolve client escalations and uphold delivery SLAs."
            ],
            "Full Stack Engineer": [
                "Design, build, and maintain scalable web architectures, frontend interfaces, and backend APIs.",
                "Participate in peer code reviews, optimize database queries, and uphold robust engineering standards.",
                "Diagnose production incidents, deploy hotfixes, and maintain reliable software uptime."
            ],
            "Accounts Specialist": [
                "Administer general ledger maintenance, accounts payable, accounts receivable, and reconciliation.",
                "Compute monthly payroll deductions, statutory filings (PF, PT, TDS), and financial ledgers.",
                "Generate transparent financial reports for management audits and tax filings."
            ],
            "HR Specialist": [
                "Facilitate end-to-end talent recruitment, employee onboarding, and document verification.",
                "Oversee attendance logs, leave balances, regularization requests, and workforce welfare.",
                "Administer company policies, grievance hearings, and statutory HR record-keeping."
            ]
        };

        window.openLetterModal = (userId) => {
            const user = state.allUsers.find(u => u.id === userId);
            if (!user) return;
            document.getElementById('letter-user-id').value = user.id;
            document.getElementById('letter-candidate-name').textContent = user.name;
            document.getElementById('letter-designation').textContent = user.designation || user.role;
            document.getElementById('letter-ctc').textContent = formatCurrency(user.annualCTC || 480000) + ' / yr';
            document.getElementById('letter-joining').textContent = formatDate(user.joiningDate || getTodayString());

            const docType = document.getElementById('letter-doc-type').value;
            const prefix = docType === 'offer' ? 'VC/OFF' : 'VC/APPT';
            document.getElementById('letter-ref-no').value = `${prefix}/${new Date().getFullYear()}/${user.empId || '001'}`;

            resetLetterDefaultDuties();
            document.getElementById('letter-modal').classList.remove('hidden');
        };

        window.resetLetterDefaultDuties = () => {
            const userId = document.getElementById('letter-user-id').value;
            const user = state.allUsers.find(u => u.id === userId);
            const desig = user?.designation || "Operations Executive";
            const duties = JOB_RESPONSIBILITIES_LIBRARY[desig] || [
                "Fulfill assigned departmental responsibilities diligently and maintain corporate performance standards.",
                "Uphold confidentiality, protect intellectual property, and comply with all company guidelines.",
                "Collaborate cross-functionally to achieve strategic milestones set by management."
            ];
            document.getElementById('letter-duties').value = duties.join('\n');
        };

        document.getElementById('letter-doc-type')?.addEventListener('change', (e) => {
            const userId = document.getElementById('letter-user-id').value;
            const user = state.allUsers.find(u => u.id === userId);
            const prefix = e.target.value === 'offer' ? 'VC/OFF' : 'VC/APPT';
            document.getElementById('letter-ref-no').value = `${prefix}/${new Date().getFullYear()}/${user?.empId || '001'}`;
        });

        window.downloadLetterPDF = () => {
            const userId = document.getElementById('letter-user-id').value;
            const user = state.allUsers.find(u => u.id === userId);
            if (!user) return;

            const docType = document.getElementById('letter-doc-type').value;
            const refNo = document.getElementById('letter-ref-no').value;
            const isOffer = docType === 'offer';
            const annualCTC = Number(user.annualCTC) || 480000;
            const monthlyCTC = Math.round(annualCTC / 12);
            const basic = Math.round(monthlyCTC * 0.5);
            const hra = Math.round(monthlyCTC * 0.2);
            const special = Math.round(monthlyCTC * 0.25);
            const stat = Math.max(0, monthlyCTC - (basic + hra + special));

            const duties = document.getElementById('letter-duties').value.split('\n').filter(d => d.trim().length > 0);

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            // Header
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            doc.setTextColor(15, 23, 42);
            doc.text('VIRTUE CORE BUSINESS SOLUTIONS', 14, 20);

            doc.setFontSize(8);
            doc.setTextColor(37, 99, 235);
            doc.text('ENTERPRISE WORKFORCE & MANAGEMENT SOLUTIONS | CIN: U72900MH2026PTC100801', 14, 25);

            doc.setDrawColor(203, 213, 225);
            doc.line(14, 28, 196, 28);

            // Ref & Date
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            doc.text(`Ref: ${refNo}`, 14, 35);
            doc.text(`Date: ${formatDate(new Date().toISOString())}`, 196, 35, { align: 'right' });

            // Recipient
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(15, 23, 42);
            doc.text(`To,\nMr./Ms. ${user.name}\nEmployee Code: ${user.empId || 'N/A'}\nDepartment: ${user.department || 'Operations'}`, 14, 43);

            // Subject
            const title = isOffer ? 'FORMAL OFFER OF EMPLOYMENT' : 'OFFICIAL LETTER OF APPOINTMENT';
            doc.setFillColor(241, 245, 249);
            doc.roundedRect(14, 62, 182, 8, 1.5, 1.5, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(30, 41, 59);
            doc.text(`SUBJECT: ${title} — ${user.designation || user.role}`, 105, 67, { align: 'center' });

            // Salutation & Intro
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(51, 65, 85);
            const intro = isOffer 
                ? `We are pleased to offer you the position of ${user.designation || user.role} at Virtue Core Business Solutions. Your anticipated date of joining is ${formatDate(user.joiningDate || getTodayString())}.`
                : `We are pleased to confirm your appointment as ${user.designation || user.role} at Virtue Core Business Solutions, effective from your joining date of ${formatDate(user.joiningDate || getTodayString())}.`;
            doc.text(doc.splitTextToSize(intro, 182), 14, 76);

            // Salary Structure Table
            doc.autoTable({
                startY: 85,
                head: [['Salary Component', 'Monthly (INR)', 'Annualized (INR)']],
                body: [
                    ['Basic Pay (50%)', formatCurrency(basic), formatCurrency(basic * 12)],
                    ['House Rent Allowance (HRA - 20%)', formatCurrency(hra), formatCurrency(hra * 12)],
                    ['Special Allowance', formatCurrency(special), formatCurrency(special * 12)],
                    ['Statutory Benefits & Allowances', formatCurrency(stat), formatCurrency(stat * 12)],
                    ['Total Cost to Company (CTC)', formatCurrency(monthlyCTC), formatCurrency(annualCTC)]
                ],
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
                footStyles: { fillColor: [241, 245, 249], fontStyle: 'bold' }
            });

            let currentY = doc.lastAutoTable.finalY + 8;

            // Duties & Responsibilities
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(15, 23, 42);
            doc.text('Key Roles & Responsibilities:', 14, currentY);
            currentY += 5;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(51, 65, 85);
            duties.forEach(duty => {
                const bulletLines = doc.splitTextToSize(`• ${duty}`, 178);
                doc.text(bulletLines, 16, currentY);
                currentY += bulletLines.length * 4;
            });

            currentY += 4;
            // Terms
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(15, 23, 42);
            doc.text('Terms of Employment:', 14, currentY);
            currentY += 5;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(71, 85, 105);
            const terms = "1. Probation: You will undergo an initial evaluation period of 3 months.\n2. Separation: Either party may terminate with 30 days notice during probation and 90 days post confirmation.\n3. Confidentiality: You will safeguard proprietary company data, client intellectual property, and trade secrets.";
            const splitTerms = doc.splitTextToSize(terms, 182);
            doc.text(splitTerms, 14, currentY);

            // Signatures
            currentY = Math.max(currentY + splitTerms.length * 4 + 10, 245);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(15, 23, 42);
            doc.text('For Virtue Core Business Solutions', 14, currentY);
            doc.text('Candidate Acceptance', 140, currentY);

            doc.line(14, currentY + 15, 60, currentY + 15);
            doc.line(140, currentY + 15, 186, currentY + 15);

            doc.setFont('helvetica', 'normal');
            doc.text('Authorized Signatory\nHuman Resources & Executive Board', 14, currentY + 19);
            doc.text(`${user.name}\nSignature & Date`, 140, currentY + 19);

            doc.save(`${isOffer ? 'Offer_Letter' : 'Appointment_Letter'}_${user.name.replace(/\s+/g, '_')}.pdf`);
            showToast(`${isOffer ? 'Offer Letter' : 'Appointment Letter'} PDF downloaded!`);
            closeModal('letter-modal');
        };

        window.printLetterDirect = () => {
            const userId = document.getElementById('letter-user-id').value;
            const user = state.allUsers.find(u => u.id === userId);
            if (!user) return;

            const docType = document.getElementById('letter-doc-type').value;
            const refNo = document.getElementById('letter-ref-no').value;
            const isOffer = docType === 'offer';
            const annualCTC = Number(user.annualCTC) || 480000;
            const monthlyCTC = Math.round(annualCTC / 12);
            const basic = Math.round(monthlyCTC * 0.5);
            const hra = Math.round(monthlyCTC * 0.2);
            const special = Math.round(monthlyCTC * 0.25);
            const stat = Math.max(0, monthlyCTC - (basic + hra + special));
            const duties = document.getElementById('letter-duties').value.split('\n').filter(d => d.trim().length > 0);

            const printWin = window.open('', '_blank');
            if (!printWin) return showToast("Pop-up blocked. Please allow popups.", "error");

            printWin.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${isOffer ? 'Offer Letter' : 'Appointment Letter'} - ${user.name}</title>
                    <script src="https://cdn.tailwindcss.com"><\/script>
                    <style>@page { size: A4; margin: 12mm; }</style>
                </head>
                <body class="p-8 text-slate-800 text-xs leading-relaxed">
                    <div class="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
                        <div>
                            <h1 class="text-2xl font-black text-slate-900">VIRTUE CORE</h1>
                            <p class="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Business Solutions</p>
                        </div>
                        <div class="text-right text-slate-500">
                            <p class="font-bold text-slate-800">Ref: ${refNo}</p>
                            <p>Date: ${formatDate(new Date().toISOString())}</p>
                        </div>
                    </div>
                    <div class="mb-4">
                        <p class="font-bold text-slate-900">To,</p>
                        <p class="font-bold text-sm text-slate-900">${user.name}</p>
                        <p class="text-slate-600">Employee ID: ${user.empId || 'N/A'} | Dept: ${user.department || 'Operations'}</p>
                    </div>
                    <div class="bg-slate-100 p-2 font-bold text-center rounded mb-4 uppercase">
                        ${isOffer ? 'Offer of Employment' : 'Letter of Appointment'} — ${user.designation || user.role}
                    </div>
                    <p class="mb-3">Dear ${user.name},</p>
                    <p class="mb-4">We are pleased to issue this ${isOffer ? 'Offer of Employment' : 'Letter of Appointment'} for the position of <strong>${user.designation || user.role}</strong> at Virtue Core Business Solutions with effective joining date of <strong>${formatDate(user.joiningDate || getTodayString())}</strong>.</p>
                    <table class="w-full border-collapse border border-slate-300 text-xs mb-4">
                        <thead><tr class="bg-slate-100 font-bold"><th class="border p-2 text-left">Salary Component</th><th class="border p-2 text-right">Monthly (INR)</th><th class="border p-2 text-right">Annual (INR)</th></tr></thead>
                        <tbody>
                            <tr><td class="border p-1.5">Basic Salary (50%)</td><td class="border p-1.5 text-right font-mono">${formatCurrency(basic)}</td><td class="border p-1.5 text-right font-mono">${formatCurrency(basic * 12)}</td></tr>
                            <tr><td class="border p-1.5">House Rent Allowance (HRA)</td><td class="border p-1.5 text-right font-mono">${formatCurrency(hra)}</td><td class="border p-1.5 text-right font-mono">${formatCurrency(hra * 12)}</td></tr>
                            <tr><td class="border p-1.5">Special Allowance</td><td class="border p-1.5 text-right font-mono">${formatCurrency(special)}</td><td class="border p-1.5 text-right font-mono">${formatCurrency(special * 12)}</td></tr>
                            <tr><td class="border p-1.5">Statutory Allowances</td><td class="border p-1.5 text-right font-mono">${formatCurrency(stat)}</td><td class="border p-1.5 text-right font-mono">${formatCurrency(stat * 12)}</td></tr>
                            <tr class="bg-slate-50 font-bold"><td class="border p-2">Total CTC</td><td class="border p-2 text-right font-mono">${formatCurrency(monthlyCTC)}</td><td class="border p-2 text-right font-mono">${formatCurrency(annualCTC)}</td></tr>
                        </tbody>
                    </table>
                    <h4 class="font-bold uppercase text-slate-800 mb-1">Key Responsibilities:</h4>
                    <ul class="list-disc pl-5 mb-4 space-y-1">
                        ${duties.map(d => `<li>${d}</li>`).join('')}
                    </ul>
                    <div class="mt-8 pt-6 border-t grid grid-cols-2 gap-8">
                        <div><p class="font-bold mb-10">For Virtue Core Business Solutions</p><p class="border-t w-40 pt-1 font-semibold">Authorized Signatory</p></div>
                        <div><p class="font-bold mb-10">Candidate Acceptance</p><p class="border-t w-40 pt-1 font-semibold">${user.name}</p></div>
                    </div>
                    <script>window.onload = function() { window.print(); }<\/script>
                </body>
                </html>
            `);
            printWin.document.close();
        };

        window.downloadCustomPayslipPDF = (data) => {
            if (!data) return showToast("No payslip data found", "error");
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            // Helper to format currency for PDF without corrupt Rupee symbol
            const pdfAmt = (val) => 'INR ' + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            // Currency to Words Converter
            function numberToWords(amount) {
                const words = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
                const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
                function conv(n) {
                    if (n === 0) return '';
                    if (n < 20) return words[n] + ' ';
                    if (n < 100) return tens[Math.floor(n / 10)] + ' ' + (n % 10 !== 0 ? words[n % 10] + ' ' : '');
                    return words[Math.floor(n / 100)] + ' Hundred ' + (n % 100 !== 0 ? 'and ' + conv(n % 100) : '');
                }
                let num = Math.floor(Math.abs(amount));
                if (num === 0) return 'Rupees Zero Only';
                let res = '';
                const crore = Math.floor(num / 10000000); num %= 10000000;
                const lakh = Math.floor(num / 100000); num %= 100000;
                const thousand = Math.floor(num / 1000); num %= 1000;
                if (crore > 0) res += conv(crore) + 'Crore ';
                if (lakh > 0) res += conv(lakh) + 'Lakh ';
                if (thousand > 0) res += conv(thousand) + 'Thousand ';
                if (num > 0) res += conv(num);
                return 'Indian Rupees ' + res.trim() + ' Only';
            }

            const monthStr = data.month || '2026-09';
            let monthName = monthStr;
            try {
                const [y, m] = monthStr.split('-').map(Number);
                const d = new Date(y, m - 1, 1);
                monthName = d.toLocaleString('default', { month: 'long', year: 'numeric' });
            } catch {}

            // Outer Frame
            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.4);
            doc.rect(10, 10, 190, 277);

            // Top Header Banner
            doc.setFillColor(15, 23, 42); // slate-900
            doc.rect(10, 10, 190, 28, 'F');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14.5);
            doc.setTextColor(255, 255, 255);
            doc.text('VIRTUE CORE BUSINESS SOLUTIONS PVT. LTD.', 15, 20);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(203, 213, 225);
            doc.text('Corporate Reg: U72900DL2023PTC123456 | Registered Office: Cyber City, Tower B, Level 6', 15, 26);
            doc.text('Email: payroll@virtuecore.com | Phone: +91 11 4567 8900 | Web: www.virtuecore.com', 15, 31);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(248, 250, 252);
            doc.text('SALARY SLIP / PAY VOUCHER', 195, 20, { align: 'right' });
            doc.setFontSize(9);
            doc.setTextColor(147, 197, 253);
            doc.text(monthName.toUpperCase(), 195, 27, { align: 'right' });

            // Employee Dossier Section
            doc.setFillColor(241, 245, 249);
            doc.rect(10, 38, 190, 7, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(30, 41, 59);
            doc.text('EMPLOYEE RECORD & COMPLIANCE DETAILS', 15, 43);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(51, 65, 85);

            // 2-Column Meta Table Grid with balanced spacing
            const col1X = 15;
            const col2X = 55;
            const col3X = 112;
            const col4X = 155;
            let metaY = 51;
            const lineH = 5.2;

            // Row 1
            doc.setFont('helvetica', 'bold');
            doc.text('Employee Name:', col1X, metaY);
            doc.setFont('helvetica', 'normal');
            doc.text(data.name || '--', col2X, metaY);

            doc.setFont('helvetica', 'bold');
            doc.text('Payment Month:', col3X, metaY);
            doc.setFont('helvetica', 'normal');
            doc.text(monthName, col4X, metaY);

            // Row 2
            metaY += lineH;
            doc.setFont('helvetica', 'bold');
            doc.text('Employee ID:', col1X, metaY);
            doc.setFont('helvetica', 'normal');
            doc.text(data.empId || 'N/A', col2X, metaY);

            doc.setFont('helvetica', 'bold');
            doc.text('Annual CTC:', col3X, metaY);
            doc.setFont('helvetica', 'normal');
            doc.text(pdfAmt(data.annualCTC), col4X, metaY);

            // Row 3
            metaY += lineH;
            doc.setFont('helvetica', 'bold');
            doc.text('Department:', col1X, metaY);
            doc.setFont('helvetica', 'normal');
            doc.text(data.department || 'Operations', col2X, metaY);

            doc.setFont('helvetica', 'bold');
            doc.text('Days in Month:', col3X, metaY);
            doc.setFont('helvetica', 'normal');
            doc.text(`${data.totalDaysInMonth || 30} Days`, col4X, metaY);

            // Row 4
            metaY += lineH;
            doc.setFont('helvetica', 'bold');
            doc.text('Designation:', col1X, metaY);
            doc.setFont('helvetica', 'normal');
            doc.text(data.designation || 'Staff', col2X, metaY);

            const attendedDays = (data.totalDaysInMonth || 30) - (data.unpaidDays || 0);
            doc.setFont('helvetica', 'bold');
            doc.text('Payable Days:', col3X, metaY);
            doc.setFont('helvetica', 'normal');
            doc.text(`${attendedDays} Days`, col4X, metaY);

            // Row 5
            metaY += lineH;
            doc.setFont('helvetica', 'bold');
            doc.text('Payment Mode:', col1X, metaY);
            doc.setFont('helvetica', 'normal');
            doc.text('Direct Bank NEFT / IMPS', col2X, metaY);

            doc.setFont('helvetica', 'bold');
            doc.text('LOP / Unpaid Days:', col3X, metaY);
            if (data.unpaidDays > 0) {
                doc.setTextColor(225, 29, 72); // rose-600
                doc.setFont('helvetica', 'bold');
                doc.text(`${data.unpaidDays} Days (Deducted)`, col4X, metaY);
            } else {
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(51, 65, 85);
                doc.text('0 Days (Nil)', col4X, metaY);
            }

            // Line separator
            metaY += 5;
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.3);
            doc.line(10, metaY, 200, metaY);

            // Salary Structure Components
            const monthlyCTC = Number(data.monthlyCTC) || 0;
            const basic = Math.round(monthlyCTC * 0.5);
            const hra = Math.round(monthlyCTC * 0.2);
            const special = Math.max(0, monthlyCTC - basic - hra);
            const earnedGross = Number(data.earnedGross || monthlyCTC);
            const lop = Number(data.lopDeduction) || 0;
            const pf = Number(data.pf || Math.round(monthlyCTC * 0.05));
            const pt = Number(data.pt || 200);
            const totalDeductions = Number(data.totalDeductions || (lop + pf + pt));
            const netPay = Number(data.netPay) || Math.max(0, earnedGross - totalDeductions);

            doc.autoTable({
                startY: metaY + 4,
                margin: { left: 14, right: 14 },
                head: [['EARNINGS COMPONENT', 'AMOUNT', 'DEDUCTIONS COMPONENT', 'AMOUNT']],
                body: [
                    ['Basic Salary (50%)', pdfAmt(basic), 'Provident Fund (PF - Statutory)', pdfAmt(pf)],
                    ['House Rent Allowance (HRA - 20%)', pdfAmt(hra), 'Professional Tax (PT)', pdfAmt(pt)],
                    ['Special / Operations Allowance', pdfAmt(special), 'Loss of Pay (LOP Deductions)', pdfAmt(lop)],
                    ['Other Conveyance / Incentives', pdfAmt(0), 'TDS / Other Deductions', pdfAmt(0)],
                    ['Monthly Gross Entitled', pdfAmt(monthlyCTC), 'Total Statutory & LOP Deductions', pdfAmt(totalDeductions)]
                ],
                foot: [
                    ['GROSS SALARY EARNED', pdfAmt(earnedGross), 'TOTAL DEDUCTIONS APPLIED', pdfAmt(totalDeductions)]
                ],
                theme: 'grid',
                styles: {
                    fontSize: 8.5,
                    cellPadding: 3.8,
                    textColor: [30, 41, 59],
                    lineColor: [226, 232, 240],
                    lineWidth: 0.25
                },
                headStyles: {
                    fillColor: [30, 41, 59],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    halign: 'left',
                    fontSize: 8.5
                },
                footStyles: {
                    fillColor: [241, 245, 249],
                    textColor: [15, 23, 42],
                    fontStyle: 'bold',
                    fontSize: 9
                },
                columnStyles: {
                    0: { cellWidth: 56, fontStyle: 'normal' },
                    1: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
                    2: { cellWidth: 56, fontStyle: 'normal' },
                    3: { cellWidth: 35, halign: 'right', fontStyle: 'bold', textColor: [225, 29, 72] }
                }
            });

            // Prominent Net Disbursal Banner
            const bannerY = doc.lastAutoTable.finalY + 6;
            doc.setFillColor(240, 253, 244); // emerald-50
            doc.setDrawColor(134, 239, 172); // emerald-300
            doc.setLineWidth(0.4);
            doc.roundedRect(14, bannerY, 182, 22, 2, 2, 'FD');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10.5);
            doc.setTextColor(22, 101, 52); // emerald-800
            doc.text('NET SALARY TAKE-HOME:', 19, bannerY + 9);

            doc.setFontSize(15);
            doc.setTextColor(4, 120, 87); // emerald-700
            doc.text(pdfAmt(netPay), 191, bannerY + 10, { align: 'right' });

            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8.5);
            doc.setTextColor(71, 85, 105);
            doc.text(numberToWords(netPay), 19, bannerY + 17);

            // Authorized Signatures & Statutory Note
            const sigY = bannerY + 34;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(100, 116, 139);
            doc.text('Note: This is a system-authenticated, digitally certified salary voucher generated by Virtue Core Enterprise HRMS.', 14, sigY);

            // Signature lines
            const lineY = sigY + 18;
            doc.setDrawColor(148, 163, 184);
            doc.setLineWidth(0.3);
            doc.line(16, lineY, 75, lineY);
            doc.line(135, lineY, 192, lineY);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(15, 23, 42);
            doc.text('Authorized Signatory', 16, lineY + 5);
            doc.text('Employee Digital Signature', 135, lineY + 5);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(100, 116, 139);
            doc.text('Head of Payroll & HR Governance', 16, lineY + 9);
            doc.text(`Acknowledged: ${data.name || 'Employee'}`, 135, lineY + 9);

            // Page Bottom Timestamp
            doc.setFontSize(7);
            doc.setTextColor(148, 163, 184);
            doc.text(`Generated on: ${new Date().toLocaleString()} | Confidential Document | Virtue Core Internal HRMS`, 105, 282, { align: 'center' });

            doc.save(`Payslip_${(data.name || 'Staff').replace(/\\s+/g, '_')}_${monthStr}.pdf`);
            showToast(`Payslip for ${data.name} downloaded successfully!`);
        };

        window.togglePasswordVisibility = (inputId, iconId) => {
            const input = document.getElementById(inputId);
            const icon = document.getElementById(iconId);
            if (!input || !icon) return;
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        };

        

const calculateDurations = (record) => {
            let activeWorkMs = 0;
            let totalBreakMs = 0;
            const now = new Date().getTime();

            if (record.sessions && record.sessions.length > 0) {
                record.sessions.forEach(s => {
                    const sIn = new Date(s.in).getTime();
                    const sOut = s.out ? new Date(s.out).getTime() : now;
                    activeWorkMs += Math.max(0, sOut - sIn);
                });
            } else if (record.punchIn) {
                const pIn = new Date(record.punchIn).getTime();
                const pOut = record.punchOut ? new Date(record.punchOut).getTime() : now;
                activeWorkMs = Math.max(0, pOut - pIn);
            }

            if (record.breaks) {
                record.breaks.forEach(b => {
                    const bIn = new Date(b.start).getTime();
                    const bOut = b.end ? new Date(b.end).getTime() : now;
                    totalBreakMs += Math.max(0, bOut - bIn);
                });
                activeWorkMs = Math.max(0, activeWorkMs - totalBreakMs);
            }
            return { activeWorkMs, totalBreakMs };
        };

        const formatDuration = (ms) => {
            if (!ms || ms <= 0) return '0h 0m';
            return `${Math.floor(ms / (1000 * 60 * 60))}h ${Math.floor((ms / (1000 * 60)) % 60)}m`;
        };

        const logAudit = async (action, target, details) => {
            try {
                await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'audits'), {
                    timestamp: new Date().toISOString(),
                    actor: state.currentUser ? state.currentUser.name : 'System',
                    action, target, details
                });
            } catch(e) { console.warn("Audit log warning:", e); }
        };

        

const renderCalendarGrid = (targetUserId, yearMonthStr, gridElId, statsElId) => {
            const gridEl = document.getElementById(gridElId);
            const statsEl = document.getElementById(statsElId);
            if (!gridEl) return;

            const [year, month] = yearMonthStr.split('-').map(Number);
            const daysInMonth = new Date(year, month, 0).getDate();
            const firstDayIndex = new Date(year, month - 1, 1).getDay();

            const userRecs = state.allRecords.filter(r => r.userId === targetUserId && r.date.startsWith(yearMonthStr));
            const userLeaves = state.allLeaves.filter(l => l.userId === targetUserId && l.status === 'approved');
            const lateCutoff = state.settings?.lateThreshold || '09:30';
            const [lateH, lateM] = lateCutoff.split(':').map(Number);

            let presentCount = 0;
            let lateCount = 0;
            let leaveCount = 0;
            let lopCount = 0;
            let holidayCount = 0;

            let gridHtml = '';

            for (let i = 0; i < firstDayIndex; i++) {
                gridHtml += `<div class="bg-slate-50/50 min-h-[75px] rounded-lg border border-slate-100 p-1.5 opacity-40"></div>`;
            }

            for (let day = 1; day <= daysInMonth; day++) {
                const dayStr = String(day).padStart(2, '0');
                const dateStr = `${yearMonthStr}-${dayStr}`;
                const dow = new Date(year, month - 1, day).getDay();
                const isWeekend = dow === 0 || dow === 6;

                const hol = state.allHolidays.find(h => h.date === dateStr);
                const att = userRecs.find(r => r.date === dateStr);
                const lve = userLeaves.find(l => dateStr >= l.startDate && dateStr <= l.endDate);

                let cellClass = 'bg-white border-slate-200';
                let badgeHtml = '';

                // ECOSYSTEM PRECEDENCE:
                // 1. Official Declared Holiday ALWAYS takes precedence over unpaid loss-of-pay/leaves
                if (hol) {
                    holidayCount++;
                    cellClass = 'bg-blue-50/70 border-blue-300';
                    badgeHtml = `
                        <div class="mt-1">
                            <span class="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 truncate max-w-full">
                                <i class="fas fa-umbrella-beach mr-1"></i>${hol.name}
                            </span>
                            ${lve ? `<span class="block text-[8px] text-blue-600 font-semibold mt-0.5">Paid Holiday (Leave Waived)</span>` : ''}
                        </div>
                    `;
                } else if (att && att.punchIn) {
                    const inTime = new Date(att.punchIn);
                    const isLate = inTime.getHours() > lateH || (inTime.getHours() === lateH && inTime.getMinutes() > lateM);
                    presentCount++;
                    if (isLate) lateCount++;

                    cellClass = isLate ? 'bg-amber-50/70 border-amber-300' : 'bg-emerald-50/70 border-emerald-300';
                    badgeHtml = `
                        <div class="mt-1">
                            <span class="inline-block text-[9px] font-black px-1.5 py-0.5 rounded ${isLate ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">
                                ${isLate ? 'LATE' : 'PRESENT'}
                            </span>
                            <p class="text-[9px] font-mono text-slate-600 mt-0.5">${formatTime(att.punchIn)} - ${att.punchOut ? formatTime(att.punchOut) : '...'}</p>
                        </div>
                    `;
                } else if (lve) {
                    const isLOP = lve.type === 'Unpaid Leave';
                    if (isLOP) lopCount++;
                    else leaveCount++;

                    cellClass = isLOP ? 'bg-rose-50/80 border-rose-300' : 'bg-purple-50/80 border-purple-300';
                    badgeHtml = `
                        <div class="mt-1">
                            <span class="inline-block text-[9px] font-black px-1.5 py-0.5 rounded ${isLOP ? 'bg-rose-100 text-rose-800' : 'bg-purple-100 text-purple-800'}">
                                ${isLOP ? 'LOP / UNPAID' : lve.type}
                            </span>
                        </div>
                    `;
                } else if (isWeekend) {
                    cellClass = 'bg-slate-100/70 border-slate-200 text-slate-400';
                    badgeHtml = `<div class="mt-1"><span class="text-[9px] font-bold text-slate-400">WEEKEND</span></div>`;
                } else {
                    const todayStr = getTodayString();
                    if (dateStr <= todayStr) {
                        cellClass = 'bg-rose-50/30 border-rose-200';
                        badgeHtml = `<div class="mt-1"><span class="text-[9px] font-bold text-rose-500">NO PUNCH</span></div>`;
                    } else {
                        cellClass = 'bg-white border-slate-200';
                        badgeHtml = `<div class="mt-1"><span class="text-[9px] text-slate-300">Scheduled</span></div>`;
                    }
                }

                gridHtml += `
                    <div class="min-h-[75px] rounded-lg border p-1.5 flex flex-col justify-between ${cellClass} transition hover:shadow-sm">
                        <div class="flex justify-between items-center">
                            <span class="text-xs font-black ${isWeekend ? 'text-slate-400' : 'text-slate-800'}">${day}</span>
                            ${att?.isRegularized ? '<span class="text-[8px] bg-purple-100 text-purple-700 font-extrabold px-1 rounded">REG</span>' : ''}
                        </div>
                        ${badgeHtml}
                    </div>
                `;
            }

            gridEl.innerHTML = gridHtml;

            if (statsEl) {
                statsEl.innerHTML = `
                    <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                        <span class="text-[10px] font-bold text-emerald-700 uppercase">Present Days</span>
                        <p class="text-xl font-black text-emerald-800 mt-0.5">${presentCount}</p>
                    </div>
                    <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                        <span class="text-[10px] font-bold text-amber-700 uppercase">Late Arrivals</span>
                        <p class="text-xl font-black text-amber-800 mt-0.5">${lateCount}</p>
                    </div>
                    <div class="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
                        <span class="text-[10px] font-bold text-purple-700 uppercase">Paid Leaves</span>
                        <p class="text-xl font-black text-purple-800 mt-0.5">${leaveCount}</p>
                    </div>
                    <div class="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center">
                        <span class="text-[10px] font-bold text-rose-700 uppercase">LOP / Unpaid</span>
                        <p class="text-xl font-black text-rose-800 mt-0.5">${lopCount}</p>
                    </div>
                    <div class="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                        <span class="text-[10px] font-bold text-blue-700 uppercase">Holidays</span>
                        <p class="text-xl font-black text-blue-800 mt-0.5">${holidayCount}</p>
                    </div>
                `;
            }
        };

        const renderEmpAttendanceCalendar = () => {
            if (!state.currentUser) return;
            const mInput = document.getElementById('emp-cal-month');
            if (!mInput.value) mInput.value = '2026-09';
            renderCalendarGrid(state.currentUser.id, mInput.value, 'emp-cal-grid', 'emp-cal-stats');
        };

        const renderMgmtAttendanceCalendar = () => {
            const uSelect = document.getElementById('mgmt-cal-user-select');
            const mInput = document.getElementById('mgmt-cal-month');
            if (!mInput.value) mInput.value = '2026-09';

            const emps = state.allUsers.filter(u => u.role === 'employee' || u.role === 'supervisor');
            if (uSelect.options.length === 0 || uSelect.options.length !== emps.length) {
                uSelect.innerHTML = emps.map(u => `<option value="${u.id}">${u.name} (${u.empId || 'Staff'})</option>`).join('');
            }

            const targetId = uSelect.value || emps[0]?.id;
            if (targetId) {
                renderCalendarGrid(targetId, mInput.value, 'mgmt-cal-grid', 'mgmt-cal-stats');
            }
        };

        document.getElementById('emp-cal-month')?.addEventListener('change', renderEmpAttendanceCalendar);
        document.getElementById('mgmt-cal-month')?.addEventListener('change', renderMgmtAttendanceCalendar);
        document.getElementById('mgmt-cal-user-select')?.addEventListener('change', renderMgmtAttendanceCalendar);

        window.exportCSVReport = (reportType) => {
            let csv = "";
            let filename = `report_${reportType}_${getTodayString()}.csv`;

            if(reportType === 'attendance') {
                csv = "Employee,Date,Status,Punch In,Punch Out,Work Hours,Regularized\n" +
                    state.allRecords.map(r => {
                        const { activeWorkMs } = calculateDurations(r);
                        return `"${r.userName}",${r.date},${r.status},${r.punchIn?formatTime(r.punchIn):''},${r.punchOut?formatTime(r.punchOut):''},"${formatDuration(activeWorkMs)}",${r.isRegularized?'Yes':'No'}`;
                    }).join('\n');
            } else if(reportType === 'leaves') {
                csv = "Employee,Type,Start Date,End Date,Reason,Status\n" +
                    state.allLeaves.map(l => `"${l.userName}",${l.type},${l.startDate},${l.endDate},"${l.reason}",${l.status}`).join('\n');
            } else if(reportType === 'employees') {
                csv = "Employee ID,Name,Username,Role,Department,Designation,Phone,Email,Status\n" +
                    state.allUsers.map(u => `"${u.empId||''}", "${u.name}", "${u.username}", ${u.role}, ${u.department||''}, "${u.designation||''}", "${u.phone||''}", "${u.email||''}", ${u.active!==false?'Active':'Inactive'}`).join('\n');
            } else if(reportType === 'payroll') {
                if (state.currentPayrollRun.length === 0) {
                    processMonthlyPayrollRun();
                }
                csv = "Employee Name,Employee ID,Department,Designation,Annual CTC,Monthly Gross,Paid Days,LOP Days,LOP Deduction,PF,PT,Total Deductions,Net Salary\n" +
                    state.currentPayrollRun.map(p => `"${p.name}","${p.empId}","${p.department}","${p.designation}",${p.annualCTC},${p.monthlyCTC},${p.totalDaysInMonth - p.unpaidDays},${p.unpaidDays},${p.lopDeduction},${p.pf},${p.pt},${p.totalDeductions},${p.netPay}`).join('\n');
            }

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
        };

        window.exportPDFReport = (reportType) => {
            const { jsPDF } = window.jspdf;
            const docPdf = new jsPDF();
            docPdf.setFontSize(16);
            docPdf.text(`Virtue Core - ${reportType.toUpperCase()} REPORT`, 14, 15);
            docPdf.setFontSize(10);
            docPdf.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

            let head = [];
            let body = [];

            if(reportType === 'attendance') {
                head = [['Employee', 'Date', 'Status', 'In', 'Out', 'Duration', 'Reg']];
                body = state.allRecords.map(r => {
                    const { activeWorkMs } = calculateDurations(r);
                    return [r.userName, r.date, r.status, formatTime(r.punchIn), r.punchOut?formatTime(r.punchOut):'--', formatDuration(activeWorkMs), r.isRegularized?'Yes':'No'];
                });
            } else if(reportType === 'leaves') {
                head = [['Employee', 'Type', 'From', 'To', 'Reason', 'Status']];
                body = state.allLeaves.map(l => [l.userName, l.type, l.startDate, l.endDate, l.reason, l.status]);
            } else if(reportType === 'employees') {
                head = [['ID', 'Name', 'Role', 'Dept', 'Designation', 'Phone']];
                body = state.allUsers.map(u => [u.empId||'--', u.name, u.role, u.department||'--', u.designation||'--', u.phone||'--']);
            } else if(reportType === 'payroll') {
                if (state.currentPayrollRun.length === 0) {
                    processMonthlyPayrollRun();
                }
                head = [['Employee', 'Emp ID', 'Annual CTC', 'Days (Work/LOP)', 'Gross Earned', 'Deductions', 'Net Payout']];
                body = state.currentPayrollRun.map(p => [
                    p.name,
                    p.empId,
                    formatCurrency(p.annualCTC),
                    `${p.totalDaysInMonth - p.unpaidDays} / ${p.unpaidDays} LOP`,
                    formatCurrency(p.earnedGross),
                    formatCurrency(p.totalDeductions),
                    formatCurrency(p.netPay)
                ]);
            }

            docPdf.autoTable({ head, body, startY: 28, styles: { fontSize: 8 } });
            docPdf.save(`report_${reportType}_${getTodayString()}.pdf`);
        };

        

const renderRealCharts = () => {
            Object.values(state.charts).forEach(c => { if(c) c.destroy(); });

            // 1. Weekly Attendance (Last 7 Days)
            const days7 = [];
            const counts7 = [];
            for(let i=6; i>=0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dStr = d.toLocaleDateString('en-CA');
                days7.push(d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' }));
                const cnt = state.allRecords.filter(r => r.date === dStr && r.punchIn).length;
                counts7.push(cnt);
            }

            const ctxWeekly = document.getElementById('chart-weekly')?.getContext('2d');
            if(ctxWeekly) {
                state.charts.weekly = new Chart(ctxWeekly, {
                    type: 'bar',
                    data: { labels: days7, datasets: [{ label: 'Staff Present', data: counts7, backgroundColor: '#2563eb', borderRadius: 6 }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
                });
            }

            // 2. Monthly Trend (Past 30 Days)
            const monthLabels = ['Day 1-7', 'Day 8-14', 'Day 15-21', 'Day 22-30'];
            const monthlyData = [0, 0, 0, 0];
            const now = new Date();
            state.allRecords.forEach(r => {
                const recDate = new Date(r.date);
                if(recDate.getMonth() === now.getMonth() && recDate.getFullYear() === now.getFullYear() && r.punchIn) {
                    const day = recDate.getDate();
                    if(day <= 7) monthlyData[0]++;
                    else if(day <= 14) monthlyData[1]++;
                    else if(day <= 21) monthlyData[2]++;
                    else monthlyData[3]++;
                }
            });

            const ctxMonthly = document.getElementById('chart-monthly')?.getContext('2d');
            if(ctxMonthly) {
                state.charts.monthly = new Chart(ctxMonthly, {
                    type: 'line',
                    data: { labels: monthLabels, datasets: [{ label: 'Punches', data: monthlyData, borderColor: '#4f46e5', backgroundColor: 'rgba(79, 70, 229, 0.1)', fill: true, tension: 0.3 }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
                });
            }

            // 3. Late Arrival Trend (Dynamic Cutoff)
            const lateCutoff = state.settings?.lateThreshold || '09:30';
            const [lateH, lateM] = lateCutoff.split(':').map(Number);
            const lateCounts = [];
            for(let i=6; i>=0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dStr = d.toLocaleDateString('en-CA');
                const late = state.allRecords.filter(r => {
                    if(r.date !== dStr || !r.punchIn) return false;
                    const t = new Date(r.punchIn);
                    return t.getHours() > lateH || (t.getHours() === lateH && t.getMinutes() > lateM);
                }).length;
                lateCounts.push(late);
            }

            const ctxLate = document.getElementById('chart-late')?.getContext('2d');
            if(ctxLate) {
                state.charts.late = new Chart(ctxLate, {
                    type: 'bar',
                    data: { labels: days7, datasets: [{ label: 'Late Clock-Ins', data: lateCounts, backgroundColor: '#f59e0b', borderRadius: 6 }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
                });
            }

            // 4. Leave Distribution (Doughnut)
            const leaveTypes = ['Casual Leave', 'Sick Leave', 'Earned Leave', 'Half Day', 'Work From Home', 'Unpaid Leave'];
            const leaveCounts = leaveTypes.map(t => state.allLeaves.filter(l => l.type === t && l.status === 'approved').length);

            const ctxLeave = document.getElementById('chart-leave')?.getContext('2d');
            if(ctxLeave) {
                state.charts.leave = new Chart(ctxLeave, {
                    type: 'doughnut',
                    data: { labels: leaveTypes, datasets: [{ data: leaveCounts, backgroundColor: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#e11d48'] }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } }
                });
            }
        };

        

const renderManagementDashboard = () => {
            const { preset, startDate, endDate } = state.dashboardFilter;

            const isFiltered = preset !== 'today';
            const grid = document.getElementById('mgmt-metrics-grid');
            if (grid) {
                if (isFiltered) {
                    grid.className = "grid grid-cols-2 sm:grid-cols-5 gap-3.5";
                    document.getElementById('card-metric-total')?.classList.add('hidden');
                    document.getElementById('card-metric-working')?.classList.add('hidden');
                    document.getElementById('card-metric-break')?.classList.add('hidden');
                    document.getElementById('card-metric-completed')?.classList.add('hidden');
                    document.getElementById('card-metric-pending')?.classList.add('hidden');
                } else {
                    grid.className = "grid grid-cols-2 sm:grid-cols-5 gap-3.5";
                    document.getElementById('card-metric-total')?.classList.remove('hidden');
                    document.getElementById('card-metric-working')?.classList.remove('hidden');
                    document.getElementById('card-metric-break')?.classList.remove('hidden');
                    document.getElementById('card-metric-completed')?.classList.remove('hidden');
                    document.getElementById('card-metric-pending')?.classList.remove('hidden');
                }
            }

            const totalEmps = state.allUsers.filter(u => u.role === 'employee' && u.active !== false).length;
            const empIds = state.allUsers.filter(u => u.role === 'employee' && u.active !== false).map(u => u.id);

            const filteredRecs = state.allRecords.filter(r => r.date >= startDate && r.date <= endDate);

            let presentCount = 0;
            let lateCount = 0;
            let workingCount = 0;
            let breakCount = 0;
            let completedCount = 0;

            const lateCutoff = state.settings?.lateThreshold || '09:30';
            const [lateH, lateM] = lateCutoff.split(':').map(Number);
            document.getElementById('m-stat-late-label').textContent = `Post ${lateCutoff}`;

            filteredRecs.forEach(r => {
                if (r.punchIn) {
                    if (empIds.includes(r.userId)) presentCount++;
                    const inTime = new Date(r.punchIn);
                    if(inTime.getHours() > lateH || (inTime.getHours() === lateH && inTime.getMinutes() > lateM)) {
                        lateCount++;
                    }
                }
                if (r.status === 'working') workingCount++;
                else if (['lunch', 'tea'].includes(r.status)) breakCount++;
                else if (r.status === 'completed') completedCount++;
            });

            const onLeaveCount = state.allLeaves.filter(l => l.status === 'approved' && l.startDate <= endDate && l.endDate >= startDate).length;
            const absentCount = Math.max(0, totalEmps - presentCount - onLeaveCount);
            const pendingReqsCount = state.allReqs.filter(r => r.status === 'pending').length + state.allLeaves.filter(l => l.status === 'pending').length;
            const attendanceRate = totalEmps > 0 ? Math.round((presentCount / totalEmps) * 100) : 0;

            document.getElementById('m-stat-total').textContent = totalEmps;
            document.getElementById('m-stat-present').textContent = presentCount;
            document.getElementById('m-stat-absent').textContent = absentCount;
            document.getElementById('m-stat-late').textContent = lateCount;
            document.getElementById('m-stat-leave').textContent = onLeaveCount;
            document.getElementById('m-stat-working').textContent = workingCount;
            document.getElementById('m-stat-break').textContent = breakCount;
            document.getElementById('m-stat-completed').textContent = completedCount;
            document.getElementById('m-stat-pending').textContent = pendingReqsCount;
            document.getElementById('m-stat-rate').textContent = `${attendanceRate}%`;

            const reqBadge = document.getElementById('mgmt-req-badge');
            reqBadge.textContent = pendingReqsCount;
            reqBadge.classList.toggle('hidden', pendingReqsCount === 0);

            // Attendance Master Log Table
            const search = document.getElementById('att-filter-search')?.value.toLowerCase() || '';
            const dateF = document.getElementById('att-filter-date')?.value || 'all';
            let displayRecs = state.allRecords;
            if(dateF === 'today') displayRecs = displayRecs.filter(r => r.date === getTodayString());
            if(search) displayRecs = displayRecs.filter(r => r.userName.toLowerCase().includes(search));

            document.getElementById('mgmt-att-tbody').innerHTML = displayRecs.map(r => {
                const { activeWorkMs } = calculateDurations(r);
                return `
                <tr class="hover:bg-slate-50/70">
                    <td class="px-5 py-3.5 font-bold text-slate-800">${r.userName}</td>
                    <td class="px-5 py-3.5 font-medium text-slate-600">
                        ${formatDate(r.date)}
                        ${r.isRegularized ? '<br><span class="text-[9px] font-extrabold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded shadow-sm inline-block mt-0.5">REGULARIZED</span>' : ''}
                    </td>
                    <td class="px-5 py-3.5"><span class="px-2 py-0.5 font-bold rounded-full bg-slate-100 text-slate-700 uppercase text-[10px]">${r.status}</span></td>
                    <td class="px-5 py-3.5 font-medium text-slate-600">${formatTime(r.punchIn)}</td>
                    <td class="px-5 py-3.5 font-medium text-slate-600">${r.punchOut ? formatTime(r.punchOut) : '--:--'}</td>
                    <td class="px-5 py-3.5 font-extrabold text-slate-800">${formatDuration(activeWorkMs)}</td>
                </tr>`;
            }).join('') || `<tr><td colspan="6" class="px-5 py-6 text-center text-slate-400">No records found</td></tr>`;

            // Regularization Queue
            const pendRegs = state.allReqs.filter(r => r.status === 'pending');
            document.getElementById('mgmt-reg-tbody').innerHTML = pendRegs.map(r => `
                <tr class="hover:bg-slate-50/70">
                    <td class="px-5 py-3.5 font-bold text-slate-800">${r.userName}</td>
                    <td class="px-5 py-3.5 font-medium text-slate-600">${formatDate(r.date)}</td>
                    <td class="px-5 py-3.5"><span class="font-bold text-emerald-600">${formatTime(r.reqPunchIn)}</span> - <span class="font-bold text-rose-600">${formatTime(r.reqPunchOut)}</span></td>
                    <td class="px-5 py-3.5 text-slate-500">${r.reason}</td>
                    <td class="px-5 py-3.5 text-right space-x-2">
                        <button onclick="processApproval('regularizations', '${r.id}', 'rejected')" class="bg-red-50 text-red-600 px-2.5 py-1 rounded-xl text-xs font-bold hover:bg-red-100">Reject</button>
                        <button onclick="processApproval('regularizations', '${r.id}', 'approved', { attId: '${r.attendanceId||''}', userId: '${r.userId}', userName: '${r.userName}', date: '${r.date}', in: '${r.reqPunchIn}', out: '${r.reqPunchOut}' })" class="bg-emerald-600 text-white px-2.5 py-1 rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-sm">Approve</button>
                    </td>
                </tr>
            `).join('') || `<tr><td colspan="5" class="px-5 py-6 text-center text-slate-400">No pending regularizations</td></tr>`;

            // Leaves Approvals Queue
            const pendLeaves = state.allLeaves.filter(l => l.status === 'pending');
            document.getElementById('mgmt-leave-req-tbody').innerHTML = pendLeaves.map(l => `
                <tr class="hover:bg-slate-50/70">
                    <td class="px-5 py-3.5 font-bold text-slate-800">${l.userName}</td>
                    <td class="px-5 py-3.5 font-bold text-blue-600">${l.type}</td>
                    <td class="px-5 py-3.5 font-medium text-slate-600">${formatDate(l.startDate)} to ${formatDate(l.endDate)}</td>
                    <td class="px-5 py-3.5 text-slate-500">${l.reason}</td>
                    <td class="px-5 py-3.5 text-right space-x-2">
                        <button onclick="processApproval('leaves', '${l.id}', 'rejected')" class="bg-red-50 text-red-600 px-2.5 py-1 rounded-xl text-xs font-bold hover:bg-red-100">Reject</button>
                        <button onclick="processApproval('leaves', '${l.id}', 'approved')" class="bg-emerald-600 text-white px-2.5 py-1 rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-sm">Approve</button>
                    </td>
                </tr>
            `).join('') || `<tr><td colspan="5" class="px-5 py-6 text-center text-slate-400">No pending leaves</td></tr>`;

            // All Company Leaves (with Delete LOP/Leave button)
            document.getElementById('mgmt-all-leaves-tbody').innerHTML = state.allLeaves.map(l => `
                <tr class="hover:bg-slate-50/70">
                    <td class="px-5 py-3.5 font-bold text-slate-800">${l.userName}</td>
                    <td class="px-5 py-3.5 font-bold text-slate-700">${l.type}</td>
                    <td class="px-5 py-3.5 font-medium text-slate-600">${formatDate(l.startDate)} - ${formatDate(l.endDate)}</td>
                    <td class="px-5 py-3.5 text-slate-500">${l.reason}</td>
                    <td class="px-5 py-3.5"><span class="px-2 py-0.5 font-bold rounded-full uppercase text-[10px] ${l.status==='approved'?'bg-emerald-100 text-emerald-700':l.status==='rejected'?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700'}">${l.status}</span></td>
                    <td class="px-5 py-3.5 text-right">
                        <button onclick="deleteLeave('${l.id}')" title="Delete Leave / Cancel LOP Deduction" class="text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 p-1.5 rounded-lg text-xs font-bold">
                            <i class="fas fa-trash-alt"></i> Delete
                        </button>
                    </td>
                </tr>
            `).join('') || `<tr><td colspan="6" class="px-5 py-6 text-center text-slate-400">No leave records</td></tr>`;

            // Employees Directory Table
            document.getElementById('mgmt-employees-tbody').innerHTML = state.allUsers.map(u => {
                const isAdmin = state.currentUser?.role === 'admin';
                return `
                <tr class="hover:bg-slate-50/70">
                    <td class="px-5 py-3.5">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-slate-200 text-slate-600 font-bold flex items-center justify-center text-xs overflow-hidden bg-cover bg-center" style="background-image: url('${u.profilePhoto||''}')">
                                ${!u.profilePhoto ? u.name.charAt(0).toUpperCase() : ''}
                            </div>
                            <div>
                                <p class="font-bold text-slate-800">${u.name} ${u.isDemo ? '<span class="text-[9px] bg-purple-100 text-purple-700 font-bold px-1 rounded ml-1">DEMO</span>' : ''}</p>
                                <p class="text-[10px] text-slate-400">ID: ${u.empId || 'N/A'}</p>
                            </div>
                        </div>
                    </td>
                    <td class="px-5 py-3.5 font-medium text-slate-600">
                        <div><i class="fas fa-envelope text-slate-400 mr-1"></i>${u.email||'--'}</div>
                        <div><i class="fas fa-phone text-slate-400 mr-1"></i>${u.phone||'--'}</div>
                    </td>
                    <td class="px-5 py-3.5 font-medium">
                        <span class="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded text-[10px]">${u.department || 'Operations'}</span>
                        <p class="text-[10px] text-slate-500 mt-0.5 uppercase font-semibold">${u.designation || u.role}</p>
                    </td>
                    <td class="px-5 py-3.5 font-mono font-bold text-slate-700">${formatCurrency(u.annualCTC || 480000)}</td>
                    <td class="px-5 py-3.5 text-right space-x-1.5">
                        <button onclick="openLetterModal('${u.id}')" title="Generate Offer/Appointment Letter" class="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 p-1.5 rounded-lg text-xs font-bold transition">
                            <i class="fas fa-file-contract"></i>
                        </button>
                        ${isAdmin ? `<button onclick="resetUserPassword('${u.id}', '${u.name}')" title="Reset password to 123456" class="text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 p-1.5 rounded-lg text-xs font-bold"><i class="fas fa-key"></i></button>` : ''}
                        <button onclick="openEmpCreateModal('${u.id}')" class="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 p-1.5 rounded-lg text-xs"><i class="fas fa-edit"></i></button>
                        ${u.role !== 'admin' ? `
                        <button onclick="toggleUserActive('${u.id}', ${u.active})" class="${u.active ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'} px-2.5 py-1 rounded-lg text-[11px] font-bold">
                            ${u.active ? 'Active' : 'Inactive'}
                        </button>` : ''}
                    </td>
                </tr>`;
            }).join('');

            // Roster Setup Select & Table
            const rSelect = document.getElementById('roster-user');
            if(rSelect.options.length <= 1) {
                rSelect.innerHTML = `<option value="ALL">Assign to ALL Employees</option>` +
                    state.allUsers.filter(u => u.role === 'employee').map(u => `<option value="${u.id}">${u.name}</option>`).join('');
            }

            document.getElementById('mgmt-roster-tbody').innerHTML = state.allRosters.map(r => `
                <tr class="hover:bg-slate-50/70">
                    <td class="px-5 py-3.5 font-bold text-slate-800">${formatDate(r.date)}</td>
                    <td class="px-5 py-3.5 font-medium text-slate-800">${r.userName}</td>
                    <td class="px-5 py-3.5 font-medium text-slate-600">${r.startTime} - ${r.endTime}</td>
                    <td class="px-5 py-3.5 text-right space-x-2">
                        <button onclick="openEditRosterModal('${r.id}')" class="text-blue-600 hover:text-blue-800 font-bold bg-blue-50 px-2 py-1 rounded text-xs">Edit</button>
                        <button onclick="deleteRoster('${r.id}')" class="text-red-500 hover:text-red-700 p-1 text-xs"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `).join('') || `<tr><td colspan="4" class="px-5 py-6 text-center text-slate-400">No shifts assigned</td></tr>`;

            // Document Verification Table (with preview and rejection feedback)
            document.getElementById('mgmt-verify-docs-tbody').innerHTML = state.allDocs.map(d => `
                <tr class="hover:bg-slate-50/70">
                    <td class="px-5 py-3.5 font-bold text-slate-800">${d.userName}</td>
                    <td class="px-5 py-3.5 font-medium text-slate-600">${d.type}</td>
                    <td class="px-5 py-3.5 font-medium text-slate-600">${formatDate(d.timestamp)}</td>
                    <td class="px-5 py-3.5">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${d.status==='Verified'?'bg-emerald-100 text-emerald-700':d.status==='Rejected'?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700'}">${d.status}</span>
                        ${d.rejectionReason ? `<p class="text-[10px] text-red-600 font-medium mt-0.5"><i class="fas fa-info-circle mr-1"></i>${d.rejectionReason}</p>` : ''}
                    </td>
                    <td class="px-5 py-3.5 text-right space-x-1.5">
                        <button onclick="openDocPreview('${d.id}')" class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded text-xs font-bold shadow-sm"><i class="fas fa-eye mr-1"></i>View</button>
                        <button onclick="verifyDoc('${d.id}', 'Verified')" class="bg-emerald-600 text-white px-2.5 py-1 rounded text-xs font-bold shadow-sm hover:bg-emerald-700">Approve</button>
                        <button onclick="promptRejectDoc('${d.id}')" class="bg-red-50 text-red-600 px-2.5 py-1 rounded text-xs font-bold hover:bg-red-100">Reject</button>
                    </td>
                </tr>
            `).join('') || `<tr><td colspan="5" class="px-5 py-6 text-center text-slate-400">No documents pending verification</td></tr>`;

            // Audit Trail Table
            document.getElementById('mgmt-audit-tbody').innerHTML = state.allAudits.slice(0, 50).map(a => `
                <tr class="hover:bg-slate-50/70">
                    <td class="px-5 py-3.5 font-medium text-slate-500">${new Date(a.timestamp).toLocaleString()}</td>
                    <td class="px-5 py-3.5 font-bold text-slate-800">${a.actor}</td>
                    <td class="px-5 py-3.5 font-bold text-blue-600">${a.action}</td>
                    <td class="px-5 py-3.5 font-medium text-slate-700">${a.target}</td>
                    <td class="px-5 py-3.5 text-slate-600 max-w-xs truncate">${a.details}</td>
                </tr>
            `).join('') || `<tr><td colspan="5" class="px-5 py-6 text-center text-slate-400">No audit records</td></tr>`;

            // Holidays Management Table
            document.getElementById('mgmt-holidays-tbody').innerHTML = state.allHolidays.map(h => `
                <tr class="hover:bg-slate-50/70">
                    <td class="px-5 py-3.5 font-bold text-slate-800">${formatDate(h.date)}</td>
                    <td class="px-5 py-3.5 font-medium text-slate-700">${h.name}</td>
                    <td class="px-5 py-3.5"><span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">${h.type}</span></td>
                    <td class="px-5 py-3.5 text-right">
                        <button onclick="deleteHoliday('${h.id}')" class="text-red-500 hover:text-red-700 p-1"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `).join('') || `<tr><td colspan="4" class="px-5 py-6 text-center text-slate-400">No holidays added</td></tr>`;

            // Settings Fields
            if(document.getElementById('setting-late-val')) {
                document.getElementById('setting-late-val').value = state.settings?.lateThreshold || '09:30';
            }
            if(document.getElementById('setting-ip-toggle')) {
                document.getElementById('setting-ip-toggle').checked = state.settings?.restrictIP || false;
                document.getElementById('setting-ip-val').value = state.settings?.allowedIP || '';
                document.getElementById('setting-ip-toggle').dispatchEvent(new Event('change'));
            }
        };

        

const renderEmployeeDashboard = () => {
            const todayStr = getTodayString();
            document.getElementById('emp-today-date').textContent = formatDate(todayStr);

            const todayRec = state.allRecords.find(r => r.userId === state.currentUser.id && r.date === todayStr);
            const onLeave = state.allLeaves.find(l => l.userId === state.currentUser.id && l.status === 'approved' && todayStr >= l.startDate && todayStr <= l.endDate);

            let currentStatus = onLeave ? 'on_leave' : todayRec ? todayRec.status : 'not_started';

            const statusMap = {
                'not_started': { text: 'Not Punched In', color: 'slate' },
                'working': { text: 'Currently Working', color: 'green' },
                'lunch': { text: 'On Lunch Break', color: 'amber' },
                'tea': { text: 'On Tea Break', color: 'amber' },
                'completed': { text: 'Punched Out (Shift Done)', color: 'blue' },
                'on_leave': { text: 'On Approved Leave', color: 'purple' }
            };

            const cfg = statusMap[currentStatus] || statusMap.not_started;
            document.getElementById('emp-clock-status').textContent = cfg.text;
            document.getElementById('emp-clock-ind').className = `w-4 h-4 rounded-full bg-${cfg.color}-500 shadow-sm`;

            const actContainer = document.getElementById('emp-actions-container');
            actContainer.innerHTML = '';

            const createBtn = (icon, text, cls, act) => {
                const b = document.createElement('button');
                b.className = `flex flex-col items-center justify-center p-3.5 rounded-xl border shadow-sm font-bold text-xs transition-all hover:-translate-y-0.5 ${cls}`;
                b.innerHTML = `<i class="fas ${icon} text-xl mb-1"></i><span>${text}</span>`;
                b.onclick = () => handlePunch(act);
                return b;
            };

            if(currentStatus === 'not_started' || currentStatus === 'completed') {
                actContainer.appendChild(createBtn('fa-sign-in-alt', 'Punch In', 'bg-blue-600 text-white hover:bg-blue-700 col-span-2 sm:col-span-4 py-6', 'punch_in'));
            } else if(currentStatus === 'working') {
                actContainer.appendChild(createBtn('fa-hamburger', 'Lunch Break', 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100', 'start_lunch'));
                actContainer.appendChild(createBtn('fa-mug-hot', 'Tea Break', 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100', 'start_tea'));
                actContainer.appendChild(createBtn('fa-sign-out-alt', 'Punch Out', 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 col-span-2', 'punch_out'));
            } else if(['lunch', 'tea'].includes(currentStatus)) {
                actContainer.appendChild(createBtn('fa-play', 'End Break & Resume Work', 'bg-emerald-600 text-white hover:bg-emerald-700 col-span-2 sm:col-span-4 py-6', 'end_break'));
            } else if(currentStatus === 'on_leave') {
                actContainer.innerHTML = `<div class="col-span-4 text-center py-6 text-slate-500 font-semibold bg-slate-50 rounded-xl border"><i class="fas fa-umbrella-beach text-purple-500 text-2xl mb-1 block"></i>You are on approved leave today.</div>`;
            }

            if(todayRec && currentStatus !== 'on_leave') {
                const { activeWorkMs, totalBreakMs } = calculateDurations(todayRec);
                document.getElementById('emp-stat-work').textContent = formatDuration(activeWorkMs);
                document.getElementById('emp-stat-break').textContent = formatDuration(totalBreakMs);
                document.getElementById('emp-stat-firstin').textContent = formatTime(todayRec.punchIn);
            } else {
                document.getElementById('emp-stat-work').textContent = '0h 0m';
                document.getElementById('emp-stat-break').textContent = '0h 0m';
                document.getElementById('emp-stat-firstin').textContent = '--:--';
            }

            // History Table
            const myRecords = state.allRecords.filter(r => r.userId === state.currentUser.id);
            document.getElementById('emp-history-tbody').innerHTML = myRecords.map(r => {
                const { activeWorkMs } = calculateDurations(r);
                return `
                <tr class="hover:bg-slate-50/70">
                    <td class="px-5 py-3.5 font-bold text-slate-800">
                        ${formatDate(r.date)}
                        ${r.isRegularized ? '<span class="ml-2 text-[10px] font-extrabold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded shadow-sm inline-block">REGULARIZED</span>' : ''}
                    </td>
                    <td class="px-5 py-3.5"><span class="px-2 py-0.5 font-bold rounded-full bg-slate-100 text-slate-700 uppercase text-[10px]">${r.status}</span></td>
                    <td class="px-5 py-3.5 font-medium text-slate-600">${formatTime(r.punchIn)}</td>
                    <td class="px-5 py-3.5 font-medium text-slate-600">${r.punchOut ? formatTime(r.punchOut) : '--:--'}</td>
                    <td class="px-5 py-3.5 font-bold text-slate-800">${formatDuration(activeWorkMs)}</td>
                    <td class="px-5 py-3.5 text-right">
                        <button onclick="openRegModal('${r.id}', '${r.date}')" class="text-blue-600 hover:text-blue-800 font-bold bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md text-[11px]">Regularize</button>
                    </td>
                </tr>`;
            }).join('') || `<tr><td colspan="6" class="px-5 py-6 text-center text-slate-400">No attendance records</td></tr>`;

            // Leaves Table
            document.getElementById('emp-leaves-tbody').innerHTML = state.allLeaves.filter(l => l.userId === state.currentUser.id).map(l => `
                <tr class="hover:bg-slate-50/70">
                    <td class="px-5 py-3.5 font-bold text-slate-800">${l.type}</td>
                    <td class="px-5 py-3.5 font-medium text-slate-600">${formatDate(l.startDate)} - ${formatDate(l.endDate)}</td>
                    <td class="px-5 py-3.5 text-slate-500">${l.reason}</td>
                    <td class="px-5 py-3.5"><span class="px-2 py-0.5 font-bold rounded-full uppercase text-[10px] ${l.status==='approved'?'bg-emerald-100 text-emerald-700':l.status==='rejected'?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700'}">${l.status}</span></td>
                </tr>
            `).join('') || `<tr><td colspan="4" class="px-5 py-6 text-center text-slate-400">No leaves submitted</td></tr>`;

            // Team Roster
            document.getElementById('emp-roster-tbody').innerHTML = state.allRosters.map(r => `
                <tr class="hover:bg-slate-50/70">
                    <td class="px-5 py-3.5 font-bold text-slate-800">${formatDate(r.date)}</td>
                    <td class="px-5 py-3.5 font-medium text-slate-800">${r.userName}</td>
                    <td class="px-5 py-3.5 font-medium text-slate-600">${r.startTime} - ${r.endTime}</td>
                </tr>
            `).join('') || `<tr><td colspan="3" class="px-5 py-6 text-center text-slate-400">No rosters assigned</td></tr>`;

            // Documents Table with Rejection Reason
            document.getElementById('emp-docs-tbody').innerHTML = state.allDocs.filter(d => d.userId === state.currentUser.id).map(d => `
                <tr class="hover:bg-slate-50/70">
                    <td class="px-5 py-3.5 font-bold text-slate-800">${d.type}</td>
                    <td class="px-5 py-3.5 font-medium text-slate-600">${formatDate(d.timestamp)}</td>
                    <td class="px-5 py-3.5">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${d.status==='Verified'?'bg-emerald-100 text-emerald-700':d.status==='Rejected'?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700'}">${d.status}</span>
                        ${d.rejectionReason ? `<p class="text-[10px] text-red-600 font-semibold mt-1"><i class="fas fa-info-circle mr-1"></i>${d.rejectionReason}</p>` : ''}
                    </td>
                </tr>
            `).join('') || `<tr><td colspan="3" class="px-5 py-6 text-center text-slate-400">No documents uploaded</td></tr>`;

            // Holidays
            document.getElementById('emp-holidays-tbody').innerHTML = state.allHolidays.map(h => `
                <tr class="hover:bg-slate-50/70">
                    <td class="px-5 py-3.5 font-bold text-slate-800">${formatDate(h.date)}</td>
                    <td class="px-5 py-3.5 font-medium text-slate-700">${h.name}</td>
                    <td class="px-5 py-3.5"><span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">${h.type}</span></td>
                </tr>
            `).join('') || `<tr><td colspan="3" class="px-5 py-6 text-center text-slate-400">No holidays added</td></tr>`;

            // Employee Payroll Vault
            document.getElementById('emp-payroll-ctc-display').textContent = formatCurrency(state.currentUser.annualCTC || 480000) + ' / yr';
            const payTbody = document.getElementById('emp-payroll-tbody');
            if (payTbody) {
                const userStatements = [];
                state.payrollBatches.forEach(b => {
                    const rec = b.records?.find(r => r.userId === state.currentUser.id);
                    if (rec) userStatements.push({ ...rec, approvedAt: b.approvedAt });
                });

                if (userStatements.length === 0) {
                    payTbody.innerHTML = `<tr><td colspan="6" class="px-5 py-6 text-center text-slate-400">No locked salary statements available yet.</td></tr>`;
                } else {
                    payTbody.innerHTML = userStatements.map((s, idx) => `
                        <tr class="hover:bg-slate-50/70">
                            <td class="px-5 py-3.5 font-bold text-slate-800">${s.month}</td>
                            <td class="px-5 py-3.5 font-mono">${formatCurrency(s.monthlyCTC)}</td>
                            <td class="px-5 py-3.5 font-mono text-rose-600 font-bold">${formatCurrency(s.lopDeduction)}</td>
                            <td class="px-5 py-3.5 font-mono text-slate-600">${formatCurrency(s.pf + s.pt)}</td>
                            <td class="px-5 py-3.5 font-mono font-black text-emerald-700">${formatCurrency(s.netPay)}</td>
                            <td class="px-5 py-3.5 text-right">
                                <button onclick="downloadCustomPayslipPDF(${JSON.stringify(s).replace(/"/g, '&quot;')})" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm transition">
                                    <i class="fas fa-file-pdf mr-1"></i>Download Payslip
                                </button>
                            </td>
                        </tr>
                    `).join('');
                }
            }
        };

        
// ==================== BACKEND DATA SYNCHRONIZATION ====================
async function refreshAllData() {
    if (!state.currentUser) return;

    try {
        const isMgmt = ['admin', 'hr', 'supervisor'].includes(state.currentUser.role);

        // Fetch parallel collections
        const promises = [
            API.getUsers().then(u => state.allUsers = u),
            API.getAttendance().then(a => state.allRecords = a),
            API.getLeaves().then(l => state.allLeaves = l),
            API.getRegularizations().then(r => state.allReqs = r),
            API.getRosters().then(r => state.allRosters = r),
            API.getDocuments().then(d => state.allDocs = d),
            API.getHolidays().then(h => state.allHolidays = h),
            API.getAnnouncements().then(an => state.allAnnouncements = an),
            API.getSettings().then(s => state.settings = s)
        ];

        if (isMgmt) {
            promises.push(API.getPayrollBatches().then(b => state.payrollBatches = b));
            promises.push(API.getAudits(50).then(au => state.allAudits = au));
        } else {
            promises.push(API.getMyPayslips().then(p => state.myPayslips = p));
        }

        await Promise.all(promises);
        renderView();
    } catch (err) {
        console.error("Data synchronization error:", err);
    }
}

// Render Master View based on Active User Session
const renderView = () => {
    if (!state.currentUser) return;

    // User Avatar & Name
    const nameEl = document.getElementById('user-name-display');
    if (nameEl) nameEl.textContent = state.currentUser.name;

    const roleBadge = document.getElementById('role-badge');
    if (roleBadge) {
        roleBadge.textContent = state.currentUser.role;
        roleBadge.className = `px-3 py-1 text-[11px] font-extrabold rounded-full uppercase tracking-wider ${
            state.currentUser.role === 'admin' ? 'bg-indigo-100 text-indigo-700' :
            state.currentUser.role === 'supervisor' ? 'bg-amber-100 text-amber-700' :
            state.currentUser.role === 'hr' ? 'bg-purple-100 text-purple-700' :
            'bg-blue-100 text-blue-700'
        }`;
    }

    const avatar = document.getElementById('user-avatar');
    if (avatar) {
        if (state.currentUser.profilePhoto) {
            avatar.style.backgroundImage = `url('${state.currentUser.profilePhoto}')`;
            avatar.innerHTML = '';
        } else {
            avatar.style.backgroundImage = 'none';
            avatar.innerHTML = `<span>${(state.currentUser.name || 'U').charAt(0).toUpperCase()}</span>`;
        }
    }

    // Announcements / Notifications Drawer
    const notifList = document.getElementById('notif-list');
    const notifCountTag = document.getElementById('notif-count-tag');
    if (notifCountTag) notifCountTag.textContent = state.allAnnouncements.length;

    if (notifList) {
        if (state.allAnnouncements.length > 0) {
            document.getElementById('bell-badge')?.classList.remove('hidden');
            notifList.innerHTML = state.allAnnouncements.map(a => {
                const isDirect = a.targetType === 'USER';
                const isDept = a.targetType === 'DEPARTMENT';

                const audienceBadge = isDirect
                    ? `<span class="px-2 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-700 inline-flex items-center gap-1"><i class="fas fa-user-lock"></i>Direct Message</span>`
                    : isDept
                    ? `<span class="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 inline-flex items-center gap-1"><i class="fas fa-building"></i>${a.department}</span>`
                    : `<span class="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700 inline-flex items-center gap-1"><i class="fas fa-bullhorn"></i>Company-wide</span>`;

                const isMgmt = ['admin', 'hr', 'supervisor'].includes(state.currentUser?.role);

                let ackSection = '';
                if (a.requiresAck) {
                    if (a.hasAcknowledged) {
                        ackSection = `
                        <div class="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                            <span class="text-emerald-600 font-bold flex items-center gap-1"><i class="fas fa-check-circle"></i>You acknowledged receipt</span>
                            <span class="text-slate-400 font-mono text-[9px]">${formatDate(a.acknowledgedAt)}</span>
                        </div>`;
                    } else {
                        ackSection = `
                        <div class="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                            <span class="text-[10px] text-amber-600 font-bold flex items-center gap-1"><i class="fas fa-exclamation-circle"></i>Ack Required</span>
                            <button onclick="handleAcknowledgeAnnouncement('${a.id}')" class="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[10px] shadow-sm transition">
                                Acknowledge Receipt
                            </button>
                        </div>`;
                    }
                }

                let mgmtAckSummary = '';
                if (isMgmt && a.requiresAck) {
                    const count = a.ackCount || (a.acknowledgements ? a.acknowledgements.length : 0);
                    mgmtAckSummary = `
                    <div class="mt-1.5 flex items-center justify-between text-[10px] text-slate-500 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                        <span class="font-semibold text-slate-700"><i class="fas fa-user-check text-blue-600 mr-1"></i>Acks: <b>${count}</b></span>
                        <span class="text-[9px] text-slate-400">By: ${a.author || 'HR'}</span>
                    </div>`;
                }

                return `
                <div class="p-3 hover:bg-slate-50/80 rounded-xl transition-colors border border-slate-100 bg-white shadow-xs">
                    <div class="flex justify-between items-start gap-2 mb-1">
                        <span class="font-bold text-xs text-slate-800 leading-snug">${a.title}</span>
                        <span class="text-[9px] text-slate-400 whitespace-nowrap">${formatDate(a.timestamp)}</span>
                    </div>
                    <div class="mb-2 flex items-center gap-1.5 flex-wrap">
                        ${audienceBadge}
                        <span class="text-[9px] text-slate-400 font-medium">From: ${a.author || 'Management'}</span>
                    </div>
                    <p class="text-[11px] text-slate-600 leading-relaxed">${a.message}</p>
                    ${ackSection}
                    ${mgmtAckSummary}
                </div>`;
            }).join('');
        } else {
            notifList.innerHTML = `<p class="text-xs text-slate-400 text-center py-6">No announcements or messages</p>`;
            document.getElementById('bell-badge')?.classList.add('hidden');
        }
    }

    if (['admin', 'supervisor', 'hr'].includes(state.currentUser.role)) {
        renderManagementDashboard();
    } else {
        renderEmployeeDashboard();
    }
};

// Payroll Calculation and Locking
window.processMonthlyPayrollRun = async () => {
    const mInput = document.getElementById('payroll-process-month');
    if (!mInput || !mInput.value) {
        return showToast("Please choose a valid month to process payroll", "error");
    }
    const ym = mInput.value;

    try {
        const res = await API.processPayroll(ym);
        state.currentPayrollRun = res.records;

        const elGross = document.getElementById('pay-sum-gross');
        if (elGross) elGross.textContent = formatCurrency(res.summary.totalGross);
        const elLop = document.getElementById('pay-sum-lop');
        if (elLop) elLop.textContent = formatCurrency(res.summary.totalLOP);
        const elStat = document.getElementById('pay-sum-stat');
        if (elStat) elStat.textContent = formatCurrency(res.summary.totalStat);
        const elNet = document.getElementById('pay-sum-net');
        if (elNet) elNet.textContent = formatCurrency(res.summary.totalNet);

        renderPayrollTable();
        showToast(`Payroll calculated for ${res.records.length} employees (${ym})`);
    } catch (err) {
        showToast(err.message || "Failed to process payroll", "error");
    }
};

const renderPayrollTable = () => {
    const tbody = document.getElementById('mgmt-payroll-tbody');
    if (!tbody) return;

    tbody.innerHTML = state.currentPayrollRun.map(r => `
        <tr class="hover:bg-slate-50/70">
            <td class="px-5 py-3.5 font-bold text-slate-800">${r.name}<br><span class="text-[10px] text-slate-400">ID: ${r.empId}</span></td>
            <td class="px-5 py-3.5 font-mono text-slate-700">${formatCurrency(r.monthlyCTC)}</td>
            <td class="px-5 py-3.5"><span class="px-2 py-0.5 rounded-full font-bold text-xs ${r.unpaidDays > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}">${r.unpaidDays} Days</span></td>
            <td class="px-5 py-3.5 font-mono text-rose-600 font-bold">-${formatCurrency(r.lopDeduction)}</td>
            <td class="px-5 py-3.5 font-mono text-slate-600">${formatCurrency(r.earnedGross)}</td>
            <td class="px-5 py-3.5 font-mono text-slate-500">-${formatCurrency(r.pf + r.pt)}</td>
            <td class="px-5 py-3.5 font-mono font-black text-emerald-600 text-sm">${formatCurrency(r.netPay)}</td>
            <td class="px-5 py-3.5 text-right">
                <button onclick="downloadCustomPayslipPDF(${JSON.stringify(r).replace(/"/g, '&quot;')})" class="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded text-xs font-bold shadow-sm">
                    <i class="fas fa-file-pdf mr-1"></i>Payslip
                </button>
            </td>
        </tr>
    `).join('') || `<tr><td colspan="8" class="px-5 py-6 text-center text-slate-400">No payroll run calculated yet. Select month and click Process Month.</td></tr>`;
};

window.lockAndApprovePayroll = async () => {
    if (!state.currentPayrollRun || !state.currentPayrollRun.length) {
        return showToast("Please process a monthly payroll run first before locking.", "error");
    }

    const ym = state.currentPayrollRun[0].month;
    const confirmed = await customConfirm(`Are you sure you want to officially LOCK & APPROVE payroll for ${ym}? This will disburse payslips to employees.`, "Lock & Approve Payroll");
    if (!confirmed) return;

    try {
        await API.lockPayroll(ym, state.currentPayrollRun);
        showToast(`Payroll locked & approved for ${ym}! Payslips are now available in My Payroll.`);
        await refreshAllData();
    } catch (err) {
        showToast(err.message || "Failed to lock payroll batch", "error");
    }
};

// Navigation Switching
const switchEmpTab = (target) => {
    document.querySelectorAll('.emp-view-panel').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-tab-btn').forEach(b => {
        b.classList.remove('border-blue-600', 'text-blue-600');
        b.classList.add('border-transparent', 'text-slate-500');
    });
    const panel = document.getElementById(target);
    if (panel) panel.classList.remove('hidden');
    const btn = document.querySelector(`[data-target="${target}"]`);
    if (btn) { btn.classList.add('border-blue-600', 'text-blue-600'); btn.classList.remove('border-transparent', 'text-slate-500'); }
    if (target === 'emp-tab-calendar') renderEmpAttendanceCalendar();
};
document.querySelectorAll('.nav-tab-btn').forEach(b => b.addEventListener('click', (e) => switchEmpTab(e.currentTarget.dataset.target)));

const switchMgmtTab = (target) => {
    document.querySelectorAll('.mgmt-view-panel').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.mgmt-tab-btn').forEach(b => {
        b.classList.remove('border-blue-600', 'text-blue-600');
        b.classList.add('border-transparent', 'text-slate-500');
    });
    const panel = document.getElementById(target);
    if (panel) panel.classList.remove('hidden');
    const btn = document.querySelector(`[data-target="${target}"]`);
    if (btn) { btn.classList.add('border-blue-600', 'text-blue-600'); btn.classList.remove('border-transparent', 'text-slate-500'); }
    if (target === 'mgmt-tab-dashboard') renderRealCharts();
    if (target === 'mgmt-tab-calendar') renderMgmtAttendanceCalendar();
    if (target === 'mgmt-tab-payroll') renderPayrollTable();
};
document.querySelectorAll('.mgmt-tab-btn').forEach(b => b.addEventListener('click', (e) => switchMgmtTab(e.currentTarget.dataset.target)));

window.setDashboardFilterPreset = (preset) => {
    state.dashboardFilter.preset = preset;
    const today = new Date();

    ['today', 'yesterday', 'week', 'month'].forEach(p => {
        const b = document.getElementById(`flt-btn-${p}`);
        if (!b) return;
        if (p === preset) b.className = "px-3 py-1 font-bold rounded-lg bg-white shadow-sm text-blue-700";
        else b.className = "px-3 py-1 font-semibold rounded-lg text-slate-600 hover:text-slate-900";
    });

    if (preset === 'today') {
        state.dashboardFilter.startDate = getTodayString();
        state.dashboardFilter.endDate = getTodayString();
    } else if (preset === 'yesterday') {
        const y = new Date(); y.setDate(y.getDate() - 1);
        state.dashboardFilter.startDate = y.toLocaleDateString('en-CA');
        state.dashboardFilter.endDate = y.toLocaleDateString('en-CA');
    } else if (preset === 'week') {
        const w = new Date(); w.setDate(w.getDate() - 7);
        state.dashboardFilter.startDate = w.toLocaleDateString('en-CA');
        state.dashboardFilter.endDate = getTodayString();
    } else if (preset === 'month') {
        const m = new Date(); m.setDate(m.getDate() - 30);
        state.dashboardFilter.startDate = m.toLocaleDateString('en-CA');
        state.dashboardFilter.endDate = getTodayString();
    }
    renderManagementDashboard();
};

window.applyCustomDashboardFilter = () => {
    const sEl = document.getElementById('flt-custom-start') || document.getElementById('flt-date-start');
    const eEl = document.getElementById('flt-custom-end') || document.getElementById('flt-date-end');
    const s = sEl ? sEl.value : '';
    const e = eEl ? eEl.value : '';
    if (!s || !e) return showToast("Select start and end dates", "error");
    if (s > e) return showToast("Start date must be before end date", "error");

    state.dashboardFilter.preset = 'custom';
    state.dashboardFilter.startDate = s;
    state.dashboardFilter.endDate = e;

    ['today', 'yesterday', 'week', 'month'].forEach(p => {
        const b = document.getElementById(`flt-btn-${p}`);
        if (b) b.className = "px-3 py-1 font-semibold rounded-lg text-slate-600 hover:text-slate-900";
    });
    renderManagementDashboard();
};

window.resetDashboardFilter = () => {
    const sEl = document.getElementById('flt-custom-start') || document.getElementById('flt-date-start');
    const eEl = document.getElementById('flt-custom-end') || document.getElementById('flt-date-end');
    if (sEl) sEl.value = '';
    if (eEl) eEl.value = '';
    setDashboardFilterPreset('today');
};

// Punch Clocks Handler
window.handlePunch = async (action) => {
    try {
        let loc = null;
        if (action === 'punch_in') {
            loc = await getGeo();
        }
        const res = await API.punch(action, loc);
        showToast(res.message);
        await refreshAllData();
    } catch (err) {
        showToast(err.message || "Clock action failed", "error");
    }
};

// Leave Modal & Submit
window.openApplyLeaveModalForEmp = () => {
    document.getElementById('leave-modal-title').textContent = "Apply for Leave";
    document.getElementById('leave-target-user-container').classList.add('hidden');
    document.getElementById('leave-modal').classList.remove('hidden');
};

window.openApplyLeaveModalForMgmt = () => {
    document.getElementById('leave-modal-title').textContent = "Grant Official Leave";
    const container = document.getElementById('leave-target-user-container');
    container.classList.remove('hidden');

    const select = document.getElementById('leave-target-user');
    const emps = state.allUsers.filter(u => u.role === 'employee' || u.role === 'supervisor');
    select.innerHTML = emps.map(u => `<option value="${u.id}">${u.name} (${u.empId || 'Staff'})</option>`).join('');
    document.getElementById('leave-modal').classList.remove('hidden');
};

document.getElementById('leave-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.getElementById('leave-type').value;
    const start = document.getElementById('leave-start').value;
    const end = document.getElementById('leave-end').value;
    const reason = document.getElementById('leave-reason').value.trim();
    const targetUserContainer = document.getElementById('leave-target-user-container');

    let targetUserId = null;
    if (!targetUserContainer.classList.contains('hidden')) {
        targetUserId = document.getElementById('leave-target-user').value;
    }

    try {
        const res = await API.createLeave({ type, startDate: start, endDate: end, reason, targetUserId });
        showToast(res.message);
        document.getElementById('leave-modal').classList.add('hidden');
        e.target.reset();
        await refreshAllData();
    } catch (err) {
        showToast(err.message || "Failed to submit leave", "error");
    }
});

window.deleteLeave = async (leaveId) => {
    const confirmed = await customConfirm("Are you sure you want to delete this leave record? If this is an Unpaid/LOP leave, deleting it removes the salary deduction.", "Delete Leave Record");
    if (!confirmed) return;

    try {
        await API.deleteLeave(leaveId);
        showToast("Leave record deleted successfully");
        await refreshAllData();
    } catch (err) {
        showToast(err.message || "Failed to delete leave", "error");
    }
};

// Regularization Modal & Submit
window.openRegModal = (attId, date) => {
    document.getElementById('reg-attendance-id').value = attId || '';
    document.getElementById('reg-date-val').value = date;
    document.getElementById('reg-date-display').textContent = formatDate(date);
    document.getElementById('reg-next-day').checked = false;
    document.getElementById('reg-modal').classList.remove('hidden');
};

document.getElementById('reg-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const attId = document.getElementById('reg-attendance-id').value;
    const date = document.getElementById('reg-date-val').value;
    const inT = document.getElementById('reg-in-time').value;
    const outT = document.getElementById('reg-out-time').value;
    const reason = document.getElementById('reg-reason').value.trim();
    const isNextDay = document.getElementById('reg-next-day').checked;

    let outDateStr = date;
    if (isNextDay) {
        const nextD = new Date(date + 'T12:00:00Z');
        nextD.setDate(nextD.getDate() + 1);
        outDateStr = nextD.toISOString().split('T')[0];
    }

    const fullIn = new Date(`${date}T${inT}:00`).toISOString();
    const fullOut = new Date(`${outDateStr}T${outT}:00`).toISOString();

    try {
        const res = await API.createRegularization({
            attendanceId: attId,
            date,
            reqPunchIn: fullIn,
            reqPunchOut: fullOut,
            reason
        });
        showToast(res.message);
        document.getElementById('reg-modal').classList.add('hidden');
        e.target.reset();
        await refreshAllData();
    } catch (err) {
        showToast(err.message || "Failed to submit request", "error");
    }
});

// Process Approvals (Regularizations & Leaves)
window.processApproval = async (coll, id, status) => {
    const actionText = status === 'approved' ? 'Approve' : 'Reject';
    const confirmed = await customConfirm(`Are you sure you want to ${actionText} this ${coll === 'regularizations' ? 'regularization' : 'leave'} request?`, `${actionText} Request`);
    if (!confirmed) return;

    try {
        if (coll === 'regularizations') {
            await API.updateRegularizationStatus(id, status);
        } else {
            await API.updateLeaveStatus(id, status);
        }
        showToast(`Request marked as ${status}!`);
        await refreshAllData();
    } catch (err) {
        showToast(err.message || `Failed to process ${coll} request`, "error");
    }
};

// Employee Master Creation / Editing
window.openEmpCreateModal = (userId = null) => {
    document.getElementById('emp-form').reset();
    const photoEl = document.getElementById('emp-photo-base64');
    if (photoEl) photoEl.value = '';
    const modal = document.getElementById('emp-modal');
    const title = document.getElementById('emp-modal-title');

    if (userId) {
        const u = state.allUsers.find(x => x.id === userId);
        if (u) {
            title.textContent = "Edit Employee: " + u.name;
            document.getElementById('emp-edit-id').value = u.id;
            document.getElementById('emp-username').value = u.username || '';
            document.getElementById('emp-password').value = '';
            document.getElementById('emp-name').value = u.name || '';
            document.getElementById('emp-email').value = u.email || '';
            document.getElementById('emp-phone').value = u.phone || '';
            document.getElementById('emp-address').value = u.address || '';
            document.getElementById('emp-id-val').value = u.empId || '';
            document.getElementById('emp-joining').value = u.joiningDate || '';
            document.getElementById('emp-dept').value = u.department || 'Operations';
            document.getElementById('emp-designation').value = u.designation || '';
            document.getElementById('emp-role-select').value = u.role || 'employee';
            document.getElementById('emp-ctc').value = u.annualCTC || 480000;
            document.getElementById('emp-aadhar').value = u.aadhar || '';
            document.getElementById('emp-pan').value = u.pan || '';
        }
    } else {
        title.textContent = "Add New Employee";
        document.getElementById('emp-edit-id').value = '';
    }
    modal.classList.remove('hidden');
};

document.getElementById('emp-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('emp-edit-id').value;
    const username = document.getElementById('emp-username').value.trim();
    const password = document.getElementById('emp-password').value.trim();
    const name = document.getElementById('emp-name').value.trim();
    const email = document.getElementById('emp-email').value.trim();
    const phone = document.getElementById('emp-phone').value.trim();
    const address = document.getElementById('emp-address').value.trim();
    const empId = document.getElementById('emp-id-val').value.trim();
    const joiningDate = document.getElementById('emp-joining').value;
    const department = document.getElementById('emp-dept').value;
    const designation = document.getElementById('emp-designation').value.trim();
    const role = document.getElementById('emp-role-select').value;
    const annualCTC = Number(document.getElementById('emp-ctc').value) || 480000;
    const aadhar = document.getElementById('emp-aadhar').value.trim();
    const pan = document.getElementById('emp-pan').value.trim().toUpperCase();
    const photoEl = document.getElementById('emp-photo-base64');
    const profilePhoto = photoEl ? photoEl.value : '';

    const payload = {
        username, name, email, phone, address,
        empId, joiningDate, department, designation, role,
        annualCTC, aadhar, pan
    };
    if (password) payload.password = password;
    if (profilePhoto) payload.profilePhoto = profilePhoto;

    try {
        if (editId) {
            await API.updateUser(editId, payload);
            showToast("Employee record updated successfully!");
        } else {
            if (!password) return showToast("Password required for new employee", "error");
            await API.createUser(payload);
            showToast("Employee created successfully!");
        }
        document.getElementById('emp-modal').classList.add('hidden');
        e.target.reset();
        await refreshAllData();
    } catch (err) {
        showToast(err.message || "Failed to save employee record", "error");
    }
});

// User Active Toggle & Password Reset
window.toggleUserActive = async (userId, currentActive) => {
    const targetUser = state.allUsers.find(u => u.id === userId);
    const newStatus = !currentActive;
    const actionName = newStatus ? 'Reactivate' : 'Deactivate';
    const confirmed = await customConfirm(`Are you sure you want to ${actionName} employee ${targetUser ? targetUser.name : userId}?`, `${actionName} Employee`);
    if (!confirmed) return;

    try {
        const res = await API.toggleUserActive(userId);
        showToast(res.message);
        await refreshAllData();
    } catch (err) {
        showToast(err.message || "Failed to update user status", "error");
    }
};

window.resetUserPassword = async (userId, userName) => {
    const confirmed = await customConfirm(`Are you sure you want to reset the password for ${userName} to default ('password123')?`, "Reset Password");
    if (!confirmed) return;

    try {
        const res = await API.resetUserPassword(userId);
        showToast(res.message);
    } catch (err) {
        showToast(err.message || "Failed to reset password", "error");
    }
};

// Roster Scheduling Handlers
window.openEditRosterModal = (rosterId) => {
    const r = state.allRosters.find(x => x.id === rosterId);
    if (!r) return;
    document.getElementById('edit-roster-id').value = r.id;
    document.getElementById('edit-roster-date').value = r.date || '';
    document.getElementById('edit-roster-start').value = r.startTime || '';
    document.getElementById('edit-roster-end').value = r.endTime || '';
    document.getElementById('edit-roster-modal').classList.remove('hidden');
};

document.getElementById('edit-roster-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-roster-id').value;
    const date = document.getElementById('edit-roster-date').value;
    const startTime = document.getElementById('edit-roster-start').value;
    const endTime = document.getElementById('edit-roster-end').value;

    try {
        await API.updateRoster(id, { date, startTime, endTime });
        showToast("Shift schedule updated successfully!");
        document.getElementById('edit-roster-modal').classList.add('hidden');
        await refreshAllData();
    } catch (err) {
        showToast(err.message || "Failed to update shift schedule", "error");
    }
});

document.getElementById('roster-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const targetUserId = document.getElementById('roster-user').value;
    const date = document.getElementById('roster-date').value;
    const startTime = document.getElementById('roster-start').value;
    const endTime = document.getElementById('roster-end').value;

    try {
        const res = await API.createRoster({ targetUserId, date, startTime, endTime });
        showToast(res.message);
        e.target.reset();
        await refreshAllData();
    } catch (err) {
        showToast(err.message || "Failed to assign shift roster", "error");
    }
});

window.deleteRoster = async (rosterId) => {
    const confirmed = await customConfirm("Are you sure you want to delete this shift schedule?", "Delete Roster Shift");
    if (!confirmed) return;

    try {
        await API.deleteRoster(rosterId);
        showToast("Shift schedule deleted!");
        await refreshAllData();
    } catch (err) {
        showToast(err.message || "Failed to delete shift schedule", "error");
    }
};

// Holiday Handlers
document.getElementById('holiday-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('hol-name').value.trim();
    const date = document.getElementById('hol-date').value;
    const type = document.getElementById('hol-type').value;

    try {
        const res = await API.createHoliday(name, date, type);
        showToast(res.message);
        document.getElementById('holiday-modal').classList.add('hidden');
        e.target.reset();
        await refreshAllData();
    } catch (err) {
        showToast(err.message || "Failed to add holiday", "error");
    }
});

window.deleteHoliday = async (holidayId) => {
    const confirmed = await customConfirm("Are you sure you want to delete this holiday from company calendar?", "Delete Holiday");
    if (!confirmed) return;

    try {
        await API.deleteHoliday(holidayId);
        showToast("Holiday deleted from calendar");
        await refreshAllData();
    } catch (err) {
        showToast(err.message || "Failed to delete holiday", "error");
    }
};

// Announcement Audience Toggle & Form Handlers
document.getElementById('ann-target-type')?.addEventListener('change', (e) => {
    const val = e.target.value;
    const deptBox = document.getElementById('ann-dept-container');
    const userBox = document.getElementById('ann-user-container');

    if (deptBox) deptBox.classList.toggle('hidden', val !== 'DEPARTMENT');
    if (userBox) {
        userBox.classList.toggle('hidden', val !== 'USER');
        if (val === 'USER') {
            const userSelect = document.getElementById('ann-user');
            if (userSelect) {
                userSelect.innerHTML = state.allUsers.map(u => `<option value="${u.id}">${u.name} (${u.empId || u.role})</option>`).join('');
            }
        }
    }
});

// Open Announcement Modal and populate users
window.openAnnouncementModal = () => {
    const modal = document.getElementById('announcement-modal');
    if (modal) modal.classList.remove('hidden');
    const userSelect = document.getElementById('ann-user');
    if (userSelect && state.allUsers && state.allUsers.length) {
        userSelect.innerHTML = state.allUsers.map(u => `<option value="${u.id}">${u.name} (${u.empId || u.role})</option>`).join('');
    }
};

document.getElementById('announcement-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('ann-title').value.trim();
    const targetType = document.getElementById('ann-target-type')?.value || 'ALL';
    const department = document.getElementById('ann-dept')?.value || 'ALL';
    const targetUserId = targetType === 'USER' ? document.getElementById('ann-user')?.value : null;
    const message = document.getElementById('ann-message').value.trim();
    const requiresAck = document.getElementById('ann-require-ack')?.checked || false;

    try {
        const res = await API.createAnnouncement({
            title,
            targetType,
            department,
            targetUserId,
            message,
            requiresAck
        });
        showToast(res.message || "Announcement published successfully!");
        document.getElementById('announcement-modal').classList.add('hidden');
        e.target.reset();
        document.getElementById('ann-dept-container')?.classList.add('hidden');
        document.getElementById('ann-user-container')?.classList.add('hidden');
        await refreshAllData();
    } catch (err) {
        showToast(err.message || "Failed to publish announcement", "error");
    }
});

window.handleAcknowledgeAnnouncement = async (annId) => {
    try {
        const res = await API.acknowledgeAnnouncement(annId);
        showToast(res.message || "Receipt acknowledged!");
        await refreshAllData();
    } catch (err) {
        showToast(err.message || "Failed to acknowledge receipt", "error");
    }
};

// Document Upload & Verification Handlers
document.getElementById('doc-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        if (file.size > 8 * 1024 * 1024) {
            showToast("File size exceeds 8MB limit", "error");
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            document.getElementById('doc-file-base64').value = ev.target.result;
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById('doc-upload-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.getElementById('doc-type').value;
    const fileData = document.getElementById('doc-file-base64').value;
    if (!fileData) return showToast("Please select a file to upload", "error");

    try {
        const res = await API.uploadDocument(type, fileData);
        showToast(res.message);
        document.getElementById('doc-upload-modal').classList.add('hidden');
        document.getElementById('doc-file-base64').value = '';
        e.target.reset();
        await refreshAllData();
    } catch (err) {
        showToast(err.message || "Failed to upload document", "error");
    }
});

window.openDocPreview = (docId) => {
    const d = state.allDocs.find(x => x.id === docId);
    if (!d) return;
    document.getElementById('doc-preview-title').textContent = `${d.userName} - ${d.type}`;
    const container = document.getElementById('doc-preview-body');
    if (d.fileData && d.fileData.startsWith('data:image/')) {
        container.innerHTML = `<img src="${d.fileData}" class="max-h-[65vh] object-contain rounded-lg border shadow-sm">`;
    } else if (d.fileData && d.fileData.startsWith('data:application/pdf')) {
        container.innerHTML = `<iframe src="${d.fileData}" class="w-full h-[65vh] rounded-lg border"></iframe>`;
    } else {
        container.innerHTML = `<p class="text-sm text-slate-500 py-10">Preview unavailable. Document is securely saved.</p>`;
    }
    document.getElementById('doc-preview-modal').classList.remove('hidden');
};

window.promptRejectDoc = async (docId) => {
    const reason = await customPrompt("Please enter the reason for rejecting this document:", "Reject Document");
    if (!reason) return;
    verifyDoc(docId, 'Rejected', reason);
};

window.verifyDoc = async (id, status, reason = '') => {
    try {
        await API.verifyDocument(id, status, reason);
        showToast(`Document marked as ${status}`);
        await refreshAllData();
    } catch (err) {
        showToast(err.message || "Verification error", "error");
    }
};

// Password Change Handler
document.getElementById('btn-save-password')?.addEventListener('click', async () => {
    const newPwd = document.getElementById('new-password-input').value.trim();
    const confPwd = document.getElementById('confirm-password-input').value.trim();

    if (!newPwd || newPwd.length < 6) {
        return showToast("Password must be at least 6 characters long", "error");
    }
    if (newPwd !== confPwd) {
        return showToast("Passwords do not match", "error");
    }

    try {
        await API.changePassword(newPwd);
        showToast("Password updated successfully!");
        document.getElementById('password-modal').classList.add('hidden');
        document.getElementById('new-password-input').value = '';
        document.getElementById('confirm-password-input').value = '';
    } catch (err) {
        showToast(err.message || "Failed to update password", "error");
    }
});

// Notifications Drawer Toggle & Outside-Click Handling
const notifDrawer = document.getElementById('notif-drawer');
const btnToggleNotif = document.getElementById('btn-toggle-notif');
const btnCloseNotif = document.getElementById('btn-close-notif');

btnToggleNotif?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (notifDrawer) notifDrawer.classList.toggle('hidden');
});

btnCloseNotif?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (notifDrawer) notifDrawer.classList.add('hidden');
});

document.addEventListener('click', (e) => {
    if (notifDrawer && !notifDrawer.classList.contains('hidden')) {
        if (!notifDrawer.contains(e.target) && !btnToggleNotif?.contains(e.target)) {
            notifDrawer.classList.add('hidden');
        }
    }
});

// Settings Handlers
document.getElementById('btn-save-late')?.addEventListener('click', async () => {
    const lateVal = document.getElementById('setting-late-val').value;
    if (!lateVal) return showToast("Please select a late cutoff time", "error");

    try {
        await API.updateSettings({ lateThreshold: lateVal });
        showToast("Late cutoff threshold updated!");
        await refreshAllData();
    } catch (err) {
        showToast(err.message || "Failed to update late threshold", "error");
    }
});

document.getElementById('setting-ip-toggle')?.addEventListener('change', (e) => {
    const container = document.getElementById('setting-ip-container');
    if (container) {
        if (e.target.checked) container.classList.remove('opacity-50', 'pointer-events-none');
        else container.classList.add('opacity-50', 'pointer-events-none');
    }
});

document.getElementById('btn-save-settings')?.addEventListener('click', async () => {
    const isRestricted = document.getElementById('setting-ip-toggle').checked;
    const allowedIP = document.getElementById('setting-ip-val').value.trim();

    if (isRestricted && !allowedIP) {
        return showToast("Please specify the office public IP address", "error");
    }

    try {
        await API.updateSettings({ restrictIP: isRestricted, allowedIP });
        showToast("Office IP restriction settings saved!");
        await refreshAllData();
    } catch (err) {
        showToast(err.message || "Failed to save settings", "error");
    }
});

// Demo Data Actions
window.seed3DemoEmployees = async (silent = false) => {
    try {
        const res = await API.seedDemo();
        if (!silent) showToast(res.message);
        await refreshAllData();
    } catch (err) {
        if (!silent) showToast(err.message || "Failed to seed demo data", "error");
    }
};

window.purge3DemoEmployees = async () => {
    const confirmed = await customConfirm("Are you sure you want to permanently delete all 3 demo employees and their records?", "Purge Demo Staff");
    if (!confirmed) return;

    try {
        const res = await API.purgeDemo();
        showToast(res.message);
        await refreshAllData();
    } catch (err) {
        showToast(err.message || "Failed to purge demo data", "error");
    }
};

// User Authentication (Login & Logout)
DOM.loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value.trim();

    try {
        const res = await API.login(u, p);
        state.currentUser = res.user;
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';

        DOM.loginView.classList.add('hidden');
        DOM.appView.classList.remove('hidden');

        // Adjust navigation visibility
        if (['admin', 'supervisor', 'hr'].includes(res.user.role)) {
            document.getElementById('mgmt-tab-nav').classList.remove('hidden');
            document.getElementById('emp-tab-nav').classList.add('hidden');
            document.getElementById('mgmt-panels').classList.remove('hidden');
            document.getElementById('employee-panels').classList.add('hidden');

            const settingsBtn = document.getElementById('nav-btn-settings');
            if (res.user.role === 'admin') settingsBtn.classList.remove('hidden');
            else settingsBtn.classList.add('hidden');

            switchMgmtTab('mgmt-tab-dashboard');
        } else {
            document.getElementById('emp-tab-nav').classList.remove('hidden');
            document.getElementById('mgmt-tab-nav').classList.add('hidden');
            document.getElementById('employee-panels').classList.remove('hidden');
            document.getElementById('mgmt-panels').classList.add('hidden');

            switchEmpTab('emp-tab-clock');
        }

        await refreshAllData();
        showToast(`Welcome back, ${res.user.name}`);
    } catch (err) {
        showToast(err.message || "Invalid credentials", "error");
    }
});

document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await API.logout();
    state.currentUser = null;
    DOM.appView.classList.add('hidden');
    DOM.loginView.classList.remove('hidden');
});

// App Initialization
async function initApp() {
    DOM.initLoading.classList.add('hidden');

    const token = API.getToken();
    if (token) {
        try {
            const res = await API.getMe();
            state.currentUser = res.user;

            DOM.loginView.classList.add('hidden');
            DOM.appView.classList.remove('hidden');

            if (['admin', 'supervisor', 'hr'].includes(res.user.role)) {
                document.getElementById('mgmt-tab-nav').classList.remove('hidden');
                document.getElementById('emp-tab-nav').classList.add('hidden');
                document.getElementById('mgmt-panels').classList.remove('hidden');
                document.getElementById('employee-panels').classList.add('hidden');

                const settingsBtn = document.getElementById('nav-btn-settings');
                if (res.user.role === 'admin') settingsBtn.classList.remove('hidden');
                else settingsBtn.classList.add('hidden');

                switchMgmtTab('mgmt-tab-dashboard');
            } else {
                document.getElementById('emp-tab-nav').classList.remove('hidden');
                document.getElementById('mgmt-tab-nav').classList.add('hidden');
                document.getElementById('employee-panels').classList.remove('hidden');
                document.getElementById('mgmt-panels').classList.add('hidden');

                switchEmpTab('emp-tab-clock');
            }

            await refreshAllData();
            return;
        } catch (err) {
            API.clearSession();
        }
    }

    DOM.loginForm.classList.remove('hidden');
}

// Start app on DOM ready
document.addEventListener('DOMContentLoaded', initApp);
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initApp();
}
