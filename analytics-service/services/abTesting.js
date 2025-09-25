const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const redis = require('../utils/redis');
const clickhouse = require('../utils/clickhouse');
const config = require('../config');
const logger = require('../utils/logger');

class ABTestingService {
  constructor() {
    this.experiments = new Map();
    this.loadActiveExperiments();
  }

  // Create a new A/B test experiment
  async createExperiment(experimentConfig) {
    const experimentId = uuidv4();
    const timestamp = new Date().toISOString();

    // Validate experiment configuration
    this.validateExperimentConfig(experimentConfig);

    const experiment = {
      experiment_id: experimentId,
      name: experimentConfig.name,
      description: experimentConfig.description || '',
      status: 'draft', // draft, active, paused, completed
      start_date: experimentConfig.start_date || timestamp,
      end_date: experimentConfig.end_date,
      traffic_allocation: experimentConfig.traffic_allocation || 1.0, // 0.0 to 1.0
      variants: experimentConfig.variants, // Array of variant objects
      targeting: experimentConfig.targeting || {}, // Targeting criteria
      goals: experimentConfig.goals || [], // Conversion goals
      statistical_significance: experimentConfig.statistical_significance || 0.95,
      min_sample_size: experimentConfig.min_sample_size || config.abTesting.minSampleSize,
      created_at: timestamp,
      updated_at: timestamp,
      created_by: experimentConfig.created_by || 'system'
    };

    // Store experiment configuration in Redis
    await redis.client.set(
      `experiment:config:${experimentId}`,
      JSON.stringify(experiment),
      'EX',
      86400 * 365 // 1 year
    );

    // Initialize variant statistics
    for (const variant of experiment.variants) {
      const stats = {
        experiment_id: experimentId,
        variant_id: variant.id,
        users_assigned: 0,
        conversions: 0,
        conversion_rate: 0,
        total_value: 0,
        confidence_interval: null,
        significance: null,
        updated_at: timestamp
      };

      await redis.client.set(
        `experiment:stats:${experimentId}:${variant.id}`,
        JSON.stringify(stats),
        'EX',
        86400 * 365
      );
    }

    this.experiments.set(experimentId, experiment);
    logger.info(`Created A/B test experiment: ${experimentId} - ${experiment.name}`);

    return experiment;
  }

  // Start an experiment
  async startExperiment(experimentId) {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    if (experiment.status !== 'draft') {
      throw new Error(`Cannot start experiment with status: ${experiment.status}`);
    }

    // Check if we're under the concurrent experiment limit
    const activeCount = await this.getActiveExperimentCount();
    if (activeCount >= config.abTesting.maxConcurrentExperiments) {
      throw new Error(`Maximum concurrent experiments limit reached: ${config.abTesting.maxConcurrentExperiments}`);
    }

    experiment.status = 'active';
    experiment.start_date = new Date().toISOString();
    experiment.updated_at = new Date().toISOString();

    await this.updateExperiment(experimentId, experiment);
    logger.info(`Started A/B test experiment: ${experimentId}`);

    return experiment;
  }

  // Assign user to experiment variant
  async assignVariant(experimentId, userId, sessionId, userProperties = {}) {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment) {
      return null;
    }

    // Check if experiment is active
    if (experiment.status !== 'active') {
      return null;
    }

    // Check if experiment has ended
    if (experiment.end_date && new Date() > new Date(experiment.end_date)) {
      await this.endExperiment(experimentId);
      return null;
    }

    // Check targeting criteria
    if (!this.matchesTargeting(experiment.targeting, userProperties)) {
      return null;
    }

    // Check traffic allocation
    if (Math.random() > experiment.traffic_allocation) {
      return null;
    }

    // Check if user is already assigned
    const existingAssignment = await redis.getExperimentAssignment(userId, experimentId);
    if (existingAssignment) {
      return { experiment_id: experimentId, variant: existingAssignment };
    }

    // Assign variant based on consistent hashing
    const variant = this.selectVariant(experiment, userId);

    // Store assignment
    await redis.setExperimentAssignment(userId, experimentId, variant.id);

    // Record assignment in ClickHouse
    const assignmentRecord = {
      experiment_id: experimentId,
      user_id: userId,
      session_id: sessionId,
      variant: variant.id,
      timestamp: new Date().toISOString(),
      converted: false,
      conversion_value: null,
      properties: JSON.stringify(userProperties),
      created_at: new Date().toISOString()
    };

    await clickhouse.insert('experiments', [assignmentRecord]);

    // Update variant statistics
    await this.incrementVariantAssignment(experimentId, variant.id);

    logger.debug(`Assigned user ${userId} to variant ${variant.id} in experiment ${experimentId}`);

    return {
      experiment_id: experimentId,
      variant: variant.id,
      variant_data: variant
    };
  }

  // Track conversion for experiment
  async trackConversion(experimentId, userId, conversionData = {}) {
    const assignment = await redis.getExperimentAssignment(userId, experimentId);
    if (!assignment) {
      return false;
    }

    // Update experiment record in ClickHouse
    try {
      await clickhouse.command(`
        ALTER TABLE experiments
        UPDATE
          converted = 1,
          conversion_value = ${conversionData.value || 0}
        WHERE experiment_id = '${experimentId}'
          AND user_id = '${userId}'
          AND converted = 0
      `);

      // Update variant statistics
      await this.incrementVariantConversion(experimentId, assignment, conversionData.value || 0);

      logger.debug(`Tracked conversion for user ${userId} in experiment ${experimentId}, variant ${assignment}`);
      return true;
    } catch (error) {
      logger.error('Error tracking A/B test conversion:', error);
      return false;
    }
  }

  // Select variant using consistent hashing
  selectVariant(experiment, userId) {
    // Create a hash of user ID and experiment ID for consistency
    const hash = crypto
      .createHash('md5')
      .update(userId + experiment.experiment_id)
      .digest('hex');

    // Convert hash to number between 0 and 1
    const hashValue = parseInt(hash.substring(0, 8), 16) / 0xffffffff;

    // Distribute based on variant weights
    let cumulativeWeight = 0;
    for (const variant of experiment.variants) {
      cumulativeWeight += variant.weight || (1 / experiment.variants.length);
      if (hashValue <= cumulativeWeight) {
        return variant;
      }
    }

    // Fallback to first variant
    return experiment.variants[0];
  }

  // Check if user matches targeting criteria
  matchesTargeting(targeting, userProperties) {
    if (!targeting || Object.keys(targeting).length === 0) {
      return true;
    }

    // Check country targeting
    if (targeting.countries && targeting.countries.length > 0) {
      if (!targeting.countries.includes(userProperties.country)) {
        return false;
      }
    }

    // Check device type targeting
    if (targeting.deviceTypes && targeting.deviceTypes.length > 0) {
      if (!targeting.deviceTypes.includes(userProperties.device_type)) {
        return false;
      }
    }

    // Check traffic source targeting
    if (targeting.trafficSources && targeting.trafficSources.length > 0) {
      if (!targeting.trafficSources.includes(userProperties.traffic_source)) {
        return false;
      }
    }

    // Check new vs returning users
    if (targeting.userType) {
      const isNewUser = !userProperties.user_id;
      if (targeting.userType === 'new' && !isNewUser) {
        return false;
      }
      if (targeting.userType === 'returning' && isNewUser) {
        return false;
      }
    }

    return true;
  }

  // Get experiment configuration
  async getExperiment(experimentId) {
    // Try memory cache first
    if (this.experiments.has(experimentId)) {
      return this.experiments.get(experimentId);
    }

    // Try Redis
    try {
      const data = await redis.client.get(`experiment:config:${experimentId}`);
      if (data) {
        const experiment = JSON.parse(data);
        this.experiments.set(experimentId, experiment);
        return experiment;
      }
    } catch (error) {
      logger.error('Error getting experiment from Redis:', error);
    }

    return null;
  }

  // Update experiment configuration
  async updateExperiment(experimentId, updates) {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    const updatedExperiment = {
      ...experiment,
      ...updates,
      updated_at: new Date().toISOString()
    };

    await redis.client.set(
      `experiment:config:${experimentId}`,
      JSON.stringify(updatedExperiment),
      'EX',
      86400 * 365
    );

    this.experiments.set(experimentId, updatedExperiment);
    return updatedExperiment;
  }

  // Get experiment results
  async getExperimentResults(experimentId) {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    const results = {
      experiment,
      variants: [],
      statistical_analysis: null,
      recommendations: []
    };

    // Get variant statistics
    for (const variant of experiment.variants) {
      const stats = await this.getVariantStats(experimentId, variant.id);
      const detailedStats = await this.getVariantDetailedStats(experimentId, variant.id);

      results.variants.push({
        ...variant,
        ...stats,
        ...detailedStats
      });
    }

    // Perform statistical analysis
    results.statistical_analysis = await this.performStatisticalAnalysis(experimentId, results.variants);

    // Generate recommendations
    results.recommendations = this.generateRecommendations(results);

    return results;
  }

  // Get variant statistics
  async getVariantStats(experimentId, variantId) {
    try {
      const data = await redis.client.get(`experiment:stats:${experimentId}:${variantId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Error getting variant stats:', error);
      return null;
    }
  }

  // Get detailed variant statistics from ClickHouse
  async getVariantDetailedStats(experimentId, variantId) {
    try {
      const stats = await clickhouse.query(`
        SELECT
          count() as total_users,
          countIf(converted = 1) as conversions,
          countIf(converted = 1) / count() as conversion_rate,
          sum(conversion_value) as total_value,
          avg(conversion_value) as avg_value_per_conversion,
          sum(conversion_value) / count() as avg_value_per_user
        FROM experiments
        WHERE experiment_id = '${experimentId}'
          AND variant = '${variantId}'
      `);

      return stats[0] || {};
    } catch (error) {
      logger.error('Error getting detailed variant stats:', error);
      return {};
    }
  }

  // Perform statistical analysis
  async performStatisticalAnalysis(experimentId, variants) {
    if (variants.length < 2) {
      return null;
    }

    const control = variants[0]; // Assume first variant is control
    const analysis = {
      control_variant: control.id,
      test_variants: [],
      overall_significance: false,
      confidence_level: 0.95
    };

    for (let i = 1; i < variants.length; i++) {
      const testVariant = variants[i];
      const significance = this.calculateSignificance(control, testVariant);

      analysis.test_variants.push({
        variant_id: testVariant.id,
        lift: ((testVariant.conversion_rate - control.conversion_rate) / control.conversion_rate) * 100,
        confidence: significance.confidence,
        p_value: significance.p_value,
        is_significant: significance.is_significant,
        confidence_interval: significance.confidence_interval
      });

      if (significance.is_significant) {
        analysis.overall_significance = true;
      }
    }

    return analysis;
  }

  // Calculate statistical significance using Z-test
  calculateSignificance(control, test) {
    const n1 = control.total_users || 0;
    const n2 = test.total_users || 0;
    const x1 = control.conversions || 0;
    const x2 = test.conversions || 0;

    if (n1 < 30 || n2 < 30) {
      return {
        confidence: 0,
        p_value: 1,
        is_significant: false,
        confidence_interval: [0, 0]
      };
    }

    const p1 = x1 / n1;
    const p2 = x2 / n2;
    const p_pooled = (x1 + x2) / (n1 + n2);

    const se = Math.sqrt(p_pooled * (1 - p_pooled) * (1/n1 + 1/n2));
    const z = (p2 - p1) / se;

    // Two-tailed test
    const p_value = 2 * (1 - this.normalCDF(Math.abs(z)));
    const is_significant = p_value < (1 - config.abTesting.confidenceLevel);

    // Confidence interval for difference in proportions
    const se_diff = Math.sqrt((p1 * (1-p1))/n1 + (p2 * (1-p2))/n2);
    const z_critical = 1.96; // 95% confidence
    const diff = p2 - p1;
    const margin = z_critical * se_diff;

    return {
      confidence: (1 - p_value) * 100,
      p_value,
      is_significant,
      confidence_interval: [diff - margin, diff + margin]
    };
  }

  // Normal cumulative distribution function
  normalCDF(x) {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  // Error function approximation
  erf(x) {
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  // Generate recommendations
  generateRecommendations(results) {
    const recommendations = [];

    if (!results.statistical_analysis) {
      recommendations.push({
        type: 'warning',
        message: 'Insufficient data for statistical analysis. Continue running the experiment.'
      });
      return recommendations;
    }

    const analysis = results.statistical_analysis;

    // Check for significant results
    const significantVariants = analysis.test_variants.filter(v => v.is_significant);

    if (significantVariants.length === 0) {
      recommendations.push({
        type: 'info',
        message: 'No statistically significant differences found. Consider running the experiment longer or increasing traffic allocation.'
      });
    } else {
      const bestVariant = significantVariants.reduce((best, current) =>
        current.lift > best.lift ? current : best
      );

      recommendations.push({
        type: 'success',
        message: `Variant ${bestVariant.variant_id} shows significant improvement with ${bestVariant.lift.toFixed(2)}% lift.`,
        action: 'consider_implementation'
      });
    }

    // Check sample sizes
    const minSampleSize = config.abTesting.minSampleSize;
    const underSizedVariants = results.variants.filter(v => v.total_users < minSampleSize);

    if (underSizedVariants.length > 0) {
      recommendations.push({
        type: 'warning',
        message: `Some variants have insufficient sample size (< ${minSampleSize}). Continue running the experiment.`
      });
    }

    return recommendations;
  }

  // End experiment
  async endExperiment(experimentId) {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    experiment.status = 'completed';
    experiment.end_date = new Date().toISOString();
    experiment.updated_at = new Date().toISOString();

    await this.updateExperiment(experimentId, experiment);
    logger.info(`Ended A/B test experiment: ${experimentId}`);

    return experiment;
  }

  // Load active experiments into memory
  async loadActiveExperiments() {
    try {
      const keys = await redis.client.keys('experiment:config:*');
      for (const key of keys) {
        const data = await redis.client.get(key);
        if (data) {
          const experiment = JSON.parse(data);
          if (experiment.status === 'active') {
            this.experiments.set(experiment.experiment_id, experiment);
          }
        }
      }
      logger.info(`Loaded ${this.experiments.size} active experiments`);
    } catch (error) {
      logger.error('Error loading active experiments:', error);
    }
  }

  // Get active experiment count
  async getActiveExperimentCount() {
    let count = 0;
    for (const experiment of this.experiments.values()) {
      if (experiment.status === 'active') {
        count++;
      }
    }
    return count;
  }

  // Increment variant assignment counter
  async incrementVariantAssignment(experimentId, variantId) {
    const key = `experiment:stats:${experimentId}:${variantId}`;
    const stats = await this.getVariantStats(experimentId, variantId);

    if (stats) {
      stats.users_assigned += 1;
      stats.updated_at = new Date().toISOString();

      await redis.client.set(key, JSON.stringify(stats), 'EX', 86400 * 365);
    }
  }

  // Increment variant conversion counter
  async incrementVariantConversion(experimentId, variantId, value = 0) {
    const key = `experiment:stats:${experimentId}:${variantId}`;
    const stats = await this.getVariantStats(experimentId, variantId);

    if (stats) {
      stats.conversions += 1;
      stats.total_value += value;
      stats.conversion_rate = stats.conversions / stats.users_assigned;
      stats.updated_at = new Date().toISOString();

      await redis.client.set(key, JSON.stringify(stats), 'EX', 86400 * 365);
    }
  }

  // Validate experiment configuration
  validateExperimentConfig(config) {
    if (!config.name) {
      throw new Error('Experiment name is required');
    }

    if (!config.variants || !Array.isArray(config.variants) || config.variants.length < 2) {
      throw new Error('At least 2 variants are required');
    }

    for (const variant of config.variants) {
      if (!variant.id || !variant.name) {
        throw new Error('Variant must have id and name');
      }
    }

    // Validate weights sum to 1
    const totalWeight = config.variants.reduce((sum, variant) =>
      sum + (variant.weight || (1 / config.variants.length)), 0
    );

    if (Math.abs(totalWeight - 1.0) > 0.01) {
      throw new Error('Variant weights must sum to 1.0');
    }
  }
}

module.exports = new ABTestingService();