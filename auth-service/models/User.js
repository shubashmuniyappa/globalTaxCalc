'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    emailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      field: 'email_verified'
    },
    emailVerificationToken: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'email_verification_token'
    },
    emailVerificationExpires: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'email_verification_expires'
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'password_hash'
    },
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'first_name'
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'last_name'
    },
    avatarUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'avatar_url'
    },
    phoneNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'phone_number'
    },
    phoneVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      field: 'phone_verified'
    },
    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'date_of_birth'
    },
    timezone: {
      type: DataTypes.STRING(50),
      defaultValue: 'UTC',
      allowNull: false
    },
    locale: {
      type: DataTypes.STRING(10),
      defaultValue: 'en-US',
      allowNull: false
    },
    provider: {
      type: DataTypes.ENUM('email', 'google', 'apple'),
      defaultValue: 'email',
      allowNull: false
    },
    providerId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'provider_id'
    },
    role: {
      type: DataTypes.ENUM('guest', 'user', 'premium', 'admin'),
      defaultValue: 'user',
      allowNull: false
    },
    subscriptionStatus: {
      type: DataTypes.ENUM('none', 'trial', 'active', 'cancelled', 'expired'),
      defaultValue: 'none',
      allowNull: false,
      field: 'subscription_status'
    },
    subscriptionPlan: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'subscription_plan'
    },
    subscriptionExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'subscription_expires_at'
    },
    trialEndsAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'trial_ends_at'
    },
    passwordResetToken: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'password_reset_token'
    },
    passwordResetExpires: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'password_reset_expires'
    },
    failedLoginAttempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      field: 'failed_login_attempts'
    },
    accountLockedUntil: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'account_locked_until'
    },
    twoFactorEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      field: 'two_factor_enabled'
    },
    twoFactorSecret: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'two_factor_secret'
    },
    backupCodes: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'backup_codes'
    },
    preferences: {
      type: DataTypes.JSON,
      defaultValue: {},
      allowNull: false
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_login_at'
    },
    lastLoginIp: {
      type: DataTypes.INET,
      allowNull: true,
      field: 'last_login_ip'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      field: 'is_active'
    },
    deactivatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'deactivated_at'
    },
    gdprConsent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      field: 'gdpr_consent'
    },
    gdprConsentDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'gdpr_consent_date'
    },
    marketingConsent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      field: 'marketing_consent'
    },
    dataExportRequestedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'data_export_requested_at'
    },
    deletionRequestedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'deletion_requested_at'
    }
  }, {
    tableName: 'users',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    hooks: {
      beforeCreate: async (user) => {
        if (user.passwordHash) {
          user.passwordHash = await bcrypt.hash(user.passwordHash, 12);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('passwordHash') && user.passwordHash) {
          user.passwordHash = await bcrypt.hash(user.passwordHash, 12);
        }
      }
    }
  });

  // Instance methods
  User.prototype.validatePassword = async function(password) {
    if (!this.passwordHash) return false;
    return bcrypt.compare(password, this.passwordHash);
  };

  User.prototype.generatePasswordResetToken = function() {
    const token = crypto.randomBytes(32).toString('hex');
    this.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
    this.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    return token;
  };

  User.prototype.generateEmailVerificationToken = function() {
    const token = crypto.randomBytes(32).toString('hex');
    this.emailVerificationToken = crypto.createHash('sha256').update(token).digest('hex');
    this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    return token;
  };

  User.prototype.isAccountLocked = function() {
    return this.accountLockedUntil && this.accountLockedUntil > new Date();
  };

  User.prototype.incrementFailedLogins = async function() {
    // If first failed attempt or if account was locked but now expired, start counting from 1
    if (this.failedLoginAttempts === 0 || (this.accountLockedUntil && this.accountLockedUntil < new Date())) {
      this.failedLoginAttempts = 1;
      this.accountLockedUntil = null;
    } else {
      this.failedLoginAttempts += 1;
    }

    // Lock account after 5 failed attempts for 30 minutes
    if (this.failedLoginAttempts >= 5) {
      this.accountLockedUntil = new Date(Date.now() + 30 * 60 * 1000);
    }

    await this.save();
  };

  User.prototype.resetFailedLogins = async function() {
    if (this.failedLoginAttempts > 0 || this.accountLockedUntil) {
      this.failedLoginAttempts = 0;
      this.accountLockedUntil = null;
      await this.save();
    }
  };

  User.prototype.isPremium = function() {
    return this.subscriptionStatus === 'active' || this.subscriptionStatus === 'trial';
  };

  User.prototype.isTrialExpired = function() {
    return this.trialEndsAt && this.trialEndsAt < new Date();
  };

  User.prototype.isSubscriptionExpired = function() {
    return this.subscriptionExpiresAt && this.subscriptionExpiresAt < new Date();
  };

  User.prototype.getFullName = function() {
    if (this.firstName && this.lastName) {
      return `${this.firstName} ${this.lastName}`;
    }
    return this.firstName || this.lastName || this.email;
  };

  User.prototype.toSafeObject = function() {
    const safeFields = [
      'id', 'email', 'emailVerified', 'firstName', 'lastName', 'avatarUrl',
      'phoneNumber', 'phoneVerified', 'timezone', 'locale', 'provider',
      'role', 'subscriptionStatus', 'subscriptionPlan', 'subscriptionExpiresAt',
      'trialEndsAt', 'twoFactorEnabled', 'preferences', 'lastLoginAt',
      'isActive', 'gdprConsent', 'marketingConsent', 'createdAt', 'updatedAt'
    ];

    const safeUser = {};
    safeFields.forEach(field => {
      if (this[field] !== undefined) {
        safeUser[field] = this[field];
      }
    });

    return safeUser;
  };

  // Static methods
  User.findByPasswordResetToken = function(token) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    return this.findOne({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: {
          [sequelize.Sequelize.Op.gt]: new Date()
        }
      }
    });
  };

  User.findByEmailVerificationToken = function(token) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    return this.findOne({
      where: {
        emailVerificationToken: hashedToken,
        emailVerificationExpires: {
          [sequelize.Sequelize.Op.gt]: new Date()
        }
      }
    });
  };

  // Associations
  User.associate = function(models) {
    User.hasMany(models.Session, {
      foreignKey: 'userId',
      as: 'sessions'
    });

    User.hasMany(models.AuditLog, {
      foreignKey: 'userId',
      as: 'auditLogs'
    });

    User.hasMany(models.OAuthProvider, {
      foreignKey: 'userId',
      as: 'oauthProviders'
    });

    User.hasMany(models.UserDevice, {
      foreignKey: 'userId',
      as: 'devices'
    });
  };

  return User;
};