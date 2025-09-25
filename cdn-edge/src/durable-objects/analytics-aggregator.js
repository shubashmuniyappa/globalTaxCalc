/**
 * Analytics Aggregator Durable Object
 * Real-time analytics aggregation and processing
 */

export class AnalyticsAggregator {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.buffer = [];
    this.maxBufferSize = 1000;
    this.flushInterval = 60000; // 1 minute
    this.lastFlush = Date.now();
  }

  async fetch(request) {
    try {
      const url = new URL(request.url);

      if (url.pathname === '/track' && request.method === 'POST') {
        return await this.trackEvent(request);
      }

      if (url.pathname === '/stats' && request.method === 'GET') {
        return await this.getStats(request);
      }

      if (url.pathname === '/flush' && request.method === 'POST') {
        return await this.flushData();
      }

      if (url.pathname === '/realtime' && request.method === 'GET') {
        return await this.getRealTimeStats();
      }

      return new Response('Not Found', { status: 404 });

    } catch (error) {
      console.error('Analytics aggregator error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  async trackEvent(request) {
    try {
      const events = await request.json();
      const timestamp = Date.now();

      // Process each event
      for (const event of events) {
        await this.processEvent(event, timestamp);
      }

      // Add to buffer for batch processing
      this.buffer.push(...events);

      // Flush if buffer is full or enough time has passed
      if (this.buffer.length >= this.maxBufferSize ||
          Date.now() - this.lastFlush >= this.flushInterval) {
        await this.flushData();
      }

      return new Response(JSON.stringify({
        success: true,
        eventsProcessed: events.length,
        bufferSize: this.buffer.length
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Event tracking error:', error);
      return new Response('Error processing events', { status: 500 });
    }
  }

  async processEvent(event, timestamp) {
    const { type, data } = event;

    // Update real-time counters
    await this.updateRealTimeCounters(type, data, timestamp);

    // Update time-series data
    await this.updateTimeSeries(type, data, timestamp);

    // Update geographic statistics
    if (data.country) {
      await this.updateGeographicStats(data.country, timestamp);
    }

    // Update performance metrics
    if (data.responseTime) {
      await this.updatePerformanceMetrics(data, timestamp);
    }

    // Update error tracking
    if (type === 'error' || data.responseStatus >= 400) {
      await this.updateErrorStats(data, timestamp);
    }

    // Update security events
    if (type === 'security_block') {
      await this.updateSecurityStats(data, timestamp);
    }
  }

  async updateRealTimeCounters(type, data, timestamp) {
    const key = 'realtime_counters';
    let counters = await this.state.storage.get(key) || {
      requests: 0,
      pageviews: 0,
      apiCalls: 0,
      errors: 0,
      cacheHits: 0,
      cacheMisses: 0,
      securityBlocks: 0,
      uniqueVisitors: new Set(),
      lastUpdate: timestamp
    };

    // Increment appropriate counters
    switch (type) {
      case 'request':
        counters.requests++;
        break;
      case 'pageview':
        counters.pageviews++;
        if (data.clientIP) {
          counters.uniqueVisitors.add(data.clientIP);
        }
        break;
      case 'api_request':
        counters.apiCalls++;
        break;
      case 'error':
        counters.errors++;
        break;
      case 'cache_hit':
        counters.cacheHits++;
        break;
      case 'cache_miss':
        counters.cacheMisses++;
        break;
      case 'security_block':
        counters.securityBlocks++;
        break;
    }

    counters.lastUpdate = timestamp;

    // Reset counters if they're more than 1 hour old
    if (timestamp - counters.lastUpdate > 3600000) {
      counters = {
        requests: 0,
        pageviews: 0,
        apiCalls: 0,
        errors: 0,
        cacheHits: 0,
        cacheMisses: 0,
        securityBlocks: 0,
        uniqueVisitors: new Set(),
        lastUpdate: timestamp
      };
    }

    await this.state.storage.put(key, counters);
  }

  async updateTimeSeries(type, data, timestamp) {
    const timeSlot = Math.floor(timestamp / (5 * 60 * 1000)) * 5 * 60 * 1000; // 5-minute slots
    const key = `timeseries_${type}_${timeSlot}`;

    let timeSeriesData = await this.state.storage.get(key) || {
      count: 0,
      totalResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      errors: 0,
      timestamp: timeSlot
    };

    timeSeriesData.count++;

    if (data.responseTime) {
      timeSeriesData.totalResponseTime += data.responseTime;
      timeSeriesData.minResponseTime = Math.min(timeSeriesData.minResponseTime, data.responseTime);
      timeSeriesData.maxResponseTime = Math.max(timeSeriesData.maxResponseTime, data.responseTime);
    }

    if (data.responseStatus >= 400) {
      timeSeriesData.errors++;
    }

    await this.state.storage.put(key, timeSeriesData);

    // Schedule cleanup of old time series data
    this.scheduleCleanup(timeSlot);
  }

  async updateGeographicStats(country, timestamp) {
    const key = `geo_stats_${country}`;
    let geoStats = await this.state.storage.get(key) || {
      requests: 0,
      lastSeen: timestamp,
      firstSeen: timestamp
    };

    geoStats.requests++;
    geoStats.lastSeen = timestamp;

    await this.state.storage.put(key, geoStats);
  }

  async updatePerformanceMetrics(data, timestamp) {
    const endpoint = data.pathname || '/';
    const key = `performance_${endpoint}`;

    let perfMetrics = await this.state.storage.get(key) || {
      count: 0,
      totalResponseTime: 0,
      responseTimeP50: 0,
      responseTimeP95: 0,
      responseTimeP99: 0,
      responseTimes: [], // Keep last 1000 for percentile calculation
      lastUpdate: timestamp
    };

    perfMetrics.count++;
    perfMetrics.totalResponseTime += data.responseTime;
    perfMetrics.responseTimes.push(data.responseTime);

    // Keep only last 1000 response times
    if (perfMetrics.responseTimes.length > 1000) {
      perfMetrics.responseTimes = perfMetrics.responseTimes.slice(-1000);
    }

    // Calculate percentiles
    const sorted = [...perfMetrics.responseTimes].sort((a, b) => a - b);
    perfMetrics.responseTimeP50 = this.calculatePercentile(sorted, 50);
    perfMetrics.responseTimeP95 = this.calculatePercentile(sorted, 95);
    perfMetrics.responseTimeP99 = this.calculatePercentile(sorted, 99);

    perfMetrics.lastUpdate = timestamp;

    await this.state.storage.put(key, perfMetrics);
  }

  async updateErrorStats(data, timestamp) {
    const errorCode = data.responseStatus || data.errorCode || 'unknown';
    const key = `error_stats_${errorCode}`;

    let errorStats = await this.state.storage.get(key) || {
      count: 0,
      lastOccurrence: timestamp,
      firstOccurrence: timestamp,
      endpoints: new Map(),
      userAgents: new Map()
    };

    errorStats.count++;
    errorStats.lastOccurrence = timestamp;

    // Track by endpoint
    const endpoint = data.pathname || '/';
    const endpointCount = errorStats.endpoints.get(endpoint) || 0;
    errorStats.endpoints.set(endpoint, endpointCount + 1);

    // Track by user agent (simplified)
    const userAgent = (data.userAgent || '').substring(0, 50);
    const uaCount = errorStats.userAgents.get(userAgent) || 0;
    errorStats.userAgents.set(userAgent, uaCount + 1);

    await this.state.storage.put(key, errorStats);
  }

  async updateSecurityStats(data, timestamp) {
    const blockReason = data.blockReason || 'unknown';
    const key = `security_stats_${blockReason}`;

    let securityStats = await this.state.storage.get(key) || {
      count: 0,
      lastOccurrence: timestamp,
      firstOccurrence: timestamp,
      countries: new Map(),
      threatLevel: data.threatLevel || 'low'
    };

    securityStats.count++;
    securityStats.lastOccurrence = timestamp;

    // Track by country
    if (data.country) {
      const countryCount = securityStats.countries.get(data.country) || 0;
      securityStats.countries.set(data.country, countryCount + 1);
    }

    await this.state.storage.put(key, securityStats);
  }

  async getStats(request) {
    const url = new URL(request.url);
    const timeRange = url.searchParams.get('range') || '1h';
    const metric = url.searchParams.get('metric') || 'all';

    const endTime = Date.now();
    const startTime = endTime - this.parseTimeRange(timeRange);

    const stats = {
      timeRange,
      startTime,
      endTime,
      summary: await this.getSummaryStats(startTime, endTime),
      timeSeries: await this.getTimeSeriesStats(startTime, endTime, metric),
      geographic: await this.getGeographicStats(),
      performance: await this.getPerformanceStats(),
      errors: await this.getErrorStats(),
      security: await this.getSecurityStats()
    };

    return new Response(JSON.stringify(stats), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async getRealTimeStats() {
    const counters = await this.state.storage.get('realtime_counters') || {};

    const stats = {
      requests: counters.requests || 0,
      pageviews: counters.pageviews || 0,
      apiCalls: counters.apiCalls || 0,
      errors: counters.errors || 0,
      cacheHits: counters.cacheHits || 0,
      cacheMisses: counters.cacheMisses || 0,
      securityBlocks: counters.securityBlocks || 0,
      uniqueVisitors: counters.uniqueVisitors ? counters.uniqueVisitors.size : 0,
      cacheHitRate: this.calculateCacheHitRate(counters.cacheHits, counters.cacheMisses),
      errorRate: this.calculateErrorRate(counters.errors, counters.requests),
      lastUpdate: counters.lastUpdate || Date.now()
    };

    return new Response(JSON.stringify(stats), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async flushData() {
    try {
      if (this.buffer.length === 0) {
        return new Response(JSON.stringify({ success: true, flushed: 0 }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Send to external analytics service if configured
      if (this.env.EXTERNAL_ANALYTICS_URL) {
        await this.sendToExternalAnalytics(this.buffer);
      }

      // Store in persistent storage
      await this.storeBatchData(this.buffer);

      const flushedCount = this.buffer.length;
      this.buffer = [];
      this.lastFlush = Date.now();

      return new Response(JSON.stringify({
        success: true,
        flushed: flushedCount,
        timestamp: this.lastFlush
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Flush error:', error);
      return new Response('Flush failed', { status: 500 });
    }
  }

  // Helper methods

  parseTimeRange(range) {
    const units = {
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000
    };

    const match = range.match(/^(\d+)([mhd])$/);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2];
      return value * units[unit];
    }

    return 60 * 60 * 1000; // Default to 1 hour
  }

  calculatePercentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;

    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sortedArray[lower];
    }

    return sortedArray[lower] + (sortedArray[upper] - sortedArray[lower]) * (index - lower);
  }

  calculateCacheHitRate(hits, misses) {
    const total = hits + misses;
    return total > 0 ? (hits / total) * 100 : 0;
  }

  calculateErrorRate(errors, requests) {
    return requests > 0 ? (errors / requests) * 100 : 0;
  }

  async getSummaryStats(startTime, endTime) {
    // Aggregate data from time series
    const keys = await this.state.storage.list({ prefix: 'timeseries_' });
    let totalRequests = 0;
    let totalErrors = 0;
    let totalResponseTime = 0;
    let requestCount = 0;

    for (const [key, data] of keys) {
      if (data.timestamp >= startTime && data.timestamp <= endTime) {
        totalRequests += data.count || 0;
        totalErrors += data.errors || 0;
        if (data.totalResponseTime) {
          totalResponseTime += data.totalResponseTime;
          requestCount += data.count || 0;
        }
      }
    }

    return {
      totalRequests,
      totalErrors,
      errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
      averageResponseTime: requestCount > 0 ? totalResponseTime / requestCount : 0
    };
  }

  async getTimeSeriesStats(startTime, endTime, metric) {
    const keys = await this.state.storage.list({ prefix: `timeseries_${metric}_` });
    const timeSeries = [];

    for (const [key, data] of keys) {
      if (data.timestamp >= startTime && data.timestamp <= endTime) {
        timeSeries.push({
          timestamp: data.timestamp,
          count: data.count || 0,
          errors: data.errors || 0,
          averageResponseTime: data.count > 0 ? data.totalResponseTime / data.count : 0
        });
      }
    }

    return timeSeries.sort((a, b) => a.timestamp - b.timestamp);
  }

  async getGeographicStats() {
    const keys = await this.state.storage.list({ prefix: 'geo_stats_' });
    const geographic = [];

    for (const [key, data] of keys) {
      const country = key.replace('geo_stats_', '');
      geographic.push({
        country,
        requests: data.requests || 0,
        lastSeen: data.lastSeen,
        firstSeen: data.firstSeen
      });
    }

    return geographic.sort((a, b) => b.requests - a.requests);
  }

  async getPerformanceStats() {
    const keys = await this.state.storage.list({ prefix: 'performance_' });
    const performance = [];

    for (const [key, data] of keys) {
      const endpoint = key.replace('performance_', '');
      performance.push({
        endpoint,
        count: data.count || 0,
        averageResponseTime: data.count > 0 ? data.totalResponseTime / data.count : 0,
        p50: data.responseTimeP50 || 0,
        p95: data.responseTimeP95 || 0,
        p99: data.responseTimeP99 || 0
      });
    }

    return performance.sort((a, b) => b.count - a.count);
  }

  async getErrorStats() {
    const keys = await this.state.storage.list({ prefix: 'error_stats_' });
    const errors = [];

    for (const [key, data] of keys) {
      const errorCode = key.replace('error_stats_', '');
      errors.push({
        errorCode,
        count: data.count || 0,
        lastOccurrence: data.lastOccurrence,
        firstOccurrence: data.firstOccurrence,
        topEndpoints: Array.from(data.endpoints?.entries() || [])
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
      });
    }

    return errors.sort((a, b) => b.count - a.count);
  }

  async getSecurityStats() {
    const keys = await this.state.storage.list({ prefix: 'security_stats_' });
    const security = [];

    for (const [key, data] of keys) {
      const blockReason = key.replace('security_stats_', '');
      security.push({
        blockReason,
        count: data.count || 0,
        lastOccurrence: data.lastOccurrence,
        firstOccurrence: data.firstOccurrence,
        threatLevel: data.threatLevel,
        topCountries: Array.from(data.countries?.entries() || [])
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
      });
    }

    return security.sort((a, b) => b.count - a.count);
  }

  async sendToExternalAnalytics(events) {
    try {
      const response = await fetch(this.env.EXTERNAL_ANALYTICS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.env.ANALYTICS_API_KEY}`
        },
        body: JSON.stringify({ events })
      });

      if (!response.ok) {
        throw new Error(`External analytics failed: ${response.status}`);
      }

    } catch (error) {
      console.error('External analytics error:', error);
      // Don't fail the whole flush operation
    }
  }

  async storeBatchData(events) {
    const batchKey = `batch_${Date.now()}_${crypto.randomUUID()}`;
    await this.state.storage.put(batchKey, {
      events,
      timestamp: Date.now(),
      count: events.length
    });
  }

  scheduleCleanup(currentTimeSlot) {
    // Clean up data older than 7 days
    const cutoffTime = currentTimeSlot - (7 * 24 * 60 * 60 * 1000);

    // Schedule as alarm for periodic cleanup
    if (!this.cleanupScheduled) {
      this.state.storage.setAlarm(Date.now() + 60 * 60 * 1000); // 1 hour
      this.cleanupScheduled = true;
    }
  }

  async alarm() {
    // Perform cleanup of old data
    const keys = await this.state.storage.list();
    const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago
    let deletedKeys = 0;

    for (const [key, data] of keys) {
      if (key.startsWith('timeseries_') && data.timestamp < cutoffTime) {
        await this.state.storage.delete(key);
        deletedKeys++;
      } else if (key.startsWith('batch_') && data.timestamp < cutoffTime) {
        await this.state.storage.delete(key);
        deletedKeys++;
      }
    }

    console.log(`Analytics cleanup: deleted ${deletedKeys} old entries`);

    // Schedule next cleanup
    await this.state.storage.setAlarm(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    this.cleanupScheduled = false;
  }
}