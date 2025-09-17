const logger = require('../utils/logger');
const config = require('../config');

/**
 * Custom Error Classes
 */
class AppError extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

class ServiceUnavailableError extends AppError {
  constructor(service, message = 'Service temporarily unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE');
    this.service = service;
  }
}

class RateLimitError extends AppError {
  constructor(retryAfter = 60) {
    super('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED');
    this.retryAfter = retryAfter;
  }
}

/**
 * Error type handlers
 */
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400, 'INVALID_DATA');
};

const handleDuplicateFieldsDB = (err) => {
  const value = err.message.match(/(["'])(\\?.)*?\1/)?.[0];
  const message = `Duplicate field value: ${value}. Please use another value.`;
  return new AppError(message, 400, 'DUPLICATE_FIELD');
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new ValidationError(message, errors);
};

const handleJWTError = () =>
  new AuthenticationError('Invalid token. Please log in again.');

const handleJWTExpiredError = () =>
  new AuthenticationError('Your token has expired. Please log in again.');

const handleMulterError = (err) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return new AppError('File too large', 413, 'FILE_TOO_LARGE');
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return new AppError('Too many files', 413, 'TOO_MANY_FILES');
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return new AppError('Unexpected file field', 400, 'UNEXPECTED_FILE');
  }
  return new AppError('File upload error', 400, 'FILE_UPLOAD_ERROR');
};

/**
 * Development error response
 */
const sendErrorDev = (err, req, res) => {
  logger.error('Error details:', {
    error: err.message,
    stack: err.stack,
    requestId: req.id,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(err.statusCode).json({
    status: err.status,
    error: err.message,
    stack: err.stack,
    code: err.code,
    details: err.details,
    requestId: req.id,
    timestamp: new Date().toISOString()
  });
};

/**
 * Production error response
 */
const sendErrorProd = (err, req, res) => {
  // Log error for monitoring
  logger.error('Production error:', {
    error: err.message,
    statusCode: err.statusCode,
    code: err.code,
    requestId: req.id,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    stack: err.isOperational ? null : err.stack
  });

  // Operational, trusted error: send message to client
  if (err.isOperational) {
    const response = {
      status: err.status,
      message: err.message,
      code: err.code,
      requestId: req.id,
      timestamp: new Date().toISOString()
    };

    // Add extra details for specific error types
    if (err instanceof ValidationError && err.details) {
      response.details = err.details;
    }

    if (err instanceof ServiceUnavailableError && err.service) {
      response.service = err.service;
    }

    if (err instanceof RateLimitError) {
      res.set('Retry-After', err.retryAfter);
      response.retryAfter = err.retryAfter;
    }

    return res.status(err.statusCode).json(response);
  }

  // Programming or unknown error: don't leak error details
  logger.error('Unknown error occurred:', err);

  res.status(500).json({
    status: 'error',
    message: 'Something went wrong on our end',
    code: 'INTERNAL_SERVER_ERROR',
    requestId: req.id,
    timestamp: new Date().toISOString()
  });
};

/**
 * Async error handler wrapper
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Handle unhandled promise rejections
 */
process.on('unhandledRejection', (err, promise) => {
  logger.error('Unhandled Promise Rejection:', {
    error: err.message,
    stack: err.stack,
    promise: promise
  });

  // Close server gracefully
  process.exit(1);
});

/**
 * Handle uncaught exceptions
 */
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', {
    error: err.message,
    stack: err.stack
  });

  // Exit immediately as the process is in an undefined state
  process.exit(1);
});

/**
 * Main error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Mongoose bad ObjectId
  if (err.name === 'CastError') error = handleCastErrorDB(error);

  // Mongoose duplicate key
  if (err.code === 11000) error = handleDuplicateFieldsDB(error);

  // Mongoose validation error
  if (err.name === 'ValidationError') error = handleValidationErrorDB(error);

  // JWT errors
  if (err.name === 'JsonWebTokenError') error = handleJWTError();
  if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

  // Multer errors
  if (err.name === 'MulterError') error = handleMulterError(error);

  // CORS errors
  if (err.message && err.message.includes('CORS')) {
    error = new AppError('CORS policy violation', 403, 'CORS_ERROR');
  }

  // Timeout errors
  if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
    error = new ServiceUnavailableError('upstream', 'Request timeout');
  }

  // Network errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    error = new ServiceUnavailableError('upstream', 'Service connection failed');
  }

  // Set default status code if not set
  if (!error.statusCode) {
    error.statusCode = 500;
    error.status = 'error';
    error.isOperational = false;
  }

  // Send error response
  if (config.NODE_ENV === 'development') {
    sendErrorDev(error, req, res);
  } else {
    sendErrorProd(error, req, res);
  }
};

/**
 * 404 handler for unknown routes
 */
const notFoundHandler = (req, res, next) => {
  const err = new AppError(`Can't find ${req.originalUrl} on this server`, 404, 'NOT_FOUND');
  next(err);
};

module.exports = {
  errorHandler,
  notFoundHandler,
  catchAsync,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ServiceUnavailableError,
  RateLimitError
};