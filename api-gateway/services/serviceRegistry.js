const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const redis = require('../utils/redis');
const { ServiceUnavailableError } = require('../middleware/errorHandler');

class ServiceRegistry {
  constructor() {
    this.services = new Map();
    this.healthCheckInterval = null;
    this.initialized = false;
  }

  /**
   * Initialize the service registry
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing service registry...');

    // Register all configured services
    for (const [serviceName, serviceUrl] of Object.entries(config.SERVICES)) {
      await this.registerService(serviceName, serviceUrl);
    }

    // Start health check monitoring
    this.startHealthCheck();

    this.initialized = true;
    logger.info(`Service registry initialized with ${this.services.size} services`);
  }

  /**
   * Register a service
   */
  async registerService(serviceName, serviceUrl, metadata = {}) {
    const service = {
      name: serviceName,
      url: serviceUrl,
      healthy: false,
      lastHealthCheck: null,
      failureCount: 0,
      metadata: {
        registeredAt: new Date().toISOString(),
        ...metadata
      }
    };

    this.services.set(serviceName, service);

    // Perform initial health check
    await this.checkServiceHealth(serviceName);

    // Cache service info in Redis
    await this.cacheServiceInfo(serviceName, service);

    logger.info(`Service registered: ${serviceName} -> ${serviceUrl}`);
  }

  /**
   * Get service URL with load balancing
   */
  getServiceUrl(serviceName) {
    const service = this.services.get(serviceName);

    if (!service) {
      throw new ServiceUnavailableError(serviceName, `Service ${serviceName} not registered`);
    }

    if (!service.healthy) {
      throw new ServiceUnavailableError(serviceName, `Service ${serviceName} is unhealthy`);
    }

    return service.url;
  }

  /**
   * Get healthy service URL with failover
   */
  async getHealthyServiceUrl(serviceName) {
    const service = this.services.get(serviceName);

    if (!service) {
      throw new ServiceUnavailableError(serviceName, `Service ${serviceName} not registered`);
    }

    // If service is healthy, return it
    if (service.healthy) {
      return service.url;
    }

    // Try to recover the service
    logger.info(`Attempting to recover service: ${serviceName}`);
    await this.checkServiceHealth(serviceName);

    const updatedService = this.services.get(serviceName);
    if (updatedService.healthy) {
      return updatedService.url;
    }

    throw new ServiceUnavailableError(serviceName, `Service ${serviceName} is currently unavailable`);
  }

  /**
   * Check health of a specific service
   */
  async checkServiceHealth(serviceName) {
    const service = this.services.get(serviceName);

    if (!service) {
      return false;
    }

    try {
      const healthUrl = `${service.url}/health`;

      const response = await axios.get(healthUrl, {
        timeout: config.HEALTH_CHECK_TIMEOUT,
        validateStatus: (status) => status < 400
      });

      // Service is healthy
      service.healthy = true;
      service.lastHealthCheck = new Date().toISOString();
      service.failureCount = 0;

      // Update metadata with health info
      if (response.data) {
        service.metadata.healthData = {
          status: response.data.status,
          uptime: response.data.uptime,
          version: response.data.version,
          checkedAt: new Date().toISOString()
        };
      }

      await this.cacheServiceInfo(serviceName, service);

      logger.debug(`Health check passed: ${serviceName}`);
      return true;

    } catch (error) {
      // Service is unhealthy
      service.healthy = false;
      service.lastHealthCheck = new Date().toISOString();
      service.failureCount += 1;

      logger.warn(`Health check failed for ${serviceName}:`, {
        error: error.message,
        failureCount: service.failureCount,
        url: service.url
      });

      // If service fails multiple times, consider it dead
      if (service.failureCount >= 3) {
        logger.error(`Service ${serviceName} marked as critical after ${service.failureCount} failures`);

        // Notify monitoring service
        await this.notifyServiceFailure(serviceName, service);
      }

      await this.cacheServiceInfo(serviceName, service);
      return false;
    }
  }

  /**
   * Start periodic health checks
   */
  startHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      logger.debug('Running health checks for all services...');

      const healthPromises = Array.from(this.services.keys()).map(serviceName =>
        this.checkServiceHealth(serviceName)
      );

      try {
        await Promise.all(healthPromises);
      } catch (error) {
        logger.error('Error during health check batch:', error.message);
      }
    }, config.HEALTH_CHECK_INTERVAL);

    logger.info(`Health check monitoring started (interval: ${config.HEALTH_CHECK_INTERVAL}ms)`);
  }

  /**
   * Stop health check monitoring
   */
  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('Health check monitoring stopped');
    }
  }

  /**
   * Get all registered services
   */
  getRegisteredServices() {
    const serviceList = {};

    for (const [name, service] of this.services) {
      serviceList[name] = {
        name: service.name,
        url: service.url,
        healthy: service.healthy,
        lastHealthCheck: service.lastHealthCheck,
        failureCount: service.failureCount,
        metadata: service.metadata
      };
    }

    return serviceList;
  }

  /**
   * Get service statistics
   */
  getServiceStats() {
    const totalServices = this.services.size;
    const healthyServices = Array.from(this.services.values()).filter(s => s.healthy).length;
    const unhealthyServices = totalServices - healthyServices;

    return {
      total: totalServices,
      healthy: healthyServices,
      unhealthy: unhealthyServices,
      healthPercentage: totalServices > 0 ? (healthyServices / totalServices) * 100 : 0
    };
  }

  /**
   * Cache service information in Redis
   */
  async cacheServiceInfo(serviceName, service) {
    try {
      const cacheKey = `service:${serviceName}`;
      const cacheData = {
        ...service,
        cachedAt: new Date().toISOString()
      };

      await redis.setex(cacheKey, 300, JSON.stringify(cacheData)); // 5 minutes TTL
    } catch (error) {
      logger.warn(`Failed to cache service info for ${serviceName}:`, error.message);
    }
  }

  /**
   * Load service information from Redis cache
   */
  async loadServiceFromCache(serviceName) {
    try {
      const cacheKey = `service:${serviceName}`;
      const cachedData = await redis.get(cacheKey);

      if (cachedData) {
        const service = JSON.parse(cachedData);
        this.services.set(serviceName, service);
        logger.debug(`Loaded service ${serviceName} from cache`);
        return true;
      }
    } catch (error) {
      logger.warn(`Failed to load service ${serviceName} from cache:`, error.message);
    }

    return false;
  }

  /**
   * Notify about service failure
   */
  async notifyServiceFailure(serviceName, service) {
    try {
      const alertData = {
        service: serviceName,
        url: service.url,
        failureCount: service.failureCount,
        lastHealthCheck: service.lastHealthCheck,
        timestamp: new Date().toISOString()
      };

      // Store alert in Redis for monitoring service to pick up
      await redis.lpush('service:alerts', JSON.stringify(alertData));
      await redis.expire('service:alerts', 3600); // 1 hour expiry

      logger.info(`Service failure alert sent for ${serviceName}`);
    } catch (error) {
      logger.error(`Failed to send service failure alert for ${serviceName}:`, error.message);
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.stopHealthCheck();
    this.services.clear();
    this.initialized = false;
    logger.info('Service registry cleaned up');
  }

  /**
   * Circuit breaker functionality
   */
  isCircuitBreakerOpen(serviceName) {
    const service = this.services.get(serviceName);

    if (!service) {
      return true; // Treat unknown services as open circuit
    }

    // Open circuit if service has failed more than 5 times in the last 10 minutes
    return service.failureCount >= 5;
  }

  /**
   * Reset circuit breaker for a service
   */
  resetCircuitBreaker(serviceName) {
    const service = this.services.get(serviceName);

    if (service) {
      service.failureCount = 0;
      service.healthy = true;
      logger.info(`Circuit breaker reset for service: ${serviceName}`);
    }
  }
}

// Export singleton instance
const serviceRegistry = new ServiceRegistry();

module.exports = serviceRegistry;