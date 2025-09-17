const EventEmitter = require('events');
const config = require('../config');

class MetricsCollector extends EventEmitter {
  constructor() {
    super();
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        errors: 0,
        responseTime: {
          sum: 0,
          count: 0,
          min: Infinity,
          max: 0
        }
      },
      auth: {
        registrations: 0,
        logins: 0,
        loginFailures: 0,
        logouts: 0,
        tokenRefreshes: 0,
        passwordResets: 0
      },
      oauth: {
        googleLogins: 0,
        appleLogins: 0,
        oauthFailures: 0
      },
      security: {
        suspiciousRequests: 0,
        rateLimitHits: 0,
        accountLockouts: 0,
        twoFactorAttempts: 0
      },
      database: {
        queries: 0,
        queryTime: {
          sum: 0,
          count: 0,
          min: Infinity,
          max: 0
        },
        connections: 0,
        errors: 0
      },
      system: {
        startTime: Date.now(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      }
    };

    this.intervals = [];
    this.setupSystemMetrics();
  }

  setupSystemMetrics() {
    // Update system metrics every 30 seconds
    const systemInterval = setInterval(() => {
      this.metrics.system.memoryUsage = process.memoryUsage();
      this.metrics.system.cpuUsage = process.cpuUsage();
      this.emit('system_metrics_updated', this.metrics.system);
    }, 30000);

    this.intervals.push(systemInterval);
  }

  // Request metrics
  recordRequest(method, path, statusCode, responseTime, userId = null) {
    this.metrics.requests.total++;

    if (statusCode >= 200 && statusCode < 400) {
      this.metrics.requests.success++;
    } else if (statusCode >= 400) {
      this.metrics.requests.errors++;
    }

    this.updateResponseTimeMetrics(responseTime);

    this.emit('request_recorded', {
      method,
      path,
      statusCode,
      responseTime,
      userId,
      timestamp: Date.now()
    });
  }

  updateResponseTimeMetrics(responseTime) {
    const rt = this.metrics.requests.responseTime;
    rt.sum += responseTime;
    rt.count++;
    rt.min = Math.min(rt.min, responseTime);
    rt.max = Math.max(rt.max, responseTime);
  }

  // Auth metrics
  recordAuth(event, details = {}) {
    switch (event) {
      case 'registration':
        this.metrics.auth.registrations++;
        break;
      case 'login':
        this.metrics.auth.logins++;
        break;
      case 'login_failure':
        this.metrics.auth.loginFailures++;
        break;
      case 'logout':
        this.metrics.auth.logouts++;
        break;
      case 'token_refresh':
        this.metrics.auth.tokenRefreshes++;
        break;
      case 'password_reset':
        this.metrics.auth.passwordResets++;
        break;
    }

    this.emit('auth_event', { event, details, timestamp: Date.now() });
  }

  // OAuth metrics
  recordOAuth(provider, success, details = {}) {
    if (success) {
      if (provider === 'google') {
        this.metrics.oauth.googleLogins++;
      } else if (provider === 'apple') {
        this.metrics.oauth.appleLogins++;
      }
    } else {
      this.metrics.oauth.oauthFailures++;
    }

    this.emit('oauth_event', {
      provider,
      success,
      details,
      timestamp: Date.now()
    });
  }

  // Security metrics
  recordSecurity(event, details = {}) {
    switch (event) {
      case 'suspicious_request':
        this.metrics.security.suspiciousRequests++;
        break;
      case 'rate_limit_hit':
        this.metrics.security.rateLimitHits++;
        break;
      case 'account_lockout':
        this.metrics.security.accountLockouts++;
        break;
      case 'two_factor_attempt':
        this.metrics.security.twoFactorAttempts++;
        break;
    }

    this.emit('security_event', { event, details, timestamp: Date.now() });
  }

  // Database metrics
  recordDatabase(operation, duration, table = null, success = true) {
    this.metrics.database.queries++;

    if (!success) {
      this.metrics.database.errors++;
    }

    const dbTime = this.metrics.database.queryTime;
    dbTime.sum += duration;
    dbTime.count++;
    dbTime.min = Math.min(dbTime.min, duration);
    dbTime.max = Math.max(dbTime.max, duration);

    this.emit('database_event', {
      operation,
      duration,
      table,
      success,
      timestamp: Date.now()
    });
  }

  // Get current metrics
  getMetrics() {
    const now = Date.now();
    const uptime = now - this.metrics.system.startTime;

    return {
      ...this.metrics,
      computed: {
        uptime,
        averageResponseTime: this.metrics.requests.responseTime.count > 0
          ? this.metrics.requests.responseTime.sum / this.metrics.requests.responseTime.count
          : 0,
        successRate: this.metrics.requests.total > 0
          ? (this.metrics.requests.success / this.metrics.requests.total) * 100
          : 0,
        errorRate: this.metrics.requests.total > 0
          ? (this.metrics.requests.errors / this.metrics.requests.total) * 100
          : 0,
        averageDbQueryTime: this.metrics.database.queryTime.count > 0
          ? this.metrics.database.queryTime.sum / this.metrics.database.queryTime.count
          : 0,
        authSuccessRate: (this.metrics.auth.logins + this.metrics.auth.loginFailures) > 0
          ? (this.metrics.auth.logins / (this.metrics.auth.logins + this.metrics.auth.loginFailures)) * 100
          : 0
      },
      timestamp: now
    };
  }

  // Get metrics summary
  getSummary() {
    const metrics = this.getMetrics();

    return {
      status: this.getHealthStatus(metrics),
      uptime: metrics.computed.uptime,
      requests: {
        total: metrics.requests.total,
        successRate: metrics.computed.successRate.toFixed(2) + '%',
        averageResponseTime: metrics.computed.averageResponseTime.toFixed(2) + 'ms'
      },
      auth: {
        totalLogins: metrics.auth.logins,
        successRate: metrics.computed.authSuccessRate.toFixed(2) + '%'
      },
      database: {
        totalQueries: metrics.database.queries,
        averageQueryTime: metrics.computed.averageDbQueryTime.toFixed(2) + 'ms'
      },
      security: {
        suspiciousRequests: metrics.security.suspiciousRequests,
        rateLimitHits: metrics.security.rateLimitHits
      },
      timestamp: metrics.timestamp
    };
  }

  // Determine health status based on metrics
  getHealthStatus(metrics) {
    const { computed } = metrics;

    // Critical thresholds
    if (computed.errorRate > 50 || computed.averageResponseTime > 5000) {
      return 'critical';
    }

    // Warning thresholds
    if (computed.errorRate > 20 || computed.averageResponseTime > 2000 ||
        metrics.security.suspiciousRequests > 100) {
      return 'warning';
    }

    return 'healthy';
  }

  // Reset metrics
  reset() {
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        errors: 0,
        responseTime: {
          sum: 0,
          count: 0,
          min: Infinity,
          max: 0
        }
      },
      auth: {
        registrations: 0,
        logins: 0,
        loginFailures: 0,
        logouts: 0,
        tokenRefreshes: 0,
        passwordResets: 0
      },
      oauth: {
        googleLogins: 0,
        appleLogins: 0,
        oauthFailures: 0
      },
      security: {
        suspiciousRequests: 0,
        rateLimitHits: 0,
        accountLockouts: 0,
        twoFactorAttempts: 0
      },
      database: {
        queries: 0,
        queryTime: {
          sum: 0,
          count: 0,
          min: Infinity,
          max: 0
        },
        connections: 0,
        errors: 0
      },
      system: {
        startTime: Date.now(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      }
    };

    this.emit('metrics_reset', { timestamp: Date.now() });
  }

  // Express middleware for automatic metrics collection
  getMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();

      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        this.recordRequest(
          req.method,
          req.originalUrl,
          res.statusCode,
          responseTime,
          req.user?.id
        );
      });

      next();
    };
  }

  // Cleanup
  destroy() {
    this.intervals.forEach(interval => clearInterval(interval));
    this.removeAllListeners();
  }
}

// Create singleton instance
const metrics = new MetricsCollector();

module.exports = metrics;