const winston = require('winston');
const config = require('../config');

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

// Add colors to winston
winston.addColors(colors);

// Format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;

    let logMessage = `${timestamp} [${level}]: ${message}`;

    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta, null, 2)}`;
    }

    return logMessage;
  })
);

// Format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create transports array
const transports = [
  // Error logs
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),

  // Combined logs
  new winston.transports.File({
    filename: 'logs/combined.log',
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),

  // HTTP access logs
  new winston.transports.File({
    filename: 'logs/access.log',
    level: 'http',
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 3,
  })
];

// Add console transport for development
if (config.NODE_ENV === 'development') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  levels,
  format: fileFormat,
  defaultMeta: {
    service: 'api-gateway',
    environment: config.NODE_ENV,
    hostname: require('os').hostname(),
    pid: process.pid
  },
  transports,

  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: 'logs/exceptions.log',
      maxsize: 5242880,
      maxFiles: 2
    })
  ],

  rejectionHandlers: [
    new winston.transports.File({
      filename: 'logs/rejections.log',
      maxsize: 5242880,
      maxFiles: 2
    })
  ],

  exitOnError: false
});

// Create a stream object for Morgan HTTP logging
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

// Helper methods for structured logging
logger.logRequest = (req, res, responseTime) => {
  logger.http('HTTP Request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    requestId: req.id,
    userId: req.user?.id,
    contentLength: res.get('Content-Length')
  });
};

logger.logError = (error, req = null, additionalData = {}) => {
  logger.error('Application Error', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      statusCode: error.statusCode
    },
    request: req ? {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.id,
      userId: req.user?.id
    } : null,
    ...additionalData
  });
};

logger.logServiceCall = (serviceName, method, url, responseTime, statusCode, error = null) => {
  const logData = {
    service: serviceName,
    method,
    url,
    responseTime: `${responseTime}ms`,
    statusCode,
    timestamp: new Date().toISOString()
  };

  if (error) {
    logData.error = error.message;
    logger.error('Service call failed', logData);
  } else {
    logger.info('Service call completed', logData);
  }
};

logger.logSecurityEvent = (event, req, details = {}) => {
  logger.warn('Security Event', {
    event,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    url: req.url,
    method: req.method,
    requestId: req.id,
    userId: req.user?.id,
    timestamp: new Date().toISOString(),
    ...details
  });
};

logger.logPerformance = (operation, duration, details = {}) => {
  logger.info('Performance Metric', {
    operation,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Log unhandled promise rejections and uncaught exceptions
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString()
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack
  });
});

module.exports = logger;