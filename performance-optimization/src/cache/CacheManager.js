const Redis = require('ioredis');
const NodeCache = require('node-cache');
const LRU = require('lru-cache');
const crypto = require('crypto');

class CacheManager {
  constructor(options = {}) {
    this.config = {
      // Redis configuration
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB || 0,
        keyPrefix: process.env.REDIS_PREFIX || 'gtc:',
        retryDelayOnFailover: 100,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 3,
        lazyConnect: true
      },

      // Memory cache configuration
      memory: {
        stdTTL: 300, // 5 minutes
        checkPeriod: 60, // Check for expired keys every 60 seconds
        useClones: false,
        deleteOnExpire: true,
        maxKeys: 10000
      },

      // LRU cache configuration
      lru: {
        max: 5000,
        ttl: 1000 * 60 * 10, // 10 minutes
        allowStale: false,
        updateAgeOnGet: true,
        updateAgeOnHas: true
      },

      // Cache layers priority
      layers: ['memory', 'lru', 'redis'],

      // Default TTL values for different cache types
      ttl: {
        static: 31536000,    // 1 year for static assets
        api: 300,            // 5 minutes for API responses
        database: 3600,      // 1 hour for database queries
        session: 86400,      // 24 hours for session data
        user: 1800,          // 30 minutes for user-specific data
        calculation: 900,    // 15 minutes for tax calculations
        reports: 7200,       // 2 hours for reports
        metadata: 21600      // 6 hours for metadata
      },

      ...options
    };

    this.initializeCaches();
    this.setupMetrics();
  }

  /**
   * Initialize cache layers
   */
  initializeCaches() {
    // Redis cache (L3 - Distributed)
    this.redis = new Redis(this.config.redis);
    this.redis.on('error', (err) => {
      console.error('Redis cache error:', err);
    });

    // Memory cache (L1 - Fastest)
    this.memoryCache = new NodeCache(this.config.memory);

    // LRU cache (L2 - Memory with eviction)
    this.lruCache = new LRU(this.config.lru);

    console.log('✅ Multi-layer cache system initialized');
  }

  /**
   * Setup metrics tracking
   */
  setupMetrics() {
    this.metrics = {
      hits: { memory: 0, lru: 0, redis: 0 },
      misses: { memory: 0, lru: 0, redis: 0 },
      sets: { memory: 0, lru: 0, redis: 0 },
      deletes: { memory: 0, lru: 0, redis: 0 },
      errors: { memory: 0, lru: 0, redis: 0 }
    };

    // Reset metrics every hour
    setInterval(() => {
      this.resetMetrics();
    }, 3600000);
  }

  /**
   * Get value from cache with fallback strategy
   */
  async get(key, options = {}) {
    const {
      layers = this.config.layers,
      skipLayers = [],
      updateUpstream = true
    } = options;

    let value = null;
    let hitLayer = null;

    for (const layer of layers) {
      if (skipLayers.includes(layer)) continue;

      try {
        switch (layer) {
          case 'memory':
            value = this.memoryCache.get(key);
            if (value !== undefined) {
              this.metrics.hits.memory++;
              hitLayer = 'memory';
            } else {
              this.metrics.misses.memory++;
            }
            break;

          case 'lru':
            value = this.lruCache.get(key);
            if (value !== undefined) {
              this.metrics.hits.lru++;
              hitLayer = 'lru';
            } else {
              this.metrics.misses.lru++;
            }
            break;

          case 'redis':
            const redisValue = await this.redis.get(key);
            if (redisValue !== null) {
              value = JSON.parse(redisValue);
              this.metrics.hits.redis++;
              hitLayer = 'redis';
            } else {
              this.metrics.misses.redis++;
            }
            break;
        }

        if (value !== null && value !== undefined) {
          // Update upstream caches
          if (updateUpstream && hitLayer) {
            await this.updateUpstreamCaches(key, value, layers, hitLayer);
          }
          break;
        }
      } catch (error) {
        console.error(`Error getting from ${layer} cache:`, error);
        this.metrics.errors[layer]++;
      }
    }

    return value;
  }

  /**
   * Set value in all cache layers
   */
  async set(key, value, ttl = null, options = {}) {
    const {
      layers = this.config.layers,
      skipLayers = [],
      type = 'api'
    } = options;

    const cacheTTL = ttl || this.config.ttl[type] || this.config.ttl.api;

    const promises = layers
      .filter(layer => !skipLayers.includes(layer))
      .map(async (layer) => {
        try {
          switch (layer) {
            case 'memory':
              this.memoryCache.set(key, value, cacheTTL);
              this.metrics.sets.memory++;
              break;

            case 'lru':
              this.lruCache.set(key, value, { ttl: cacheTTL * 1000 });
              this.metrics.sets.lru++;
              break;

            case 'redis':
              await this.redis.setex(key, cacheTTL, JSON.stringify(value));
              this.metrics.sets.redis++;
              break;
          }
        } catch (error) {
          console.error(`Error setting ${layer} cache:`, error);
          this.metrics.errors[layer]++;
        }
      });

    await Promise.allSettled(promises);
  }

  /**
   * Delete value from all cache layers
   */
  async delete(key, options = {}) {
    const {
      layers = this.config.layers,
      skipLayers = []
    } = options;

    const promises = layers
      .filter(layer => !skipLayers.includes(layer))
      .map(async (layer) => {
        try {
          switch (layer) {
            case 'memory':
              this.memoryCache.del(key);
              this.metrics.deletes.memory++;
              break;

            case 'lru':
              this.lruCache.delete(key);
              this.metrics.deletes.lru++;
              break;

            case 'redis':
              await this.redis.del(key);
              this.metrics.deletes.redis++;
              break;
          }
        } catch (error) {
          console.error(`Error deleting from ${layer} cache:`, error);
          this.metrics.errors[layer]++;
        }
      });

    await Promise.allSettled(promises);
  }

  /**
   * Update upstream caches when hit occurs in lower layer
   */
  async updateUpstreamCaches(key, value, layers, hitLayer) {
    const hitIndex = layers.indexOf(hitLayer);
    const upstreamLayers = layers.slice(0, hitIndex);

    for (const layer of upstreamLayers) {
      try {
        switch (layer) {
          case 'memory':
            this.memoryCache.set(key, value);
            break;

          case 'lru':
            this.lruCache.set(key, value);
            break;
        }
      } catch (error) {
        console.error(`Error updating upstream ${layer} cache:`, error);
      }
    }
  }

  /**
   * Get or set pattern with cache-aside strategy
   */
  async getOrSet(key, fetchFunction, ttl = null, options = {}) {
    const value = await this.get(key, options);

    if (value !== null && value !== undefined) {
      return value;
    }

    // Cache miss - fetch from source
    try {
      const fetchedValue = await fetchFunction();

      if (fetchedValue !== null && fetchedValue !== undefined) {
        await this.set(key, fetchedValue, ttl, options);
      }

      return fetchedValue;
    } catch (error) {
      console.error('Error in getOrSet fetchFunction:', error);
      throw error;
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidatePattern(pattern, options = {}) {
    const { layers = ['redis'] } = options;

    for (const layer of layers) {
      try {
        switch (layer) {
          case 'memory':
            // Memory cache doesn't support pattern deletion
            // We'd need to track keys or clear entire cache
            this.memoryCache.flushAll();
            break;

          case 'lru':
            // LRU cache doesn't support pattern deletion
            this.lruCache.clear();
            break;

          case 'redis':
            const keys = await this.redis.keys(pattern);
            if (keys.length > 0) {
              await this.redis.del(...keys);
            }
            break;
        }
      } catch (error) {
        console.error(`Error invalidating pattern in ${layer}:`, error);
      }
    }
  }

  /**
   * Warm cache with pre-computed values
   */
  async warmCache(warmingData, options = {}) {
    const {
      batchSize = 100,
      type = 'api'
    } = options;

    console.log(`Starting cache warming with ${warmingData.length} items...`);

    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < warmingData.length; i += batchSize) {
      const batch = warmingData.slice(i, i + batchSize);

      const promises = batch.map(async ({ key, value, ttl }) => {
        await this.set(key, value, ttl, { type });
      });

      await Promise.allSettled(promises);

      console.log(`Warmed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(warmingData.length / batchSize)}`);
    }

    console.log('✅ Cache warming completed');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const memoryStats = this.memoryCache.getStats();

    return {
      layers: {
        memory: {
          ...memoryStats,
          size: this.memoryCache.keys().length
        },
        lru: {
          size: this.lruCache.size,
          max: this.lruCache.max,
          calculatedSize: this.lruCache.calculatedSize
        },
        redis: {
          status: this.redis.status,
          connected: this.redis.status === 'ready'
        }
      },
      metrics: this.metrics,
      hitRatio: this.calculateHitRatio(),
      performance: this.getPerformanceMetrics()
    };
  }

  /**
   * Calculate hit ratio across all layers
   */
  calculateHitRatio() {
    const totalHits = Object.values(this.metrics.hits).reduce((sum, hits) => sum + hits, 0);
    const totalMisses = Object.values(this.metrics.misses).reduce((sum, misses) => sum + misses, 0);
    const totalRequests = totalHits + totalMisses;

    return {
      overall: totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0,
      memory: this.calculateLayerHitRatio('memory'),
      lru: this.calculateLayerHitRatio('lru'),
      redis: this.calculateLayerHitRatio('redis')
    };
  }

  /**
   * Calculate hit ratio for specific layer
   */
  calculateLayerHitRatio(layer) {
    const hits = this.metrics.hits[layer];
    const misses = this.metrics.misses[layer];
    const total = hits + misses;

    return total > 0 ? (hits / total) * 100 : 0;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return {
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      redisMemory: this.redis.status === 'ready' ? 'connected' : 'disconnected'
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      hits: { memory: 0, lru: 0, redis: 0 },
      misses: { memory: 0, lru: 0, redis: 0 },
      sets: { memory: 0, lru: 0, redis: 0 },
      deletes: { memory: 0, lru: 0, redis: 0 },
      errors: { memory: 0, lru: 0, redis: 0 }
    };
  }

  /**
   * Generate cache key with namespace and hashing
   */
  generateKey(namespace, identifier, params = {}) {
    const baseKey = `${namespace}:${identifier}`;

    if (Object.keys(params).length === 0) {
      return baseKey;
    }

    // Sort parameters for consistent key generation
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((sorted, key) => {
        sorted[key] = params[key];
        return sorted;
      }, {});

    const paramString = JSON.stringify(sortedParams);
    const paramHash = crypto.createHash('md5').update(paramString).digest('hex');

    return `${baseKey}:${paramHash}`;
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('Shutting down cache manager...');

    try {
      this.memoryCache.close();
      this.lruCache.clear();
      await this.redis.quit();

      console.log('✅ Cache manager shutdown complete');
    } catch (error) {
      console.error('Error during cache shutdown:', error);
    }
  }
}

module.exports = CacheManager;