const promClient = require('prom-client');
const EventEmitter = require('events');

class PerformanceMonitor extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      // Application Performance Monitoring
      apm: {
        enabled: process.env.APM_ENABLED !== 'false',
        serviceName: process.env.APM_SERVICE_NAME || 'globaltaxcalc',
        environment: process.env.NODE_ENV || 'development',
        version: process.env.APP_VERSION || '1.0.0',
        sampleRate: parseFloat(process.env.APM_SAMPLE_RATE) || 1.0
      },

      // Real User Monitoring
      rum: {
        enabled: process.env.RUM_ENABLED !== 'false',
        endpoint: '/api/rum',
        batchSize: 50,
        flushInterval: 30000,
        maxEvents: 1000
      },

      // Core Web Vitals thresholds
      vitals: {
        lcp: { good: 2500, poor: 4000 }, // Largest Contentful Paint
        fid: { good: 100, poor: 300 },   // First Input Delay
        cls: { good: 0.1, poor: 0.25 },  // Cumulative Layout Shift
        fcp: { good: 1800, poor: 3000 }, // First Contentful Paint
        ttfb: { good: 800, poor: 1800 }  // Time to First Byte
      },

      // Performance budgets
      budgets: {
        responseTime: 1000,     // 1 second
        memoryUsage: 512 * 1024 * 1024, // 512MB
        cpuUsage: 80,           // 80%
        diskUsage: 85,          // 85%
        errorRate: 1            // 1%
      },

      // Alerting thresholds
      alerts: {
        responseTime: 2000,     // Alert if response time > 2s
        errorRate: 5,           // Alert if error rate > 5%
        memoryUsage: 80,        // Alert if memory usage > 80%
        cpuUsage: 90,           // Alert if CPU usage > 90%
        diskUsage: 90           // Alert if disk usage > 90%
      },

      ...options
    };

    this.rumEvents = [];
    this.metrics = this.initializeMetrics();
    this.setupPrometheusMetrics();
    this.startSystemMonitoring();
  }

  /**
   * Initialize Prometheus metrics
   */
  setupPrometheusMetrics() {
    // Register default metrics
    promClient.register.setDefaultLabels({
      app: this.config.apm.serviceName,
      version: this.config.apm.version,
      env: this.config.apm.environment
    });

    promClient.collectDefaultMetrics({
      timeout: 5000,
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
    });

    // Custom metrics
    this.prometheusMetrics = {
      // HTTP request metrics
      httpRequestDuration: new promClient.Histogram({
        name: 'http_request_duration_seconds',
        help: 'Duration of HTTP requests in seconds',
        labelNames: ['method', 'route', 'status_code'],
        buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
      }),

      httpRequestTotal: new promClient.Counter({
        name: 'http_requests_total',
        help: 'Total number of HTTP requests',
        labelNames: ['method', 'route', 'status_code']
      }),

      // Database metrics
      dbQueryDuration: new promClient.Histogram({
        name: 'db_query_duration_seconds',
        help: 'Duration of database queries in seconds',
        labelNames: ['query_type', 'table'],
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5]
      }),

      dbConnectionPool: new promClient.Gauge({
        name: 'db_connection_pool_size',
        help: 'Database connection pool size',
        labelNames: ['pool_type', 'state']
      }),

      // Cache metrics
      cacheHits: new promClient.Counter({
        name: 'cache_hits_total',
        help: 'Total cache hits',
        labelNames: ['cache_type', 'key_pattern']
      }),

      cacheMisses: new promClient.Counter({
        name: 'cache_misses_total',
        help: 'Total cache misses',
        labelNames: ['cache_type', 'key_pattern']
      }),

      // Core Web Vitals
      webVitalsLCP: new promClient.Histogram({
        name: 'web_vitals_lcp_seconds',
        help: 'Largest Contentful Paint in seconds',
        buckets: [0.5, 1, 1.5, 2, 2.5, 3, 4, 5]
      }),

      webVitalsFID: new promClient.Histogram({
        name: 'web_vitals_fid_milliseconds',
        help: 'First Input Delay in milliseconds',
        buckets: [10, 25, 50, 100, 200, 300, 500]
      }),

      webVitalsCLS: new promClient.Histogram({
        name: 'web_vitals_cls_score',
        help: 'Cumulative Layout Shift score',
        buckets: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.5]
      }),

      // Business metrics
      taxCalculations: new promClient.Counter({
        name: 'tax_calculations_total',
        help: 'Total tax calculations performed',
        labelNames: ['calculation_type', 'success']
      }),

      userSessions: new promClient.Gauge({
        name: 'active_user_sessions',
        help: 'Number of active user sessions'
      }),

      // Error metrics
      errorRate: new promClient.Gauge({
        name: 'error_rate_percentage',
        help: 'Error rate as percentage',
        labelNames: ['error_type']
      })
    };

    console.log('✅ Prometheus metrics initialized');
  }

  /**
   * HTTP request monitoring middleware
   */
  httpMonitoringMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      const startHrTime = process.hrtime();

      // Generate unique request ID
      req.requestId = require('crypto').randomUUID();
      res.set('X-Request-ID', req.requestId);

      // Store request start time
      req.startTime = startTime;

      // Override res.end to capture metrics
      const originalEnd = res.end;
      res.end = (...args) => {
        const duration = Date.now() - startTime;
        const hrDuration = process.hrtime(startHrTime);
        const durationSeconds = hrDuration[0] + hrDuration[1] / 1e9;

        // Record metrics
        this.recordHttpMetrics(req, res, duration, durationSeconds);

        // Call original end method
        originalEnd.apply(res, args);
      };

      next();
    };
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpMetrics(req, res, duration, durationSeconds) {
    const labels = {
      method: req.method,
      route: this.getRoutePattern(req.route?.path || req.path),
      status_code: res.statusCode.toString()
    };

    // Record Prometheus metrics
    this.prometheusMetrics.httpRequestDuration.observe(labels, durationSeconds);
    this.prometheusMetrics.httpRequestTotal.inc(labels);

    // Update internal metrics
    this.metrics.http.requestCount++;
    this.metrics.http.totalResponseTime += duration;
    this.metrics.http.averageResponseTime =
      this.metrics.http.totalResponseTime / this.metrics.http.requestCount;

    if (duration > this.config.budgets.responseTime) {
      this.metrics.http.slowRequests++;
    }

    if (res.statusCode >= 400) {
      this.metrics.http.errorCount++;
    }

    // Check for alerts
    this.checkAlerts('responseTime', duration);

    // Emit event for real-time monitoring
    this.emit('httpRequest', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get route pattern from path
   */
  getRoutePattern(path) {
    // Convert dynamic routes to patterns
    return path
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9-]{36}/g, '/:uuid')
      .replace(/\/[a-zA-Z0-9-_]+\.(js|css|png|jpg|gif|ico)/g, '/static')
      || '/unknown';
  }

  /**
   * Database query monitoring
   */
  recordDbQuery(queryType, table, duration) {
    const durationSeconds = duration / 1000;

    this.prometheusMetrics.dbQueryDuration.observe(
      { query_type: queryType, table },
      durationSeconds
    );

    this.metrics.database.queryCount++;
    this.metrics.database.totalQueryTime += duration;
    this.metrics.database.averageQueryTime =
      this.metrics.database.totalQueryTime / this.metrics.database.queryCount;

    if (duration > 1000) { // > 1 second
      this.metrics.database.slowQueries++;
    }
  }

  /**
   * Cache hit/miss monitoring
   */
  recordCacheEvent(cacheType, keyPattern, hit) {
    if (hit) {
      this.prometheusMetrics.cacheHits.inc({ cache_type: cacheType, key_pattern: keyPattern });
      this.metrics.cache.hits++;
    } else {
      this.prometheusMetrics.cacheMisses.inc({ cache_type: cacheType, key_pattern: keyPattern });
      this.metrics.cache.misses++;
    }

    this.metrics.cache.hitRatio =
      this.metrics.cache.hits / (this.metrics.cache.hits + this.metrics.cache.misses) * 100;
  }

  /**
   * Real User Monitoring endpoint
   */
  rumEndpoint() {
    return (req, res) => {
      try {
        const events = Array.isArray(req.body) ? req.body : [req.body];

        events.forEach(event => {
          this.processRUMEvent(event);
        });

        res.status(204).send();

      } catch (error) {
        console.error('Error processing RUM events:', error);
        res.status(400).json({ error: 'Invalid RUM event format' });
      }
    };
  }

  /**
   * Process Real User Monitoring event
   */
  processRUMEvent(event) {
    const {
      type,
      name,
      value,
      url,
      userAgent,
      timestamp,
      sessionId,
      userId
    } = event;

    // Validate event
    if (!type || !name || value === undefined) {
      return;
    }

    // Store event
    this.rumEvents.push({
      ...event,
      receivedAt: new Date().toISOString()
    });

    // Process Core Web Vitals
    if (type === 'web-vital') {
      this.recordWebVital(name, value);
    }

    // Process custom metrics
    if (type === 'custom') {
      this.recordCustomMetric(name, value);
    }

    // Trim events if too many
    if (this.rumEvents.length > this.config.rum.maxEvents) {
      this.rumEvents = this.rumEvents.slice(-this.config.rum.maxEvents);
    }

    // Emit event for real-time processing
    this.emit('rumEvent', event);
  }

  /**
   * Record Core Web Vitals
   */
  recordWebVital(name, value) {
    switch (name) {
      case 'LCP':
        this.prometheusMetrics.webVitalsLCP.observe(value / 1000); // Convert to seconds
        this.metrics.vitals.lcp.push(value);
        break;

      case 'FID':
        this.prometheusMetrics.webVitalsFID.observe(value);
        this.metrics.vitals.fid.push(value);
        break;

      case 'CLS':
        this.prometheusMetrics.webVitalsCLS.observe(value);
        this.metrics.vitals.cls.push(value);
        break;

      case 'FCP':
        this.metrics.vitals.fcp.push(value);
        break;

      case 'TTFB':
        this.metrics.vitals.ttfb.push(value);
        break;
    }

    // Check Core Web Vitals thresholds
    this.checkWebVitalThresholds(name, value);
  }

  /**
   * Record custom business metric
   */
  recordCustomMetric(name, value) {
    switch (name) {
      case 'tax-calculation':
        this.prometheusMetrics.taxCalculations.inc({
          calculation_type: value.type || 'unknown',
          success: value.success ? 'true' : 'false'
        });
        break;

      case 'user-session':
        this.prometheusMetrics.userSessions.set(value);
        break;
    }
  }

  /**
   * Check Core Web Vitals against thresholds
   */
  checkWebVitalThresholds(metric, value) {
    const thresholds = this.config.vitals[metric.toLowerCase()];
    if (!thresholds) return;

    let status = 'good';
    if (value > thresholds.poor) {
      status = 'poor';
    } else if (value > thresholds.good) {
      status = 'needs-improvement';
    }

    if (status !== 'good') {
      this.emit('vitalAlert', {
        metric,
        value,
        status,
        threshold: status === 'poor' ? thresholds.poor : thresholds.good,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Start system monitoring
   */
  startSystemMonitoring() {
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000); // Every 30 seconds

    setInterval(() => {
      this.flushRUMEvents();
    }, this.config.rum.flushInterval);
  }

  /**
   * Collect system metrics
   */
  collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Memory metrics
    this.metrics.system.memoryUsage = {
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external
    };

    // CPU metrics
    this.metrics.system.cpuUsage = {
      user: cpuUsage.user,
      system: cpuUsage.system
    };

    // Check system alerts
    this.checkAlerts('memoryUsage', memUsage.heapUsed);
    this.checkAlerts('cpuUsage', (cpuUsage.user + cpuUsage.system) / 1000000); // Convert to percentage
  }

  /**
   * Check alert thresholds
   */
  checkAlerts(metric, value) {
    const threshold = this.config.alerts[metric];
    if (!threshold) return;

    let shouldAlert = false;
    let normalizedValue = value;

    switch (metric) {
      case 'responseTime':
        shouldAlert = value > threshold;
        break;

      case 'memoryUsage':
        normalizedValue = (value / this.config.budgets.memoryUsage) * 100;
        shouldAlert = normalizedValue > threshold;
        break;

      case 'errorRate':
        normalizedValue = (this.metrics.http.errorCount / this.metrics.http.requestCount) * 100;
        shouldAlert = normalizedValue > threshold;
        break;

      default:
        shouldAlert = value > threshold;
    }

    if (shouldAlert) {
      this.emit('alert', {
        metric,
        value: normalizedValue,
        threshold,
        severity: normalizedValue > threshold * 1.5 ? 'critical' : 'warning',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Flush RUM events
   */
  flushRUMEvents() {
    if (this.rumEvents.length === 0) return;

    // Process events in batches
    const batchSize = this.config.rum.batchSize;
    const batches = [];

    for (let i = 0; i < this.rumEvents.length; i += batchSize) {
      batches.push(this.rumEvents.slice(i, i + batchSize));
    }

    batches.forEach((batch, index) => {
      setTimeout(() => {
        this.processBatch(batch);
      }, index * 100); // Stagger batch processing
    });

    // Clear events after processing
    this.rumEvents = [];
  }

  /**
   * Process batch of RUM events
   */
  processBatch(events) {
    // Aggregate events for analysis
    const aggregated = this.aggregateEvents(events);

    // Emit aggregated data
    this.emit('rumBatch', aggregated);

    console.log(`Processed RUM batch: ${events.length} events`);
  }

  /**
   * Aggregate RUM events
   */
  aggregateEvents(events) {
    const aggregated = {
      totalEvents: events.length,
      vitals: {},
      customMetrics: {},
      errors: [],
      sessions: new Set(),
      pages: {},
      timestamp: new Date().toISOString()
    };

    events.forEach(event => {
      // Track sessions
      if (event.sessionId) {
        aggregated.sessions.add(event.sessionId);
      }

      // Aggregate vitals
      if (event.type === 'web-vital') {
        if (!aggregated.vitals[event.name]) {
          aggregated.vitals[event.name] = [];
        }
        aggregated.vitals[event.name].push(event.value);
      }

      // Track errors
      if (event.type === 'error') {
        aggregated.errors.push({
          message: event.message,
          stack: event.stack,
          url: event.url,
          timestamp: event.timestamp
        });
      }

      // Track page views
      if (event.type === 'navigation') {
        if (!aggregated.pages[event.url]) {
          aggregated.pages[event.url] = 0;
        }
        aggregated.pages[event.url]++;
      }
    });

    // Convert sessions set to count
    aggregated.uniqueSessions = aggregated.sessions.size;
    delete aggregated.sessions;

    return aggregated;
  }

  /**
   * Get Prometheus metrics endpoint
   */
  getMetricsEndpoint() {
    return async (req, res) => {
      try {
        res.set('Content-Type', promClient.register.contentType);
        const metrics = await promClient.register.metrics();
        res.send(metrics);
      } catch (error) {
        console.error('Error generating metrics:', error);
        res.status(500).send('Error generating metrics');
      }
    };
  }

  /**
   * Get performance dashboard data
   */
  getDashboardData() {
    return {
      overview: {
        uptime: process.uptime(),
        version: this.config.apm.version,
        environment: this.config.apm.environment,
        timestamp: new Date().toISOString()
      },
      http: this.metrics.http,
      database: this.metrics.database,
      cache: this.metrics.cache,
      system: this.metrics.system,
      vitals: this.getWebVitalsStats(),
      alerts: this.getActiveAlerts()
    };
  }

  /**
   * Get Core Web Vitals statistics
   */
  getWebVitalsStats() {
    const stats = {};

    Object.keys(this.metrics.vitals).forEach(vital => {
      const values = this.metrics.vitals[vital];
      if (values.length > 0) {
        stats[vital] = {
          count: values.length,
          avg: values.reduce((sum, val) => sum + val, 0) / values.length,
          p75: this.getPercentile(values, 75),
          p95: this.getPercentile(values, 95),
          min: Math.min(...values),
          max: Math.max(...values)
        };
      }
    });

    return stats;
  }

  /**
   * Get percentile value from array
   */
  getPercentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * (percentile / 100)) - 1;
    return sorted[index];
  }

  /**
   * Get active alerts
   */
  getActiveAlerts() {
    // This would typically fetch from a persistence layer
    // For now, return empty array
    return [];
  }

  /**
   * Initialize metrics object
   */
  initializeMetrics() {
    return {
      http: {
        requestCount: 0,
        errorCount: 0,
        slowRequests: 0,
        totalResponseTime: 0,
        averageResponseTime: 0
      },
      database: {
        queryCount: 0,
        slowQueries: 0,
        totalQueryTime: 0,
        averageQueryTime: 0
      },
      cache: {
        hits: 0,
        misses: 0,
        hitRatio: 0
      },
      system: {
        memoryUsage: {},
        cpuUsage: {}
      },
      vitals: {
        lcp: [],
        fid: [],
        cls: [],
        fcp: [],
        ttfb: []
      }
    };
  }
}

module.exports = PerformanceMonitor;