const { AuditLog } = require('../models');
const config = require('../config');

class ErrorHandler {
  static async logError(error, req, additionalInfo = {}) {
    try {
      const errorLog = {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        statusCode: error.statusCode || error.status,
        url: req?.originalUrl,
        method: req?.method,
        userAgent: req?.get('User-Agent'),
        ip: req?.ip,
        userId: req?.user?.id,
        requestId: req?.id,
        timestamp: new Date().toISOString(),
        ...additionalInfo
      };

      // Log to audit system
      if (req?.user?.id) {
        await AuditLog.logErrorEvent('application_error', req.user.id, req, errorLog);
      }

      // Log to console in development
      if (config.NODE_ENV === 'development') {
        console.error('Error Details:', errorLog);
      }

      // Log to external service in production (placeholder)
      if (config.NODE_ENV === 'production') {
        // TODO: Send to external logging service (e.g., Sentry, LogRocket)
        console.error(`Error ${req?.id || 'unknown'}:`, error.message);
      }

    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }

  static createErrorResponse(error, req) {
    const isDevelopment = config.NODE_ENV === 'development';
    const statusCode = error.statusCode || error.status || 500;

    const response = {
      success: false,
      message: this.getErrorMessage(error, statusCode),
      error: {
        type: error.name || 'Error',
        code: error.code,
        statusCode
      },
      requestId: req?.id,
      timestamp: new Date().toISOString()
    };

    // Add detailed error info in development
    if (isDevelopment) {
      response.error.stack = error.stack;
      response.error.details = error;
    }

    // Add validation errors if present
    if (error.errors && Array.isArray(error.errors)) {
      response.validation = error.errors.map(err => ({
        field: err.path || err.param,
        message: err.message || err.msg,
        value: err.value,
        location: err.location
      }));
    }

    return response;
  }

  static getErrorMessage(error, statusCode) {
    // Return user-friendly messages for production
    if (config.NODE_ENV === 'production' && statusCode >= 500) {
      return 'An internal server error occurred. Please try again later.';
    }

    // Common error messages
    const errorMessages = {
      400: 'Bad request. Please check your input.',
      401: 'Authentication required.',
      403: 'Access denied.',
      404: 'Resource not found.',
      405: 'Method not allowed.',
      409: 'Resource already exists.',
      422: 'Validation failed.',
      429: 'Too many requests. Please try again later.',
      500: 'Internal server error.',
      502: 'Bad gateway.',
      503: 'Service unavailable.',
      504: 'Gateway timeout.'
    };

    return error.message || errorMessages[statusCode] || 'An error occurred.';
  }

  static async handleDatabaseError(error, req) {
    let statusCode = 500;
    let message = 'Database error occurred';

    switch (error.name) {
      case 'SequelizeValidationError':
        statusCode = 400;
        message = 'Validation error';
        break;

      case 'SequelizeUniqueConstraintError':
        statusCode = 409;
        message = 'Resource already exists';
        break;

      case 'SequelizeForeignKeyConstraintError':
        statusCode = 400;
        message = 'Invalid reference to related resource';
        break;

      case 'SequelizeConnectionError':
      case 'SequelizeConnectionRefusedError':
        statusCode = 503;
        message = 'Database connection failed';
        break;

      case 'SequelizeTimeoutError':
        statusCode = 504;
        message = 'Database operation timed out';
        break;

      case 'SequelizeDatabaseError':
        statusCode = 500;
        message = 'Database operation failed';
        break;
    }

    await this.logError({ ...error, statusCode, message }, req, {
      errorType: 'database',
      originalError: error.original?.message
    });

    return { statusCode, message };
  }

  static async handleAuthenticationError(error, req) {
    let statusCode = 401;
    let message = 'Authentication failed';

    switch (error.name) {
      case 'JsonWebTokenError':
        message = 'Invalid token';
        break;

      case 'TokenExpiredError':
        message = 'Token expired';
        break;

      case 'NotBeforeError':
        message = 'Token not active';
        break;

      default:
        if (error.message.includes('password')) {
          message = 'Invalid credentials';
        } else if (error.message.includes('session')) {
          message = 'Invalid session';
        }
    }

    await this.logError({ ...error, statusCode, message }, req, {
      errorType: 'authentication'
    });

    return { statusCode, message };
  }

  static async handleValidationError(error, req) {
    const statusCode = 422;
    const message = 'Validation failed';

    await this.logError({ ...error, statusCode, message }, req, {
      errorType: 'validation',
      validationErrors: error.errors
    });

    return { statusCode, message };
  }

  static async handleRateLimitError(error, req) {
    const statusCode = 429;
    const message = 'Rate limit exceeded';

    await this.logError({ ...error, statusCode, message }, req, {
      errorType: 'rate_limit',
      limit: error.limit,
      current: error.current,
      remaining: error.remaining,
      resetTime: error.resetTime
    });

    return { statusCode, message };
  }

  static getErrorHandler() {
    return async (error, req, res, next) => {
      try {
        let statusCode = error.statusCode || error.status || 500;
        let message = error.message;

        // Handle specific error types
        if (error.name?.startsWith('Sequelize')) {
          const dbError = await this.handleDatabaseError(error, req);
          statusCode = dbError.statusCode;
          message = dbError.message;
        }
        else if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
          const authError = await this.handleAuthenticationError(error, req);
          statusCode = authError.statusCode;
          message = authError.message;
        }
        else if (error.name === 'ValidationError' || error.errors) {
          const validationError = await this.handleValidationError(error, req);
          statusCode = validationError.statusCode;
          message = validationError.message;
        }
        else if (error.status === 429 || error.message?.includes('rate limit')) {
          const rateLimitError = await this.handleRateLimitError(error, req);
          statusCode = rateLimitError.statusCode;
          message = rateLimitError.message;
        }
        else {
          // Log unhandled errors
          await this.logError(error, req, { errorType: 'unhandled' });
        }

        // Create error response
        const errorResponse = this.createErrorResponse(
          { ...error, statusCode, message },
          req
        );

        // Set security headers for error responses
        res.set({
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'X-XSS-Protection': '1; mode=block'
        });

        res.status(statusCode).json(errorResponse);

      } catch (handlerError) {
        console.error('Error handler failed:', handlerError);

        // Fallback error response
        res.status(500).json({
          success: false,
          message: 'An unexpected error occurred',
          requestId: req?.id,
          timestamp: new Date().toISOString()
        });
      }
    };
  }

  static getNotFoundHandler() {
    return (req, res) => {
      const response = {
        success: false,
        message: 'Endpoint not found',
        error: {
          type: 'NotFound',
          statusCode: 404
        },
        path: req.originalUrl,
        method: req.method,
        requestId: req.id,
        timestamp: new Date().toISOString()
      };

      res.status(404).json(response);
    };
  }

  static getAsyncWrapper() {
    return (fn) => {
      return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
      };
    };
  }
}

module.exports = ErrorHandler;