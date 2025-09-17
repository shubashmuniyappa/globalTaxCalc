const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');
const redis = require('../utils/redis');

/**
 * JWT Authentication Middleware
 * Validates JWT tokens and extracts user information
 */
const authMiddleware = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No token provided'
      });
    }

    // Check if token is blacklisted
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({
        error: 'Token invalid',
        message: 'Token has been revoked'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, config.JWT_SECRET);

    // Check if user session is still valid
    const userSession = await redis.get(`session:${decoded.id}`);
    if (!userSession) {
      return res.status(401).json({
        error: 'Session expired',
        message: 'Please login again'
      });
    }

    // Attach user info to request
    req.user = decoded;
    req.token = token;

    // Update last activity
    await redis.setex(`session:${decoded.id}`, 86400, JSON.stringify({
      userId: decoded.id,
      lastActivity: new Date().toISOString()
    }));

    next();
  } catch (error) {
    logger.error('Authentication error:', {
      error: error.message,
      path: req.path,
      ip: req.ip
    });

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Please login again'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token is malformed'
      });
    }

    return res.status(500).json({
      error: 'Authentication service error',
      message: 'Unable to verify authentication'
    });
  }
};

/**
 * Optional Authentication Middleware
 * Extracts user information if token is provided, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return next(); // Continue without authentication
    }

    // Check if token is blacklisted
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return next(); // Continue without authentication
    }

    // Verify JWT token
    const decoded = jwt.verify(token, config.JWT_SECRET);

    // Check if user session is still valid
    const userSession = await redis.get(`session:${decoded.id}`);
    if (userSession) {
      req.user = decoded;
      req.token = token;

      // Update last activity
      await redis.setex(`session:${decoded.id}`, 86400, JSON.stringify({
        userId: decoded.id,
        lastActivity: new Date().toISOString()
      }));
    }

    next();
  } catch (error) {
    // Log error but continue without authentication
    logger.warn('Optional auth error:', error.message);
    next();
  }
};

/**
 * API Key Authentication Middleware
 * For server-to-server communication and premium features
 */
const apiKeyAuth = async (req, res, next) => {
  try {
    const apiKey = req.header(config.API_KEY_HEADER);

    if (!apiKey) {
      return res.status(401).json({
        error: 'API key required',
        message: 'X-API-Key header missing'
      });
    }

    // Validate API key against Redis cache or database
    const apiKeyData = await redis.get(`apikey:${apiKey}`);

    if (!apiKeyData) {
      return res.status(401).json({
        error: 'Invalid API key',
        message: 'API key not recognized'
      });
    }

    const keyInfo = JSON.parse(apiKeyData);

    // Check if API key is active
    if (!keyInfo.active) {
      return res.status(401).json({
        error: 'API key inactive',
        message: 'This API key has been deactivated'
      });
    }

    // Check rate limits for this API key
    const keyUsage = await redis.get(`usage:${apiKey}:${Date.now()}`);
    if (keyUsage && parseInt(keyUsage) >= keyInfo.rateLimit) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'API key rate limit reached'
      });
    }

    // Track usage
    const usageKey = `usage:${apiKey}:${Date.now()}`;
    await redis.incr(usageKey);
    await redis.expire(usageKey, 3600); // 1 hour expiry

    req.apiKey = keyInfo;
    req.apiKeyValue = apiKey;

    next();
  } catch (error) {
    logger.error('API key authentication error:', {
      error: error.message,
      path: req.path,
      ip: req.ip
    });

    return res.status(500).json({
      error: 'API key validation error',
      message: 'Unable to validate API key'
    });
  }
};

/**
 * Role-based Authorization Middleware
 */
const requireRole = (requiredRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
    }

    const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.role];
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: `Required roles: ${requiredRoles.join(', ')}`
      });
    }

    next();
  };
};

/**
 * Extract token from request headers
 */
function extractToken(req) {
  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check X-Auth-Token header
  const tokenHeader = req.headers['x-auth-token'];
  if (tokenHeader) {
    return tokenHeader;
  }

  // Check query parameter (not recommended for production)
  if (req.query.token && config.NODE_ENV === 'development') {
    return req.query.token;
  }

  return null;
}

module.exports = {
  authMiddleware,
  optionalAuth,
  apiKeyAuth,
  requireRole
};