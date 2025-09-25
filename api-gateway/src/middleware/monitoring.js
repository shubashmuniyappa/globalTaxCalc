/**
 * Advanced Monitoring and Logging Middleware
 * Implements comprehensive monitoring, metrics collection, and structured logging
 */

const winston = require('winston');
const prometheus = require('prom-client');
const responseTime = require('response-time');
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');
const os = require('os');

// Prometheus metrics
const httpRequestsTotal = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'api_version']
});

const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
});

const httpRequestSize = new prometheus.Histogram({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000]
});

const httpResponseSize = new prometheus.Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [100, 1000, 10000, 100000, 1000000]
});

const activeConnections = new prometheus.Gauge({
  name: 'active_connections',
  help: 'Number of active connections'
});

const errorRate = new prometheus.Counter({
  name: 'error_rate_total',
  help: 'Total number of errors',
  labelNames: ['type', 'endpoint', 'error_code']
});

const apiKeyUsage = new prometheus.Counter({
  name: 'api_key_usage_total',
  help: 'Total API key usage',
  labelNames: ['key_id', 'tier']
});

const rateLimitHits = new prometheus.Counter({
  name: 'rate_limit_hits_total',
  help: 'Total rate limit hits',
  labelNames: ['type', 'ip', 'endpoint']
});

// System metrics
const memoryUsage = new prometheus.Gauge({
  name: 'memory_usage_bytes',
  help: 'Memory usage in bytes',
  labelNames: ['type']
});

const cpuUsage = new prometheus.Gauge({
  name: 'cpu_usage_percent',
  help: 'CPU usage percentage'
});

class MonitoringManager extends EventEmitter {
  constructor(redisClient) {
    super();
    this.redisClient = redisClient;
    this.correlationStorage = new Map();
    this.activeRequests = new Map();
    this.systemMetrics = {};

    // Configure Winston logger
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: {
        service: 'api-gateway',
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      },
      transports: [
        // Console transport
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),

        // File transports
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          maxsize: 5242880,
          maxFiles: 10
        }),

        // Separate file for access logs
        new winston.transports.File({
          filename: 'logs/access.log',
          level: 'info',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        })
      ]
    });

    // Initialize system monitoring
    this.startSystemMonitoring();
    this.startMetricsCollection();
  }

  /**
   * Request correlation middleware
   */
  correlationMiddleware() {
    return (req, res, next) => {
      // Generate or extract correlation ID
      const correlationId = req.headers['x-correlation-id'] ||
                           req.headers['x-request-id'] ||
                           uuidv4();

      // Store correlation ID
      req.correlationId = correlationId;
      res.set('X-Correlation-ID', correlationId);

      // Create request context
      const requestContext = {
        correlationId,
        startTime: Date.now(),
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        apiVersion: req.apiVersion?.resolved,
        userId: req.user?.id,
        apiKeyId: req.apiKey?.id
      };

      // Store in correlation storage
      this.correlationStorage.set(correlationId, requestContext);
      this.activeRequests.set(correlationId, requestContext);

      // Update active connections metric
      activeConnections.inc();

      // Clean up on response end
      res.on('finish', () => {
        activeConnections.dec();
        this.activeRequests.delete(correlationId);

        // Keep correlation data for 5 minutes for potential debugging
        setTimeout(() => {
          this.correlationStorage.delete(correlationId);
        }, 5 * 60 * 1000);
      });

      next();
    };
  }

  /**
   * Request logging middleware
   */
  requestLogging() {
    return (req, res, next) => {
      const startTime = Date.now();

      // Log incoming request
      this.logger.info('Incoming request', {
        correlationId: req.correlationId,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        contentLength: req.get('Content-Length'),
        apiVersion: req.apiVersion?.resolved,
        userId: req.user?.id,
        apiKeyId: req.apiKey?.id
      });

      // Capture original response methods
      const originalSend = res.send;
      const originalJson = res.json;

      // Override response methods to log response
      res.send = function(body) {
        res.send = originalSend;
        const responseTime = Date.now() - startTime;

        // Log response
        this.logResponse(req, res, body, responseTime);

        return originalSend.call(this, body);
      }.bind(this);

      res.json = function(body) {
        res.json = originalJson;
        const responseTime = Date.now() - startTime;

        // Log response
        this.logResponse(req, res, body, responseTime);

        return originalJson.call(this, body);
      }.bind(this);

      next();
    };
  }

  /**
   * Log response details
   */
  logResponse(req, res, body, responseTime) {
    const statusCode = res.statusCode;
    const isError = statusCode >= 400;
    const bodySize = Buffer.byteLength(JSON.stringify(body || ''), 'utf8');

    const logData = {
      correlationId: req.correlationId,
      method: req.method,
      url: req.url,
      statusCode,
      responseTime,
      responseSize: bodySize,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      apiVersion: req.apiVersion?.resolved,
      userId: req.user?.id,
      apiKeyId: req.apiKey?.id
    };

    if (isError) {
      logData.errorBody = body;
      this.logger.error('Request completed with error', logData);
    } else {
      this.logger.info('Request completed successfully', logData);
    }

    // Update metrics
    this.updateMetrics(req, res, responseTime, bodySize);

    // Store in Redis for analytics
    this.storeRequestMetrics(logData);
  }

  /**
   * Update Prometheus metrics
   */
  updateMetrics(req, res, responseTime, responseSize) {
    const labels = {
      method: req.method,
      route: this.normalizeRoute(req.route?.path || req.path),
      status_code: res.statusCode.toString(),
      api_version: req.apiVersion?.resolved || 'unknown'
    };

    // Update counters and histograms
    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(
      { method: labels.method, route: labels.route, status_code: labels.status_code },
      responseTime / 1000
    );

    // Request size
    const requestSize = parseInt(req.get('Content-Length') || '0');
    if (requestSize > 0) {
      httpRequestSize.observe(
        { method: labels.method, route: labels.route },
        requestSize
      );
    }

    // Response size
    httpResponseSize.observe(
      { method: labels.method, route: labels.route, status_code: labels.status_code },
      responseSize
    );

    // Error tracking
    if (res.statusCode >= 400) {
      errorRate.inc({
        type: res.statusCode >= 500 ? 'server_error' : 'client_error',
        endpoint: labels.route,
        error_code: labels.status_code
      });
    }

    // API key usage
    if (req.apiKey) {
      apiKeyUsage.inc({
        key_id: req.apiKey.id,
        tier: req.apiKey.tier || 'unknown'
      });
    }
  }

  /**
   * Error tracking middleware
   */
  errorTracking() {
    return (error, req, res, next) => {
      const errorId = uuidv4();
      const errorData = {
        errorId,
        correlationId: req.correlationId,
        message: error.message,
        stack: error.stack,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        userId: req.user?.id,
        apiKeyId: req.apiKey?.id
      };

      // Log error
      this.logger.error('Unhandled error', errorData);

      // Update error metrics
      errorRate.inc({
        type: 'unhandled_error',
        endpoint: this.normalizeRoute(req.route?.path || req.path),
        error_code: error.statusCode || '500'
      });

      // Store error for analysis
      this.storeError(errorData);

      // Send error response
      if (!res.headersSent) {
        res.status(error.statusCode || 500).json({
          error: {
            code: error.code || 'INTERNAL_ERROR',
            message: process.env.NODE_ENV === 'production'
              ? 'An internal error occurred'
              : error.message,
            errorId: errorId
          }
        });
      }

      next();
    };
  }

  /**
   * Performance monitoring middleware
   */
  performanceMonitoring() {
    return responseTime((req, res, time) => {
      // Track slow requests
      if (time > 1000) { // Requests slower than 1 second
        this.logger.warn('Slow request detected', {
          correlationId: req.correlationId,
          method: req.method,
          url: req.url,
          responseTime: time,
          userId: req.user?.id
        });

        // Emit slow request event for potential alerting
        this.emit('slowRequest', {
          correlationId: req.correlationId,
          responseTime: time,
          endpoint: req.url
        });
      }

      // Track very slow requests separately
      if (time > 5000) {
        this.emit('verySlowRequest', {
          correlationId: req.correlationId,
          responseTime: time,
          endpoint: req.url
        });
      }
    });
  }

  /**
   * SLA monitoring middleware
   */
  slaMonitoring() {
    return (req, res, next) => {
      const startTime = Date.now();

      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        const statusCode = res.statusCode;

        // Define SLA thresholds
        const slaThresholds = {
          '/api/v*/calculate': 200,      // 200ms for calculations
          '/api/v*/auth/*': 500,         // 500ms for auth endpoints
          '/api/v*/reports': 1000,       // 1s for reports
          'default': 300                 // 300ms default
        };

        const endpoint = this.normalizeRoute(req.route?.path || req.path);
        const threshold = slaThresholds[endpoint] || slaThresholds.default;

        const slaData = {
          endpoint,
          responseTime,
          threshold,
          withinSLA: responseTime <= threshold,
          statusCode,
          correlationId: req.correlationId,
          timestamp: new Date().toISOString()
        };

        // Store SLA metrics
        this.storeSLAMetrics(slaData);

        // Alert if SLA violated
        if (!slaData.withinSLA) {
          this.logger.warn('SLA violation', slaData);
          this.emit('slaViolation', slaData);
        }
      });

      next();
    };
  }

  /**
   * API usage analytics middleware
   */
  usageAnalytics() {
    return (req, res, next) => {
      const usageData = {
        timestamp: new Date().toISOString(),
        method: req.method,
        endpoint: this.normalizeRoute(req.route?.path || req.path),
        apiVersion: req.apiVersion?.resolved,
        userId: req.user?.id,
        apiKeyId: req.apiKey?.id,
        userTier: req.user?.tier || req.apiKey?.tier,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        correlationId: req.correlationId
      };

      // Store usage analytics
      this.storeUsageAnalytics(usageData);

      next();
    };
  }

  /**
   * Start system monitoring
   */
  startSystemMonitoring() {
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000); // Collect every 30 seconds
  }

  /**
   * Collect system metrics
   */
  collectSystemMetrics() {
    const memStats = process.memoryUsage();

    // Memory metrics
    memoryUsage.set({ type: 'rss' }, memStats.rss);
    memoryUsage.set({ type: 'heap_used' }, memStats.heapUsed);
    memoryUsage.set({ type: 'heap_total' }, memStats.heapTotal);
    memoryUsage.set({ type: 'external' }, memStats.external);

    // CPU metrics (simple approximation)
    const cpuUsagePercent = process.cpuUsage();
    cpuUsage.set(cpuUsagePercent.user / 1000000); // Convert to seconds

    // Store system metrics
    this.systemMetrics = {
      timestamp: new Date().toISOString(),
      memory: memStats,
      cpu: cpuUsagePercent,
      uptime: process.uptime(),
      loadAverage: os.loadavg(),
      freeMemory: os.freemem(),
      totalMemory: os.totalmem()
    };

    this.storeSystemMetrics(this.systemMetrics);
  }

  /**
   * Start metrics collection
   */
  startMetricsCollection() {
    // Collect default Node.js metrics
    prometheus.collectDefaultMetrics();

    // Custom metrics collection
    setInterval(() => {
      this.collectCustomMetrics();
    }, 60000); // Collect every minute
  }

  /**
   * Collect custom metrics
   */
  collectCustomMetrics() {
    // Active requests gauge
    activeConnections.set(this.activeRequests.size);

    // Collect Redis metrics if available
    if (this.redisClient) {
      this.collectRedisMetrics();
    }
  }

  /**
   * Collect Redis metrics
   */
  async collectRedisMetrics() {
    try {
      const info = await this.redisClient.info();
      const lines = info.split('\r\n');
      const metrics = {};

      lines.forEach(line => {
        if (line.includes(':') && !line.startsWith('#')) {
          const [key, value] = line.split(':');
          metrics[key] = value;
        }
      });

      // Store Redis metrics
      this.storeRedisMetrics(metrics);
    } catch (error) {
      this.logger.error('Error collecting Redis metrics', error);
    }
  }

  /**
   * Store request metrics in Redis
   */
  async storeRequestMetrics(data) {
    if (!this.redisClient) return;

    try {
      const key = `metrics:requests:${new Date().toISOString().split('T')[0]}`; // Daily buckets
      await this.redisClient.lpush(key, JSON.stringify(data));
      await this.redisClient.expire(key, 86400 * 7); // Keep for 7 days
    } catch (error) {
      this.logger.error('Error storing request metrics', error);
    }
  }

  /**
   * Store error data
   */
  async storeError(errorData) {
    if (!this.redisClient) return;

    try {
      await this.redisClient.lpush('errors', JSON.stringify(errorData));
      await this.redisClient.ltrim('errors', 0, 999); // Keep last 1000 errors
    } catch (error) {
      this.logger.error('Error storing error data', error);
    }
  }

  /**
   * Store SLA metrics
   */
  async storeSLAMetrics(slaData) {
    if (!this.redisClient) return;

    try {
      const key = `sla:${new Date().toISOString().split('T')[0]}`;
      await this.redisClient.lpush(key, JSON.stringify(slaData));
      await this.redisClient.expire(key, 86400 * 30); // Keep for 30 days
    } catch (error) {
      this.logger.error('Error storing SLA metrics', error);
    }
  }

  /**
   * Store usage analytics
   */
  async storeUsageAnalytics(usageData) {
    if (!this.redisClient) return;

    try {
      const key = `analytics:${new Date().toISOString().split('T')[0]}`;
      await this.redisClient.lpush(key, JSON.stringify(usageData));
      await this.redisClient.expire(key, 86400 * 90); // Keep for 90 days
    } catch (error) {
      this.logger.error('Error storing usage analytics', error);
    }
  }

  /**
   * Store system metrics
   */
  async storeSystemMetrics(metrics) {
    if (!this.redisClient) return;

    try {
      const key = `system:metrics:${new Date().toISOString().split('T')[0]}`;
      await this.redisClient.lpush(key, JSON.stringify(metrics));
      await this.redisClient.expire(key, 86400 * 7); // Keep for 7 days
    } catch (error) {
      this.logger.error('Error storing system metrics', error);
    }
  }

  /**
   * Store Redis metrics
   */
  async storeRedisMetrics(metrics) {
    if (!this.redisClient) return;

    try {
      const key = `redis:metrics:${new Date().toISOString().split('T')[0]}`;
      await this.redisClient.set(key, JSON.stringify(metrics));
      await this.redisClient.expire(key, 86400 * 7);
    } catch (error) {
      this.logger.error('Error storing Redis metrics', error);
    }
  }

  /**
   * Normalize route for consistent metrics
   */
  normalizeRoute(route) {
    if (!route) return 'unknown';

    // Replace dynamic segments with placeholders
    return route
      .replace(/\/v\d+(\.\d+)*\//, '/v*/')
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9-]{36}/g, '/:uuid')
      .replace(/\/[a-zA-Z0-9_-]+@[a-zA-Z0-9.-]+/g, '/:email');
  }

  /**
   * Get metrics endpoint
   */
  getMetricsEndpoint() {
    return (req, res) => {
      res.set('Content-Type', prometheus.register.contentType);
      res.end(prometheus.register.metrics());
    };
  }

  /**
   * Get health check endpoint
   */
  getHealthEndpoint() {
    return async (req, res) => {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        correlationId: req.correlationId
      };

      // Check Redis health
      if (this.redisClient) {
        try {
          await this.redisClient.ping();
          health.redis = 'healthy';
        } catch (error) {
          health.redis = 'unhealthy';
          health.status = 'degraded';
        }
      }

      // Check memory usage
      const memUsage = process.memoryUsage();
      const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

      if (heapUsedPercent > 90) {
        health.status = 'degraded';
        health.warnings = health.warnings || [];
        health.warnings.push('High memory usage');
      }

      health.memory = {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        heapUsedPercent: Math.round(heapUsedPercent)
      };

      const statusCode = health.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(health);
    };
  }

  /**
   * Get current statistics
   */
  async getStats() {
    try {
      const stats = {
        activeRequests: this.activeRequests.size,
        totalCorrelations: this.correlationStorage.size,
        systemMetrics: this.systemMetrics,
        timestamp: new Date().toISOString()
      };

      if (this.redisClient) {
        // Get error count from last 24 hours
        const errors = await this.redisClient.lrange('errors', 0, -1);
        const last24h = Date.now() - (24 * 60 * 60 * 1000);
        stats.errorsLast24h = errors.filter(error => {
          const errorData = JSON.parse(error);
          return new Date(errorData.timestamp).getTime() > last24h;
        }).length;
      }

      return stats;
    } catch (error) {
      this.logger.error('Error getting stats', error);
      return {};
    }
  }
}

// Create singleton instance
let monitoringManagerInstance;

function createMonitoringManager(redisClient) {
  if (!monitoringManagerInstance) {
    monitoringManagerInstance = new MonitoringManager(redisClient);
  }
  return monitoringManagerInstance;
}

module.exports = {
  MonitoringManager,
  createMonitoringManager,
  prometheus
};