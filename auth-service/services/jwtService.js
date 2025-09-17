const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');

class JWTService {
  constructor() {
    this.secret = config.JWT_SECRET;
    this.expiresIn = config.JWT_EXPIRES_IN;
    this.refreshExpiresIn = config.JWT_REFRESH_EXPIRES_IN;
    this.issuer = config.JWT_ISSUER;
    this.audience = config.JWT_AUDIENCE;
  }

  /**
   * Generate access token
   */
  generateAccessToken(payload) {
    const tokenPayload = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      subscriptionStatus: payload.subscriptionStatus,
      emailVerified: payload.emailVerified,
      twoFactorEnabled: payload.twoFactorEnabled,
      sessionId: payload.sessionId,
      deviceId: payload.deviceId,
      type: 'access'
    };

    return jwt.sign(tokenPayload, this.secret, {
      expiresIn: this.expiresIn,
      issuer: this.issuer,
      audience: this.audience,
      subject: payload.id
    });
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(payload) {
    const tokenPayload = {
      id: payload.id,
      sessionId: payload.sessionId,
      deviceId: payload.deviceId,
      type: 'refresh',
      jti: crypto.randomUUID() // Unique token ID
    };

    return jwt.sign(tokenPayload, this.secret, {
      expiresIn: this.refreshExpiresIn,
      issuer: this.issuer,
      audience: this.audience,
      subject: payload.id
    });
  }

  /**
   * Generate token pair (access + refresh)
   */
  generateTokens(user, sessionId, deviceId = null) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      subscriptionStatus: user.subscriptionStatus,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      sessionId,
      deviceId
    };

    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
      expiresIn: this.parseExpirationTime(this.expiresIn),
      tokenType: 'Bearer'
    };
  }

  /**
   * Verify and decode token
   */
  verifyToken(token, options = {}) {
    try {
      const decoded = jwt.verify(token, this.secret, {
        issuer: this.issuer,
        audience: this.audience,
        ...options
      });

      return {
        success: true,
        payload: decoded,
        expired: false
      };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return {
          success: false,
          payload: null,
          expired: true,
          error: 'Token expired'
        };
      }

      if (error.name === 'JsonWebTokenError') {
        return {
          success: false,
          payload: null,
          expired: false,
          error: 'Invalid token'
        };
      }

      return {
        success: false,
        payload: null,
        expired: false,
        error: error.message
      };
    }
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token) {
    const result = this.verifyToken(token);

    if (result.success && result.payload.type !== 'access') {
      return {
        success: false,
        payload: null,
        expired: false,
        error: 'Invalid token type'
      };
    }

    return result;
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token) {
    const result = this.verifyToken(token);

    if (result.success && result.payload.type !== 'refresh') {
      return {
        success: false,
        payload: null,
        expired: false,
        error: 'Invalid token type'
      };
    }

    return result;
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token) {
    try {
      return jwt.decode(token, { complete: true });
    } catch (error) {
      return null;
    }
  }

  /**
   * Get token expiration date
   */
  getTokenExpiration(token) {
    const decoded = this.decodeToken(token);
    if (decoded && decoded.payload && decoded.payload.exp) {
      return new Date(decoded.payload.exp * 1000);
    }
    return null;
  }

  /**
   * Check if token is expired without verification
   */
  isTokenExpired(token) {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) return true;
    return expiration < new Date();
  }

  /**
   * Generate guest session token
   */
  generateGuestToken(sessionId, deviceId = null) {
    const payload = {
      role: 'guest',
      sessionId,
      deviceId,
      type: 'guest',
      jti: crypto.randomUUID()
    };

    return jwt.sign(payload, this.secret, {
      expiresIn: '7d', // Guest tokens last longer
      issuer: this.issuer,
      audience: this.audience
    });
  }

  /**
   * Generate email verification token
   */
  generateEmailVerificationToken(userId, email) {
    const payload = {
      userId,
      email,
      type: 'email_verification',
      jti: crypto.randomUUID()
    };

    return jwt.sign(payload, this.secret, {
      expiresIn: '24h',
      issuer: this.issuer,
      audience: this.audience,
      subject: userId
    });
  }

  /**
   * Generate password reset token
   */
  generatePasswordResetToken(userId, email) {
    const payload = {
      userId,
      email,
      type: 'password_reset',
      jti: crypto.randomUUID()
    };

    return jwt.sign(payload, this.secret, {
      expiresIn: '10m', // Short expiration for security
      issuer: this.issuer,
      audience: this.audience,
      subject: userId
    });
  }

  /**
   * Generate two-factor authentication token
   */
  generateTwoFactorToken(userId, sessionId) {
    const payload = {
      userId,
      sessionId,
      type: 'two_factor',
      jti: crypto.randomUUID()
    };

    return jwt.sign(payload, this.secret, {
      expiresIn: '5m', // Very short expiration
      issuer: this.issuer,
      audience: this.audience,
      subject: userId
    });
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken, user, sessionId) {
    const verificationResult = this.verifyRefreshToken(refreshToken);

    if (!verificationResult.success) {
      throw new Error('Invalid refresh token');
    }

    const payload = verificationResult.payload;

    // Verify the refresh token belongs to the user and session
    if (payload.id !== user.id || payload.sessionId !== sessionId) {
      throw new Error('Token mismatch');
    }

    // Generate new access token
    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      subscriptionStatus: user.subscriptionStatus,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      sessionId: payload.sessionId,
      deviceId: payload.deviceId
    };

    return {
      accessToken: this.generateAccessToken(tokenPayload),
      expiresIn: this.parseExpirationTime(this.expiresIn),
      tokenType: 'Bearer'
    };
  }

  /**
   * Parse expiration time to seconds
   */
  parseExpirationTime(expiresIn) {
    if (typeof expiresIn === 'number') {
      return expiresIn;
    }

    if (typeof expiresIn === 'string') {
      const units = {
        's': 1,
        'm': 60,
        'h': 3600,
        'd': 86400
      };

      const match = expiresIn.match(/^(\d+)([smhd])$/);
      if (match) {
        return parseInt(match[1]) * units[match[2]];
      }
    }

    return 3600; // Default 1 hour
  }

  /**
   * Get token metadata
   */
  getTokenMetadata(token) {
    const decoded = this.decodeToken(token);
    if (!decoded) {
      return null;
    }

    const payload = decoded.payload;
    const header = decoded.header;

    return {
      algorithm: header.alg,
      type: payload.type,
      userId: payload.id || payload.userId,
      sessionId: payload.sessionId,
      deviceId: payload.deviceId,
      issuedAt: new Date(payload.iat * 1000),
      expiresAt: new Date(payload.exp * 1000),
      issuer: payload.iss,
      audience: payload.aud,
      subject: payload.sub,
      jti: payload.jti
    };
  }

  /**
   * Blacklist token (for logout)
   */
  async blacklistToken(token, redis) {
    try {
      const metadata = this.getTokenMetadata(token);
      if (!metadata) {
        return false;
      }

      const key = `blacklist:${metadata.jti || token}`;
      const ttl = Math.max(0, Math.floor((metadata.expiresAt - new Date()) / 1000));

      if (ttl > 0) {
        await redis.setex(key, ttl, 'blacklisted');
      }

      return true;
    } catch (error) {
      console.error('Failed to blacklist token:', error);
      return false;
    }
  }

  /**
   * Check if token is blacklisted
   */
  async isTokenBlacklisted(token, redis) {
    try {
      const metadata = this.getTokenMetadata(token);
      if (!metadata) {
        return true; // Treat invalid tokens as blacklisted
      }

      const key = `blacklist:${metadata.jti || token}`;
      const result = await redis.get(key);

      return result !== null;
    } catch (error) {
      console.error('Failed to check token blacklist:', error);
      return false; // Fail open for availability
    }
  }
}

module.exports = new JWTService();