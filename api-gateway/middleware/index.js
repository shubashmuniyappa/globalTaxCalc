const {
  requestId,
  requestSizeLimiter,
  sanitizeInput,
  handleValidationErrors,
  validationRules,
  rateLimiters,
  speedLimiter,
  validateContentType,
  validateApiVersion
} = require('./validation');

const {
  authMiddleware,
  optionalAuth,
  apiKeyAuth,
  requireRole
} = require('./auth');

const errorHandler = require('./errorHandler');

// Combine all validation middleware into a single pipeline
const validationMiddleware = [
  requestId,
  requestSizeLimiter,
  sanitizeInput,
  validateApiVersion,
  validateContentType(['application/json', 'multipart/form-data', 'application/x-www-form-urlencoded']),
  speedLimiter
];

module.exports = {
  // Validation middleware
  validationMiddleware,
  requestId,
  requestSizeLimiter,
  sanitizeInput,
  handleValidationErrors,
  validationRules,
  rateLimiters,
  speedLimiter,
  validateContentType,
  validateApiVersion,

  // Authentication middleware
  authMiddleware,
  optionalAuth,
  apiKeyAuth,
  requireRole,

  // Error handling
  errorHandler
};