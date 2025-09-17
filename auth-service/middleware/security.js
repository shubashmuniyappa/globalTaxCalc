const crypto = require('crypto');
const { AuditLog } = require('../models');
const config = require('../config');

const securityMiddleware = {
  // CSRF protection
  csrfProtection: (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    const token = req.headers['x-csrf-token'] || req.body._csrf;
    const sessionToken = req.session?.csrfToken;

    if (!token || !sessionToken || token !== sessionToken) {
      return res.status(403).json({
        success: false,
        message: 'Invalid CSRF token'
      });
    }

    next();
  },

  // Input sanitization
  sanitizeInput: (req, res, next) => {
    const sanitize = (obj) => {
      if (typeof obj === 'string') {
        return obj.trim().replace(/[<>]/g, '');
      }
      if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
          obj[key] = sanitize(obj[key]);
        }
      }
      return obj;
    };

    if (req.body) {
      req.body = sanitize(req.body);
    }

    if (req.query) {
      req.query = sanitize(req.query);
    }

    next();
  },

  // Request size limiter
  requestSizeLimiter: (maxSize = '10mb') => {
    return (req, res, next) => {
      const contentLength = parseInt(req.headers['content-length']);
      const maxSizeBytes = parseSize(maxSize);

      if (contentLength && contentLength > maxSizeBytes) {
        return res.status(413).json({
          success: false,
          message: 'Request too large'
        });
      }

      next();
    };
  },

  // Suspicious activity detector
  suspiciousActivityDetector: async (req, res, next) => {
    try {
      const suspiciousPatterns = [
        /(\$|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)/i,
        /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
        /javascript:/gi,
        /data:text\/html/gi,
        /vbscript:/gi,
        /onload|onerror|onclick/gi
      ];

      const checkValue = (value) => {
        if (typeof value === 'string') {
          return suspiciousPatterns.some(pattern => pattern.test(value));
        }
        if (typeof value === 'object' && value !== null) {
          return Object.values(value).some(checkValue);
        }
        return false;
      };

      const isSuspicious = checkValue(req.body) || checkValue(req.query);

      if (isSuspicious) {
        await AuditLog.logSecurityEvent('suspicious_request', req.user?.id, req, {
          body: req.body,
          query: req.query,
          url: req.originalUrl
        });

        return res.status(400).json({
          success: false,
          message: 'Invalid request content'
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  },

  // Request logger for security events
  securityLogger: async (req, res, next) => {
    const originalSend = res.send;
    const originalJson = res.json;
    let responseBody = null;

    res.send = function(body) {
      responseBody = body;
      return originalSend.call(this, body);
    };

    res.json = function(body) {
      responseBody = body;
      return originalJson.call(this, body);
    };

    res.on('finish', async () => {
      try {
        const shouldLog = (
          res.statusCode >= 400 ||
          req.path.includes('/auth/') ||
          req.path.includes('/admin/')
        );

        if (shouldLog) {
          const logData = {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            userAgent: req.get('User-Agent'),
            responseTime: Date.now() - req.startTime
          };

          if (res.statusCode >= 400) {
            logData.errorResponse = responseBody;
          }

          await AuditLog.logSecurityEvent('request_logged', req.user?.id, req, logData);
        }
      } catch (error) {
        console.error('Security logging error:', error);
      }
    });

    next();
  },

  // Rate limit by user ID
  userRateLimit: (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
    const userRequests = new Map();

    return (req, res, next) => {
      const userId = req.user?.id || req.ip;
      const now = Date.now();
      const windowStart = now - windowMs;

      if (!userRequests.has(userId)) {
        userRequests.set(userId, []);
      }

      const requests = userRequests.get(userId);
      const validRequests = requests.filter(time => time > windowStart);

      if (validRequests.length >= maxRequests) {
        return res.status(429).json({
          success: false,
          message: 'Too many requests from this user',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      validRequests.push(now);
      userRequests.set(userId, validRequests);

      next();
    };
  },

  // IP geolocation checker (for suspicious logins)
  geoLocationChecker: async (req, res, next) => {
    try {
      if (!req.user || !config.FEATURES.GEOLOCATION_CHECK) {
        return next();
      }

      const userCountry = req.user.lastKnownCountry;
      const currentIP = req.ip;

      // Skip for local IPs
      if (currentIP.startsWith('127.') || currentIP.startsWith('10.') ||
          currentIP.startsWith('192.168.') || currentIP === '::1') {
        return next();
      }

      // Simple geolocation check (in production, use a proper service)
      if (userCountry && req.headers['cf-ipcountry'] &&
          req.headers['cf-ipcountry'] !== userCountry) {

        await AuditLog.logSecurityEvent('location_anomaly', req.user.id, req, {
          previousCountry: userCountry,
          currentCountry: req.headers['cf-ipcountry'],
          ip: currentIP
        });

        // Don't block, just log for now
      }

      next();
    } catch (error) {
      next(error);
    }
  },

  // Device fingerprint validator
  deviceFingerprintValidator: async (req, res, next) => {
    try {
      if (!req.user || !req.headers['x-device-fingerprint']) {
        return next();
      }

      const fingerprint = req.headers['x-device-fingerprint'];
      const deviceInfo = req.body.deviceInfo || {};

      // Validate fingerprint format (should be a hash)
      if (!/^[a-f0-9]{64}$/i.test(fingerprint)) {
        await AuditLog.logSecurityEvent('invalid_device_fingerprint', req.user.id, req, {
          fingerprint,
          deviceInfo
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  },

  // Password strength enforcer
  passwordStrengthEnforcer: (req, res, next) => {
    const passwordFields = ['password', 'newPassword'];

    for (const field of passwordFields) {
      const password = req.body[field];

      if (password && !isStrongPassword(password)) {
        return res.status(400).json({
          success: false,
          message: 'Password does not meet security requirements',
          requirements: {
            minLength: 8,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSpecialChars: true,
            commonPasswordsBlocked: true
          }
        });
      }
    }

    next();
  },

  // Session security validator
  sessionSecurityValidator: async (req, res, next) => {
    try {
      if (!req.session) {
        return next();
      }

      const session = req.session;
      const now = new Date();

      // Check session expiration
      if (session.expiresAt && new Date(session.expiresAt) < now) {
        return res.status(401).json({
          success: false,
          message: 'Session expired',
          code: 'SESSION_EXPIRED'
        });
      }

      // Check for session hijacking indicators
      const currentUserAgent = req.get('User-Agent');
      const sessionUserAgent = session.userAgent;

      if (sessionUserAgent && currentUserAgent !== sessionUserAgent) {
        await AuditLog.logSecurityEvent('session_hijack_attempt', session.userId, req, {
          sessionUserAgent,
          currentUserAgent,
          sessionId: session.sessionId
        });

        return res.status(401).json({
          success: false,
          message: 'Session security violation',
          code: 'SESSION_SECURITY_VIOLATION'
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  }
};

// Helper functions
function parseSize(sizeStr) {
  const units = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 };
  const match = sizeStr.toLowerCase().match(/^(\d+(?:\.\d+)?)(b|kb|mb|gb)?$/);

  if (!match) return 10 * 1024 * 1024; // Default 10MB

  const size = parseFloat(match[1]);
  const unit = match[2] || 'b';

  return size * units[unit];
}

function isStrongPassword(password) {
  if (!password || password.length < 8) return false;

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[@$!%*?&]/.test(password);

  // Check against common passwords
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123',
    'password123', 'admin', 'letmein', 'welcome', '12345678'
  ];

  const isCommon = commonPasswords.some(common =>
    password.toLowerCase().includes(common)
  );

  return hasUpper && hasLower && hasNumber && hasSpecial && !isCommon;
}

module.exports = securityMiddleware;