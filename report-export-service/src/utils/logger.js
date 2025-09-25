const winston = require('winston');
const path = require('path');
const config = require('../config');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

winston.addColors(colors);

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, service, userId, reportId, ...meta }) => {
    let logMessage = `${timestamp} [${level}]`;

    if (service) logMessage += ` [${service}]`;
    if (userId) logMessage += ` [User:${userId}]`;
    if (reportId) logMessage += ` [Report:${reportId}]`;

    logMessage += `: ${message}`;

    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta)}`;
    }

    return logMessage;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create the logger
const logger = winston.createLogger({
  level: config.logging.level,
  levels,
  defaultMeta: { service: 'report-export-service' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat,
      silent: config.server.env === 'test'
    }),

    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),

    // File transport for error logs only
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),

    // File transport for report generation logs
    new winston.transports.File({
      filename: path.join(logsDir, 'reports.log'),
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 3,
      tailable: true,
      // Only log messages with reportId metadata
      filter: (info) => info.reportId !== undefined
    })
  ]
});

// Add request logging transport for HTTP requests
if (config.logging.enableMetrics) {
  logger.add(
    new winston.transports.File({
      filename: path.join(logsDir, 'access.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, method, url, status, responseTime, userAgent, ip }) => {
          if (method && url) {
            return `${timestamp} ${ip} "${method} ${url}" ${status} ${responseTime}ms "${userAgent}"`;
          }
          return `${timestamp} [${level}]: ${message}`;
        })
      ),
      // Only log HTTP requests
      filter: (info) => info.method !== undefined
    })
  );
}

// Helper functions for structured logging
const createLoggerWithContext = (context = {}) => {
  return {
    error: (message, meta = {}) => logger.error(message, { ...context, ...meta }),
    warn: (message, meta = {}) => logger.warn(message, { ...context, ...meta }),
    info: (message, meta = {}) => logger.info(message, { ...context, ...meta }),
    http: (message, meta = {}) => logger.http(message, { ...context, ...meta }),
    debug: (message, meta = {}) => logger.debug(message, { ...context, ...meta })
  };
};

// Specific loggers for different components
const reportLogger = createLoggerWithContext({ component: 'report-generator' });
const exportLogger = createLoggerWithContext({ component: 'export-service' });
const templateLogger = createLoggerWithContext({ component: 'template-engine' });
const chartLogger = createLoggerWithContext({ component: 'chart-generator' });

// Performance monitoring helpers
const startTimer = (operation) => {
  const startTime = Date.now();
  return {
    end: (meta = {}) => {
      const duration = Date.now() - startTime;
      logger.info(`${operation} completed`, {
        duration,
        operation,
        ...meta
      });
      return duration;
    }
  };
};

// Error logging with stack traces
const logError = (error, context = {}) => {
  logger.error('Application error', {
    error: error.message,
    stack: error.stack,
    ...context
  });
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'http';

    logger[logLevel]('HTTP Request', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      responseTime: duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?.id,
      contentLength: res.get('Content-Length')
    });
  });

  next();
};

// Report generation logging helpers
const logReportStart = (reportId, type, userId = null) => {
  reportLogger.info('Report generation started', {
    reportId,
    type,
    userId,
    timestamp: new Date().toISOString()
  });
};

const logReportComplete = (reportId, type, duration, fileSize = null, userId = null) => {
  reportLogger.info('Report generation completed', {
    reportId,
    type,
    duration,
    fileSize,
    userId,
    timestamp: new Date().toISOString()
  });
};

const logReportError = (reportId, type, error, userId = null) => {
  reportLogger.error('Report generation failed', {
    reportId,
    type,
    error: error.message,
    stack: error.stack,
    userId,
    timestamp: new Date().toISOString()
  });
};

// Export functionality
const logExportStart = (exportId, format, recordCount, userId = null) => {
  exportLogger.info('Export started', {
    exportId,
    format,
    recordCount,
    userId,
    timestamp: new Date().toISOString()
  });
};

const logExportComplete = (exportId, format, duration, fileSize, userId = null) => {
  exportLogger.info('Export completed', {
    exportId,
    format,
    duration,
    fileSize,
    userId,
    timestamp: new Date().toISOString()
  });
};

const logExportError = (exportId, format, error, userId = null) => {
  exportLogger.error('Export failed', {
    exportId,
    format,
    error: error.message,
    stack: error.stack,
    userId,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  logger,
  reportLogger,
  exportLogger,
  templateLogger,
  chartLogger,
  createLoggerWithContext,
  startTimer,
  logError,
  requestLogger,
  logReportStart,
  logReportComplete,
  logReportError,
  logExportStart,
  logExportComplete,
  logExportError
};