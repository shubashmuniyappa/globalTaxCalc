const express = require('express');
const config = require('../config');
const logger = require('../utils/logger');
const redis = require('../utils/redis');
const serviceRegistry = require('../services/serviceRegistry');

const router = express.Router();

/**
 * Basic health check
 */
router.get('/', async (req, res) => {
  try {
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'api-gateway',
      version: '1.0.0',
      uptime: process.uptime(),
      environment: config.NODE_ENV
    };

    res.status(200).json(healthData);
  } catch (error) {
    logger.error('Health check failed:', error.message);

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'api-gateway',
      error: error.message
    });
  }
});

/**
 * Detailed health check with dependencies
 */
router.get('/detailed', async (req, res) => {
  const startTime = Date.now();
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'api-gateway',
    version: '1.0.0',
    uptime: process.uptime(),
    environment: config.NODE_ENV,
    checks: {}
  };

  let overallHealthy = true;

  // Check Redis connection
  try {
    const redisPing = await redis.ping();
    healthData.checks.redis = {
      status: redisPing === 'PONG' ? 'healthy' : 'unhealthy',
      responseTime: Date.now() - startTime,
      details: { ping: redisPing }
    };

    if (redisPing !== 'PONG') {
      overallHealthy = false;
    }
  } catch (error) {
    healthData.checks.redis = {
      status: 'unhealthy',
      error: error.message,
      responseTime: Date.now() - startTime
    };
    overallHealthy = false;
  }

  // Check service registry
  try {
    const serviceStats = serviceRegistry.getServiceStats();
    healthData.checks.services = {
      status: serviceStats.healthPercentage >= 80 ? 'healthy' : 'degraded',
      ...serviceStats
    };

    if (serviceStats.healthPercentage < 50) {
      overallHealthy = false;
    }
  } catch (error) {
    healthData.checks.services = {
      status: 'unhealthy',
      error: error.message
    };
    overallHealthy = false;
  }

  // Check memory usage
  const memoryUsage = process.memoryUsage();
  const memoryUsageMB = {
    rss: Math.round(memoryUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
    external: Math.round(memoryUsage.external / 1024 / 1024)
  };

  const memoryHealthy = memoryUsageMB.heapUsed < 500; // Warn if using more than 500MB

  healthData.checks.memory = {
    status: memoryHealthy ? 'healthy' : 'warning',
    usage: memoryUsageMB,
    unit: 'MB'
  };

  // Check CPU load (basic check)
  const cpuUsage = process.cpuUsage();
  healthData.checks.cpu = {
    status: 'healthy',
    user: cpuUsage.user,
    system: cpuUsage.system
  };

  // Set overall status
  healthData.status = overallHealthy ? 'healthy' : 'unhealthy';
  healthData.responseTime = Date.now() - startTime;

  const statusCode = overallHealthy ? 200 : 503;
  res.status(statusCode).json(healthData);
});

/**
 * Check all downstream services
 */
router.get('/services', async (req, res) => {
  try {
    const services = serviceRegistry.getRegisteredServices();
    const serviceStats = serviceRegistry.getServiceStats();

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      summary: serviceStats,
      services
    });
  } catch (error) {
    logger.error('Service health check failed:', error.message);

    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * Check specific service health
 */
router.get('/services/:serviceName', async (req, res) => {
  const { serviceName } = req.params;

  try {
    const isHealthy = await serviceRegistry.checkServiceHealth(serviceName);
    const service = serviceRegistry.getRegisteredServices()[serviceName];

    if (!service) {
      return res.status(404).json({
        status: 'not_found',
        message: `Service '${serviceName}' not registered`,
        timestamp: new Date().toISOString()
      });
    }

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      service: service,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Health check failed for service ${serviceName}:`, error.message);

    res.status(503).json({
      status: 'error',
      service: serviceName,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Readiness probe (for Kubernetes)
 */
router.get('/ready', async (req, res) => {
  try {
    // Check if service registry is initialized
    if (!serviceRegistry.initialized) {
      return res.status(503).json({
        status: 'not_ready',
        message: 'Service registry not initialized',
        timestamp: new Date().toISOString()
      });
    }

    // Check if Redis is available
    const redisPing = await redis.ping();
    if (redisPing !== 'PONG') {
      return res.status(503).json({
        status: 'not_ready',
        message: 'Redis connection not available',
        timestamp: new Date().toISOString()
      });
    }

    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Readiness check failed:', error.message);

    res.status(503).json({
      status: 'not_ready',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Liveness probe (for Kubernetes)
 */
router.get('/live', (req, res) => {
  // Simple check - if the process is running, it's alive
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    pid: process.pid
  });
});

/**
 * Metrics endpoint (basic metrics)
 */
router.get('/metrics', async (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      services: serviceRegistry.getServiceStats(),
      process: {
        pid: process.pid,
        platform: process.platform,
        arch: process.arch,
        version: process.version
      }
    };

    // Add Redis metrics if available
    try {
      const redisInfo = await redis.getInfo();
      if (redisInfo) {
        metrics.redis = { connected: true };
      }
    } catch {
      metrics.redis = { connected: false };
    }

    res.status(200).json(metrics);
  } catch (error) {
    logger.error('Metrics collection failed:', error.message);

    res.status(500).json({
      error: 'Failed to collect metrics',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;