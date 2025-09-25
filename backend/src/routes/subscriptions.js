const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const logger = require('../utils/logger');

const Subscription = require('../models/Subscription');
const UsageTracking = require('../models/UsageTracking');
const User = require('../models/User');

const {
  stripe,
  SUBSCRIPTION_TIERS,
  createCustomer,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  attachPaymentMethod,
  setDefaultPaymentMethod,
  createPortalSession,
  getTierByPriceId,
  formatCurrency
} = require('../config/stripe');

// Rate limiting for subscription operations
const subscriptionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10 // limit each IP to 10 requests per windowMs
});

// GET /api/subscriptions/status - Get user's subscription status
router.get('/status', auth, async (req, res) => {
  try {
    const subscription = await Subscription.findByUserId(req.user.id);

    if (!subscription) {
      return res.json({
        tier: 'free',
        status: 'active',
        subscription: null,
        features: SUBSCRIPTION_TIERS.FREE.features,
        limits: SUBSCRIPTION_TIERS.FREE.limits
      });
    }

    // Get current usage
    const usage = await UsageTracking.getUserUsage(req.user.id);

    res.json({
      tier: subscription.tier,
      status: subscription.status,
      subscription: {
        id: subscription.id,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        trialEnd: subscription.trialEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        amount: subscription.amount,
        currency: subscription.currency,
        interval: subscription.interval,
        nextPaymentDate: subscription.nextPaymentDate,
        daysUntilRenewal: subscription.daysUntilRenewal(),
        isTrialing: subscription.isTrialing(),
        willCancelAtPeriodEnd: subscription.willCancelAtPeriodEnd()
      },
      features: subscription.getFeatures(),
      limits: subscription.getLimits(),
      usage: usage.usage
    });
  } catch (error) {
    logger.error('Error getting subscription status:', error);
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
});

// POST /api/subscriptions/create - Create a new subscription
router.post('/create', auth, subscriptionRateLimit, async (req, res) => {
  try {
    const { priceId, paymentMethodId, trialDays, coupon } = req.body;

    if (!priceId) {
      return res.status(400).json({ error: 'Price ID is required' });
    }

    const tier = getTierByPriceId(priceId);
    if (!tier) {
      return res.status(400).json({ error: 'Invalid price ID' });
    }

    // Check if user already has a subscription
    let subscription = await Subscription.findByUserId(req.user.id);
    if (subscription && subscription.isActive()) {
      return res.status(400).json({ error: 'User already has an active subscription' });
    }

    // Create or get Stripe customer
    let stripeCustomer;
    if (subscription?.stripeCustomerId) {
      stripeCustomer = await stripe.customers.retrieve(subscription.stripeCustomerId);
    } else {
      stripeCustomer = await createCustomer(req.user);
    }

    // Attach payment method if provided
    if (paymentMethodId) {
      await attachPaymentMethod(paymentMethodId, stripeCustomer.id);
      await setDefaultPaymentMethod(stripeCustomer.id, paymentMethodId);
    }

    // Create Stripe subscription
    const stripeSubscription = await createSubscription(
      stripeCustomer.id,
      priceId,
      {
        trialDays,
        coupon,
        metadata: {
          userId: req.user.id,
          tier: tier.id
        }
      }
    );

    // Create or update local subscription record
    const subscriptionData = {
      userId: req.user.id,
      stripeCustomerId: stripeCustomer.id,
      stripeSubscriptionId: stripeSubscription.id,
      stripePriceId: priceId,
      tier: tier.id,
      status: stripeSubscription.status,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      amount: tier.price,
      currency: 'USD',
      interval: tier.interval,
      metadata: {
        stripeData: {
          customerId: stripeCustomer.id,
          subscriptionId: stripeSubscription.id
        }
      }
    };

    if (stripeSubscription.trial_end) {
      subscriptionData.trialStart = new Date(stripeSubscription.trial_start * 1000);
      subscriptionData.trialEnd = new Date(stripeSubscription.trial_end * 1000);
    }

    if (subscription) {
      await subscription.update(subscriptionData);
    } else {
      subscription = await Subscription.create(subscriptionData);
    }

    logger.info('Subscription created', {
      userId: req.user.id,
      subscriptionId: subscription.id,
      tier: tier.id,
      stripeSubscriptionId: stripeSubscription.id
    });

    res.json({
      subscription: {
        id: subscription.id,
        tier: subscription.tier,
        status: subscription.status,
        clientSecret: stripeSubscription.latest_invoice?.payment_intent?.client_secret
      },
      requiresAction: stripeSubscription.status === 'incomplete',
      paymentIntent: stripeSubscription.latest_invoice?.payment_intent
    });
  } catch (error) {
    logger.error('Error creating subscription:', error);
    res.status(500).json({
      error: 'Failed to create subscription',
      message: error.message
    });
  }
});

// PUT /api/subscriptions/update - Update subscription plan
router.put('/update', auth, subscriptionRateLimit, async (req, res) => {
  try {
    const { priceId, prorationBehavior = 'create_prorations' } = req.body;

    if (!priceId) {
      return res.status(400).json({ error: 'Price ID is required' });
    }

    const subscription = await Subscription.findByUserId(req.user.id);
    if (!subscription || !subscription.stripeSubscriptionId) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    const newTier = getTierByPriceId(priceId);
    if (!newTier) {
      return res.status(400).json({ error: 'Invalid price ID' });
    }

    // Check if it's an upgrade or downgrade
    const isUpgrade = subscription.canUpgradeTo(newTier.id);
    const isDowngrade = subscription.canDowngradeTo(newTier.id);

    if (!isUpgrade && !isDowngrade) {
      return res.status(400).json({ error: 'Invalid tier change' });
    }

    // Get current Stripe subscription
    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);

    // Update Stripe subscription
    const updatedStripeSubscription = await updateSubscription(
      subscription.stripeSubscriptionId,
      {
        items: [{
          id: stripeSubscription.items.data[0].id,
          price: priceId
        }],
        proration_behavior: prorationBehavior,
        metadata: {
          ...stripeSubscription.metadata,
          tier: newTier.id,
          updatedAt: new Date().toISOString()
        }
      }
    );

    // Update local subscription
    await subscription.update({
      stripePriceId: priceId,
      tier: newTier.id,
      status: updatedStripeSubscription.status,
      amount: newTier.price,
      metadata: {
        ...subscription.metadata,
        previousTier: subscription.tier,
        updatedAt: new Date().toISOString()
      }
    });

    logger.info('Subscription updated', {
      userId: req.user.id,
      subscriptionId: subscription.id,
      previousTier: subscription.tier,
      newTier: newTier.id,
      isUpgrade,
      isDowngrade
    });

    res.json({
      subscription: {
        id: subscription.id,
        tier: newTier.id,
        status: updatedStripeSubscription.status,
        features: newTier.features,
        limits: newTier.limits
      },
      prorationAmount: subscription.getProrationAmount(newTier.id),
      invoice: updatedStripeSubscription.latest_invoice
    });
  } catch (error) {
    logger.error('Error updating subscription:', error);
    res.status(500).json({
      error: 'Failed to update subscription',
      message: error.message
    });
  }
});

// POST /api/subscriptions/cancel - Cancel subscription
router.post('/cancel', auth, subscriptionRateLimit, async (req, res) => {
  try {
    const { immediately = false } = req.body;

    const subscription = await Subscription.findByUserId(req.user.id);
    if (!subscription || !subscription.stripeSubscriptionId) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    // Cancel Stripe subscription
    const canceledSubscription = await cancelSubscription(
      subscription.stripeSubscriptionId,
      immediately
    );

    // Update local subscription
    const updateData = {
      status: canceledSubscription.status,
      cancelAtPeriodEnd: !immediately,
      metadata: {
        ...subscription.metadata,
        canceledAt: new Date().toISOString(),
        canceledImmediately: immediately
      }
    };

    if (immediately) {
      updateData.endedAt = new Date();
      updateData.tier = 'free';
    }

    await subscription.update(updateData);

    logger.info('Subscription canceled', {
      userId: req.user.id,
      subscriptionId: subscription.id,
      immediately
    });

    res.json({
      subscription: {
        id: subscription.id,
        status: canceledSubscription.status,
        cancelAtPeriodEnd: !immediately,
        endDate: immediately ? new Date() : subscription.currentPeriodEnd
      },
      message: immediately
        ? 'Subscription canceled immediately'
        : 'Subscription will cancel at the end of the current billing period'
    });
  } catch (error) {
    logger.error('Error canceling subscription:', error);
    res.status(500).json({
      error: 'Failed to cancel subscription',
      message: error.message
    });
  }
});

// POST /api/subscriptions/reactivate - Reactivate canceled subscription
router.post('/reactivate', auth, subscriptionRateLimit, async (req, res) => {
  try {
    const subscription = await Subscription.findByUserId(req.user.id);
    if (!subscription || !subscription.stripeSubscriptionId) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    if (!subscription.willCancelAtPeriodEnd()) {
      return res.status(400).json({ error: 'Subscription is not set to cancel' });
    }

    // Reactivate Stripe subscription
    const reactivatedSubscription = await updateSubscription(
      subscription.stripeSubscriptionId,
      {
        cancel_at_period_end: false,
        metadata: {
          ...subscription.metadata,
          reactivatedAt: new Date().toISOString()
        }
      }
    );

    // Update local subscription
    await subscription.update({
      cancelAtPeriodEnd: false,
      status: reactivatedSubscription.status,
      metadata: {
        ...subscription.metadata,
        reactivatedAt: new Date().toISOString()
      }
    });

    logger.info('Subscription reactivated', {
      userId: req.user.id,
      subscriptionId: subscription.id
    });

    res.json({
      subscription: {
        id: subscription.id,
        status: reactivatedSubscription.status,
        cancelAtPeriodEnd: false
      },
      message: 'Subscription reactivated successfully'
    });
  } catch (error) {
    logger.error('Error reactivating subscription:', error);
    res.status(500).json({
      error: 'Failed to reactivate subscription',
      message: error.message
    });
  }
});

// GET /api/subscriptions/usage - Get current usage statistics
router.get('/usage', auth, async (req, res) => {
  try {
    const { period, feature } = req.query;

    let usagePeriod = null;
    if (period) {
      // Parse period from query (format: YYYY-MM)
      const [year, month] = period.split('-').map(Number);
      if (year && month) {
        usagePeriod = {
          periodStart: new Date(year, month - 1, 1),
          periodEnd: new Date(year, month, 0, 23, 59, 59)
        };
      }
    }

    const usage = await UsageTracking.getUserUsage(
      req.user.id,
      feature,
      usagePeriod
    );

    const subscription = await Subscription.findByUserId(req.user.id);
    const limits = subscription ? subscription.getLimits() : SUBSCRIPTION_TIERS.FREE.limits;

    // Check limits for each feature
    const limitChecks = {};
    for (const [featureName, limit] of Object.entries(limits)) {
      if (featureName !== 'features' && typeof limit === 'number') {
        limitChecks[featureName] = await UsageTracking.checkUsageLimit(
          req.user.id,
          featureName,
          limit
        );
      }
    }

    res.json({
      period: usage.period,
      usage: usage.usage,
      limits: limitChecks,
      subscription: {
        tier: subscription?.tier || 'free',
        limits: limits
      }
    });
  } catch (error) {
    logger.error('Error getting usage statistics:', error);
    res.status(500).json({ error: 'Failed to get usage statistics' });
  }
});

// GET /api/subscriptions/plans - Get available subscription plans
router.get('/plans', async (req, res) => {
  try {
    const plans = Object.values(SUBSCRIPTION_TIERS).map(tier => ({
      id: tier.id,
      name: tier.name,
      price: tier.price,
      interval: tier.interval,
      stripePriceId: tier.stripePriceId,
      features: tier.features,
      limits: tier.limits,
      formattedPrice: tier.price ? formatCurrency(tier.price) : 'Free'
    }));

    res.json({ plans });
  } catch (error) {
    logger.error('Error getting subscription plans:', error);
    res.status(500).json({ error: 'Failed to get subscription plans' });
  }
});

// POST /api/subscriptions/portal - Create customer portal session
router.post('/portal', auth, async (req, res) => {
  try {
    const { returnUrl } = req.body;

    const subscription = await Subscription.findByUserId(req.user.id);
    if (!subscription || !subscription.stripeCustomerId) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    const session = await createPortalSession(
      subscription.stripeCustomerId,
      returnUrl || `${process.env.FRONTEND_URL}/dashboard/subscription`
    );

    res.json({ url: session.url });
  } catch (error) {
    logger.error('Error creating portal session:', error);
    res.status(500).json({
      error: 'Failed to create portal session',
      message: error.message
    });
  }
});

// GET /api/subscriptions/invoices - Get user's invoices
router.get('/invoices', auth, async (req, res) => {
  try {
    const { limit = 10, startingAfter } = req.query;

    const subscription = await Subscription.findByUserId(req.user.id);
    if (!subscription || !subscription.stripeCustomerId) {
      return res.json({ invoices: [] });
    }

    const invoices = await stripe.invoices.list({
      customer: subscription.stripeCustomerId,
      limit: parseInt(limit),
      starting_after: startingAfter
    });

    const formattedInvoices = invoices.data.map(invoice => ({
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      created: new Date(invoice.created * 1000),
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
      paidAt: invoice.status_transitions.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000)
        : null,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      invoicePdf: invoice.invoice_pdf,
      formattedAmount: formatCurrency(invoice.amount_paid, invoice.currency)
    }));

    res.json({
      invoices: formattedInvoices,
      hasMore: invoices.has_more
    });
  } catch (error) {
    logger.error('Error getting invoices:', error);
    res.status(500).json({ error: 'Failed to get invoices' });
  }
});

module.exports = router;