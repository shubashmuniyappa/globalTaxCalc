const config = require('../config');
const Redis = require('ioredis');
const Bull = require('bull');
const { v4: uuidv4 } = require('uuid');

class AnalyticsService {
  constructor() {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.cacheDb
    });

    // Create processing queue
    this.analyticsQueue = new Bull('analytics processing', {
      redis: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db
      }
    });

    this.metrics = new Map();
    this.eventBuffer = [];
    this.adBlockerDetection = new Map();

    this.init();
  }

  async init() {
    await this.setupEventProcessing();
    await this.startRealtimeMetrics();
    await this.initializeMetricsTracking();
  }

  async setupEventProcessing() {
    // Process analytics events in batches
    this.analyticsQueue.process('batch-process', config.analytics.batchSize, async (job) => {
      return await this.processBatchEvents(job.data.events);
    });

    // Start flush timer
    setInterval(() => {
      this.flushEventBuffer();
    }, config.analytics.flushInterval);
  }

  async trackImpression(placementId, networkName, context = {}) {
    const impressionData = {
      id: uuidv4(),
      type: 'impression',
      placementId,
      networkName,
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0],
      hour: new Date().getHours(),
      country: context.country,
      device: context.device,
      calculatorType: context.calculatorType,
      userAgent: context.userAgent,
      ip: this.anonymizeIP(context.ip),
      sessionId: context.sessionId,
      userId: context.userId,
      adBlockerDetected: context.adBlockerDetected || false,
      viewabilityScore: context.viewabilityScore || 0,
      size: context.adSize,
      position: context.position
    };

    // Add to buffer for batch processing
    this.eventBuffer.push(impressionData);

    // Update real-time metrics immediately
    await this.updateRealtimeMetrics('impression', impressionData);

    // Track for ad blocker analysis
    if (context.adBlockerDetected) {
      await this.trackAdBlocker(context.ip, context.userAgent);
    }

    return impressionData.id;
  }

  async trackClick(placementId, networkName, context = {}) {
    const clickData = {
      id: uuidv4(),
      type: 'click',
      placementId,
      networkName,
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0],
      hour: new Date().getHours(),
      country: context.country,
      device: context.device,
      calculatorType: context.calculatorType,
      userAgent: context.userAgent,
      ip: this.anonymizeIP(context.ip),
      sessionId: context.sessionId,
      userId: context.userId,
      clickX: context.clickX,
      clickY: context.clickY,
      targetUrl: context.targetUrl,
      dwellTime: context.dwellTime || 0 // Time spent on page before click
    };

    this.eventBuffer.push(clickData);
    await this.updateRealtimeMetrics('click', clickData);

    return clickData.id;
  }

  async trackRevenue(placementId, networkName, revenue, context = {}) {
    const revenueData = {
      id: uuidv4(),
      type: 'revenue',
      placementId,
      networkName,
      revenue,
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0],
      hour: new Date().getHours(),
      country: context.country,
      device: context.device,
      calculatorType: context.calculatorType,
      sessionId: context.sessionId,
      userId: context.userId,
      conversionType: context.conversionType || 'impression',
      paymentModel: context.paymentModel || 'cpm' // cpm, cpc, cpa
    };

    this.eventBuffer.push(revenueData);
    await this.updateRealtimeMetrics('revenue', revenueData);

    return revenueData.id;
  }

  async trackViewability(placementId, networkName, viewabilityData, context = {}) {
    const viewabilityEvent = {
      id: uuidv4(),
      type: 'viewability',
      placementId,
      networkName,
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0],
      country: context.country,
      device: context.device,
      viewabilityScore: viewabilityData.score,
      timeInView: viewabilityData.timeInView,
      percentageVisible: viewabilityData.percentageVisible,
      viewportSize: viewabilityData.viewportSize,
      adSize: viewabilityData.adSize,
      scrollPosition: viewabilityData.scrollPosition
    };

    this.eventBuffer.push(viewabilityEvent);
    await this.updateRealtimeMetrics('viewability', viewabilityEvent);

    return viewabilityEvent.id;
  }

  async trackError(placementId, networkName, errorData, context = {}) {
    const errorEvent = {
      id: uuidv4(),
      type: 'error',
      placementId,
      networkName,
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0],
      country: context.country,
      device: context.device,
      errorType: errorData.type,
      errorMessage: errorData.message,
      errorStack: errorData.stack,
      errorUrl: errorData.url,
      userAgent: context.userAgent,
      severity: errorData.severity || 'medium'
    };

    this.eventBuffer.push(errorEvent);

    // Errors are processed immediately
    await this.processErrorEvent(errorEvent);

    return errorEvent.id;
  }

  async trackAdBlocker(ip, userAgent) {
    const key = `adblocker:${this.anonymizeIP(ip)}`;
    const data = {
      detectedAt: Date.now(),
      userAgent: userAgent,
      count: 1
    };

    const existing = await this.redis.get(key);
    if (existing) {
      const parsed = JSON.parse(existing);
      data.count = parsed.count + 1;
    }

    await this.redis.setex(key, 86400, JSON.stringify(data)); // Store for 24 hours

    // Update global ad blocker metrics
    await this.redis.incr('adblocker:global:count');
    await this.redis.expire('adblocker:global:count', 86400);
  }

  async updateRealtimeMetrics(eventType, eventData) {
    const metricsKey = `realtime:${eventData.date}:${eventData.hour}`;
    const networkKey = `realtime:${eventData.networkName}:${eventData.date}`;
    const geoKey = `realtime:${eventData.country || 'unknown'}:${eventData.date}`;

    // Update global metrics
    await this.redis.hincrby(metricsKey, `${eventType}_count`, 1);

    // Update network metrics
    await this.redis.hincrby(networkKey, `${eventType}_count`, 1);

    // Update geographic metrics
    await this.redis.hincrby(geoKey, `${eventType}_count`, 1);

    // Update revenue specifically
    if (eventType === 'revenue') {
      await this.redis.hincrbyfloat(metricsKey, 'revenue_total', eventData.revenue);
      await this.redis.hincrbyfloat(networkKey, 'revenue_total', eventData.revenue);
      await this.redis.hincrbyfloat(geoKey, 'revenue_total', eventData.revenue);
    }

    // Update viewability specifically
    if (eventType === 'viewability') {
      await this.redis.hincrbyfloat(metricsKey, 'viewability_sum', eventData.viewabilityScore);
      await this.redis.hincrbyfloat(networkKey, 'viewability_sum', eventData.viewabilityScore);
    }

    // Set expiration
    await this.redis.expire(metricsKey, 86400 * 7); // 7 days
    await this.redis.expire(networkKey, 86400 * 7);
    await this.redis.expire(geoKey, 86400 * 7);
  }

  async flushEventBuffer() {
    if (this.eventBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    // Add to processing queue
    await this.analyticsQueue.add('batch-process', { events }, {
      attempts: 3,
      backoff: 'exponential',
      delay: 1000
    });
  }

  async processBatchEvents(events) {
    try {
      // Group events by type and date
      const groupedEvents = this.groupEventsByTypeAndDate(events);

      // Process each group
      for (const [key, eventGroup] of Object.entries(groupedEvents)) {
        await this.processEventGroup(key, eventGroup);
      }

      // Store raw events for detailed analysis
      await this.storeRawEvents(events);

      return { processed: events.length };
    } catch (error) {
      console.error('Error processing batch events:', error);
      throw error;
    }
  }

  groupEventsByTypeAndDate(events) {
    const groups = {};

    events.forEach(event => {
      const key = `${event.type}:${event.date}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(event);
    });

    return groups;
  }

  async processEventGroup(key, events) {
    const [eventType, date] = key.split(':');

    switch (eventType) {
      case 'impression':
        await this.processImpressionGroup(date, events);
        break;
      case 'click':
        await this.processClickGroup(date, events);
        break;
      case 'revenue':
        await this.processRevenueGroup(date, events);
        break;
      case 'viewability':
        await this.processViewabilityGroup(date, events);
        break;
      case 'error':
        await this.processErrorGroup(date, events);
        break;
    }
  }

  async processImpressionGroup(date, impressions) {
    const dailyKey = `daily:impressions:${date}`;

    // Aggregate by various dimensions
    const aggregations = {
      total: impressions.length,
      byNetwork: {},
      byCountry: {},
      byDevice: {},
      byCalculatorType: {},
      byHour: {}
    };

    impressions.forEach(impression => {
      // By network
      aggregations.byNetwork[impression.networkName] =
        (aggregations.byNetwork[impression.networkName] || 0) + 1;

      // By country
      const country = impression.country || 'unknown';
      aggregations.byCountry[country] =
        (aggregations.byCountry[country] || 0) + 1;

      // By device
      const device = impression.device || 'unknown';
      aggregations.byDevice[device] =
        (aggregations.byDevice[device] || 0) + 1;

      // By calculator type
      if (impression.calculatorType) {
        aggregations.byCalculatorType[impression.calculatorType] =
          (aggregations.byCalculatorType[impression.calculatorType] || 0) + 1;
      }

      // By hour
      aggregations.byHour[impression.hour] =
        (aggregations.byHour[impression.hour] || 0) + 1;
    });

    await this.redis.setex(dailyKey, 86400 * 90, JSON.stringify(aggregations));
  }

  async processClickGroup(date, clicks) {
    const dailyKey = `daily:clicks:${date}`;

    const aggregations = {
      total: clicks.length,
      byNetwork: {},
      byCountry: {},
      byDevice: {},
      byCalculatorType: {},
      byHour: {},
      averageDwellTime: 0
    };

    let totalDwellTime = 0;

    clicks.forEach(click => {
      aggregations.byNetwork[click.networkName] =
        (aggregations.byNetwork[click.networkName] || 0) + 1;

      const country = click.country || 'unknown';
      aggregations.byCountry[country] =
        (aggregations.byCountry[country] || 0) + 1;

      const device = click.device || 'unknown';
      aggregations.byDevice[device] =
        (aggregations.byDevice[device] || 0) + 1;

      if (click.calculatorType) {
        aggregations.byCalculatorType[click.calculatorType] =
          (aggregations.byCalculatorType[click.calculatorType] || 0) + 1;
      }

      aggregations.byHour[click.hour] =
        (aggregations.byHour[click.hour] || 0) + 1;

      totalDwellTime += click.dwellTime || 0;
    });

    aggregations.averageDwellTime = clicks.length > 0 ? totalDwellTime / clicks.length : 0;

    await this.redis.setex(dailyKey, 86400 * 90, JSON.stringify(aggregations));
  }

  async processRevenueGroup(date, revenues) {
    const dailyKey = `daily:revenue:${date}`;

    const aggregations = {
      total: 0,
      count: revenues.length,
      byNetwork: {},
      byCountry: {},
      byDevice: {},
      byCalculatorType: {},
      byHour: {},
      byPaymentModel: {}
    };

    revenues.forEach(revenue => {
      aggregations.total += revenue.revenue;

      // By network
      if (!aggregations.byNetwork[revenue.networkName]) {
        aggregations.byNetwork[revenue.networkName] = { total: 0, count: 0 };
      }
      aggregations.byNetwork[revenue.networkName].total += revenue.revenue;
      aggregations.byNetwork[revenue.networkName].count += 1;

      // By country
      const country = revenue.country || 'unknown';
      if (!aggregations.byCountry[country]) {
        aggregations.byCountry[country] = { total: 0, count: 0 };
      }
      aggregations.byCountry[country].total += revenue.revenue;
      aggregations.byCountry[country].count += 1;

      // By device
      const device = revenue.device || 'unknown';
      if (!aggregations.byDevice[device]) {
        aggregations.byDevice[device] = { total: 0, count: 0 };
      }
      aggregations.byDevice[device].total += revenue.revenue;
      aggregations.byDevice[device].count += 1;

      // By calculator type
      if (revenue.calculatorType) {
        if (!aggregations.byCalculatorType[revenue.calculatorType]) {
          aggregations.byCalculatorType[revenue.calculatorType] = { total: 0, count: 0 };
        }
        aggregations.byCalculatorType[revenue.calculatorType].total += revenue.revenue;
        aggregations.byCalculatorType[revenue.calculatorType].count += 1;
      }

      // By hour
      if (!aggregations.byHour[revenue.hour]) {
        aggregations.byHour[revenue.hour] = { total: 0, count: 0 };
      }
      aggregations.byHour[revenue.hour].total += revenue.revenue;
      aggregations.byHour[revenue.hour].count += 1;

      // By payment model
      const paymentModel = revenue.paymentModel || 'unknown';
      if (!aggregations.byPaymentModel[paymentModel]) {
        aggregations.byPaymentModel[paymentModel] = { total: 0, count: 0 };
      }
      aggregations.byPaymentModel[paymentModel].total += revenue.revenue;
      aggregations.byPaymentModel[paymentModel].count += 1;
    });

    await this.redis.setex(dailyKey, 86400 * 90, JSON.stringify(aggregations));
  }

  async processViewabilityGroup(date, viewabilities) {
    const dailyKey = `daily:viewability:${date}`;

    const aggregations = {
      count: viewabilities.length,
      averageScore: 0,
      averageTimeInView: 0,
      averagePercentageVisible: 0,
      byNetwork: {},
      byCountry: {},
      byDevice: {}
    };

    let totalScore = 0;
    let totalTimeInView = 0;
    let totalPercentageVisible = 0;

    viewabilities.forEach(viewability => {
      totalScore += viewability.viewabilityScore;
      totalTimeInView += viewability.timeInView || 0;
      totalPercentageVisible += viewability.percentageVisible || 0;

      // By network
      if (!aggregations.byNetwork[viewability.networkName]) {
        aggregations.byNetwork[viewability.networkName] = {
          count: 0, totalScore: 0, averageScore: 0
        };
      }
      aggregations.byNetwork[viewability.networkName].count += 1;
      aggregations.byNetwork[viewability.networkName].totalScore += viewability.viewabilityScore;

      // By country
      const country = viewability.country || 'unknown';
      if (!aggregations.byCountry[country]) {
        aggregations.byCountry[country] = {
          count: 0, totalScore: 0, averageScore: 0
        };
      }
      aggregations.byCountry[country].count += 1;
      aggregations.byCountry[country].totalScore += viewability.viewabilityScore;

      // By device
      const device = viewability.device || 'unknown';
      if (!aggregations.byDevice[device]) {
        aggregations.byDevice[device] = {
          count: 0, totalScore: 0, averageScore: 0
        };
      }
      aggregations.byDevice[device].count += 1;
      aggregations.byDevice[device].totalScore += viewability.viewabilityScore;
    });

    // Calculate averages
    if (viewabilities.length > 0) {
      aggregations.averageScore = totalScore / viewabilities.length;
      aggregations.averageTimeInView = totalTimeInView / viewabilities.length;
      aggregations.averagePercentageVisible = totalPercentageVisible / viewabilities.length;

      // Calculate network averages
      for (const network of Object.values(aggregations.byNetwork)) {
        network.averageScore = network.totalScore / network.count;
      }

      // Calculate country averages
      for (const country of Object.values(aggregations.byCountry)) {
        country.averageScore = country.totalScore / country.count;
      }

      // Calculate device averages
      for (const device of Object.values(aggregations.byDevice)) {
        device.averageScore = device.totalScore / device.count;
      }
    }

    await this.redis.setex(dailyKey, 86400 * 90, JSON.stringify(aggregations));
  }

  async processErrorGroup(date, errors) {
    const dailyKey = `daily:errors:${date}`;

    const aggregations = {
      total: errors.length,
      byType: {},
      byNetwork: {},
      bySeverity: {},
      byDevice: {},
      topErrors: []
    };

    const errorCounts = {};

    errors.forEach(error => {
      // By type
      aggregations.byType[error.errorType] =
        (aggregations.byType[error.errorType] || 0) + 1;

      // By network
      aggregations.byNetwork[error.networkName] =
        (aggregations.byNetwork[error.networkName] || 0) + 1;

      // By severity
      aggregations.bySeverity[error.severity] =
        (aggregations.bySeverity[error.severity] || 0) + 1;

      // By device
      const device = error.device || 'unknown';
      aggregations.byDevice[device] =
        (aggregations.byDevice[device] || 0) + 1;

      // Track specific error messages
      const errorKey = `${error.errorType}:${error.errorMessage}`;
      errorCounts[errorKey] = (errorCounts[errorKey] || 0) + 1;
    });

    // Get top errors
    aggregations.topErrors = Object.entries(errorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([error, count]) => ({ error, count }));

    await this.redis.setex(dailyKey, 86400 * 90, JSON.stringify(aggregations));

    // Alert on high error rates
    if (errors.length > 100) {
      console.warn(`High error rate detected: ${errors.length} errors on ${date}`);
    }
  }

  async processErrorEvent(errorEvent) {
    // Immediate processing for errors
    const errorKey = `error:${errorEvent.id}`;
    await this.redis.setex(errorKey, 86400, JSON.stringify(errorEvent));

    // Alert on critical errors
    if (errorEvent.severity === 'critical') {
      console.error(`Critical ad error: ${errorEvent.errorMessage} in ${errorEvent.placementId}`);
    }
  }

  async storeRawEvents(events) {
    // Store raw events for detailed analysis
    const pipeline = this.redis.pipeline();

    events.forEach(event => {
      const key = `raw_events:${event.date}`;
      pipeline.lpush(key, JSON.stringify(event));
      pipeline.expire(key, 86400 * config.analytics.metricsRetentionDays);
    });

    await pipeline.exec();
  }

  async getAnalyticsReport(timeRange = '24h', filters = {}) {
    const report = {
      timeRange,
      filters,
      summary: {
        impressions: 0,
        clicks: 0,
        revenue: 0,
        ctr: 0,
        rpm: 0,
        averageViewability: 0,
        errors: 0
      },
      trends: {
        hourly: {},
        daily: {}
      },
      breakdowns: {
        networks: {},
        countries: {},
        devices: {},
        calculatorTypes: {}
      },
      topPerformers: {
        networks: [],
        countries: [],
        placements: []
      },
      insights: []
    };

    try {
      const dates = this.getDateRange(timeRange);

      // Aggregate data from all dates
      for (const date of dates) {
        await this.aggregateDataForDate(date, report, filters);
      }

      // Calculate derived metrics
      this.calculateDerivedMetrics(report);

      // Generate insights
      report.insights = this.generateInsights(report);

    } catch (error) {
      console.error('Error generating analytics report:', error);
    }

    return report;
  }

  async aggregateDataForDate(date, report, filters) {
    // Get daily aggregations
    const impressions = await this.getDailyData('impressions', date);
    const clicks = await this.getDailyData('clicks', date);
    const revenue = await this.getDailyData('revenue', date);
    const viewability = await this.getDailyData('viewability', date);
    const errors = await this.getDailyData('errors', date);

    // Apply filters and aggregate
    if (impressions) {
      report.summary.impressions += this.applyFilters(impressions.total, filters);
      this.aggregateBreakdowns(report.breakdowns, impressions, filters);
    }

    if (clicks) {
      report.summary.clicks += this.applyFilters(clicks.total, filters);
    }

    if (revenue) {
      report.summary.revenue += this.applyFilters(revenue.total, filters);
    }

    if (viewability) {
      // Weighted average for viewability
      const count = viewability.count || 0;
      if (count > 0) {
        report.summary.averageViewability =
          (report.summary.averageViewability + (viewability.averageScore * count)) / (count + 1);
      }
    }

    if (errors) {
      report.summary.errors += this.applyFilters(errors.total, filters);
    }
  }

  async getDailyData(type, date) {
    const key = `daily:${type}:${date}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  applyFilters(value, filters) {
    // Apply filters if any (network, country, device, etc.)
    // For now, just return the value
    return value;
  }

  aggregateBreakdowns(breakdowns, data, filters) {
    // Aggregate breakdown data
    for (const [network, count] of Object.entries(data.byNetwork || {})) {
      breakdowns.networks[network] = (breakdowns.networks[network] || 0) + count;
    }

    for (const [country, count] of Object.entries(data.byCountry || {})) {
      breakdowns.countries[country] = (breakdowns.countries[country] || 0) + count;
    }

    for (const [device, count] of Object.entries(data.byDevice || {})) {
      breakdowns.devices[device] = (breakdowns.devices[device] || 0) + count;
    }

    for (const [calcType, count] of Object.entries(data.byCalculatorType || {})) {
      breakdowns.calculatorTypes[calcType] = (breakdowns.calculatorTypes[calcType] || 0) + count;
    }
  }

  calculateDerivedMetrics(report) {
    const summary = report.summary;

    // CTR (Click-Through Rate)
    summary.ctr = summary.impressions > 0 ? (summary.clicks / summary.impressions) * 100 : 0;

    // RPM (Revenue Per Mille)
    summary.rpm = summary.impressions > 0 ? (summary.revenue / summary.impressions) * 1000 : 0;

    // Sort breakdowns
    report.breakdowns.networks = this.sortObject(report.breakdowns.networks);
    report.breakdowns.countries = this.sortObject(report.breakdowns.countries);
    report.breakdowns.devices = this.sortObject(report.breakdowns.devices);

    // Top performers
    report.topPerformers.networks = Object.entries(report.breakdowns.networks)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));

    report.topPerformers.countries = Object.entries(report.breakdowns.countries)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));
  }

  sortObject(obj) {
    return Object.fromEntries(
      Object.entries(obj).sort(([,a], [,b]) => b - a)
    );
  }

  generateInsights(report) {
    const insights = [];
    const summary = report.summary;

    // CTR insights
    if (summary.ctr < 0.5) {
      insights.push({
        type: 'performance',
        severity: 'warning',
        message: `Low click-through rate (${summary.ctr.toFixed(2)}%). Consider optimizing ad placements or creative formats.`
      });
    } else if (summary.ctr > 2.0) {
      insights.push({
        type: 'performance',
        severity: 'positive',
        message: `Excellent click-through rate (${summary.ctr.toFixed(2)}%)! Current strategy is working well.`
      });
    }

    // RPM insights
    if (summary.rpm < 1.0) {
      insights.push({
        type: 'revenue',
        severity: 'warning',
        message: `Low revenue per mille ($${summary.rpm.toFixed(2)}). Consider enabling premium networks or optimizing targeting.`
      });
    }

    // Viewability insights
    if (summary.averageViewability < 0.5) {
      insights.push({
        type: 'viewability',
        severity: 'warning',
        message: `Low viewability score (${(summary.averageViewability * 100).toFixed(1)}%). Review ad placements and implement lazy loading.`
      });
    }

    // Error rate insights
    const errorRate = summary.impressions > 0 ? (summary.errors / summary.impressions) * 100 : 0;
    if (errorRate > 1.0) {
      insights.push({
        type: 'reliability',
        severity: 'error',
        message: `High error rate (${errorRate.toFixed(2)}%). Check ad network integrations and fallback mechanisms.`
      });
    }

    // Top performer insights
    const topNetwork = report.topPerformers.networks[0];
    if (topNetwork) {
      insights.push({
        type: 'optimization',
        severity: 'info',
        message: `${topNetwork.name} is your top performing network with ${topNetwork.value} impressions.`
      });
    }

    return insights;
  }

  getDateRange(timeRange) {
    const dates = [];
    const endDate = new Date();
    const startDate = new Date();

    switch (timeRange) {
      case '1h':
        // For hourly, just return today
        dates.push(endDate.toISOString().split('T')[0]);
        break;
      case '24h':
        dates.push(endDate.toISOString().split('T')[0]);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      default:
        dates.push(endDate.toISOString().split('T')[0]);
        return dates;
    }

    // Generate date range for multi-day reports
    if (timeRange === '7d' || timeRange === '30d') {
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        dates.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    return dates;
  }

  anonymizeIP(ip) {
    if (!ip) return null;

    // Remove last octet for IPv4, last 64 bits for IPv6
    if (ip.includes('.')) {
      return ip.split('.').slice(0, 3).join('.') + '.0';
    } else if (ip.includes(':')) {
      return ip.split(':').slice(0, 4).join(':') + '::';
    }

    return ip;
  }

  async getAdBlockerReport() {
    const globalCount = await this.redis.get('adblocker:global:count') || 0;
    const keys = await this.redis.keys('adblocker:*');

    const detections = [];
    for (const key of keys) {
      if (key === 'adblocker:global:count') continue;

      const data = await this.redis.get(key);
      if (data) {
        detections.push(JSON.parse(data));
      }
    }

    return {
      totalDetections: parseInt(globalCount),
      uniqueUsers: detections.length,
      detectionRate: detections.length > 0 ?
        (parseInt(globalCount) / detections.length).toFixed(2) : 0,
      topUserAgents: this.getTopUserAgents(detections)
    };
  }

  getTopUserAgents(detections) {
    const userAgents = {};

    detections.forEach(detection => {
      const ua = detection.userAgent;
      userAgents[ua] = (userAgents[ua] || 0) + detection.count;
    });

    return Object.entries(userAgents)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([userAgent, count]) => ({ userAgent, count }));
  }

  async startRealtimeMetrics() {
    // Update calculated metrics every 5 minutes
    setInterval(async () => {
      await this.updateCalculatedMetrics();
    }, 5 * 60 * 1000);
  }

  async updateCalculatedMetrics() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const hour = new Date().getHours();

      // Get real-time data
      const realtimeKey = `realtime:${today}:${hour}`;
      const metrics = await this.redis.hgetall(realtimeKey);

      if (Object.keys(metrics).length > 0) {
        const impressions = parseInt(metrics.impression_count || 0);
        const clicks = parseInt(metrics.click_count || 0);
        const revenue = parseFloat(metrics.revenue_total || 0);

        // Calculate CTR
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

        // Calculate RPM
        const rpm = impressions > 0 ? (revenue / impressions) * 1000 : 0;

        // Update calculated metrics
        await this.redis.hset(realtimeKey, {
          ctr: ctr.toFixed(4),
          rpm: rpm.toFixed(4)
        });
      }
    } catch (error) {
      console.error('Error updating calculated metrics:', error);
    }
  }

  async initializeMetricsTracking() {
    // Initialize tracking for current hour if not exists
    const today = new Date().toISOString().split('T')[0];
    const hour = new Date().getHours();
    const realtimeKey = `realtime:${today}:${hour}`;

    const exists = await this.redis.exists(realtimeKey);
    if (!exists) {
      await this.redis.hset(realtimeKey, {
        impression_count: 0,
        click_count: 0,
        revenue_total: 0,
        ctr: 0,
        rpm: 0
      });
      await this.redis.expire(realtimeKey, 86400);
    }
  }

  async healthCheck() {
    try {
      await this.redis.ping();

      const queueWaiting = await this.analyticsQueue.waiting();
      const queueActive = await this.analyticsQueue.active();
      const bufferSize = this.eventBuffer.length;

      return {
        status: 'healthy',
        eventBufferSize: bufferSize,
        queueWaiting: queueWaiting,
        queueActive: queueActive,
        analyticsEnabled: config.analytics.enabled
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

module.exports = new AnalyticsService();