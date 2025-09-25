const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UsageTracking = sequelize.define('UsageTracking', {
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
  subscriptionId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Subscriptions',
      key: 'id'
    }
  },
  feature: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Feature being tracked (e.g., calculations, exports, api_calls)'
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Specific action performed (e.g., basic_calculation, pdf_export)'
  },
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: 'Number of units consumed'
  },
  periodStart: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: 'Start of the billing period'
  },
  periodEnd: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: 'End of the billing period'
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional context about the usage'
  },
  ipAddress: {
    type: DataTypes.INET,
    allowNull: true
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'usage_tracking',
  timestamps: true,
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['subscriptionId']
    },
    {
      fields: ['feature']
    },
    {
      fields: ['action']
    },
    {
      fields: ['periodStart', 'periodEnd']
    },
    {
      fields: ['createdAt']
    },
    {
      unique: false,
      fields: ['userId', 'feature', 'periodStart', 'periodEnd']
    }
  ]
});

// Instance methods
UsageTracking.prototype.isWithinPeriod = function(date = new Date()) {
  return date >= this.periodStart && date <= this.periodEnd;
};

// Class methods
UsageTracking.getCurrentPeriod = function() {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  return { periodStart, periodEnd };
};

UsageTracking.trackUsage = async function(userId, feature, action, options = {}) {
  const {
    quantity = 1,
    metadata = {},
    ipAddress = null,
    userAgent = null,
    periodStart = null,
    periodEnd = null
  } = options;

  // Get current billing period if not provided
  const period = periodStart && periodEnd
    ? { periodStart, periodEnd }
    : this.getCurrentPeriod();

  const usage = await this.create({
    userId,
    feature,
    action,
    quantity,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    metadata: {
      ...metadata,
      timestamp: new Date().toISOString(),
      source: 'application'
    },
    ipAddress,
    userAgent
  });

  return usage;
};

UsageTracking.getUserUsage = async function(userId, feature = null, period = null) {
  const currentPeriod = period || this.getCurrentPeriod();

  const whereClause = {
    userId,
    periodStart: currentPeriod.periodStart,
    periodEnd: currentPeriod.periodEnd
  };

  if (feature) {
    whereClause.feature = feature;
  }

  const usage = await this.findAll({
    where: whereClause,
    order: [['createdAt', 'DESC']]
  });

  // Aggregate usage by feature
  const aggregated = usage.reduce((acc, record) => {
    const key = record.feature;
    if (!acc[key]) {
      acc[key] = {
        feature: key,
        totalQuantity: 0,
        actions: {},
        firstUsed: record.createdAt,
        lastUsed: record.createdAt
      };
    }

    acc[key].totalQuantity += record.quantity;
    acc[key].actions[record.action] = (acc[key].actions[record.action] || 0) + record.quantity;

    if (record.createdAt < acc[key].firstUsed) {
      acc[key].firstUsed = record.createdAt;
    }
    if (record.createdAt > acc[key].lastUsed) {
      acc[key].lastUsed = record.createdAt;
    }

    return acc;
  }, {});

  return {
    period: currentPeriod,
    usage: Object.values(aggregated),
    rawRecords: usage
  };
};

UsageTracking.checkUsageLimit = async function(userId, feature, limit) {
  if (limit === -1) return { withinLimit: true, usage: 0, limit: -1 }; // Unlimited

  const currentPeriod = this.getCurrentPeriod();

  const totalUsage = await this.sum('quantity', {
    where: {
      userId,
      feature,
      periodStart: currentPeriod.periodStart,
      periodEnd: currentPeriod.periodEnd
    }
  }) || 0;

  return {
    withinLimit: totalUsage < limit,
    usage: totalUsage,
    limit,
    remaining: Math.max(0, limit - totalUsage)
  };
};

UsageTracking.getUserUsageSummary = async function(userId, months = 1) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const usage = await this.findAll({
    where: {
      userId,
      createdAt: {
        [sequelize.Op.gte]: startDate,
        [sequelize.Op.lte]: endDate
      }
    },
    order: [['createdAt', 'DESC']]
  });

  // Group by month and feature
  const monthlyUsage = usage.reduce((acc, record) => {
    const monthKey = record.createdAt.toISOString().substring(0, 7); // YYYY-MM
    const featureKey = record.feature;

    if (!acc[monthKey]) {
      acc[monthKey] = {};
    }
    if (!acc[monthKey][featureKey]) {
      acc[monthKey][featureKey] = 0;
    }

    acc[monthKey][featureKey] += record.quantity;
    return acc;
  }, {});

  // Calculate totals
  const totalUsage = usage.reduce((acc, record) => {
    acc[record.feature] = (acc[record.feature] || 0) + record.quantity;
    return acc;
  }, {});

  return {
    period: {
      start: startDate,
      end: endDate,
      months
    },
    totalUsage,
    monthlyUsage,
    recordCount: usage.length
  };
};

UsageTracking.getTopUsers = async function(feature = null, limit = 10, period = null) {
  const currentPeriod = period || this.getCurrentPeriod();

  const whereClause = {
    periodStart: currentPeriod.periodStart,
    periodEnd: currentPeriod.periodEnd
  };

  if (feature) {
    whereClause.feature = feature;
  }

  const topUsers = await this.findAll({
    attributes: [
      'userId',
      [sequelize.fn('SUM', sequelize.col('quantity')), 'totalUsage'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'recordCount']
    ],
    where: whereClause,
    group: ['userId'],
    order: [[sequelize.fn('SUM', sequelize.col('quantity')), 'DESC']],
    limit
  });

  return topUsers.map(user => ({
    userId: user.userId,
    totalUsage: parseInt(user.dataValues.totalUsage),
    recordCount: parseInt(user.dataValues.recordCount)
  }));
};

UsageTracking.getUsageAnalytics = async function(period = null) {
  const currentPeriod = period || this.getCurrentPeriod();

  const analytics = await this.findAll({
    attributes: [
      'feature',
      'action',
      [sequelize.fn('SUM', sequelize.col('quantity')), 'totalUsage'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'recordCount'],
      [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('userId'))), 'uniqueUsers']
    ],
    where: {
      periodStart: currentPeriod.periodStart,
      periodEnd: currentPeriod.periodEnd
    },
    group: ['feature', 'action'],
    order: [[sequelize.fn('SUM', sequelize.col('quantity')), 'DESC']]
  });

  return analytics.map(record => ({
    feature: record.feature,
    action: record.action,
    totalUsage: parseInt(record.dataValues.totalUsage),
    recordCount: parseInt(record.dataValues.recordCount),
    uniqueUsers: parseInt(record.dataValues.uniqueUsers)
  }));
};

UsageTracking.cleanupOldRecords = async function(monthsToKeep = 12) {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - monthsToKeep);

  const deletedCount = await this.destroy({
    where: {
      createdAt: {
        [sequelize.Op.lt]: cutoffDate
      }
    }
  });

  return deletedCount;
};

// Hooks
UsageTracking.beforeCreate(async (usage) => {
  // Ensure period dates are set
  if (!usage.periodStart || !usage.periodEnd) {
    const period = UsageTracking.getCurrentPeriod();
    usage.periodStart = usage.periodStart || period.periodStart;
    usage.periodEnd = usage.periodEnd || period.periodEnd;
  }

  // Add creation timestamp to metadata
  usage.metadata = {
    ...usage.metadata,
    createdAt: new Date().toISOString()
  };
});

module.exports = UsageTracking;