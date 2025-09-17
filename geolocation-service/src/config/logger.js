const winston = require('winston');
const path = require('path');

// Custom log format
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.prettyPrint()
);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');

// Console format for development
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return `${timestamp} [${level}]: ${message} ${
            Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
        }`;
    })
);

// Create winston logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'geolocation-service' },
    transports: [
        // Console transport
        new winston.transports.Console({
            format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat
        }),

        // File transport for errors
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 10485760, // 10MB
            maxFiles: 5,
            tailable: true
        }),

        // File transport for all logs
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 10485760, // 10MB
            maxFiles: 5,
            tailable: true
        })
    ],

    // Handle uncaught exceptions
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'exceptions.log')
        })
    ],

    // Handle unhandled promise rejections
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'rejections.log')
        })
    ]
});

// Create logs directory
const fs = require('fs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Add request logging middleware helper
logger.requestLogger = (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: `${duration}ms`,
            userAgent: req.get('User-Agent'),
            ip: req.ip || req.connection.remoteAddress,
            contentLength: res.get('Content-Length'),
        };

        if (res.statusCode >= 400) {
            logger.warn('HTTP Request', logData);
        } else {
            logger.info('HTTP Request', logData);
        }
    });

    next();
};

// Performance monitoring helper
logger.performance = (label, data = {}) => {
    return {
        start: () => {
            const startTime = process.hrtime.bigint();
            return {
                end: () => {
                    const endTime = process.hrtime.bigint();
                    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
                    logger.info(`Performance: ${label}`, {
                        duration: `${duration.toFixed(2)}ms`,
                        ...data
                    });
                    return duration;
                }
            };
        }
    };
};

// GeoIP specific logging
logger.geoip = {
    detection: (ip, location, source = 'unknown') => {
        logger.info('GeoIP Detection', {
            ip,
            country: location?.country,
            region: location?.region,
            city: location?.city,
            accuracy: location?.accuracy,
            source,
            timestamp: new Date().toISOString()
        });
    },

    error: (ip, error, source = 'unknown') => {
        logger.error('GeoIP Error', {
            ip,
            error: error.message,
            source,
            timestamp: new Date().toISOString()
        });
    },

    cache: (action, key, hit = false) => {
        logger.debug('GeoIP Cache', {
            action,
            key,
            hit,
            timestamp: new Date().toISOString()
        });
    }
};

// Tax rules specific logging
logger.taxRules = {
    access: (country, year, ruleType, userId = null) => {
        logger.info('Tax Rules Access', {
            country,
            year,
            ruleType,
            userId,
            timestamp: new Date().toISOString()
        });
    },

    update: (country, year, updateType, userId = null) => {
        logger.info('Tax Rules Update', {
            country,
            year,
            updateType,
            userId,
            timestamp: new Date().toISOString()
        });
    },

    validation: (country, year, valid, errors = []) => {
        logger.info('Tax Rules Validation', {
            country,
            year,
            valid,
            errors,
            timestamp: new Date().toISOString()
        });
    }
};

// Database specific logging
logger.database = {
    query: (collection, operation, duration, recordCount = 0) => {
        logger.debug('Database Query', {
            collection,
            operation,
            duration: `${duration}ms`,
            recordCount,
            timestamp: new Date().toISOString()
        });
    },

    error: (collection, operation, error) => {
        logger.error('Database Error', {
            collection,
            operation,
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
    }
};

module.exports = logger;