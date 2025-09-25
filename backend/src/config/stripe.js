const Stripe = require('stripe');
const logger = require('../utils/logger');

// Initialize Stripe with secret key
const stripe = Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  appInfo: {
    name: 'GlobalTaxCalc',
    version: '1.0.0',
    url: 'https://globaltaxcalc.com'
  }
});

// Subscription tiers configuration
const SUBSCRIPTION_TIERS = {
  FREE: {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: null,
    stripePriceId: null,
    features: [
      'Basic tax calculator',
      'Up to 5 calculations per month',
      'PDF export (watermarked)',
      'Email support',
      'Ads included'
    ],
    limits: {
      calculations: 5,
      exports: 3,
      apiCalls: 0,
      features: ['basic_calculator']
    }
  },
  PRO: {
    id: 'pro',
    name: 'Pro',
    price: 499, // $4.99 in cents
    interval: 'month',
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID,
    features: [
      'Advanced tax calculator',
      'Unlimited calculations',
      'Unlimited PDF exports',
      'Multi-year planning',
      'State tax comparisons',
      'No ads',
      'Priority email support'
    ],
    limits: {
      calculations: -1, // unlimited
      exports: -1, // unlimited
      apiCalls: 1000,
      features: [
        'basic_calculator',
        'advanced_calculator',
        'multi_year_planning',
        'state_comparisons',
        'unlimited_exports'
      ]
    }
  },
  EXPERT: {
    id: 'expert',
    name: 'Expert',
    price: 999, // $9.99 in cents
    interval: 'month',
    stripePriceId: process.env.STRIPE_EXPERT_PRICE_ID,
    features: [
      'All Pro features',
      'Business tax calculator',
      'Investment tax planning',
      'Estate planning tools',
      'API access',
      'Custom reports',
      'Phone support',
      'Tax advisor consultation'
    ],
    limits: {
      calculations: -1, // unlimited
      exports: -1, // unlimited
      apiCalls: 10000,
      features: [
        'basic_calculator',
        'advanced_calculator',
        'multi_year_planning',
        'state_comparisons',
        'unlimited_exports',
        'business_calculator',
        'investment_planning',
        'estate_planning',
        'api_access',
        'custom_reports',
        'priority_support'
      ]
    }
  }
};

// Feature flags for different tiers
const FEATURE_FLAGS = {
  basic_calculator: ['free', 'pro', 'expert'],
  advanced_calculator: ['pro', 'expert'],
  multi_year_planning: ['pro', 'expert'],
  state_comparisons: ['pro', 'expert'],
  unlimited_exports: ['pro', 'expert'],
  business_calculator: ['expert'],
  investment_planning: ['expert'],
  estate_planning: ['expert'],
  api_access: ['expert'],
  custom_reports: ['expert'],
  priority_support: ['expert']
};

// Stripe product creation utility
const createStripeProducts = async () => {
  try {
    logger.info('Creating Stripe products and prices...');

    // Create Pro product
    const proProduct = await stripe.products.create({
      name: 'GlobalTaxCalc Pro',
      description: 'Advanced tax calculation features with unlimited usage',
      metadata: {
        tier: 'pro'
      }
    });

    const proPrice = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: SUBSCRIPTION_TIERS.PRO.price,
      currency: 'usd',
      recurring: {
        interval: 'month'
      },
      metadata: {
        tier: 'pro'
      }
    });

    // Create Expert product
    const expertProduct = await stripe.products.create({
      name: 'GlobalTaxCalc Expert',
      description: 'Complete tax planning suite with business and investment tools',
      metadata: {
        tier: 'expert'
      }
    });

    const expertPrice = await stripe.prices.create({
      product: expertProduct.id,
      unit_amount: SUBSCRIPTION_TIERS.EXPERT.price,
      currency: 'usd',
      recurring: {
        interval: 'month'
      },
      metadata: {
        tier: 'expert'
      }
    });

    logger.info('Stripe products created successfully', {
      proPriceId: proPrice.id,
      expertPriceId: expertPrice.id
    });

    return {
      pro: {
        productId: proProduct.id,
        priceId: proPrice.id
      },
      expert: {
        productId: expertProduct.id,
        priceId: expertPrice.id
      }
    };
  } catch (error) {
    logger.error('Error creating Stripe products:', error);
    throw error;
  }
};

// Stripe customer management
const createCustomer = async (user) => {
  try {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: {
        userId: user.id.toString(),
        registrationDate: new Date().toISOString()
      }
    });

    logger.info('Stripe customer created', { customerId: customer.id, userId: user.id });
    return customer;
  } catch (error) {
    logger.error('Error creating Stripe customer:', error);
    throw error;
  }
};

const updateCustomer = async (customerId, updateData) => {
  try {
    const customer = await stripe.customers.update(customerId, updateData);
    logger.info('Stripe customer updated', { customerId });
    return customer;
  } catch (error) {
    logger.error('Error updating Stripe customer:', error);
    throw error;
  }
};

// Subscription management
const createSubscription = async (customerId, priceId, options = {}) => {
  try {
    const subscriptionData = {
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        createdAt: new Date().toISOString(),
        ...options.metadata
      }
    };

    // Add trial period if specified
    if (options.trialDays) {
      subscriptionData.trial_period_days = options.trialDays;
    }

    // Add coupon if specified
    if (options.coupon) {
      subscriptionData.coupon = options.coupon;
    }

    const subscription = await stripe.subscriptions.create(subscriptionData);

    logger.info('Stripe subscription created', {
      subscriptionId: subscription.id,
      customerId,
      priceId
    });

    return subscription;
  } catch (error) {
    logger.error('Error creating Stripe subscription:', error);
    throw error;
  }
};

const updateSubscription = async (subscriptionId, updateData) => {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, updateData);
    logger.info('Stripe subscription updated', { subscriptionId });
    return subscription;
  } catch (error) {
    logger.error('Error updating Stripe subscription:', error);
    throw error;
  }
};

const cancelSubscription = async (subscriptionId, immediately = false) => {
  try {
    const subscription = immediately
      ? await stripe.subscriptions.cancel(subscriptionId)
      : await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true
        });

    logger.info('Stripe subscription cancelled', { subscriptionId, immediately });
    return subscription;
  } catch (error) {
    logger.error('Error cancelling Stripe subscription:', error);
    throw error;
  }
};

// Payment method management
const attachPaymentMethod = async (paymentMethodId, customerId) => {
  try {
    const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId
    });

    logger.info('Payment method attached', { paymentMethodId, customerId });
    return paymentMethod;
  } catch (error) {
    logger.error('Error attaching payment method:', error);
    throw error;
  }
};

const setDefaultPaymentMethod = async (customerId, paymentMethodId) => {
  try {
    const customer = await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    });

    logger.info('Default payment method set', { customerId, paymentMethodId });
    return customer;
  } catch (error) {
    logger.error('Error setting default payment method:', error);
    throw error;
  }
};

// Invoice management
const createInvoice = async (customerId, options = {}) => {
  try {
    const invoice = await stripe.invoices.create({
      customer: customerId,
      auto_advance: true,
      ...options
    });

    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
    logger.info('Invoice created and finalized', { invoiceId: finalizedInvoice.id });

    return finalizedInvoice;
  } catch (error) {
    logger.error('Error creating invoice:', error);
    throw error;
  }
};

const retrieveInvoice = async (invoiceId) => {
  try {
    const invoice = await stripe.invoices.retrieve(invoiceId);
    return invoice;
  } catch (error) {
    logger.error('Error retrieving invoice:', error);
    throw error;
  }
};

// Webhook signature verification
const verifyWebhookSignature = (payload, signature, endpointSecret) => {
  try {
    const event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);
    return event;
  } catch (error) {
    logger.error('Webhook signature verification failed:', error);
    throw error;
  }
};

// Usage records for metered billing
const createUsageRecord = async (subscriptionItemId, quantity, timestamp = null) => {
  try {
    const usageRecord = await stripe.subscriptionItems.createUsageRecord(
      subscriptionItemId,
      {
        quantity,
        timestamp: timestamp || Math.floor(Date.now() / 1000),
        action: 'increment'
      }
    );

    logger.info('Usage record created', { subscriptionItemId, quantity });
    return usageRecord;
  } catch (error) {
    logger.error('Error creating usage record:', error);
    throw error;
  }
};

// Coupon management
const createCoupon = async (couponData) => {
  try {
    const coupon = await stripe.coupons.create(couponData);
    logger.info('Coupon created', { couponId: coupon.id });
    return coupon;
  } catch (error) {
    logger.error('Error creating coupon:', error);
    throw error;
  }
};

// Portal session for customer self-service
const createPortalSession = async (customerId, returnUrl) => {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl
    });

    logger.info('Portal session created', { customerId, sessionId: session.id });
    return session;
  } catch (error) {
    logger.error('Error creating portal session:', error);
    throw error;
  }
};

// Utility functions
const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount / 100);
};

const getTierByPriceId = (priceId) => {
  for (const [tierKey, tier] of Object.entries(SUBSCRIPTION_TIERS)) {
    if (tier.stripePriceId === priceId) {
      return tier;
    }
  }
  return null;
};

const hasFeatureAccess = (userTier, feature) => {
  return FEATURE_FLAGS[feature] && FEATURE_FLAGS[feature].includes(userTier);
};

module.exports = {
  stripe,
  SUBSCRIPTION_TIERS,
  FEATURE_FLAGS,

  // Setup functions
  createStripeProducts,

  // Customer management
  createCustomer,
  updateCustomer,

  // Subscription management
  createSubscription,
  updateSubscription,
  cancelSubscription,

  // Payment methods
  attachPaymentMethod,
  setDefaultPaymentMethod,

  // Invoices
  createInvoice,
  retrieveInvoice,

  // Webhooks
  verifyWebhookSignature,

  // Usage tracking
  createUsageRecord,

  // Coupons
  createCoupon,

  // Customer portal
  createPortalSession,

  // Utility functions
  formatCurrency,
  getTierByPriceId,
  hasFeatureAccess
};