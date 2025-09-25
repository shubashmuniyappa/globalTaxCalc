const EventEmitter = require('events');

class AutoScaler extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      // Scaling configuration
      scaling: {
        enabled: process.env.AUTO_SCALING_ENABLED !== 'false',
        minInstances: parseInt(process.env.MIN_INSTANCES) || 2,
        maxInstances: parseInt(process.env.MAX_INSTANCES) || 20,
        targetCpuUtilization: parseFloat(process.env.TARGET_CPU) || 70,
        targetMemoryUtilization: parseFloat(process.env.TARGET_MEMORY) || 80,
        scaleUpCooldown: parseInt(process.env.SCALE_UP_COOLDOWN) || 300000,   // 5 minutes
        scaleDownCooldown: parseInt(process.env.SCALE_DOWN_COOLDOWN) || 600000, // 10 minutes
        evaluationPeriod: parseInt(process.env.EVALUATION_PERIOD) || 60000,   // 1 minute
        samplesRequired: parseInt(process.env.SAMPLES_REQUIRED) || 3
      },

      // Load balancing
      loadBalancer: {
        algorithm: process.env.LB_ALGORITHM || 'weighted_round_robin',
        healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
        healthCheckTimeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 5000,
        maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
        retryDelay: parseInt(process.env.RETRY_DELAY) || 1000,
        enableStickySessions: process.env.STICKY_SESSIONS === 'true'
      },

      // Metrics collection
      metrics: {
        collectInterval: parseInt(process.env.METRICS_INTERVAL) || 30000,
        retentionPeriod: parseInt(process.env.METRICS_RETENTION) || 3600000, // 1 hour
        aggregationWindow: parseInt(process.env.AGGREGATION_WINDOW) || 300000 // 5 minutes
      },

      // Cost optimization
      costOptimization: {
        enabled: process.env.COST_OPTIMIZATION === 'true',
        scheduledScaleDown: process.env.SCHEDULED_SCALE_DOWN === 'true',
        lowTrafficThreshold: parseFloat(process.env.LOW_TRAFFIC_THRESHOLD) || 10,
        lowTrafficDuration: parseInt(process.env.LOW_TRAFFIC_DURATION) || 1800000, // 30 minutes
        peakHours: process.env.PEAK_HOURS || '09:00-17:00',
        timeZone: process.env.TIME_ZONE || 'UTC'
      },

      // Instance management
      instances: {
        provider: process.env.CLOUD_PROVIDER || 'aws', // aws, gcp, azure, kubernetes
        region: process.env.CLOUD_REGION || 'us-east-1',
        instanceType: process.env.INSTANCE_TYPE || 't3.medium',
        imageId: process.env.IMAGE_ID,
        securityGroups: process.env.SECURITY_GROUPS?.split(',') || [],
        subnets: process.env.SUBNETS?.split(',') || [],
        userData: process.env.USER_DATA
      },

      ...options
    };

    this.instances = new Map();
    this.metrics = [];
    this.lastScaleAction = null;
    this.isScaling = false;

    this.initializeInstances();
    this.startMetricsCollection();
    this.startScalingLoop();
  }

  /**
   * Initialize instance tracking
   */
  initializeInstances() {
    // In real implementation, discover existing instances
    this.instances.set('instance-1', {
      id: 'instance-1',
      status: 'running',
      health: 'healthy',
      cpu: 45,
      memory: 60,
      connections: 25,
      weight: 100,
      region: this.config.instances.region,
      launchedAt: new Date(Date.now() - 3600000), // 1 hour ago
      lastHealthCheck: Date.now()
    });

    this.instances.set('instance-2', {
      id: 'instance-2',
      status: 'running',
      health: 'healthy',
      cpu: 50,
      memory: 65,
      connections: 30,
      weight: 100,
      region: this.config.instances.region,
      launchedAt: new Date(Date.now() - 3600000),
      lastHealthCheck: Date.now()
    });

    console.log(`✅ Initialized with ${this.instances.size} instances`);
  }

  /**
   * Start metrics collection
   */
  startMetricsCollection() {
    setInterval(() => {
      this.collectMetrics();
    }, this.config.metrics.collectInterval);

    setInterval(() => {
      this.cleanupOldMetrics();
    }, this.config.metrics.retentionPeriod);

    console.log('✅ Metrics collection started');
  }

  /**
   * Start auto-scaling evaluation loop
   */
  startScalingLoop() {
    if (!this.config.scaling.enabled) {
      console.log('Auto-scaling disabled');
      return;
    }

    setInterval(() => {
      this.evaluateScaling();
    }, this.config.scaling.evaluationPeriod);

    console.log('✅ Auto-scaling loop started');
  }

  /**
   * Collect system metrics
   */
  async collectMetrics() {
    const timestamp = Date.now();
    const instances = Array.from(this.instances.values());

    // Aggregate metrics across all instances
    const aggregatedMetrics = {
      timestamp,
      instanceCount: instances.length,
      healthyInstances: instances.filter(i => i.health === 'healthy').length,
      avgCpuUtilization: this.calculateAverage(instances, 'cpu'),
      avgMemoryUtilization: this.calculateAverage(instances, 'memory'),
      totalConnections: instances.reduce((sum, i) => sum + i.connections, 0),
      avgResponseTime: await this.getAverageResponseTime(),
      errorRate: await this.getErrorRate(),
      requestsPerSecond: await this.getRequestsPerSecond()
    };

    // Store metrics
    this.metrics.push(aggregatedMetrics);

    // Emit metrics event
    this.emit('metricsCollected', aggregatedMetrics);

    // Update instance health
    await this.updateInstanceHealth();
  }

  /**
   * Evaluate if scaling is needed
   */
  async evaluateScaling() {
    if (this.isScaling) {
      console.log('Scaling operation in progress, skipping evaluation');
      return;
    }

    const recentMetrics = this.getRecentMetrics();
    if (recentMetrics.length < this.config.scaling.samplesRequired) {
      console.log('Insufficient metrics for scaling decision');
      return;
    }

    const decision = this.makeScalingDecision(recentMetrics);

    if (decision.action !== 'none') {
      console.log(`Scaling decision: ${decision.action}`, decision.reason);
      await this.executeScalingAction(decision);
    }
  }

  /**
   * Make scaling decision based on metrics
   */
  makeScalingDecision(metrics) {
    const latestMetrics = metrics[metrics.length - 1];
    const avgCpu = this.calculateAverage(metrics, 'avgCpuUtilization');
    const avgMemory = this.calculateAverage(metrics, 'avgMemoryUtilization');
    const avgResponseTime = this.calculateAverage(metrics, 'avgResponseTime');
    const avgErrorRate = this.calculateAverage(metrics, 'errorRate');

    // Check cooldown periods
    if (this.lastScaleAction) {
      const timeSinceLastAction = Date.now() - this.lastScaleAction.timestamp;
      const cooldownPeriod = this.lastScaleAction.action === 'scale_up'
        ? this.config.scaling.scaleUpCooldown
        : this.config.scaling.scaleDownCooldown;

      if (timeSinceLastAction < cooldownPeriod) {
        return {
          action: 'none',
          reason: `Cooldown period active (${Math.ceil((cooldownPeriod - timeSinceLastAction) / 1000)}s remaining)`
        };
      }
    }

    // Scale up conditions
    if (
      avgCpu > this.config.scaling.targetCpuUtilization ||
      avgMemory > this.config.scaling.targetMemoryUtilization ||
      avgResponseTime > 2000 || // 2 second response time threshold
      avgErrorRate > 5 || // 5% error rate threshold
      latestMetrics.healthyInstances < this.config.scaling.minInstances
    ) {
      if (latestMetrics.instanceCount < this.config.scaling.maxInstances) {
        return {
          action: 'scale_up',
          reason: `High resource utilization: CPU ${avgCpu.toFixed(1)}%, Memory ${avgMemory.toFixed(1)}%, RT ${avgResponseTime.toFixed(0)}ms, Errors ${avgErrorRate.toFixed(1)}%`,
          targetInstances: Math.min(
            latestMetrics.instanceCount + this.calculateScaleUpAmount(metrics),
            this.config.scaling.maxInstances
          )
        };
      }
    }

    // Scale down conditions
    if (
      avgCpu < this.config.scaling.targetCpuUtilization * 0.5 &&
      avgMemory < this.config.scaling.targetMemoryUtilization * 0.5 &&
      avgResponseTime < 500 &&
      avgErrorRate < 1 &&
      latestMetrics.instanceCount > this.config.scaling.minInstances
    ) {
      // Check cost optimization settings
      if (this.config.costOptimization.enabled) {
        const isLowTrafficPeriod = this.isLowTrafficPeriod(metrics);
        const isPeakHours = this.isPeakHours();

        if (isLowTrafficPeriod && !isPeakHours) {
          return {
            action: 'scale_down',
            reason: `Low resource utilization during off-peak: CPU ${avgCpu.toFixed(1)}%, Memory ${avgMemory.toFixed(1)}%`,
            targetInstances: Math.max(
              latestMetrics.instanceCount - this.calculateScaleDownAmount(metrics),
              this.config.scaling.minInstances
            )
          };
        }
      } else {
        return {
          action: 'scale_down',
          reason: `Low resource utilization: CPU ${avgCpu.toFixed(1)}%, Memory ${avgMemory.toFixed(1)}%`,
          targetInstances: Math.max(
            latestMetrics.instanceCount - 1,
            this.config.scaling.minInstances
          )
        };
      }
    }

    return {
      action: 'none',
      reason: 'Metrics within acceptable ranges'
    };
  }

  /**
   * Execute scaling action
   */
  async executeScalingAction(decision) {
    this.isScaling = true;

    try {
      const currentCount = this.instances.size;
      const targetCount = decision.targetInstances;

      console.log(`Executing ${decision.action}: ${currentCount} → ${targetCount} instances`);

      if (decision.action === 'scale_up') {
        const instancesToAdd = targetCount - currentCount;
        await this.scaleUp(instancesToAdd);
      } else if (decision.action === 'scale_down') {
        const instancesToRemove = currentCount - targetCount;
        await this.scaleDown(instancesToRemove);
      }

      // Record scaling action
      this.lastScaleAction = {
        action: decision.action,
        reason: decision.reason,
        fromCount: currentCount,
        toCount: targetCount,
        timestamp: Date.now()
      };

      // Emit scaling event
      this.emit('scalingAction', this.lastScaleAction);

      console.log(`✅ Scaling completed: ${decision.action} from ${currentCount} to ${targetCount}`);

    } catch (error) {
      console.error('Error executing scaling action:', error);
      this.emit('scalingError', {
        action: decision.action,
        error: error.message,
        timestamp: Date.now()
      });
    } finally {
      this.isScaling = false;
    }
  }

  /**
   * Scale up by adding instances
   */
  async scaleUp(count) {
    console.log(`Adding ${count} instances...`);

    const promises = [];
    for (let i = 0; i < count; i++) {
      promises.push(this.launchInstance());
    }

    const newInstances = await Promise.allSettled(promises);

    let successCount = 0;
    newInstances.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successCount++;
        this.instances.set(result.value.id, result.value);
      } else {
        console.error(`Failed to launch instance ${index + 1}:`, result.reason);
      }
    });

    console.log(`Successfully added ${successCount}/${count} instances`);
  }

  /**
   * Scale down by removing instances
   */
  async scaleDown(count) {
    console.log(`Removing ${count} instances...`);

    // Select instances to remove (prefer least healthy, newest instances)
    const instancesToRemove = this.selectInstancesForRemoval(count);

    const promises = instancesToRemove.map(instance =>
      this.terminateInstance(instance.id)
    );

    const results = await Promise.allSettled(promises);

    let successCount = 0;
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successCount++;
        this.instances.delete(instancesToRemove[index].id);
      } else {
        console.error(`Failed to terminate instance ${instancesToRemove[index].id}:`, result.reason);
      }
    });

    console.log(`Successfully removed ${successCount}/${count} instances`);
  }

  /**
   * Launch new instance
   */
  async launchInstance() {
    // Simulate instance launch
    await new Promise(resolve => setTimeout(resolve, 2000));

    const instanceId = `instance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const instance = {
      id: instanceId,
      status: 'launching',
      health: 'initializing',
      cpu: 20,
      memory: 30,
      connections: 0,
      weight: 0, // Start with 0 weight until healthy
      region: this.config.instances.region,
      launchedAt: new Date(),
      lastHealthCheck: Date.now()
    };

    // Simulate startup time
    setTimeout(() => {
      if (this.instances.has(instanceId)) {
        const inst = this.instances.get(instanceId);
        inst.status = 'running';
        inst.health = 'healthy';
        inst.weight = 100;
      }
    }, 10000); // 10 seconds to become healthy

    return instance;
  }

  /**
   * Terminate instance
   */
  async terminateInstance(instanceId) {
    console.log(`Terminating instance ${instanceId}...`);

    // Gracefully drain connections
    await this.drainInstance(instanceId);

    // Simulate termination
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log(`Instance ${instanceId} terminated`);
  }

  /**
   * Drain instance connections
   */
  async drainInstance(instanceId) {
    if (!this.instances.has(instanceId)) return;

    const instance = this.instances.get(instanceId);

    // Set weight to 0 to stop new connections
    instance.weight = 0;
    instance.status = 'draining';

    console.log(`Draining instance ${instanceId}...`);

    // Wait for connections to drain
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max

    while (instance.connections > 0 && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Simulate connection draining
      instance.connections = Math.max(0, instance.connections - Math.ceil(instance.connections * 0.2));
      attempts++;
    }

    if (instance.connections > 0) {
      console.warn(`Force terminating instance ${instanceId} with ${instance.connections} remaining connections`);
    }

    instance.status = 'terminating';
  }

  /**
   * Select instances for removal
   */
  selectInstancesForRemoval(count) {
    const instances = Array.from(this.instances.values())
      .filter(instance => instance.status === 'running')
      .sort((a, b) => {
        // Prefer unhealthy instances first
        if (a.health !== b.health) {
          return a.health === 'unhealthy' ? -1 : 1;
        }

        // Then prefer newer instances
        return new Date(b.launchedAt) - new Date(a.launchedAt);
      });

    return instances.slice(0, count);
  }

  /**
   * Update instance health checks
   */
  async updateInstanceHealth() {
    const healthCheckPromises = Array.from(this.instances.values()).map(async (instance) => {
      try {
        const isHealthy = await this.performHealthCheck(instance.id);

        instance.health = isHealthy ? 'healthy' : 'unhealthy';
        instance.lastHealthCheck = Date.now();

        // Adjust weight based on health
        if (instance.status === 'running') {
          instance.weight = isHealthy ? 100 : 0;
        }

        // Simulate metric updates
        if (isHealthy) {
          instance.cpu = Math.max(10, Math.min(95, instance.cpu + (Math.random() - 0.5) * 10));
          instance.memory = Math.max(20, Math.min(90, instance.memory + (Math.random() - 0.5) * 8));
          instance.connections = Math.max(0, Math.min(100, instance.connections + Math.floor((Math.random() - 0.5) * 10)));
        }

      } catch (error) {
        console.error(`Health check failed for instance ${instance.id}:`, error);
        instance.health = 'unhealthy';
        instance.weight = 0;
      }
    });

    await Promise.allSettled(healthCheckPromises);
  }

  /**
   * Perform health check on instance
   */
  async performHealthCheck(instanceId) {
    // Simulate health check
    await new Promise(resolve => setTimeout(resolve, 100));

    // 95% success rate
    return Math.random() > 0.05;
  }

  /**
   * Load balancing - get next instance
   */
  getNextInstance(sessionId = null) {
    const healthyInstances = Array.from(this.instances.values())
      .filter(instance =>
        instance.status === 'running' &&
        instance.health === 'healthy' &&
        instance.weight > 0
      );

    if (healthyInstances.length === 0) {
      throw new Error('No healthy instances available');
    }

    // Sticky sessions
    if (sessionId && this.config.loadBalancer.enableStickySessions) {
      const stickyInstance = this.getStickyInstance(sessionId, healthyInstances);
      if (stickyInstance) {
        return stickyInstance;
      }
    }

    // Load balancing algorithms
    switch (this.config.loadBalancer.algorithm) {
      case 'round_robin':
        return this.roundRobinSelection(healthyInstances);

      case 'weighted_round_robin':
        return this.weightedRoundRobinSelection(healthyInstances);

      case 'least_connections':
        return this.leastConnectionsSelection(healthyInstances);

      case 'least_response_time':
        return this.leastResponseTimeSelection(healthyInstances);

      default:
        return healthyInstances[0];
    }
  }

  /**
   * Round robin load balancing
   */
  roundRobinSelection(instances) {
    if (!this.rrIndex) this.rrIndex = 0;

    const instance = instances[this.rrIndex % instances.length];
    this.rrIndex++;

    return instance;
  }

  /**
   * Weighted round robin load balancing
   */
  weightedRoundRobinSelection(instances) {
    const totalWeight = instances.reduce((sum, instance) => sum + instance.weight, 0);
    let randomWeight = Math.random() * totalWeight;

    for (const instance of instances) {
      randomWeight -= instance.weight;
      if (randomWeight <= 0) {
        return instance;
      }
    }

    return instances[0];
  }

  /**
   * Least connections load balancing
   */
  leastConnectionsSelection(instances) {
    return instances.reduce((least, instance) =>
      instance.connections < least.connections ? instance : least
    );
  }

  /**
   * Least response time load balancing
   */
  leastResponseTimeSelection(instances) {
    // In real implementation, track actual response times
    return instances.reduce((fastest, instance) =>
      (instance.avgResponseTime || 100) < (fastest.avgResponseTime || 100) ? instance : fastest
    );
  }

  /**
   * Get sticky instance for session
   */
  getStickyInstance(sessionId, instances) {
    // Simple hash-based sticky sessions
    const hash = this.hashString(sessionId);
    const index = hash % instances.length;
    return instances[index];
  }

  /**
   * Helper methods
   */
  calculateAverage(items, property) {
    if (items.length === 0) return 0;
    return items.reduce((sum, item) => sum + (item[property] || 0), 0) / items.length;
  }

  calculateScaleUpAmount(metrics) {
    const latestMetrics = metrics[metrics.length - 1];
    const cpuUtilization = latestMetrics.avgCpuUtilization;

    // Scale more aggressively for higher CPU usage
    if (cpuUtilization > 90) return 3;
    if (cpuUtilization > 80) return 2;
    return 1;
  }

  calculateScaleDownAmount(metrics) {
    // Conservative scale down
    return 1;
  }

  getRecentMetrics() {
    const cutoff = Date.now() - this.config.metrics.aggregationWindow;
    return this.metrics.filter(metric => metric.timestamp > cutoff);
  }

  cleanupOldMetrics() {
    const cutoff = Date.now() - this.config.metrics.retentionPeriod;
    this.metrics = this.metrics.filter(metric => metric.timestamp > cutoff);
  }

  async getAverageResponseTime() {
    // Simulate getting response time from monitoring
    return 300 + Math.random() * 200; // 300-500ms
  }

  async getErrorRate() {
    // Simulate getting error rate from monitoring
    return Math.random() * 2; // 0-2%
  }

  async getRequestsPerSecond() {
    // Simulate getting RPS from monitoring
    return 50 + Math.random() * 100; // 50-150 RPS
  }

  isLowTrafficPeriod(metrics) {
    const recentRps = metrics.slice(-3).map(m => m.requestsPerSecond);
    const avgRps = this.calculateAverage(recentRps, 'requestsPerSecond');
    return avgRps < this.config.costOptimization.lowTrafficThreshold;
  }

  isPeakHours() {
    const now = new Date();
    const [startHour, endHour] = this.config.costOptimization.peakHours.split('-');
    const currentHour = now.getHours();

    const start = parseInt(startHour.split(':')[0]);
    const end = parseInt(endHour.split(':')[0]);

    return currentHour >= start && currentHour < end;
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get scaling status
   */
  getStatus() {
    const instances = Array.from(this.instances.values());
    const recentMetrics = this.getRecentMetrics();

    return {
      scaling: {
        enabled: this.config.scaling.enabled,
        isScaling: this.isScaling,
        lastAction: this.lastScaleAction
      },
      instances: {
        total: instances.length,
        healthy: instances.filter(i => i.health === 'healthy').length,
        running: instances.filter(i => i.status === 'running').length,
        min: this.config.scaling.minInstances,
        max: this.config.scaling.maxInstances
      },
      metrics: recentMetrics.length > 0 ? recentMetrics[recentMetrics.length - 1] : null,
      loadBalancer: {
        algorithm: this.config.loadBalancer.algorithm,
        stickySessionsEnabled: this.config.loadBalancer.enableStickySessions
      }
    };
  }

  /**
   * Get instance details
   */
  getInstances() {
    return Array.from(this.instances.values());
  }

  /**
   * Manually scale to specific count
   */
  async manualScale(targetCount) {
    if (this.isScaling) {
      throw new Error('Scaling operation already in progress');
    }

    const currentCount = this.instances.size;

    if (targetCount < this.config.scaling.minInstances || targetCount > this.config.scaling.maxInstances) {
      throw new Error(`Target count must be between ${this.config.scaling.minInstances} and ${this.config.scaling.maxInstances}`);
    }

    const decision = {
      action: targetCount > currentCount ? 'scale_up' : 'scale_down',
      targetInstances: targetCount,
      reason: 'manual_scaling'
    };

    await this.executeScalingAction(decision);
  }
}

module.exports = AutoScaler;