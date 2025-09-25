const compression = require('compression');
const zlib = require('zlib');

class APIOptimizer {
  constructor(options = {}) {
    this.config = {
      // Compression settings
      compression: {
        threshold: 1024, // Compress responses > 1KB
        level: 6, // Compression level (1-9)
        chunkSize: 16384,
        windowBits: 15,
        memLevel: 8,
        filter: (req, res) => {
          // Don't compress if client doesn't support it
          if (!req.headers['accept-encoding']) return false;

          // Don't compress for these content types
          const skipTypes = ['image/', 'video/', 'audio/', 'application/octet-stream'];
          const contentType = res.get('Content-Type') || '';
          return !skipTypes.some(type => contentType.includes(type));
        }
      },

      // Response optimization
      response: {
        // Field selection and projection
        allowFieldSelection: true,
        defaultFields: ['id', 'name', 'created_at'],

        // Pagination
        maxPageSize: 100,
        defaultPageSize: 20,

        // Data transformation
        removeNullFields: true,
        formatDates: true,
        compactArrays: true,

        // Response headers
        headers: {
          'X-Response-Time': true,
          'X-Cache-Status': true,
          'X-Rate-Limit-Remaining': true
        }
      },

      // Batch processing
      batch: {
        enabled: true,
        maxBatchSize: 50,
        timeout: 5000,
        parallelProcessing: true,
        failFast: false
      },

      // Request optimization
      request: {
        // Body parsing limits
        jsonLimit: '10mb',
        urlEncodedLimit: '10mb',
        textLimit: '10mb',

        // Request validation
        validateSchema: true,
        sanitizeInput: true,

        // Rate limiting per endpoint
        rateLimits: {
          default: { window: 900000, max: 100 }, // 15 min window
          auth: { window: 300000, max: 5 },      // 5 min window
          api: { window: 900000, max: 1000 },    // 15 min window
          upload: { window: 3600000, max: 10 }   // 1 hour window
        }
      },

      // Caching strategies per endpoint
      caching: {
        strategies: {
          static: { ttl: 31536000, vary: ['Accept-Encoding'] },
          api: { ttl: 300, vary: ['Accept-Encoding', 'Authorization'] },
          user: { ttl: 1800, vary: ['Authorization'] },
          public: { ttl: 3600, vary: ['Accept-Encoding'] }
        }
      },

      ...options
    };

    this.batchQueue = new Map();
    this.responseMetrics = this.initializeMetrics();
  }

  /**
   * Setup compression middleware with optimal settings
   */
  compressionMiddleware() {
    return compression({
      threshold: this.config.compression.threshold,
      level: this.config.compression.level,
      chunkSize: this.config.compression.chunkSize,
      windowBits: this.config.compression.windowBits,
      memLevel: this.config.compression.memLevel,
      filter: this.config.compression.filter,

      // Brotli compression for modern browsers
      brotli: {
        enabled: true,
        zlib: zlib.constants.BROTLI_PARAM_QUALITY,
        quality: 6,
        lgwin: 22
      }
    });
  }

  /**
   * Response optimization middleware
   */
  responseOptimizationMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();

      // Store original json method
      const originalJson = res.json;

      // Override json method to optimize response
      res.json = (data) => {
        try {
          let optimizedData = this.optimizeResponseData(data, req);

          // Apply field selection if requested
          if (req.query.fields && this.config.response.allowFieldSelection) {
            optimizedData = this.selectFields(optimizedData, req.query.fields);
          }

          // Apply pagination if it's an array
          if (Array.isArray(optimizedData) && req.query.page) {
            optimizedData = this.paginateResponse(optimizedData, req.query);
          }

          // Add performance headers
          this.addPerformanceHeaders(res, startTime);

          // Call original json method
          return originalJson.call(res, optimizedData);

        } catch (error) {
          console.error('Error optimizing response:', error);
          return originalJson.call(res, data);
        }
      };

      next();
    };
  }

  /**
   * Optimize response data structure
   */
  optimizeResponseData(data, req) {
    if (!data || typeof data !== 'object') return data;

    // Clone data to avoid mutations
    let optimized = JSON.parse(JSON.stringify(data));

    // Remove null/undefined fields if configured
    if (this.config.response.removeNullFields) {
      optimized = this.removeNullFields(optimized);
    }

    // Format dates consistently
    if (this.config.response.formatDates) {
      optimized = this.formatDates(optimized);
    }

    // Compact arrays by removing empty elements
    if (this.config.response.compactArrays) {
      optimized = this.compactArrays(optimized);
    }

    // Add metadata for API responses
    if (Array.isArray(optimized)) {
      optimized = {
        data: optimized,
        meta: {
          count: optimized.length,
          timestamp: new Date().toISOString(),
          ...(req.query.page && { pagination: this.getPaginationMeta(req.query) })
        }
      };
    }

    return optimized;
  }

  /**
   * Remove null and undefined fields from object
   */
  removeNullFields(obj) {
    if (Array.isArray(obj)) {
      return obj.map(item => this.removeNullFields(item));
    }

    if (obj && typeof obj === 'object') {
      const cleaned = {};
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        if (value !== null && value !== undefined) {
          cleaned[key] = this.removeNullFields(value);
        }
      });
      return cleaned;
    }

    return obj;
  }

  /**
   * Format dates consistently across response
   */
  formatDates(obj) {
    if (Array.isArray(obj)) {
      return obj.map(item => this.formatDates(item));
    }

    if (obj && typeof obj === 'object') {
      const formatted = {};
      Object.keys(obj).forEach(key => {
        const value = obj[key];

        // Check if it's a date field
        if (typeof value === 'string' && this.isDateString(value)) {
          formatted[key] = new Date(value).toISOString();
        } else if (value instanceof Date) {
          formatted[key] = value.toISOString();
        } else {
          formatted[key] = this.formatDates(value);
        }
      });
      return formatted;
    }

    return obj;
  }

  /**
   * Check if string is a date
   */
  isDateString(str) {
    const dateFields = ['_at', '_date', 'Date', 'Time'];
    return dateFields.some(field => str.includes(field)) && !isNaN(Date.parse(str));
  }

  /**
   * Compact arrays by removing empty elements
   */
  compactArrays(obj) {
    if (Array.isArray(obj)) {
      return obj
        .filter(item => item !== null && item !== undefined && item !== '')
        .map(item => this.compactArrays(item));
    }

    if (obj && typeof obj === 'object') {
      const compacted = {};
      Object.keys(obj).forEach(key => {
        compacted[key] = this.compactArrays(obj[key]);
      });
      return compacted;
    }

    return obj;
  }

  /**
   * Select specific fields from response
   */
  selectFields(data, fields) {
    const fieldArray = fields.split(',').map(f => f.trim());

    if (Array.isArray(data)) {
      return data.map(item => this.selectObjectFields(item, fieldArray));
    }

    return this.selectObjectFields(data, fieldArray);
  }

  /**
   * Select specific fields from object
   */
  selectObjectFields(obj, fields) {
    if (!obj || typeof obj !== 'object') return obj;

    const selected = {};
    fields.forEach(field => {
      if (field.includes('.')) {
        // Handle nested fields (e.g., 'user.name')
        const [parent, child] = field.split('.');
        if (obj[parent] && typeof obj[parent] === 'object') {
          if (!selected[parent]) selected[parent] = {};
          selected[parent][child] = obj[parent][child];
        }
      } else if (obj.hasOwnProperty(field)) {
        selected[field] = obj[field];
      }
    });

    return selected;
  }

  /**
   * Paginate response array
   */
  paginateResponse(data, query) {
    const page = parseInt(query.page) || 1;
    const limit = Math.min(
      parseInt(query.limit) || this.config.response.defaultPageSize,
      this.config.response.maxPageSize
    );

    const offset = (page - 1) * limit;
    const paginatedData = data.slice(offset, offset + limit);

    return {
      data: paginatedData,
      meta: {
        pagination: {
          page,
          limit,
          total: data.length,
          pages: Math.ceil(data.length / limit),
          hasNext: offset + limit < data.length,
          hasPrev: page > 1
        }
      }
    };
  }

  /**
   * Get pagination metadata
   */
  getPaginationMeta(query) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || this.config.response.defaultPageSize;

    return {
      page,
      limit,
      offset: (page - 1) * limit
    };
  }

  /**
   * Add performance headers to response
   */
  addPerformanceHeaders(res, startTime) {
    const responseTime = Date.now() - startTime;

    if (this.config.response.headers['X-Response-Time']) {
      res.set('X-Response-Time', `${responseTime}ms`);
    }

    if (this.config.response.headers['X-Cache-Status']) {
      res.set('X-Cache-Status', res.locals.cacheStatus || 'MISS');
    }

    // Update metrics
    this.responseMetrics.totalRequests++;
    this.responseMetrics.totalResponseTime += responseTime;
    this.responseMetrics.averageResponseTime =
      this.responseMetrics.totalResponseTime / this.responseMetrics.totalRequests;

    if (responseTime > 1000) {
      this.responseMetrics.slowRequests++;
    }
  }

  /**
   * Batch API middleware for processing multiple requests
   */
  batchMiddleware() {
    return async (req, res, next) => {
      if (req.path !== '/api/batch' || req.method !== 'POST') {
        return next();
      }

      try {
        const { requests, parallel = true } = req.body;

        if (!Array.isArray(requests) || requests.length === 0) {
          return res.status(400).json({
            error: 'Invalid batch request format'
          });
        }

        if (requests.length > this.config.batch.maxBatchSize) {
          return res.status(400).json({
            error: `Batch size exceeds maximum of ${this.config.batch.maxBatchSize}`
          });
        }

        const results = await this.processBatchRequests(requests, parallel);

        res.json({
          results,
          meta: {
            count: results.length,
            parallel,
            timestamp: new Date().toISOString()
          }
        });

      } catch (error) {
        console.error('Batch processing error:', error);
        res.status(500).json({
          error: 'Batch processing failed',
          message: error.message
        });
      }
    };
  }

  /**
   * Process batch requests
   */
  async processBatchRequests(requests, parallel = true) {
    const results = [];

    if (parallel) {
      // Process requests in parallel
      const promises = requests.map(async (request, index) => {
        try {
          const result = await this.executeRequest(request);
          return { index, success: true, data: result };
        } catch (error) {
          return {
            index,
            success: false,
            error: error.message,
            status: error.status || 500
          };
        }
      });

      const responses = await Promise.allSettled(promises);

      responses.forEach((response, index) => {
        if (response.status === 'fulfilled') {
          results[response.value.index] = response.value;
        } else {
          results[index] = {
            index,
            success: false,
            error: response.reason.message || 'Request failed'
          };
        }
      });

    } else {
      // Process requests sequentially
      for (let i = 0; i < requests.length; i++) {
        try {
          const result = await this.executeRequest(requests[i]);
          results.push({ index: i, success: true, data: result });
        } catch (error) {
          results.push({
            index: i,
            success: false,
            error: error.message,
            status: error.status || 500
          });

          // Stop on first error if failFast is enabled
          if (this.config.batch.failFast) {
            break;
          }
        }
      }
    }

    return results;
  }

  /**
   * Execute individual request in batch
   */
  async executeRequest(request) {
    const { method, url, headers = {}, body } = request;

    // Simulate request execution
    // In real implementation, this would make actual HTTP requests
    // or call internal route handlers

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) { // 90% success rate
          resolve({
            method,
            url,
            status: 200,
            data: { message: 'Success', timestamp: new Date().toISOString() }
          });
        } else {
          reject(new Error('Simulated request failure'));
        }
      }, Math.random() * 100); // Random delay up to 100ms
    });
  }

  /**
   * Request size optimization middleware
   */
  requestOptimizationMiddleware() {
    return (req, res, next) => {
      // Log large requests
      const contentLength = parseInt(req.headers['content-length']) || 0;

      if (contentLength > 1000000) { // 1MB
        console.warn(`Large request detected: ${contentLength} bytes to ${req.path}`);
        this.responseMetrics.largeRequests++;
      }

      // Validate request structure for API endpoints
      if (req.path.startsWith('/api/') && req.method !== 'GET') {
        if (this.config.request.validateSchema) {
          // Basic request validation
          if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 100) {
            return res.status(400).json({
              error: 'Request body too complex',
              message: 'Reduce the number of fields in request body'
            });
          }
        }
      }

      next();
    };
  }

  /**
   * API response caching middleware
   */
  apiCachingMiddleware(strategy = 'api') {
    return (req, res, next) => {
      // Only cache GET requests
      if (req.method !== 'GET') {
        return next();
      }

      const cacheConfig = this.config.caching.strategies[strategy];
      if (!cacheConfig) {
        return next();
      }

      // Generate cache key
      const cacheKey = this.generateCacheKey(req);

      // Store cache configuration in res.locals for other middleware
      res.locals.cacheConfig = cacheConfig;
      res.locals.cacheKey = cacheKey;

      // Set cache headers
      res.set('Cache-Control', `public, max-age=${cacheConfig.ttl}`);

      if (cacheConfig.vary) {
        res.set('Vary', cacheConfig.vary.join(', '));
      }

      next();
    };
  }

  /**
   * Generate cache key for request
   */
  generateCacheKey(req) {
    const crypto = require('crypto');

    const keyComponents = [
      req.path,
      JSON.stringify(req.query),
      req.headers['accept-encoding'] || '',
      req.headers['authorization'] ? 'auth' : 'public'
    ];

    const keyString = keyComponents.join('|');
    return crypto.createHash('md5').update(keyString).digest('hex');
  }

  /**
   * Initialize response metrics
   */
  initializeMetrics() {
    return {
      totalRequests: 0,
      totalResponseTime: 0,
      averageResponseTime: 0,
      slowRequests: 0,
      largeRequests: 0,
      batchRequests: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  /**
   * Get API performance metrics
   */
  getMetrics() {
    return {
      ...this.responseMetrics,
      cacheHitRatio: this.responseMetrics.cacheHits /
        (this.responseMetrics.cacheHits + this.responseMetrics.cacheMisses) * 100 || 0,
      slowRequestRatio: this.responseMetrics.slowRequests /
        this.responseMetrics.totalRequests * 100 || 0,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.responseMetrics = this.initializeMetrics();
  }

  /**
   * Generate API optimization report
   */
  generateOptimizationReport() {
    const metrics = this.getMetrics();
    const recommendations = [];

    if (metrics.averageResponseTime > 500) {
      recommendations.push({
        type: 'response_time',
        priority: 'high',
        message: 'Average response time is high. Consider optimizing queries or adding caching.',
        current: `${metrics.averageResponseTime}ms`,
        target: '<500ms'
      });
    }

    if (metrics.cacheHitRatio < 80) {
      recommendations.push({
        type: 'cache_hit_ratio',
        priority: 'medium',
        message: 'Cache hit ratio is low. Review caching strategy.',
        current: `${metrics.cacheHitRatio.toFixed(1)}%`,
        target: '>80%'
      });
    }

    if (metrics.slowRequestRatio > 5) {
      recommendations.push({
        type: 'slow_requests',
        priority: 'medium',
        message: 'High percentage of slow requests detected.',
        current: `${metrics.slowRequestRatio.toFixed(1)}%`,
        target: '<5%'
      });
    }

    return {
      metrics,
      recommendations,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = APIOptimizer;