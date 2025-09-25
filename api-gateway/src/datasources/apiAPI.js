/**
 * API Management Data Source
 * Handles all API management and developer portal related API calls
 */

const BaseAPI = require('./baseAPI');

class APIAPI extends BaseAPI {
  constructor() {
    super();
    this.baseURL = process.env.API_MANAGEMENT_URL || 'http://localhost:3006/api/v1';
  }

  // API management
  async getAPIVersions(user) {
    return this.get('/api-versions');
  }

  async getAPIVersion(version, user) {
    return this.get(`/api-versions/${version}`);
  }

  async getAPIEndpoints(input, user) {
    const query = this.buildQueryString(input);
    return this.get(`/endpoints?${query}`);
  }

  async getAPIEndpoint(id, user) {
    return this.get(`/endpoints/${id}`);
  }

  // Documentation
  async getAPIDocumentation(input, user) {
    const query = this.buildQueryString(input);
    return this.get(`/documentation?${query}`);
  }

  async getOpenAPISpec(version, user) {
    return this.get(`/openapi/${version}`);
  }

  // Developer applications
  async getDeveloperApplications(userId, input) {
    const query = this.buildQueryString(input);
    return this.get(`/users/${userId}/applications?${query}`);
  }

  async getDeveloperApplication(userId, id) {
    return this.get(`/users/${userId}/applications/${id}`);
  }

  // API keys and authentication
  async getDeveloperApiKeys(userId) {
    return this.get(`/users/${userId}/api-keys`);
  }

  async getApiKeyUsage(userId, keyId, input) {
    const query = this.buildQueryString(input);
    return this.get(`/users/${userId}/api-keys/${keyId}/usage?${query}`);
  }

  // Webhooks
  async getWebhooks(userId) {
    return this.get(`/users/${userId}/webhooks`);
  }

  async getWebhook(userId, id) {
    return this.get(`/users/${userId}/webhooks/${id}`);
  }

  async getWebhookEvents(user) {
    return this.get('/webhook-events');
  }

  async getWebhookDeliveries(userId, webhookId, input) {
    const query = this.buildQueryString(input);
    return this.get(`/users/${userId}/webhooks/${webhookId}/deliveries?${query}`);
  }

  // SDKs and code samples
  async getSDKs(input, user) {
    const query = this.buildQueryString(input);
    return this.get(`/sdks?${query}`);
  }

  async getSDK(id, user) {
    return this.get(`/sdks/${id}`);
  }

  async getCodeSamples(input, user) {
    const query = this.buildQueryString(input);
    return this.get(`/code-samples?${query}`);
  }

  async getCodeSample(id, user) {
    return this.get(`/code-samples/${id}`);
  }

  // Testing and sandbox
  async getAPITestConsole(input, user) {
    const query = this.buildQueryString(input);
    return this.get(`/test-console?${query}`);
  }

  async getSandboxEnvironment(userId) {
    return this.get(`/users/${userId}/sandbox`);
  }

  // Rate limiting and quotas
  async getRateLimits(userId) {
    return this.get(`/users/${userId}/rate-limits`);
  }

  async getAPIQuotas(userId) {
    return this.get(`/users/${userId}/quotas`);
  }

  // Analytics and monitoring
  async getAPIMetrics(input, user) {
    const query = this.buildQueryString(input);
    return this.get(`/metrics?${query}`);
  }

  async getDeveloperMetrics(userId, input) {
    const query = this.buildQueryString(input);
    return this.get(`/users/${userId}/metrics?${query}`);
  }

  // Support and feedback
  async getAPISupport(input, user) {
    const query = this.buildQueryString(input);
    return this.get(`/support?${query}`);
  }

  async getSupportTickets(userId, input) {
    const query = this.buildQueryString(input);
    return this.get(`/users/${userId}/support-tickets?${query}`);
  }

  async getDeveloperFeedback(input, user) {
    const query = this.buildQueryString(input);
    return this.get(`/feedback?${query}`);
  }

  // Community and forums
  async getDeveloperForum(input, user) {
    const query = this.buildQueryString(input);
    return this.get(`/forum?${query}`);
  }

  async getForumPosts(input, user) {
    const query = this.buildQueryString(input);
    return this.get(`/forum/posts?${query}`);
  }

  // Admin queries
  async getAllDeveloperApplications(input, user) {
    const query = this.buildQueryString(input);
    return this.get(`/admin/applications?${query}`);
  }

  async getAPIUsageStats(input, user) {
    const query = this.buildQueryString(input);
    return this.get(`/admin/usage-stats?${query}`);
  }

  // Developer application management
  async createDeveloperApplication(userId, input) {
    return this.post(`/users/${userId}/applications`, input);
  }

  async updateDeveloperApplication(userId, id, input) {
    return this.put(`/users/${userId}/applications/${id}`, input);
  }

  async deleteDeveloperApplication(userId, id) {
    return this.delete(`/users/${userId}/applications/${id}`);
  }

  // API key management
  async generateApiKey(userId, input) {
    return this.post(`/users/${userId}/api-keys`, input);
  }

  async regenerateApiKey(userId, keyId) {
    return this.post(`/users/${userId}/api-keys/${keyId}/regenerate`);
  }

  async revokeApiKey(userId, keyId) {
    return this.delete(`/users/${userId}/api-keys/${keyId}`);
  }

  async updateApiKeySettings(userId, keyId, input) {
    return this.put(`/users/${userId}/api-keys/${keyId}`, input);
  }

  // Webhook management
  async createWebhook(userId, input) {
    return this.post(`/users/${userId}/webhooks`, input);
  }

  async updateWebhook(userId, id, input) {
    return this.put(`/users/${userId}/webhooks/${id}`, input);
  }

  async deleteWebhook(userId, id) {
    return this.delete(`/users/${userId}/webhooks/${id}`);
  }

  async testWebhook(userId, id, input) {
    return this.post(`/users/${userId}/webhooks/${id}/test`, input);
  }

  async redeliverWebhook(userId, deliveryId) {
    return this.post(`/users/${userId}/webhook-deliveries/${deliveryId}/redeliver`);
  }

  // API testing
  async executeApiTest(input, user) {
    return this.post('/test/execute', input);
  }

  async saveApiTest(userId, input) {
    return this.post(`/users/${userId}/tests`, input);
  }

  // Documentation feedback
  async submitDocumentationFeedback(input, user) {
    return this.post('/documentation/feedback', { ...input, userId: user?.id });
  }

  // Support tickets
  async createSupportTicket(userId, input) {
    return this.post(`/users/${userId}/support-tickets`, input);
  }

  async updateSupportTicket(userId, id, input) {
    return this.put(`/users/${userId}/support-tickets/${id}`, input);
  }

  async closeSupportTicket(userId, id) {
    return this.put(`/users/${userId}/support-tickets/${id}/close`);
  }

  // Forum interactions
  async createForumPost(userId, input) {
    return this.post(`/users/${userId}/forum/posts`, input);
  }

  async replyToForumPost(userId, postId, input) {
    return this.post(`/users/${userId}/forum/posts/${postId}/replies`, input);
  }

  async voteOnForumPost(userId, postId, vote) {
    return this.post(`/users/${userId}/forum/posts/${postId}/vote`, { vote });
  }

  // Admin operations
  async approveApplication(applicationId, user) {
    return this.post(`/admin/applications/${applicationId}/approve`, { adminUserId: user.id });
  }

  async rejectApplication(applicationId, reason, user) {
    return this.post(`/admin/applications/${applicationId}/reject`, { reason, adminUserId: user.id });
  }

  async suspendApplication(applicationId, reason, user) {
    return this.post(`/admin/applications/${applicationId}/suspend`, { reason, adminUserId: user.id });
  }

  async updateApiLimits(userId, input, user) {
    return this.put(`/admin/users/${userId}/limits`, { ...input, adminUserId: user.id });
  }

  // SDK and code sample management
  async generateSDK(input, user) {
    return this.post('/sdks/generate', input);
  }

  async downloadSDK(id, user) {
    return this.get(`/sdks/${id}/download`);
  }

  // Helper methods for resolvers
  async getVersionEndpoints(version, input) {
    const query = this.buildQueryString(input);
    return this.get(`/api-versions/${version}/endpoints?${query}`);
  }

  async getVersionDocumentation(version) {
    return this.get(`/api-versions/${version}/documentation`);
  }

  async getVersionChangelog(version) {
    return this.get(`/api-versions/${version}/changelog`);
  }

  async getEndpointDocumentation(endpointId) {
    return this.get(`/endpoints/${endpointId}/documentation`);
  }

  async getEndpointExamples(endpointId) {
    return this.get(`/endpoints/${endpointId}/examples`);
  }

  async getEndpointMetrics(endpointId, input) {
    const query = this.buildQueryString(input);
    return this.get(`/endpoints/${endpointId}/metrics?${query}`);
  }

  async getApplicationApiKeys(applicationId) {
    return this.get(`/applications/${applicationId}/api-keys`);
  }

  async getApplicationWebhooks(applicationId) {
    return this.get(`/applications/${applicationId}/webhooks`);
  }

  async getApplicationUsage(applicationId, input) {
    const query = this.buildQueryString(input);
    return this.get(`/applications/${applicationId}/usage?${query}`);
  }

  async getApiKeyPermissions(keyId) {
    return this.get(`/api-keys/${keyId}/permissions`);
  }

  async getSDKDocumentation(sdkId) {
    return this.get(`/sdks/${sdkId}/documentation`);
  }

  async getSDKExamples(sdkId) {
    return this.get(`/sdks/${sdkId}/examples`);
  }

  async getSDKDownloads(sdkId) {
    return this.get(`/sdks/${sdkId}/downloads`);
  }

  async getProgrammingLanguage(languageId) {
    return this.get(`/programming-languages/${languageId}`);
  }

  async getTicketMessages(ticketId) {
    return this.get(`/support-tickets/${ticketId}/messages`);
  }

  async getForumPostReplies(postId, input) {
    const query = this.buildQueryString(input);
    return this.get(`/forum/posts/${postId}/replies?${query}`);
  }

  async getForumPostVotes(postId) {
    return this.get(`/forum/posts/${postId}/votes`);
  }
}

module.exports = APIAPI;