const winston = require('winston');
const config = require('../config');

class Logger {
  constructor() {
    this.logger = this.createLogger();
  }

  createLogger() {
    const formats = {
      simple: winston.format.simple(),
      json: winston.format.json(),
      timestamp: winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      errors: winston.format.errors({ stack: true }),
      colorize: winston.format.colorize({ all: true })
    };

    const transports = [];

    // Console transport for development
    if (config.NODE_ENV === 'development') {
      transports.push(
        new winston.transports.Console({
          level: config.LOG_LEVEL || 'debug',
          format: winston.format.combine(
            formats.timestamp,
            formats.errors,
            formats.colorize,
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
              return `${timestamp} [${level}]: ${message} ${metaStr}`;
            })
          )
        })
      );
    }

    // File transports for production
    if (config.NODE_ENV === 'production') {
      // Combined log file
      transports.push(
        new winston.transports.File({
          filename: 'logs/combined.log',
          level: 'info',
          format: winston.format.combine(
            formats.timestamp,
            formats.errors,
            formats.json
          ),
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      );

      // Error log file
      transports.push(
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          format: winston.format.combine(
            formats.timestamp,
            formats.errors,
            formats.json
          ),
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      );

      // Console for production (minimal)
      transports.push(
        new winston.transports.Console({
          level: config.LOG_LEVEL || 'info',
          format: winston.format.combine(
            formats.timestamp,
            winston.format.printf(({ timestamp, level, message }) => {
              return `${timestamp} [${level.toUpperCase()}]: ${message}`;
            })
          )
        })
      );
    }

    return winston.createLogger({
      level: config.LOG_LEVEL || 'info',
      format: winston.format.combine(
        formats.timestamp,
        formats.errors,
        formats.json
      ),
      defaultMeta: {
        service: 'auth-service',
        environment: config.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0'
      },
      transports,
      exitOnError: false
    });
  }

  // Standard logging methods
  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  error(message, error = null, meta = {}) {
    const logMeta = { ...meta };

    if (error instanceof Error) {
      logMeta.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code
      };
    } else if (error) {
      logMeta.error = error;
    }

    this.logger.error(message, logMeta);
  }

  // Auth-specific logging methods
  logAuth(event, userId, sessionId, details = {}) {
    this.info(`Auth event: ${event}`, {
      category: 'auth',
      event,
      userId,
      sessionId,
      ...details
    });
  }

  logSecurity(event, userId, severity = 'medium', details = {}) {
    const logMethod = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';

    this[logMethod](`Security event: ${event}`, {
      category: 'security',
      event,
      userId,
      severity,
      ...details
    });
  }

  logPerformance(operation, duration, details = {}) {
    this.info(`Performance: ${operation} took ${duration}ms`, {
      category: 'performance',
      operation,
      duration,
      ...details
    });
  }

  logDatabase(operation, table, duration, details = {}) {
    this.debug(`Database: ${operation} on ${table} took ${duration}ms`, {
      category: 'database',
      operation,
      table,
      duration,
      ...details
    });
  }

  logAPI(method, path, statusCode, duration, userId = null) {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    this[level](`API: ${method} ${path} - ${statusCode} (${duration}ms)`, {
      category: 'api',
      method,
      path,
      statusCode,
      duration,
      userId
    });
  }

  logExternal(service, operation, success, duration, details = {}) {
    const level = success ? 'info' : 'warn';

    this[level](`External: ${service} ${operation} - ${success ? 'success' : 'failed'} (${duration}ms)`, {
      category: 'external',
      service,
      operation,
      success,
      duration,
      ...details
    });
  }

  // Request logging middleware
  getRequestLogger() {
    return (req, res, next) => {
      const startTime = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const userId = req.user?.id || null;

        this.logAPI(
          req.method,
          req.originalUrl,
          res.statusCode,
          duration,
          userId
        );
      });

      next();
    };
  }

  // Performance monitoring middleware
  getPerformanceLogger() {
    return (req, res, next) => {
      const startTime = process.hrtime.bigint();

      res.on('finish', () => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

        if (duration > 1000) { // Log slow requests (>1s)
          this.logPerformance('slow_request', duration, {
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            userId: req.user?.id
          });
        }
      });

      next();
    };
  }

  // Create child logger with additional context
  child(meta = {}) {
    return {
      debug: (message, additionalMeta = {}) => this.debug(message, { ...meta, ...additionalMeta }),
      info: (message, additionalMeta = {}) => this.info(message, { ...meta, ...additionalMeta }),
      warn: (message, additionalMeta = {}) => this.warn(message, { ...meta, ...additionalMeta }),
      error: (message, error = null, additionalMeta = {}) => this.error(message, error, { ...meta, ...additionalMeta })
    };
  }

  // Stream for Morgan HTTP logging
  getStream() {
    return {
      write: (message) => {
        this.info(message.trim(), { category: 'http' });
      }
    };
  }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger;