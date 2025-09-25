/**
 * Comprehensive Security Middleware
 * Implements API key management, JWT validation, request signing, and protection against common attacks
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const { body, validationResult, param, query } = require('express-validator');
const xss = require('xss');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/security.log' })
  ]
});

class SecurityManager {
  constructor(redisClient) {
    this.redisClient = redisClient;
    this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret';
    this.apiKeySecret = process.env.API_KEY_SECRET || 'your-api-key-secret';

    // API Key storage
    this.apiKeys = new Map();
    this.revokedTokens = new Set();

    // Initialize security configurations
    this.initializeAPIKeys();
    this.initializeSecurityHeaders();
  }

  /**
   * Initialize API keys from environment or database
   */
  async initializeAPIKeys() {
    // Load API keys from Redis or database
    try {
      if (this.redisClient) {
        const apiKeyData = await this.redisClient.hgetall('api_keys');
        Object.entries(apiKeyData).forEach(([keyId, keyData]) => {
          this.apiKeys.set(keyId, JSON.parse(keyData));
        });
      }

      // Add default API keys if none exist
      if (this.apiKeys.size === 0) {
        await this.createDefaultAPIKeys();
      }
    } catch (error) {
      logger.error('Error initializing API keys', error);
    }
  }

  /**
   * Create default API keys for development
   */
  async createDefaultAPIKeys() {
    const defaultKeys = [
      {
        name: 'development',
        scopes: ['read', 'write'],
        tier: 'premium',
        rateLimit: 1000
      },
      {
        name: 'mobile-app',
        scopes: ['read', 'calculate'],
        tier: 'basic',
        rateLimit: 500
      },
      {
        name: 'web-app',
        scopes: ['read', 'write', 'calculate', 'export'],
        tier: 'premium',
        rateLimit: 2000
      }
    ];

    for (const keyConfig of defaultKeys) {
      await this.generateAPIKey(keyConfig);
    }
  }

  /**
   * Configure security headers using Helmet
   */
  initializeSecurityHeaders() {
    this.helmetConfig = helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", "https://api.globaltaxcalc.com"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"]
        }
      },
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: "cross-origin" },
      crossOriginResourcePolicy: { policy: "cross-origin" },
      referrerPolicy: { policy: "no-referrer" },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      },
      noSniff: true,
      xssFilter: true,
      frameguard: { action: 'deny' }
    });
  }

  /**
   * Main security middleware pipeline
   */
  securityMiddleware() {
    return [
      // Basic security headers
      this.helmetConfig,

      // Sanitize MongoDB queries
      mongoSanitize(),

      // Prevent HTTP Parameter Pollution
      hpp(),

      // Custom security middleware
      this.customSecurityMiddleware(),

      // Input validation and sanitization
      this.inputSanitization(),

      // DDoS protection
      this.ddosProtection()
    ];
  }

  /**
   * Custom security middleware
   */
  customSecurityMiddleware() {
    return (req, res, next) => {
      // Add security headers
      res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        'Referrer-Policy': 'no-referrer',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
        'X-Permitted-Cross-Domain-Policies': 'none'
      });

      // Remove sensitive headers
      res.removeHeader('X-Powered-By');
      res.removeHeader('Server');

      // Generate request ID for tracking
      req.requestId = crypto.randomUUID();
      res.set('X-Request-ID', req.requestId);

      next();
    };
  }

  /**
   * Input sanitization middleware
   */
  inputSanitization() {
    return (req, res, next) => {
      // Sanitize request body
      if (req.body && typeof req.body === 'object') {
        req.body = this.sanitizeObject(req.body);
      }

      // Sanitize query parameters
      if (req.query && typeof req.query === 'object') {
        req.query = this.sanitizeObject(req.query);
      }

      // Sanitize URL parameters
      if (req.params && typeof req.params === 'object') {
        req.params = this.sanitizeObject(req.params);
      }

      next();
    };
  }

  /**
   * Sanitize object recursively
   */
  sanitizeObject(obj) {
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    if (obj && typeof obj === 'object') {
      const sanitized = {};
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        if (typeof value === 'string') {
          // XSS protection
          sanitized[key] = xss(value);
          // SQL injection protection (basic)
          sanitized[key] = sanitized[key].replace(/['";\\]/g, '');
        } else if (value && typeof value === 'object') {
          sanitized[key] = this.sanitizeObject(value);
        } else {
          sanitized[key] = value;
        }
      });
      return sanitized;
    }

    return obj;
  }

  /**
   * DDoS protection middleware
   */
  ddosProtection() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // Limit each IP to 1000 requests per windowMs
      message: {
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many requests from this IP, please try again later'
        }
      },
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        // Skip rate limiting for whitelisted IPs
        const whitelistedIPs = process.env.WHITELISTED_IPS?.split(',') || [];
        return whitelistedIPs.includes(req.ip);
      }
    });
  }

  /**
   * API Key authentication middleware
   */
  apiKeyAuth() {
    return async (req, res, next) => {
      try {
        const apiKey = req.headers['x-api-key'] || req.query.apiKey;

        if (!apiKey) {
          return res.status(401).json({
            error: {
              code: 'MISSING_API_KEY',
              message: 'API key is required'
            }
          });
        }

        // Validate API key
        const keyData = await this.validateAPIKey(apiKey);
        if (!keyData) {
          return res.status(401).json({
            error: {
              code: 'INVALID_API_KEY',
              message: 'Invalid API key'
            }
          });
        }

        // Check if API key is active
        if (!keyData.active) {
          return res.status(401).json({
            error: {
              code: 'INACTIVE_API_KEY',
              message: 'API key is inactive'
            }
          });
        }

        // Check API key expiration
        if (keyData.expiresAt && new Date() > new Date(keyData.expiresAt)) {
          return res.status(401).json({
            error: {
              code: 'EXPIRED_API_KEY',
              message: 'API key has expired'
            }
          });
        }

        // Attach API key data to request
        req.apiKey = keyData;
        req.user = { tier: keyData.tier, scopes: keyData.scopes };

        // Log API key usage
        this.logAPIKeyUsage(keyData.id, req);

        next();
      } catch (error) {
        logger.error('API key authentication error', error);
        res.status(500).json({
          error: {
            code: 'AUTHENTICATION_ERROR',
            message: 'Error during authentication'
          }
        });
      }
    };
  }

  /**
   * JWT authentication middleware
   */
  jwtAuth() {
    return async (req, res, next) => {
      try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

        if (!token) {
          return res.status(401).json({
            error: {
              code: 'MISSING_TOKEN',
              message: 'JWT token is required'
            }
          });
        }

        // Check if token is revoked
        if (this.revokedTokens.has(token)) {
          return res.status(401).json({
            error: {
              code: 'REVOKED_TOKEN',
              message: 'Token has been revoked'
            }
          });
        }

        // Verify JWT token
        const decoded = jwt.verify(token, this.jwtSecret);

        // Check token expiration
        if (decoded.exp < Date.now() / 1000) {
          return res.status(401).json({
            error: {
              code: 'EXPIRED_TOKEN',
              message: 'Token has expired'
            }
          });
        }

        // Attach user data to request
        req.user = decoded;
        req.token = token;

        // Log token usage
        this.logTokenUsage(decoded.sub, req);

        next();
      } catch (error) {
        if (error.name === 'JsonWebTokenError') {
          return res.status(401).json({
            error: {
              code: 'INVALID_TOKEN',
              message: 'Invalid JWT token'
            }
          });
        }

        logger.error('JWT authentication error', error);
        res.status(500).json({
          error: {
            code: 'AUTHENTICATION_ERROR',
            message: 'Error during authentication'
          }
        });
      }
    };
  }

  /**
   * Request signature verification middleware
   */
  signatureVerification() {
    return (req, res, next) => {
      try {
        const signature = req.headers['x-signature'];
        const timestamp = req.headers['x-timestamp'];

        if (!signature || !timestamp) {
          return res.status(401).json({
            error: {
              code: 'MISSING_SIGNATURE',
              message: 'Request signature is required'
            }
          });
        }

        // Check timestamp (prevent replay attacks)
        const requestTime = parseInt(timestamp);
        const currentTime = Date.now();
        const maxAge = 5 * 60 * 1000; // 5 minutes

        if (Math.abs(currentTime - requestTime) > maxAge) {
          return res.status(401).json({
            error: {
              code: 'EXPIRED_REQUEST',
              message: 'Request timestamp is too old'
            }
          });
        }

        // Verify signature
        const payload = JSON.stringify(req.body) + timestamp;
        const expectedSignature = crypto
          .createHmac('sha256', this.apiKeySecret)
          .update(payload)
          .digest('hex');

        if (signature !== expectedSignature) {
          return res.status(401).json({
            error: {
              code: 'INVALID_SIGNATURE',
              message: 'Request signature is invalid'
            }
          });
        }

        next();
      } catch (error) {
        logger.error('Signature verification error', error);
        res.status(500).json({
          error: {
            code: 'SIGNATURE_ERROR',
            message: 'Error verifying request signature'
          }
        });
      }
    };
  }

  /**
   * Generate new API key
   */
  async generateAPIKey(config) {
    const keyId = crypto.randomUUID();
    const keySecret = crypto.randomBytes(32).toString('hex');
    const hashedSecret = await bcrypt.hash(keySecret, 12);

    const apiKey = {
      id: keyId,
      name: config.name,
      secret: hashedSecret,
      scopes: config.scopes || ['read'],
      tier: config.tier || 'basic',
      rateLimit: config.rateLimit || 100,
      active: true,
      createdAt: new Date().toISOString(),
      expiresAt: config.expiresAt || null,
      lastUsed: null,
      usageCount: 0
    };

    // Store API key
    this.apiKeys.set(keyId, apiKey);

    if (this.redisClient) {
      await this.redisClient.hset('api_keys', keyId, JSON.stringify(apiKey));
    }

    logger.info(`API key generated: ${keyId} for ${config.name}`);

    return {
      keyId,
      keySecret: `${keyId}.${keySecret}`,
      ...apiKey
    };
  }

  /**
   * Validate API key
   */
  async validateAPIKey(providedKey) {
    try {
      const [keyId, keySecret] = providedKey.split('.');

      if (!keyId || !keySecret) {
        return null;
      }

      const keyData = this.apiKeys.get(keyId);
      if (!keyData) {
        return null;
      }

      // Verify secret
      const isValid = await bcrypt.compare(keySecret, keyData.secret);
      if (!isValid) {
        return null;
      }

      return keyData;
    } catch (error) {
      logger.error('API key validation error', error);
      return null;
    }
  }

  /**
   * Revoke API key
   */
  async revokeAPIKey(keyId) {
    const keyData = this.apiKeys.get(keyId);
    if (keyData) {
      keyData.active = false;
      keyData.revokedAt = new Date().toISOString();

      this.apiKeys.set(keyId, keyData);

      if (this.redisClient) {
        await this.redisClient.hset('api_keys', keyId, JSON.stringify(keyData));
      }

      logger.info(`API key revoked: ${keyId}`);
      return true;
    }

    return false;
  }

  /**
   * Generate JWT token
   */
  generateJWTToken(payload, expiresIn = '1h') {
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn,
      issuer: 'globaltaxcalc-api',
      audience: 'globaltaxcalc-clients'
    });
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(payload) {
    return jwt.sign(payload, this.jwtRefreshSecret, {
      expiresIn: '30d',
      issuer: 'globaltaxcalc-api',
      audience: 'globaltaxcalc-clients'
    });
  }

  /**
   * Refresh JWT token
   */
  async refreshJWTToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, this.jwtRefreshSecret);

      // Generate new access token
      const newPayload = {
        sub: decoded.sub,
        email: decoded.email,
        role: decoded.role,
        scopes: decoded.scopes
      };

      const newAccessToken = this.generateJWTToken(newPayload);
      const newRefreshToken = this.generateRefreshToken(newPayload);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 3600
      };
    } catch (error) {
      logger.error('Token refresh error', error);
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Revoke JWT token
   */
  async revokeJWTToken(token) {
    this.revokedTokens.add(token);

    // Store in Redis with expiration
    if (this.redisClient) {
      const decoded = jwt.decode(token);
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);

      if (ttl > 0) {
        await this.redisClient.setex(`revoked_token:${token}`, ttl, '1');
      }
    }

    logger.info('JWT token revoked');
  }

  /**
   * Scope-based authorization middleware
   */
  requireScopes(requiredScopes) {
    return (req, res, next) => {
      const userScopes = req.user?.scopes || req.apiKey?.scopes || [];

      const hasRequiredScopes = requiredScopes.every(scope =>
        userScopes.includes(scope) || userScopes.includes('admin')
      );

      if (!hasRequiredScopes) {
        return res.status(403).json({
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: `Required scopes: ${requiredScopes.join(', ')}`,
            userScopes
          }
        });
      }

      next();
    };
  }

  /**
   * Input validation rules
   */
  getValidationRules(endpoint) {
    const rules = {
      'POST /api/v*/auth/login': [
        body('email').isEmail().normalizeEmail(),
        body('password').isLength({ min: 6 }).escape()
      ],
      'POST /api/v*/auth/register': [
        body('email').isEmail().normalizeEmail(),
        body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
        body('firstName').isLength({ min: 1 }).escape(),
        body('lastName').isLength({ min: 1 }).escape()
      ],
      'POST /api/v*/calculate': [
        body('income').isNumeric().toFloat(),
        body('taxYear').isInt({ min: 2000, max: 2030 }),
        body('filingStatus').isIn(['single', 'married', 'head-of-household'])
      ],
      'GET /api/v*/users/:id': [
        param('id').isUUID()
      ],
      'GET /api/v*/reports': [
        query('startDate').isISO8601(),
        query('endDate').isISO8601(),
        query('limit').optional().isInt({ min: 1, max: 1000 })
      ]
    };

    return rules[endpoint] || [];
  }

  /**
   * Validation middleware
   */
  validate(endpoint) {
    return [
      ...this.getValidationRules(endpoint),
      (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Request validation failed',
              details: errors.array()
            }
          });
        }
        next();
      }
    ];
  }

  /**
   * Log API key usage
   */
  async logAPIKeyUsage(keyId, req) {
    try {
      const usage = {
        keyId,
        timestamp: new Date().toISOString(),
        endpoint: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      };

      // Update usage count
      const keyData = this.apiKeys.get(keyId);
      if (keyData) {
        keyData.usageCount++;
        keyData.lastUsed = usage.timestamp;
        this.apiKeys.set(keyId, keyData);

        if (this.redisClient) {
          await this.redisClient.hset('api_keys', keyId, JSON.stringify(keyData));
        }
      }

      // Store usage log
      if (this.redisClient) {
        await this.redisClient.lpush(`api_key_usage:${keyId}`, JSON.stringify(usage));
        await this.redisClient.ltrim(`api_key_usage:${keyId}`, 0, 999); // Keep last 1000 entries
      }
    } catch (error) {
      logger.error('Error logging API key usage', error);
    }
  }

  /**
   * Log token usage
   */
  async logTokenUsage(userId, req) {
    try {
      const usage = {
        userId,
        timestamp: new Date().toISOString(),
        endpoint: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      };

      if (this.redisClient) {
        await this.redisClient.lpush(`token_usage:${userId}`, JSON.stringify(usage));
        await this.redisClient.ltrim(`token_usage:${userId}`, 0, 999);
      }
    } catch (error) {
      logger.error('Error logging token usage', error);
    }
  }

  /**
   * Get security statistics
   */
  async getSecurityStats() {
    try {
      const stats = {
        totalAPIKeys: this.apiKeys.size,
        activeAPIKeys: Array.from(this.apiKeys.values()).filter(key => key.active).length,
        revokedTokens: this.revokedTokens.size
      };

      if (this.redisClient) {
        const usageKeys = await this.redisClient.keys('api_key_usage:*');
        stats.totalAPIUsage = usageKeys.length;
      }

      return stats;
    } catch (error) {
      logger.error('Error getting security stats', error);
      return {};
    }
  }
}

// Create singleton instance
let securityManagerInstance;

function createSecurityManager(redisClient) {
  if (!securityManagerInstance) {
    securityManagerInstance = new SecurityManager(redisClient);
  }
  return securityManagerInstance;
}

module.exports = {
  SecurityManager,
  createSecurityManager
};