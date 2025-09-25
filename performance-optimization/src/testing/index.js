const LoadTester = require('./LoadTester');
const PerformanceTestSuite = require('./PerformanceTestSuite');
const BottleneckAnalyzer = require('./BottleneckAnalyzer');
const CapacityPlanner = require('./CapacityPlanner');

class PerformanceTestingFramework {
  constructor(options = {}) {
    this.config = {
      baseURL: options.baseURL || 'http://localhost:3000',
      outputDir: options.outputDir || './test-results',
      enableBottleneckAnalysis: options.enableBottleneckAnalysis !== false,
      enableCapacityPlanning: options.enableCapacityPlanning !== false,
      ...options
    };

    this.testSuite = new PerformanceTestSuite(this.config);
    this.bottleneckAnalyzer = this.config.enableBottleneckAnalysis
      ? new BottleneckAnalyzer(this.config)
      : null;
    this.capacityPlanner = this.config.enableCapacityPlanning
      ? new CapacityPlanner(this.config)
      : null;

    this.setupAnalyzerIntegration();
  }

  setupAnalyzerIntegration() {
    if (!this.bottleneckAnalyzer) return;

    this.bottleneckAnalyzer.on('bottleneck_detected', (bottleneck) => {
      console.log(`🚨 Bottleneck detected: ${bottleneck.description}`);
    });

    this.bottleneckAnalyzer.on('analysis_complete', (analysis) => {
      if (this.capacityPlanner && analysis.bottlenecks.length > 0) {
        this.capacityPlanner.addHistoricalData({
          timestamp: analysis.timestamp,
          cpuUsage: this.getMetricValue(analysis, 'cpu_usage'),
          memoryUsage: this.getMetricValue(analysis, 'memory_usage'),
          responseTime: this.getMetricValue(analysis, 'response_time')
        });
      }
    });
  }

  async runCompleteAnalysis() {
    console.log('🚀 Starting comprehensive performance analysis...');

    const results = {
      testSuite: null,
      bottleneckAnalysis: null,
      capacityPlan: null,
      summary: null,
      timestamp: new Date().toISOString()
    };

    try {
      if (this.bottleneckAnalyzer) {
        console.log('\n🔍 Starting bottleneck monitoring...');
        this.bottleneckAnalyzer.startMonitoring();
      }

      console.log('\n📊 Running performance test suite...');
      results.testSuite = await this.testSuite.runFullTestSuite();

      if (this.bottleneckAnalyzer) {
        console.log('\n🔍 Analyzing bottlenecks...');
        await this.sleep(5000);
        results.bottleneckAnalysis = this.bottleneckAnalyzer.generateReport();
        this.bottleneckAnalyzer.stopMonitoring();
      }

      if (this.capacityPlanner) {
        console.log('\n📈 Generating capacity plan...');
        this.addTestDataToCapacityPlanner(results.testSuite);
        results.capacityPlan = this.capacityPlanner.generateCapacityPlan();
      }

      results.summary = this.generateComprehensiveSummary(results);

      console.log('\n✅ Comprehensive analysis complete');
      return results;

    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      throw error;
    }
  }

  async runLoadTest(profile = 'load') {
    console.log(`🧪 Running ${profile} test...`);
    return await this.testSuite.runTestProfile(profile);
  }

  async runCustomLoadTest(config) {
    console.log('🔧 Running custom load test...');

    const loadTester = new LoadTester({
      baseURL: this.config.baseURL,
      ...config
    });

    return await loadTester.runLoadTest();
  }

  startBottleneckMonitoring() {
    if (!this.bottleneckAnalyzer) {
      console.log('❌ Bottleneck analyzer not enabled');
      return;
    }

    this.bottleneckAnalyzer.startMonitoring();
    console.log('🔍 Bottleneck monitoring started');
  }

  stopBottleneckMonitoring() {
    if (!this.bottleneckAnalyzer) return;

    this.bottleneckAnalyzer.stopMonitoring();
    console.log('⏹️  Bottleneck monitoring stopped');
  }

  getBottleneckReport() {
    if (!this.bottleneckAnalyzer) {
      throw new Error('Bottleneck analyzer not enabled');
    }

    return this.bottleneckAnalyzer.generateReport();
  }

  generateCapacityPlan() {
    if (!this.capacityPlanner) {
      throw new Error('Capacity planner not enabled');
    }

    return this.capacityPlanner.generateCapacityPlan();
  }

  addHistoricalData(data) {
    if (this.capacityPlanner) {
      this.capacityPlanner.addHistoricalData(data);
    }
  }

  generateComprehensiveSummary(results) {
    const summary = {
      overall: {
        status: 'UNKNOWN',
        issues: 0,
        recommendations: 0,
        performanceGrade: 'N/A'
      },
      performance: {
        allTestsPassed: false,
        avgResponseTime: 0,
        throughput: 0,
        errorRate: 0
      },
      bottlenecks: {
        criticalIssues: 0,
        totalBottlenecks: 0,
        primaryConcerns: []
      },
      capacity: {
        projectedGrowth: 0,
        resourcesNeeded: 0,
        estimatedCosts: 0
      },
      recommendations: {
        immediate: [],
        shortTerm: [],
        longTerm: []
      }
    };

    if (results.testSuite) {
      summary.performance.allTestsPassed = results.testSuite.summary.overallStatus === 'PASSED';
      summary.performance.avgResponseTime = this.calculateAvgResponseTime(results.testSuite.results);
      summary.performance.throughput = this.calculateAvgThroughput(results.testSuite.results);
      summary.performance.errorRate = this.calculateAvgErrorRate(results.testSuite.results);

      summary.recommendations.immediate.push(...(results.testSuite.recommendations || []));
    }

    if (results.bottleneckAnalysis) {
      summary.bottlenecks.criticalIssues = results.bottleneckAnalysis.summary.criticalIssues;
      summary.bottlenecks.totalBottlenecks = results.bottleneckAnalysis.summary.totalBottlenecks;
      summary.bottlenecks.primaryConcerns = this.extractPrimaryConcerns(results.bottleneckAnalysis);

      if (results.bottleneckAnalysis.recommendations) {
        summary.recommendations.shortTerm.push(...results.bottleneckAnalysis.recommendations);
      }
    }

    if (results.capacityPlan) {
      summary.capacity.projectedGrowth = results.capacityPlan.projections.growth * 100;
      summary.capacity.resourcesNeeded = results.capacityPlan.resourceRequirements.summary.additionalServers;
      summary.capacity.estimatedCosts = results.capacityPlan.costProjections.summary.totalIncrease;

      summary.recommendations.longTerm.push(...(results.capacityPlan.recommendations.longTerm || []));
    }

    summary.overall.status = this.determineOverallStatus(summary);
    summary.overall.issues = summary.bottlenecks.totalBottlenecks + (summary.performance.allTestsPassed ? 0 : 1);
    summary.overall.recommendations = summary.recommendations.immediate.length +
                                    summary.recommendations.shortTerm.length +
                                    summary.recommendations.longTerm.length;
    summary.overall.performanceGrade = this.calculatePerformanceGrade(summary.performance);

    return summary;
  }

  determineOverallStatus(summary) {
    if (summary.bottlenecks.criticalIssues > 0) return 'CRITICAL';
    if (!summary.performance.allTestsPassed) return 'FAILED';
    if (summary.bottlenecks.totalBottlenecks > 0) return 'WARNING';
    return 'HEALTHY';
  }

  calculatePerformanceGrade(performance) {
    let score = 100;

    if (!performance.allTestsPassed) score -= 30;
    if (performance.avgResponseTime > 1000) score -= 20;
    if (performance.avgResponseTime > 2000) score -= 20;
    if (performance.errorRate > 0.02) score -= 15;
    if (performance.errorRate > 0.05) score -= 15;

    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  addTestDataToCapacityPlanner(testResults) {
    if (!this.capacityPlanner || !testResults.results) return;

    testResults.results.forEach(result => {
      if (result.summary) {
        this.capacityPlanner.addHistoricalData({
          timestamp: new Date(result.timestamp).getTime(),
          requests: result.summary.totalRequests,
          responseTime: result.summary.averageResponseTime,
          errorRate: result.summary.errorRate,
          throughput: result.summary.throughput,
          activeUsers: result.profileConfig?.concurrent || 100
        });
      }
    });
  }

  getMetricValue(analysis, metricName) {
    const bottleneck = analysis.bottlenecks.find(b => b.metric === metricName);
    return bottleneck ? bottleneck.value : 0;
  }

  extractPrimaryConcerns(bottleneckAnalysis) {
    return bottleneckAnalysis.bottlenecks
      .filter(b => b.severity === 'critical' || b.severity === 'high')
      .map(b => b.component)
      .slice(0, 3);
  }

  calculateAvgResponseTime(testResults) {
    const responseTimes = testResults
      .filter(r => r.summary)
      .map(r => r.summary.averageResponseTime);

    return responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;
  }

  calculateAvgThroughput(testResults) {
    const throughputs = testResults
      .filter(r => r.summary)
      .map(r => r.summary.throughput);

    return throughputs.length > 0
      ? throughputs.reduce((a, b) => a + b, 0) / throughputs.length
      : 0;
  }

  calculateAvgErrorRate(testResults) {
    const errorRates = testResults
      .filter(r => r.summary)
      .map(r => r.summary.errorRate);

    return errorRates.length > 0
      ? errorRates.reduce((a, b) => a + b, 0) / errorRates.length
      : 0;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = {
  PerformanceTestingFramework,
  LoadTester,
  PerformanceTestSuite,
  BottleneckAnalyzer,
  CapacityPlanner
};