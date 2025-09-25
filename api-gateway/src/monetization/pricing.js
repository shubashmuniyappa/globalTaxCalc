/**
 * API Monetization and Pricing System
 * Handles usage tracking, billing, and subscription management
 */

const { EventEmitter } = require('events');

class APIMonetization extends EventEmitter {
  constructor() {
    super();

    // Pricing tiers and plans
    this.pricingTiers = new Map();
    this.usageTracking = new Map();
    this.billingCycles = new Map();

    this.initializePricingTiers();
    this.setupBillingCycles();
  }

  initializePricingTiers() {
    // Free Tier
    this.pricingTiers.set('free', {
      id: 'free',
      name: 'Free',
      description: 'Get started with basic tax calculations',
      price: 0,
      currency: 'USD',
      billing: 'monthly',
      limits: {
        requests: 1000, // per month
        calculations: 100, // per month
        countries: ['US'], // limited countries
        features: ['basic-calculations', 'simple-reports']
      },
      rateLimits: {
        perMinute: 10,
        perHour: 100,
        perDay: 500
      },
      overage: {
        allowed: false,
        price: null
      },
      support: 'community',
      sla: null
    });

    // Basic Tier
    this.pricingTiers.set('basic', {
      id: 'basic',
      name: 'Basic',
      description: 'Perfect for small businesses and developers',
      price: 49,
      currency: 'USD',
      billing: 'monthly',
      limits: {
        requests: 10000, // per month
        calculations: 2000, // per month
        countries: ['US', 'CA', 'UK', 'AU'], // multi-country
        features: ['basic-calculations', 'advanced-reports', 'multi-currency', 'webhooks']
      },
      rateLimits: {
        perMinute: 50,
        perHour: 1000,
        perDay: 5000
      },
      overage: {
        allowed: true,
        price: 0.01 // per request
      },
      support: 'email',
      sla: '99.9%'
    });

    // Professional Tier
    this.pricingTiers.set('professional', {
      id: 'professional',
      name: 'Professional',
      description: 'Advanced features for growing companies',
      price: 149,
      currency: 'USD',
      billing: 'monthly',
      limits: {
        requests: 50000, // per month
        calculations: 10000, // per month
        countries: 'all', // all countries
        features: [
          'all-calculations',
          'advanced-reports',
          'multi-currency',
          'webhooks',
          'real-time-subscriptions',
          'bulk-processing',
          'custom-integrations'
        ]
      },
      rateLimits: {
        perMinute: 200,
        perHour: 5000,
        perDay: 25000
      },
      overage: {
        allowed: true,
        price: 0.005 // per request
      },
      support: 'priority-email',
      sla: '99.95%'
    });

    // Enterprise Tier
    this.pricingTiers.set('enterprise', {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'Custom solutions for large organizations',
      price: 'custom',
      currency: 'USD',
      billing: 'custom',
      limits: {
        requests: 'unlimited',
        calculations: 'unlimited',
        countries: 'all',
        features: [
          'all-features',
          'white-label',
          'custom-deployment',
          'dedicated-support',
          'sla-guarantees',
          'custom-integrations',
          'priority-features'
        ]
      },
      rateLimits: {
        perMinute: 1000,
        perHour: 'unlimited',
        perDay: 'unlimited'
      },
      overage: {
        allowed: false,
        price: null
      },
      support: 'dedicated-account-manager',
      sla: '99.99%'
    });
  }

  setupBillingCycles() {
    // Monthly billing cycle
    this.billingCycles.set('monthly', {
      id: 'monthly',
      name: 'Monthly',
      duration: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
      description: 'Billed monthly',
      discount: 0
    });

    // Yearly billing cycle (with discount)
    this.billingCycles.set('yearly', {
      id: 'yearly',
      name: 'Yearly',
      duration: 365 * 24 * 60 * 60 * 1000, // 365 days in ms
      description: 'Billed annually with 2 months free',
      discount: 0.167 // ~17% discount (2 months free)
    });
  }

  // Track API usage for billing
  trackUsage(userId, usageData) {
    const {
      endpoint,
      method,
      responseTime,
      statusCode,
      requestSize,
      responseSize,
      features = []
    } = usageData;

    if (!this.usageTracking.has(userId)) {
      this.usageTracking.set(userId, {
        userId,
        currentPeriod: this.getCurrentBillingPeriod(),
        usage: {
          requests: 0,
          calculations: 0,
          dataTransfer: 0,
          features: new Set()
        },
        history: []
      });
    }

    const userUsage = this.usageTracking.get(userId);

    // Check if we're in a new billing period
    if (userUsage.currentPeriod !== this.getCurrentBillingPeriod()) {
      this.rolloverBillingPeriod(userId);
    }

    // Track basic metrics
    userUsage.usage.requests++;
    userUsage.usage.dataTransfer += (requestSize || 0) + (responseSize || 0);

    // Track calculations
    if (this.isCalculationEndpoint(endpoint)) {
      userUsage.usage.calculations++;
    }

    // Track feature usage
    features.forEach(feature => userUsage.usage.features.add(feature));

    // Emit usage event
    this.emit('usage:tracked', {
      userId,
      endpoint,
      method,
      timestamp: new Date(),
      usage: userUsage.usage
    });

    // Check for limit violations
    this.checkUsageLimits(userId);
  }

  // Check if endpoint is a calculation
  isCalculationEndpoint(endpoint) {
    const calculationEndpoints = [
      '/graphql', // GraphQL calculations
      '/api/v1/tax/calculate',
      '/api/v2/tax/calculate',
      '/api/v1/tax/estimate',
      '/api/v2/tax/estimate'
    ];

    return calculationEndpoints.some(calcEndpoint =>
      endpoint.includes(calcEndpoint)
    );
  }

  // Check usage against limits
  checkUsageLimits(userId) {
    const userUsage = this.usageTracking.get(userId);
    if (!userUsage) return;

    // Get user's subscription
    const subscription = this.getUserSubscription(userId);
    if (!subscription) return;

    const tier = this.pricingTiers.get(subscription.tier);
    if (!tier) return;

    const usage = userUsage.usage;
    const limits = tier.limits;

    // Check request limits
    if (limits.requests !== 'unlimited' && usage.requests > limits.requests) {
      this.handleLimitExceeded(userId, 'requests', usage.requests, limits.requests);
    }

    // Check calculation limits
    if (limits.calculations !== 'unlimited' && usage.calculations > limits.calculations) {
      this.handleLimitExceeded(userId, 'calculations', usage.calculations, limits.calculations);
    }

    // Emit usage warning at 80% of limit
    const requestUtilization = (usage.requests / limits.requests) * 100;
    if (requestUtilization > 80 && requestUtilization <= 100) {
      this.emit('usage:warning', {
        userId,
        type: 'requests',
        utilization: requestUtilization,
        usage: usage.requests,
        limit: limits.requests
      });
    }
  }

  // Handle limit exceeded
  handleLimitExceeded(userId, limitType, currentUsage, limit) {
    const subscription = this.getUserSubscription(userId);
    const tier = this.pricingTiers.get(subscription.tier);

    // Check if overage is allowed
    if (tier.overage.allowed) {
      const overageAmount = currentUsage - limit;
      const overageCharge = overageAmount * tier.overage.price;

      this.emit('usage:overage', {
        userId,
        limitType,
        overageAmount,
        overageCharge,
        currency: tier.currency
      });

      // Track overage charges
      this.trackOverageCharges(userId, limitType, overageAmount, overageCharge);
    } else {
      // Block further requests
      this.emit('usage:limitExceeded', {
        userId,
        limitType,
        usage: currentUsage,
        limit,
        action: 'blocked'
      });
    }
  }

  // Track overage charges
  trackOverageCharges(userId, limitType, amount, charge) {
    if (!this.overageCharges) {
      this.overageCharges = new Map();
    }

    if (!this.overageCharges.has(userId)) {
      this.overageCharges.set(userId, []);
    }

    this.overageCharges.get(userId).push({
      timestamp: new Date(),
      limitType,
      amount,
      charge,
      billingPeriod: this.getCurrentBillingPeriod()
    });
  }

  // Get current billing period
  getCurrentBillingPeriod() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  // Rollover to new billing period
  rolloverBillingPeriod(userId) {
    const userUsage = this.usageTracking.get(userId);
    if (!userUsage) return;

    // Archive current usage
    userUsage.history.push({
      period: userUsage.currentPeriod,
      usage: { ...userUsage.usage },
      timestamp: new Date()
    });

    // Reset current usage
    userUsage.currentPeriod = this.getCurrentBillingPeriod();
    userUsage.usage = {
      requests: 0,
      calculations: 0,
      dataTransfer: 0,
      features: new Set()
    };

    this.emit('billing:periodRollover', {
      userId,
      newPeriod: userUsage.currentPeriod
    });
  }

  // Generate usage report for a user
  generateUsageReport(userId, period = null) {
    const userUsage = this.usageTracking.get(userId);
    if (!userUsage) {
      return { error: 'User not found' };
    }

    const subscription = this.getUserSubscription(userId);
    const tier = this.pricingTiers.get(subscription?.tier || 'free');

    const currentPeriod = period || userUsage.currentPeriod;
    let usage;

    if (currentPeriod === userUsage.currentPeriod) {
      usage = userUsage.usage;
    } else {
      const historicalUsage = userUsage.history.find(h => h.period === currentPeriod);
      usage = historicalUsage ? historicalUsage.usage : null;
    }

    if (!usage) {
      return { error: 'Usage data not found for period' };
    }

    return {
      userId,
      period: currentPeriod,
      subscription: {
        tier: subscription?.tier || 'free',
        plan: tier?.name
      },
      usage: {
        requests: {
          used: usage.requests,
          limit: tier?.limits.requests,
          utilization: tier?.limits.requests !== 'unlimited'
            ? (usage.requests / tier.limits.requests) * 100
            : null
        },
        calculations: {
          used: usage.calculations,
          limit: tier?.limits.calculations,
          utilization: tier?.limits.calculations !== 'unlimited'
            ? (usage.calculations / tier.limits.calculations) * 100
            : null
        },
        dataTransfer: usage.dataTransfer,
        features: Array.from(usage.features)
      },
      costs: this.calculateCosts(userId, usage, tier)
    };
  }

  // Calculate costs for usage
  calculateCosts(userId, usage, tier) {
    let baseCost = tier.price === 'custom' ? 0 : tier.price;
    let overageCost = 0;

    // Calculate overage costs
    if (tier.overage.allowed) {
      const requestOverage = Math.max(0, usage.requests - tier.limits.requests);
      const calculationOverage = Math.max(0, usage.calculations - tier.limits.calculations);

      overageCost = (requestOverage + calculationOverage) * tier.overage.price;
    }

    return {
      base: baseCost,
      overage: overageCost,
      total: baseCost + overageCost,
      currency: tier.currency
    };
  }

  // Get user's subscription info
  getUserSubscription(userId) {
    // Mock implementation - in production, this would query the subscription service
    return {
      userId,
      tier: 'basic', // Default to basic for demo
      status: 'active',
      startDate: new Date('2024-01-01'),
      renewalDate: new Date('2024-02-01')
    };
  }

  // Get pricing information
  getPricingTiers() {
    return Array.from(this.pricingTiers.values()).map(tier => ({
      ...tier,
      limits: {
        ...tier.limits,
        features: Array.isArray(tier.limits.features)
          ? tier.limits.features
          : [tier.limits.features]
      }
    }));
  }

  // Calculate pricing for a specific usage pattern
  calculatePricing(usagePattern) {
    const {
      requestsPerMonth,
      calculationsPerMonth,
      countries = ['US'],
      features = ['basic-calculations']
    } = usagePattern;

    const recommendations = [];

    this.pricingTiers.forEach(tier => {
      let suitable = true;
      let monthlyCost = tier.price === 'custom' ? null : tier.price;
      let notes = [];

      // Check request limits
      if (tier.limits.requests !== 'unlimited' && requestsPerMonth > tier.limits.requests) {
        if (tier.overage.allowed) {
          const overage = requestsPerMonth - tier.limits.requests;
          monthlyCost += overage * tier.overage.price;
          notes.push(`Includes ${overage} overage requests at $${tier.overage.price} each`);
        } else {
          suitable = false;
          notes.push('Request limit exceeded, no overage allowed');
        }
      }

      // Check calculation limits
      if (tier.limits.calculations !== 'unlimited' && calculationsPerMonth > tier.limits.calculations) {
        if (tier.overage.allowed) {
          // Calculations are typically counted as requests too
          notes.push('May incur additional calculation overages');
        } else {
          suitable = false;
          notes.push('Calculation limit exceeded');
        }
      }

      // Check country support
      if (Array.isArray(tier.limits.countries)) {
        const unsupportedCountries = countries.filter(country =>
          !tier.limits.countries.includes(country)
        );
        if (unsupportedCountries.length > 0) {
          suitable = false;
          notes.push(`Unsupported countries: ${unsupportedCountries.join(', ')}`);
        }
      }

      // Check feature support
      const unsupportedFeatures = features.filter(feature =>
        !tier.limits.features.includes(feature) && !tier.limits.features.includes('all-features')
      );
      if (unsupportedFeatures.length > 0) {
        suitable = false;
        notes.push(`Unsupported features: ${unsupportedFeatures.join(', ')}`);
      }

      recommendations.push({
        tier: tier.id,
        name: tier.name,
        suitable,
        monthlyCost,
        currency: tier.currency,
        notes,
        savings: null // Could calculate savings vs other tiers
      });
    });

    return {
      usagePattern,
      recommendations: recommendations.sort((a, b) => {
        if (a.suitable && !b.suitable) return -1;
        if (!a.suitable && b.suitable) return 1;
        if (a.monthlyCost === null) return 1;
        if (b.monthlyCost === null) return -1;
        return a.monthlyCost - b.monthlyCost;
      })
    };
  }

  // Middleware for usage tracking
  usageTrackingMiddleware() {
    return (req, res, next) => {
      // Skip if no user
      if (!req.user?.id) {
        return next();
      }

      // Capture request size
      const requestSize = req.get('content-length') || 0;

      // Override res.end to capture response data
      const originalEnd = res.end;
      res.end = function(chunk, encoding) {
        const responseSize = chunk ? Buffer.byteLength(chunk, encoding) : 0;

        // Track usage
        this.trackUsage(req.user.id, {
          endpoint: req.path,
          method: req.method,
          responseTime: req.analytics?.responseTime || 0,
          statusCode: res.statusCode,
          requestSize: parseInt(requestSize),
          responseSize,
          features: this.extractFeatures(req)
        });

        originalEnd.call(res, chunk, encoding);
      }.bind(this);

      next();
    };
  }

  // Extract features used in request
  extractFeatures(req) {
    const features = [];

    // GraphQL features
    if (req.path.includes('/graphql')) {
      features.push('graphql-api');

      if (req.body?.query?.includes('subscription')) {
        features.push('real-time-subscriptions');
      }

      if (req.body?.query?.includes('calculateTax')) {
        features.push('tax-calculations');
      }
    }

    // REST API features
    if (req.path.includes('/api/')) {
      features.push('rest-api');
    }

    // Webhook features
    if (req.path.includes('/webhook')) {
      features.push('webhooks');
    }

    return features;
  }

  // Get usage analytics
  getUsageAnalytics(timeRange = '30d') {
    const analytics = {
      totalUsers: this.usageTracking.size,
      totalRequests: 0,
      totalCalculations: 0,
      tierDistribution: {},
      revenueEstimate: 0
    };

    this.usageTracking.forEach((usage, userId) => {
      analytics.totalRequests += usage.usage.requests;
      analytics.totalCalculations += usage.usage.calculations;

      // Get user's subscription
      const subscription = this.getUserSubscription(userId);
      const tierName = subscription.tier;

      analytics.tierDistribution[tierName] = (analytics.tierDistribution[tierName] || 0) + 1;

      // Estimate revenue
      const tier = this.pricingTiers.get(tierName);
      if (tier && tier.price !== 'custom') {
        analytics.revenueEstimate += tier.price;
      }
    });

    return analytics;
  }
}

// Create singleton instance
const monetization = new APIMonetization();

module.exports = {
  APIMonetization,
  monetization,
  usageTrackingMiddleware: monetization.usageTrackingMiddleware.bind(monetization),
  getPricingTiers: monetization.getPricingTiers.bind(monetization),
  calculatePricing: monetization.calculatePricing.bind(monetization)
};