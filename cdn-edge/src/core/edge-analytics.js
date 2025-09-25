/**
 * Edge Analytics - Real-time traffic analytics and performance monitoring
 */

export class EdgeAnalytics {
  constructor() {
    this.analyticsConfig = {
      enabledEvents: [
        'pageview',
        'api_request',
        'error',
        'performance',
        'security_block',
        'cache_hit',
        'cache_miss'
      ],
      batchSize: 100,
      flushInterval: 60000, // 1 minute
      retentionDays: 30
    };

    this.eventBuffer = [];
    this.performanceMetrics = new Map();
    this.realTimeStats = {
      requests: 0,
      errors: 0,
      cacheHits: 0,
      cacheMisses: 0,
      blockedRequests: 0,
      uniqueVisitors: new Set()
    };
  }

  /**
   * Track incoming request with comprehensive analytics
   */
  async trackRequest(request, response, context, fromCache = false) {
    try {
      const timestamp = Date.now();
      const url = new URL(request.url);

      // Extract request information
      const requestData = {
        timestamp,
        requestId: context.requestId,
        method: request.method,
        url: url.href,
        pathname: url.pathname,
        search: url.search,
        userAgent: request.headers.get('User-Agent') || '',
        referer: request.headers.get('Referer') || '',
        clientIP: context.clientIP,
        country: context.country,
        region: context.colo,
        responseStatus: response?.status || 0,
        responseTime: Date.now() - context.startTime,
        fromCache,
        responseSize: this.getResponseSize(response)
      };

      // Track different event types
      await this.trackPageview(requestData, context);
      await this.trackPerformance(requestData, context);

      if (url.pathname.startsWith('/api/')) {
        await this.trackAPIRequest(requestData, context);
      }

      if (response?.status >= 400) {
        await this.trackError(requestData, context);
      }

      if (fromCache) {
        await this.trackCacheHit(requestData, context);
      } else {
        await this.trackCacheMiss(requestData, context);
      }

      // Update real-time statistics
      this.updateRealTimeStats(requestData);

      // Store event for batching
      this.addEvent({
        type: 'request',
        data: requestData
      });

    } catch (error) {
      console.error('Analytics tracking error:', error);
    }
  }

  /**
   * Track pageview events
   */
  async trackPageview(requestData, context) {
    if (requestData.method === 'GET' &&
        !requestData.pathname.startsWith('/api/') &&
        !requestData.pathname.includes('.')) {

      const pageviewData = {
        ...requestData,
        pageTitle: await this.extractPageTitle(requestData.pathname),
        sessionId: this.generateSessionId(requestData.clientIP, requestData.userAgent),
        deviceInfo: this.parseDeviceInfo(requestData.userAgent),
        isNewVisitor: !this.realTimeStats.uniqueVisitors.has(requestData.clientIP)
      };

      this.addEvent({
        type: 'pageview',
        data: pageviewData
      });

      // Track unique visitors
      this.realTimeStats.uniqueVisitors.add(requestData.clientIP);
    }
  }

  /**
   * Track API request analytics
   */
  async trackAPIRequest(requestData, context) {
    const apiEndpoint = this.extractAPIEndpoint(requestData.pathname);

    const apiData = {
      ...requestData,
      endpoint: apiEndpoint,
      apiVersion: this.extractAPIVersion(requestData.pathname),
      payloadSize: requestData.method !== 'GET' ? await this.getRequestSize(context.request) : 0,
      isSuccessful: requestData.responseStatus < 400,
      errorCode: requestData.responseStatus >= 400 ? requestData.responseStatus : null
    };

    this.addEvent({
      type: 'api_request',
      data: apiData
    });

    // Track API performance metrics
    this.updateAPIMetrics(apiEndpoint, apiData);
  }

  /**
   * Track performance metrics
   */
  async trackPerformance(requestData, context) {
    const performanceData = {
      ...requestData,
      ttfb: requestData.responseTime, // Time to First Byte
      region: requestData.region,
      cdnHit: requestData.fromCache,
      compressionRatio: await this.calculateCompressionRatio(context.response),
      connectionType: this.getConnectionType(context.request),
      protocolVersion: this.getProtocolVersion(context.request)
    };

    this.addEvent({
      type: 'performance',
      data: performanceData
    });

    // Store performance metrics for aggregation
    this.storePerformanceMetric(requestData.pathname, performanceData);
  }

  /**
   * Track error events
   */
  async trackError(requestData, context) {
    const errorData = {
      ...requestData,
      errorType: this.categorizeError(requestData.responseStatus),
      errorMessage: await this.extractErrorMessage(context.response),
      stackTrace: null, // Would be populated for 500 errors with debug info
      userImpact: this.assessUserImpact(requestData.responseStatus),
      retryable: this.isRetryableError(requestData.responseStatus)
    };

    this.addEvent({
      type: 'error',
      data: errorData
    });

    this.realTimeStats.errors++;
  }

  /**
   * Track cache hit events
   */
  async trackCacheHit(requestData, context) {
    const cacheData = {
      ...requestData,
      cacheRegion: requestData.region,
      cacheAge: this.getCacheAge(context.response),
      cacheKey: this.generateCacheKey(requestData.pathname, requestData.search),
      savedResponseTime: this.estimateSavedTime(requestData.pathname)
    };

    this.addEvent({
      type: 'cache_hit',
      data: cacheData
    });

    this.realTimeStats.cacheHits++;
  }

  /**
   * Track cache miss events
   */
  async trackCacheMiss(requestData, context) {
    const cacheData = {
      ...requestData,
      missReason: this.determineMissReason(requestData),
      shouldCache: this.shouldHaveCached(requestData),
      cacheStrategy: this.determineCacheStrategy(requestData.pathname)
    };

    this.addEvent({
      type: 'cache_miss',
      data: cacheData
    });

    this.realTimeStats.cacheMisses++;
  }

  /**
   * Track security events
   */
  async trackSecurityBlock(request, context, blockReason) {
    const securityData = {
      timestamp: Date.now(),
      requestId: context.requestId,
      clientIP: context.clientIP,
      country: context.country,
      userAgent: request.headers.get('User-Agent') || '',
      url: request.url,
      method: request.method,
      blockReason,
      threatLevel: this.assessThreatLevel(blockReason),
      mitigationAction: 'blocked'
    };

    this.addEvent({
      type: 'security_block',
      data: securityData
    });

    this.realTimeStats.blockedRequests++;
  }

  /**
   * Generate session ID from client IP and user agent
   */
  generateSessionId(clientIP, userAgent) {
    const data = `${clientIP}-${userAgent}-${Math.floor(Date.now() / (30 * 60 * 1000))}`;
    return this.simpleHash(data);
  }

  /**
   * Parse device information from user agent
   */
  parseDeviceInfo(userAgent) {
    const deviceInfo = {
      type: 'unknown',
      os: 'unknown',
      browser: 'unknown',
      isMobile: false,
      isBot: false
    };

    if (!userAgent) return deviceInfo;

    // Device type detection
    if (/Mobi|Android/i.test(userAgent)) {
      deviceInfo.type = 'mobile';
      deviceInfo.isMobile = true;
    } else if (/Tablet|iPad/i.test(userAgent)) {
      deviceInfo.type = 'tablet';
    } else {
      deviceInfo.type = 'desktop';
    }

    // OS detection
    if (/Windows/i.test(userAgent)) deviceInfo.os = 'Windows';
    else if (/Mac OS/i.test(userAgent)) deviceInfo.os = 'macOS';
    else if (/Linux/i.test(userAgent)) deviceInfo.os = 'Linux';
    else if (/Android/i.test(userAgent)) deviceInfo.os = 'Android';
    else if (/iOS/i.test(userAgent)) deviceInfo.os = 'iOS';

    // Browser detection
    if (/Chrome/i.test(userAgent)) deviceInfo.browser = 'Chrome';
    else if (/Safari/i.test(userAgent)) deviceInfo.browser = 'Safari';
    else if (/Firefox/i.test(userAgent)) deviceInfo.browser = 'Firefox';
    else if (/Edge/i.test(userAgent)) deviceInfo.browser = 'Edge';

    // Bot detection
    if (/bot|crawler|spider/i.test(userAgent)) {
      deviceInfo.isBot = true;
    }

    return deviceInfo;
  }

  /**
   * Extract API endpoint from pathname
   */
  extractAPIEndpoint(pathname) {
    const parts = pathname.split('/');
    if (parts.length >= 3 && parts[1] === 'api') {
      return `/${parts[2]}`;
    }
    return pathname;
  }

  /**
   * Extract API version from pathname
   */
  extractAPIVersion(pathname) {
    const versionMatch = pathname.match(/\/v(\d+)\//);
    return versionMatch ? versionMatch[1] : '1';
  }

  /**
   * Get response size
   */
  getResponseSize(response) {
    if (!response) return 0;

    const contentLength = response.headers.get('Content-Length');
    if (contentLength) {
      return parseInt(contentLength);
    }

    // Estimate based on content type
    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) return 1024; // 1KB estimate
    if (contentType.includes('text/html')) return 10240; // 10KB estimate
    if (contentType.includes('text/css')) return 5120; // 5KB estimate
    if (contentType.includes('application/javascript')) return 15360; // 15KB estimate

    return 0;
  }

  /**
   * Get request size
   */
  async getRequestSize(request) {
    try {
      const contentLength = request.headers.get('Content-Length');
      return contentLength ? parseInt(contentLength) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Calculate compression ratio
   */
  async calculateCompressionRatio(response) {
    if (!response) return 1;

    const contentEncoding = response.headers.get('Content-Encoding');
    if (contentEncoding && (contentEncoding.includes('gzip') || contentEncoding.includes('br'))) {
      return 0.3; // Estimated 70% compression
    }
    return 1;
  }

  /**
   * Update real-time statistics
   */
  updateRealTimeStats(requestData) {
    this.realTimeStats.requests++;

    // Clean up unique visitors set periodically (keep last 24 hours)
    if (this.realTimeStats.requests % 1000 === 0) {
      // In a real implementation, you'd implement TTL for the Set
      if (this.realTimeStats.uniqueVisitors.size > 10000) {
        this.realTimeStats.uniqueVisitors.clear();
      }
    }
  }

  /**
   * Update API metrics
   */
  updateAPIMetrics(endpoint, apiData) {
    if (!this.performanceMetrics.has(endpoint)) {
      this.performanceMetrics.set(endpoint, {
        totalRequests: 0,
        totalResponseTime: 0,
        successCount: 0,
        errorCount: 0,
        averageResponseTime: 0
      });
    }

    const metrics = this.performanceMetrics.get(endpoint);
    metrics.totalRequests++;
    metrics.totalResponseTime += apiData.responseTime;

    if (apiData.isSuccessful) {
      metrics.successCount++;
    } else {
      metrics.errorCount++;
    }

    metrics.averageResponseTime = metrics.totalResponseTime / metrics.totalRequests;
  }

  /**
   * Store performance metric for aggregation
   */
  storePerformanceMetric(pathname, performanceData) {
    // Store metrics in a time-series structure for analysis
    const key = `${pathname}:${this.getTimeSlot()}`;

    if (!this.performanceMetrics.has(key)) {
      this.performanceMetrics.set(key, {
        count: 0,
        totalResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        p95ResponseTime: 0
      });
    }

    const metrics = this.performanceMetrics.get(key);
    metrics.count++;
    metrics.totalResponseTime += performanceData.responseTime;
    metrics.minResponseTime = Math.min(metrics.minResponseTime, performanceData.responseTime);
    metrics.maxResponseTime = Math.max(metrics.maxResponseTime, performanceData.responseTime);
  }

  /**
   * Get current time slot (5-minute intervals)
   */
  getTimeSlot() {
    return Math.floor(Date.now() / (5 * 60 * 1000)) * 5 * 60 * 1000;
  }

  /**
   * Add event to buffer
   */
  addEvent(event) {
    this.eventBuffer.push(event);

    // Flush buffer if it reaches batch size
    if (this.eventBuffer.length >= this.analyticsConfig.batchSize) {
      this.flushEvents();
    }
  }

  /**
   * Flush events to analytics storage
   */
  async flushEvents() {
    if (this.eventBuffer.length === 0) return;

    try {
      const events = [...this.eventBuffer];
      this.eventBuffer = [];

      // Send to Analytics Engine if available
      if (globalThis.EDGE_ANALYTICS) {
        await this.sendToAnalyticsEngine(events);
      }

      // Store in KV for historical analysis
      await this.storeInKV(events);

      console.log(`Flushed ${events.length} analytics events`);

    } catch (error) {
      console.error('Event flush error:', error);
      // Re-add events to buffer for retry
      this.eventBuffer.unshift(...events);
    }
  }

  /**
   * Send events to Cloudflare Analytics Engine
   */
  async sendToAnalyticsEngine(events) {
    try {
      const dataPoints = events.map(event => ({
        blobs: [
          event.type,
          event.data.pathname || '',
          event.data.country || '',
          event.data.userAgent || ''
        ],
        doubles: [
          event.data.responseTime || 0,
          event.data.responseStatus || 0,
          event.data.responseSize || 0
        ],
        indexes: [event.data.timestamp || Date.now()]
      }));

      await globalThis.EDGE_ANALYTICS.writeDataPoints(dataPoints);

    } catch (error) {
      console.error('Analytics Engine write error:', error);
    }
  }

  /**
   * Store events in KV for historical analysis
   */
  async storeInKV(events) {
    try {
      if (globalThis.ANALYTICS_KV) {
        const timestamp = Date.now();
        const key = `analytics:${timestamp}:${crypto.randomUUID()}`;

        await globalThis.ANALYTICS_KV.put(key, JSON.stringify(events), {
          expirationTtl: this.analyticsConfig.retentionDays * 24 * 60 * 60
        });
      }
    } catch (error) {
      console.error('KV storage error:', error);
    }
  }

  /**
   * Get real-time analytics summary
   */
  getRealTimeStats() {
    const cacheHitRate = this.realTimeStats.cacheHits + this.realTimeStats.cacheMisses > 0
      ? (this.realTimeStats.cacheHits / (this.realTimeStats.cacheHits + this.realTimeStats.cacheMisses)) * 100
      : 0;

    const errorRate = this.realTimeStats.requests > 0
      ? (this.realTimeStats.errors / this.realTimeStats.requests) * 100
      : 0;

    return {
      ...this.realTimeStats,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      uniqueVisitorCount: this.realTimeStats.uniqueVisitors.size,
      timestamp: Date.now()
    };
  }

  /**
   * Get performance metrics for specific endpoint
   */
  getEndpointMetrics(endpoint) {
    return this.performanceMetrics.get(endpoint) || null;
  }

  /**
   * Get top performing endpoints
   */
  getTopEndpoints(limit = 10) {
    const endpoints = Array.from(this.performanceMetrics.entries())
      .filter(([key]) => !key.includes(':')) // Filter out time-slotted metrics
      .sort(([,a], [,b]) => b.totalRequests - a.totalRequests)
      .slice(0, limit);

    return endpoints.map(([endpoint, metrics]) => ({
      endpoint,
      ...metrics,
      successRate: metrics.totalRequests > 0 ? (metrics.successCount / metrics.totalRequests) * 100 : 0
    }));
  }

  /**
   * Helper functions
   */
  extractPageTitle(pathname) {
    const titles = {
      '/': 'Home',
      '/calculator': 'Tax Calculator',
      '/dashboard': 'Dashboard',
      '/profile': 'Profile',
      '/help': 'Help',
      '/about': 'About'
    };
    return titles[pathname] || 'Page';
  }

  categorizeError(status) {
    if (status >= 400 && status < 500) return 'client_error';
    if (status >= 500) return 'server_error';
    return 'unknown_error';
  }

  assessUserImpact(status) {
    if (status === 404) return 'low';
    if (status >= 400 && status < 500) return 'medium';
    if (status >= 500) return 'high';
    return 'none';
  }

  isRetryableError(status) {
    return [408, 429, 502, 503, 504].includes(status);
  }

  getCacheAge(response) {
    if (!response) return 0;
    const cacheAge = response.headers.get('X-Cache-Age');
    return cacheAge ? parseInt(cacheAge) : 0;
  }

  generateCacheKey(pathname, search) {
    return `${pathname}${search}`;
  }

  estimateSavedTime(pathname) {
    // Estimate time saved by cache hit based on content type
    if (pathname.startsWith('/api/')) return 200; // 200ms for API
    if (pathname.includes('.')) return 50; // 50ms for static assets
    return 100; // 100ms for pages
  }

  determineMissReason(requestData) {
    if (requestData.method !== 'GET') return 'non_cacheable_method';
    if (requestData.search.includes('_t=')) return 'cache_busting_param';
    if (requestData.pathname.startsWith('/api/') && requestData.responseStatus !== 200) return 'error_response';
    return 'not_cached';
  }

  shouldHaveCached(requestData) {
    return requestData.method === 'GET' &&
           requestData.responseStatus === 200 &&
           !requestData.search.includes('_t=');
  }

  determineCacheStrategy(pathname) {
    if (pathname.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2)$/)) return 'static';
    if (pathname.startsWith('/api/')) return 'api';
    return 'dynamic';
  }

  assessThreatLevel(blockReason) {
    const highThreatReasons = ['ddos-resource-exhaustion', 'waf-body-pattern'];
    const mediumThreatReasons = ['waf-url-pattern', 'bot-behavior'];

    if (highThreatReasons.includes(blockReason)) return 'high';
    if (mediumThreatReasons.includes(blockReason)) return 'medium';
    return 'low';
  }

  getConnectionType(request) {
    // Simplified connection type detection
    return 'unknown';
  }

  getProtocolVersion(request) {
    return 'HTTP/2'; // Simplified - Cloudflare typically uses HTTP/2
  }

  async extractErrorMessage(response) {
    if (!response) return null;

    try {
      const contentType = response.headers.get('Content-Type') || '';
      if (contentType.includes('application/json')) {
        const errorData = await response.clone().json();
        return errorData.message || errorData.error || null;
      }
    } catch {
      // Ignore JSON parsing errors
    }

    return null;
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Start periodic flushing
   */
  startPeriodicFlush() {
    setInterval(() => {
      this.flushEvents();
    }, this.analyticsConfig.flushInterval);
  }

  /**
   * Reset statistics (for testing or periodic cleanup)
   */
  resetStats() {
    this.realTimeStats = {
      requests: 0,
      errors: 0,
      cacheHits: 0,
      cacheMisses: 0,
      blockedRequests: 0,
      uniqueVisitors: new Set()
    };
    this.performanceMetrics.clear();
    this.eventBuffer = [];
  }
}