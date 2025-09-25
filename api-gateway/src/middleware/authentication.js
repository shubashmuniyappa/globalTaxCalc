/**
 * Authentication and Authorization Middleware
 * Comprehensive security for the API Gateway
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const { promisify } = require('util');

class AuthenticationManager {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    this.apiKeyPrefix = process.env.API_KEY_PREFIX || 'gtc_';
    this.refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY || '7d';
    this.accessTokenExpiry = process.env.ACCESS_TOKEN_EXPIRY || '1h';

    // In-memory cache for API keys (should be Redis in production)
    this.apiKeyCache = new Map();
    this.blacklistedTokens = new Set();

    this.initializeRateLimits();
  }

  initializeRateLimits() {
    // Different rate limits for different authentication methods
    this.rateLimits = {
      // API Key authentication - higher limits for paid users
      apiKey: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: (req) => {
          const apiKeyInfo = req.apiKeyInfo;
          switch (apiKeyInfo?.tier) {
            case 'enterprise': return 10000;
            case 'professional': return 5000;
            case 'basic': return 1000;
            default: return 100;
          }
        },
        message: 'API rate limit exceeded',
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => req.apiKey || req.ip
      }),

      // JWT authentication - standard limits
      jwt: rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 1000,
        message: 'Too many requests from this user',
        keyGenerator: (req) => req.user?.id || req.ip
      }),

      // Anonymous requests - very limited
      anonymous: rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 50,
        message: 'Too many anonymous requests'
      })
    };

    // Slow down middleware for suspicious activity
    this.slowDown = slowDown({
      windowMs: 15 * 60 * 1000,
      delayAfter: 10,
      delayMs: 500,
      maxDelayMs: 20000
    });
  }

  // Generate API key
  generateApiKey(userId, tier = 'basic', permissions = []) {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(16).toString('hex');
    const apiKey = `${this.apiKeyPrefix}${timestamp}_${random}`;

    const keyInfo = {
      key: apiKey,
      userId,
      tier,
      permissions,
      createdAt: new Date(),
      lastUsed: null,
      requestCount: 0,
      isActive: true
    };

    this.apiKeyCache.set(apiKey, keyInfo);
    return keyInfo;
  }

  // Validate API key
  async validateApiKey(apiKey) {
    // Check cache first
    let keyInfo = this.apiKeyCache.get(apiKey);

    if (!keyInfo) {
      // In production, this would query the database
      keyInfo = await this.fetchApiKeyFromDatabase(apiKey);
      if (keyInfo) {
        this.apiKeyCache.set(apiKey, keyInfo);
      }
    }

    if (!keyInfo || !keyInfo.isActive) {
      return null;
    }

    // Update usage statistics
    keyInfo.lastUsed = new Date();
    keyInfo.requestCount++;

    return keyInfo;
  }

  // Mock database fetch (replace with actual DB query)
  async fetchApiKeyFromDatabase(apiKey) {
    // This would be a real database query in production
    return null;
  }

  // JWT token generation
  generateTokens(user) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions || []
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.accessTokenExpiry,
      issuer: 'globaltaxcalc-api',
      audience: 'globaltaxcalc-users'
    });

    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      this.jwtSecret,
      { expiresIn: this.refreshTokenExpiry }
    );

    return { accessToken, refreshToken };
  }

  // Verify JWT token
  async verifyToken(token) {
    try {
      if (this.blacklistedTokens.has(token)) {
        throw new Error('Token is blacklisted');
      }

      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'globaltaxcalc-api',
        audience: 'globaltaxcalc-users'
      });

      return decoded;
    } catch (error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  // Blacklist token (for logout)
  blacklistToken(token) {
    this.blacklistedTokens.add(token);

    // Clean up old blacklisted tokens periodically
    if (this.blacklistedTokens.size > 10000) {
      this.cleanupBlacklistedTokens();
    }
  }

  // Clean up expired blacklisted tokens
  cleanupBlacklistedTokens() {
    const tokensToRemove = [];

    for (const token of this.blacklistedTokens) {
      try {
        jwt.verify(token, this.jwtSecret, { ignoreExpiration: false });
      } catch (error) {
        if (error.name === 'TokenExpiredError') {
          tokensToRemove.push(token);
        }
      }
    }

    tokensToRemove.forEach(token => this.blacklistedTokens.delete(token));
  }

  // Main authentication middleware
  authenticate(options = {}) {
    const {
      required = true,
      allowApiKey = true,
      allowJWT = true,
      requiredPermissions = [],
      requiredRole = null
    } = options;

    return async (req, res, next) => {
      try {
        let authResult = null;

        // Try API Key authentication first
        if (allowApiKey && req.headers['x-api-key']) {
          authResult = await this.authenticateWithApiKey(req);
        }

        // Try JWT authentication if API key failed
        if (!authResult && allowJWT && req.headers.authorization) {
          authResult = await this.authenticateWithJWT(req);
        }

        if (!authResult && required) {
          return res.status(401).json({
            error: 'Authentication required',
            message: 'Please provide a valid API key or JWT token'
          });
        }

        if (authResult) {
          req.user = authResult.user;
          req.authMethod = authResult.method;
          req.apiKeyInfo = authResult.apiKeyInfo;

          // Check permissions
          if (requiredPermissions.length > 0) {
            const hasPermission = this.checkPermissions(authResult.user, requiredPermissions);
            if (!hasPermission) {
              return res.status(403).json({
                error: 'Insufficient permissions',
                required: requiredPermissions
              });
            }
          }

          // Check role
          if (requiredRole && authResult.user.role !== requiredRole) {
            return res.status(403).json({
              error: 'Insufficient role',
              required: requiredRole,
              current: authResult.user.role
            });
          }

          // Apply appropriate rate limiting
          const rateLimitMiddleware = this.rateLimits[authResult.method] || this.rateLimits.anonymous;
          return rateLimitMiddleware(req, res, next);
        }

        // No authentication provided, apply anonymous rate limiting
        return this.rateLimits.anonymous(req, res, next);

      } catch (error) {
        console.error('Authentication error:', error);
        return res.status(401).json({
          error: 'Authentication failed',
          message: error.message
        });
      }
    };
  }

  // Authenticate with API key
  async authenticateWithApiKey(req) {
    const apiKey = req.headers['x-api-key'];
    const keyInfo = await this.validateApiKey(apiKey);

    if (!keyInfo) {
      throw new Error('Invalid API key');
    }

    // Mock user lookup (replace with actual user service call)
    const user = await this.getUserById(keyInfo.userId);
    if (!user) {
      throw new Error('User not found for API key');
    }

    return {
      user: {
        ...user,
        permissions: keyInfo.permissions
      },
      method: 'apiKey',
      apiKeyInfo: keyInfo
    };
  }

  // Authenticate with JWT
  async authenticateWithJWT(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Invalid authorization header format');
    }

    const token = authHeader.substring(7);
    const decoded = await this.verifyToken(token);

    return {
      user: decoded,
      method: 'jwt',
      token
    };
  }

  // Mock user lookup (replace with actual user service)
  async getUserById(userId) {
    // This would be a real user service call in production
    return {
      id: userId,
      email: 'user@example.com',
      role: 'user',
      permissions: ['read', 'write']
    };
  }

  // Check permissions
  checkPermissions(user, requiredPermissions) {
    if (!user.permissions || !Array.isArray(user.permissions)) {
      return false;
    }

    return requiredPermissions.every(permission =>
      user.permissions.includes(permission) || user.permissions.includes('*')
    );
  }

  // Role-based access control
  requireRole(role) {
    return this.authenticate({ required: true, requiredRole: role });
  }

  // Permission-based access control
  requirePermissions(...permissions) {
    return this.authenticate({ required: true, requiredPermissions: permissions });
  }

  // Admin-only middleware
  requireAdmin() {
    return this.requireRole('admin');
  }

  // Optional authentication (for public endpoints with enhanced features for authenticated users)
  optionalAuth() {
    return this.authenticate({ required: false });
  }

  // Security headers middleware
  securityHeaders() {
    return (req, res, next) => {
      res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Content-Security-Policy': "default-src 'self'",
        'X-Permitted-Cross-Domain-Policies': 'none'
      });
      next();
    };
  }

  // Request signing for webhooks
  verifyWebhookSignature(secret) {
    return (req, res, next) => {
      const signature = req.headers['x-webhook-signature'];
      if (!signature) {
        return res.status(401).json({ error: 'Missing webhook signature' });
      }

      const body = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');

      if (signature !== `sha256=${expectedSignature}`) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      next();
    };
  }

  // Session management
  async refreshTokens(refreshToken) {
    try {
      const decoded = await this.verifyToken(refreshToken);

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid refresh token');
      }

      // Get user and generate new tokens
      const user = await this.getUserById(decoded.id);
      if (!user) {
        throw new Error('User not found');
      }

      // Blacklist old refresh token
      this.blacklistToken(refreshToken);

      return this.generateTokens(user);
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  // API key rotation
  async rotateApiKey(oldApiKey) {
    const keyInfo = await this.validateApiKey(oldApiKey);
    if (!keyInfo) {
      throw new Error('Invalid API key');
    }

    // Deactivate old key
    keyInfo.isActive = false;

    // Generate new key
    const newKeyInfo = this.generateApiKey(
      keyInfo.userId,
      keyInfo.tier,
      keyInfo.permissions
    );

    return newKeyInfo;
  }
}

// Create singleton instance
const authManager = new AuthenticationManager();

module.exports = {
  AuthenticationManager,
  authManager,
  authenticate: authManager.authenticate.bind(authManager),
  requireRole: authManager.requireRole.bind(authManager),
  requirePermissions: authManager.requirePermissions.bind(authManager),
  requireAdmin: authManager.requireAdmin.bind(authManager),
  optionalAuth: authManager.optionalAuth.bind(authManager),
  securityHeaders: authManager.securityHeaders.bind(authManager),
  verifyWebhookSignature: authManager.verifyWebhookSignature.bind(authManager)
};