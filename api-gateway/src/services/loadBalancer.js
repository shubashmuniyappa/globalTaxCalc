/**
 * Load Balancing and Failover Service
 * Implements intelligent load balancing, health checks, circuit breakers, and service discovery
 */

const EventEmitter = require('events');
const axios = require('axios');
const winston = require('winston');
const CircuitBreaker = require('opossum');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/load-balancer.log' })
  ]
});

class LoadBalancer extends EventEmitter {
  constructor(options = {}) {
    super();

    this.algorithm = options.algorithm || 'round-robin';
    this.healthCheckInterval = options.healthCheckInterval || 30000; // 30 seconds
    this.healthCheckTimeout = options.healthCheckTimeout || 5000; // 5 seconds
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000; // 1 second

    // Service registry
    this.services = new Map();
    this.serviceInstances = new Map();

    // Load balancing state
    this.currentIndex = new Map(); // For round-robin
    this.weights = new Map(); // For weighted algorithms
    this.connections = new Map(); // For least connections

    // Circuit breakers
    this.circuitBreakers = new Map();

    // Health check timers
    this.healthCheckTimers = new Map();

    // Statistics
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      circuitBreakerTrips: 0,
      averageResponseTime: 0,
      lastUpdate: new Date()
    };

    this.initializeDefaultServices();
    this.startHealthChecks();
  }

  /**
   * Initialize default microservices
   */
  initializeDefaultServices() {
    // Register default microservices
    this.registerService('auth-service', {
      instances: [
        { url: 'http://localhost:3001', weight: 1 },
        { url: 'http://localhost:3002', weight: 1 }
      ],
      healthCheck: '/health',
      timeout: 5000
    });

    this.registerService('calculation-service', {
      instances: [
        { url: 'http://localhost:3011', weight: 2 },
        { url: 'http://localhost:3012', weight: 2 },
        { url: 'http://localhost:3013', weight: 1 }
      ],
      healthCheck: '/health',
      timeout: 10000
    });

    this.registerService('user-service', {
      instances: [
        { url: 'http://localhost:3021', weight: 1 },
        { url: 'http://localhost:3022', weight: 1 }
      ],
      healthCheck: '/health',
      timeout: 5000
    });

    this.registerService('report-service', {
      instances: [
        { url: 'http://localhost:3031', weight: 1 }
      ],
      healthCheck: '/health',
      timeout: 15000
    });

    this.registerService('notification-service', {
      instances: [
        { url: 'http://localhost:3041', weight: 1 }
      ],
      healthCheck: '/health',
      timeout: 3000
    });
  }

  /**
   * Register a service with its instances
   */
  registerService(serviceName, config) {
    this.services.set(serviceName, {
      ...config,
      createdAt: new Date(),
      lastHealthCheck: null
    });

    // Initialize instances
    const instances = config.instances.map((instance, index) => ({
      id: `${serviceName}-${index}`,
      serviceName,
      ...instance,
      healthy: true,
      responseTime: 0,
      lastCheck: null,
      errorCount: 0,
      successCount: 0,
      connections: 0
    }));

    this.serviceInstances.set(serviceName, instances);

    // Initialize load balancing state
    this.currentIndex.set(serviceName, 0);
    this.connections.set(serviceName, new Map());

    // Create circuit breakers for each instance
    instances.forEach(instance => {
      this.createCircuitBreaker(instance);
    });

    logger.info(`Service registered: ${serviceName} with ${instances.length} instances`);
    this.emit('serviceRegistered', { serviceName, instances: instances.length });
  }

  /**
   * Create circuit breaker for service instance
   */
  createCircuitBreaker(instance) {
    const options = {
      timeout: 10000, // 10 seconds
      errorThresholdPercentage: 50, // 50% error rate
      resetTimeout: 30000, // 30 seconds
      rollingCountTimeout: 60000, // 1 minute
      rollingCountBuckets: 10,
      name: instance.id,
      group: instance.serviceName
    };

    const breaker = new CircuitBreaker(this.makeRequest.bind(this), options);

    // Circuit breaker events
    breaker.on('open', () => {
      logger.warn(`Circuit breaker opened for ${instance.id}`);
      instance.healthy = false;
      this.stats.circuitBreakerTrips++;
      this.emit('circuitBreakerOpen', instance);
    });

    breaker.on('halfOpen', () => {
      logger.info(`Circuit breaker half-open for ${instance.id}`);
      this.emit('circuitBreakerHalfOpen', instance);
    });

    breaker.on('close', () => {
      logger.info(`Circuit breaker closed for ${instance.id}`);
      instance.healthy = true;
      this.emit('circuitBreakerClose', instance);
    });

    breaker.on('reject', () => {
      logger.warn(`Request rejected by circuit breaker for ${instance.id}`);
    });

    this.circuitBreakers.set(instance.id, breaker);
  }

  /**
   * Get available instance for service
   */
  getAvailableInstance(serviceName) {
    const instances = this.serviceInstances.get(serviceName);
    if (!instances || instances.length === 0) {
      throw new Error(`No instances available for service: ${serviceName}`);
    }

    // Filter healthy instances
    const healthyInstances = instances.filter(instance => instance.healthy);
    if (healthyInstances.length === 0) {
      throw new Error(`No healthy instances available for service: ${serviceName}`);
    }

    // Apply load balancing algorithm
    switch (this.algorithm) {
      case 'round-robin':
        return this.roundRobinSelection(serviceName, healthyInstances);
      case 'weighted-round-robin':
        return this.weightedRoundRobinSelection(serviceName, healthyInstances);
      case 'least-connections':
        return this.leastConnectionsSelection(healthyInstances);
      case 'random':
        return this.randomSelection(healthyInstances);
      case 'weighted-response-time':
        return this.weightedResponseTimeSelection(healthyInstances);
      default:
        return this.roundRobinSelection(serviceName, healthyInstances);
    }
  }

  /**
   * Round-robin load balancing
   */
  roundRobinSelection(serviceName, instances) {
    const currentIndex = this.currentIndex.get(serviceName) || 0;
    const selectedInstance = instances[currentIndex % instances.length];

    this.currentIndex.set(serviceName, currentIndex + 1);
    return selectedInstance;
  }

  /**
   * Weighted round-robin load balancing
   */
  weightedRoundRobinSelection(serviceName, instances) {
    const weights = instances.map(instance => instance.weight || 1);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    let currentIndex = this.currentIndex.get(serviceName) || 0;
    currentIndex = (currentIndex + 1) % totalWeight;

    let weightSum = 0;
    for (let i = 0; i < instances.length; i++) {
      weightSum += weights[i];
      if (currentIndex < weightSum) {
        this.currentIndex.set(serviceName, currentIndex);
        return instances[i];
      }
    }

    // Fallback to first instance
    this.currentIndex.set(serviceName, 0);
    return instances[0];
  }

  /**
   * Least connections load balancing
   */
  leastConnectionsSelection(instances) {
    return instances.reduce((min, instance) =>
      instance.connections < min.connections ? instance : min
    );
  }

  /**
   * Random load balancing
   */
  randomSelection(instances) {
    const randomIndex = Math.floor(Math.random() * instances.length);
    return instances[randomIndex];
  }

  /**
   * Weighted response time load balancing
   */
  weightedResponseTimeSelection(instances) {
    // Calculate scores (lower is better)
    const scores = instances.map(instance => {
      const responseTime = instance.responseTime || 1000;
      const errorRate = instance.errorCount / (instance.successCount + instance.errorCount + 1);
      return responseTime * (1 + errorRate);
    });

    // Find instance with lowest score
    const minScoreIndex = scores.indexOf(Math.min(...scores));
    return instances[minScoreIndex];
  }

  /**
   * Proxy request to service
   */
  async proxyRequest(serviceName, req, res) {
    const startTime = Date.now();
    let selectedInstance = null;
    let attempts = 0;

    this.stats.totalRequests++;

    while (attempts < this.retryAttempts) {
      try {
        selectedInstance = this.getAvailableInstance(serviceName);
        selectedInstance.connections++;

        const result = await this.makeRequestWithCircuitBreaker(selectedInstance, req);

        // Update statistics
        const responseTime = Date.now() - startTime;
        this.updateInstanceStats(selectedInstance, true, responseTime);
        this.updateGlobalStats(true, responseTime);

        // Send response
        res.status(result.status || 200);

        // Copy headers
        if (result.headers) {
          Object.entries(result.headers).forEach(([key, value]) => {
            res.set(key, value);
          });
        }

        res.send(result.data);

        logger.debug(`Request proxied successfully to ${selectedInstance.id}`, {
          serviceName,
          instance: selectedInstance.id,
          responseTime,
          attempts: attempts + 1
        });

        return;

      } catch (error) {
        attempts++;

        if (selectedInstance) {
          selectedInstance.connections = Math.max(0, selectedInstance.connections - 1);
          this.updateInstanceStats(selectedInstance, false);
        }

        logger.warn(`Request failed on attempt ${attempts}`, {
          serviceName,
          instance: selectedInstance?.id,
          error: error.message,
          attempts
        });

        // If this was the last attempt, throw the error
        if (attempts >= this.retryAttempts) {
          this.updateGlobalStats(false, Date.now() - startTime);
          throw error;
        }

        // Wait before retry
        await this.sleep(this.retryDelay * attempts);
      } finally {
        if (selectedInstance) {
          selectedInstance.connections = Math.max(0, selectedInstance.connections - 1);
        }
      }
    }
  }

  /**
   * Make request with circuit breaker protection
   */
  async makeRequestWithCircuitBreaker(instance, req) {
    const circuitBreaker = this.circuitBreakers.get(instance.id);
    if (!circuitBreaker) {
      throw new Error(`No circuit breaker found for instance: ${instance.id}`);
    }

    return await circuitBreaker.fire(instance, req);
  }

  /**
   * Make actual HTTP request
   */
  async makeRequest(instance, req) {
    const targetUrl = `${instance.url}${req.path}`;

    const requestConfig = {
      method: req.method,
      url: targetUrl,
      headers: {
        ...req.headers,
        'X-Forwarded-For': req.ip,
        'X-Forwarded-Host': req.get('host'),
        'X-Forwarded-Proto': req.protocol
      },
      timeout: instance.timeout || 10000,
      validateStatus: () => true // Don't throw on HTTP error status
    };

    // Add request body for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(req.method.toUpperCase()) && req.body) {
      requestConfig.data = req.body;
    }

    // Add query parameters
    if (req.query && Object.keys(req.query).length > 0) {
      requestConfig.params = req.query;
    }

    const response = await axios(requestConfig);

    return {
      status: response.status,
      headers: response.headers,
      data: response.data
    };
  }

  /**
   * Start health checks for all services
   */
  startHealthChecks() {
    this.services.forEach((config, serviceName) => {
      this.startServiceHealthCheck(serviceName);
    });
  }

  /**
   * Start health check for specific service
   */
  startServiceHealthCheck(serviceName) {
    const timer = setInterval(async () => {
      await this.performHealthCheck(serviceName);
    }, this.healthCheckInterval);

    this.healthCheckTimers.set(serviceName, timer);

    // Perform initial health check
    this.performHealthCheck(serviceName);
  }

  /**
   * Perform health check for service instances
   */
  async performHealthCheck(serviceName) {
    const service = this.services.get(serviceName);
    const instances = this.serviceInstances.get(serviceName);

    if (!service || !instances) {
      return;
    }

    const healthCheckPromises = instances.map(async (instance) => {
      try {
        const startTime = Date.now();
        const healthCheckUrl = `${instance.url}${service.healthCheck}`;

        const response = await axios.get(healthCheckUrl, {
          timeout: this.healthCheckTimeout,
          validateStatus: (status) => status >= 200 && status < 300
        });

        const responseTime = Date.now() - startTime;

        // Update instance health
        instance.healthy = true;
        instance.responseTime = responseTime;
        instance.lastCheck = new Date();

        logger.debug(`Health check passed for ${instance.id}`, {
          responseTime,
          status: response.status
        });

      } catch (error) {
        // Update instance health
        instance.healthy = false;
        instance.lastCheck = new Date();

        logger.warn(`Health check failed for ${instance.id}`, {
          error: error.message,
          code: error.code
        });

        this.emit('instanceUnhealthy', instance);
      }
    });

    await Promise.allSettled(healthCheckPromises);

    // Update service last health check
    service.lastHealthCheck = new Date();

    // Emit health check complete event
    const healthyCount = instances.filter(i => i.healthy).length;
    this.emit('healthCheckComplete', {
      serviceName,
      totalInstances: instances.length,
      healthyInstances: healthyCount
    });
  }

  /**
   * Update instance statistics
   */
  updateInstanceStats(instance, success, responseTime = 0) {
    if (success) {
      instance.successCount++;
      if (responseTime > 0) {
        instance.responseTime = responseTime;
      }
    } else {
      instance.errorCount++;
    }
  }

  /**
   * Update global statistics
   */
  updateGlobalStats(success, responseTime) {
    if (success) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;
    }

    // Update average response time
    const totalSuccessful = this.stats.successfulRequests;
    if (totalSuccessful > 0) {
      this.stats.averageResponseTime = (
        (this.stats.averageResponseTime * (totalSuccessful - 1) + responseTime) / totalSuccessful
      );
    }

    this.stats.lastUpdate = new Date();
  }

  /**
   * Add service instance
   */
  addServiceInstance(serviceName, instanceConfig) {
    const instances = this.serviceInstances.get(serviceName);
    if (!instances) {
      throw new Error(`Service not found: ${serviceName}`);
    }

    const newInstance = {
      id: `${serviceName}-${instances.length}`,
      serviceName,
      healthy: true,
      responseTime: 0,
      lastCheck: null,
      errorCount: 0,
      successCount: 0,
      connections: 0,
      ...instanceConfig
    };

    instances.push(newInstance);
    this.createCircuitBreaker(newInstance);

    logger.info(`Instance added to service ${serviceName}`, {
      instanceId: newInstance.id,
      url: newInstance.url
    });

    this.emit('instanceAdded', newInstance);
  }

  /**
   * Remove service instance
   */
  removeServiceInstance(serviceName, instanceId) {
    const instances = this.serviceInstances.get(serviceName);
    if (!instances) {
      return false;
    }

    const index = instances.findIndex(instance => instance.id === instanceId);
    if (index === -1) {
      return false;
    }

    const removedInstance = instances.splice(index, 1)[0];

    // Clean up circuit breaker
    const circuitBreaker = this.circuitBreakers.get(instanceId);
    if (circuitBreaker) {
      circuitBreaker.shutdown();
      this.circuitBreakers.delete(instanceId);
    }

    logger.info(`Instance removed from service ${serviceName}`, {
      instanceId,
      url: removedInstance.url
    });

    this.emit('instanceRemoved', removedInstance);
    return true;
  }

  /**
   * Get service status
   */
  getServiceStatus(serviceName) {
    const service = this.services.get(serviceName);
    const instances = this.serviceInstances.get(serviceName);

    if (!service || !instances) {
      return null;
    }

    const healthyInstances = instances.filter(i => i.healthy);
    const totalConnections = instances.reduce((sum, i) => sum + i.connections, 0);
    const averageResponseTime = instances.reduce((sum, i) => sum + i.responseTime, 0) / instances.length;

    return {
      serviceName,
      totalInstances: instances.length,
      healthyInstances: healthyInstances.length,
      unhealthyInstances: instances.length - healthyInstances.length,
      totalConnections,
      averageResponseTime: Math.round(averageResponseTime),
      lastHealthCheck: service.lastHealthCheck,
      instances: instances.map(instance => ({
        id: instance.id,
        url: instance.url,
        healthy: instance.healthy,
        responseTime: instance.responseTime,
        connections: instance.connections,
        errorCount: instance.errorCount,
        successCount: instance.successCount,
        lastCheck: instance.lastCheck
      }))
    };
  }

  /**
   * Get all services status
   */
  getAllServicesStatus() {
    const services = {};

    this.services.forEach((_, serviceName) => {
      services[serviceName] = this.getServiceStatus(serviceName);
    });

    return {
      services,
      globalStats: this.stats,
      loadBalancingAlgorithm: this.algorithm,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Update load balancing algorithm
   */
  setLoadBalancingAlgorithm(algorithm) {
    const validAlgorithms = [
      'round-robin',
      'weighted-round-robin',
      'least-connections',
      'random',
      'weighted-response-time'
    ];

    if (!validAlgorithms.includes(algorithm)) {
      throw new Error(`Invalid algorithm: ${algorithm}`);
    }

    this.algorithm = algorithm;
    logger.info(`Load balancing algorithm changed to: ${algorithm}`);
    this.emit('algorithmChanged', algorithm);
  }

  /**
   * Enable/disable service instance
   */
  setInstanceHealth(serviceName, instanceId, healthy) {
    const instances = this.serviceInstances.get(serviceName);
    if (!instances) {
      return false;
    }

    const instance = instances.find(i => i.id === instanceId);
    if (!instance) {
      return false;
    }

    instance.healthy = healthy;
    logger.info(`Instance ${instanceId} health set to: ${healthy}`);
    this.emit('instanceHealthChanged', { instance, healthy });

    return true;
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('Shutting down load balancer');

    // Clear health check timers
    this.healthCheckTimers.forEach(timer => clearInterval(timer));
    this.healthCheckTimers.clear();

    // Shutdown circuit breakers
    this.circuitBreakers.forEach(breaker => breaker.shutdown());
    this.circuitBreakers.clear();

    // Wait for ongoing requests to complete
    const maxWaitTime = 10000; // 10 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const totalConnections = Array.from(this.serviceInstances.values())
        .flat()
        .reduce((sum, instance) => sum + instance.connections, 0);

      if (totalConnections === 0) {
        break;
      }

      await this.sleep(100);
    }

    this.emit('shutdown');
    logger.info('Load balancer shutdown complete');
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create singleton instance
let loadBalancerInstance;

function createLoadBalancer(options) {
  if (!loadBalancerInstance) {
    loadBalancerInstance = new LoadBalancer(options);
  }
  return loadBalancerInstance;
}

module.exports = {
  LoadBalancer,
  createLoadBalancer
};