const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { User, Session, AuditLog, UserDevice } = require('../models');
const jwtService = require('./jwtService');
const emailService = require('./emailService');
const config = require('../config');

class AuthService {
  constructor() {
    this.maxLoginAttempts = config.MAX_LOGIN_ATTEMPTS;
    this.lockoutTime = config.LOCKOUT_TIME;
  }

  /**
   * Register a new user
   */
  async register(userData, req) {
    const { email, password, firstName, lastName, gdprConsent, marketingConsent } = userData;

    try {
      // Check if user already exists
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        throw new Error('User already exists with this email');
      }

      // Create new user
      const user = await User.create({
        email,
        passwordHash: password, // Will be hashed by the model hook
        firstName,
        lastName,
        role: 'user',
        gdprConsent: gdprConsent || false,
        gdprConsentDate: gdprConsent ? new Date() : null,
        marketingConsent: marketingConsent || false,
        emailVerified: false
      });

      // Generate email verification token if feature is enabled
      let emailVerificationToken = null;
      if (config.FEATURES.EMAIL_VERIFICATION) {
        emailVerificationToken = user.generateEmailVerificationToken();
        await user.save();

        // Send verification email
        try {
          await emailService.sendEmailVerification(user.email, emailVerificationToken);
        } catch (error) {
          console.error('Failed to send verification email:', error);
          // Don't fail registration if email sending fails
        }
      } else {
        // Auto-verify email if verification is disabled
        user.emailVerified = true;
        await user.save();
      }

      // Log registration
      await AuditLog.logAuthEvent('user_registered', user.id, null, req, {
        email: user.email,
        emailVerificationSent: !!emailVerificationToken
      });

      return {
        user: user.toSafeObject(),
        emailVerificationRequired: config.FEATURES.EMAIL_VERIFICATION && !user.emailVerified
      };

    } catch (error) {
      // Log failed registration
      await AuditLog.logAuthEvent('registration_failed', null, null, req, {
        email,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Login user with email and password
   */
  async login(credentials, req) {
    const { email, password, deviceInfo, rememberMe } = credentials;

    try {
      // Find user by email
      const user = await User.findOne({ where: { email } });
      if (!user) {
        await AuditLog.logAuthEvent('login_failed', null, null, req, {
          email,
          reason: 'user_not_found'
        });
        throw new Error('Invalid email or password');
      }

      // Check if account is locked
      if (user.isAccountLocked()) {
        await AuditLog.logSecurityEvent('login_attempt_locked_account', user.id, req, {
          email,
          lockoutExpires: user.accountLockedUntil
        });
        throw new Error('Account is temporarily locked. Please try again later.');
      }

      // Check if account is active
      if (!user.isActive) {
        await AuditLog.logAuthEvent('login_failed', user.id, null, req, {
          email,
          reason: 'account_deactivated'
        });
        throw new Error('Account is deactivated');
      }

      // Validate password
      const isPasswordValid = await user.validatePassword(password);
      if (!isPasswordValid) {
        await user.incrementFailedLogins();
        await AuditLog.logAuthEvent('login_failed', user.id, null, req, {
          email,
          reason: 'invalid_password',
          failedAttempts: user.failedLoginAttempts
        });
        throw new Error('Invalid email or password');
      }

      // Check email verification if required
      if (config.FEATURES.EMAIL_VERIFICATION && !user.emailVerified) {
        await AuditLog.logAuthEvent('login_failed', user.id, null, req, {
          email,
          reason: 'email_not_verified'
        });
        throw new Error('Please verify your email address before logging in');
      }

      // Reset failed login attempts on successful password validation
      await user.resetFailedLogins();

      // Check if two-factor authentication is required
      if (user.twoFactorEnabled) {
        // Generate temporary 2FA token
        const twoFactorToken = jwtService.generateTwoFactorToken(user.id, null);

        await AuditLog.logAuthEvent('two_factor_required', user.id, null, req, {
          email
        });

        return {
          success: false,
          twoFactorRequired: true,
          twoFactorToken,
          message: 'Two-factor authentication required'
        };
      }

      // Create session and device registration
      const sessionData = await this.createUserSession(user, req, deviceInfo, rememberMe);

      // Update user login information
      user.lastLoginAt = new Date();
      user.lastLoginIp = req.ip;
      await user.save();

      // Log successful login
      await AuditLog.logAuthEvent('login_success', user.id, sessionData.session.id, req, {
        email,
        deviceId: sessionData.device?.deviceId,
        rememberMe
      });

      return {
        success: true,
        user: user.toSafeObject(),
        ...sessionData.tokens,
        session: {
          id: sessionData.session.sessionId,
          expiresAt: sessionData.session.expiresAt
        },
        device: sessionData.device?.getSecurityInfo()
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Login with two-factor authentication
   */
  async loginWithTwoFactor(twoFactorData, req) {
    const { twoFactorToken, code, deviceInfo, rememberMe } = twoFactorData;

    try {
      // Verify 2FA token
      const tokenResult = jwtService.verifyToken(twoFactorToken);
      if (!tokenResult.success || tokenResult.payload.type !== 'two_factor') {
        throw new Error('Invalid or expired two-factor token');
      }

      const userId = tokenResult.payload.userId;
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify 2FA code
      const isCodeValid = await this.verifyTwoFactorCode(user, code);
      if (!isCodeValid) {
        await AuditLog.logSecurityEvent('two_factor_failed', user.id, req, {
          code: code.replace(/./g, '*') // Hide actual code in logs
        });
        throw new Error('Invalid two-factor authentication code');
      }

      // Create session
      const sessionData = await this.createUserSession(user, req, deviceInfo, rememberMe);

      // Update user login information
      user.lastLoginAt = new Date();
      user.lastLoginIp = req.ip;
      await user.save();

      // Log successful 2FA login
      await AuditLog.logAuthEvent('two_factor_success', user.id, sessionData.session.id, req, {
        deviceId: sessionData.device?.deviceId
      });

      return {
        success: true,
        user: user.toSafeObject(),
        ...sessionData.tokens,
        session: {
          id: sessionData.session.sessionId,
          expiresAt: sessionData.session.expiresAt
        },
        device: sessionData.device?.getSecurityInfo()
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Create user session and tokens
   */
  async createUserSession(user, req, deviceInfo = {}, rememberMe = false) {
    // Register or update device
    const device = await UserDevice.registerDevice(
      user.id,
      { ...deviceInfo, userAgent: req.get('User-Agent') },
      req.ip
    );

    // Create session
    const sessionId = Session.generateSessionId();
    const expirationHours = rememberMe ? 30 * 24 : 24; // 30 days or 1 day

    const session = await Session.create({
      sessionId,
      userId: user.id,
      sessionType: 'authenticated',
      deviceInfo: {
        ...deviceInfo,
        userAgent: req.get('User-Agent')
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      expiresAt: new Date(Date.now() + expirationHours * 60 * 60 * 1000),
      loginMethod: 'password',
      csrfToken: crypto.randomBytes(32).toString('hex')
    });

    // Generate refresh token
    const refreshToken = session.generateRefreshToken();
    await session.save();

    // Generate JWT tokens
    const tokens = jwtService.generateTokens(user, session.id, device.deviceId);

    return {
      session,
      device,
      tokens
    };
  }

  /**
   * Logout user
   */
  async logout(sessionId, req) {
    try {
      const session = await Session.findOne({
        where: { sessionId, isActive: true },
        include: [{ model: User, as: 'user' }]
      });

      if (!session) {
        throw new Error('Session not found');
      }

      // Revoke session
      await session.revoke('user_logout');

      // Log logout
      await AuditLog.logAuthEvent('logout', session.userId, session.id, req);

      return { success: true };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Logout from all devices
   */
  async logoutAll(userId, currentSessionId, req) {
    try {
      const revokedCount = await Session.revokeAllUserSessions(userId, currentSessionId);

      // Log logout all
      await AuditLog.logAuthEvent('logout_all', userId, null, req, {
        revokedSessions: revokedCount
      });

      return { success: true, revokedSessions: revokedCount };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken, req) {
    try {
      // Find session by refresh token
      const session = await Session.findByRefreshToken(refreshToken);
      if (!session) {
        throw new Error('Invalid refresh token');
      }

      // Check if session is still active
      if (!session.isActive || session.isExpired()) {
        await session.revoke('expired');
        throw new Error('Session expired');
      }

      // Generate new access token
      const tokenData = await jwtService.refreshAccessToken(
        refreshToken,
        session.user,
        session.id
      );

      // Update session activity
      await session.updateActivity();

      // Log token refresh
      await AuditLog.logAuthEvent('token_refreshed', session.userId, session.id, req);

      return tokenData;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Create guest session
   */
  async createGuestSession(req, deviceInfo = {}) {
    try {
      const sessionId = Session.generateSessionId();

      const session = await Session.create({
        sessionId,
        sessionType: 'guest',
        deviceInfo: {
          ...deviceInfo,
          userAgent: req.get('User-Agent')
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        loginMethod: 'guest'
      });

      // Generate guest token
      const guestToken = jwtService.generateGuestToken(session.id);

      return {
        sessionId: session.sessionId,
        token: guestToken,
        expiresAt: session.expiresAt
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email, req) {
    try {
      const user = await User.findOne({ where: { email } });
      if (!user) {
        // Don't reveal if email exists
        return { success: true, message: 'If the email exists, a reset link has been sent' };
      }

      // Generate reset token
      const resetToken = user.generatePasswordResetToken();
      await user.save();

      // Send reset email
      try {
        await emailService.sendPasswordReset(user.email, resetToken);
      } catch (error) {
        console.error('Failed to send password reset email:', error);
        throw new Error('Failed to send reset email');
      }

      // Log password reset request
      await AuditLog.logSecurityEvent('password_reset_requested', user.id, req, {
        email
      });

      return { success: true, message: 'Password reset email sent' };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(token, newPassword, req) {
    try {
      const user = await User.findByPasswordResetToken(token);
      if (!user) {
        throw new Error('Invalid or expired reset token');
      }

      // Update password
      user.passwordHash = newPassword; // Will be hashed by model hook
      user.passwordResetToken = null;
      user.passwordResetExpires = null;
      await user.save();

      // Revoke all user sessions for security
      await Session.revokeAllUserSessions(user.id);

      // Log password reset
      await AuditLog.logSecurityEvent('password_reset_completed', user.id, req, {
        email: user.email
      });

      return { success: true, message: 'Password reset successfully' };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Verify email address
   */
  async verifyEmail(token, req) {
    try {
      const user = await User.findByEmailVerificationToken(token);
      if (!user) {
        throw new Error('Invalid or expired verification token');
      }

      // Mark email as verified
      user.emailVerified = true;
      user.emailVerificationToken = null;
      user.emailVerificationExpires = null;
      await user.save();

      // Log email verification
      await AuditLog.logAuthEvent('email_verified', user.id, null, req, {
        email: user.email
      });

      return { success: true, message: 'Email verified successfully' };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Verify two-factor authentication code
   */
  async verifyTwoFactorCode(user, code) {
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return false;
    }

    const speakeasy = require('speakeasy');

    return speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: config.TWO_FACTOR_WINDOW
    });
  }

  /**
   * Get user session information
   */
  async getSessionInfo(sessionId) {
    try {
      const session = await Session.findActiveSession(sessionId);
      if (!session) {
        return null;
      }

      return {
        sessionId: session.sessionId,
        userId: session.userId,
        sessionType: session.sessionType,
        deviceInfo: session.deviceInfo,
        ipAddress: session.ipAddress,
        expiresAt: session.expiresAt,
        lastActivityAt: session.lastActivityAt,
        user: session.user ? session.user.toSafeObject() : null
      };

    } catch (error) {
      throw error;
    }
  }
}

module.exports = new AuthService();