'use strict';

module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    sessionId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'session_id',
      references: {
        model: 'sessions',
        key: 'id'
      }
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    category: {
      type: DataTypes.ENUM('auth', 'user', 'security', 'admin', 'system'),
      allowNull: false
    },
    severity: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
      defaultValue: 'low',
      allowNull: false
    },
    ipAddress: {
      type: DataTypes.INET,
      allowNull: false,
      field: 'ip_address'
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'user_agent'
    },
    endpoint: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    method: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    statusCode: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'status_code'
    },
    details: {
      type: DataTypes.JSON,
      allowNull: true
    },
    oldValues: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'old_values'
    },
    newValues: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'new_values'
    },
    requestId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'request_id'
    },
    geoLocation: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'geo_location'
    },
    riskScore: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'risk_score'
    },
    flagged: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    flaggedReason: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'flagged_reason'
    },
    reviewedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'reviewed_by',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'reviewed_at'
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    }
  }, {
    tableName: 'audit_logs',
    underscored: true,
    timestamps: false, // Only createdAt, no updatedAt for audit logs
    hooks: {
      beforeCreate: (auditLog) => {
        // Calculate risk score based on various factors
        auditLog.riskScore = auditLog.calculateRiskScore();

        // Auto-flag high-risk activities
        if (auditLog.riskScore >= 80) {
          auditLog.flagged = true;
          auditLog.flaggedReason = 'High risk score detected';
        }
      }
    }
  });

  // Instance methods
  AuditLog.prototype.calculateRiskScore = function() {
    let score = 0;

    // Base score by action type
    const highRiskActions = [
      'login_failed', 'account_locked', 'password_reset_requested',
      'password_changed', 'email_changed', 'two_factor_disabled'
    ];

    const mediumRiskActions = [
      'login_success', 'logout', 'profile_updated', 'two_factor_enabled'
    ];

    if (highRiskActions.includes(this.action)) {
      score += 40;
    } else if (mediumRiskActions.includes(this.action)) {
      score += 20;
    } else {
      score += 10;
    }

    // Increase score for failed actions
    if (this.statusCode >= 400) {
      score += 20;
    }

    // Increase score for unusual locations (if geo data available)
    if (this.geoLocation && this.geoLocation.unusual) {
      score += 30;
    }

    // Increase score for suspicious user agents
    if (this.userAgent && this.isUserAgentSuspicious()) {
      score += 25;
    }

    // Cap at 100
    return Math.min(score, 100);
  };

  AuditLog.prototype.isUserAgentSuspicious = function() {
    if (!this.userAgent) return false;

    const suspiciousPatterns = [
      /curl/i, /wget/i, /python/i, /java/i, /bot/i, /crawler/i, /spider/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(this.userAgent));
  };

  AuditLog.prototype.flag = async function(reason) {
    this.flagged = true;
    this.flaggedReason = reason;
    await this.save();
  };

  AuditLog.prototype.review = async function(reviewerId, approved = true) {
    this.reviewedBy = reviewerId;
    this.reviewedAt = new Date();

    if (approved) {
      this.flagged = false;
      this.flaggedReason = null;
    }

    await this.save();
  };

  // Static methods
  AuditLog.createLog = async function(data) {
    try {
      return await this.create(data);
    } catch (error) {
      // Don't let audit logging failures break the main application
      console.error('Failed to create audit log:', error);
      return null;
    }
  };

  AuditLog.logAuthEvent = async function(action, userId, sessionId, req, details = {}) {
    return this.createLog({
      userId,
      sessionId,
      action,
      category: 'auth',
      severity: this.getSeverityForAction(action),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl,
      method: req.method,
      requestId: req.id,
      details
    });
  };

  AuditLog.logSecurityEvent = async function(action, userId, req, details = {}) {
    return this.createLog({
      userId,
      action,
      category: 'security',
      severity: 'high',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl,
      method: req.method,
      requestId: req.id,
      details
    });
  };

  AuditLog.logUserEvent = async function(action, userId, sessionId, req, oldValues = null, newValues = null) {
    return this.createLog({
      userId,
      sessionId,
      action,
      category: 'user',
      severity: 'low',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl,
      method: req.method,
      requestId: req.id,
      oldValues,
      newValues
    });
  };

  AuditLog.getSeverityForAction = function(action) {
    const criticalActions = ['account_compromised', 'admin_access_granted'];
    const highActions = ['login_failed', 'account_locked', 'password_reset_requested'];
    const mediumActions = ['login_success', 'password_changed', 'email_changed'];

    if (criticalActions.includes(action)) return 'critical';
    if (highActions.includes(action)) return 'high';
    if (mediumActions.includes(action)) return 'medium';
    return 'low';
  };

  AuditLog.getRecentActivity = function(userId, limit = 50) {
    return this.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit,
      attributes: [
        'action', 'category', 'severity', 'ipAddress', 'endpoint',
        'method', 'statusCode', 'details', 'createdAt'
      ]
    });
  };

  AuditLog.getFlaggedLogs = function(limit = 100) {
    return this.findAll({
      where: {
        flagged: true,
        reviewedAt: null
      },
      order: [['riskScore', 'DESC'], ['createdAt', 'DESC']],
      limit,
      include: [{
        model: sequelize.models.User,
        as: 'user',
        attributes: ['id', 'email', 'firstName', 'lastName']
      }]
    });
  };

  AuditLog.getSecurityReport = async function(startDate, endDate) {
    const Op = sequelize.Sequelize.Op;

    const [totalLogs, flaggedLogs, criticalLogs, loginAttempts, failedLogins] = await Promise.all([
      this.count({
        where: {
          createdAt: {
            [Op.between]: [startDate, endDate]
          }
        }
      }),
      this.count({
        where: {
          flagged: true,
          createdAt: {
            [Op.between]: [startDate, endDate]
          }
        }
      }),
      this.count({
        where: {
          severity: 'critical',
          createdAt: {
            [Op.between]: [startDate, endDate]
          }
        }
      }),
      this.count({
        where: {
          action: 'login_success',
          createdAt: {
            [Op.between]: [startDate, endDate]
          }
        }
      }),
      this.count({
        where: {
          action: 'login_failed',
          createdAt: {
            [Op.between]: [startDate, endDate]
          }
        }
      })
    ]);

    return {
      totalLogs,
      flaggedLogs,
      criticalLogs,
      loginAttempts,
      failedLogins,
      successRate: loginAttempts > 0 ? ((loginAttempts / (loginAttempts + failedLogins)) * 100).toFixed(2) : 0
    };
  };

  // Associations
  AuditLog.associate = function(models) {
    AuditLog.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });

    AuditLog.belongsTo(models.Session, {
      foreignKey: 'sessionId',
      as: 'session'
    });

    AuditLog.belongsTo(models.User, {
      foreignKey: 'reviewedBy',
      as: 'reviewer'
    });
  };

  return AuditLog;
};