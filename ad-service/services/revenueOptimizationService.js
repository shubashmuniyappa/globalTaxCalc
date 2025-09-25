const config = require('../config');
const Redis = require('ioredis');
const cron = require('node-cron');

class RevenueOptimizationService {
  constructor() {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.cacheDb
    });

    this.optimizationRules = new Map();
    this.performanceThresholds = new Map();
    this.networkPerformance = new Map();
    this.revenueMetrics = new Map();

    this.init();
  }

  async init() {
    await this.loadOptimizationRules();
    await this.loadPerformanceThresholds();
    await this.startOptimizationScheduler();
    await this.initializePerformanceTracking();
  }

  async loadOptimizationRules() {
    const rules = [
      {
        id: 'low_fill_rate_switch',
        name: 'Switch Network on Low Fill Rate',
        condition: (metrics) => metrics.fillRate < config.performance.minViewabilityThreshold,
        action: 'switch_primary_network',
        priority: 1,
        enabled: true
      },
      {
        id: 'low_rpm_optimization',
        name: 'Optimize for Low RPM',
        condition: (metrics) => metrics.rpm < config.performance.minRpmThreshold,
        action: 'enable_premium_networks',
        priority: 2,
        enabled: true
      },
      {
        id: 'high_latency_fallback',
        name: 'Use Fallback for High Latency',
        condition: (metrics) => metrics.latency > config.performance.adLoadTimeout * 0.8,
        action: 'enable_fallback',
        priority: 3,
        enabled: true
      },
      {
        id: 'geographic_optimization',
        name: 'Geographic Revenue Optimization',
        condition: (metrics, context) => {
          const geoData = config.geographic.geoTargeting[context.country];
          return geoData && metrics.rpm < geoData.rpm * 0.7;
        },
        action: 'optimize_for_geo',
        priority: 4,
        enabled: true
      },
      {
        id: 'time_based_optimization',
        name: 'Time-based Network Selection',
        condition: (metrics, context) => {
          const hour = new Date().getHours();
          return hour >= 9 && hour <= 17 && metrics.rpm < 2.0;
        },
        action: 'prioritize_business_hours',
        priority: 5,
        enabled: true
      }
    ];

    for (const rule of rules) {
      this.optimizationRules.set(rule.id, rule);
    }
  }

  async loadPerformanceThresholds() {
    const thresholds = {
      fillRate: {
        excellent: 0.9,
        good: 0.75,
        average: 0.6,
        poor: 0.4
      },
      rpm: {
        excellent: 3.0,
        good: 2.0,
        average: 1.5,
        poor: 1.0
      },
      ctr: {
        excellent: 0.02,
        good: 0.015,
        average: 0.01,
        poor: 0.005
      },
      viewability: {
        excellent: 0.9,
        good: 0.7,
        average: 0.5,
        poor: 0.3
      },
      latency: {
        excellent: 100,
        good: 200,
        average: 500,
        poor: 1000
      }
    };

    for (const [metric, levels] of Object.entries(thresholds)) {
      this.performanceThresholds.set(metric, levels);
    }
  }

  async trackRevenue(placementId, networkName, revenue, impressions = 1, context = {}) {
    const timestamp = Date.now();
    const hour = new Date().getHours();
    const date = new Date().toISOString().split('T')[0];

    // Track revenue metrics
    const revenueData = {
      placementId,
      networkName,
      revenue,
      impressions,
      rpm: impressions > 0 ? (revenue / impressions) * 1000 : 0,
      timestamp,
      hour,
      date,
      country: context.country,
      device: context.device,
      calculatorType: context.calculatorType
    };

    // Store detailed revenue data
    await this.redis.lpush(`revenue:${date}`, JSON.stringify(revenueData));
    await this.redis.expire(`revenue:${date}`, 86400 * 90); // Keep for 90 days

    // Update real-time metrics
    await this.updateRealtimeMetrics(networkName, revenueData);
    await this.updateGeoMetrics(context.country, revenueData);
    await this.updateHourlyMetrics(hour, revenueData);

    // Trigger optimization if needed
    if (config.revenueOptimization.enabled) {
      await this.evaluateOptimization(networkName, context);
    }
  }

  async updateRealtimeMetrics(networkName, revenueData) {
    const metricsKey = `metrics:${networkName}:realtime`;

    // Update running totals using Redis hash
    await this.redis.hincrbyfloat(metricsKey, 'revenue', revenueData.revenue);
    await this.redis.hincrby(metricsKey, 'impressions', revenueData.impressions);
    await this.redis.hset(metricsKey, 'lastUpdate', revenueData.timestamp);
    await this.redis.expire(metricsKey, 3600); // Expire in 1 hour

    // Calculate RPM
    const revenue = parseFloat(await this.redis.hget(metricsKey, 'revenue') || 0);
    const impressions = parseInt(await this.redis.hget(metricsKey, 'impressions') || 0);
    const rpm = impressions > 0 ? (revenue / impressions) * 1000 : 0;

    await this.redis.hset(metricsKey, 'rpm', rpm.toFixed(4));
  }

  async updateGeoMetrics(country, revenueData) {
    if (!country) return;

    const geoKey = `metrics:geo:${country}:${revenueData.date}`;

    await this.redis.hincrbyfloat(geoKey, 'revenue', revenueData.revenue);
    await this.redis.hincrby(geoKey, 'impressions', revenueData.impressions);
    await this.redis.expire(geoKey, 86400 * 7); // Keep for 7 days

    // Update daily geo performance
    const revenue = parseFloat(await this.redis.hget(geoKey, 'revenue') || 0);
    const impressions = parseInt(await this.redis.hget(geoKey, 'impressions') || 0);
    const rpm = impressions > 0 ? (revenue / impressions) * 1000 : 0;

    await this.redis.hset(geoKey, 'rpm', rpm.toFixed(4));
  }

  async updateHourlyMetrics(hour, revenueData) {
    const hourlyKey = `metrics:hourly:${hour}:${revenueData.date}`;

    await this.redis.hincrbyfloat(hourlyKey, 'revenue', revenueData.revenue);
    await this.redis.hincrby(hourlyKey, 'impressions', revenueData.impressions);
    await this.redis.expire(hourlyKey, 86400 * 7); // Keep for 7 days
  }

  async trackFillRate(networkName, requested, filled, context = {}) {
    const fillRate = requested > 0 ? filled / requested : 0;
    const timestamp = Date.now();

    const fillRateData = {
      networkName,
      requested,
      filled,
      fillRate,
      timestamp,
      country: context.country,
      device: context.device
    };

    // Update network fill rate metrics
    const fillRateKey = `fillrate:${networkName}:${context.country || 'global'}`;

    await this.redis.hincrbyfloat(fillRateKey, 'total_requested', requested);
    await this.redis.hincrbyfloat(fillRateKey, 'total_filled', filled);
    await this.redis.hset(fillRateKey, 'lastUpdate', timestamp);
    await this.redis.expire(fillRateKey, 3600);

    // Calculate running fill rate
    const totalRequested = parseFloat(await this.redis.hget(fillRateKey, 'total_requested') || 0);
    const totalFilled = parseFloat(await this.redis.hget(fillRateKey, 'total_filled') || 0);
    const runningFillRate = totalRequested > 0 ? totalFilled / totalRequested : 0;

    await this.redis.hset(fillRateKey, 'fillRate', runningFillRate.toFixed(4));

    // Store detailed fill rate data
    await this.redis.lpush(`fillrate_log:${networkName}`, JSON.stringify(fillRateData));
    await this.redis.ltrim(`fillrate_log:${networkName}`, 0, 999); // Keep last 1000 entries
    await this.redis.expire(`fillrate_log:${networkName}`, 86400);
  }

  async trackViewability(placementId, networkName, viewabilityScore, context = {}) {
    const timestamp = Date.now();

    const viewabilityData = {
      placementId,
      networkName,
      viewabilityScore,
      timestamp,
      country: context.country,
      device: context.device
    };

    // Update viewability metrics
    const viewabilityKey = `viewability:${networkName}`;

    await this.redis.lpush(viewabilityKey, viewabilityScore);
    await this.redis.ltrim(viewabilityKey, 0, 99); // Keep last 100 scores
    await this.redis.expire(viewabilityKey, 3600);

    // Calculate average viewability
    const scores = await this.redis.lrange(viewabilityKey, 0, -1);
    const avgViewability = scores.reduce((sum, score) => sum + parseFloat(score), 0) / scores.length;

    await this.redis.hset(`metrics:${networkName}:realtime`, 'viewability', avgViewability.toFixed(4));
  }

  async evaluateOptimization(networkName, context) {
    try {
      const metrics = await this.getCurrentMetrics(networkName, context);

      // Apply optimization rules
      for (const rule of this.optimizationRules.values()) {
        if (!rule.enabled) continue;

        if (rule.condition(metrics, context)) {
          await this.executeOptimizationAction(rule, networkName, context, metrics);
        }
      }
    } catch (error) {
      console.error('Error evaluating optimization:', error);
    }
  }

  async getCurrentMetrics(networkName, context) {
    const metricsKey = `metrics:${networkName}:realtime`;
    const metrics = await this.redis.hgetall(metricsKey);

    const fillRateKey = `fillrate:${networkName}:${context.country || 'global'}`;
    const fillRateData = await this.redis.hgetall(fillRateKey);

    return {
      rpm: parseFloat(metrics.rpm || 0),
      revenue: parseFloat(metrics.revenue || 0),
      impressions: parseInt(metrics.impressions || 0),
      viewability: parseFloat(metrics.viewability || 0),
      fillRate: parseFloat(fillRateData.fillRate || 0),
      latency: await this.getNetworkLatency(networkName),
      lastUpdate: parseInt(metrics.lastUpdate || 0)
    };
  }

  async getNetworkLatency(networkName) {
    const latencyKey = `latency:${networkName}`;
    const latencies = await this.redis.lrange(latencyKey, 0, 9); // Last 10 measurements

    if (latencies.length === 0) return 0;

    const avgLatency = latencies.reduce((sum, latency) => sum + parseFloat(latency), 0) / latencies.length;
    return avgLatency;
  }

  async executeOptimizationAction(rule, networkName, context, metrics) {
    console.log(`Executing optimization rule: ${rule.name} for network ${networkName}`);

    const optimizationKey = `optimization:${rule.id}:${networkName}:${context.country || 'global'}`;

    // Prevent rapid successive optimizations
    const lastOptimization = await this.redis.get(optimizationKey);
    if (lastOptimization && Date.now() - parseInt(lastOptimization) < 300000) { // 5 minutes
      return;
    }

    switch (rule.action) {
      case 'switch_primary_network':
        await this.switchPrimaryNetwork(networkName, context, metrics);
        break;

      case 'enable_premium_networks':
        await this.enablePremiumNetworks(context, metrics);
        break;

      case 'enable_fallback':
        await this.enableFallbackAds(networkName, context);
        break;

      case 'optimize_for_geo':
        await this.optimizeForGeography(context, metrics);
        break;

      case 'prioritize_business_hours':
        await this.prioritizeBusinessHours(context, metrics);
        break;
    }

    // Record optimization execution
    await this.redis.setex(optimizationKey, 3600, Date.now().toString());

    // Log optimization action
    const optimizationLog = {
      ruleId: rule.id,
      ruleName: rule.name,
      networkName,
      context,
      metrics,
      timestamp: Date.now()
    };

    await this.redis.lpush('optimization_log', JSON.stringify(optimizationLog));
    await this.redis.ltrim('optimization_log', 0, 999);
    await this.redis.expire('optimization_log', 86400 * 7);
  }

  async switchPrimaryNetwork(currentNetwork, context, metrics) {
    // Find better performing network
    const networks = ['adsense', 'medianet', 'direct'];
    let bestNetwork = currentNetwork;
    let bestScore = metrics.fillRate * metrics.rpm;

    for (const network of networks) {
      if (network === currentNetwork) continue;

      const networkMetrics = await this.getCurrentMetrics(network, context);
      const score = networkMetrics.fillRate * networkMetrics.rpm;

      if (score > bestScore) {
        bestNetwork = network;
        bestScore = score;
      }
    }

    if (bestNetwork !== currentNetwork) {
      // Update network priority
      const priorityKey = `network_priority:${context.country || 'global'}`;
      await this.redis.hset(priorityKey, 'primary', bestNetwork);
      await this.redis.hset(priorityKey, 'previous', currentNetwork);
      await this.redis.expire(priorityKey, 3600);

      console.log(`Switched primary network from ${currentNetwork} to ${bestNetwork}`);
    }
  }

  async enablePremiumNetworks(context, metrics) {
    // Enable higher-quality networks for low RPM
    const premiumKey = `premium_enabled:${context.country || 'global'}`;
    await this.redis.setex(premiumKey, 1800, 'true'); // Enable for 30 minutes

    console.log('Enabled premium networks for low RPM optimization');
  }

  async enableFallbackAds(networkName, context) {
    // Enable fallback ads for network with high latency
    const fallbackKey = `fallback_enabled:${networkName}:${context.country || 'global'}`;
    await this.redis.setex(fallbackKey, 1800, 'true');

    console.log(`Enabled fallback ads for ${networkName} due to high latency`);
  }

  async optimizeForGeography(context, metrics) {
    const country = context.country;
    if (!country) return;

    const geoData = config.geographic.geoTargeting[country];
    if (!geoData) return;

    // Adjust network priorities based on geographic performance
    const geoOptimizationKey = `geo_optimization:${country}`;
    const optimization = {
      targetRpm: geoData.rpm,
      adjustedNetworks: ['adsense', 'direct'], // Prioritize these for this geo
      timestamp: Date.now()
    };

    await this.redis.setex(geoOptimizationKey, 3600, JSON.stringify(optimization));

    console.log(`Applied geographic optimization for ${country}`);
  }

  async prioritizeBusinessHours(context, metrics) {
    const hour = new Date().getHours();
    if (hour < 9 || hour > 17) return;

    // Prioritize higher-performing networks during business hours
    const businessHoursKey = `business_hours_optimization`;
    const optimization = {
      prioritizedNetworks: ['direct', 'adsense'], // Direct advertisers typically pay more
      hour,
      timestamp: Date.now()
    };

    await this.redis.setex(businessHoursKey, 3600, JSON.stringify(optimization));

    console.log('Applied business hours optimization');
  }

  async getNetworkPriority(context) {
    const country = context.country || 'global';

    // Check for optimized network priority
    const priorityKey = `network_priority:${country}`;
    const priority = await this.redis.hget(priorityKey, 'primary');

    if (priority) {
      return priority;
    }

    // Check for geographic optimization
    const geoOptimizationKey = `geo_optimization:${country}`;
    const geoOptimization = await this.redis.get(geoOptimizationKey);

    if (geoOptimization) {
      const optimization = JSON.parse(geoOptimization);
      return optimization.adjustedNetworks[0];
    }

    // Check for business hours optimization
    const businessHoursKey = `business_hours_optimization`;
    const businessOptimization = await this.redis.get(businessHoursKey);

    if (businessOptimization) {
      const optimization = JSON.parse(businessOptimization);
      return optimization.prioritizedNetworks[0];
    }

    // Default priority
    return 'adsense';
  }

  async getRevenueReport(timeRange = '24h', country = null) {
    const report = {
      timeRange,
      country,
      totalRevenue: 0,
      totalImpressions: 0,
      averageRpm: 0,
      fillRate: 0,
      networkBreakdown: {},
      geoBreakdown: {},
      hourlyBreakdown: {},
      topPerformers: []
    };

    try {
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();

      switch (timeRange) {
        case '1h':
          startDate.setHours(startDate.getHours() - 1);
          break;
        case '24h':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
      }

      // Aggregate revenue data
      const dates = this.getDateRange(startDate, endDate);

      for (const date of dates) {
        const revenueKey = `revenue:${date}`;
        const revenueData = await this.redis.lrange(revenueKey, 0, -1);

        for (const item of revenueData) {
          const data = JSON.parse(item);

          // Filter by country if specified
          if (country && data.country !== country) continue;

          report.totalRevenue += data.revenue;
          report.totalImpressions += data.impressions;

          // Network breakdown
          if (!report.networkBreakdown[data.networkName]) {
            report.networkBreakdown[data.networkName] = {
              revenue: 0,
              impressions: 0,
              rpm: 0
            };
          }

          report.networkBreakdown[data.networkName].revenue += data.revenue;
          report.networkBreakdown[data.networkName].impressions += data.impressions;

          // Geographic breakdown
          if (data.country) {
            if (!report.geoBreakdown[data.country]) {
              report.geoBreakdown[data.country] = {
                revenue: 0,
                impressions: 0,
                rpm: 0
              };
            }

            report.geoBreakdown[data.country].revenue += data.revenue;
            report.geoBreakdown[data.country].impressions += data.impressions;
          }

          // Hourly breakdown
          const hour = data.hour;
          if (!report.hourlyBreakdown[hour]) {
            report.hourlyBreakdown[hour] = {
              revenue: 0,
              impressions: 0,
              rpm: 0
            };
          }

          report.hourlyBreakdown[hour].revenue += data.revenue;
          report.hourlyBreakdown[hour].impressions += data.impressions;
        }
      }

      // Calculate derived metrics
      report.averageRpm = report.totalImpressions > 0 ?
        (report.totalRevenue / report.totalImpressions) * 1000 : 0;

      // Calculate RPM for breakdowns
      for (const [network, data] of Object.entries(report.networkBreakdown)) {
        data.rpm = data.impressions > 0 ? (data.revenue / data.impressions) * 1000 : 0;
      }

      for (const [geo, data] of Object.entries(report.geoBreakdown)) {
        data.rpm = data.impressions > 0 ? (data.revenue / data.impressions) * 1000 : 0;
      }

      for (const [hour, data] of Object.entries(report.hourlyBreakdown)) {
        data.rpm = data.impressions > 0 ? (data.revenue / data.impressions) * 1000 : 0;
      }

      // Find top performers
      report.topPerformers = Object.entries(report.networkBreakdown)
        .sort(([,a], [,b]) => b.rpm - a.rpm)
        .slice(0, 3)
        .map(([network, data]) => ({ network, ...data }));

    } catch (error) {
      console.error('Error generating revenue report:', error);
    }

    return report;
  }

  getDateRange(startDate, endDate) {
    const dates = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dates;
  }

  async startOptimizationScheduler() {
    if (!config.revenueOptimization.enabled) return;

    // Run optimization every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
      await this.runGlobalOptimization();
    });

    // Daily revenue analysis
    cron.schedule('0 1 * * *', async () => {
      await this.runDailyAnalysis();
    });

    console.log('Revenue optimization scheduler started');
  }

  async runGlobalOptimization() {
    try {
      console.log('Running global revenue optimization...');

      // Get all active networks
      const networks = ['adsense', 'medianet', 'direct'];

      for (const network of networks) {
        const metrics = await this.getCurrentMetrics(network, { country: 'global' });

        // Check if network needs optimization
        if (metrics.rpm < config.performance.minRpmThreshold ||
            metrics.fillRate < config.performance.minViewabilityThreshold) {

          await this.evaluateOptimization(network, { country: 'global' });
        }
      }

    } catch (error) {
      console.error('Error in global optimization:', error);
    }
  }

  async runDailyAnalysis() {
    try {
      console.log('Running daily revenue analysis...');

      const report = await this.getRevenueReport('24h');

      // Log daily summary
      console.log(`Daily Revenue Summary:
        Total Revenue: $${report.totalRevenue.toFixed(2)}
        Total Impressions: ${report.totalImpressions}
        Average RPM: $${report.averageRpm.toFixed(2)}
        Top Network: ${report.topPerformers[0]?.network || 'none'}
      `);

      // Store daily summary
      const summaryKey = `daily_summary:${new Date().toISOString().split('T')[0]}`;
      await this.redis.setex(summaryKey, 86400 * 30, JSON.stringify(report));

    } catch (error) {
      console.error('Error in daily analysis:', error);
    }
  }

  async initializePerformanceTracking() {
    // Initialize default performance data for new networks
    const networks = ['adsense', 'medianet', 'direct'];

    for (const network of networks) {
      const metricsKey = `metrics:${network}:realtime`;
      const exists = await this.redis.exists(metricsKey);

      if (!exists) {
        await this.redis.hset(metricsKey, {
          revenue: '0',
          impressions: '0',
          rpm: '0',
          viewability: '0.7',
          lastUpdate: Date.now().toString()
        });
        await this.redis.expire(metricsKey, 3600);
      }
    }
  }

  async healthCheck() {
    try {
      await this.redis.ping();

      const activeOptimizations = await this.redis.keys('optimization:*').then(keys => keys.length);

      return {
        status: 'healthy',
        optimizationRules: this.optimizationRules.size,
        activeOptimizations,
        revenueOptimizationEnabled: config.revenueOptimization.enabled
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

module.exports = new RevenueOptimizationService();