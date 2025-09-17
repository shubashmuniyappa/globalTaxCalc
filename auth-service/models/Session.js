'use strict';

const crypto = require('crypto');

module.exports = (sequelize, DataTypes) => {
  const Session = sequelize.define('Session', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    sessionId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      field: 'session_id'
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
    sessionType: {
      type: DataTypes.ENUM('guest', 'authenticated'),
      defaultValue: 'guest',
      allowNull: false,
      field: 'session_type'
    },
    deviceInfo: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'device_info'
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
    locationInfo: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'location_info'
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at'
    },
    refreshTokenHash: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'refresh_token_hash'
    },
    refreshTokenExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'refresh_token_expires_at'
    },
    csrfToken: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'csrf_token'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      field: 'is_active'
    },
    lastActivityAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
      field: 'last_activity_at'
    },
    loginMethod: {
      type: DataTypes.ENUM('password', 'google', 'apple', 'guest'),
      allowNull: true,
      field: 'login_method'
    },
    sessionData: {
      type: DataTypes.JSON,
      defaultValue: {},
      allowNull: false,
      field: 'session_data'
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'revoked_at'
    },
    revokedReason: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'revoked_reason'
    }
  }, {
    tableName: 'sessions',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  // Instance methods
  Session.prototype.isExpired = function() {
    return this.expiresAt < new Date();
  };

  Session.prototype.isRefreshTokenExpired = function() {
    return this.refreshTokenExpiresAt && this.refreshTokenExpiresAt < new Date();
  };

  Session.prototype.generateRefreshToken = function() {
    const token = crypto.randomBytes(64).toString('hex');
    this.refreshTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    this.refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    return token;
  };

  Session.prototype.generateCSRFToken = function() {
    this.csrfToken = crypto.randomBytes(32).toString('hex');
    return this.csrfToken;
  };

  Session.prototype.updateActivity = async function() {
    this.lastActivityAt = new Date();
    await this.save();
  };

  Session.prototype.revoke = async function(reason = null) {
    this.isActive = false;
    this.revokedAt = new Date();
    this.revokedReason = reason;
    await this.save();
  };

  Session.prototype.extend = async function(hours = 24) {
    this.expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    await this.save();
  };

  Session.prototype.setSessionData = async function(key, value) {
    const data = this.sessionData || {};
    data[key] = value;
    this.sessionData = data;
    await this.save();
  };

  Session.prototype.getSessionData = function(key) {
    const data = this.sessionData || {};
    return key ? data[key] : data;
  };

  Session.prototype.clearSessionData = async function(key = null) {
    if (key) {
      const data = this.sessionData || {};
      delete data[key];
      this.sessionData = data;
    } else {
      this.sessionData = {};
    }
    await this.save();
  };

  // Static methods
  Session.generateSessionId = function() {
    return crypto.randomBytes(32).toString('hex');
  };

  Session.findActiveSession = function(sessionId) {
    return this.findOne({
      where: {
        sessionId,
        isActive: true,
        expiresAt: {
          [sequelize.Sequelize.Op.gt]: new Date()
        }
      },
      include: [{
        model: sequelize.models.User,
        as: 'user'
      }]
    });
  };

  Session.findByRefreshToken = function(refreshToken) {
    const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    return this.findOne({
      where: {
        refreshTokenHash: hashedToken,
        isActive: true,
        refreshTokenExpiresAt: {
          [sequelize.Sequelize.Op.gt]: new Date()
        }
      },
      include: [{
        model: sequelize.models.User,
        as: 'user'
      }]
    });
  };

  Session.cleanupExpiredSessions = async function() {
    const expiredSessions = await this.findAll({
      where: {
        [sequelize.Sequelize.Op.or]: [
          {
            expiresAt: {
              [sequelize.Sequelize.Op.lt]: new Date()
            }
          },
          {
            refreshTokenExpiresAt: {
              [sequelize.Sequelize.Op.lt]: new Date()
            }
          }
        ],
        isActive: true
      }
    });

    for (const session of expiredSessions) {
      await session.revoke('expired');
    }

    return expiredSessions.length;
  };

  Session.getUserActiveSessions = function(userId) {
    return this.findAll({
      where: {
        userId,
        sessionType: 'authenticated',
        isActive: true,
        expiresAt: {
          [sequelize.Sequelize.Op.gt]: new Date()
        }
      },
      order: [['lastActivityAt', 'DESC']]
    });
  };

  Session.revokeAllUserSessions = async function(userId, excludeSessionId = null) {
    const sessions = await this.findAll({
      where: {
        userId,
        isActive: true,
        ...(excludeSessionId && {
          sessionId: {
            [sequelize.Sequelize.Op.ne]: excludeSessionId
          }
        })
      }
    });

    for (const session of sessions) {
      await session.revoke('user_logout_all');
    }

    return sessions.length;
  };

  // Associations
  Session.associate = function(models) {
    Session.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });

    Session.hasMany(models.AuditLog, {
      foreignKey: 'sessionId',
      as: 'auditLogs'
    });
  };

  return Session;
};