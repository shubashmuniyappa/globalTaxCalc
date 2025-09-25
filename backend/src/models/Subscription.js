const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Subscription = sequelize.define('Subscription', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  stripeCustomerId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  stripeSubscriptionId: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  stripePriceId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  tier: {
    type: DataTypes.ENUM('free', 'pro', 'expert'),
    allowNull: false,
    defaultValue: 'free'
  },
  status: {
    type: DataTypes.ENUM(
      'incomplete',
      'incomplete_expired',
      'trialing',
      'active',
      'past_due',
      'canceled',
      'unpaid',
      'paused'
    ),
    allowNull: false,
    defaultValue: 'incomplete'
  },
  currentPeriodStart: {
    type: DataTypes.DATE,
    allowNull: true
  },
  currentPeriodEnd: {
    type: DataTypes.DATE,
    allowNull: true
  },
  trialStart: {
    type: DataTypes.DATE,
    allowNull: true
  },
  trialEnd: {
    type: DataTypes.DATE,
    allowNull: true
  },
  cancelAtPeriodEnd: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  canceledAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  endedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  lastPaymentDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  nextPaymentDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  amount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Amount in cents'
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'USD'
  },
  interval: {
    type: DataTypes.ENUM('month', 'year'),
    allowNull: true
  },
  intervalCount: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'subscriptions',
  timestamps: true,
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['stripeCustomerId']
    },
    {
      fields: ['stripeSubscriptionId']
    },
    {
      fields: ['tier']
    },
    {
      fields: ['status']
    },
    {
      fields: ['currentPeriodEnd']
    }
  ]
});

// Instance methods
Subscription.prototype.isActive = function() {
  return ['active', 'trialing'].includes(this.status);
};

Subscription.prototype.isTrialing = function() {
  return this.status === 'trialing' &&
         this.trialEnd &&
         new Date() < new Date(this.trialEnd);
};

Subscription.prototype.isPastDue = function() {
  return this.status === 'past_due';
};

Subscription.prototype.isCanceled = function() {
  return ['canceled', 'unpaid', 'incomplete_expired'].includes(this.status);
};

Subscription.prototype.willCancelAtPeriodEnd = function() {
  return this.cancelAtPeriodEnd && this.isActive();
};

Subscription.prototype.daysUntilRenewal = function() {
  if (!this.currentPeriodEnd) return null;

  const now = new Date();
  const endDate = new Date(this.currentPeriodEnd);
  const diffTime = endDate - now;

  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

Subscription.prototype.getFeatures = function() {
  const { SUBSCRIPTION_TIERS } = require('../config/stripe');
  return SUBSCRIPTION_TIERS[this.tier.toUpperCase()]?.features || [];
};

Subscription.prototype.getLimits = function() {
  const { SUBSCRIPTION_TIERS } = require('../config/stripe');
  return SUBSCRIPTION_TIERS[this.tier.toUpperCase()]?.limits || {};
};

Subscription.prototype.hasFeature = function(feature) {
  const { hasFeatureAccess } = require('../config/stripe');
  return hasFeatureAccess(this.tier, feature);
};

Subscription.prototype.canUpgradeTo = function(targetTier) {
  const tierOrder = ['free', 'pro', 'expert'];
  const currentIndex = tierOrder.indexOf(this.tier);
  const targetIndex = tierOrder.indexOf(targetTier);

  return targetIndex > currentIndex;
};

Subscription.prototype.canDowngradeTo = function(targetTier) {
  const tierOrder = ['free', 'pro', 'expert'];
  const currentIndex = tierOrder.indexOf(this.tier);
  const targetIndex = tierOrder.indexOf(targetTier);

  return targetIndex < currentIndex;
};

Subscription.prototype.getProrationAmount = function(newTier) {
  const { SUBSCRIPTION_TIERS } = require('../config/stripe');

  if (!this.currentPeriodEnd) return 0;

  const currentTierPrice = SUBSCRIPTION_TIERS[this.tier.toUpperCase()]?.price || 0;
  const newTierPrice = SUBSCRIPTION_TIERS[newTier.toUpperCase()]?.price || 0;

  const daysRemaining = this.daysUntilRenewal();
  const daysInPeriod = this.interval === 'year' ? 365 : 30;

  const unusedAmount = (currentTierPrice * daysRemaining) / daysInPeriod;
  const newAmount = (newTierPrice * daysRemaining) / daysInPeriod;

  return Math.round(newAmount - unusedAmount);
};

// Class methods
Subscription.findByUserId = function(userId) {
  return this.findOne({ where: { userId } });
};

Subscription.findByStripeCustomerId = function(stripeCustomerId) {
  return this.findOne({ where: { stripeCustomerId } });
};

Subscription.findByStripeSubscriptionId = function(stripeSubscriptionId) {
  return this.findOne({ where: { stripeSubscriptionId } });
};

Subscription.findActiveSubscriptions = function() {
  return this.findAll({
    where: {
      status: ['active', 'trialing']
    }
  });
};

Subscription.findExpiringTrials = function(daysAhead = 3) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  return this.findAll({
    where: {
      status: 'trialing',
      trialEnd: {
        [sequelize.Op.lte]: futureDate,
        [sequelize.Op.gte]: new Date()
      }
    }
  });
};

Subscription.findPastDueSubscriptions = function() {
  return this.findAll({
    where: {
      status: 'past_due'
    }
  });
};

// Hooks
Subscription.beforeCreate(async (subscription) => {
  // Set default metadata
  if (!subscription.metadata) {
    subscription.metadata = {};
  }

  subscription.metadata.createdAt = new Date().toISOString();
});

Subscription.beforeUpdate(async (subscription) => {
  // Update metadata on status changes
  if (subscription.changed('status')) {
    subscription.metadata = {
      ...subscription.metadata,
      lastStatusChange: new Date().toISOString(),
      previousStatus: subscription._previousDataValues.status
    };
  }
});

module.exports = Subscription;