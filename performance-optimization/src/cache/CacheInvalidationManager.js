const EventEmitter = require('events');

class CacheInvalidationManager extends EventEmitter {
  constructor(cacheManager, options = {}) {
    super();

    this.cacheManager = cacheManager;
    this.config = {
      // Invalidation strategies
      strategies: {
        ttl: true,           // Time-based invalidation
        dependency: true,    // Dependency-based invalidation
        pattern: true,       // Pattern-based invalidation
        event: true,         // Event-driven invalidation
        proactive: true      // Proactive invalidation
      },

      // Cache warming settings
      warming: {
        enabled: true,
        batchSize: 100,
        concurrency: 5,
        retryAttempts: 3,
        retryDelay: 1000,
        priorityRoutes: [
          '/api/calculator',
          '/api/forms',
          '/api/rates'
        ]
      },

      // Dependency tracking
      dependencies: {
        trackingEnabled: true,
        maxDependencies: 1000,
        cleanupInterval: 3600000 // 1 hour
      },

      // Analytics and monitoring
      analytics: {
        enabled: true,
        trackingWindow: 86400000, // 24 hours
        minSampleSize: 100
      },

      ...options
    };

    this.dependencyGraph = new Map();
    this.invalidationQueue = [];
    this.warmingQueue = [];
    this.analytics = this.initializeAnalytics();

    this.setupEventHandlers();
    this.startBackgroundTasks();
  }

  /**
   * Setup event handlers for cache invalidation
   */
  setupEventHandlers() {
    // Database change events
    this.on('dataChange', this.handleDataChange.bind(this));

    // User action events
    this.on('userAction', this.handleUserAction.bind(this));

    // System events
    this.on('systemUpdate', this.handleSystemUpdate.bind(this));

    // Schedule events
    this.on('scheduledInvalidation', this.handleScheduledInvalidation.bind(this));

    console.log('✅ Cache invalidation event handlers setup');
  }

  /**
   * Register cache dependency
   */
  registerDependency(cacheKey, dependencies) {
    if (!this.config.dependencies.trackingEnabled) return;

    const normalizedKey = this.normalizeCacheKey(cacheKey);
    const normalizedDeps = dependencies.map(dep => this.normalizeDependency(dep));

    if (!this.dependencyGraph.has(normalizedKey)) {
      this.dependencyGraph.set(normalizedKey, {
        key: normalizedKey,
        dependencies: new Set(),
        dependents: new Set(),
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 0
      });
    }

    const entry = this.dependencyGraph.get(normalizedKey);

    // Add dependencies
    normalizedDeps.forEach(dep => {
      entry.dependencies.add(dep);

      // Track reverse dependencies
      if (!this.dependencyGraph.has(dep)) {
        this.dependencyGraph.set(dep, {
          key: dep,
          dependencies: new Set(),
          dependents: new Set(),
          createdAt: Date.now(),
          lastAccessed: Date.now(),
          accessCount: 0
        });
      }

      this.dependencyGraph.get(dep).dependents.add(normalizedKey);
    });

    // Cleanup if too many dependencies
    if (this.dependencyGraph.size > this.config.dependencies.maxDependencies) {
      this.cleanupDependencies();
    }
  }

  /**
   * Invalidate cache by key
   */
  async invalidateByKey(cacheKey, options = {}) {
    const {
      cascade = true,
      priority = 'normal',
      reason = 'manual'
    } = options;

    const normalizedKey = this.normalizeCacheKey(cacheKey);

    try {
      // Add to invalidation queue
      this.invalidationQueue.push({
        key: normalizedKey,
        type: 'key',
        cascade,
        priority,
        reason,
        timestamp: Date.now()
      });

      // Process queue
      await this.processInvalidationQueue();

      // Track analytics
      this.analytics.invalidations.key++;
      this.trackInvalidation(normalizedKey, 'key', reason);

      console.log(`Cache invalidated: ${normalizedKey} (${reason})`);

    } catch (error) {
      console.error('Error invalidating cache key:', error);
      this.analytics.errors.invalidation++;
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidateByPattern(pattern, options = {}) {
    const {
      priority = 'normal',
      reason = 'pattern'
    } = options;

    try {
      // Add to invalidation queue
      this.invalidationQueue.push({
        pattern,
        type: 'pattern',
        priority,
        reason,
        timestamp: Date.now()
      });

      // Process queue
      await this.processInvalidationQueue();

      // Track analytics
      this.analytics.invalidations.pattern++;
      this.trackInvalidation(pattern, 'pattern', reason);

      console.log(`Cache pattern invalidated: ${pattern} (${reason})`);

    } catch (error) {
      console.error('Error invalidating cache pattern:', error);
      this.analytics.errors.invalidation++;
    }
  }

  /**
   * Invalidate cache by dependency
   */
  async invalidateByDependency(dependency, options = {}) {
    const {
      priority = 'normal',
      reason = 'dependency'
    } = options;

    const normalizedDep = this.normalizeDependency(dependency);

    try {
      // Find all keys that depend on this dependency
      const dependentKeys = this.findDependentKeys(normalizedDep);

      if (dependentKeys.length > 0) {
        // Add to invalidation queue
        this.invalidationQueue.push({
          keys: dependentKeys,
          type: 'dependency',
          dependency: normalizedDep,
          priority,
          reason,
          timestamp: Date.now()
        });

        // Process queue
        await this.processInvalidationQueue();

        // Track analytics
        this.analytics.invalidations.dependency++;
        this.trackInvalidation(normalizedDep, 'dependency', reason);

        console.log(`Cache dependency invalidated: ${normalizedDep}, affected ${dependentKeys.length} keys (${reason})`);
      }

    } catch (error) {
      console.error('Error invalidating cache dependency:', error);
      this.analytics.errors.invalidation++;
    }
  }

  /**
   * Process invalidation queue
   */
  async processInvalidationQueue() {
    if (this.invalidationQueue.length === 0) return;

    // Sort by priority
    this.invalidationQueue.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    const batch = this.invalidationQueue.splice(0, 50); // Process in batches of 50

    await Promise.allSettled(batch.map(async (item) => {
      try {
        switch (item.type) {
          case 'key':
            await this.executeKeyInvalidation(item);
            break;

          case 'pattern':
            await this.executePatternInvalidation(item);
            break;

          case 'dependency':
            await this.executeDependencyInvalidation(item);
            break;
        }
      } catch (error) {
        console.error('Error processing invalidation item:', error);
      }
    }));
  }

  /**
   * Execute key invalidation
   */
  async executeKeyInvalidation(item) {
    const { key, cascade } = item;

    // Invalidate the key
    await this.cacheManager.delete(key);

    // Cascade to dependent keys if enabled
    if (cascade && this.dependencyGraph.has(key)) {
      const dependents = this.dependencyGraph.get(key).dependents;

      for (const dependent of dependents) {
        await this.cacheManager.delete(dependent);
      }
    }

    // Remove from dependency graph
    this.removeDependency(key);
  }

  /**
   * Execute pattern invalidation
   */
  async executePatternInvalidation(item) {
    const { pattern } = item;

    // Use cache manager's pattern invalidation
    await this.cacheManager.invalidatePattern(pattern);

    // Remove matching keys from dependency graph
    for (const [key] of this.dependencyGraph) {
      if (this.matchesPattern(key, pattern)) {
        this.removeDependency(key);
      }
    }
  }

  /**
   * Execute dependency invalidation
   */
  async executeDependencyInvalidation(item) {
    const { keys } = item;

    // Invalidate all dependent keys
    await Promise.allSettled(keys.map(async (key) => {
      await this.cacheManager.delete(key);
      this.removeDependency(key);
    }));
  }

  /**
   * Warm cache with priority routes
   */
  async warmCache(routes = null, options = {}) {
    const {
      priority = 'normal',
      force = false
    } = options;

    const routesToWarm = routes || this.config.warming.priorityRoutes;

    if (!this.config.warming.enabled && !force) {
      console.log('Cache warming disabled');
      return;
    }

    try {
      // Add routes to warming queue
      routesToWarm.forEach(route => {
        this.warmingQueue.push({
          route,
          priority,
          timestamp: Date.now(),
          attempts: 0
        });
      });

      // Process warming queue
      await this.processWarmingQueue();

      console.log(`Cache warming initiated for ${routesToWarm.length} routes`);

    } catch (error) {
      console.error('Error warming cache:', error);
      this.analytics.errors.warming++;
    }
  }

  /**
   * Process cache warming queue
   */
  async processWarmingQueue() {
    if (this.warmingQueue.length === 0) return;

    // Sort by priority
    this.warmingQueue.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Process in batches
    const batchSize = this.config.warming.batchSize;
    const concurrency = this.config.warming.concurrency;

    for (let i = 0; i < this.warmingQueue.length; i += batchSize) {
      const batch = this.warmingQueue.slice(i, i + batchSize);

      // Process batch with concurrency limit
      const semaphore = new Array(concurrency).fill(null);

      await Promise.allSettled(batch.map(async (item, index) => {
        // Wait for semaphore slot
        await new Promise(resolve => {
          const checkSlot = () => {
            const slotIndex = index % concurrency;
            if (semaphore[slotIndex] === null) {
              semaphore[slotIndex] = true;
              resolve();
            } else {
              setTimeout(checkSlot, 10);
            }
          };
          checkSlot();
        });

        try {
          await this.warmRoute(item);
        } finally {
          // Release semaphore slot
          const slotIndex = index % concurrency;
          semaphore[slotIndex] = null;
        }
      }));
    }

    // Clear processed items
    this.warmingQueue = [];
  }

  /**
   * Warm individual route
   */
  async warmRoute(item) {
    const { route, attempts } = item;
    const maxAttempts = this.config.warming.retryAttempts;

    try {
      // Generate cache key for route
      const cacheKey = this.generateRouteCacheKey(route);

      // Check if already cached
      const existing = await this.cacheManager.get(cacheKey);
      if (existing) {
        this.analytics.warming.skipped++;
        return;
      }

      // Simulate route warming (in real implementation, make HTTP request)
      const data = await this.fetchRouteData(route);

      // Cache the data
      await this.cacheManager.set(cacheKey, data, null, { type: 'api' });

      this.analytics.warming.success++;

    } catch (error) {
      console.error(`Error warming route ${route}:`, error);

      // Retry if not exceeded max attempts
      if (attempts < maxAttempts) {
        item.attempts++;

        setTimeout(() => {
          this.warmingQueue.push(item);
        }, this.config.warming.retryDelay * (attempts + 1));
      } else {
        this.analytics.warming.failed++;
      }
    }
  }

  /**
   * Handle data change event
   */
  async handleDataChange(event) {
    const { table, operation, id, data } = event;

    // Determine invalidation strategy based on change
    const dependencies = this.getDependenciesForTable(table);

    // Invalidate by dependency
    for (const dependency of dependencies) {
      await this.invalidateByDependency(dependency, {
        reason: `${operation}_${table}`,
        priority: 'high'
      });
    }

    // Special handling for user-specific data
    if (id && this.isUserSpecificTable(table)) {
      await this.invalidateByPattern(`user:${id}:*`, {
        reason: `user_data_change`,
        priority: 'normal'
      });
    }
  }

  /**
   * Handle user action event
   */
  async handleUserAction(event) {
    const { userId, action, data } = event;

    switch (action) {
      case 'login':
        // Warm user-specific cache
        await this.warmUserCache(userId);
        break;

      case 'logout':
        // Invalidate user session cache
        await this.invalidateByPattern(`session:${userId}:*`, {
          reason: 'user_logout',
          priority: 'normal'
        });
        break;

      case 'profile_update':
        // Invalidate user profile cache
        await this.invalidateByPattern(`user:${userId}:*`, {
          reason: 'profile_update',
          priority: 'normal'
        });
        break;

      case 'calculation':
        // Warm related calculation cache
        await this.warmCalculationCache(data.calculationType);
        break;
    }
  }

  /**
   * Handle system update event
   */
  async handleSystemUpdate(event) {
    const { type, scope } = event;

    switch (type) {
      case 'tax_rates_update':
        // Invalidate all calculation-related cache
        await this.invalidateByPattern('calc:*', {
          reason: 'tax_rates_update',
          priority: 'critical'
        });
        break;

      case 'forms_update':
        // Invalidate forms cache
        await this.invalidateByPattern('forms:*', {
          reason: 'forms_update',
          priority: 'high'
        });
        break;

      case 'deployment':
        // Invalidate all cache with low priority
        await this.invalidateByPattern('*', {
          reason: 'deployment',
          priority: 'low'
        });
        break;
    }
  }

  /**
   * Handle scheduled invalidation
   */
  async handleScheduledInvalidation(event) {
    const { pattern, reason } = event;

    await this.invalidateByPattern(pattern, {
      reason: `scheduled_${reason}`,
      priority: 'normal'
    });
  }

  /**
   * Start background tasks
   */
  startBackgroundTasks() {
    // Cleanup dependencies periodically
    setInterval(() => {
      this.cleanupDependencies();
    }, this.config.dependencies.cleanupInterval);

    // Process queues periodically
    setInterval(() => {
      this.processInvalidationQueue();
      this.processWarmingQueue();
    }, 5000); // Every 5 seconds

    // Generate analytics reports
    setInterval(() => {
      this.generateAnalyticsReport();
    }, 3600000); // Every hour

    console.log('✅ Background tasks started');
  }

  /**
   * Cleanup old dependencies
   */
  cleanupDependencies() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    let removed = 0;

    for (const [key, entry] of this.dependencyGraph) {
      if (now - entry.lastAccessed > maxAge && entry.accessCount < 10) {
        this.removeDependency(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`Cleaned up ${removed} old dependencies`);
    }
  }

  /**
   * Remove dependency from graph
   */
  removeDependency(key) {
    if (!this.dependencyGraph.has(key)) return;

    const entry = this.dependencyGraph.get(key);

    // Remove from dependents
    entry.dependencies.forEach(dep => {
      if (this.dependencyGraph.has(dep)) {
        this.dependencyGraph.get(dep).dependents.delete(key);
      }
    });

    // Remove from dependencies
    entry.dependents.forEach(dependent => {
      if (this.dependencyGraph.has(dependent)) {
        this.dependencyGraph.get(dependent).dependencies.delete(key);
      }
    });

    this.dependencyGraph.delete(key);
  }

  /**
   * Find dependent keys for a dependency
   */
  findDependentKeys(dependency) {
    if (!this.dependencyGraph.has(dependency)) return [];

    return Array.from(this.dependencyGraph.get(dependency).dependents);
  }

  /**
   * Helper methods
   */
  normalizeCacheKey(key) {
    return key.toLowerCase().trim();
  }

  normalizeDependency(dependency) {
    if (typeof dependency === 'object') {
      return `${dependency.type}:${dependency.id}`;
    }
    return dependency.toString().toLowerCase();
  }

  matchesPattern(key, pattern) {
    // Convert glob pattern to regex
    const regex = new RegExp(
      pattern
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')
    );
    return regex.test(key);
  }

  getDependenciesForTable(table) {
    const tableDependencies = {
      users: ['user', 'profile'],
      tax_rates: ['rates', 'calculation'],
      forms: ['forms', 'templates'],
      calculations: ['calculation', 'results']
    };

    return tableDependencies[table] || [table];
  }

  isUserSpecificTable(table) {
    const userTables = ['user_profiles', 'user_calculations', 'user_sessions'];
    return userTables.includes(table);
  }

  generateRouteCacheKey(route) {
    return `route:${route.replace(/\//g, ':')}`;
  }

  async fetchRouteData(route) {
    // Simulate fetching route data
    return {
      route,
      data: `Cached data for ${route}`,
      timestamp: new Date().toISOString()
    };
  }

  async warmUserCache(userId) {
    const userRoutes = [
      `/api/users/${userId}/profile`,
      `/api/users/${userId}/calculations`,
      `/api/users/${userId}/forms`
    ];

    await this.warmCache(userRoutes, { priority: 'high' });
  }

  async warmCalculationCache(calculationType) {
    const calcRoutes = [
      `/api/calculator/${calculationType}`,
      `/api/rates/${calculationType}`,
      `/api/forms/${calculationType}`
    ];

    await this.warmCache(calcRoutes, { priority: 'normal' });
  }

  /**
   * Track invalidation for analytics
   */
  trackInvalidation(key, type, reason) {
    if (!this.analytics.enabled) return;

    this.analytics.recentInvalidations.push({
      key,
      type,
      reason,
      timestamp: Date.now()
    });

    // Keep only recent invalidations
    const windowStart = Date.now() - this.config.analytics.trackingWindow;
    this.analytics.recentInvalidations = this.analytics.recentInvalidations
      .filter(inv => inv.timestamp > windowStart);
  }

  /**
   * Generate analytics report
   */
  generateAnalyticsReport() {
    const report = {
      dependencies: {
        total: this.dependencyGraph.size,
        active: Array.from(this.dependencyGraph.values())
          .filter(entry => Date.now() - entry.lastAccessed < 3600000).length
      },
      invalidations: { ...this.analytics.invalidations },
      warming: { ...this.analytics.warming },
      errors: { ...this.analytics.errors },
      queues: {
        invalidation: this.invalidationQueue.length,
        warming: this.warmingQueue.length
      },
      recentActivity: this.analytics.recentInvalidations.slice(-10)
    };

    this.emit('analyticsReport', report);
    return report;
  }

  /**
   * Get cache invalidation statistics
   */
  getStatistics() {
    return this.generateAnalyticsReport();
  }

  /**
   * Initialize analytics tracking
   */
  initializeAnalytics() {
    return {
      enabled: this.config.analytics.enabled,
      invalidations: {
        key: 0,
        pattern: 0,
        dependency: 0
      },
      warming: {
        success: 0,
        failed: 0,
        skipped: 0
      },
      errors: {
        invalidation: 0,
        warming: 0
      },
      recentInvalidations: []
    };
  }
}

module.exports = CacheInvalidationManager;