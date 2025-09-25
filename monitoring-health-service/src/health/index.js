const {
  HealthChecker,
  createDatabaseHealthCheck,
  createRedisHealthCheck,
  createServiceHealthCheck,
  createMemoryHealthCheck
} = require('./healthChecker');
const config = require('../config');

class HealthManager {
  constructor() {
    this.healthChecker = new HealthChecker();
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      console.warn('Health manager already initialized');
      return;
    }

    try {
      await this.registerStandardChecks();

      if (config.healthCheck.dependencyCheckEnabled) {
        await this.registerDependencyChecks();
      }

      if (config.healthCheck.interval > 0) {
        this.healthChecker.start();
      }

      this.isInitialized = true;
      console.log('Health manager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize health manager:', error);
      throw error;
    }
  }

  async registerStandardChecks() {
    this.healthChecker.registerCheck(
      'memory',
      createMemoryHealthCheck(0.85),
      {
        timeout: 1000,
        retries: 1,
        critical: true,
        tags: ['system', 'memory'],
        metadata: { type: 'system_resource' }
      }
    );

    this.healthChecker.registerCheck(
      'disk_space',
      async () => {
        const fs = require('fs');
        const { promisify } = require('util');
        const statvfs = promisify(fs.stat);

        try {
          await statvfs('.');
          return {
            message: 'Disk space is accessible',
            metadata: { type: 'disk_access' }
          };
        } catch (error) {
          throw new Error('Cannot access disk: ' + error.message);
        }
      },
      {
        timeout: 2000,
        retries: 1,
        critical: true,
        tags: ['system', 'disk'],
        metadata: { type: 'system_resource' }
      }
    );

    this.healthChecker.registerCheck(
      'node_version',
      async () => {
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

        if (majorVersion < 18) {
          throw new Error(`Node.js version ${nodeVersion} is below minimum requirement (18.x)`);
        }

        return {
          message: `Node.js version ${nodeVersion} is supported`,
          metadata: {
            version: nodeVersion,
            majorVersion
          }
        };
      },
      {
        timeout: 500,
        retries: 1,
        critical: false,
        tags: ['system', 'runtime'],
        metadata: { type: 'runtime_check' }
      }
    );
  }

  async registerDependencyChecks() {
    if (config.database.type === 'mysql') {
      this.healthChecker.registerCheck(
        'database',
        await createDatabaseHealthCheck(config.database, 'primary'),
        {
          timeout: config.healthCheck.timeout,
          retries: config.healthCheck.retries,
          critical: true,
          tags: ['database', 'mysql'],
          metadata: {
            type: 'database',
            host: config.database.host,
            port: config.database.port
          }
        }
      );
    }

    if (config.redis.enabled) {
      this.healthChecker.registerCheck(
        'redis',
        await createRedisHealthCheck(config.redis),
        {
          timeout: config.healthCheck.timeout,
          retries: config.healthCheck.retries,
          critical: false,
          tags: ['cache', 'redis'],
          metadata: {
            type: 'cache',
            url: config.redis.url
          }
        }
      );
    }

    const services = [
      { name: 'calculation-service', url: config.services.calculationService },
      { name: 'comparison-service', url: config.services.comparisonService },
      { name: 'report-service', url: config.services.reportService },
      { name: 'user-service', url: config.services.userService }
    ];

    services.forEach(service => {
      this.healthChecker.registerCheck(
        service.name,
        createServiceHealthCheck(service.name, service.url),
        {
          timeout: config.healthCheck.timeout,
          retries: 2,
          critical: false,
          tags: ['service', 'microservice'],
          metadata: {
            type: 'external_service',
            service: service.name,
            url: service.url
          }
        }
      );
    });

    if (config.elasticsearch.enabled) {
      this.healthChecker.registerCheck(
        'elasticsearch',
        createServiceHealthCheck('elasticsearch', config.elasticsearch.node),
        {
          timeout: config.healthCheck.timeout,
          retries: config.healthCheck.retries,
          critical: false,
          tags: ['logging', 'elasticsearch'],
          metadata: {
            type: 'logging_service',
            node: config.elasticsearch.node
          }
        }
      );
    }
  }

  registerCustomCheck(name, checkFunction, options = {}) {
    this.healthChecker.registerCheck(name, checkFunction, options);
  }

  async runCheck(name) {
    return await this.healthChecker.runCheck(name);
  }

  async runAllChecks() {
    return await this.healthChecker.runAllChecks();
  }

  async getHealthSummary() {
    return await this.healthChecker.getHealthSummary();
  }

  getLastResults() {
    return this.healthChecker.getLastResults();
  }

  getCircuitBreakerStatus() {
    return this.healthChecker.getCircuitBreakerStatus();
  }

  async shutdown() {
    if (!this.isInitialized) {
      return;
    }

    this.healthChecker.stop();
    this.isInitialized = false;
    console.log('Health manager shut down');
  }

  async getLivenessProbe() {
    return {
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      pid: process.pid,
      version: require('../../package.json').version
    };
  }

  async getReadinessProbe() {
    const summary = await this.getHealthSummary();

    return {
      status: summary.status === 'DOWN' ? 'DOWN' : 'UP',
      timestamp: summary.timestamp,
      ready: summary.status !== 'DOWN',
      criticalFailures: summary.criticalFailures,
      checks: Object.keys(summary.checks).reduce((acc, key) => {
        const check = summary.checks[key];
        acc[key] = {
          status: check.status,
          critical: this.healthChecker.checks.get(key)?.critical || false
        };
        return acc;
      }, {})
    };
  }

  async getStartupProbe() {
    const critical = ['memory', 'disk_space'];
    const results = {};
    let allCriticalUp = true;

    for (const checkName of critical) {
      try {
        const result = await this.healthChecker.runCheck(checkName);
        results[checkName] = result;
        if (result.status !== 'UP') {
          allCriticalUp = false;
        }
      } catch (error) {
        results[checkName] = {
          name: checkName,
          status: 'ERROR',
          message: error.message,
          timestamp: new Date().toISOString()
        };
        allCriticalUp = false;
      }
    }

    return {
      status: allCriticalUp ? 'UP' : 'DOWN',
      timestamp: new Date().toISOString(),
      ready: allCriticalUp,
      checks: results
    };
  }
}

const healthManager = new HealthManager();

module.exports = {
  healthManager,
  HealthManager,
  HealthChecker,
  createDatabaseHealthCheck,
  createRedisHealthCheck,
  createServiceHealthCheck,
  createMemoryHealthCheck
};