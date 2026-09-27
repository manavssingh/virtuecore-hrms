// Virtue Core Enterprise HRMS - Secure Client API Service
const API = {
  TOKEN_KEY: 'virtue_jwt_token',
  USER_KEY: 'virtue_user_profile',

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  setSession(token, user) {
    if (token) localStorage.setItem(this.TOKEN_KEY, token);
    if (user) localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  },

  clearSession() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  },

  getStoredUser() {
    try {
      const u = localStorage.getItem(this.USER_KEY);
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },

  async request(endpoint, options = {}) {
    const headers = options.headers || {};
    const token = this.getToken();

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    try {
      const res = await fetch(`/api${endpoint}`, {
        ...options,
        headers
      });

      if (res.status === 401 || res.status === 403) {
        if (endpoint !== '/auth/login') {
          // Token expired or invalid
          this.clearSession();
          window.location.reload();
        }
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `Request failed with status ${res.status}`);
      }

      return data;
    } catch (err) {
      throw err;
    }
  },

  // Auth
  async login(username, password) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: { username, password }
    });
    this.setSession(res.token, res.user);
    return res;
  },

  async getMe() {
    return this.request('/auth/me');
  },

  async changePassword(newPassword) {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: { newPassword }
    });
  },

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.clearSession();
    }
  },

  // Users
  async getUsers() {
    return this.request('/users');
  },

  async createUser(payload) {
    return this.request('/users', {
      method: 'POST',
      body: payload
    });
  },

  async updateUser(id, payload) {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: payload
    });
  },

  async toggleUserActive(id) {
    return this.request(`/users/${id}/toggle-active`, {
      method: 'POST'
    });
  },

  async resetUserPassword(id) {
    return this.request(`/users/${id}/reset-password`, {
      method: 'POST'
    });
  },

  // Attendance
  async getAttendance(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/attendance${qs ? '?' + qs : ''}`);
  },

  async punch(action, location = null) {
    return this.request('/attendance/punch', {
      method: 'POST',
      body: { action, location }
    });
  },

  // Leaves
  async getLeaves() {
    return this.request('/leaves');
  },

  async createLeave(payload) {
    return this.request('/leaves', {
      method: 'POST',
      body: payload
    });
  },

  async updateLeaveStatus(id, status) {
    return this.request(`/leaves/${id}/status`, {
      method: 'PUT',
      body: { status }
    });
  },

  async deleteLeave(id) {
    return this.request(`/leaves/${id}`, {
      method: 'DELETE'
    });
  },

  // Regularizations
  async getRegularizations() {
    return this.request('/regularizations');
  },

  async createRegularization(payload) {
    return this.request('/regularizations', {
      method: 'POST',
      body: payload
    });
  },

  async updateRegularizationStatus(id, status) {
    return this.request(`/regularizations/${id}/status`, {
      method: 'PUT',
      body: { status }
    });
  },

  // Rosters
  async getRosters() {
    return this.request('/rosters');
  },

  async createRoster(payload) {
    return this.request('/rosters', {
      method: 'POST',
      body: payload
    });
  },

  async updateRoster(id, payload) {
    return this.request(`/rosters/${id}`, {
      method: 'PUT',
      body: payload
    });
  },

  async deleteRoster(id) {
    return this.request(`/rosters/${id}`, {
      method: 'DELETE'
    });
  },

  // Documents
  async getDocuments() {
    return this.request('/documents');
  },

  async uploadDocument(type, fileData) {
    return this.request('/documents', {
      method: 'POST',
      body: { type, fileData }
    });
  },

  async verifyDocument(id, status, rejectionReason = '') {
    return this.request(`/documents/${id}/verify`, {
      method: 'PUT',
      body: { status, rejectionReason }
    });
  },

  // Holidays
  async getHolidays() {
    return this.request('/holidays');
  },

  async createHoliday(name, date, type) {
    return this.request('/holidays', {
      method: 'POST',
      body: { name, date, type }
    });
  },

  async deleteHoliday(id) {
    return this.request(`/holidays/${id}`, {
      method: 'DELETE'
    });
  },

  // Announcements
  async getAnnouncements() {
    return this.request('/announcements');
  },

  async createAnnouncement(payload) {
    const body = (typeof payload === 'object' && payload !== null)
      ? payload
      : { title: arguments[0], department: arguments[1], message: arguments[2] };

    return this.request('/announcements', {
      method: 'POST',
      body
    });
  },

  async acknowledgeAnnouncement(id) {
    return this.request(`/announcements/${id}/acknowledge`, {
      method: 'POST'
    });
  },

  // Payroll
  async getPayrollBatches() {
    return this.request('/payroll/batches');
  },

  async getMyPayslips() {
    return this.request('/payroll/my-payslips');
  },

  async processPayroll(month) {
    return this.request('/payroll/process', {
      method: 'POST',
      body: { month }
    });
  },

  async lockPayroll(month, records) {
    return this.request('/payroll/lock', {
      method: 'POST',
      body: { month, records }
    });
  },

  // Audits & Settings
  async getAudits(limit = 50) {
    return this.request(`/audits?limit=${limit}`);
  },

  async getSettings() {
    return this.request('/settings');
  },

  async updateSettings(payload) {
    return this.request('/settings', {
      method: 'PUT',
      body: payload
    });
  },

  // Demo
  async seedDemo() {
    return this.request('/demo/seed', { method: 'POST' });
  },

  async purgeDemo() {
    return this.request('/demo/purge', { method: 'POST' });
  }
};
