const clickhouse = require('../utils/clickhouse');
const redis = require('../utils/redis');
const sessionManager = require('./sessionManager');
const config = require('../config');
const logger = require('../utils/logger');

class DashboardService {
  constructor() {
    this.refreshInterval = 60000; // 1 minute
    this.cachedData = new Map();
    this.startRealTimeUpdates();
  }

  // Get real-time dashboard data
  async getRealTimeDashboard() {
    const cacheKey = 'dashboard:realtime';
    let dashboardData = await redis.getCache(cacheKey);

    if (!dashboardData) {
      dashboardData = await this.generateRealTimeDashboard();
      await redis.setCache(cacheKey, dashboardData, 60); // Cache for 1 minute
    }

    return dashboardData;
  }

  // Generate real-time dashboard data
  async generateRealTimeDashboard() {
    const dashboard = {
      timestamp: new Date().toISOString(),
      real_time: await this.getRealTimeMetrics(),
      popular_content: await this.getPopularContent(),
      traffic_sources: await this.getTrafficSources(),
      geographic_data: await this.getGeographicData(),
      device_breakdown: await this.getDeviceBreakdown(),
      conversion_metrics: await this.getConversionMetrics(),
      error_rates: await this.getErrorRates(),
      performance_metrics: await this.getPerformanceMetrics()
    };

    return dashboard;
  }

  // Get real-time metrics (last hour)
  async getRealTimeMetrics() {
    try {
      const realTimeQuery = `
        SELECT
          count() as total_events,
          uniq(session_id) as active_sessions,
          uniq(user_id) as active_users,
          countIf(event_type = 'page_view') as page_views,
          countIf(event_type = 'calculator_start') as calculator_starts,
          countIf(event_type = 'calculator_complete') as calculator_completes,
          countIf(event_type = 'conversion') as conversions,
          countIf(event_type = 'error') as errors
        FROM events
        WHERE timestamp >= now() - INTERVAL 1 HOUR
      `;

      const results = await clickhouse.query(realTimeQuery);
      const metrics = results[0] || {};

      // Get active sessions from memory
      const activeSessionsMemory = sessionManager.getActiveSessionsCount();

      // Get minute-by-minute breakdown for the last hour
      const timelineQuery = `
        SELECT
          toStartOfMinute(timestamp) as minute,
          count() as events,
          uniq(session_id) as sessions,
          uniq(user_id) as users
        FROM events
        WHERE timestamp >= now() - INTERVAL 1 HOUR
        GROUP BY minute
        ORDER BY minute
      `;

      const timeline = await clickhouse.query(timelineQuery);

      return {
        ...metrics,
        active_sessions_memory: activeSessionsMemory,
        timeline,
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting real-time metrics:', error);
      return {};
    }
  }

  // Get popular content (last 24 hours)
  async getPopularContent(limit = 10) {
    try {
      const query = `
        SELECT
          page_url,
          count() as views,
          uniq(session_id) as unique_sessions,
          uniq(user_id) as unique_users,
          avg(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) as avg_time_on_page
        FROM events
        WHERE timestamp >= now() - INTERVAL 24 HOUR
          AND event_type = 'page_view'
          AND page_url != ''
        GROUP BY page_url
        ORDER BY views DESC
        LIMIT ${limit}
      `;

      return await clickhouse.query(query);
    } catch (error) {
      logger.error('Error getting popular content:', error);
      return [];
    }
  }

  // Get traffic sources breakdown
  async getTrafficSources() {
    try {
      const query = `
        SELECT
          s.traffic_source,
          s.medium,
          s.campaign,
          count(DISTINCT s.session_id) as sessions,
          count(DISTINCT s.user_id) as users,
          countIf(s.conversion = 1) as conversions,
          sum(s.conversion_value) as total_value
        FROM sessions s
        WHERE s.start_time >= now() - INTERVAL 24 HOUR
        GROUP BY s.traffic_source, s.medium, s.campaign
        ORDER BY sessions DESC
        LIMIT 20
      `;

      const results = await clickhouse.query(query);

      // Calculate conversion rates
      return results.map(row => ({
        ...row,
        conversion_rate: row.sessions > 0 ? (row.conversions / row.sessions) * 100 : 0,
        avg_value_per_session: row.sessions > 0 ? row.total_value / row.sessions : 0
      }));
    } catch (error) {
      logger.error('Error getting traffic sources:', error);
      return [];
    }
  }

  // Get geographic data
  async getGeographicData() {
    try {
      const countryQuery = `
        SELECT
          country,
          count(DISTINCT session_id) as sessions,
          count(DISTINCT user_id) as users,
          avg(duration) as avg_session_duration,
          countIf(conversion = 1) / count() as conversion_rate
        FROM sessions
        WHERE start_time >= now() - INTERVAL 24 HOUR
          AND country != 'Unknown'
        GROUP BY country
        ORDER BY sessions DESC
        LIMIT 20
      `;

      const countries = await clickhouse.query(countryQuery);

      const cityQuery = `
        SELECT
          country,
          city,
          count(DISTINCT session_id) as sessions
        FROM events
        WHERE timestamp >= now() - INTERVAL 24 HOUR
          AND city IS NOT NULL
          AND city != ''
        GROUP BY country, city
        ORDER BY sessions DESC
        LIMIT 50
      `;

      const cities = await clickhouse.query(cityQuery);

      return {
        countries,
        cities,
        total_countries: countries.length
      };
    } catch (error) {
      logger.error('Error getting geographic data:', error);
      return { countries: [], cities: [], total_countries: 0 };
    }
  }

  // Get device breakdown
  async getDeviceBreakdown() {
    try {
      const query = `
        SELECT
          device_type,
          browser,
          os,
          count(DISTINCT session_id) as sessions,
          avg(duration) as avg_session_duration,
          avg(page_views) as avg_page_views,
          countIf(bounce = 1) / count() as bounce_rate,
          countIf(conversion = 1) / count() as conversion_rate
        FROM sessions
        WHERE start_time >= now() - INTERVAL 24 HOUR
        GROUP BY device_type, browser, os
        ORDER BY sessions DESC
      `;

      const deviceData = await clickhouse.query(query);

      // Aggregate by device type
      const deviceSummary = deviceData.reduce((acc, row) => {
        if (!acc[row.device_type]) {
          acc[row.device_type] = {
            device_type: row.device_type,
            sessions: 0,
            avg_duration: 0,
            avg_page_views: 0,
            bounce_rate: 0,
            conversion_rate: 0,
            count: 0
          };
        }

        const summary = acc[row.device_type];
        summary.sessions += row.sessions;
        summary.avg_duration += row.avg_session_duration;
        summary.avg_page_views += row.avg_page_views;
        summary.bounce_rate += row.bounce_rate;
        summary.conversion_rate += row.conversion_rate;
        summary.count += 1;

        return acc;
      }, {});

      // Calculate averages
      Object.values(deviceSummary).forEach(summary => {
        summary.avg_duration = summary.avg_duration / summary.count;
        summary.avg_page_views = summary.avg_page_views / summary.count;
        summary.bounce_rate = summary.bounce_rate / summary.count;
        summary.conversion_rate = summary.conversion_rate / summary.count;
        delete summary.count;
      });

      return {
        detailed: deviceData,
        summary: Object.values(deviceSummary)
      };
    } catch (error) {
      logger.error('Error getting device breakdown:', error);
      return { detailed: [], summary: [] };
    }
  }

  // Get conversion metrics
  async getConversionMetrics() {
    try {
      const hourlyQuery = `
        SELECT
          toStartOfHour(timestamp) as hour,
          conversion_type,
          count() as conversions,
          sum(value) as total_value,
          uniq(session_id) as unique_sessions
        FROM conversions
        WHERE timestamp >= now() - INTERVAL 24 HOUR
        GROUP BY hour, conversion_type
        ORDER BY hour, conversions DESC
      `;

      const hourlyData = await clickhouse.query(hourlyQuery);

      const summaryQuery = `
        SELECT
          conversion_type,
          count() as total_conversions,
          sum(value) as total_value,
          avg(value) as avg_value,
          uniq(session_id) as unique_sessions,
          uniq(user_id) as unique_users
        FROM conversions
        WHERE timestamp >= now() - INTERVAL 24 HOUR
        GROUP BY conversion_type
        ORDER BY total_conversions DESC
      `;

      const summary = await clickhouse.query(summaryQuery);

      // Calculate conversion funnels for main calculators
      const funnelQuery = `
        SELECT
          calculator_type,
          countIf(event_type = 'calculator_start') as starts,
          countIf(event_type = 'calculator_complete') as completes,
          countIf(event_type = 'conversion') as conversions
        FROM events
        WHERE timestamp >= now() - INTERVAL 24 HOUR
          AND event_type IN ('calculator_start', 'calculator_complete', 'conversion')
          AND JSON_EXTRACT_STRING(properties, 'calculator_type') IS NOT NULL
        GROUP BY JSON_EXTRACT_STRING(properties, 'calculator_type') as calculator_type
        ORDER BY starts DESC
      `;

      const funnels = await clickhouse.query(funnelQuery);

      return {
        hourly: hourlyData,
        summary,
        funnels: funnels.map(row => ({
          ...row,
          completion_rate: row.starts > 0 ? (row.completes / row.starts) * 100 : 0,
          conversion_rate: row.completes > 0 ? (row.conversions / row.completes) * 100 : 0
        }))
      };
    } catch (error) {
      logger.error('Error getting conversion metrics:', error);
      return { hourly: [], summary: [], funnels: [] };
    }
  }

  // Get error rates
  async getErrorRates() {
    try {
      const query = `
        SELECT
          toStartOfHour(timestamp) as hour,
          JSON_EXTRACT_STRING(properties, 'error_type') as error_type,
          JSON_EXTRACT_STRING(properties, 'page_url') as page_url,
          count() as error_count,
          uniq(session_id) as affected_sessions
        FROM events
        WHERE timestamp >= now() - INTERVAL 24 HOUR
          AND event_type = 'error'
        GROUP BY hour, error_type, page_url
        ORDER BY hour DESC, error_count DESC
      `;

      const errorData = await clickhouse.query(query);

      const summaryQuery = `
        SELECT
          count() as total_errors,
          uniq(session_id) as affected_sessions,
          (SELECT count() FROM events WHERE timestamp >= now() - INTERVAL 24 HOUR) as total_events
        FROM events
        WHERE timestamp >= now() - INTERVAL 24 HOUR
          AND event_type = 'error'
      `;

      const summary = await clickhouse.query(summaryQuery);
      const errorRate = summary[0]?.total_events > 0
        ? (summary[0].total_errors / summary[0].total_events) * 100
        : 0;

      return {
        hourly: errorData,
        summary: {
          ...summary[0],
          error_rate: errorRate
        }
      };
    } catch (error) {
      logger.error('Error getting error rates:', error);
      return { hourly: [], summary: {} };
    }
  }

  // Get performance metrics
  async getPerformanceMetrics() {
    try {
      const query = `
        SELECT
          toStartOfHour(timestamp) as hour,
          avg(CAST(JSON_EXTRACT_STRING(properties, 'load_time'), 'Float64')) as avg_load_time,
          quantile(0.50)(CAST(JSON_EXTRACT_STRING(properties, 'load_time'), 'Float64')) as median_load_time,
          quantile(0.95)(CAST(JSON_EXTRACT_STRING(properties, 'load_time'), 'Float64')) as p95_load_time,
          avg(CAST(JSON_EXTRACT_STRING(properties, 'dom_ready'), 'Float64')) as avg_dom_ready,
          count() as performance_events
        FROM events
        WHERE timestamp >= now() - INTERVAL 24 HOUR
          AND event_type = 'performance'
          AND JSON_EXTRACT_STRING(properties, 'load_time') IS NOT NULL
        GROUP BY hour
        ORDER BY hour
      `;

      const performanceData = await clickhouse.query(query);

      // Get slow pages
      const slowPagesQuery = `
        SELECT
          page_url,
          avg(CAST(JSON_EXTRACT_STRING(properties, 'load_time'), 'Float64')) as avg_load_time,
          count() as page_views
        FROM events
        WHERE timestamp >= now() - INTERVAL 24 HOUR
          AND event_type = 'performance'
          AND JSON_EXTRACT_STRING(properties, 'load_time') IS NOT NULL
        GROUP BY page_url
        HAVING avg_load_time > 3000  -- Pages taking more than 3 seconds
        ORDER BY avg_load_time DESC
        LIMIT 10
      `;

      const slowPages = await clickhouse.query(slowPagesQuery);

      return {
        hourly: performanceData,
        slow_pages: slowPages
      };
    } catch (error) {
      logger.error('Error getting performance metrics:', error);
      return { hourly: [], slow_pages: [] };
    }
  }

  // Get historical dashboard data
  async getHistoricalDashboard(timeRange = '7d') {
    const cacheKey = `dashboard:historical:${timeRange}`;
    let dashboardData = await redis.getCache(cacheKey);

    if (!dashboardData) {
      dashboardData = await this.generateHistoricalDashboard(timeRange);
      const cacheTTL = this.getCacheTTL(timeRange);
      await redis.setCache(cacheKey, dashboardData, cacheTTL);
    }

    return dashboardData;
  }

  // Generate historical dashboard data
  async generateHistoricalDashboard(timeRange) {
    const timeCondition = this.getTimeCondition(timeRange);
    const groupBy = this.getGroupBy(timeRange);

    const dashboard = {
      time_range: timeRange,
      timestamp: new Date().toISOString(),
      summary: await this.getHistoricalSummary(timeCondition),
      timeline: await this.getHistoricalTimeline(timeCondition, groupBy),
      top_pages: await this.getTopPages(timeCondition),
      conversion_trends: await this.getConversionTrends(timeCondition, groupBy),
      user_engagement: await this.getUserEngagement(timeCondition),
      traffic_analysis: await this.getTrafficAnalysis(timeCondition)
    };

    return dashboard;
  }

  // Get A/B testing dashboard
  async getABTestingDashboard() {
    const cacheKey = 'dashboard:ab_testing';
    let dashboardData = await redis.getCache(cacheKey);

    if (!dashboardData) {
      dashboardData = await this.generateABTestingDashboard();
      await redis.setCache(cacheKey, dashboardData, 300); // Cache for 5 minutes
    }

    return dashboardData;
  }

  // Generate A/B testing dashboard
  async generateABTestingDashboard() {
    try {
      // Get active experiments
      const activeExperimentsQuery = `
        SELECT
          experiment_id,
          variant,
          count(DISTINCT user_id) as users,
          countIf(converted = 1) as conversions,
          sum(conversion_value) as total_value
        FROM experiments
        WHERE timestamp >= now() - INTERVAL 30 DAY
        GROUP BY experiment_id, variant
        ORDER BY experiment_id, users DESC
      `;

      const experimentData = await clickhouse.query(activeExperimentsQuery);

      // Group by experiment
      const experiments = experimentData.reduce((acc, row) => {
        if (!acc[row.experiment_id]) {
          acc[row.experiment_id] = {
            experiment_id: row.experiment_id,
            variants: []
          };
        }

        acc[row.experiment_id].variants.push({
          variant: row.variant,
          users: row.users,
          conversions: row.conversions,
          conversion_rate: row.users > 0 ? (row.conversions / row.users) * 100 : 0,
          total_value: row.total_value,
          avg_value_per_user: row.users > 0 ? row.total_value / row.users : 0
        });

        return acc;
      }, {});

      return {
        active_experiments: Object.values(experiments),
        total_experiments: Object.keys(experiments).length,
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting A/B testing dashboard:', error);
      return { active_experiments: [], total_experiments: 0 };
    }
  }

  // Start real-time updates
  startRealTimeUpdates() {
    setInterval(async () => {
      try {
        // Update real-time dashboard cache
        const realTimeData = await this.generateRealTimeDashboard();
        await redis.setCache('dashboard:realtime', realTimeData, 60);

        // Update active sessions counter
        await redis.setCache('dashboard:active_sessions', sessionManager.getActiveSessionsCount(), 60);

        logger.debug('Real-time dashboard data updated');
      } catch (error) {
        logger.error('Error updating real-time dashboard:', error);
      }
    }, this.refreshInterval);
  }

  // Utility functions
  getTimeCondition(timeRange) {
    const conditions = {
      '1h': 'timestamp >= now() - INTERVAL 1 HOUR',
      '24h': 'timestamp >= now() - INTERVAL 24 HOUR',
      '7d': 'timestamp >= now() - INTERVAL 7 DAY',
      '30d': 'timestamp >= now() - INTERVAL 30 DAY',
      '90d': 'timestamp >= now() - INTERVAL 90 DAY'
    };

    return conditions[timeRange] || conditions['7d'];
  }

  getGroupBy(timeRange) {
    const groupings = {
      '1h': 'toStartOfMinute(timestamp)',
      '24h': 'toStartOfHour(timestamp)',
      '7d': 'toStartOfDay(timestamp)',
      '30d': 'toStartOfDay(timestamp)',
      '90d': 'toStartOfWeek(timestamp)'
    };

    return groupings[timeRange] || 'toStartOfDay(timestamp)';
  }

  getCacheTTL(timeRange) {
    const ttls = {
      '1h': 60,     // 1 minute
      '24h': 300,   // 5 minutes
      '7d': 1800,   // 30 minutes
      '30d': 3600,  // 1 hour
      '90d': 7200   // 2 hours
    };

    return ttls[timeRange] || 1800;
  }

  async getHistoricalSummary(timeCondition) {
    try {
      const query = `
        SELECT
          count() as total_events,
          uniq(session_id) as total_sessions,
          uniq(user_id) as total_users,
          countIf(event_type = 'page_view') as page_views,
          countIf(event_type = 'conversion') as conversions,
          avg(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) as avg_page_views_per_session
        FROM events
        WHERE ${timeCondition}
      `;

      const result = await clickhouse.query(query);
      return result[0] || {};
    } catch (error) {
      logger.error('Error getting historical summary:', error);
      return {};
    }
  }

  async getHistoricalTimeline(timeCondition, groupBy) {
    try {
      const query = `
        SELECT
          ${groupBy} as period,
          count() as events,
          uniq(session_id) as sessions,
          uniq(user_id) as users,
          countIf(event_type = 'conversion') as conversions
        FROM events
        WHERE ${timeCondition}
        GROUP BY period
        ORDER BY period
      `;

      return await clickhouse.query(query);
    } catch (error) {
      logger.error('Error getting historical timeline:', error);
      return [];
    }
  }

  async getTopPages(timeCondition, limit = 20) {
    try {
      const query = `
        SELECT
          page_url,
          count() as views,
          uniq(session_id) as unique_sessions,
          avg(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) as avg_time_on_page
        FROM events
        WHERE ${timeCondition}
          AND event_type = 'page_view'
          AND page_url != ''
        GROUP BY page_url
        ORDER BY views DESC
        LIMIT ${limit}
      `;

      return await clickhouse.query(query);
    } catch (error) {
      logger.error('Error getting top pages:', error);
      return [];
    }
  }

  async getConversionTrends(timeCondition, groupBy) {
    try {
      const query = `
        SELECT
          ${groupBy} as period,
          conversion_type,
          count() as conversions,
          sum(value) as total_value
        FROM conversions
        WHERE ${timeCondition.replace('timestamp', 'timestamp')}
        GROUP BY period, conversion_type
        ORDER BY period, conversions DESC
      `;

      return await clickhouse.query(query);
    } catch (error) {
      logger.error('Error getting conversion trends:', error);
      return [];
    }
  }

  async getUserEngagement(timeCondition) {
    try {
      const query = `
        SELECT
          avg(duration) as avg_session_duration,
          avg(page_views) as avg_page_views,
          countIf(bounce = 1) / count() as bounce_rate,
          countIf(conversion = 1) / count() as conversion_rate,
          count() as total_sessions
        FROM sessions
        WHERE ${timeCondition.replace('timestamp', 'start_time')}
      `;

      const result = await clickhouse.query(query);
      return result[0] || {};
    } catch (error) {
      logger.error('Error getting user engagement:', error);
      return {};
    }
  }

  async getTrafficAnalysis(timeCondition) {
    try {
      const query = `
        SELECT
          traffic_source,
          count() as sessions,
          avg(duration) as avg_duration,
          countIf(conversion = 1) / count() as conversion_rate,
          sum(conversion_value) as total_value
        FROM sessions
        WHERE ${timeCondition.replace('timestamp', 'start_time')}
        GROUP BY traffic_source
        ORDER BY sessions DESC
      `;

      return await clickhouse.query(query);
    } catch (error) {
      logger.error('Error getting traffic analysis:', error);
      return [];
    }
  }
}

module.exports = new DashboardService();