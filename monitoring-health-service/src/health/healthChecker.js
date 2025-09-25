const axios = require('axios');
const mysql = require('mysql2/promise');
const redis = require('redis');
const config = require('../config');

class HealthChecker {
  constructor() {
    this.checks = new Map();
    this.results = new Map();
    this.isRunning = false;
    this.interval = null;
    this.circuitBreakers = new Map();
  }

  registerCheck(name, checkFunction, options = {}) {
    this.checks.set(name, {
      fn: checkFunction,
      timeout: options.timeout || config.healthCheck.timeout,
      retries: options.retries || config.healthCheck.retries,
      critical: options.critical !== false,
      tags: options.tags || [],
      metadata: options.metadata || {}
    });

    if (config.circuitBreaker.enabled) {
      this.circuitBreakers.set(name, {
        state: 'CLOSED',
        failures: 0,
        lastFailureTime: null,
        nextAttempt: null
      });
    }
  }

  async runCheck(name) {
    const check = this.checks.get(name);
    if (!check) {
      throw new Error(`Health check '${name}' not found`);
    }

    const circuitBreaker = this.circuitBreakers.get(name);
    if (circuitBreaker && circuitBreaker.state === 'OPEN') {
      if (Date.now() < circuitBreaker.nextAttempt) {
        return {
          name,
          status: 'CIRCUIT_OPEN',
          message: 'Circuit breaker is open',
          timestamp: new Date().toISOString(),
          duration: 0
        };
      } else {
        circuitBreaker.state = 'HALF_OPEN';
      }
    }

    const startTime = Date.now();
    let attempt = 0;
    let lastError = null;

    while (attempt < check.retries) {
      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Health check timeout')), check.timeout);
        });

        const result = await Promise.race([
          check.fn(),
          timeoutPromise
        ]);

        const duration = Date.now() - startTime;

        if (circuitBreaker) {
          if (circuitBreaker.state === 'HALF_OPEN') {
            circuitBreaker.state = 'CLOSED';
          }
          circuitBreaker.failures = 0;
          circuitBreaker.lastFailureTime = null;
        }

        return {
          name,
          status: 'UP',
          message: result?.message || 'Health check passed',
          timestamp: new Date().toISOString(),
          duration,
          metadata: result?.metadata || check.metadata,
          tags: check.tags
        };

      } catch (error) {
        lastError = error;
        attempt++;

        if (attempt < check.retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    const duration = Date.now() - startTime;

    if (circuitBreaker) {
      circuitBreaker.failures++;
      circuitBreaker.lastFailureTime = Date.now();

      if (circuitBreaker.failures >= config.circuitBreaker.threshold) {
        circuitBreaker.state = 'OPEN';
        circuitBreaker.nextAttempt = Date.now() + config.circuitBreaker.resetTimeout;
      }
    }

    return {
      name,
      status: 'DOWN',
      message: lastError?.message || 'Health check failed',
      error: lastError?.stack,
      timestamp: new Date().toISOString(),
      duration,
      attempts: attempt,
      metadata: check.metadata,
      tags: check.tags
    };
  }

  async runAllChecks() {
    const results = {};
    const promises = Array.from(this.checks.keys()).map(async (name) => {
      try {
        const result = await this.runCheck(name);
        results[name] = result;
        this.results.set(name, result);
      } catch (error) {
        results[name] = {
          name,
          status: 'ERROR',
          message: error.message,
          timestamp: new Date().toISOString(),
          duration: 0
        };
      }
    });

    await Promise.all(promises);
    return results;
  }

  async getHealthSummary() {
    const results = await this.runAllChecks();
    const checks = Object.values(results);

    const summary = {
      status: 'UP',
      timestamp: new Date().toISOString(),
      totalChecks: checks.length,
      passedChecks: 0,
      failedChecks: 0,
      criticalFailures: 0,
      checks: results
    };

    checks.forEach(check => {
      if (check.status === 'UP') {
        summary.passedChecks++;
      } else {
        summary.failedChecks++;

        const checkConfig = this.checks.get(check.name);
        if (checkConfig?.critical) {
          summary.criticalFailures++;
        }
      }
    });

    if (summary.criticalFailures > 0) {
      summary.status = 'DOWN';
    } else if (summary.failedChecks > 0) {
      summary.status = 'DEGRADED';
    }

    return summary;
  }

  start() {
    if (this.isRunning) {
      console.warn('Health checker is already running');
      return;
    }

    this.isRunning = true;
    console.log(`Starting health checker with ${config.healthCheck.interval}ms interval`);

    this.interval = setInterval(async () => {
      try {
        await this.runAllChecks();
      } catch (error) {
        console.error('Error running health checks:', error);
      }
    }, config.healthCheck.interval);

    this.runAllChecks();
  }

  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    console.log('Health checker stopped');
  }

  getLastResults() {
    const results = {};
    for (const [name, result] of this.results.entries()) {
      results[name] = result;
    }
    return results;
  }

  getCircuitBreakerStatus() {
    const status = {};
    for (const [name, breaker] of this.circuitBreakers.entries()) {
      status[name] = {
        state: breaker.state,
        failures: breaker.failures,
        lastFailureTime: breaker.lastFailureTime,
        nextAttempt: breaker.nextAttempt
      };
    }
    return status;
  }
}

async function createDatabaseHealthCheck(connectionConfig, database = 'default') {
  return async () => {
    let connection;
    try {
      connection = await mysql.createConnection({
        host: connectionConfig.host,
        port: connectionConfig.port,
        user: connectionConfig.user,
        password: connectionConfig.password,
        database: connectionConfig.name,
        connectTimeout: 5000,
        acquireTimeout: 5000
      });

      const [rows] = await connection.execute('SELECT 1 as health_check');

      if (rows[0].health_check === 1) {
        return {
          message: `Database ${database} is healthy`,
          metadata: {
            database,
            host: connectionConfig.host,
            port: connectionConfig.port
          }
        };
      } else {
        throw new Error('Database health check query returned unexpected result');
      }
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  };
}

async function createRedisHealthCheck(redisConfig) {
  return async () => {
    let client;
    try {
      client = redis.createClient({
        url: redisConfig.url,
        password: redisConfig.password,
        database: redisConfig.db
      });

      await client.connect();
      const pong = await client.ping();

      if (pong === 'PONG') {
        return {
          message: 'Redis is healthy',
          metadata: {
            url: redisConfig.url,
            database: redisConfig.db
          }
        };
      } else {
        throw new Error('Redis ping returned unexpected response');
      }
    } finally {
      if (client) {
        await client.disconnect();
      }
    }
  };
}

function createServiceHealthCheck(serviceName, serviceUrl) {
  return async () => {
    const healthUrl = `${serviceUrl}${config.services.endpoints.health}`;

    const response = await axios.get(healthUrl, {
      timeout: config.healthCheck.timeout,
      validateStatus: (status) => status === 200
    });

    if (response.status === 200) {
      return {
        message: `Service ${serviceName} is healthy`,
        metadata: {
          service: serviceName,
          url: healthUrl,
          responseTime: response.headers['x-response-time'] || 'unknown'
        }
      };
    } else {
      throw new Error(`Service ${serviceName} returned status ${response.status}`);
    }
  };
}

function createMemoryHealthCheck(threshold = 0.9) {
  return async () => {
    const usage = process.memoryUsage();
    const used = usage.heapUsed;
    const total = usage.heapTotal;
    const usageRatio = used / total;

    if (usageRatio > threshold) {
      throw new Error(`Memory usage is ${(usageRatio * 100).toFixed(2)}% (threshold: ${(threshold * 100)}%)`);
    }

    return {
      message: `Memory usage is healthy: ${(usageRatio * 100).toFixed(2)}%`,
      metadata: {
        heapUsed: used,
        heapTotal: total,
        usagePercent: (usageRatio * 100).toFixed(2)
      }
    };
  };
}

module.exports = {
  HealthChecker,
  createDatabaseHealthCheck,
  createRedisHealthCheck,
  createServiceHealthCheck,
  createMemoryHealthCheck
};