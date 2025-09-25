const LoadTester = require('./LoadTester');
const fs = require('fs').promises;
const path = require('path');

class PerformanceTestSuite {
  constructor(options = {}) {
    this.config = {
      outputDir: options.outputDir || './test-results',
      reportFormat: options.reportFormat || 'json',
      baseURL: options.baseURL || 'http://localhost:3000',
      scenarios: options.scenarios || this.getDefaultScenarios(),
      testProfiles: options.testProfiles || this.getDefaultTestProfiles(),
      enableRegression: options.enableRegression || true,
      regressionThreshold: options.regressionThreshold || 0.1,
      ...options
    };

    this.testResults = [];
    this.baselineResults = null;
  }

  getDefaultScenarios() {
    return [
      {
        name: 'user_journey_calculate_tax',
        weight: 40,
        requests: [
          { method: 'GET', path: '/', name: 'homepage' },
          { method: 'GET', path: '/api/countries', name: 'get_countries' },
          { method: 'POST', path: '/api/calculate', name: 'calculate_tax', data: {
            income: 50000,
            country: 'US',
            taxYear: 2024
          }},
          { method: 'GET', path: '/api/tax-brackets/US', name: 'get_tax_brackets' }
        ]
      },
      {
        name: 'user_journey_compare_countries',
        weight: 30,
        requests: [
          { method: 'GET', path: '/', name: 'homepage' },
          { method: 'GET', path: '/api/countries', name: 'get_countries' },
          { method: 'POST', path: '/api/compare', name: 'compare_countries', data: {
            income: 75000,
            countries: ['US', 'CA', 'UK'],
            taxYear: 2024
          }}
        ]
      },
      {
        name: 'api_heavy_load',
        weight: 20,
        requests: [
          { method: 'GET', path: '/api/health', name: 'health_check' },
          { method: 'GET', path: '/api/countries', name: 'get_countries' },
          { method: 'GET', path: '/api/tax-brackets/US', name: 'get_us_brackets' },
          { method: 'GET', path: '/api/tax-brackets/CA', name: 'get_ca_brackets' },
          { method: 'GET', path: '/api/tax-brackets/UK', name: 'get_uk_brackets' }
        ]
      },
      {
        name: 'error_scenarios',
        weight: 10,
        requests: [
          { method: 'POST', path: '/api/calculate', name: 'invalid_calculate', data: {
            income: -1000,
            country: 'INVALID'
          }},
          { method: 'GET', path: '/api/nonexistent', name: '404_test' },
          { method: 'POST', path: '/api/calculate', name: 'malformed_data', data: 'invalid' }
        ]
      }
    ];
  }

  getDefaultTestProfiles() {
    return {
      smoke: {
        name: 'Smoke Test',
        concurrent: 10,
        duration: 30,
        rampUp: 5,
        thresholds: {
          responseTime: 2000,
          errorRate: 0.05,
          throughput: 10
        }
      },
      load: {
        name: 'Load Test',
        concurrent: 100,
        duration: 300,
        rampUp: 30,
        thresholds: {
          responseTime: 1000,
          errorRate: 0.02,
          throughput: 100
        }
      },
      stress: {
        name: 'Stress Test',
        concurrent: 500,
        duration: 600,
        rampUp: 60,
        thresholds: {
          responseTime: 2000,
          errorRate: 0.1,
          throughput: 200
        }
      },
      spike: {
        name: 'Spike Test',
        concurrent: 1000,
        duration: 120,
        rampUp: 10,
        thresholds: {
          responseTime: 3000,
          errorRate: 0.15,
          throughput: 150
        }
      },
      volume: {
        name: 'Volume Test',
        concurrent: 200,
        duration: 1800,
        rampUp: 120,
        thresholds: {
          responseTime: 1500,
          errorRate: 0.05,
          throughput: 150
        }
      },
      endurance: {
        name: 'Endurance Test',
        concurrent: 100,
        duration: 7200,
        rampUp: 300,
        thresholds: {
          responseTime: 1000,
          errorRate: 0.02,
          throughput: 100
        }
      }
    };
  }

  async runFullTestSuite() {
    console.log('🚀 Starting Performance Test Suite');
    await this.ensureOutputDirectory();

    if (this.config.enableRegression) {
      await this.loadBaselineResults();
    }

    const profiles = ['smoke', 'load', 'stress', 'spike'];

    for (const profileName of profiles) {
      console.log(`\n📊 Running ${profileName} test...`);

      try {
        const result = await this.runTestProfile(profileName);
        this.testResults.push(result);

        await this.saveTestResult(result);

        if (result.passed) {
          console.log(`✅ ${profileName} test passed`);
        } else {
          console.log(`❌ ${profileName} test failed`);
          console.log('Violations:', result.thresholdViolations.map(v => v.metric).join(', '));
        }

        await this.sleep(10000);

      } catch (error) {
        console.error(`❌ ${profileName} test failed with error:`, error.message);
        this.testResults.push({
          profile: profileName,
          error: error.message,
          passed: false,
          timestamp: new Date().toISOString()
        });
      }
    }

    const suiteReport = await this.generateSuiteReport();
    await this.saveSuiteReport(suiteReport);

    console.log('\n📋 Test Suite Complete');
    return suiteReport;
  }

  async runTestProfile(profileName) {
    const profile = this.config.testProfiles[profileName];
    if (!profile) {
      throw new Error(`Test profile '${profileName}' not found`);
    }

    const loadTester = new LoadTester({
      baseURL: this.config.baseURL,
      scenarios: this.config.scenarios,
      concurrent: profile.concurrent,
      duration: profile.duration,
      rampUp: profile.rampUp,
      thresholds: profile.thresholds,
      warmup: true
    });

    const result = await loadTester.runLoadTest();
    result.profile = profileName;
    result.profileConfig = profile;

    if (this.config.enableRegression && this.baselineResults) {
      result.regressionAnalysis = this.performRegressionAnalysis(result, profileName);
    }

    return result;
  }

  async runCustomTest(testConfig) {
    console.log(`🔧 Running custom test: ${testConfig.name || 'Custom'}`);

    const loadTester = new LoadTester({
      baseURL: this.config.baseURL,
      ...testConfig
    });

    const result = await loadTester.runLoadTest();
    result.profile = 'custom';
    result.profileConfig = testConfig;

    await this.saveTestResult(result);
    return result;
  }

  performRegressionAnalysis(currentResult, profileName) {
    const baseline = this.baselineResults[profileName];
    if (!baseline) {
      return { status: 'no_baseline', message: 'No baseline data available' };
    }

    const analysis = {
      status: 'pass',
      metrics: {},
      violations: []
    };

    const metricsToCompare = [
      'averageResponseTime',
      'p95ResponseTime',
      'throughput',
      'errorRate'
    ];

    for (const metric of metricsToCompare) {
      const current = currentResult.summary[metric];
      const baselineValue = baseline.summary[metric];

      if (baselineValue && current !== undefined) {
        const change = (current - baselineValue) / baselineValue;
        const threshold = this.config.regressionThreshold;

        analysis.metrics[metric] = {
          current,
          baseline: baselineValue,
          change: change * 100,
          degraded: false
        };

        if (metric === 'throughput') {
          if (change < -threshold) {
            analysis.metrics[metric].degraded = true;
            analysis.violations.push({
              metric,
              change: change * 100,
              threshold: -threshold * 100
            });
          }
        } else if (metric === 'errorRate') {
          if (change > threshold && current > 0.01) {
            analysis.metrics[metric].degraded = true;
            analysis.violations.push({
              metric,
              change: change * 100,
              threshold: threshold * 100
            });
          }
        } else {
          if (change > threshold) {
            analysis.metrics[metric].degraded = true;
            analysis.violations.push({
              metric,
              change: change * 100,
              threshold: threshold * 100
            });
          }
        }
      }
    }

    if (analysis.violations.length > 0) {
      analysis.status = 'regression_detected';
    }

    return analysis;
  }

  async generateSuiteReport() {
    const passedTests = this.testResults.filter(r => r.passed);
    const failedTests = this.testResults.filter(r => !r.passed);

    const report = {
      summary: {
        totalTests: this.testResults.length,
        passedTests: passedTests.length,
        failedTests: failedTests.length,
        successRate: (passedTests.length / this.testResults.length) * 100,
        overallStatus: failedTests.length === 0 ? 'PASSED' : 'FAILED'
      },
      results: this.testResults,
      recommendations: this.generateRecommendations(),
      timestamp: new Date().toISOString(),
      config: this.config
    };

    if (this.config.enableRegression) {
      report.regressionSummary = this.summarizeRegressionResults();
    }

    return report;
  }

  generateRecommendations() {
    const recommendations = [];
    const failedTests = this.testResults.filter(r => !r.passed);

    if (failedTests.length === 0) {
      recommendations.push({
        type: 'success',
        message: 'All performance tests passed! System is performing within acceptable thresholds.'
      });
      return recommendations;
    }

    const commonIssues = {};
    failedTests.forEach(test => {
      if (test.thresholdViolations) {
        test.thresholdViolations.forEach(violation => {
          if (!commonIssues[violation.metric]) {
            commonIssues[violation.metric] = 0;
          }
          commonIssues[violation.metric]++;
        });
      }
    });

    if (commonIssues.responseTime) {
      recommendations.push({
        type: 'performance',
        severity: 'high',
        message: 'Response time thresholds violated. Consider optimizing database queries, enabling caching, or upgrading server resources.',
        affectedTests: failedTests.filter(t =>
          t.thresholdViolations?.some(v => v.metric === 'responseTime')
        ).map(t => t.profile)
      });
    }

    if (commonIssues.errorRate) {
      recommendations.push({
        type: 'reliability',
        severity: 'critical',
        message: 'High error rate detected. Check application logs for errors and ensure proper error handling.',
        affectedTests: failedTests.filter(t =>
          t.thresholdViolations?.some(v => v.metric === 'errorRate')
        ).map(t => t.profile)
      });
    }

    if (commonIssues.throughput) {
      recommendations.push({
        type: 'scalability',
        severity: 'medium',
        message: 'Low throughput detected. Consider horizontal scaling, load balancing, or optimizing application code.',
        affectedTests: failedTests.filter(t =>
          t.thresholdViolations?.some(v => v.metric === 'throughput')
        ).map(t => t.profile)
      });
    }

    return recommendations;
  }

  summarizeRegressionResults() {
    const regressionResults = this.testResults
      .filter(r => r.regressionAnalysis)
      .map(r => ({
        profile: r.profile,
        status: r.regressionAnalysis.status,
        violations: r.regressionAnalysis.violations || []
      }));

    const totalRegressions = regressionResults.filter(r => r.status === 'regression_detected').length;

    return {
      totalTests: regressionResults.length,
      regressionsDetected: totalRegressions,
      status: totalRegressions === 0 ? 'no_regressions' : 'regressions_detected',
      details: regressionResults
    };
  }

  async loadBaselineResults() {
    try {
      const baselinePath = path.join(this.config.outputDir, 'baseline.json');
      const data = await fs.readFile(baselinePath, 'utf8');
      this.baselineResults = JSON.parse(data);
      console.log('📊 Loaded baseline results for regression testing');
    } catch (error) {
      console.log('ℹ️  No baseline results found - regression testing disabled');
    }
  }

  async saveAsBaseline(results) {
    const baselinePath = path.join(this.config.outputDir, 'baseline.json');
    const baselineData = {};

    results.forEach(result => {
      if (result.profile && result.summary) {
        baselineData[result.profile] = {
          summary: result.summary,
          timestamp: result.timestamp
        };
      }
    });

    await fs.writeFile(baselinePath, JSON.stringify(baselineData, null, 2));
    console.log('💾 Saved results as new baseline');
  }

  async ensureOutputDirectory() {
    try {
      await fs.mkdir(this.config.outputDir, { recursive: true });
    } catch (error) {
    }
  }

  async saveTestResult(result) {
    const filename = `${result.profile}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(this.config.outputDir, filename);

    await fs.writeFile(filepath, JSON.stringify(result, null, 2));
  }

  async saveSuiteReport(report) {
    const filename = `suite_report_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(this.config.outputDir, filename);

    await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    console.log(`📊 Suite report saved: ${filepath}`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = PerformanceTestSuite;