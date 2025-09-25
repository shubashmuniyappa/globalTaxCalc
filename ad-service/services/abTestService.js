const config = require('../config');
const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');

class ABTestService {
  constructor() {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.cacheDb
    });

    this.activeTests = new Map();
    this.testResults = new Map();
    this.userAssignments = new Map();

    this.init();
  }

  async init() {
    await this.loadActiveTests();
    await this.startTestMonitoring();
  }

  async loadActiveTests() {
    try {
      const testKeys = await this.redis.keys('ab_test:*');

      for (const key of testKeys) {
        const testData = await this.redis.get(key);
        if (testData) {
          const test = JSON.parse(testData);
          this.activeTests.set(test.id, test);
        }
      }

      console.log(`Loaded ${this.activeTests.size} active A/B tests`);
    } catch (error) {
      console.error('Error loading active tests:', error);
    }
  }

  async createTest(testConfig) {
    const test = {
      id: uuidv4(),
      name: testConfig.name,
      description: testConfig.description,
      type: testConfig.type, // 'placement', 'density', 'format', 'design'
      status: 'active',
      startDate: new Date(),
      endDate: testConfig.endDate || new Date(Date.now() + config.abTesting.testDuration),
      variants: testConfig.variants,
      trafficAllocation: testConfig.trafficAllocation || 0.5, // 50% of traffic
      targetMetric: testConfig.targetMetric || 'revenue', // 'revenue', 'ctr', 'viewability'
      minSampleSize: testConfig.minSampleSize || config.abTesting.sampleSize,
      confidenceLevel: testConfig.confidenceLevel || config.abTesting.confidenceLevel,
      targeting: testConfig.targeting || {},
      results: {
        control: { participants: 0, conversions: 0, revenue: 0, impressions: 0, clicks: 0 },
        variant: { participants: 0, conversions: 0, revenue: 0, impressions: 0, clicks: 0 }
      },
      createdAt: new Date(),
      createdBy: testConfig.createdBy
    };

    // Validate test configuration
    this.validateTestConfig(test);

    // Store test
    this.activeTests.set(test.id, test);
    await this.redis.setex(`ab_test:${test.id}`, 86400 * 30, JSON.stringify(test));

    console.log(`Created A/B test: ${test.name} (${test.id})`);
    return test;
  }

  validateTestConfig(test) {
    if (!test.name || !test.variants) {
      throw new Error('Test name and variants are required');
    }

    if (test.variants.length !== 2) {
      throw new Error('Exactly 2 variants required (control and variant)');
    }

    if (test.trafficAllocation < 0.1 || test.trafficAllocation > 1.0) {
      throw new Error('Traffic allocation must be between 0.1 and 1.0');
    }

    if (this.activeTests.size >= config.abTesting.maxActiveTests) {
      throw new Error('Maximum number of active tests reached');
    }
  }

  async assignUserToTest(userId, sessionId, context = {}) {
    const identifier = userId || sessionId;
    if (!identifier) return null;

    // Check existing assignment
    const cacheKey = `user_tests:${identifier}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // Find applicable tests
    const applicableTests = Array.from(this.activeTests.values())
      .filter(test => this.isUserEligibleForTest(test, context));

    if (applicableTests.length === 0) {
      return null;
    }

    // Select test (prioritize by creation date for now)
    const selectedTest = applicableTests
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];

    // Assign variant
    const variant = this.assignVariant(selectedTest, identifier);

    const assignment = {
      testId: selectedTest.id,
      testName: selectedTest.name,
      variant: variant,
      assignedAt: new Date(),
      context: context
    };

    // Cache assignment
    await this.redis.setex(cacheKey, 86400 * 7, JSON.stringify(assignment));

    // Update test participant count
    await this.updateTestMetrics(selectedTest.id, variant, 'participants', 1);

    return assignment;
  }

  isUserEligibleForTest(test, context) {
    // Check if test is active
    if (test.status !== 'active') return false;

    // Check date range
    const now = new Date();
    if (now < new Date(test.startDate) || now > new Date(test.endDate)) {
      return false;
    }

    // Check targeting criteria
    const targeting = test.targeting;

    if (targeting.countries && context.country &&
        !targeting.countries.includes(context.country)) {
      return false;
    }

    if (targeting.devices && context.device &&
        !targeting.devices.includes(context.device)) {
      return false;
    }

    if (targeting.calculatorTypes && context.calculatorType &&
        !targeting.calculatorTypes.includes(context.calculatorType)) {
      return false;
    }

    if (targeting.userTypes && context.userType &&
        !targeting.userTypes.includes(context.userType)) {
      return false;
    }

    return true;
  }

  assignVariant(test, identifier) {
    // Use hash-based assignment for consistency
    const hash = this.hash(identifier + test.id);
    const threshold = test.trafficAllocation;

    return (hash % 100) / 100 < threshold ? test.variants[1].name : test.variants[0].name;
  }

  hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  async getTestVariant(testId, userId, sessionId) {
    const assignment = await this.assignUserToTest(userId, sessionId);

    if (!assignment || assignment.testId !== testId) {
      return null;
    }

    const test = this.activeTests.get(testId);
    if (!test) return null;

    const variant = test.variants.find(v => v.name === assignment.variant);
    return variant;
  }

  async trackEvent(testId, userId, sessionId, eventType, value = 1) {
    const assignment = await this.getUserAssignment(userId, sessionId);

    if (!assignment || assignment.testId !== testId) {
      return;
    }

    await this.updateTestMetrics(testId, assignment.variant, eventType, value);

    // Log event for detailed analysis
    const eventData = {
      testId,
      variant: assignment.variant,
      eventType,
      value,
      timestamp: new Date(),
      userId,
      sessionId
    };

    await this.redis.lpush(`test_events:${testId}`, JSON.stringify(eventData));
    await this.redis.expire(`test_events:${testId}`, 86400 * 30); // Keep for 30 days
  }

  async getUserAssignment(userId, sessionId) {
    const identifier = userId || sessionId;
    if (!identifier) return null;

    const cacheKey = `user_tests:${identifier}`;
    const cached = await this.redis.get(cacheKey);

    return cached ? JSON.parse(cached) : null;
  }

  async updateTestMetrics(testId, variant, metric, value) {
    const test = this.activeTests.get(testId);
    if (!test) return;

    // Update in-memory results
    if (test.results[variant]) {
      test.results[variant][metric] = (test.results[variant][metric] || 0) + value;
    }

    // Update in Redis
    await this.redis.setex(`ab_test:${testId}`, 86400 * 30, JSON.stringify(test));

    // Update running statistics
    const statsKey = `test_stats:${testId}:${variant}:${metric}`;
    await this.redis.incrbyfloat(statsKey, value);
    await this.redis.expire(statsKey, 86400 * 30);
  }

  async analyzeTestResults(testId) {
    const test = this.activeTests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    const controlResults = test.results.control || test.results[test.variants[0].name];
    const variantResults = test.results.variant || test.results[test.variants[1].name];

    // Calculate metrics
    const analysis = {
      testId: test.id,
      testName: test.name,
      status: test.status,
      duration: new Date() - new Date(test.startDate),
      control: this.calculateVariantMetrics(controlResults),
      variant: this.calculateVariantMetrics(variantResults),
      winner: null,
      confidence: 0,
      significance: false,
      recommendation: ''
    };

    // Statistical analysis
    const statTest = this.performStatisticalTest(
      analysis.control,
      analysis.variant,
      test.targetMetric,
      test.confidenceLevel
    );

    analysis.confidence = statTest.confidence;
    analysis.significance = statTest.significant;
    analysis.pValue = statTest.pValue;

    // Determine winner
    if (analysis.significance) {
      const controlMetric = analysis.control[test.targetMetric];
      const variantMetric = analysis.variant[test.targetMetric];

      analysis.winner = variantMetric > controlMetric ? 'variant' : 'control';
      analysis.improvement = ((variantMetric - controlMetric) / controlMetric * 100).toFixed(2);
    }

    // Generate recommendation
    analysis.recommendation = this.generateRecommendation(analysis, test);

    return analysis;
  }

  calculateVariantMetrics(results) {
    const metrics = {
      participants: results.participants || 0,
      impressions: results.impressions || 0,
      clicks: results.clicks || 0,
      revenue: results.revenue || 0,
      conversions: results.conversions || 0
    };

    // Calculate derived metrics
    metrics.ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) : 0;
    metrics.cpm = metrics.impressions > 0 ? (metrics.revenue / metrics.impressions * 1000) : 0;
    metrics.conversionRate = metrics.participants > 0 ? (metrics.conversions / metrics.participants) : 0;
    metrics.revenuePerUser = metrics.participants > 0 ? (metrics.revenue / metrics.participants) : 0;

    return metrics;
  }

  performStatisticalTest(control, variant, metric, confidenceLevel) {
    const controlValue = control[metric] || 0;
    const variantValue = variant[metric] || 0;
    const controlSample = control.participants || 0;
    const variantSample = variant.participants || 0;

    if (controlSample < 30 || variantSample < 30) {
      return {
        significant: false,
        confidence: 0,
        pValue: 1,
        reason: 'Insufficient sample size'
      };
    }

    // Simplified z-test for proportions or means
    let zScore = 0;
    let pooledStdError = 0;

    if (metric === 'ctr' || metric === 'conversionRate') {
      // Test for proportions
      const p1 = controlValue;
      const p2 = variantValue;
      const n1 = controlSample;
      const n2 = variantSample;

      const pooledP = ((p1 * n1) + (p2 * n2)) / (n1 + n2);
      pooledStdError = Math.sqrt(pooledP * (1 - pooledP) * ((1/n1) + (1/n2)));

      if (pooledStdError > 0) {
        zScore = (p2 - p1) / pooledStdError;
      }
    } else {
      // Test for means (revenue, etc.)
      const stdError1 = Math.sqrt(controlValue / controlSample);
      const stdError2 = Math.sqrt(variantValue / variantSample);
      pooledStdError = Math.sqrt((stdError1 ** 2) + (stdError2 ** 2));

      if (pooledStdError > 0) {
        zScore = (variantValue - controlValue) / pooledStdError;
      }
    }

    // Calculate p-value (two-tailed test)
    const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)));

    // Determine significance
    const alpha = 1 - confidenceLevel;
    const significant = pValue < alpha;

    return {
      significant,
      confidence: (1 - pValue) * 100,
      pValue,
      zScore
    };
  }

  normalCDF(x) {
    // Approximation of normal cumulative distribution function
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2.0);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  generateRecommendation(analysis, test) {
    if (!analysis.significance) {
      if (analysis.control.participants < test.minSampleSize) {
        return 'Continue test - insufficient sample size for statistical significance';
      }
      return 'No significant difference detected - consider ending test or running longer';
    }

    if (analysis.winner === 'variant') {
      return `Implement variant - shows ${analysis.improvement}% improvement in ${test.targetMetric}`;
    } else {
      return `Keep control - control performs ${Math.abs(analysis.improvement)}% better than variant`;
    }
  }

  async endTest(testId, reason = 'manual') {
    const test = this.activeTests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    test.status = 'completed';
    test.endDate = new Date();
    test.endReason = reason;

    // Final analysis
    const finalAnalysis = await this.analyzeTestResults(testId);
    test.finalResults = finalAnalysis;

    // Update storage
    await this.redis.setex(`ab_test:${testId}`, 86400 * 90, JSON.stringify(test));

    // Remove from active tests
    this.activeTests.delete(testId);

    console.log(`Ended A/B test: ${test.name} - Winner: ${finalAnalysis.winner || 'none'}`);

    return finalAnalysis;
  }

  async getActiveTests() {
    return Array.from(this.activeTests.values());
  }

  async getTestResults(testId) {
    return await this.analyzeTestResults(testId);
  }

  async startTestMonitoring() {
    // Monitor tests every hour
    setInterval(async () => {
      await this.monitorActiveTests();
    }, 60 * 60 * 1000);
  }

  async monitorActiveTests() {
    for (const test of this.activeTests.values()) {
      try {
        // Check if test should end
        if (new Date() > new Date(test.endDate)) {
          await this.endTest(test.id, 'expired');
          continue;
        }

        // Check for early winner
        const analysis = await this.analyzeTestResults(test.id);

        if (analysis.significance &&
            analysis.control.participants >= test.minSampleSize &&
            analysis.variant.participants >= test.minSampleSize) {

          console.log(`Test ${test.name} has statistical significance, considering early end`);

          // Auto-end if improvement is substantial (>20%) or test has run for minimum time
          const testDuration = new Date() - new Date(test.startDate);
          const minTestDuration = 3 * 24 * 60 * 60 * 1000; // 3 days

          if (Math.abs(parseFloat(analysis.improvement)) > 20 || testDuration > minTestDuration) {
            await this.endTest(test.id, 'early_winner');
          }
        }
      } catch (error) {
        console.error(`Error monitoring test ${test.id}:`, error);
      }
    }
  }

  async healthCheck() {
    try {
      await this.redis.ping();

      return {
        status: 'healthy',
        activeTests: this.activeTests.size,
        totalTests: await this.redis.keys('ab_test:*').then(keys => keys.length)
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

module.exports = new ABTestService();