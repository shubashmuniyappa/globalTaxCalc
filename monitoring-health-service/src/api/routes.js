const express = require('express');
const rateLimit = require('express-rate-limit');
const { metricsManager } = require('../metrics');
const { healthManager } = require('../health');
const { alertManager } = require('../alerts/alertManager');
const { apmMonitor } = require('../performance/apmMonitor');
const { logger } = require('../logging/logger');
const LogAggregator = require('../logging/logAggregator');
const config = require('../config');

const router = express.Router();

const apiLimiter = rateLimit({
  windowMs: config.security.rateLimit.windowMs,
  max: config.security.rateLimit.max,
  message: {
    error: 'Too many requests from this IP, please try again later',
    retryAfter: Math.ceil(config.security.rateLimit.windowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false
});

const authenticateApiKey = (req, res, next) => {
  if (!config.security.apiKeyRequired) {
    return next();
  }

  const apiKey = req.header('X-API-Key') || req.query.apiKey;

  if (!apiKey || apiKey !== config.security.apiKey) {
    logger.logSecurityEvent('unauthorized_api_access', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      providedKey: apiKey ? 'present' : 'missing'
    });

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Valid API key required'
    });
  }

  next();
};

router.use(apiLimiter);

router.get('/health', async (req, res) => {
  try {
    const summary = await healthManager.getHealthSummary();
    const statusCode = summary.status === 'UP' ? 200 : summary.status === 'DEGRADED' ? 200 : 503;

    res.status(statusCode).json(summary);
  } catch (error) {
    logger.error('Health check endpoint error', { error: error.message });
    res.status(500).json({
      status: 'ERROR',
      message: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/health/liveness', async (req, res) => {
  try {
    const probe = await healthManager.getLivenessProbe();
    res.status(200).json(probe);
  } catch (error) {
    logger.error('Liveness probe error', { error: error.message });
    res.status(500).json({
      status: 'DOWN',
      error: 'Liveness probe failed'
    });
  }
});

router.get('/health/readiness', async (req, res) => {
  try {
    const probe = await healthManager.getReadinessProbe();
    const statusCode = probe.ready ? 200 : 503;
    res.status(statusCode).json(probe);
  } catch (error) {
    logger.error('Readiness probe error', { error: error.message });
    res.status(503).json({
      status: 'DOWN',
      ready: false,
      error: 'Readiness probe failed'
    });
  }
});

router.get('/health/startup', async (req, res) => {
  try {
    const probe = await healthManager.getStartupProbe();
    const statusCode = probe.ready ? 200 : 503;
    res.status(statusCode).json(probe);
  } catch (error) {
    logger.error('Startup probe error', { error: error.message });
    res.status(503).json({
      status: 'DOWN',
      ready: false,
      error: 'Startup probe failed'
    });
  }
});

router.get('/health/detailed', authenticateApiKey, async (req, res) => {
  try {
    const results = await healthManager.runAllChecks();
    const circuitBreakers = healthManager.getCircuitBreakerStatus();

    res.json({
      checks: results,
      circuitBreakers,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Detailed health check error', { error: error.message });
    res.status(500).json({
      error: 'Detailed health check failed',
      message: error.message
    });
  }
});

router.get('/metrics', async (req, res) => {
  try {
    const metrics = await metricsManager.getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    logger.error('Metrics endpoint error', { error: error.message });
    res.status(500).send('# Error collecting metrics\n');
  }
});

router.get('/metrics/summary', authenticateApiKey, async (req, res) => {
  try {
    const systemSummary = await metricsManager.getSystemSummary();
    const performanceSummary = apmMonitor.getPerformanceSummary();

    res.json({
      system: systemSummary,
      performance: performanceSummary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Metrics summary error', { error: error.message });
    res.status(500).json({
      error: 'Failed to get metrics summary',
      message: error.message
    });
  }
});

router.get('/performance', authenticateApiKey, async (req, res) => {
  try {
    const summary = apmMonitor.getPerformanceSummary();
    res.json(summary);
  } catch (error) {
    logger.error('Performance endpoint error', { error: error.message });
    res.status(500).json({
      error: 'Failed to get performance data',
      message: error.message
    });
  }
});

router.get('/logs/aggregations/:period', authenticateApiKey, async (req, res) => {
  try {
    const { period } = req.params;
    const limit = parseInt(req.query.limit) || 24;

    const validPeriods = ['1m', '5m', '15m', '1h', '24h'];
    if (!validPeriods.includes(period)) {
      return res.status(400).json({
        error: 'Invalid period',
        validPeriods
      });
    }

    const logAggregator = new LogAggregator();
    const aggregations = await logAggregator.getAggregations(period, limit);

    res.json({
      period,
      count: aggregations.length,
      aggregations
    });
  } catch (error) {
    logger.error('Log aggregations endpoint error', { error: error.message });
    res.status(500).json({
      error: 'Failed to get log aggregations',
      message: error.message
    });
  }
});

router.get('/logs/metrics', authenticateApiKey, async (req, res) => {
  try {
    const logAggregator = new LogAggregator();
    const summary = await logAggregator.getMetricsSummary();

    res.json(summary);
  } catch (error) {
    logger.error('Log metrics endpoint error', { error: error.message });
    res.status(500).json({
      error: 'Failed to get log metrics',
      message: error.message
    });
  }
});

router.get('/alerts', authenticateApiKey, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const status = req.query.status;

    let alerts;
    if (status === 'active') {
      alerts = alertManager.getActiveAlerts();
    } else {
      alerts = alertManager.getAlertHistory(limit);
    }

    res.json({
      count: alerts.length,
      alerts
    });
  } catch (error) {
    logger.error('Alerts endpoint error', { error: error.message });
    res.status(500).json({
      error: 'Failed to get alerts',
      message: error.message
    });
  }
});

router.post('/alerts', authenticateApiKey, async (req, res) => {
  try {
    const { title, description, severity, category, source, metadata } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['title', 'description']
      });
    }

    const alert = {
      title,
      description,
      severity: severity || 'warning',
      category: category || 'manual',
      source: source || 'api',
      metadata: metadata || {}
    };

    const alertId = await alertManager.sendAlert(alert);

    res.status(201).json({
      message: 'Alert sent successfully',
      alertId
    });
  } catch (error) {
    logger.error('Send alert endpoint error', { error: error.message });
    res.status(500).json({
      error: 'Failed to send alert',
      message: error.message
    });
  }
});

router.post('/alerts/:alertId/acknowledge', authenticateApiKey, async (req, res) => {
  try {
    const { alertId } = req.params;
    const { acknowledgedBy } = req.body;

    if (!acknowledgedBy) {
      return res.status(400).json({
        error: 'Missing required field: acknowledgedBy'
      });
    }

    await alertManager.acknowledgeAlert(alertId, acknowledgedBy);

    res.json({
      message: 'Alert acknowledged successfully',
      alertId,
      acknowledgedBy
    });
  } catch (error) {
    logger.error('Acknowledge alert endpoint error', { error: error.message });
    res.status(500).json({
      error: 'Failed to acknowledge alert',
      message: error.message
    });
  }
});

router.post('/alerts/:alertId/resolve', authenticateApiKey, async (req, res) => {
  try {
    const { alertId } = req.params;
    const { resolvedBy, resolution } = req.body;

    if (!resolvedBy) {
      return res.status(400).json({
        error: 'Missing required field: resolvedBy'
      });
    }

    await alertManager.resolveAlert(alertId, resolvedBy, resolution);

    res.json({
      message: 'Alert resolved successfully',
      alertId,
      resolvedBy,
      resolution
    });
  } catch (error) {
    logger.error('Resolve alert endpoint error', { error: error.message });
    res.status(500).json({
      error: 'Failed to resolve alert',
      message: error.message
    });
  }
});

router.post('/alerts/test', authenticateApiKey, async (req, res) => {
  try {
    const alertId = await alertManager.testAlertChannels();

    res.json({
      message: 'Test alerts sent successfully',
      alertId
    });
  } catch (error) {
    logger.error('Test alerts endpoint error', { error: error.message });
    res.status(500).json({
      error: 'Failed to send test alerts',
      message: error.message
    });
  }
});

router.get('/status', (req, res) => {
  const status = {
    service: config.service.name,
    version: config.service.version,
    environment: config.service.environment,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    pid: process.pid,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
    loadAverage: require('os').loadavg(),
    features: {
      metrics: metricsManager.isInitialized,
      healthChecks: healthManager.isInitialized,
      alerting: alertManager.isInitialized,
      apm: apmMonitor.isRunning,
      prometheus: config.prometheus.enabled,
      sentry: config.sentry.enabled,
      elasticsearch: config.elasticsearch.enabled
    }
  };

  res.json(status);
});

router.get('/config', authenticateApiKey, (req, res) => {
  const safeConfig = {
    service: config.service,
    server: {
      port: config.server.port,
      host: config.server.host,
      env: config.server.env
    },
    prometheus: {
      enabled: config.prometheus.enabled,
      port: config.prometheus.port,
      metricsPrefix: config.prometheus.metricsPrefix
    },
    healthCheck: {
      interval: config.healthCheck.interval,
      timeout: config.healthCheck.timeout,
      retries: config.healthCheck.retries
    },
    logging: {
      level: config.logging.level,
      format: config.logging.format,
      consoleEnabled: config.logging.consoleEnabled,
      fileEnabled: config.logging.fileEnabled
    },
    alerting: {
      enabled: config.alerting.enabled,
      email: { enabled: config.alerting.email.enabled },
      slack: { enabled: config.alerting.slack.enabled },
      pagerduty: { enabled: config.alerting.pagerduty.enabled },
      sms: { enabled: config.alerting.sms.enabled }
    },
    features: {
      systemMetrics: config.system.metricsEnabled,
      businessMetrics: config.business.metricsEnabled,
      performance: config.performance.apmEnabled,
      circuitBreaker: config.circuitBreaker.enabled,
      onCall: config.onCall.enabled
    }
  };

  res.json(safeConfig);
});

router.use((err, req, res, next) => {
  logger.error('API route error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;