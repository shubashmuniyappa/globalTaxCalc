/**
 * Billing API Data Source
 * Handles all billing and subscription related API calls
 */

const BaseAPI = require('./baseAPI');

class BillingAPI extends BaseAPI {
  constructor() {
    super();
    this.baseURL = process.env.BILLING_SERVICE_URL || 'http://localhost:3004/api/v1';
  }

  // Subscription plans
  async getSubscriptionPlans(input) {
    const query = this.buildQueryString(input);
    return this.get(`/subscription-plans?${query}`);
  }

  async getSubscriptionPlan(id) {
    return this.get(`/subscription-plans/${id}`);
  }

  // User subscriptions
  async getUserSubscription(userId) {
    return this.get(`/users/${userId}/subscription`);
  }

  async getSubscriptionHistory(userId, input) {
    const query = this.buildQueryString(input);
    return this.get(`/users/${userId}/subscription/history?${query}`);
  }

  async getUserBilling(userId) {
    return this.get(`/users/${userId}/billing`);
  }

  // Billing history
  async getBillingHistory(userId, input) {
    const query = this.buildQueryString(input);
    return this.get(`/users/${userId}/billing/history?${query}`);
  }

  async getInvoice(userId, invoiceId) {
    return this.get(`/users/${userId}/invoices/${invoiceId}`);
  }

  async getInvoices(userId, input) {
    const query = this.buildQueryString(input);
    return this.get(`/users/${userId}/invoices?${query}`);
  }

  // Usage and quotas
  async getUsageMetrics(userId, input) {
    const query = this.buildQueryString(input);
    return this.get(`/users/${userId}/usage?${query}`);
  }

  async getQuotaStatus(userId) {
    return this.get(`/users/${userId}/quota`);
  }

  // Payment methods
  async getPaymentMethods(userId) {
    return this.get(`/users/${userId}/payment-methods`);
  }

  // Pricing and estimates
  async getPricingEstimate(input) {
    return this.post('/pricing/estimate', input);
  }

  // Enterprise features
  async getEnterpriseQuote(input, user) {
    return this.post('/enterprise/quote', { ...input, userId: user?.id });
  }

  // Discounts and promotions
  async getAvailableDiscounts(userId) {
    const query = userId ? `?userId=${userId}` : '';
    return this.get(`/discounts${query}`);
  }

  async validatePromoCode(code) {
    return this.get(`/promo-codes/${code}/validate`);
  }

  // Subscription management
  async createSubscription(userId, input) {
    return this.post(`/users/${userId}/subscription`, input);
  }

  async upgradeSubscription(userId, input) {
    return this.post(`/users/${userId}/subscription/upgrade`, input);
  }

  async downgradeSubscription(userId, input) {
    return this.post(`/users/${userId}/subscription/downgrade`, input);
  }

  async cancelSubscription(userId, input) {
    return this.post(`/users/${userId}/subscription/cancel`, input);
  }

  async reactivateSubscription(userId) {
    return this.post(`/users/${userId}/subscription/reactivate`);
  }

  // Payment methods
  async addPaymentMethod(userId, input) {
    return this.post(`/users/${userId}/payment-methods`, input);
  }

  async updatePaymentMethod(userId, methodId, input) {
    return this.put(`/users/${userId}/payment-methods/${methodId}`, input);
  }

  async deletePaymentMethod(userId, methodId) {
    return this.delete(`/users/${userId}/payment-methods/${methodId}`);
  }

  async setDefaultPaymentMethod(userId, methodId) {
    return this.put(`/users/${userId}/payment-methods/${methodId}/default`);
  }

  // Billing and payments
  async processPayment(userId, input) {
    return this.post(`/users/${userId}/payments`, input);
  }

  async retryPayment(userId, invoiceId) {
    return this.post(`/users/${userId}/invoices/${invoiceId}/retry`);
  }

  async getPayment(paymentId) {
    return this.get(`/payments/${paymentId}`);
  }

  // Discounts and promotions
  async applyPromoCode(userId, code) {
    return this.post(`/users/${userId}/promo-codes`, { code });
  }

  async removePromoCode(userId) {
    return this.delete(`/users/${userId}/promo-codes`);
  }

  // Enterprise features
  async requestEnterpriseQuote(input, user) {
    return this.post('/enterprise/quote-request', { ...input, userId: user?.id });
  }

  async activateEnterpriseFeature(userId, input) {
    return this.post(`/users/${userId}/enterprise/activate`, input);
  }

  // Usage tracking
  async recordUsage(userId, input) {
    return this.post(`/users/${userId}/usage`, input);
  }

  // Admin operations
  async createSubscriptionPlan(input, adminUser) {
    return this.post('/admin/subscription-plans', { ...input, adminUserId: adminUser.id });
  }

  async updateSubscriptionPlan(id, input, adminUser) {
    return this.put(`/admin/subscription-plans/${id}`, { ...input, adminUserId: adminUser.id });
  }

  async archiveSubscriptionPlan(id, adminUser) {
    return this.put(`/admin/subscription-plans/${id}/archive`, { adminUserId: adminUser.id });
  }

  async createPromoCode(input, adminUser) {
    return this.post('/admin/promo-codes', { ...input, adminUserId: adminUser.id });
  }

  async updatePromoCode(id, input, adminUser) {
    return this.put(`/admin/promo-codes/${id}`, { ...input, adminUserId: adminUser.id });
  }

  async deactivatePromoCode(id, adminUser) {
    return this.put(`/admin/promo-codes/${id}/deactivate`, { adminUserId: adminUser.id });
  }

  // Helper methods for resolvers
  async getPlanFeatures(planId) {
    return this.get(`/subscription-plans/${planId}/features`);
  }

  async getPlanUsage(planId) {
    return this.get(`/subscription-plans/${planId}/usage`);
  }

  async getSubscriptionUsage(subscriptionId) {
    return this.get(`/subscriptions/${subscriptionId}/usage`);
  }

  async getSubscriptionInvoices(subscriptionId, input) {
    const query = this.buildQueryString(input);
    return this.get(`/subscriptions/${subscriptionId}/invoices?${query}`);
  }

  async getInvoiceItems(invoiceId) {
    return this.get(`/invoices/${invoiceId}/items`);
  }

  async getUsageBreakdown(usageId) {
    return this.get(`/usage/${usageId}/breakdown`);
  }
}

module.exports = BillingAPI;