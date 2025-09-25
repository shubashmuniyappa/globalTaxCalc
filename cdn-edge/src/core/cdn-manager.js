/**
 * CDN Manager - Core CDN functionality and intelligent routing
 */

export class CDNManager {
  constructor() {
    this.regions = {
      'NA': ['LAX', 'DFW', 'IAD', 'ORD', 'ATL'],
      'EU': ['LHR', 'FRA', 'AMS', 'CDG', 'MAD'],
      'APAC': ['NRT', 'SIN', 'HKG', 'SYD', 'ICN'],
      'SA': ['GRU', 'SCL', 'BOG'],
      'AF': ['CPT', 'JNB'],
      'ME': ['DXB', 'DOH']
    };

    this.originServers = {
      primary: 'https://origin.globaltaxcalc.com',
      fallback: 'https://origin-backup.globaltaxcalc.com',
      api: 'https://api.globaltaxcalc.com'
    };

    this.cacheConfigs = this.initializeCacheConfigs();
  }

  /**
   * Initialize cache configurations for different content types
   */
  initializeCacheConfigs() {
    return {
      static: {
        ttl: 31536000, // 1 year
        browserTtl: 31536000,
        staleWhileRevalidate: 86400,
        headers: {
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      },
      html: {
        ttl: 3600, // 1 hour
        browserTtl: 3600,
        staleWhileRevalidate: 1800,
        headers: {
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=1800'
        }
      },
      api: {
        ttl: 300, // 5 minutes
        browserTtl: 0,
        staleWhileRevalidate: 60,
        headers: {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=60'
        }
      },
      dynamic: {
        ttl: 60, // 1 minute
        browserTtl: 0,
        staleWhileRevalidate: 30,
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=30'
        }
      }
    };
  }

  /**
   * Serve home page with intelligent routing
   */
  async serveHomePage(request, context) {
    try {
      const url = new URL(request.url);

      // Check for personalization parameters
      const personalizationData = await this.extractPersonalizationData(request, context);

      // Determine optimal origin server
      const originUrl = await this.selectOptimalOrigin(context);

      // Build request to origin
      const originRequest = new Request(`${originUrl}${url.pathname}${url.search}`, {
        method: request.method,
        headers: this.buildOriginHeaders(request, context),
        body: request.body
      });

      // Fetch from origin with failover
      const response = await this.fetchWithFailover(originRequest, context);

      // Add CDN headers
      this.addCDNHeaders(response, 'html', context);

      // Inject personalization if needed
      if (personalizationData.shouldPersonalize) {
        return await this.injectPersonalization(response, personalizationData);
      }

      return response;

    } catch (error) {
      console.error('Error serving home page:', error);
      return this.createErrorResponse(500, 'Internal server error');
    }
  }

  /**
   * Proxy API requests with intelligent caching
   */
  async proxyAPIRequest(request, context) {
    try {
      const url = new URL(request.url);
      const apiPath = url.pathname.replace('/api', '');

      // Determine cache strategy based on API endpoint
      const cacheStrategy = this.determineAPICacheStrategy(apiPath, request);

      // Check cache first if cacheable
      if (cacheStrategy.cacheable) {
        const cachedResponse = await this.getCachedAPIResponse(request, context);
        if (cachedResponse) {
          return cachedResponse;
        }
      }

      // Build API request
      const apiUrl = `${this.originServers.api}${apiPath}${url.search}`;
      const apiRequest = new Request(apiUrl, {
        method: request.method,
        headers: this.buildAPIHeaders(request, context),
        body: request.body
      });

      // Fetch from API with circuit breaker
      const response = await this.fetchWithCircuitBreaker(apiRequest, context);

      // Add appropriate cache headers
      if (cacheStrategy.cacheable) {
        this.addCDNHeaders(response, 'api', context);
      }

      // Add API-specific headers
      response.headers.set('X-API-Region', context.colo);
      response.headers.set('X-API-Cache-Strategy', cacheStrategy.strategy);

      return response;

    } catch (error) {
      console.error('Error proxying API request:', error);
      return this.createErrorResponse(502, 'Bad gateway');
    }
  }

  /**
   * Serve static assets with aggressive caching
   */
  async serveStaticAsset(request, context) {
    try {
      const url = new URL(request.url);
      const assetPath = url.pathname;

      // Extract file extension
      const extension = assetPath.split('.').pop()?.toLowerCase();
      const assetType = this.getAssetType(extension);

      // Try R2 storage first for static assets
      const r2Response = await this.tryR2Asset(assetPath, context);
      if (r2Response) {
        this.addCDNHeaders(r2Response, 'static', context);
        r2Response.headers.set('X-Asset-Source', 'R2');
        return r2Response;
      }

      // Fallback to origin server
      const originUrl = `${this.originServers.primary}${assetPath}`;
      const originRequest = new Request(originUrl, {
        method: 'GET',
        headers: this.buildOriginHeaders(request, context)
      });

      const response = await this.fetchWithFailover(originRequest, context);

      // Optimize asset if needed
      const optimizedResponse = await this.optimizeAsset(response, assetType, context);

      // Add aggressive caching headers
      this.addCDNHeaders(optimizedResponse, 'static', context);
      optimizedResponse.headers.set('X-Asset-Source', 'Origin');

      return optimizedResponse;

    } catch (error) {
      console.error('Error serving static asset:', error);
      return this.createErrorResponse(404, 'Asset not found');
    }
  }

  /**
   * Handle fallback routing
   */
  async handleFallback(request, context) {
    try {
      const url = new URL(request.url);

      // Check if it's a SPA route
      if (this.isSPARoute(url.pathname)) {
        return await this.serveSPAFallback(request, context);
      }

      // Try to serve from origin
      const originUrl = `${this.originServers.primary}${url.pathname}${url.search}`;
      const originRequest = new Request(originUrl, {
        method: request.method,
        headers: this.buildOriginHeaders(request, context),
        body: request.body
      });

      const response = await this.fetchWithFailover(originRequest, context);

      if (response.ok) {
        this.addCDNHeaders(response, 'dynamic', context);
        return response;
      }

      // Return 404 if origin also returns error
      return this.createErrorResponse(404, 'Page not found');

    } catch (error) {
      console.error('Error in fallback handler:', error);
      return this.createErrorResponse(500, 'Internal server error');
    }
  }

  /**
   * Select optimal origin server based on performance and health
   */
  async selectOptimalOrigin(context) {
    // Check primary origin health
    const primaryHealth = await this.checkOriginHealth(this.originServers.primary);

    if (primaryHealth.healthy) {
      return this.originServers.primary;
    }

    console.warn('Primary origin unhealthy, falling back to backup');
    return this.originServers.fallback;
  }

  /**
   * Check origin server health
   */
  async checkOriginHealth(originUrl) {
    try {
      const healthCheck = await fetch(`${originUrl}/health`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      return {
        healthy: healthCheck.ok,
        responseTime: Date.now() - Date.now(), // Simplified
        status: healthCheck.status
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Fetch with automatic failover
   */
  async fetchWithFailover(request, context, retries = 2) {
    let lastError;

    for (let i = 0; i <= retries; i++) {
      try {
        const response = await fetch(request, {
          signal: AbortSignal.timeout(30000) // 30 second timeout
        });

        if (response.ok || response.status < 500) {
          return response;
        }

        throw new Error(`Origin returned ${response.status}`);

      } catch (error) {
        lastError = error;
        console.warn(`Fetch attempt ${i + 1} failed:`, error.message);

        if (i < retries) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
      }
    }

    throw lastError;
  }

  /**
   * Fetch with circuit breaker pattern
   */
  async fetchWithCircuitBreaker(request, context) {
    // Simplified circuit breaker - in production, use more sophisticated implementation
    try {
      return await fetch(request, {
        signal: AbortSignal.timeout(15000) // 15 second timeout for APIs
      });
    } catch (error) {
      // Return cached version if available, otherwise throw
      const cachedResponse = await this.getCachedAPIResponse(request, context);
      if (cachedResponse) {
        cachedResponse.headers.set('X-Served-From-Cache', 'circuit-breaker');
        return cachedResponse;
      }
      throw error;
    }
  }

  /**
   * Build headers for origin requests
   */
  buildOriginHeaders(request, context) {
    const headers = new Headers();

    // Copy important headers
    const importantHeaders = [
      'accept',
      'accept-language',
      'accept-encoding',
      'user-agent',
      'authorization',
      'content-type',
      'content-length'
    ];

    importantHeaders.forEach(header => {
      const value = request.headers.get(header);
      if (value) {
        headers.set(header, value);
      }
    });

    // Add edge-specific headers
    headers.set('X-Forwarded-For', context.clientIP);
    headers.set('X-Edge-Region', context.colo);
    headers.set('X-Country-Code', context.country);
    headers.set('X-Request-ID', context.requestId);

    return headers;
  }

  /**
   * Build headers for API requests
   */
  buildAPIHeaders(request, context) {
    const headers = this.buildOriginHeaders(request, context);

    // Add API-specific headers
    headers.set('X-API-Client', 'edge-worker');
    headers.set('X-API-Version', '1.0');

    return headers;
  }

  /**
   * Add CDN-specific headers
   */
  addCDNHeaders(response, cacheType, context) {
    const config = this.cacheConfigs[cacheType];

    // Add cache headers
    Object.entries(config.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    // Add CDN info headers
    response.headers.set('X-CDN-Cache', 'MISS');
    response.headers.set('X-CDN-Region', context.colo);
    response.headers.set('X-CDN-POP', context.colo);
  }

  /**
   * Determine API cache strategy
   */
  determineAPICacheStrategy(apiPath, request) {
    // GET requests for reference data can be cached
    if (request.method === 'GET') {
      if (apiPath.includes('/tax-rates') ||
          apiPath.includes('/deductions') ||
          apiPath.includes('/forms')) {
        return { cacheable: true, strategy: 'long-term' };
      }

      if (apiPath.includes('/calculate') &&
          new URL(request.url).searchParams.size === 0) {
        return { cacheable: true, strategy: 'short-term' };
      }
    }

    return { cacheable: false, strategy: 'no-cache' };
  }

  /**
   * Get cached API response
   */
  async getCachedAPIResponse(request, context) {
    // This would integrate with the EdgeCache class
    // Placeholder for cache lookup
    return null;
  }

  /**
   * Try to get asset from R2 storage
   */
  async tryR2Asset(assetPath, context) {
    try {
      if (context.env.ASSETS_BUCKET) {
        const object = await context.env.ASSETS_BUCKET.get(assetPath);
        if (object) {
          return new Response(object.body, {
            headers: {
              'Content-Type': this.getContentType(assetPath),
              'Content-Length': object.size,
              'ETag': object.etag,
              'Last-Modified': object.uploaded.toUTCString()
            }
          });
        }
      }
    } catch (error) {
      console.warn('R2 asset fetch failed:', error.message);
    }

    return null;
  }

  /**
   * Optimize asset based on type
   */
  async optimizeAsset(response, assetType, context) {
    // For now, return as-is. Real optimization would happen here
    // (minification, compression, image optimization, etc.)
    return response;
  }

  /**
   * Check if route is SPA route
   */
  isSPARoute(pathname) {
    const spaRoutes = [
      '/calculator',
      '/dashboard',
      '/profile',
      '/settings',
      '/help'
    ];

    return spaRoutes.some(route => pathname.startsWith(route));
  }

  /**
   * Serve SPA fallback
   */
  async serveSPAFallback(request, context) {
    // Serve index.html for SPA routes
    const indexRequest = new Request(`${this.originServers.primary}/index.html`, {
      method: 'GET',
      headers: this.buildOriginHeaders(request, context)
    });

    const response = await this.fetchWithFailover(indexRequest, context);
    this.addCDNHeaders(response, 'html', context);

    return response;
  }

  /**
   * Extract personalization data from request
   */
  async extractPersonalizationData(request, context) {
    return {
      shouldPersonalize: false,
      country: context.country,
      language: request.headers.get('Accept-Language')?.split(',')[0] || 'en',
      currency: this.getCurrencyForCountry(context.country)
    };
  }

  /**
   * Inject personalization into response
   */
  async injectPersonalization(response, data) {
    // Placeholder for personalization injection
    return response;
  }

  /**
   * Get asset type from extension
   */
  getAssetType(extension) {
    const types = {
      'css': 'stylesheet',
      'js': 'script',
      'png': 'image',
      'jpg': 'image',
      'jpeg': 'image',
      'gif': 'image',
      'svg': 'image',
      'ico': 'image',
      'woff': 'font',
      'woff2': 'font',
      'ttf': 'font',
      'eot': 'font'
    };

    return types[extension] || 'unknown';
  }

  /**
   * Get content type for file
   */
  getContentType(filePath) {
    const extension = filePath.split('.').pop()?.toLowerCase();
    const types = {
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon',
      'woff': 'font/woff',
      'woff2': 'font/woff2',
      'ttf': 'font/ttf',
      'eot': 'application/vnd.ms-fontobject'
    };

    return types[extension] || 'application/octet-stream';
  }

  /**
   * Get currency for country
   */
  getCurrencyForCountry(countryCode) {
    const currencies = {
      'US': 'USD',
      'CA': 'CAD',
      'GB': 'GBP',
      'DE': 'EUR',
      'FR': 'EUR',
      'JP': 'JPY',
      'AU': 'AUD',
      'IN': 'INR',
      'BR': 'BRL'
    };

    return currencies[countryCode] || 'USD';
  }

  /**
   * Create error response
   */
  createErrorResponse(status, message) {
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}