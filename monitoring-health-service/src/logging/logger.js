const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const ElasticsearchTransport = require('winston-elasticsearch');
const path = require('path');
const config = require('../config');

class Logger {
  constructor() {
    this.logger = null;
    this.requestLogger = null;
    this.errorLogger = null;
    this.businessLogger = null;
    this.performanceLogger = null;
  }

  initialize() {
    this.createMainLogger();
    this.createSpecializedLoggers();
    console.log('Logging system initialized successfully');
  }

  createMainLogger() {
    const transports = [];

    if (config.logging.consoleEnabled) {
      transports.push(new winston.transports.Console({
        level: config.logging.level,
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
            let log = `${timestamp} [${level}]: ${message}`;

            if (Object.keys(meta).length > 0) {
              log += ` ${JSON.stringify(meta)}`;
            }

            if (stack) {
              log += `\n${stack}`;
            }

            return log;
          })
        )
      }));
    }

    if (config.logging.fileEnabled) {
      const fileTransport = new DailyRotateFile({
        filename: path.join(config.logging.dir, 'application-%DATE%.log'),
        datePattern: config.logging.datePattern,
        zippedArchive: true,
        maxSize: config.logging.maxSize,
        maxFiles: config.logging.maxFiles,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        )
      });

      fileTransport.on('rotate', (oldFilename, newFilename) => {
        console.log(`Log file rotated: ${oldFilename} -> ${newFilename}`);
      });

      transports.push(fileTransport);
    }

    if (config.elasticsearch.enabled) {
      try {
        const elasticsearchTransport = new ElasticsearchTransport({
          level: config.logging.level,
          clientOpts: {
            node: config.elasticsearch.node,
            auth: config.elasticsearch.username ? {
              username: config.elasticsearch.username,
              password: config.elasticsearch.password
            } : undefined,
            requestTimeout: 10000,
            pingTimeout: 5000
          },
          index: config.elasticsearch.index,
          indexPrefix: `${config.elasticsearch.index}-`,
          indexSuffixPattern: 'YYYY.MM.DD',
          messageType: 'log',
          transformer: (logData) => {
            return {
              '@timestamp': new Date().toISOString(),
              level: logData.level,
              message: logData.message,
              service: config.service.name,
              environment: config.service.environment,
              version: config.service.version,
              host: require('os').hostname(),
              pid: process.pid,
              ...logData.meta
            };
          }
        });

        transports.push(elasticsearchTransport);
      } catch (error) {
        console.warn('Failed to initialize Elasticsearch transport:', error.message);
      }
    }

    this.logger = winston.createLogger({
      level: config.logging.level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: {
        service: config.service.name,
        environment: config.service.environment,
        version: config.service.version,
        host: require('os').hostname(),
        pid: process.pid
      },
      transports,
      exceptionHandlers: [
        new winston.transports.File({
          filename: path.join(config.logging.dir, 'exceptions.log'),
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
          )
        })
      ],
      rejectionHandlers: [
        new winston.transports.File({
          filename: path.join(config.logging.dir, 'rejections.log'),
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
          )
        })
      ]
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled Rejection at Promise', {
        promise,
        reason: reason?.stack || reason
      });
    });

    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught Exception', { error: error.stack });
    });
  }

  createSpecializedLoggers() {
    this.requestLogger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: {
        service: config.service.name,
        type: 'request'
      },
      transports: [
        new DailyRotateFile({
          filename: path.join(config.logging.dir, 'requests-%DATE%.log'),
          datePattern: config.logging.datePattern,
          maxSize: config.logging.maxSize,
          maxFiles: config.logging.maxFiles
        })
      ]
    });

    this.errorLogger = winston.createLogger({
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: {
        service: config.service.name,
        type: 'error'
      },
      transports: [
        new DailyRotateFile({
          filename: path.join(config.logging.dir, 'errors-%DATE%.log'),
          datePattern: config.logging.datePattern,
          maxSize: config.logging.maxSize,
          maxFiles: config.logging.maxFiles
        })
      ]
    });

    this.businessLogger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: {
        service: config.service.name,
        type: 'business'
      },
      transports: [
        new DailyRotateFile({
          filename: path.join(config.logging.dir, 'business-%DATE%.log'),
          datePattern: config.logging.datePattern,
          maxSize: config.logging.maxSize,
          maxFiles: config.logging.maxFiles
        })
      ]
    });

    this.performanceLogger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: {
        service: config.service.name,
        type: 'performance'
      },
      transports: [
        new DailyRotateFile({
          filename: path.join(config.logging.dir, 'performance-%DATE%.log'),
          datePattern: config.logging.datePattern,
          maxSize: config.logging.maxSize,
          maxFiles: config.logging.maxFiles
        })
      ]
    });
  }

  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  error(message, meta = {}) {
    this.logger.error(message, meta);
    if (this.errorLogger) {
      this.errorLogger.error(message, meta);
    }
  }

  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  logRequest(req, res, responseTime) {
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      referer: req.get('Referer'),
      contentLength: res.get('Content-Length'),
      userId: req.user?.id,
      sessionId: req.sessionID,
      requestId: req.id
    };

    if (this.requestLogger) {
      this.requestLogger.info('HTTP Request', logData);
    }

    if (res.statusCode >= 400) {
      this.error('HTTP Error', logData);
    }
  }

  logBusinessEvent(event, data = {}) {
    const logData = {
      event,
      timestamp: new Date().toISOString(),
      ...data
    };

    if (this.businessLogger) {
      this.businessLogger.info('Business Event', logData);
    }

    this.info(`Business Event: ${event}`, logData);
  }

  logPerformance(operation, duration, metadata = {}) {
    const logData = {
      operation,
      duration,
      timestamp: new Date().toISOString(),
      ...metadata
    };

    if (this.performanceLogger) {
      this.performanceLogger.info('Performance Metric', logData);
    }

    if (duration > 1000) {
      this.warn(`Slow operation: ${operation}`, logData);
    }
  }

  logDatabaseQuery(query, duration, result = {}) {
    const logData = {
      query: query.replace(/\s+/g, ' ').trim(),
      duration,
      rowCount: result.rowCount || result.affectedRows || 0,
      timestamp: new Date().toISOString()
    };

    this.debug('Database Query', logData);

    if (duration > 1000) {
      this.warn('Slow Database Query', logData);
    }
  }

  logSecurityEvent(event, details = {}) {
    const logData = {
      event,
      severity: 'HIGH',
      timestamp: new Date().toISOString(),
      ...details
    };

    this.warn(`Security Event: ${event}`, logData);

    if (this.errorLogger) {
      this.errorLogger.warn('Security Event', logData);
    }
  }

  createRequestMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();

      req.id = require('uuid').v4();

      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        this.logRequest(req, res, responseTime);
      });

      next();
    };
  }

  createErrorMiddleware() {
    return (error, req, res, next) => {
      const logData = {
        error: error.message,
        stack: error.stack,
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        userId: req.user?.id,
        requestId: req.id
      };

      this.error('Express Error Handler', logData);

      if (!res.headersSent) {
        res.status(error.status || 500).json({
          error: 'Internal Server Error',
          requestId: req.id
        });
      }

      next();
    };
  }

  async cleanup() {
    if (this.logger) {
      await new Promise((resolve) => {
        this.logger.on('finish', resolve);
        this.logger.end();
      });
    }

    [this.requestLogger, this.errorLogger, this.businessLogger, this.performanceLogger]
      .filter(logger => logger)
      .forEach(logger => {
        logger.end();
      });

    console.log('Logging system cleaned up');
  }

  getLoggerInstance() {
    return this.logger;
  }

  setLevel(level) {
    if (this.logger) {
      this.logger.level = level;
      this.logger.transports.forEach(transport => {
        transport.level = level;
      });
    }
  }

  addTransport(transport) {
    if (this.logger) {
      this.logger.add(transport);
    }
  }

  removeTransport(transport) {
    if (this.logger) {
      this.logger.remove(transport);
    }
  }
}

const logger = new Logger();

module.exports = {
  logger,
  Logger
};