/**
 * User API Data Source
 * Handles all user management related API calls
 */

const BaseAPI = require('./baseAPI');

class UserAPI extends BaseAPI {
  constructor() {
    super();
    this.baseURL = process.env.USER_SERVICE_URL || 'http://localhost:3002/api/v1';
  }

  // User queries
  async getUser(id) {
    return this.get(`/users/${id}`);
  }

  async getUsers(input) {
    const query = this.buildQueryString(input);
    return this.get(`/users?${query}`);
  }

  // Profile and preferences
  async getUserProfile(userId) {
    return this.get(`/users/${userId}/profile`);
  }

  async getUserPreferences(userId) {
    return this.get(`/users/${userId}/preferences`);
  }

  // Authentication
  async register(input) {
    return this.post('/auth/register', input);
  }

  async login(input) {
    return this.post('/auth/login', input);
  }

  async logout(userId) {
    return this.post('/auth/logout', { userId });
  }

  async refreshToken(refreshToken) {
    return this.post('/auth/refresh', { refreshToken });
  }

  async getAuthMethods(userId) {
    return this.get(`/users/${userId}/auth-methods`);
  }

  // Sessions and devices
  async getUserSessions(userId) {
    return this.get(`/users/${userId}/sessions`);
  }

  async getUserDevices(userId) {
    return this.get(`/users/${userId}/devices`);
  }

  // API keys and integrations
  async getApiKeys(userId) {
    return this.get(`/users/${userId}/api-keys`);
  }

  async getIntegrations(userId) {
    return this.get(`/users/${userId}/integrations`);
  }

  // User activity
  async getUserActivity(userId, input) {
    const query = this.buildQueryString(input);
    return this.get(`/users/${userId}/activity?${query}`);
  }

  // Admin queries
  async getAdminUsers(input) {
    const query = this.buildQueryString(input);
    return this.get(`/admin/users?${query}`);
  }

  // Profile management
  async updateProfile(userId, input) {
    return this.put(`/users/${userId}/profile`, input);
  }

  async updatePreferences(userId, input) {
    return this.put(`/users/${userId}/preferences`, input);
  }

  async uploadAvatar(userId, file) {
    return this.post(`/users/${userId}/avatar`, { file });
  }

  // Password and security
  async changePassword(userId, input) {
    return this.put(`/users/${userId}/password`, input);
  }

  async resetPassword(input) {
    return this.post('/auth/reset-password', input);
  }

  // Two-factor authentication
  async enableTwoFactor(userId, input) {
    return this.post(`/users/${userId}/2fa/enable`, input);
  }

  async disableTwoFactor(userId, input) {
    return this.post(`/users/${userId}/2fa/disable`, input);
  }

  async verifyTwoFactor(userId, input) {
    return this.post(`/users/${userId}/2fa/verify`, input);
  }

  // API key management
  async createApiKey(userId, input) {
    return this.post(`/users/${userId}/api-keys`, input);
  }

  async updateApiKey(userId, keyId, input) {
    return this.put(`/users/${userId}/api-keys/${keyId}`, input);
  }

  async deleteApiKey(userId, keyId) {
    return this.delete(`/users/${userId}/api-keys/${keyId}`);
  }

  // Session management
  async terminateSession(userId, sessionId) {
    return this.delete(`/users/${userId}/sessions/${sessionId}`);
  }

  async terminateAllSessions(userId) {
    return this.delete(`/users/${userId}/sessions`);
  }

  // Device management
  async registerDevice(userId, input) {
    return this.post(`/users/${userId}/devices`, input);
  }

  async removeDevice(userId, deviceId) {
    return this.delete(`/users/${userId}/devices/${deviceId}`);
  }

  async getUserDevice(deviceId) {
    return this.get(`/devices/${deviceId}`);
  }

  // Data management
  async exportUserData(userId, input) {
    return this.post(`/users/${userId}/export`, input);
  }

  async deleteUserData(userId, input) {
    return this.post(`/users/${userId}/delete-data`, input);
  }

  // Account management
  async deleteAccount(userId, input) {
    return this.delete(`/users/${userId}`, input);
  }

  // Admin mutations
  async createUser(input, adminUser) {
    return this.post('/admin/users', { ...input, adminUserId: adminUser.id });
  }

  async updateUser(id, input, adminUser) {
    return this.put(`/admin/users/${id}`, { ...input, adminUserId: adminUser.id });
  }

  async deleteUser(id, adminUser) {
    return this.delete(`/admin/users/${id}?adminUserId=${adminUser.id}`);
  }

  async banUser(input, adminUser) {
    return this.post('/admin/users/ban', { ...input, adminUserId: adminUser.id });
  }

  async unbanUser(userId, adminUser) {
    return this.post('/admin/users/unban', { userId, adminUserId: adminUser.id });
  }
}

module.exports = UserAPI;