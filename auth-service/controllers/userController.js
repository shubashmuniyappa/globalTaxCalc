const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { User, Session, AuditLog, UserDevice } = require('../models');
const emailService = require('../services/emailService');
const config = require('../config');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');

class UserController {
  async updateProfile(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const user = req.user;
      const { firstName, lastName, marketingConsent } = req.body;

      const updatedUser = await user.update({
        firstName: firstName || user.firstName,
        lastName: lastName || user.lastName,
        marketingConsent: marketingConsent !== undefined ? marketingConsent : user.marketingConsent
      });

      await AuditLog.logUserEvent('profile_updated', user.id, req, {
        changes: req.body
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: updatedUser.toSafeObject()
        }
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async changePassword(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const user = req.user;
      const { currentPassword, newPassword } = req.body;

      const isCurrentPasswordValid = await user.validatePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      user.passwordHash = newPassword; // Will be hashed by model hook
      await user.save();

      await Session.revokeAllUserSessions(user.id, req.session.id);

      await AuditLog.logSecurityEvent('password_changed', user.id, req, {
        email: user.email
      });

      res.json({
        success: true,
        message: 'Password changed successfully. Please log in again.'
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async deleteAccount(req, res) {
    try {
      const user = req.user;

      await Session.revokeAllUserSessions(user.id);

      user.isActive = false;
      user.deletedAt = new Date();
      user.email = `deleted_${user.id}_${user.email}`;
      await user.save();

      await AuditLog.logUserEvent('account_deleted', user.id, req, {
        email: user.email
      });

      res.json({
        success: true,
        message: 'Account deleted successfully'
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async exportUserData(req, res) {
    try {
      const user = req.user;

      const userData = {
        profile: user.toSafeObject(),
        sessions: await Session.findAll({
          where: { userId: user.id },
          attributes: ['sessionId', 'deviceInfo', 'ipAddress', 'createdAt', 'lastActivityAt']
        }),
        devices: await UserDevice.findAll({
          where: { userId: user.id },
          attributes: ['deviceId', 'deviceType', 'browserName', 'os', 'isTrusted', 'createdAt', 'lastSeenAt']
        }),
        auditLogs: await AuditLog.findAll({
          where: { userId: user.id },
          attributes: ['eventType', 'ipAddress', 'userAgent', 'createdAt', 'details'],
          limit: 1000,
          order: [['createdAt', 'DESC']]
        })
      };

      await AuditLog.logUserEvent('data_exported', user.id, req);

      res.json({
        success: true,
        message: 'User data exported successfully',
        data: userData
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async setupTwoFactor(req, res) {
    try {
      const user = req.user;

      if (user.twoFactorEnabled) {
        return res.status(400).json({
          success: false,
          message: 'Two-factor authentication is already enabled'
        });
      }

      const secret = speakeasy.generateSecret({
        name: `${config.TWO_FACTOR_ISSUER} (${user.email})`,
        issuer: config.TWO_FACTOR_ISSUER,
        length: 32
      });

      const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

      user.twoFactorSecret = secret.base32;
      await user.save();

      res.json({
        success: true,
        message: 'Two-factor authentication setup initiated',
        data: {
          secret: secret.base32,
          qrCode: qrCodeUrl,
          manualEntryKey: secret.base32
        }
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async confirmTwoFactor(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const user = req.user;
      const { secret, code } = req.body;

      if (!user.twoFactorSecret || user.twoFactorSecret !== secret) {
        return res.status(400).json({
          success: false,
          message: 'Invalid setup session'
        });
      }

      const verified = speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: code,
        window: config.TWO_FACTOR_WINDOW
      });

      if (!verified) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code'
        });
      }

      user.twoFactorEnabled = true;
      user.twoFactorBackupCodes = this.generateBackupCodesArray();
      await user.save();

      await AuditLog.logSecurityEvent('two_factor_enabled', user.id, req, {
        email: user.email
      });

      res.json({
        success: true,
        message: 'Two-factor authentication enabled successfully',
        data: {
          backupCodes: user.twoFactorBackupCodes
        }
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async disableTwoFactor(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const user = req.user;
      const { code } = req.body;

      if (!user.twoFactorEnabled) {
        return res.status(400).json({
          success: false,
          message: 'Two-factor authentication is not enabled'
        });
      }

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: code,
        window: config.TWO_FACTOR_WINDOW
      });

      if (!verified) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code'
        });
      }

      user.twoFactorEnabled = false;
      user.twoFactorSecret = null;
      user.twoFactorBackupCodes = null;
      await user.save();

      await AuditLog.logSecurityEvent('two_factor_disabled', user.id, req, {
        email: user.email
      });

      res.json({
        success: true,
        message: 'Two-factor authentication disabled successfully'
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async generateBackupCodes(req, res) {
    try {
      const user = req.user;

      if (!user.twoFactorEnabled) {
        return res.status(400).json({
          success: false,
          message: 'Two-factor authentication is not enabled'
        });
      }

      user.twoFactorBackupCodes = this.generateBackupCodesArray();
      await user.save();

      await AuditLog.logSecurityEvent('backup_codes_generated', user.id, req);

      res.json({
        success: true,
        message: 'New backup codes generated',
        data: {
          backupCodes: user.twoFactorBackupCodes
        }
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  generateBackupCodesArray() {
    const codes = [];
    for (let i = 0; i < 10; i++) {
      codes.push(Math.random().toString(36).substring(2, 10).toUpperCase());
    }
    return codes;
  }

  async getUserSessions(req, res) {
    try {
      const user = req.user;

      const sessions = await Session.findAll({
        where: {
          userId: user.id,
          isActive: true
        },
        attributes: ['sessionId', 'deviceInfo', 'ipAddress', 'createdAt', 'lastActivityAt', 'expiresAt'],
        order: [['lastActivityAt', 'DESC']]
      });

      res.json({
        success: true,
        data: {
          sessions: sessions.map(session => ({
            ...session.toJSON(),
            isCurrent: session.sessionId === req.session.id
          }))
        }
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async revokeSession(req, res) {
    try {
      const user = req.user;
      const { sessionId } = req.params;

      if (sessionId === req.session.id) {
        return res.status(400).json({
          success: false,
          message: 'Cannot revoke current session'
        });
      }

      const session = await Session.findOne({
        where: {
          sessionId,
          userId: user.id,
          isActive: true
        }
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      await session.revoke('user_revoked');

      await AuditLog.logSecurityEvent('session_revoked', user.id, req, {
        revokedSessionId: sessionId
      });

      res.json({
        success: true,
        message: 'Session revoked successfully'
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async getUserDevices(req, res) {
    try {
      const user = req.user;

      const devices = await UserDevice.findAll({
        where: { userId: user.id },
        order: [['lastSeenAt', 'DESC']]
      });

      res.json({
        success: true,
        data: {
          devices: devices.map(device => device.getSecurityInfo())
        }
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async trustDevice(req, res) {
    try {
      const user = req.user;
      const { deviceId } = req.params;

      const device = await UserDevice.findOne({
        where: {
          deviceId,
          userId: user.id
        }
      });

      if (!device) {
        return res.status(404).json({
          success: false,
          message: 'Device not found'
        });
      }

      device.isTrusted = true;
      await device.save();

      await AuditLog.logSecurityEvent('device_trusted', user.id, req, {
        deviceId: device.deviceId
      });

      res.json({
        success: true,
        message: 'Device trusted successfully'
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async untrustDevice(req, res) {
    try {
      const user = req.user;
      const { deviceId } = req.params;

      const device = await UserDevice.findOne({
        where: {
          deviceId,
          userId: user.id
        }
      });

      if (!device) {
        return res.status(404).json({
          success: false,
          message: 'Device not found'
        });
      }

      device.isTrusted = false;
      await device.save();

      await AuditLog.logSecurityEvent('device_untrusted', user.id, req, {
        deviceId: device.deviceId
      });

      res.json({
        success: true,
        message: 'Device untrusted successfully'
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async removeDevice(req, res) {
    try {
      const user = req.user;
      const { deviceId } = req.params;

      const device = await UserDevice.findOne({
        where: {
          deviceId,
          userId: user.id
        }
      });

      if (!device) {
        return res.status(404).json({
          success: false,
          message: 'Device not found'
        });
      }

      await Session.update(
        { isActive: false, revokedAt: new Date(), revokeReason: 'device_removed' },
        {
          where: {
            userId: user.id,
            deviceInfo: {
              deviceId: deviceId
            }
          }
        }
      );

      await device.destroy();

      await AuditLog.logSecurityEvent('device_removed', user.id, req, {
        deviceId: device.deviceId
      });

      res.json({
        success: true,
        message: 'Device removed successfully'
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async resendEmailVerification(req, res) {
    try {
      const user = req.user;

      if (user.emailVerified) {
        return res.status(400).json({
          success: false,
          message: 'Email is already verified'
        });
      }

      const verificationToken = user.generateEmailVerificationToken();
      await user.save();

      await emailService.sendEmailVerification(user.email, verificationToken);

      await AuditLog.logUserEvent('email_verification_resent', user.id, req, {
        email: user.email
      });

      res.json({
        success: true,
        message: 'Verification email sent successfully'
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async changeEmail(req, res) {
    try {
      const user = req.user;
      const { email } = req.body;

      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email is already in use'
        });
      }

      const changeToken = user.generateEmailChangeToken(email);
      await user.save();

      await emailService.sendEmailChangeConfirmation(email, changeToken);

      await AuditLog.logUserEvent('email_change_requested', user.id, req, {
        oldEmail: user.email,
        newEmail: email
      });

      res.json({
        success: true,
        message: 'Email change confirmation sent to new email address'
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async confirmEmailChange(req, res) {
    try {
      const user = req.user;
      const { token } = req.body;

      if (!user.emailChangeToken || user.emailChangeToken !== token) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired email change token'
        });
      }

      if (user.emailChangeExpires < new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Email change token has expired'
        });
      }

      const oldEmail = user.email;
      user.email = user.emailChangeTo;
      user.emailChangeToken = null;
      user.emailChangeTo = null;
      user.emailChangeExpires = null;
      user.emailVerified = true;
      await user.save();

      await AuditLog.logUserEvent('email_changed', user.id, req, {
        oldEmail,
        newEmail: user.email
      });

      res.json({
        success: true,
        message: 'Email address changed successfully'
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async getSubscriptionStatus(req, res) {
    try {
      const user = req.user;

      res.json({
        success: true,
        data: {
          subscriptionStatus: user.subscriptionStatus,
          subscriptionDetails: config.SUBSCRIPTION_TIERS[user.subscriptionStatus.toUpperCase()],
          calculationsUsed: user.calculationsUsed,
          calculationsReset: user.calculationsReset
        }
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async upgradeSubscription(req, res) {
    try {
      const user = req.user;
      const { tier, paymentMethod } = req.body;

      if (!['premium', 'enterprise'].includes(tier)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid subscription tier'
        });
      }

      user.subscriptionStatus = tier;
      user.calculationsUsed = 0;
      user.calculationsReset = new Date();
      await user.save();

      await AuditLog.logUserEvent('subscription_upgraded', user.id, req, {
        newTier: tier,
        paymentMethod
      });

      res.json({
        success: true,
        message: 'Subscription upgraded successfully',
        data: {
          subscriptionStatus: user.subscriptionStatus,
          subscriptionDetails: config.SUBSCRIPTION_TIERS[tier.toUpperCase()]
        }
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async cancelSubscription(req, res) {
    try {
      const user = req.user;

      if (user.subscriptionStatus === 'free') {
        return res.status(400).json({
          success: false,
          message: 'No active subscription to cancel'
        });
      }

      user.subscriptionStatus = 'free';
      user.calculationsUsed = 0;
      user.calculationsReset = new Date();
      await user.save();

      await AuditLog.logUserEvent('subscription_cancelled', user.id, req);

      res.json({
        success: true,
        message: 'Subscription cancelled successfully'
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Admin endpoints
  async getAllUsers(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        role,
        subscriptionStatus,
        emailVerified,
        isActive,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const offset = (page - 1) * limit;
      const where = {};

      if (search) {
        where[Op.or] = [
          { email: { [Op.iLike]: `%${search}%` } },
          { firstName: { [Op.iLike]: `%${search}%` } },
          { lastName: { [Op.iLike]: `%${search}%` } }
        ];
      }

      if (role) where.role = role;
      if (subscriptionStatus) where.subscriptionStatus = subscriptionStatus;
      if (emailVerified !== undefined) where.emailVerified = emailVerified === 'true';
      if (isActive !== undefined) where.isActive = isActive === 'true';

      const { count, rows: users } = await User.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset,
        order: [[sortBy, sortOrder.toUpperCase()]],
        attributes: { exclude: ['passwordHash', 'twoFactorSecret', 'twoFactorBackupCodes'] }
      });

      res.json({
        success: true,
        data: {
          users: users.map(user => user.toSafeObject()),
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / limit)
          }
        }
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async getUserById(req, res) {
    try {
      const { userId } = req.params;

      const user = await User.findByPk(userId, {
        attributes: { exclude: ['passwordHash', 'twoFactorSecret', 'twoFactorBackupCodes'] },
        include: [
          {
            model: Session,
            as: 'sessions',
            where: { isActive: true },
            required: false
          }
        ]
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: {
          user: user.toSafeObject(),
          sessions: user.sessions
        }
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async adminUpdateUser(req, res) {
    try {
      const { userId } = req.params;
      const { role, subscriptionStatus, isActive, emailVerified } = req.body;

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const oldValues = {
        role: user.role,
        subscriptionStatus: user.subscriptionStatus,
        isActive: user.isActive,
        emailVerified: user.emailVerified
      };

      if (role !== undefined) user.role = role;
      if (subscriptionStatus !== undefined) user.subscriptionStatus = subscriptionStatus;
      if (isActive !== undefined) user.isActive = isActive;
      if (emailVerified !== undefined) user.emailVerified = emailVerified;

      await user.save();

      await AuditLog.logAdminEvent('user_updated', req.user.id, req, {
        targetUserId: userId,
        oldValues,
        newValues: { role, subscriptionStatus, isActive, emailVerified }
      });

      res.json({
        success: true,
        message: 'User updated successfully',
        data: {
          user: user.toSafeObject()
        }
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async toggleUserStatus(req, res) {
    try {
      const { userId } = req.params;

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      user.isActive = !user.isActive;
      await user.save();

      if (!user.isActive) {
        await Session.revokeAllUserSessions(userId);
      }

      await AuditLog.logAdminEvent('user_status_toggled', req.user.id, req, {
        targetUserId: userId,
        newStatus: user.isActive
      });

      res.json({
        success: true,
        message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async getUserAuditLogs(req, res) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;

      const { count, rows: logs } = await AuditLog.findAndCountAll({
        where: { userId },
        limit: parseInt(limit),
        offset,
        order: [['createdAt', 'DESC']]
      });

      res.json({
        success: true,
        data: {
          logs,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / limit)
          }
        }
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async getSecurityEvents(req, res) {
    try {
      const { page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;

      const { count, rows: events } = await AuditLog.findAndCountAll({
        where: {
          eventType: {
            [Op.in]: ['login_failed', 'account_locked', 'suspicious_activity', 'password_reset_requested']
          }
        },
        limit: parseInt(limit),
        offset,
        order: [['createdAt', 'DESC']],
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'email', 'firstName', 'lastName']
          }
        ]
      });

      res.json({
        success: true,
        data: {
          events,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / limit)
          }
        }
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new UserController();