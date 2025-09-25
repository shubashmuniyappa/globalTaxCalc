/**
 * Analytics API Data Source
 * Handles all analytics and reporting related API calls
 */

const BaseAPI = require('./baseAPI');

class AnalyticsAPI extends BaseAPI {
  constructor() {
    super();
    this.baseURL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3003/api/v1';
  }

  // User analytics
  async getUserAnalytics(input, user) {
    const query = this.buildQueryString({ ...input, userId: user?.id });
    return this.get(`/user-analytics?${query}`);
  }

  async getUserBehavior(input, user) {
    const query = this.buildQueryString({ ...input, userId: user?.id });
    return this.get(`/user-behavior?${query}`);
  }

  async getUserSegments(input, user) {
    const query = this.buildQueryString(input);
    return this.get(`/user-segments?${query}`);
  }

  async getUserStats(input) {
    const query = this.buildQueryString(input);
    return this.get(`/user-stats?${query}`);
  }

  // Business intelligence
  async getBusinessMetrics(input, user) {
    const query = this.buildQueryString(input);
    return this.get(`/business-metrics?${query}`);
  }

  async getBusinessIntelligence(input, user) {
    const query = this.buildQueryString(input);
    return this.get(`/business-intelligence?${query}`);
  }

  async getKPIDashboard(input, user) {
    const query = this.buildQueryString(input);
    return this.get(`/kpi-dashboard?${query}`);
  }

  // Performance metrics
  async getPerformanceMetrics(input, user) {
    const query = this.buildQueryString(input);
    return this.get(`/performance-metrics?${query}`);
  }

  async getSystemHealth(input, user) {
    const query = this.buildQueryString(input);
    return this.get(`/system-health?${query}`);
  }

  // Content analytics
  async getContentAnalytics(input, user) {
    const query = this.buildQueryString(input);
    return this.get(`/content-analytics?${query}`);
  }

  async getContentPerformance(input, user) {
    const query = this.buildQueryString(input);
    return this.get(`/content-performance?${query}`);
  }

  async trackContentView(input, userId) {
    return this.post('/content-views', { ...input, userId });
  }

  // API analytics
  async getAPIAnalytics(input, user) {
    const query = this.buildQueryString(input);
    return this.get(`/api-analytics?${query}`);
  }

  async getAPIUsage(input, user) {
    const query = this.buildQueryString(input);
    return this.get(`/api-usage?${query}`);
  }

  async getApiKeyUsage(keyId) {
    return this.get(`/api-keys/${keyId}/usage`);
  }

  // Custom reports
  async getCustomReports(input, user) {
    const query = this.buildQueryString({ ...input, userId: user.id });
    return this.get(`/custom-reports?${query}`);
  }

  async getCustomReport(id, user) {
    return this.get(`/custom-reports/${id}?userId=${user.id}`);
  }

  async getReportTemplates(user) {
    return this.get(`/report-templates?userId=${user?.id}`);
  }

  // Real-time analytics
  async getRealTimeMetrics(input, user) {
    const query = this.buildQueryString(input);
    return this.get(`/real-time-metrics?${query}`);
  }

  async getLiveUserActivity(user) {
    return this.get('/live-activity');
  }

  // Predictive analytics
  async getPredictiveAnalytics(input, user) {
    const query = this.buildQueryString(input);
    return this.get(`/predictive-analytics?${query}`);
  }

  async getTrends(input, user) {
    const query = this.buildQueryString(input);
    return this.get(`/trends?${query}`);
  }

  async getForecasts(input, user) {
    const query = this.buildQueryString(input);
    return this.get(`/forecasts?${query}`);
  }

  // Comparative analytics
  async getBenchmarks(input, user) {
    const query = this.buildQueryString(input);
    return this.get(`/benchmarks?${query}`);
  }

  async getIndustryComparison(input, user) {
    const query = this.buildQueryString(input);
    return this.get(`/industry-comparison?${query}`);
  }

  // Revenue analytics
  async getRevenueAnalytics(input, user) {
    const query = this.buildQueryString(input);
    return this.get(`/revenue-analytics?${query}`);
  }

  async getSubscriptionAnalytics(input, user) {
    const query = this.buildQueryString(input);
    return this.get(`/subscription-analytics?${query}`);
  }

  // Data exports
  async exportData(input, user) {
    return this.post('/export', { ...input, userId: user.id });
  }

  async getDataExports(input, user) {
    const query = this.buildQueryString({ ...input, userId: user.id });
    return this.get(`/exports?${query}`);
  }

  // Event tracking
  async trackEvent(input, userId) {
    return this.post('/events', { ...input, userId });
  }

  async trackPageView(input, userId) {
    return this.post('/page-views', { ...input, userId });
  }

  async trackUserAction(input, userId) {
    return this.post('/user-actions', { ...input, userId });
  }

  // Custom reports
  async createCustomReport(input, user) {
    return this.post('/custom-reports', { ...input, userId: user.id });
  }

  async updateCustomReport(id, input, user) {
    return this.put(`/custom-reports/${id}`, { ...input, userId: user.id });
  }

  async deleteCustomReport(id, user) {
    return this.delete(`/custom-reports/${id}?userId=${user.id}`);
  }

  async generateReport(input, user) {
    return this.post('/reports/generate', { ...input, userId: user.id });
  }

  async scheduleReport(input, user) {
    return this.post('/reports/schedule', { ...input, userId: user.id });
  }

  // Alerts and notifications
  async createAlert(input, user) {
    return this.post('/alerts', { ...input, userId: user.id });
  }

  async updateAlert(id, input, user) {
    return this.put(`/alerts/${id}`, { ...input, userId: user.id });
  }

  async deleteAlert(id, user) {
    return this.delete(`/alerts/${id}?userId=${user.id}`);
  }

  // Data management
  async purgeAnalyticsData(input, user) {
    return this.post('/data/purge', { ...input, requestedBy: user.id });
  }

  async anonymizeUserData(userId, user) {
    return this.post('/data/anonymize', { userId, requestedBy: user.id });
  }

  // Bulk operations
  async bulkTrackEvents(events, userId) {
    return this.post('/events/bulk', { events, userId });
  }

  // Data exports
  async requestDataExport(input, user) {
    return this.post('/exports/request', { ...input, userId: user.id });
  }

  async cancelDataExport(exportId, user) {
    return this.delete(`/exports/${exportId}?userId=${user.id}`);
  }

  // Helper methods for resolvers
  async getUserSessions(userId, input) {
    const query = this.buildQueryString(input);
    return this.get(`/users/${userId}/sessions?${query}`);
  }

  async getUserEvents(userId, input) {
    const query = this.buildQueryString(input);
    return this.get(`/users/${userId}/events?${query}`);
  }

  async getMetricTrends(metricId) {
    return this.get(`/metrics/${metricId}/trends`);
  }

  async getMetricComparisons(metricId, input) {
    const query = this.buildQueryString(input);
    return this.get(`/metrics/${metricId}/comparisons?${query}`);
  }

  async getPerformanceBreakdown(metricId) {
    return this.get(`/performance/${metricId}/breakdown`);
  }

  async getPerformanceHistory(metricId, input) {
    const query = this.buildQueryString(input);
    return this.get(`/performance/${metricId}/history?${query}`);
  }

  async getContentEngagement(contentId) {
    return this.get(`/content/${contentId}/engagement`);
  }

  async getAPIEndpointAnalytics(apiId, input) {
    const query = this.buildQueryString(input);
    return this.get(`/api/${apiId}/endpoints?${query}`);
  }

  async getAPIUsageDetails(apiId, input) {
    const query = this.buildQueryString(input);
    return this.get(`/api/${apiId}/usage-details?${query}`);
  }

  async getReportExecutions(reportId, input) {
    const query = this.buildQueryString(input);
    return this.get(`/reports/${reportId}/executions?${query}`);
  }

  async getReportSchedule(scheduleId) {
    return this.get(`/schedules/${scheduleId}`);
  }

  async getAlertTriggers(alertId) {
    return this.get(`/alerts/${alertId}/triggers`);
  }

  async getExportProgress(exportId) {
    return this.get(`/exports/${exportId}/progress`);
  }

  async getTemplateUsage(templateId) {
    return this.get(`/templates/${templateId}/usage`);
  }

  async getGlossaryTermUsage(termId) {
    return this.get(`/glossary/${termId}/usage`);
  }
}

module.exports = AnalyticsAPI;