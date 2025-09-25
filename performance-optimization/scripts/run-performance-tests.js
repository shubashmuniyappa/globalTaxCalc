#!/usr/bin/env node

const { PerformanceTestingFramework } = require('../src/testing');
const path = require('path');
const fs = require('fs').promises;

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'full';

  const config = {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
    outputDir: path.join(__dirname, '../test-results'),
    enableBottleneckAnalysis: true,
    enableCapacityPlanning: true
  };

  const framework = new PerformanceTestingFramework(config);

  console.log('🚀 GlobalTaxCalc Performance Testing Framework');
  console.log(`Target URL: ${config.baseURL}`);
  console.log(`Output Directory: ${config.outputDir}`);
  console.log('');

  try {
    switch (command) {
      case 'full':
        await runFullAnalysis(framework);
        break;
      case 'load':
        await runLoadTest(framework, args[1] || 'load');
        break;
      case 'bottleneck':
        await runBottleneckAnalysis(framework);
        break;
      case 'capacity':
        await runCapacityPlanning(framework);
        break;
      case 'custom':
        await runCustomTest(framework, args[1]);
        break;
      default:
        showUsage();
    }
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

async function runFullAnalysis(framework) {
  console.log('📊 Running comprehensive performance analysis...');

  const results = await framework.runCompleteAnalysis();

  await saveResults(results, 'comprehensive-analysis');

  displaySummary(results.summary);

  if (results.summary.overall.status !== 'HEALTHY') {
    console.log('\n⚠️  Performance issues detected!');
    displayRecommendations(results.summary.recommendations);
    process.exit(1);
  } else {
    console.log('\n✅ All performance tests passed!');
  }
}

async function runLoadTest(framework, profile) {
  console.log(`🧪 Running ${profile} test...`);

  const result = await framework.runLoadTest(profile);

  await saveResults(result, `${profile}-test`);

  console.log('\n📊 Test Results:');
  console.log(`Total Requests: ${result.summary.totalRequests}`);
  console.log(`Success Rate: ${((result.summary.successfulRequests / result.summary.totalRequests) * 100).toFixed(2)}%`);
  console.log(`Average Response Time: ${result.summary.averageResponseTime.toFixed(2)}ms`);
  console.log(`95th Percentile: ${result.summary.p95ResponseTime.toFixed(2)}ms`);
  console.log(`Throughput: ${result.summary.throughput.toFixed(2)} req/s`);

  if (!result.passed) {
    console.log('\n❌ Test failed - threshold violations detected');
    result.thresholdViolations.forEach(v => {
      console.log(`- ${v.metric}: ${v.actual} (threshold: ${v.threshold})`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ Test passed!');
  }
}

async function runBottleneckAnalysis(framework) {
  console.log('🔍 Starting bottleneck analysis...');

  framework.startBottleneckMonitoring();

  console.log('Monitoring for 60 seconds...');
  await sleep(60000);

  const report = framework.getBottleneckReport();
  framework.stopBottleneckMonitoring();

  await saveResults(report, 'bottleneck-analysis');

  console.log('\n📊 Bottleneck Analysis Results:');
  console.log(`Total Bottlenecks: ${report.summary.totalBottlenecks}`);
  console.log(`Critical Issues: ${report.summary.criticalIssues}`);
  console.log(`High Priority Issues: ${report.summary.highPriorityIssues}`);
  console.log(`Status: ${report.summary.status}`);

  if (report.bottlenecks.length > 0) {
    console.log('\n🚨 Detected Bottlenecks:');
    report.bottlenecks.forEach(bottleneck => {
      console.log(`- ${bottleneck.description} (${bottleneck.severity})`);
    });
  }
}

async function runCapacityPlanning(framework) {
  console.log('📈 Generating capacity plan...');

  addSampleData(framework);

  const plan = framework.generateCapacityPlan();

  await saveResults(plan, 'capacity-plan');

  console.log('\n📊 Capacity Planning Results:');
  console.log(`Planning Horizon: ${plan.summary.planningHorizon} months`);
  console.log(`Projected Growth: ${(plan.summary.projectedGrowth * 100).toFixed(1)}%`);
  console.log(`Additional Servers Needed: ${plan.summary.resourceIncrease.additionalServers}`);
  console.log(`Estimated Cost Increase: $${plan.summary.totalCostIncrease.toFixed(2)}/month`);

  if (plan.recommendations.priority.length > 0) {
    console.log('\n📋 Priority Recommendations:');
    plan.recommendations.priority.forEach(rec => {
      console.log(`- ${rec.title}: ${rec.description}`);
    });
  }
}

async function runCustomTest(framework, configFile) {
  if (!configFile) {
    console.error('❌ Custom test requires configuration file');
    console.log('Usage: npm run test custom <config-file.json>');
    process.exit(1);
  }

  console.log(`🔧 Running custom test from ${configFile}...`);

  try {
    const configPath = path.resolve(configFile);
    const configData = await fs.readFile(configPath, 'utf8');
    const testConfig = JSON.parse(configData);

    const result = await framework.runCustomLoadTest(testConfig);

    await saveResults(result, 'custom-test');

    console.log('\n📊 Custom Test Results:');
    displayTestResults(result);

  } catch (error) {
    console.error('❌ Failed to load custom configuration:', error.message);
    process.exit(1);
  }
}

function addSampleData(framework) {
  const sampleData = [
    { requests: 1000, responseTime: 150, errorRate: 0.01, cpuUsage: 45, memoryUsage: 60 },
    { requests: 1200, responseTime: 180, errorRate: 0.015, cpuUsage: 52, memoryUsage: 65 },
    { requests: 1100, responseTime: 160, errorRate: 0.008, cpuUsage: 48, memoryUsage: 62 },
    { requests: 1400, responseTime: 200, errorRate: 0.02, cpuUsage: 58, memoryUsage: 70 },
    { requests: 1300, responseTime: 190, errorRate: 0.012, cpuUsage: 55, memoryUsage: 68 }
  ];

  const now = Date.now();
  sampleData.forEach((data, index) => {
    framework.addHistoricalData({
      timestamp: now - (sampleData.length - index) * 24 * 60 * 60 * 1000,
      ...data,
      servers: 2,
      cpuCores: 8,
      memoryGB: 16,
      costs: { infrastructure: 800, bandwidth: 120, storage: 80, total: 1000 }
    });
  });
}

async function saveResults(results, testType) {
  const outputDir = path.join(__dirname, '../test-results');
  await fs.mkdir(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${testType}_${timestamp}.json`;
  const filepath = path.join(outputDir, filename);

  await fs.writeFile(filepath, JSON.stringify(results, null, 2));
  console.log(`💾 Results saved: ${filepath}`);
}

function displaySummary(summary) {
  console.log('\n📊 Performance Summary:');
  console.log(`Overall Status: ${summary.overall.status}`);
  console.log(`Performance Grade: ${summary.overall.performanceGrade}`);
  console.log(`Total Issues: ${summary.overall.issues}`);
  console.log(`Recommendations: ${summary.overall.recommendations}`);

  console.log('\n🔧 Performance Metrics:');
  console.log(`All Tests Passed: ${summary.performance.allTestsPassed ? '✅' : '❌'}`);
  console.log(`Avg Response Time: ${summary.performance.avgResponseTime.toFixed(2)}ms`);
  console.log(`Throughput: ${summary.performance.throughput.toFixed(2)} req/s`);
  console.log(`Error Rate: ${(summary.performance.errorRate * 100).toFixed(2)}%`);

  if (summary.bottlenecks.totalBottlenecks > 0) {
    console.log('\n🚨 Bottlenecks:');
    console.log(`Critical Issues: ${summary.bottlenecks.criticalIssues}`);
    console.log(`Total Bottlenecks: ${summary.bottlenecks.totalBottlenecks}`);
    console.log(`Primary Concerns: ${summary.bottlenecks.primaryConcerns.join(', ')}`);
  }

  console.log('\n📈 Capacity Planning:');
  console.log(`Projected Growth: ${summary.capacity.projectedGrowth.toFixed(1)}%`);
  console.log(`Additional Resources Needed: ${summary.capacity.resourcesNeeded}`);
  console.log(`Estimated Cost Increase: $${summary.capacity.estimatedCosts.toFixed(2)}/month`);
}

function displayRecommendations(recommendations) {
  if (recommendations.immediate.length > 0) {
    console.log('\n🚨 Immediate Actions Required:');
    recommendations.immediate.forEach(rec => {
      console.log(`- ${rec.title || rec.message}`);
    });
  }

  if (recommendations.shortTerm.length > 0) {
    console.log('\n⏱️  Short-term Improvements:');
    recommendations.shortTerm.forEach(rec => {
      console.log(`- ${rec.title || rec.message}`);
    });
  }

  if (recommendations.longTerm.length > 0) {
    console.log('\n📅 Long-term Strategic Actions:');
    recommendations.longTerm.forEach(rec => {
      console.log(`- ${rec.title || rec.message}`);
    });
  }
}

function displayTestResults(result) {
  console.log(`Total Requests: ${result.summary.totalRequests}`);
  console.log(`Success Rate: ${((result.summary.successfulRequests / result.summary.totalRequests) * 100).toFixed(2)}%`);
  console.log(`Average Response Time: ${result.summary.averageResponseTime.toFixed(2)}ms`);
  console.log(`Throughput: ${result.summary.throughput.toFixed(2)} req/s`);
  console.log(`Test Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
}

function showUsage() {
  console.log('GlobalTaxCalc Performance Testing Framework');
  console.log('');
  console.log('Usage:');
  console.log('  npm run test [command] [options]');
  console.log('');
  console.log('Commands:');
  console.log('  full          Run comprehensive analysis (default)');
  console.log('  load [profile] Run load test (smoke, load, stress, spike)');
  console.log('  bottleneck    Run bottleneck analysis');
  console.log('  capacity      Generate capacity plan');
  console.log('  custom <file> Run custom test from configuration file');
  console.log('');
  console.log('Environment Variables:');
  console.log('  TEST_BASE_URL Target URL for testing (default: http://localhost:3000)');
  console.log('');
  console.log('Examples:');
  console.log('  npm run test');
  console.log('  npm run test load stress');
  console.log('  npm run test custom ./my-test-config.json');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

if (require.main === module) {
  main();
}

module.exports = { main };