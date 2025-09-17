const { body, query, param, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Request ID middleware - adds unique ID to each request
 */
const requestId = (req, res, next) => {
  req.id = uuidv4();
  res.set('X-Request-ID', req.id);
  next();
};

/**
 * Request size limiter
 */
const requestSizeLimiter = (req, res, next) => {
  const contentLength = req.headers['content-length'];

  if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB
    return res.status(413).json({
      error: 'Request too large',
      message: 'Request body exceeds maximum size limit',
      maxSize: '10MB'
    });
  }

  next();
};

/**
 * Input sanitization middleware
 */
const sanitizeInput = (req, res, next) => {
  // Recursively sanitize object properties
  const sanitizeObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        // Remove potential XSS and script injection
        sanitized[key] = value
          .replace(/<script[^>]*>.*?<\/script>/gi, '')
          .replace(/<.*?>/g, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+=/gi, '')
          .trim();
      } else {
        sanitized[key] = sanitizeObject(value);
      }
    }
    return sanitized;
  };

  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
};

/**
 * Validation error handler
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    logger.warn('Validation errors:', {
      errors: errors.array(),
      path: req.path,
      method: req.method,
      ip: req.ip,
      requestId: req.id
    });

    return res.status(400).json({
      error: 'Validation failed',
      message: 'Request contains invalid data',
      details: errors.array().map(error => ({
        field: error.param,
        message: error.msg,
        value: error.value
      })),
      requestId: req.id
    });
  }

  next();
};

/**
 * Common validation rules
 */
const validationRules = {
  // User ID validation
  userId: param('userId')
    .isUUID()
    .withMessage('User ID must be a valid UUID'),

  // Email validation
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid email address'),

  // Password validation
  password: body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),

  // Pagination validation
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Page must be a number between 1 and 1000'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be a number between 1 and 100')
  ],

  // Tax calculation validation
  taxCalculation: [
    body('income')
      .isFloat({ min: 0, max: 999999999 })
      .withMessage('Income must be a positive number'),
    body('country')
      .isLength({ min: 2, max: 3 })
      .matches(/^[A-Z]{2,3}$/)
      .withMessage('Country must be a valid 2-3 letter code'),
    body('year')
      .isInt({ min: 2020, max: new Date().getFullYear() + 1 })
      .withMessage('Year must be valid')
  ],

  // File upload validation
  fileUpload: [
    body('fileName')
      .isLength({ min: 1, max: 255 })
      .matches(/^[a-zA-Z0-9._-]+$/)
      .withMessage('File name contains invalid characters'),
    body('fileSize')
      .isInt({ min: 1, max: 50 * 1024 * 1024 }) // 50MB
      .withMessage('File size must be between 1 byte and 50MB')
  ]
};

/**
 * Rate limiting for different endpoint types
 */
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: 'Rate limit exceeded',
      message: message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return req.user?.id || req.ip;
    }
  });
};

const rateLimiters = {
  // Auth endpoints - stricter limits
  auth: createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    5, // 5 attempts
    'Too many authentication attempts'
  ),

  // Password reset - very strict
  passwordReset: createRateLimiter(
    60 * 60 * 1000, // 1 hour
    3, // 3 attempts
    'Too many password reset attempts'
  ),

  // File upload - moderate limits
  fileUpload: createRateLimiter(
    60 * 1000, // 1 minute
    10, // 10 uploads
    'Too many file uploads'
  ),

  // Tax calculations - higher limits for premium users
  taxCalculation: createRateLimiter(
    60 * 1000, // 1 minute
    50, // 50 calculations
    'Too many tax calculations'
  )
};

/**
 * Slow down middleware for suspicious activity
 */
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 2, // Allow 2 requests per windowMs at full speed
  delayMs: 500, // Add 500ms delay per request after delayAfter
  maxDelayMs: 20000, // Maximum delay of 20 seconds
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  }
});

/**
 * Content type validation
 */
const validateContentType = (allowedTypes) => {
  return (req, res, next) => {
    const contentType = req.headers['content-type'];

    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
        return res.status(415).json({
          error: 'Unsupported content type',
          message: `Content-Type must be one of: ${allowedTypes.join(', ')}`,
          received: contentType || 'none'
        });
      }
    }

    next();
  };
};

/**
 * API version validation
 */
const validateApiVersion = (req, res, next) => {
  const acceptedVersions = ['v1'];
  const versionFromPath = req.path.match(/\/api\/(v\d+)\//);
  const versionFromHeader = req.headers['x-api-version'];

  let version = 'v1'; // default version

  if (versionFromPath) {
    version = versionFromPath[1];
  } else if (versionFromHeader) {
    version = versionFromHeader;
  }

  if (!acceptedVersions.includes(version)) {
    return res.status(400).json({
      error: 'Unsupported API version',
      message: `API version '${version}' is not supported`,
      supportedVersions: acceptedVersions
    });
  }

  req.apiVersion = version;
  next();
};

module.exports = {
  requestId,
  requestSizeLimiter,
  sanitizeInput,
  handleValidationErrors,
  validationRules,
  rateLimiters,
  speedLimiter,
  validateContentType,
  validateApiVersion
};