/**
 * Analytics API Endpoint for GlobalTaxCalc PWA
 *
 * Handles analytics events from the PWA, stores them securely,
 * and provides aggregated insights.
 */

import { createHash } from 'crypto';

// In-memory storage for demo (use database in production)
const analyticsEvents = new Map();
const aggregatedMetrics = new Map();
const performanceAlerts = [];

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    switch (req.method) {
      case 'POST':
        return await handleAnalyticsEvent(req, res);
      case 'GET':
        return await handleAnalyticsQuery(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Analytics API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleAnalyticsEvent(req, res) {
  const event = req.body;

  // Validate event structure
  if (!event || !event.name || !event.properties) {
    return res.status(400).json({ error: 'Invalid event structure' });
  }

  // Sanitize and process event
  const processedEvent = await processAnalyticsEvent(event);

  // Store event
  const eventId = generateEventId(processedEvent);
  analyticsEvents.set(eventId, processedEvent);

  // Update aggregated metrics
  updateAggregatedMetrics(processedEvent);

  // Check for performance alerts
  checkPerformanceAlerts(processedEvent);

  // Clean up old events (keep last 10000)
  if (analyticsEvents.size > 10000) {
    const oldestKeys = Array.from(analyticsEvents.keys()).slice(0, 1000);
    oldestKeys.forEach(key => analyticsEvents.delete(key));
  }

  res.status(200).json({
    success: true,
    eventId,
    timestamp: processedEvent.timestamp
  });
}

async function handleAnalyticsQuery(req, res) {
  const { type, startDate, endDate, metric, platform } = req.query;

  try {
    let result;

    switch (type) {
      case 'summary':
        result = getAnalyticsSummary(startDate, endDate);
        break;
      case 'performance':
        result = getPerformanceMetrics(startDate, endDate);
        break;
      case 'usage':
        result = getUsageMetrics(startDate, endDate, platform);
        break;
      case 'conversions':
        result = getConversionMetrics(startDate, endDate);
        break;
      case 'alerts':
        result = getPerformanceAlerts();
        break;
      case 'realtime':
        result = getRealtimeMetrics();
        break;
      default:
        return res.status(400).json({ error: 'Invalid query type' });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Analytics query error:', error);
    res.status(500).json({ error: 'Failed to retrieve analytics data' });
  }
}

function processAnalyticsEvent(event) {
  const processed = {
    id: generateEventId(event),
    name: sanitizeString(event.name),
    timestamp: event.properties.timestamp || Date.now(),
    properties: {
      ...sanitizeProperties(event.properties),
      serverTimestamp: Date.now(),
      ipHash: hashIP(getClientIP(event.req)),
      userAgentHash: hashUserAgent(event.properties.userAgent)
    }
  };

  // Add derived properties
  processed.properties.date = new Date(processed.timestamp).toISOString().split('T')[0];
  processed.properties.hour = new Date(processed.timestamp).getHours();
  processed.properties.dayOfWeek = new Date(processed.timestamp).getDay();

  return processed;
}

function sanitizeString(str) {
  if (typeof str !== 'string') return 'unknown';
  return str.replace(/[<>'"&]/g, '').substring(0, 100);
}

function sanitizeProperties(properties) {
  const sanitized = {};

  const allowedProperties = [
    'sessionId', 'userId', 'platform', 'installed', 'timestamp', 'url',
    'page', 'calculator', 'duration', 'online', 'metric_name', 'metric_value',
    'rating', 'type', 'button', 'field', 'format', 'method', 'result'
  ];

  allowedProperties.forEach(prop => {
    if (properties[prop] !== undefined) {
      if (typeof properties[prop] === 'string') {
        sanitized[prop] = sanitizeString(properties[prop]);
      } else if (typeof properties[prop] === 'number') {
        sanitized[prop] = Number.isFinite(properties[prop]) ? properties[prop] : 0;
      } else if (typeof properties[prop] === 'boolean') {
        sanitized[prop] = properties[prop];
      }
    }
  });

  return sanitized;
}

function generateEventId(event) {
  const data = `${event.name}_${event.properties.sessionId}_${event.properties.timestamp}`;
  return createHash('sha256').update(data).digest('hex').substring(0, 16);
}

function hashIP(ip) {
  if (!ip) return 'unknown';
  return createHash('sha256').update(ip + process.env.ANALYTICS_SALT || 'default_salt').digest('hex').substring(0, 8);
}

function hashUserAgent(userAgent) {
  if (!userAgent) return 'unknown';
  return createHash('sha256').update(userAgent + process.env.ANALYTICS_SALT || 'default_salt').digest('hex').substring(0, 8);
}

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         'unknown';
}

function updateAggregatedMetrics(event) {
  const { name, properties } = event;
  const date = properties.date;
  const platform = properties.platform || 'unknown';

  // Update daily metrics
  const dailyKey = `daily_${date}`;
  if (!aggregatedMetrics.has(dailyKey)) {
    aggregatedMetrics.set(dailyKey, {
      date,
      events: {},
      platforms: {},
      calculators: {},
      performance: {},
      users: new Set(),
      sessions: new Set()
    });
  }

  const daily = aggregatedMetrics.get(dailyKey);

  // Count events
  daily.events[name] = (daily.events[name] || 0) + 1;

  // Count platforms
  daily.platforms[platform] = (daily.platforms[platform] || 0) + 1;

  // Count calculators
  if (properties.calculator) {
    daily.calculators[properties.calculator] = (daily.calculators[properties.calculator] || 0) + 1;
  }

  // Track performance metrics
  if (name === 'web_vital') {
    const metricName = properties.metric_name;
    if (!daily.performance[metricName]) {
      daily.performance[metricName] = {
        values: [],
        good: 0,
        needsImprovement: 0,
        poor: 0
      };
    }

    daily.performance[metricName].values.push(properties.metric_value);
    daily.performance[metricName][properties.rating]++;
  }

  // Track unique users and sessions
  if (properties.userId) {
    daily.users.add(properties.userId);
  }
  if (properties.sessionId) {
    daily.sessions.add(properties.sessionId);
  }

  // Update platform-specific metrics
  const platformKey = `platform_${platform}_${date}`;
  if (!aggregatedMetrics.has(platformKey)) {
    aggregatedMetrics.set(platformKey, {
      platform,
      date,
      events: {},
      features: {},
      conversions: 0
    });
  }

  const platformMetrics = aggregatedMetrics.get(platformKey);
  platformMetrics.events[name] = (platformMetrics.events[name] || 0) + 1;

  // Track feature usage
  if (name.includes('calculator_') || name.includes('export_') || name.includes('share_')) {
    platformMetrics.features[name] = (platformMetrics.features[name] || 0) + 1;
  }

  // Track conversions
  if (name.includes('conversion_') || name === 'calculation_completed') {
    platformMetrics.conversions++;
  }
}

function checkPerformanceAlerts(event) {
  const { name, properties } = event;

  // Check for performance issues
  if (name === 'web_vital' && properties.rating === 'poor') {
    performanceAlerts.push({
      type: 'poor_performance',
      metric: properties.metric_name,
      value: properties.metric_value,
      page: properties.page,
      platform: properties.platform,
      timestamp: properties.timestamp,
      severity: 'high'
    });
  }

  if (name === 'performance_alert') {
    performanceAlerts.push({
      type: properties.type,
      details: properties,
      timestamp: properties.timestamp,
      severity: properties.type === 'high_memory_usage' ? 'medium' : 'low'
    });
  }

  // Check for usage anomalies
  const hourlyEvents = Array.from(analyticsEvents.values())
    .filter(e => e.timestamp > Date.now() - 3600000) // Last hour
    .length;

  if (hourlyEvents > 10000) { // Unusual spike
    performanceAlerts.push({
      type: 'traffic_spike',
      value: hourlyEvents,
      timestamp: Date.now(),
      severity: 'medium'
    });
  }

  // Keep only last 100 alerts
  if (performanceAlerts.length > 100) {
    performanceAlerts.splice(0, performanceAlerts.length - 100);
  }
}

function getAnalyticsSummary(startDate, endDate) {
  const start = startDate ? new Date(startDate).getTime() : Date.now() - 7 * 24 * 60 * 60 * 1000;
  const end = endDate ? new Date(endDate).getTime() : Date.now();

  const events = Array.from(analyticsEvents.values())
    .filter(event => event.timestamp >= start && event.timestamp <= end);

  const totalEvents = events.length;
  const uniqueUsers = new Set(events.map(e => e.properties.userId)).size;
  const uniqueSessions = new Set(events.map(e => e.properties.sessionId)).size;

  const platforms = {};
  const calculators = {};
  const topEvents = {};

  events.forEach(event => {
    const platform = event.properties.platform || 'unknown';
    platforms[platform] = (platforms[platform] || 0) + 1;

    if (event.properties.calculator) {
      calculators[event.properties.calculator] = (calculators[event.properties.calculator] || 0) + 1;
    }

    topEvents[event.name] = (topEvents[event.name] || 0) + 1;
  });

  return {
    summary: {
      totalEvents,
      uniqueUsers,
      uniqueSessions,
      avgEventsPerSession: uniqueSessions > 0 ? totalEvents / uniqueSessions : 0,
      period: { start: new Date(start).toISOString(), end: new Date(end).toISOString() }
    },
    platforms: Object.entries(platforms)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([platform, count]) => ({ platform, count, percentage: (count / totalEvents * 100).toFixed(1) })),
    calculators: Object.entries(calculators)
      .sort(([,a], [,b]) => b - a)
      .map(([calculator, count]) => ({ calculator, count, percentage: (count / totalEvents * 100).toFixed(1) })),
    topEvents: Object.entries(topEvents)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([event, count]) => ({ event, count, percentage: (count / totalEvents * 100).toFixed(1) }))
  };
}

function getPerformanceMetrics(startDate, endDate) {
  const start = startDate ? new Date(startDate).getTime() : Date.now() - 24 * 60 * 60 * 1000;
  const end = endDate ? new Date(endDate).getTime() : Date.now();

  const performanceEvents = Array.from(analyticsEvents.values())
    .filter(event =>
      event.timestamp >= start &&
      event.timestamp <= end &&
      (event.name === 'web_vital' || event.name === 'page_load' || event.name === 'memory_usage')
    );

  const webVitals = {};
  const pageLoads = [];
  const memoryUsage = [];

  performanceEvents.forEach(event => {
    if (event.name === 'web_vital') {
      const metric = event.properties.metric_name;
      if (!webVitals[metric]) {
        webVitals[metric] = { values: [], ratings: { good: 0, 'needs-improvement': 0, poor: 0 } };
      }
      webVitals[metric].values.push(event.properties.metric_value);
      webVitals[metric].ratings[event.properties.rating]++;
    } else if (event.name === 'page_load') {
      pageLoads.push({
        duration: event.properties.loadComplete,
        page: event.properties.page,
        timestamp: event.timestamp
      });
    } else if (event.name === 'memory_usage') {
      memoryUsage.push({
        used: event.properties.usedJSHeapSize,
        total: event.properties.totalJSHeapSize,
        ratio: event.properties.usageRatio,
        timestamp: event.timestamp
      });
    }
  });

  // Calculate statistics for web vitals
  const vitalStats = {};
  Object.entries(webVitals).forEach(([metric, data]) => {
    const values = data.values.sort((a, b) => a - b);
    const total = data.ratings.good + data.ratings['needs-improvement'] + data.ratings.poor;

    vitalStats[metric] = {
      count: values.length,
      min: values[0] || 0,
      max: values[values.length - 1] || 0,
      median: values[Math.floor(values.length / 2)] || 0,
      p75: values[Math.floor(values.length * 0.75)] || 0,
      p95: values[Math.floor(values.length * 0.95)] || 0,
      ratings: {
        good: total > 0 ? ((data.ratings.good / total) * 100).toFixed(1) : 0,
        needsImprovement: total > 0 ? ((data.ratings['needs-improvement'] / total) * 100).toFixed(1) : 0,
        poor: total > 0 ? ((data.ratings.poor / total) * 100).toFixed(1) : 0
      }
    };
  });

  return {
    webVitals: vitalStats,
    pageLoad: {
      count: pageLoads.length,
      averageDuration: pageLoads.length > 0 ? pageLoads.reduce((sum, p) => sum + p.duration, 0) / pageLoads.length : 0,
      slowestPages: pageLoads
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5)
        .map(p => ({ page: p.page, duration: p.duration }))
    },
    memory: {
      count: memoryUsage.length,
      averageUsage: memoryUsage.length > 0 ? memoryUsage.reduce((sum, m) => sum + m.ratio, 0) / memoryUsage.length : 0,
      maxUsage: memoryUsage.length > 0 ? Math.max(...memoryUsage.map(m => m.ratio)) : 0,
      alerts: memoryUsage.filter(m => m.ratio > 0.8).length
    }
  };
}

function getUsageMetrics(startDate, endDate, platform) {
  const start = startDate ? new Date(startDate).getTime() : Date.now() - 7 * 24 * 60 * 60 * 1000;
  const end = endDate ? new Date(endDate).getTime() : Date.now();

  let events = Array.from(analyticsEvents.values())
    .filter(event => event.timestamp >= start && event.timestamp <= end);

  if (platform && platform !== 'all') {
    events = events.filter(event => event.properties.platform === platform);
  }

  const calculatorUsage = {};
  const featureUsage = {};
  const dailyActivity = {};

  events.forEach(event => {
    const date = event.properties.date;

    // Track daily activity
    if (!dailyActivity[date]) {
      dailyActivity[date] = { events: 0, users: new Set(), sessions: new Set() };
    }
    dailyActivity[date].events++;
    if (event.properties.userId) dailyActivity[date].users.add(event.properties.userId);
    if (event.properties.sessionId) dailyActivity[date].sessions.add(event.properties.sessionId);

    // Track calculator usage
    if (event.properties.calculator) {
      calculatorUsage[event.properties.calculator] = (calculatorUsage[event.properties.calculator] || 0) + 1;
    }

    // Track feature usage
    if (event.name.includes('_used') || event.name.includes('first_')) {
      featureUsage[event.name] = (featureUsage[event.name] || 0) + 1;
    }
  });

  // Convert daily activity to array format
  const dailyStats = Object.entries(dailyActivity).map(([date, stats]) => ({
    date,
    events: stats.events,
    users: stats.users.size,
    sessions: stats.sessions.size
  })).sort((a, b) => a.date.localeCompare(b.date));

  return {
    overview: {
      totalEvents: events.length,
      uniqueUsers: new Set(events.map(e => e.properties.userId)).size,
      uniqueSessions: new Set(events.map(e => e.properties.sessionId)).size,
      platform: platform || 'all'
    },
    calculators: Object.entries(calculatorUsage)
      .sort(([,a], [,b]) => b - a)
      .map(([calc, count]) => ({ calculator: calc, usage: count })),
    features: Object.entries(featureUsage)
      .sort(([,a], [,b]) => b - a)
      .map(([feature, count]) => ({ feature, usage: count })),
    daily: dailyStats
  };
}

function getConversionMetrics(startDate, endDate) {
  const start = startDate ? new Date(startDate).getTime() : Date.now() - 7 * 24 * 60 * 60 * 1000;
  const end = endDate ? new Date(endDate).getTime() : Date.now();

  const events = Array.from(analyticsEvents.values())
    .filter(event => event.timestamp >= start && event.timestamp <= end);

  const conversions = {
    app_install: 0,
    calculation_completed: 0,
    notification_permission: 0,
    first_export: 0,
    first_share: 0,
    first_save: 0
  };

  const funnelSteps = {
    page_view: 0,
    calculator_used: 0,
    calculation_completed: 0,
    export_used: 0
  };

  events.forEach(event => {
    if (event.name === 'conversion_app_install') conversions.app_install++;
    if (event.name === 'calculation_completed') conversions.calculation_completed++;
    if (event.name === 'conversion_notification_permission') conversions.notification_permission++;
    if (event.name === 'first_export') conversions.first_export++;
    if (event.name === 'first_share') conversions.first_share++;
    if (event.name === 'first_save') conversions.first_save++;

    // Funnel tracking
    if (event.name === 'page_view') funnelSteps.page_view++;
    if (event.name === 'calculator_used') funnelSteps.calculator_used++;
    if (event.name === 'calculation_completed') funnelSteps.calculation_completed++;
    if (event.name === 'export_used') funnelSteps.export_used++;
  });

  // Calculate conversion rates
  const conversionRates = {
    view_to_use: funnelSteps.page_view > 0 ? (funnelSteps.calculator_used / funnelSteps.page_view * 100).toFixed(2) : 0,
    use_to_complete: funnelSteps.calculator_used > 0 ? (funnelSteps.calculation_completed / funnelSteps.calculator_used * 100).toFixed(2) : 0,
    complete_to_export: funnelSteps.calculation_completed > 0 ? (funnelSteps.export_used / funnelSteps.calculation_completed * 100).toFixed(2) : 0
  };

  return {
    conversions,
    funnel: funnelSteps,
    conversionRates,
    totalConversions: Object.values(conversions).reduce((sum, count) => sum + count, 0)
  };
}

function getPerformanceAlerts() {
  return {
    alerts: performanceAlerts.slice(-50), // Last 50 alerts
    summary: {
      total: performanceAlerts.length,
      high: performanceAlerts.filter(a => a.severity === 'high').length,
      medium: performanceAlerts.filter(a => a.severity === 'medium').length,
      low: performanceAlerts.filter(a => a.severity === 'low').length
    }
  };
}

function getRealtimeMetrics() {
  const now = Date.now();
  const lastHour = now - 60 * 60 * 1000;
  const last24Hours = now - 24 * 60 * 60 * 1000;

  const recentEvents = Array.from(analyticsEvents.values())
    .filter(event => event.timestamp >= lastHour);

  const dailyEvents = Array.from(analyticsEvents.values())
    .filter(event => event.timestamp >= last24Hours);

  const activeUsers = new Set(
    recentEvents
      .filter(event => event.timestamp >= now - 5 * 60 * 1000) // Last 5 minutes
      .map(event => event.properties.userId)
  ).size;

  return {
    current: {
      activeUsers,
      eventsLastHour: recentEvents.length,
      eventsLast24Hours: dailyEvents.length,
      timestamp: now
    },
    recent: {
      topPages: getTopPages(recentEvents),
      topCalculators: getTopCalculators(recentEvents),
      platforms: getPlatformBreakdown(recentEvents)
    }
  };
}

function getTopPages(events) {
  const pages = {};
  events.forEach(event => {
    if (event.properties.page) {
      pages[event.properties.page] = (pages[event.properties.page] || 0) + 1;
    }
  });

  return Object.entries(pages)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([page, count]) => ({ page, views: count }));
}

function getTopCalculators(events) {
  const calculators = {};
  events.forEach(event => {
    if (event.properties.calculator) {
      calculators[event.properties.calculator] = (calculators[event.properties.calculator] || 0) + 1;
    }
  });

  return Object.entries(calculators)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([calculator, count]) => ({ calculator, usage: count }));
}

function getPlatformBreakdown(events) {
  const platforms = {};
  events.forEach(event => {
    const platform = event.properties.platform || 'unknown';
    platforms[platform] = (platforms[platform] || 0) + 1;
  });

  return Object.entries(platforms).map(([platform, count]) => ({ platform, count }));
}