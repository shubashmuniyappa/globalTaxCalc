const Subscription = require('../models/Subscription');
const UsageTracking = require('../models/UsageTracking');
const { SUBSCRIPTION_TIERS, hasFeatureAccess } = require('../config/stripe');
const logger = require('../utils/logger');

/**
 * Middleware to check if user has access to a specific feature
 */
const requireFeature = (feature) => {
  return async (req, res, next) => {
    try {
      const subscription = await Subscription.findByUserId(req.user.id);
      const userTier = subscription?.tier || 'free';

      if (!hasFeatureAccess(userTier, feature)) {
        return res.status(403).json({
          error: 'Feature not available',
          message: `This feature requires a higher subscription tier`,
          feature,
          currentTier: userTier,
          requiredTiers: getRequiredTiers(feature),
          upgradeUrl: '/dashboard/subscription'
        });
      }

      // Add subscription info to request
      req.subscription = subscription;
      req.userTier = userTier;
      next();
    } catch (error) {
      logger.error('Error checking feature access:', error);
      res.status(500).json({ error: 'Failed to verify feature access' });
    }
  };
};

/**
 * Middleware to check usage limits for a specific feature
 */
const checkUsageLimit = (feature, quantity = 1) => {
  return async (req, res, next) => {
    try {
      const subscription = await Subscription.findByUserId(req.user.id);
      const userTier = subscription?.tier || 'free';
      const limits = SUBSCRIPTION_TIERS[userTier.toUpperCase()]?.limits || SUBSCRIPTION_TIERS.FREE.limits;

      const featureLimit = limits[feature];

      // If feature is unlimited (-1), allow access
      if (featureLimit === -1) {
        req.remainingUsage = -1;
        return next();
      }

      // Check current usage
      const usageCheck = await UsageTracking.checkUsageLimit(req.user.id, feature, featureLimit);

      if (!usageCheck.withinLimit || usageCheck.remaining < quantity) {
        return res.status(429).json({
          error: 'Usage limit exceeded',
          message: `You have exceeded your ${feature} limit for this billing period`,
          feature,
          currentUsage: usageCheck.usage,
          limit: usageCheck.limit,
          remaining: usageCheck.remaining,
          resetDate: getNextResetDate(),
          currentTier: userTier,
          upgradeUrl: '/dashboard/subscription'
        });
      }

      req.remainingUsage = usageCheck.remaining;
      req.usageLimit = usageCheck.limit;
      next();
    } catch (error) {
      logger.error('Error checking usage limit:', error);
      res.status(500).json({ error: 'Failed to verify usage limit' });
    }
  };
};

/**
 * Middleware to track feature usage
 */
const trackUsage = (feature, action, getQuantity = () => 1) => {
  return async (req, res, next) => {
    // Store original res.json to track after response
    const originalJson = res.json;

    res.json = function(data) {
      // Call original res.json first
      const result = originalJson.call(this, data);

      // Track usage asynchronously (don't wait for it)
      setImmediate(async () => {
        try {
          const quantity = typeof getQuantity === 'function' ? getQuantity(req, res, data) : getQuantity;

          await UsageTracking.trackUsage(req.user.id, feature, action, {
            quantity,
            metadata: {
              endpoint: req.path,
              method: req.method,
              userAgent: req.get('User-Agent'),
              responseStatus: res.statusCode,
              ...getTrackingMetadata(req, res, data)
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          });

          logger.debug('Usage tracked', {
            userId: req.user.id,
            feature,
            action,
            quantity
          });
        } catch (error) {
          logger.error('Error tracking usage:', error);
        }
      });

      return result;
    };

    next();
  };
};

/**
 * Middleware to require active subscription
 */
const requireActiveSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findByUserId(req.user.id);

    if (!subscription || !subscription.isActive()) {
      return res.status(403).json({
        error: 'Active subscription required',
        message: 'This feature requires an active subscription',
        currentStatus: subscription?.status || 'none',
        upgradeUrl: '/dashboard/subscription'
      });
    }

    req.subscription = subscription;
    next();
  } catch (error) {
    logger.error('Error checking subscription status:', error);
    res.status(500).json({ error: 'Failed to verify subscription status' });
  }
};

/**
 * Middleware to require specific subscription tier
 */
const requireTier = (requiredTier) => {
  return async (req, res, next) => {
    try {
      const subscription = await Subscription.findByUserId(req.user.id);
      const userTier = subscription?.tier || 'free';

      const tierOrder = ['free', 'pro', 'expert'];
      const userTierIndex = tierOrder.indexOf(userTier);
      const requiredTierIndex = tierOrder.indexOf(requiredTier);

      if (userTierIndex < requiredTierIndex) {
        return res.status(403).json({
          error: 'Insufficient subscription tier',
          message: `This feature requires ${requiredTier} tier or higher`,
          currentTier: userTier,
          requiredTier,
          upgradeUrl: '/dashboard/subscription'
        });
      }

      req.subscription = subscription;
      req.userTier = userTier;
      next();
    } catch (error) {
      logger.error('Error checking subscription tier:', error);
      res.status(500).json({ error: 'Failed to verify subscription tier' });
    }
  };
};

/**
 * Middleware for trial period checks
 */
const checkTrialStatus = async (req, res, next) => {
  try {
    const subscription = await Subscription.findByUserId(req.user.id);

    if (subscription && subscription.isTrialing()) {
      const daysRemaining = Math.ceil(
        (new Date(subscription.trialEnd) - new Date()) / (1000 * 60 * 60 * 24)
      );

      req.trialInfo = {
        isTrialing: true,
        trialEnd: subscription.trialEnd,
        daysRemaining
      };

      // Add trial warning for last 3 days
      if (daysRemaining <= 3) {
        res.set('X-Trial-Warning', `Trial expires in ${daysRemaining} days`);
      }
    } else {
      req.trialInfo = { isTrialing: false };
    }

    next();
  } catch (error) {
    logger.error('Error checking trial status:', error);
    next(); // Don't block request on trial check failure
  }
};

/**
 * Middleware to add subscription context to requests
 */
const addSubscriptionContext = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    const subscription = await Subscription.findByUserId(req.user.id);
    const userTier = subscription?.tier || 'free';

    req.subscriptionContext = {
      subscription,
      tier: userTier,
      features: SUBSCRIPTION_TIERS[userTier.toUpperCase()]?.features || [],
      limits: SUBSCRIPTION_TIERS[userTier.toUpperCase()]?.limits || {},
      isActive: subscription?.isActive() || userTier === 'free',
      isTrialing: subscription?.isTrialing() || false
    };

    next();
  } catch (error) {
    logger.error('Error adding subscription context:', error);
    next(); // Don't block request
  }
};

/**
 * Middleware for soft paywall (preview with upgrade prompt)
 */
const softPaywall = (feature, previewData = null) => {
  return async (req, res, next) => {
    try {
      const subscription = await Subscription.findByUserId(req.user.id);
      const userTier = subscription?.tier || 'free';

      if (!hasFeatureAccess(userTier, feature)) {
        // For GET requests, return preview data with upgrade prompt
        if (req.method === 'GET' && previewData) {
          return res.json({
            preview: true,
            data: previewData,
            upgrade: {
              message: 'Upgrade to access full features',
              feature,
              currentTier: userTier,
              requiredTiers: getRequiredTiers(feature),
              upgradeUrl: '/dashboard/subscription'
            }
          });
        }

        // For other methods, require upgrade
        return res.status(403).json({
          error: 'Feature requires upgrade',
          message: 'This feature is available with a premium subscription',
          feature,
          currentTier: userTier,
          requiredTiers: getRequiredTiers(feature),
          upgradeUrl: '/dashboard/subscription'
        });
      }

      req.subscription = subscription;
      req.userTier = userTier;
      next();
    } catch (error) {
      logger.error('Error in soft paywall check:', error);
      res.status(500).json({ error: 'Failed to verify access' });
    }
  };
};

// Helper functions
const getRequiredTiers = (feature) => {
  const { FEATURE_FLAGS } = require('../config/stripe');
  return FEATURE_FLAGS[feature] || [];
};

const getNextResetDate = () => {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth;
};

const getTrackingMetadata = (req, res, data) => {
  const metadata = {
    timestamp: new Date().toISOString(),
    requestId: req.requestId || req.id
  };

  // Add specific metadata based on endpoint
  if (req.path.includes('/calculate')) {
    metadata.calculationType = req.body?.type || 'unknown';
    metadata.income = req.body?.income;
  }

  if (req.path.includes('/export')) {
    metadata.exportFormat = req.body?.format || req.query?.format;
  }

  return metadata;
};

module.exports = {
  requireFeature,
  checkUsageLimit,
  trackUsage,
  requireActiveSubscription,
  requireTier,
  checkTrialStatus,
  addSubscriptionContext,
  softPaywall
};