/**
 * Subscription and Billing Resolvers
 * Handles all subscription and billing-related GraphQL operations
 */

const subscriptionResolvers = {
  Query: {
    // Subscription plans
    subscriptionPlans: async (_, { input }, { dataSources }) => {
      return await dataSources.billingAPI.getSubscriptionPlans(input);
    },

    subscriptionPlan: async (_, { id }, { dataSources }) => {
      return await dataSources.billingAPI.getSubscriptionPlan(id);
    },

    // User subscriptions
    userSubscription: async (_, { userId }, { dataSources, user }) => {
      return await dataSources.billingAPI.getUserSubscription(userId || user.id);
    },

    subscriptionHistory: async (_, { input }, { dataSources, user }) => {
      return await dataSources.billingAPI.getSubscriptionHistory(user.id, input);
    },

    // Billing
    billingHistory: async (_, { input }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.billingAPI.getBillingHistory(user.id, input);
    },

    invoice: async (_, { id }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.billingAPI.getInvoice(user.id, id);
    },

    invoices: async (_, { input }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.billingAPI.getInvoices(user.id, input);
    },

    // Usage and quotas
    usageMetrics: async (_, { input }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.billingAPI.getUsageMetrics(user.id, input);
    },

    quotaStatus: async (_, __, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.billingAPI.getQuotaStatus(user.id);
    },

    // Payment methods
    paymentMethods: async (_, __, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.billingAPI.getPaymentMethods(user.id);
    },

    // Pricing and estimates
    pricingEstimate: async (_, { input }, { dataSources }) => {
      return await dataSources.billingAPI.getPricingEstimate(input);
    },

    // Enterprise features
    enterpriseQuote: async (_, { input }, { dataSources, user }) => {
      return await dataSources.billingAPI.getEnterpriseQuote(input, user);
    },

    // Discounts and promotions
    availableDiscounts: async (_, __, { dataSources, user }) => {
      return await dataSources.billingAPI.getAvailableDiscounts(user?.id);
    },

    promoCode: async (_, { code }, { dataSources }) => {
      return await dataSources.billingAPI.validatePromoCode(code);
    },

    // Revenue analytics (admin)
    revenueAnalytics: async (_, { input }, { dataSources, user }) => {
      return await dataSources.analyticsAPI.getRevenueAnalytics(input, user);
    },

    subscriptionAnalytics: async (_, { input }, { dataSources, user }) => {
      return await dataSources.analyticsAPI.getSubscriptionAnalytics(input, user);
    }
  },

  Mutation: {
    // Subscription management
    subscribe: async (_, { input }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.billingAPI.createSubscription(user.id, input);
    },

    upgradeSubscription: async (_, { input }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.billingAPI.upgradeSubscription(user.id, input);
    },

    downgradeSubscription: async (_, { input }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.billingAPI.downgradeSubscription(user.id, input);
    },

    cancelSubscription: async (_, { input }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.billingAPI.cancelSubscription(user.id, input);
    },

    reactivateSubscription: async (_, __, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.billingAPI.reactivateSubscription(user.id);
    },

    // Payment methods
    addPaymentMethod: async (_, { input }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.billingAPI.addPaymentMethod(user.id, input);
    },

    updatePaymentMethod: async (_, { id, input }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.billingAPI.updatePaymentMethod(user.id, id, input);
    },

    deletePaymentMethod: async (_, { id }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.billingAPI.deletePaymentMethod(user.id, id);
    },

    setDefaultPaymentMethod: async (_, { id }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.billingAPI.setDefaultPaymentMethod(user.id, id);
    },

    // Billing and payments
    processPayment: async (_, { input }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.billingAPI.processPayment(user.id, input);
    },

    retryPayment: async (_, { invoiceId }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.billingAPI.retryPayment(user.id, invoiceId);
    },

    // Discounts and promotions
    applyPromoCode: async (_, { code }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.billingAPI.applyPromoCode(user.id, code);
    },

    removePromoCode: async (_, __, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.billingAPI.removePromoCode(user.id);
    },

    // Enterprise features
    requestEnterpriseQuote: async (_, { input }, { dataSources, user }) => {
      return await dataSources.billingAPI.requestEnterpriseQuote(input, user);
    },

    activateEnterpriseFeature: async (_, { input }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.billingAPI.activateEnterpriseFeature(user.id, input);
    },

    // Usage tracking
    recordUsage: async (_, { input }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.billingAPI.recordUsage(user.id, input);
    },

    // Admin operations
    createSubscriptionPlan: async (_, { input }, { dataSources, user }) => {
      return await dataSources.billingAPI.createSubscriptionPlan(input, user);
    },

    updateSubscriptionPlan: async (_, { id, input }, { dataSources, user }) => {
      return await dataSources.billingAPI.updateSubscriptionPlan(id, input, user);
    },

    archiveSubscriptionPlan: async (_, { id }, { dataSources, user }) => {
      return await dataSources.billingAPI.archiveSubscriptionPlan(id, user);
    },

    createPromoCode: async (_, { input }, { dataSources, user }) => {
      return await dataSources.billingAPI.createPromoCode(input, user);
    },

    updatePromoCode: async (_, { id, input }, { dataSources, user }) => {
      return await dataSources.billingAPI.updatePromoCode(id, input, user);
    },

    deactivatePromoCode: async (_, { id }, { dataSources, user }) => {
      return await dataSources.billingAPI.deactivatePromoCode(id, user);
    }
  },

  Subscription: {
    // Subscription updates
    subscriptionUpdated: {
      subscribe: async (_, __, { pubsub, user }) => {
        if (!user) throw new Error('Not authenticated');
        return pubsub.asyncIterator([`SUBSCRIPTION_UPDATED_${user.id}`]);
      }
    },

    // Billing events
    billingEvent: {
      subscribe: async (_, __, { pubsub, user }) => {
        if (!user) throw new Error('Not authenticated');
        return pubsub.asyncIterator([`BILLING_EVENT_${user.id}`]);
      }
    },

    // Payment notifications
    paymentNotification: {
      subscribe: async (_, __, { pubsub, user }) => {
        if (!user) throw new Error('Not authenticated');
        return pubsub.asyncIterator([`PAYMENT_NOTIFICATION_${user.id}`]);
      }
    },

    // Usage alerts
    usageAlert: {
      subscribe: async (_, __, { pubsub, user }) => {
        if (!user) throw new Error('Not authenticated');
        return pubsub.asyncIterator([`USAGE_ALERT_${user.id}`]);
      }
    }
  },

  // Type resolvers
  SubscriptionPlan: {
    features: async (parent, _, { dataSources }) => {
      return await dataSources.billingAPI.getPlanFeatures(parent.id);
    },

    usage: async (parent, _, { dataSources }) => {
      return await dataSources.billingAPI.getPlanUsage(parent.id);
    }
  },

  UserSubscription: {
    user: async (parent, _, { dataSources }) => {
      return await dataSources.userAPI.getUser(parent.userId);
    },

    plan: async (parent, _, { dataSources }) => {
      return await dataSources.billingAPI.getSubscriptionPlan(parent.planId);
    },

    usage: async (parent, _, { dataSources }) => {
      return await dataSources.billingAPI.getSubscriptionUsage(parent.id);
    },

    invoices: async (parent, args, { dataSources }) => {
      return await dataSources.billingAPI.getSubscriptionInvoices(parent.id, args.input);
    }
  },

  Invoice: {
    user: async (parent, _, { dataSources }) => {
      return await dataSources.userAPI.getUser(parent.userId);
    },

    subscription: async (parent, _, { dataSources }) => {
      if (parent.subscriptionId) {
        return await dataSources.billingAPI.getUserSubscription(parent.userId);
      }
      return null;
    },

    items: async (parent, _, { dataSources }) => {
      return await dataSources.billingAPI.getInvoiceItems(parent.id);
    },

    payment: async (parent, _, { dataSources }) => {
      if (parent.paymentId) {
        return await dataSources.billingAPI.getPayment(parent.paymentId);
      }
      return null;
    }
  },

  PaymentMethod: {
    user: async (parent, _, { dataSources }) => {
      return await dataSources.userAPI.getUser(parent.userId);
    }
  },

  UsageMetrics: {
    user: async (parent, _, { dataSources }) => {
      return await dataSources.userAPI.getUser(parent.userId);
    },

    breakdown: async (parent, _, { dataSources }) => {
      return await dataSources.billingAPI.getUsageBreakdown(parent.id);
    }
  }
};

module.exports = subscriptionResolvers;