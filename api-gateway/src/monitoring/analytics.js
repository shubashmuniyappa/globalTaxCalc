/**
 * API Analytics and Monitoring System
 * Comprehensive tracking, metrics, and performance monitoring
 */

const { EventEmitter } = require('events');
const { performance } = require('perf_hooks');

class APIAnalytics extends EventEmitter {
  constructor() {
    super();
    this.metrics = new Map();
    this.requestBuffer = [];
    this.errorBuffer = [];
    this.performanceBuffer = [];

    // Configuration
    this.bufferSize = 10000;
    this.flushInterval = 60000; // 1 minute
    this.retentionPeriod = 24 * 60 * 60 * 1000; // 24 hours

    // Real-time tracking
    this.activeRequests = new Map();
    this.rateLimitStats = new Map();

    // Start periodic tasks
    this.startPeriodicTasks();
  }

  startPeriodicTasks() {
    // Flush metrics to storage periodically
    setInterval(() => this.flushMetrics(), this.flushInterval);

    // Clean up old data
    setInterval(() => this.cleanup(), this.retentionPeriod / 24);

    // Generate reports
    setInterval(() => this.generateReports(), 5 * 60 * 1000); // 5 minutes
  }

  // Request tracking middleware
  trackRequest() {
    return (req, res, next) => {
      const requestId = this.generateRequestId();
      const startTime = performance.now();

      // Attach request metadata
      req.analytics = {
        requestId,
        startTime,
        timestamp: new Date(),
        method: req.method,
        path: req.path,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        userId: req.user?.id,
        apiKey: req.headers['x-api-key'],
        apiVersion: req.apiVersion,
        authMethod: req.authMethod
      };

      // Add to active requests
      this.activeRequests.set(requestId, req.analytics);

      // Override res.end to capture response data
      const originalEnd = res.end;
      res.end = function(chunk, encoding) {
        const endTime = performance.now();
        const duration = endTime - startTime;

        // Create analytics event
        const analyticsData = {
          ...req.analytics,
          statusCode: res.statusCode,
          responseTime: duration,
          responseSize: chunk ? Buffer.byteLength(chunk, encoding) : 0,
          endTime,
          success: res.statusCode < 400
        };

        // Track the request
        this.trackRequestCompletion(analyticsData);

        // Remove from active requests
        this.activeRequests.delete(requestId);

        // Call original end
        originalEnd.call(res, chunk, encoding);
      }.bind(this);

      next();
    };
  }

  // Error tracking middleware
  trackErrors() {
    return (error, req, res, next) => {
      const errorData = {
        requestId: req.analytics?.requestId,
        timestamp: new Date(),
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        },
        request: {
          method: req.method,
          path: req.path,
          userId: req.user?.id,
          ip: req.ip
        },
        context: {
          userAgent: req.get('User-Agent'),
          apiVersion: req.apiVersion,
          authMethod: req.authMethod
        }
      };

      this.trackError(errorData);
      next(error);
    };
  }

  // Track completed requests
  trackRequestCompletion(data) {
    // Add to buffer
    this.requestBuffer.push(data);

    // Emit real-time events
    this.emit('request:completed', data);

    // Update metrics
    this.updateMetrics(data);

    // Trim buffer if too large
    if (this.requestBuffer.length > this.bufferSize) {
      this.requestBuffer = this.requestBuffer.slice(-this.bufferSize);
    }

    // Track specific events
    this.trackSpecificMetrics(data);
  }

  // Track errors
  trackError(errorData) {
    this.errorBuffer.push(errorData);
    this.emit('error:tracked', errorData);

    // Update error metrics
    const errorKey = `errors:${errorData.error.name}`;
    this.incrementMetric(errorKey);

    // Trim error buffer
    if (this.errorBuffer.length > this.bufferSize) {
      this.errorBuffer = this.errorBuffer.slice(-this.bufferSize);
    }
  }

  // Update various metrics
  updateMetrics(data) {
    const now = new Date();
    const hourKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;

    // Basic metrics
    this.incrementMetric('requests:total');
    this.incrementMetric(`requests:${data.method.toLowerCase()}`);
    this.incrementMetric(`requests:status:${data.statusCode}`);
    this.incrementMetric(`requests:hour:${hourKey}`);

    // User metrics
    if (data.userId) {
      this.incrementMetric(`requests:user:${data.userId}`);
    }

    // API version metrics
    if (data.apiVersion) {
      this.incrementMetric(`requests:version:${data.apiVersion}`);
    }

    // Authentication method metrics
    if (data.authMethod) {
      this.incrementMetric(`requests:auth:${data.authMethod}`);
    }

    // Response time tracking
    this.trackResponseTime(data.responseTime, data.path);

    // Success/Error rates
    if (data.success) {
      this.incrementMetric('requests:success');
    } else {
      this.incrementMetric('requests:error');
    }
  }

  // Track response times
  trackResponseTime(responseTime, path) {
    const perfData = {
      timestamp: new Date(),
      path,
      responseTime,
      bucket: this.getResponseTimeBucket(responseTime)
    };

    this.performanceBuffer.push(perfData);
    this.incrementMetric(`performance:${perfData.bucket}`);

    // Calculate averages
    this.updateAverageResponseTime(responseTime);

    // Trim performance buffer
    if (this.performanceBuffer.length > this.bufferSize) {
      this.performanceBuffer = this.performanceBuffer.slice(-this.bufferSize);
    }
  }

  // Get response time bucket for categorization
  getResponseTimeBucket(responseTime) {
    if (responseTime < 100) return 'fast'; // < 100ms
    if (responseTime < 500) return 'medium'; // 100-500ms
    if (responseTime < 2000) return 'slow'; // 500ms-2s
    return 'very_slow'; // > 2s
  }

  // Update average response time
  updateAverageResponseTime(responseTime) {
    const currentAvg = this.getMetric('performance:avg_response_time') || 0;
    const requestCount = this.getMetric('requests:total') || 1;

    const newAvg = ((currentAvg * (requestCount - 1)) + responseTime) / requestCount;
    this.setMetric('performance:avg_response_time', newAvg);
  }

  // Track specific business metrics
  trackSpecificMetrics(data) {
    // Track GraphQL vs REST usage
    if (data.path.includes('/graphql')) {
      this.incrementMetric('requests:graphql');
    } else if (data.path.includes('/api/')) {
      this.incrementMetric('requests:rest');
    }

    // Track portal usage
    if (data.path.includes('/portal')) {
      this.incrementMetric('requests:portal');
    }

    // Track webhook deliveries
    if (data.path.includes('/webhook')) {
      this.incrementMetric('webhooks:delivered');
    }
  }

  // Rate limiting analytics
  trackRateLimit(identifier, limit, remaining) {
    const rateLimitData = {
      identifier,
      limit,
      remaining,
      timestamp: new Date(),
      utilization: ((limit - remaining) / limit) * 100
    };

    this.rateLimitStats.set(identifier, rateLimitData);
    this.emit('rateLimit:updated', rateLimitData);

    // Alert if utilization is high
    if (rateLimitData.utilization > 80) {
      this.emit('rateLimit:warning', rateLimitData);
    }
  }

  // Generate real-time dashboard data
  generateDashboardData() {
    const now = new Date();
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

    // Filter recent requests
    const recentRequests = this.requestBuffer.filter(req =>
      new Date(req.timestamp) > lastHour
    );

    const recentErrors = this.errorBuffer.filter(err =>
      new Date(err.timestamp) > lastHour
    );

    return {
      realTime: {
        activeRequests: this.activeRequests.size,
        requestsPerMinute: this.calculateRequestsPerMinute(recentRequests),
        avgResponseTime: this.calculateAverageResponseTime(recentRequests),
        errorRate: this.calculateErrorRate(recentRequests),
        topEndpoints: this.getTopEndpoints(recentRequests),
        statusCodes: this.getStatusCodeDistribution(recentRequests)
      },
      performance: {
        responseTimes: this.getResponseTimeDistribution(recentRequests),
        slowestEndpoints: this.getSlowestEndpoints(recentRequests),
        performanceScore: this.calculatePerformanceScore(recentRequests)
      },
      errors: {
        recentErrors: recentErrors.slice(-10),
        errorsByType: this.getErrorDistribution(recentErrors),
        errorTrends: this.getErrorTrends(recentErrors)
      },
      usage: {
        apiVersions: this.getApiVersionUsage(recentRequests),
        authMethods: this.getAuthMethodUsage(recentRequests),
        userActivity: this.getUserActivity(recentRequests),
        geographicDistribution: this.getGeographicDistribution(recentRequests)
      },
      rateLimits: Array.from(this.rateLimitStats.values())
    };
  }

  // Calculate requests per minute
  calculateRequestsPerMinute(requests) {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

    const lastMinuteRequests = requests.filter(req =>
      new Date(req.timestamp) > oneMinuteAgo
    );

    return lastMinuteRequests.length;
  }

  // Calculate average response time
  calculateAverageResponseTime(requests) {
    if (requests.length === 0) return 0;

    const totalTime = requests.reduce((sum, req) => sum + req.responseTime, 0);
    return totalTime / requests.length;
  }

  // Calculate error rate
  calculateErrorRate(requests) {
    if (requests.length === 0) return 0;

    const errorCount = requests.filter(req => !req.success).length;
    return (errorCount / requests.length) * 100;
  }

  // Get top endpoints by request count
  getTopEndpoints(requests) {
    const endpointCounts = {};

    requests.forEach(req => {
      const endpoint = `${req.method} ${req.path}`;
      endpointCounts[endpoint] = (endpointCounts[endpoint] || 0) + 1;
    });

    return Object.entries(endpointCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([endpoint, count]) => ({ endpoint, count }));
  }

  // Get status code distribution
  getStatusCodeDistribution(requests) {
    const statusCodes = {};

    requests.forEach(req => {
      const code = req.statusCode;
      statusCodes[code] = (statusCodes[code] || 0) + 1;
    });

    return statusCodes;
  }

  // Get response time distribution
  getResponseTimeDistribution(requests) {
    const buckets = { fast: 0, medium: 0, slow: 0, very_slow: 0 };

    requests.forEach(req => {
      const bucket = this.getResponseTimeBucket(req.responseTime);
      buckets[bucket]++;
    });

    return buckets;
  }

  // Get slowest endpoints
  getSlowestEndpoints(requests) {
    const endpointTimes = {};

    requests.forEach(req => {
      const endpoint = `${req.method} ${req.path}`;
      if (!endpointTimes[endpoint]) {
        endpointTimes[endpoint] = { total: 0, count: 0 };
      }
      endpointTimes[endpoint].total += req.responseTime;
      endpointTimes[endpoint].count += 1;
    });

    return Object.entries(endpointTimes)
      .map(([endpoint, data]) => ({
        endpoint,
        avgResponseTime: data.total / data.count,
        requestCount: data.count
      }))
      .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
      .slice(0, 10);
  }

  // Calculate performance score (0-100)
  calculatePerformanceScore(requests) {
    if (requests.length === 0) return 100;

    const avgResponseTime = this.calculateAverageResponseTime(requests);
    const errorRate = this.calculateErrorRate(requests);

    // Score based on response time and error rate
    let score = 100;

    // Deduct for slow response times
    if (avgResponseTime > 2000) score -= 30;
    else if (avgResponseTime > 1000) score -= 20;
    else if (avgResponseTime > 500) score -= 10;

    // Deduct for errors
    score -= errorRate * 2; // 2 points per 1% error rate

    return Math.max(0, score);
  }

  // Helper methods for analytics data
  getErrorDistribution(errors) {
    const distribution = {};
    errors.forEach(err => {
      const type = err.error.name;
      distribution[type] = (distribution[type] || 0) + 1;
    });
    return distribution;
  }

  getErrorTrends(errors) {
    // Implementation for error trends over time
    return this.groupByTimeWindow(errors, 10 * 60 * 1000); // 10 minute windows
  }

  getApiVersionUsage(requests) {
    const versions = {};
    requests.forEach(req => {
      if (req.apiVersion) {
        versions[req.apiVersion] = (versions[req.apiVersion] || 0) + 1;
      }
    });
    return versions;
  }

  getAuthMethodUsage(requests) {
    const methods = {};
    requests.forEach(req => {
      if (req.authMethod) {
        methods[req.authMethod] = (methods[req.authMethod] || 0) + 1;
      }
    });
    return methods;
  }

  getUserActivity(requests) {
    const users = {};
    requests.forEach(req => {
      if (req.userId) {
        users[req.userId] = (users[req.userId] || 0) + 1;
      }
    });

    return Object.entries(users)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([userId, count]) => ({ userId, requestCount: count }));
  }

  getGeographicDistribution(requests) {
    // Mock implementation - in production, you'd use IP geolocation
    const countries = {};
    requests.forEach(req => {
      // This would use a real IP geolocation service
      const country = this.getCountryFromIP(req.ip);
      countries[country] = (countries[country] || 0) + 1;
    });
    return countries;
  }

  // Mock geolocation function
  getCountryFromIP(ip) {
    // In production, use a real geolocation service
    return 'Unknown';
  }

  // Group data by time windows
  groupByTimeWindow(data, windowMs) {
    const windows = {};
    data.forEach(item => {
      const timestamp = new Date(item.timestamp);
      const windowStart = Math.floor(timestamp.getTime() / windowMs) * windowMs;
      const windowKey = new Date(windowStart).toISOString();
      windows[windowKey] = (windows[windowKey] || 0) + 1;
    });
    return windows;
  }

  // Metric management
  incrementMetric(key, value = 1) {
    this.metrics.set(key, (this.metrics.get(key) || 0) + value);
  }

  getMetric(key) {
    return this.metrics.get(key) || 0;
  }

  setMetric(key, value) {
    this.metrics.set(key, value);
  }

  getAllMetrics() {
    return Object.fromEntries(this.metrics);
  }

  // Utility methods
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Cleanup old data
  cleanup() {
    const cutoff = new Date(Date.now() - this.retentionPeriod);

    this.requestBuffer = this.requestBuffer.filter(req =>
      new Date(req.timestamp) > cutoff
    );

    this.errorBuffer = this.errorBuffer.filter(err =>
      new Date(err.timestamp) > cutoff
    );

    this.performanceBuffer = this.performanceBuffer.filter(perf =>
      new Date(perf.timestamp) > cutoff
    );
  }

  // Flush metrics to persistent storage
  async flushMetrics() {
    const dashboardData = this.generateDashboardData();

    // In production, this would write to a database or time-series DB
    console.log('📊 Analytics Dashboard Data:', JSON.stringify(dashboardData, null, 2));

    this.emit('metrics:flushed', dashboardData);
  }

  // Generate periodic reports
  generateReports() {
    const report = {
      timestamp: new Date(),
      summary: {
        totalRequests: this.getMetric('requests:total'),
        totalErrors: this.getMetric('requests:error'),
        avgResponseTime: this.getMetric('performance:avg_response_time'),
        activeUsers: this.getUniqueUserCount(),
        topEndpoints: this.getTopEndpoints(this.requestBuffer.slice(-1000))
      }
    };

    this.emit('report:generated', report);
  }

  getUniqueUserCount() {
    const users = new Set();
    this.requestBuffer.forEach(req => {
      if (req.userId) users.add(req.userId);
    });
    return users.size;
  }

  // Export analytics data
  exportData(format = 'json', timeRange = '24h') {
    const data = {
      requests: this.requestBuffer,
      errors: this.errorBuffer,
      performance: this.performanceBuffer,
      metrics: this.getAllMetrics()
    };

    switch (format) {
      case 'csv':
        return this.convertToCSV(data);
      case 'json':
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  convertToCSV(data) {
    // Simple CSV conversion for requests
    const headers = ['timestamp', 'method', 'path', 'statusCode', 'responseTime', 'userId'];
    const rows = data.requests.map(req => [
      req.timestamp,
      req.method,
      req.path,
      req.statusCode,
      req.responseTime,
      req.userId || ''
    ]);

    return [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');
  }
}

// Create singleton instance
const analytics = new APIAnalytics();

module.exports = {
  APIAnalytics,
  analytics,
  trackRequest: analytics.trackRequest.bind(analytics),
  trackErrors: analytics.trackErrors.bind(analytics),
  getDashboardData: analytics.generateDashboardData.bind(analytics)
};