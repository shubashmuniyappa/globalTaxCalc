/**
 * Edge Cache Manager - Advanced caching strategies and cache warming
 */

export class EdgeCache {
  constructor() {
    this.cacheStrategies = {
      static: {
        ttl: 31536000, // 1 year
        staleWhileRevalidate: 86400,
        maxAge: 31536000,
        tags: ['static']
      },
      api: {
        ttl: 300, // 5 minutes
        staleWhileRevalidate: 60,
        maxAge: 300,
        tags: ['api']
      },
      html: {
        ttl: 3600, // 1 hour
        staleWhileRevalidate: 1800,
        maxAge: 3600,
        tags: ['html']
      },
      dynamic: {
        ttl: 60, // 1 minute
        staleWhileRevalidate: 30,
        maxAge: 60,
        tags: ['dynamic']
      },
      personalized: {
        ttl: 300, // 5 minutes
        staleWhileRevalidate: 60,
        maxAge: 0, // No browser cache for personalized content
        tags: ['personalized']
      }
    };

    this.warmingQueue = new Set();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      writes: 0,
      evictions: 0
    };
  }

  /**
   * Generate cache key for request
   */
  generateCacheKey(request, context) {
    const url = new URL(request.url);
    const baseKey = `${request.method}:${url.pathname}${url.search}`;

    // Add personalization factors for personalized content
    if (this.requiresPersonalization(url.pathname)) {
      const personalizedKey = this.generatePersonalizedKey(request, context);
      return `${baseKey}:${personalizedKey}`;
    }

    // Add device type for responsive content
    const deviceType = this.getDeviceType(request.headers.get('User-Agent'));
    if (this.requiresDeviceSpecificCache(url.pathname)) {
      return `${baseKey}:device:${deviceType}`;
    }

    // Add country for geo-specific content
    if (this.requiresGeoSpecificCache(url.pathname)) {
      return `${baseKey}:geo:${context.country}`;
    }

    return baseKey;
  }

  /**
   * Get cached response
   */
  async get(request, context) {
    try {
      const cacheKey = this.generateCacheKey(request, context);
      const cacheStrategy = this.determineCacheStrategy(request);

      // Try KV cache first
      const cachedData = await this.getFromKV(cacheKey, context);

      if (cachedData) {
        const { response, metadata } = cachedData;
        const age = Date.now() - metadata.timestamp;

        // Check if content is fresh
        if (age < cacheStrategy.ttl * 1000) {
          this.cacheStats.hits++;
          return this.reconstructResponse(response, metadata, 'fresh');
        }

        // Check if we can serve stale while revalidating
        if (age < (cacheStrategy.ttl + cacheStrategy.staleWhileRevalidate) * 1000) {
          this.cacheStats.hits++;

          // Trigger background revalidation
          context.ctx.waitUntil(this.revalidateInBackground(request, context, cacheKey));

          return this.reconstructResponse(response, metadata, 'stale');
        }
      }

      this.cacheStats.misses++;
      return null;

    } catch (error) {
      console.error('Cache get error:', error);
      this.cacheStats.misses++;
      return null;
    }
  }

  /**
   * Store response in cache
   */
  async put(request, response, context) {
    try {
      const cacheKey = this.generateCacheKey(request, context);
      const cacheStrategy = this.determineCacheStrategy(request);

      // Don't cache if strategy says no
      if (!cacheStrategy || cacheStrategy.ttl <= 0) {
        return;
      }

      // Clone response for storage
      const responseClone = response.clone();
      const body = await responseClone.arrayBuffer();

      const cacheData = {
        response: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: Array.from(new Uint8Array(body))
        },
        metadata: {
          timestamp: Date.now(),
          ttl: cacheStrategy.ttl,
          staleWhileRevalidate: cacheStrategy.staleWhileRevalidate,
          tags: cacheStrategy.tags,
          region: context.colo,
          version: 1
        }
      };

      // Store in KV with expiration
      await this.putToKV(cacheKey, cacheData, cacheStrategy.ttl, context);

      // Update cache statistics
      this.cacheStats.writes++;

      // Add to warming queue if it's a popular resource
      if (this.shouldWarm(request)) {
        this.addToWarmingQueue(cacheKey, request);
      }

    } catch (error) {
      console.error('Cache put error:', error);
    }
  }

  /**
   * Store data in KV store
   */
  async putToKV(key, data, ttl, context) {
    if (context.env.CACHE_KV) {
      const serializedData = JSON.stringify(data);
      const expirationTtl = Math.min(ttl, 2147483647); // KV max TTL

      await context.env.CACHE_KV.put(key, serializedData, {
        expirationTtl: expirationTtl
      });
    }
  }

  /**
   * Get data from KV store
   */
  async getFromKV(key, context) {
    if (context.env.CACHE_KV) {
      const data = await context.env.CACHE_KV.get(key);
      return data ? JSON.parse(data) : null;
    }
    return null;
  }

  /**
   * Reconstruct response from cached data
   */
  reconstructResponse(cachedResponse, metadata, freshness) {
    const { status, statusText, headers, body } = cachedResponse;

    // Reconstruct body
    const bodyArray = new Uint8Array(body);
    const responseBody = bodyArray.buffer;

    // Create response
    const response = new Response(responseBody, {
      status,
      statusText,
      headers: new Headers(headers)
    });

    // Add cache metadata headers
    response.headers.set('X-Cache-Status', freshness);
    response.headers.set('X-Cache-Age', Math.floor((Date.now() - metadata.timestamp) / 1000));
    response.headers.set('X-Cache-Region', metadata.region);

    return response;
  }

  /**
   * Determine cache strategy based on request
   */
  determineCacheStrategy(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Static assets - long cache
    if (pathname.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
      return this.cacheStrategies.static;
    }

    // API endpoints - short cache
    if (pathname.startsWith('/api/')) {
      // Different strategies for different API endpoints
      if (pathname.includes('/tax-rates') || pathname.includes('/forms')) {
        return { ...this.cacheStrategies.api, ttl: 3600 }; // 1 hour for reference data
      }
      if (pathname.includes('/calculate')) {
        return this.cacheStrategies.api; // 5 minutes for calculations
      }
      return { ...this.cacheStrategies.api, ttl: 60 }; // 1 minute for other APIs
    }

    // HTML pages
    if (pathname.endsWith('.html') || pathname === '/' || !pathname.includes('.')) {
      // Personalized pages
      if (this.requiresPersonalization(pathname)) {
        return this.cacheStrategies.personalized;
      }
      return this.cacheStrategies.html;
    }

    // Default to dynamic caching
    return this.cacheStrategies.dynamic;
  }

  /**
   * Revalidate content in background
   */
  async revalidateInBackground(request, context, cacheKey) {
    try {
      console.log('Background revalidation started for:', cacheKey);

      // Make fresh request to origin
      const originResponse = await this.fetchFromOrigin(request, context);

      if (originResponse && originResponse.ok) {
        // Update cache with fresh content
        await this.put(request, originResponse, context);
        console.log('Background revalidation completed for:', cacheKey);
      }

    } catch (error) {
      console.error('Background revalidation failed:', error);
    }
  }

  /**
   * Fetch from origin server
   */
  async fetchFromOrigin(request, context) {
    // This would integrate with CDNManager to fetch from origin
    // Placeholder implementation
    return fetch(request);
  }

  /**
   * Check if content requires personalization
   */
  requiresPersonalization(pathname) {
    const personalizedPaths = [
      '/dashboard',
      '/profile',
      '/calculator/personal',
      '/recommendations'
    ];

    return personalizedPaths.some(path => pathname.startsWith(path));
  }

  /**
   * Check if content requires device-specific caching
   */
  requiresDeviceSpecificCache(pathname) {
    const deviceSpecificPaths = [
      '/calculator',
      '/forms',
      '/mobile'
    ];

    return deviceSpecificPaths.some(path => pathname.startsWith(path));
  }

  /**
   * Check if content requires geo-specific caching
   */
  requiresGeoSpecificCache(pathname) {
    const geoSpecificPaths = [
      '/tax-rates',
      '/local-forms',
      '/compliance'
    ];

    return geoSpecificPaths.some(path => pathname.startsWith(path));
  }

  /**
   * Generate personalized cache key
   */
  generatePersonalizedKey(request, context) {
    const factors = [];

    // User segment (could be derived from headers or cookies)
    const userSegment = this.getUserSegment(request);
    if (userSegment) {
      factors.push(`segment:${userSegment}`);
    }

    // Country for tax-specific content
    factors.push(`country:${context.country}`);

    // Language preference
    const language = request.headers.get('Accept-Language')?.split(',')[0]?.split('-')[0] || 'en';
    factors.push(`lang:${language}`);

    return factors.join('|');
  }

  /**
   * Get device type from user agent
   */
  getDeviceType(userAgent) {
    if (!userAgent) return 'unknown';

    if (/Mobi|Android/i.test(userAgent)) return 'mobile';
    if (/Tablet|iPad/i.test(userAgent)) return 'tablet';
    return 'desktop';
  }

  /**
   * Get user segment from request
   */
  getUserSegment(request) {
    // This could analyze cookies, headers, or other signals
    // Placeholder implementation
    return null;
  }

  /**
   * Check if resource should be warmed
   */
  shouldWarm(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Warm popular pages and assets
    const warmablePaths = [
      '/',
      '/calculator',
      '/forms',
      '/help',
      '/about'
    ];

    return warmablePaths.includes(pathname) ||
           pathname.match(/\.(css|js)$/) ||
           pathname.startsWith('/api/tax-rates');
  }

  /**
   * Add to warming queue
   */
  addToWarmingQueue(cacheKey, request) {
    if (this.warmingQueue.size < 1000) { // Limit queue size
      this.warmingQueue.add({
        key: cacheKey,
        url: request.url,
        method: request.method,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Warm cache for popular content
   */
  async warmCache(context) {
    const popularUrls = [
      '/',
      '/calculator',
      '/api/tax-rates/2024',
      '/api/deductions/standard',
      '/assets/css/main.css',
      '/assets/js/calculator.js'
    ];

    const warmingPromises = popularUrls.map(async (url) => {
      try {
        const request = new Request(`https://globaltaxcalc.com${url}`);
        const response = await this.fetchFromOrigin(request, context);

        if (response && response.ok) {
          await this.put(request, response, context);
          console.log('Warmed cache for:', url);
        }
      } catch (error) {
        console.warn('Cache warming failed for:', url, error.message);
      }
    });

    await Promise.allSettled(warmingPromises);
  }

  /**
   * Purge cache by tags
   */
  async purgeByTags(tags, context) {
    try {
      if (context.env.CACHE_KV) {
        // KV doesn't support native tag-based purging, so we track keys by tags
        const taggedKeys = await this.getKeysByTags(tags, context);

        const purgePromises = taggedKeys.map(key =>
          context.env.CACHE_KV.delete(key)
        );

        await Promise.allSettled(purgePromises);

        console.log(`Purged ${taggedKeys.length} cache entries for tags:`, tags);
        return { purged: taggedKeys.length };
      }
    } catch (error) {
      console.error('Cache purge error:', error);
      throw error;
    }
  }

  /**
   * Get cache keys by tags
   */
  async getKeysByTags(tags, context) {
    // This is a simplified implementation
    // In production, you'd maintain a separate index of keys by tags
    const keys = [];

    if (context.env.CACHE_KV) {
      const list = await context.env.CACHE_KV.list();

      for (const key of list.keys) {
        const data = await context.env.CACHE_KV.get(key.name);
        if (data) {
          const parsed = JSON.parse(data);
          const keyTags = parsed.metadata?.tags || [];

          if (tags.some(tag => keyTags.includes(tag))) {
            keys.push(key.name);
          }
        }
      }
    }

    return keys;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const hitRate = this.cacheStats.hits + this.cacheStats.misses > 0
      ? (this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses)) * 100
      : 0;

    return {
      ...this.cacheStats,
      hitRate: Math.round(hitRate * 100) / 100,
      warmingQueueSize: this.warmingQueue.size
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats() {
    this.cacheStats = {
      hits: 0,
      misses: 0,
      writes: 0,
      evictions: 0
    };
  }

  /**
   * Regional cache invalidation
   */
  async invalidateRegional(pattern, regions, context) {
    try {
      // Invalidate cache in specific regions
      const invalidationPromises = regions.map(async (region) => {
        const regionalKeys = await this.getRegionalKeys(pattern, region, context);
        return this.deleteKeys(regionalKeys, context);
      });

      const results = await Promise.allSettled(invalidationPromises);

      console.log('Regional cache invalidation completed:', {
        pattern,
        regions,
        results: results.map(r => r.status)
      });

      return results;

    } catch (error) {
      console.error('Regional cache invalidation error:', error);
      throw error;
    }
  }

  /**
   * Get keys for specific region
   */
  async getRegionalKeys(pattern, region, context) {
    const keys = [];

    if (context.env.CACHE_KV) {
      const list = await context.env.CACHE_KV.list();

      for (const key of list.keys) {
        if (key.name.includes(pattern)) {
          const data = await context.env.CACHE_KV.get(key.name);
          if (data) {
            const parsed = JSON.parse(data);
            if (parsed.metadata?.region === region) {
              keys.push(key.name);
            }
          }
        }
      }
    }

    return keys;
  }

  /**
   * Delete multiple keys
   */
  async deleteKeys(keys, context) {
    if (context.env.CACHE_KV) {
      const deletePromises = keys.map(key =>
        context.env.CACHE_KV.delete(key)
      );

      await Promise.allSettled(deletePromises);
      return { deleted: keys.length };
    }

    return { deleted: 0 };
  }
}