/**
 * Advanced Caching Middleware
 * Implements intelligent caching strategies with Redis, CDN integration, and cache optimization
 */

const NodeCache = require('node-cache');
const crypto = require('crypto');
const winston = require('winston');
const LRU = require('lru-cache');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/caching.log' })
  ]
});

class CachingManager {
  constructor(redisClient) {
    this.redisClient = redisClient;

    // Initialize multiple cache layers
    this.memoryCache = new NodeCache({
      stdTTL: 300, // 5 minutes default
      checkperiod: 60, // Check for expired keys every minute
      maxKeys: 10000
    });

    // LRU cache for frequently accessed items
    this.lruCache = new LRU({
      max: 5000,
      ttl: 1000 * 60 * 10 // 10 minutes
    });

    // Cache statistics
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };

    // Cache configurations for different endpoints
    this.cacheConfigs = new Map([
      // Static data - long cache
      ['/api/*/tax-brackets', { ttl: 86400, type: 'static' }], // 24 hours
      ['/api/*/countries', { ttl: 43200, type: 'static' }], // 12 hours
      ['/api/*/states', { ttl: 43200, type: 'static' }], // 12 hours

      // User-specific data - medium cache
      ['/api/*/users/:id', { ttl: 1800, type: 'user', private: true }], // 30 minutes
      ['/api/*/users/:id/calculations', { ttl: 900, type: 'user', private: true }], // 15 minutes

      // Calculation results - short cache
      ['/api/*/calculate', { ttl: 600, type: 'calculation', vary: ['user', 'input'] }], // 10 minutes

      // Reports - medium cache with dependencies
      ['/api/*/reports', { ttl: 3600, type: 'report', dependencies: ['calculations'] }], // 1 hour

      // Authentication - very short cache
      ['/api/*/auth/verify', { ttl: 60, type: 'auth' }], // 1 minute

      // API documentation - long cache
      ['/docs/*', { ttl: 3600, type: 'static' }], // 1 hour
      ['/api-spec/*', { ttl: 3600, type: 'static' }] // 1 hour
    ]);

    // Cache invalidation patterns
    this.invalidationPatterns = new Map([
      ['user_update', ['/api/*/users/:id*']],
      ['calculation_create', ['/api/*/users/:id/calculations', '/api/*/reports*']],
      ['tax_data_update', ['/api/*/tax-brackets*', '/api/*/calculate*']],
      ['user_delete', ['/api/*/users/:id*']]
    ]);

    this.initializeCacheEvents();
  }

  /**
   * Initialize cache event handlers
   */
  initializeCacheEvents() {
    // Memory cache events
    this.memoryCache.on('set', (key, value) => {
      this.stats.sets++;
      logger.debug('Memory cache set', { key });
    });

    this.memoryCache.on('del', (key, value) => {
      this.stats.deletes++;
      logger.debug('Memory cache delete', { key });
    });

    this.memoryCache.on('expired', (key, value) => {
      logger.debug('Memory cache expired', { key });
    });
  }

  /**
   * Main caching middleware
   */
  middleware() {
    return async (req, res, next) => {
      try {
        // Skip caching for certain conditions
        if (this.shouldSkipCache(req)) {
          return next();
        }

        const cacheConfig = this.getCacheConfig(req);
        if (!cacheConfig) {
          return next();
        }

        const cacheKey = this.generateCacheKey(req, cacheConfig);

        // Try to get from cache
        const cachedResponse = await this.getFromCache(cacheKey, cacheConfig);

        if (cachedResponse) {
          this.stats.hits++;
          this.sendCachedResponse(res, cachedResponse, cacheKey);
          return;
        }

        this.stats.misses++;

        // Cache the response
        this.interceptResponse(res, cacheKey, cacheConfig, req);

        next();
      } catch (error) {
        this.stats.errors++;
        logger.error('Caching middleware error', error);
        next(); // Continue without caching on error
      }
    };
  }

  /**
   * Check if caching should be skipped
   */
  shouldSkipCache(req) {
    // Skip for certain methods
    if (!['GET', 'HEAD'].includes(req.method)) {
      return true;
    }

    // Skip if no-cache header is present
    if (req.headers['cache-control']?.includes('no-cache')) {
      return true;
    }

    // Skip if authorization header present (unless explicitly configured)
    if (req.headers.authorization && !this.isPublicEndpoint(req)) {
      return true;
    }

    // Skip for development
    if (process.env.NODE_ENV === 'development' && !process.env.ENABLE_DEV_CACHE) {
      return true;
    }

    return false;
  }

  /**
   * Check if endpoint is public (cacheable with auth)
   */
  isPublicEndpoint(req) {
    const publicEndpoints = [
      '/api/*/tax-brackets',
      '/api/*/countries',
      '/api/*/states',
      '/docs/*',
      '/api-spec/*'
    ];

    return publicEndpoints.some(pattern => this.matchesPattern(req.path, pattern));
  }

  /**
   * Get cache configuration for request
   */
  getCacheConfig(req) {
    const path = req.path;

    // Find matching configuration
    for (const [pattern, config] of this.cacheConfigs) {
      if (this.matchesPattern(path, pattern)) {
        return { ...config, pattern };
      }
    }

    return null;
  }

  /**
   * Check if path matches pattern
   */
  matchesPattern(path, pattern) {
    // Convert pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/:id/g, '[^/]+')
      .replace(/\//g, '\\/');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  /**
   * Generate cache key
   */
  generateCacheKey(req, config) {
    const parts = [
      'gtc', // GlobalTaxCalc prefix
      this.normalizePattern(config.pattern),
      req.method
    ];

    // Add user context for private caches
    if (config.private && req.user?.id) {
      parts.push(`user:${req.user.id}`);
    }

    // Add API key context
    if (req.apiKey?.id) {
      parts.push(`key:${req.apiKey.id}`);
    }

    // Add version context
    if (req.apiVersion?.resolved) {
      parts.push(`v:${req.apiVersion.resolved}`);
    }

    // Add vary parameters
    if (config.vary) {
      config.vary.forEach(varyType => {
        switch (varyType) {
          case 'user':
            if (req.user?.id) parts.push(`u:${req.user.id}`);
            break;
          case 'input':
            if (req.query && Object.keys(req.query).length > 0) {
              const queryHash = this.hashObject(req.query);
              parts.push(`q:${queryHash}`);
            }
            if (req.body && Object.keys(req.body).length > 0) {
              const bodyHash = this.hashObject(req.body);
              parts.push(`b:${bodyHash}`);
            }
            break;
          case 'headers':
            const relevantHeaders = this.getRelevantHeaders(req);
            if (Object.keys(relevantHeaders).length > 0) {
              const headersHash = this.hashObject(relevantHeaders);
              parts.push(`h:${headersHash}`);
            }
            break;
        }
      });
    }

    return parts.join(':');
  }

  /**
   * Normalize pattern for cache key
   */
  normalizePattern(pattern) {
    return pattern
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Hash object for cache key
   */
  hashObject(obj) {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    return crypto.createHash('md5').update(str).digest('hex').substring(0, 8);
  }

  /**
   * Get relevant headers for caching
   */
  getRelevantHeaders(req) {
    const relevantHeaders = {};
    const headerKeys = ['accept', 'accept-language', 'accept-encoding'];

    headerKeys.forEach(key => {
      if (req.headers[key]) {
        relevantHeaders[key] = req.headers[key];
      }
    });

    return relevantHeaders;
  }

  /**
   * Get data from cache (multi-layer)
   */
  async getFromCache(cacheKey, config) {
    try {
      // Try LRU cache first (fastest)
      const lruResult = this.lruCache.get(cacheKey);
      if (lruResult) {
        logger.debug('LRU cache hit', { cacheKey });
        return lruResult;
      }

      // Try memory cache
      const memoryResult = this.memoryCache.get(cacheKey);
      if (memoryResult) {
        logger.debug('Memory cache hit', { cacheKey });
        // Promote to LRU cache
        this.lruCache.set(cacheKey, memoryResult);
        return memoryResult;
      }

      // Try Redis cache
      if (this.redisClient) {
        const redisResult = await this.redisClient.get(cacheKey);
        if (redisResult) {
          logger.debug('Redis cache hit', { cacheKey });
          const parsed = JSON.parse(redisResult);

          // Promote to memory caches
          this.memoryCache.set(cacheKey, parsed, config.ttl);
          this.lruCache.set(cacheKey, parsed);

          return parsed;
        }
      }

      return null;
    } catch (error) {
      logger.error('Error getting from cache', { cacheKey, error });
      return null;
    }
  }

  /**
   * Store data in cache (multi-layer)
   */
  async storeInCache(cacheKey, data, config) {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        ttl: config.ttl,
        type: config.type
      };

      // Store in LRU cache
      this.lruCache.set(cacheKey, cacheData);

      // Store in memory cache
      this.memoryCache.set(cacheKey, cacheData, config.ttl);

      // Store in Redis cache
      if (this.redisClient) {
        await this.redisClient.setex(cacheKey, config.ttl, JSON.stringify(cacheData));
      }

      this.stats.sets++;
      logger.debug('Data stored in cache', { cacheKey, ttl: config.ttl });
    } catch (error) {
      logger.error('Error storing in cache', { cacheKey, error });
    }
  }

  /**
   * Intercept response to cache it
   */
  interceptResponse(res, cacheKey, config, req) {
    const originalSend = res.send;
    const originalJson = res.json;

    res.send = function(body) {
      res.send = originalSend;

      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const responseData = {
          statusCode: res.statusCode,
          headers: this.getCacheableHeaders(res),
          body: body
        };

        this.storeInCache(cacheKey, responseData, config).catch(error => {
          logger.error('Error caching response', error);
        });
      }

      return originalSend.call(this, body);
    }.bind(this);

    res.json = function(body) {
      res.json = originalJson;

      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const responseData = {
          statusCode: res.statusCode,
          headers: this.getCacheableHeaders(res),
          body: body
        };

        this.storeInCache(cacheKey, responseData, config).catch(error => {
          logger.error('Error caching response', error);
        });
      }

      return originalJson.call(this, body);
    }.bind(this);
  }

  /**
   * Get cacheable headers from response
   */
  getCacheableHeaders(res) {
    const cacheableHeaders = {};
    const headerKeys = ['content-type', 'etag', 'last-modified'];

    headerKeys.forEach(key => {
      const value = res.get(key);
      if (value) {
        cacheableHeaders[key] = value;
      }
    });

    return cacheableHeaders;
  }

  /**
   * Send cached response
   */
  sendCachedResponse(res, cachedData, cacheKey) {
    try {
      const { data, timestamp } = cachedData;
      const age = Math.floor((Date.now() - timestamp) / 1000);

      // Set cache headers
      res.set({
        'X-Cache': 'HIT',
        'X-Cache-Key': cacheKey,
        'Age': age.toString(),
        'Cache-Control': `max-age=${cachedData.ttl - age}`,
        ...data.headers
      });

      // Set status code
      res.status(data.statusCode || 200);

      // Send response
      if (typeof data.body === 'string') {
        res.send(data.body);
      } else {
        res.json(data.body);
      }

      logger.debug('Cached response sent', { cacheKey, age });
    } catch (error) {
      logger.error('Error sending cached response', error);
      throw error;
    }
  }

  /**
   * Conditional caching middleware (ETags, Last-Modified)
   */
  conditionalCaching() {
    return (req, res, next) => {
      const ifModifiedSince = req.headers['if-modified-since'];
      const ifNoneMatch = req.headers['if-none-match'];

      // Intercept response to add ETags
      const originalSend = res.send;
      const originalJson = res.json;

      const generateETag = (content) => {
        const hash = crypto.createHash('md5').update(content).digest('hex');
        return `"${hash}"`;
      };

      res.send = function(body) {
        // Generate ETag
        const etag = generateETag(body);
        res.set('ETag', etag);
        res.set('Last-Modified', new Date().toUTCString());

        // Check if client has current version
        if (ifNoneMatch === etag) {
          return res.status(304).end();
        }

        return originalSend.call(this, body);
      };

      res.json = function(body) {
        const bodyString = JSON.stringify(body);
        const etag = generateETag(bodyString);
        res.set('ETag', etag);
        res.set('Last-Modified', new Date().toUTCString());

        if (ifNoneMatch === etag) {
          return res.status(304).end();
        }

        return originalJson.call(this, body);
      };

      next();
    };
  }

  /**
   * Cache warming middleware
   */
  async warmCache(endpoints = []) {
    logger.info('Starting cache warming');

    for (const endpoint of endpoints) {
      try {
        const { method = 'GET', path, headers = {}, body } = endpoint;

        // Simulate request for cache key generation
        const mockReq = {
          method,
          path,
          headers,
          body,
          query: {},
          user: null,
          apiKey: null,
          apiVersion: { resolved: 'v2' }
        };

        const config = this.getCacheConfig(mockReq);
        if (config) {
          const cacheKey = this.generateCacheKey(mockReq, config);

          // Check if already cached
          const cached = await this.getFromCache(cacheKey, config);
          if (!cached) {
            logger.info(`Warming cache for ${path}`);
            // In a real implementation, you would make the actual request here
            // For now, we'll just log the warming attempt
          }
        }
      } catch (error) {
        logger.error(`Error warming cache for ${endpoint.path}`, error);
      }
    }

    logger.info('Cache warming completed');
  }

  /**
   * Cache invalidation by pattern
   */
  async invalidateByPattern(pattern) {
    try {
      logger.info(`Invalidating cache by pattern: ${pattern}`);

      // Clear from memory cache
      const memoryKeys = this.memoryCache.keys();
      const matchingMemoryKeys = memoryKeys.filter(key =>
        this.matchesPattern(key, pattern)
      );
      matchingMemoryKeys.forEach(key => this.memoryCache.del(key));

      // Clear from LRU cache
      this.lruCache.clear();

      // Clear from Redis cache
      if (this.redisClient) {
        const redisKeys = await this.redisClient.keys(`*${pattern}*`);
        if (redisKeys.length > 0) {
          await this.redisClient.del(redisKeys);
        }
      }

      this.stats.deletes += matchingMemoryKeys.length;
      logger.info(`Invalidated ${matchingMemoryKeys.length} cache entries`);
    } catch (error) {
      logger.error('Error invalidating cache by pattern', error);
    }
  }

  /**
   * Invalidate cache by event
   */
  async invalidateByEvent(eventType, context = {}) {
    const patterns = this.invalidationPatterns.get(eventType);
    if (!patterns) {
      return;
    }

    for (const pattern of patterns) {
      // Replace placeholders with actual values
      let resolvedPattern = pattern;
      if (context.userId) {
        resolvedPattern = resolvedPattern.replace(':id', context.userId);
      }

      await this.invalidateByPattern(resolvedPattern);
    }
  }

  /**
   * CDN integration middleware
   */
  cdnIntegration() {
    return (req, res, next) => {
      // Add CDN headers for static content
      if (this.isStaticContent(req)) {
        res.set({
          'Cache-Control': 'public, max-age=31536000', // 1 year
          'Expires': new Date(Date.now() + 31536000000).toUTCString(),
          'Vary': 'Accept-Encoding'
        });
      }

      next();
    };
  }

  /**
   * Check if content is static
   */
  isStaticContent(req) {
    const staticPatterns = [
      '/docs/*',
      '/api-spec/*',
      '/api/*/tax-brackets',
      '/api/*/countries',
      '/api/*/states'
    ];

    return staticPatterns.some(pattern => this.matchesPattern(req.path, pattern));
  }

  /**
   * Cache statistics endpoint
   */
  getStatsEndpoint() {
    return (req, res) => {
      const hitRate = this.stats.hits + this.stats.misses > 0
        ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
        : 0;

      const stats = {
        ...this.stats,
        hitRate: `${hitRate}%`,
        memoryCache: {
          keys: this.memoryCache.keys().length,
          stats: this.memoryCache.getStats()
        },
        lruCache: {
          size: this.lruCache.size,
          max: this.lruCache.max
        },
        timestamp: new Date().toISOString()
      };

      res.json(stats);
    };
  }

  /**
   * Cache flush endpoint (admin only)
   */
  getFlushEndpoint() {
    return async (req, res) => {
      try {
        // Clear all caches
        this.memoryCache.flushAll();
        this.lruCache.clear();

        if (this.redisClient) {
          const keys = await this.redisClient.keys('gtc:*');
          if (keys.length > 0) {
            await this.redisClient.del(keys);
          }
        }

        // Reset stats
        this.stats = {
          hits: 0,
          misses: 0,
          sets: 0,
          deletes: 0,
          errors: 0
        };

        logger.info('All caches flushed');

        res.json({
          message: 'All caches flushed successfully',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Error flushing caches', error);
        res.status(500).json({
          error: {
            code: 'CACHE_FLUSH_ERROR',
            message: error.message
          }
        });
      }
    };
  }

  /**
   * Get cache configuration
   */
  getCacheConfiguration() {
    return {
      configs: Object.fromEntries(this.cacheConfigs),
      invalidationPatterns: Object.fromEntries(this.invalidationPatterns),
      stats: this.stats
    };
  }
}

// Create singleton instance
let cachingManagerInstance;

function createCachingManager(redisClient) {
  if (!cachingManagerInstance) {
    cachingManagerInstance = new CachingManager(redisClient);
  }
  return cachingManagerInstance;
}

module.exports = {
  CachingManager,
  createCachingManager
};