const express = require('express');
const router = express.Router();
const database = require('../utils/database');
const metrics = require('../utils/metrics');
const config = require('../config');
const { User, Session } = require('../models');

class HealthController {
  // Basic health check
  async healthCheck(req, res) {
    try {
      const startTime = Date.now();

      // Check database connectivity
      const dbHealth = await database.healthCheck();

      // Get basic system info
      const systemInfo = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: config.NODE_ENV,
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
        pid: process.pid,
        responseTime: Date.now() - startTime
      };

      // Combine with database health
      const health = {
        ...systemInfo,
        database: dbHealth,
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      };

      // Determine overall health status
      if (dbHealth.status !== 'healthy') {
        health.status = 'degraded';
        return res.status(503).json(health);
      }

      res.json(health);

    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
        uptime: process.uptime()
      });
    }
  }

  // Detailed health check with metrics
  async detailedHealth(req, res) {
    try {
      const startTime = Date.now();

      // Get all health information
      const [dbHealth, metricsData] = await Promise.all([
        database.healthCheck(),
        Promise.resolve(metrics.getMetrics())
      ]);

      // Check database statistics
      const dbStats = await this.getDatabaseStats();

      // System health indicators
      const memUsage = process.memoryUsage();
      const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        system: {
          uptime: process.uptime(),
          version: process.env.npm_package_version || '1.0.0',
          environment: config.NODE_ENV,
          nodeVersion: process.version,
          platform: process.platform,
          pid: process.pid,
          memory: {
            ...memUsage,
            usagePercent: memUsagePercent.toFixed(2) + '%'
          },
          cpu: process.cpuUsage()
        },
        database: {
          ...dbHealth,
          statistics: dbStats
        },
        metrics: metricsData,
        dependencies: await this.checkDependencies()
      };

      // Determine health status
      health.status = this.determineHealthStatus(health);

      const statusCode = health.status === 'healthy' ? 200 :
                        health.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json(health);

    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
        uptime: process.uptime()
      });
    }
  }

  // Ready check for Kubernetes
  async readyCheck(req, res) {
    try {
      // Check if service is ready to accept traffic
      const checks = await Promise.all([
        database.isReady(),
        this.checkRequiredServices()
      ]);

      const isReady = checks.every(check => check === true);

      if (isReady) {
        res.json({
          status: 'ready',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(503).json({
          status: 'not ready',
          timestamp: new Date().toISOString(),
          checks: {
            database: checks[0],
            services: checks[1]
          }
        });
      }

    } catch (error) {
      res.status(503).json({
        status: 'not ready',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Liveness check for Kubernetes
  async livenessCheck(req, res) {
    try {
      // Basic check to see if the service is alive
      const alive = process.uptime() > 0;

      if (alive) {
        res.json({
          status: 'alive',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          pid: process.pid
        });
      } else {
        res.status(503).json({
          status: 'dead',
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      res.status(503).json({
        status: 'dead',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Get application metrics
  async getMetrics(req, res) {
    try {
      const metricsData = metrics.getMetrics();
      res.json(metricsData);

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve metrics',
        error: error.message
      });
    }
  }

  // Get metrics summary
  async getMetricsSummary(req, res) {
    try {
      const summary = metrics.getSummary();
      res.json(summary);

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve metrics summary',
        error: error.message
      });
    }
  }

  // Helper methods
  async getDatabaseStats() {
    try {
      const [userCount, sessionCount] = await Promise.all([
        User.count(),
        Session.count({ where: { isActive: true } })
      ]);

      return {
        users: {
          total: userCount,
          active: await User.count({ where: { isActive: true } }),
          verified: await User.count({ where: { emailVerified: true } })
        },
        sessions: {
          active: sessionCount,
          guest: await Session.count({
            where: { sessionType: 'guest', isActive: true }
          }),
          authenticated: await Session.count({
            where: { sessionType: 'authenticated', isActive: true }
          })
        }
      };

    } catch (error) {
      return {
        error: 'Failed to retrieve database statistics',
        message: error.message
      };
    }
  }

  async checkDependencies() {
    const dependencies = {};

    // Check Redis (if configured)
    if (config.REDIS_URL) {
      try {
        const redis = require('redis');
        const client = redis.createClient({ url: config.REDIS_URL });
        await client.ping();
        await client.quit();
        dependencies.redis = { status: 'healthy' };
      } catch (error) {
        dependencies.redis = {
          status: 'unhealthy',
          error: error.message
        };
      }
    }

    // Check email service (if configured)
    if (config.SENDGRID_API_KEY || config.SMTP_HOST) {
      try {
        const emailService = require('../services/emailService');
        dependencies.email = {
          status: 'configured',
          provider: config.SENDGRID_API_KEY ? 'sendgrid' : 'smtp'
        };
      } catch (error) {
        dependencies.email = {
          status: 'error',
          error: error.message
        };
      }
    }

    return dependencies;
  }

  async checkRequiredServices() {
    try {
      // Check if all required services are available
      const dbReady = database.isReady();

      // Add other service checks here as needed
      return dbReady;

    } catch (error) {
      return false;
    }
  }

  determineHealthStatus(health) {
    // Check database health
    if (health.database.status !== 'healthy') {
      return 'critical';
    }

    // Check memory usage
    const memUsage = health.system.memory.usagePercent;
    if (parseFloat(memUsage) > 90) {
      return 'critical';
    }

    // Check metrics for issues
    const metricsStatus = metrics.getHealthStatus(health.metrics);
    if (metricsStatus === 'critical') {
      return 'critical';
    }

    if (metricsStatus === 'warning' || parseFloat(memUsage) > 75) {
      return 'degraded';
    }

    return 'healthy';
  }
}

const healthController = new HealthController();

// Routes
router.get('/health', healthController.healthCheck.bind(healthController));
router.get('/health/detailed', healthController.detailedHealth.bind(healthController));
router.get('/ready', healthController.readyCheck.bind(healthController));
router.get('/live', healthController.livenessCheck.bind(healthController));
router.get('/metrics', healthController.getMetrics.bind(healthController));
router.get('/metrics/summary', healthController.getMetricsSummary.bind(healthController));

module.exports = router;