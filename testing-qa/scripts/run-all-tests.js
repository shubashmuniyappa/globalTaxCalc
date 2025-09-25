/**
 * Comprehensive Test Automation Script
 * Orchestrates all testing phases with reporting and CI/CD integration
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class TestAutomationOrchestrator {
  constructor(options = {}) {
    this.config = {
      environment: options.environment || 'test',
      baseUrl: options.baseUrl || 'http://localhost:3000',
      apiUrl: options.apiUrl || 'http://localhost:3001',
      parallel: options.parallel || false,
      coverage: options.coverage || true,
      reportDir: options.reportDir || './tests/reports',
      skipTests: options.skipTests || [],
      includeTags: options.includeTags || [],
      excludeTags: options.excludeTags || [],
      slackWebhook: options.slackWebhook || null,
      emailNotifications: options.emailNotifications || false
    };

    this.testSuites = [
      {
        name: 'unit',
        description: 'Unit Tests',
        command: 'npm run test:unit',
        timeout: 300000, // 5 minutes
        critical: true,
        reportFiles: ['junit.xml', 'coverage/lcov.info']
      },
      {
        name: 'integration',
        description: 'Integration Tests',
        command: 'npm run test:integration',
        timeout: 600000, // 10 minutes
        critical: true,
        reportFiles: ['integration-report.xml']
      },
      {
        name: 'e2e',
        description: 'End-to-End Tests',
        command: 'npm run test:e2e',
        timeout: 1200000, // 20 minutes
        critical: true,
        reportFiles: ['cypress-report.xml'],
        requiresServices: true
      },
      {
        name: 'performance',
        description: 'Performance Tests',
        command: 'npm run test:performance',
        timeout: 900000, // 15 minutes
        critical: false,
        reportFiles: ['k6-report.json', 'lighthouse-report.json']
      },
      {
        name: 'security',
        description: 'Security Tests',
        command: 'npm run test:security',
        timeout: 1800000, // 30 minutes
        critical: false,
        reportFiles: ['security-report.json', 'zap-report.xml']
      }
    ];

    this.results = {
      timestamp: new Date().toISOString(),
      environment: this.config.environment,
      suites: {},
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0
      },
      coverage: null,
      notifications: []
    };

    this.ensureReportDir();
  }

  ensureReportDir() {
    if (!fs.existsSync(this.config.reportDir)) {
      fs.mkdirSync(this.config.reportDir, { recursive: true });
    }
  }

  async runAllTests() {
    console.log('🚀 Starting comprehensive test automation...');
    console.log(`Environment: ${this.config.environment}`);
    console.log(`Base URL: ${this.config.baseUrl}`);
    console.log(`Parallel execution: ${this.config.parallel}`);

    const startTime = Date.now();

    try {
      // Pre-test setup
      await this.preTestSetup();

      // Health checks
      await this.runHealthChecks();

      // Execute test suites
      if (this.config.parallel) {
        await this.runTestsInParallel();
      } else {
        await this.runTestsSequentially();
      }

      // Post-test analysis
      await this.postTestAnalysis();

      // Generate reports
      await this.generateReports();

      // Send notifications
      await this.sendNotifications();

      const endTime = Date.now();
      this.results.summary.duration = endTime - startTime;

      console.log('\n✅ Test automation completed successfully');
      this.printSummary();

      // Exit with appropriate code
      process.exit(this.results.summary.failed > 0 ? 1 : 0);

    } catch (error) {
      console.error('\n❌ Test automation failed:', error.message);
      await this.handleFailure(error);
      process.exit(1);
    }
  }

  async preTestSetup() {
    console.log('\n📋 Running pre-test setup...');

    // Clean previous reports
    this.cleanPreviousReports();

    // Setup test database
    await this.setupTestDatabase();

    // Start required services
    if (this.config.environment === 'local') {
      await this.startLocalServices();
    }

    // Wait for services to be ready
    await this.waitForServices();

    console.log('✅ Pre-test setup completed');
  }

  cleanPreviousReports() {
    console.log('  Cleaning previous test reports...');

    const reportFiles = [
      'junit.xml',
      'cypress-report.xml',
      'integration-report.xml',
      'k6-report.json',
      'security-report.json',
      'merged-report.json'
    ];

    reportFiles.forEach(file => {
      const filePath = path.join(this.config.reportDir, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  }

  async setupTestDatabase() {
    console.log('  Setting up test database...');

    try {
      // Run database migrations
      execSync('npm run db:migrate:test', { stdio: 'inherit' });

      // Seed test data
      execSync('npm run db:seed:test', { stdio: 'inherit' });

      console.log('  ✅ Test database setup completed');
    } catch (error) {
      console.error('  ❌ Test database setup failed:', error.message);
      throw error;
    }
  }

  async startLocalServices() {
    console.log('  Starting local services...');

    try {
      // Start Docker containers
      execSync('docker-compose -f docker-compose.test.yml up -d', {
        stdio: 'inherit',
        timeout: 120000
      });

      console.log('  ✅ Local services started');
    } catch (error) {
      console.error('  ❌ Failed to start local services:', error.message);
      throw error;
    }
  }

  async waitForServices() {
    console.log('  Waiting for services to be ready...');

    const services = [
      { name: 'Frontend', url: this.config.baseUrl },
      { name: 'API Gateway', url: this.config.apiUrl }
    ];

    for (const service of services) {
      await this.waitForService(service.name, service.url);
    }

    console.log('  ✅ All services are ready');
  }

  async waitForService(name, url, timeout = 120000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        await axios.get(`${url}/health`, { timeout: 5000 });
        console.log(`    ✅ ${name} is ready`);
        return;
      } catch (error) {
        console.log(`    ⏳ Waiting for ${name}...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    throw new Error(`${name} failed to start within ${timeout}ms`);
  }

  async runHealthChecks() {
    console.log('\n🏥 Running health checks...');

    const healthChecks = [
      {
        name: 'Database Connection',
        check: () => this.checkDatabaseConnection()
      },
      {
        name: 'API Endpoints',
        check: () => this.checkApiEndpoints()
      },
      {
        name: 'External Services',
        check: () => this.checkExternalServices()
      }
    ];

    for (const healthCheck of healthChecks) {
      try {
        await healthCheck.check();
        console.log(`  ✅ ${healthCheck.name}`);
      } catch (error) {
        console.error(`  ❌ ${healthCheck.name}: ${error.message}`);
        throw error;
      }
    }

    console.log('✅ All health checks passed');
  }

  async checkDatabaseConnection() {
    // Test database connection
    const response = await axios.get(`${this.config.apiUrl}/health/db`);
    if (response.status !== 200 || response.data.status !== 'healthy') {
      throw new Error('Database connection failed');
    }
  }

  async checkApiEndpoints() {
    // Test critical API endpoints
    const endpoints = ['/health', '/api/auth/health', '/api/tax/health'];

    for (const endpoint of endpoints) {
      const response = await axios.get(`${this.config.apiUrl}${endpoint}`);
      if (response.status !== 200) {
        throw new Error(`API endpoint ${endpoint} is not responding`);
      }
    }
  }

  async checkExternalServices() {
    // Test external service dependencies
    const response = await axios.get(`${this.config.apiUrl}/health/external`);
    if (response.status !== 200) {
      throw new Error('External services are not available');
    }
  }

  async runTestsInParallel() {
    console.log('\n🔄 Running tests in parallel...');

    const testPromises = this.testSuites
      .filter(suite => !this.config.skipTests.includes(suite.name))
      .map(suite => this.runTestSuite(suite));

    const results = await Promise.allSettled(testPromises);

    results.forEach((result, index) => {
      const suite = this.testSuites[index];
      if (result.status === 'rejected') {
        console.error(`❌ ${suite.description} failed:`, result.reason);
      }
    });
  }

  async runTestsSequentially() {
    console.log('\n🔄 Running tests sequentially...');

    for (const suite of this.testSuites) {
      if (this.config.skipTests.includes(suite.name)) {
        console.log(`⏭️  Skipping ${suite.description}`);
        this.results.suites[suite.name] = {
          status: 'skipped',
          duration: 0
        };
        this.results.summary.skipped++;
        continue;
      }

      try {
        await this.runTestSuite(suite);
      } catch (error) {
        console.error(`❌ ${suite.description} failed:`, error.message);

        if (suite.critical) {
          console.log('🛑 Critical test suite failed, stopping execution');
          throw error;
        }
      }
    }
  }

  async runTestSuite(suite) {
    console.log(`\n🧪 Running ${suite.description}...`);
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const testProcess = spawn('npm', ['run', suite.name.replace('test:', '')], {
        stdio: 'inherit',
        shell: true,
        env: {
          ...process.env,
          NODE_ENV: this.config.environment,
          BASE_URL: this.config.baseUrl,
          API_URL: this.config.apiUrl,
          COVERAGE: this.config.coverage.toString()
        }
      });

      const timeout = setTimeout(() => {
        testProcess.kill('SIGKILL');
        reject(new Error(`Test suite ${suite.name} timed out after ${suite.timeout}ms`));
      }, suite.timeout);

      testProcess.on('close', (code) => {
        clearTimeout(timeout);
        const endTime = Date.now();
        const duration = endTime - startTime;

        const result = {
          status: code === 0 ? 'passed' : 'failed',
          duration: duration,
          exitCode: code,
          reports: this.collectTestReports(suite)
        };

        this.results.suites[suite.name] = result;
        this.results.summary.total++;

        if (code === 0) {
          console.log(`✅ ${suite.description} passed (${(duration / 1000).toFixed(2)}s)`);
          this.results.summary.passed++;
          resolve(result);
        } else {
          console.error(`❌ ${suite.description} failed (${(duration / 1000).toFixed(2)}s)`);
          this.results.summary.failed++;

          if (suite.critical) {
            reject(new Error(`Critical test suite ${suite.name} failed with exit code ${code}`));
          } else {
            resolve(result);
          }
        }
      });

      testProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  collectTestReports(suite) {
    const reports = {};

    suite.reportFiles.forEach(reportFile => {
      const reportPath = path.join(this.config.reportDir, reportFile);
      if (fs.existsSync(reportPath)) {
        try {
          if (reportFile.endsWith('.json')) {
            reports[reportFile] = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
          } else {
            reports[reportFile] = fs.readFileSync(reportPath, 'utf8');
          }
        } catch (error) {
          console.warn(`Failed to read report file ${reportFile}:`, error.message);
        }
      }
    });

    return reports;
  }

  async postTestAnalysis() {
    console.log('\n📊 Running post-test analysis...');

    // Collect coverage data
    if (this.config.coverage) {
      await this.collectCoverageData();
    }

    // Analyze test results
    await this.analyzeTestResults();

    // Check quality gates
    await this.checkQualityGates();

    console.log('✅ Post-test analysis completed');
  }

  async collectCoverageData() {
    console.log('  Collecting coverage data...');

    try {
      // Merge coverage reports
      execSync('npx nyc merge coverage coverage/merged.json', { stdio: 'inherit' });

      // Generate final coverage report
      execSync('npx nyc report --reporter=lcov --reporter=json --reporter=text-summary', {
        stdio: 'inherit'
      });

      // Read coverage summary
      const coveragePath = path.join(this.config.reportDir, 'coverage/coverage-summary.json');
      if (fs.existsSync(coveragePath)) {
        this.results.coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
        console.log('  ✅ Coverage data collected');
      }
    } catch (error) {
      console.warn('  ⚠️  Failed to collect coverage data:', error.message);
    }
  }

  async analyzeTestResults() {
    console.log('  Analyzing test results...');

    // Count test cases across all suites
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    Object.values(this.results.suites).forEach(suite => {
      if (suite.reports && suite.reports['junit.xml']) {
        // Parse JUnit XML to extract test counts
        const testCount = this.parseJUnitResults(suite.reports['junit.xml']);
        totalTests += testCount.total;
        passedTests += testCount.passed;
        failedTests += testCount.failed;
      }
    });

    this.results.testCounts = {
      total: totalTests,
      passed: passedTests,
      failed: failedTests
    };

    console.log(`  📈 Test Analysis: ${passedTests}/${totalTests} tests passed`);
  }

  parseJUnitResults(junitXml) {
    // Simple XML parsing to extract test counts
    const testsuiteMatch = junitXml.match(/<testsuite[^>]*tests="(\d+)"[^>]*failures="(\d+)"[^>]*errors="(\d+)"/);

    if (testsuiteMatch) {
      const total = parseInt(testsuiteMatch[1]);
      const failures = parseInt(testsuiteMatch[2]);
      const errors = parseInt(testsuiteMatch[3]);
      const failed = failures + errors;
      const passed = total - failed;

      return { total, passed, failed };
    }

    return { total: 0, passed: 0, failed: 0 };
  }

  async checkQualityGates() {
    console.log('  Checking quality gates...');

    const qualityGates = {
      coverageThreshold: 90,
      maxFailedTests: 0,
      maxCriticalIssues: 0,
      performanceThreshold: 3000 // ms
    };

    const gateResults = [];

    // Coverage gate
    if (this.results.coverage) {
      const overallCoverage = this.results.coverage.total.lines.pct;
      const coveragePassed = overallCoverage >= qualityGates.coverageThreshold;

      gateResults.push({
        name: 'Code Coverage',
        passed: coveragePassed,
        value: `${overallCoverage}%`,
        threshold: `${qualityGates.coverageThreshold}%`
      });
    }

    // Test failure gate
    const testFailurePassed = this.results.summary.failed <= qualityGates.maxFailedTests;
    gateResults.push({
      name: 'Test Failures',
      passed: testFailurePassed,
      value: this.results.summary.failed,
      threshold: qualityGates.maxFailedTests
    });

    // Performance gate
    const performanceResults = this.results.suites.performance?.reports?.['k6-report.json'];
    if (performanceResults) {
      const avgResponseTime = performanceResults.metrics?.http_req_duration?.avg;
      const performancePassed = avgResponseTime <= qualityGates.performanceThreshold;

      gateResults.push({
        name: 'Performance',
        passed: performancePassed,
        value: `${avgResponseTime}ms`,
        threshold: `${qualityGates.performanceThreshold}ms`
      });
    }

    this.results.qualityGates = gateResults;

    // Log results
    gateResults.forEach(gate => {
      const status = gate.passed ? '✅' : '❌';
      console.log(`    ${status} ${gate.name}: ${gate.value} (threshold: ${gate.threshold})`);
    });

    const allGatesPassed = gateResults.every(gate => gate.passed);
    if (!allGatesPassed) {
      console.log('  ⚠️  Some quality gates failed');
    } else {
      console.log('  ✅ All quality gates passed');
    }
  }

  async generateReports() {
    console.log('\n📄 Generating comprehensive reports...');

    // Generate JSON report
    const jsonReport = path.join(this.config.reportDir, 'test-automation-report.json');
    fs.writeFileSync(jsonReport, JSON.stringify(this.results, null, 2));

    // Generate HTML report
    const htmlReport = this.generateHTMLReport();
    const htmlReportPath = path.join(this.config.reportDir, 'test-automation-report.html');
    fs.writeFileSync(htmlReportPath, htmlReport);

    // Generate JUnit merged report
    await this.generateMergedJUnitReport();

    // Generate Slack report
    if (this.config.slackWebhook) {
      await this.generateSlackReport();
    }

    console.log(`✅ Reports generated in ${this.config.reportDir}`);
  }

  generateHTMLReport() {
    const passRate = this.results.summary.total > 0
      ? ((this.results.summary.passed / this.results.summary.total) * 100).toFixed(1)
      : 0;

    return `
<!DOCTYPE html>
<html>
<head>
    <title>GlobalTaxCalc Test Automation Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .passed { color: #4caf50; }
        .failed { color: #f44336; }
        .skipped { color: #ff9800; }
        .suite { margin: 15px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .metric { background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>GlobalTaxCalc Test Automation Report</h1>

    <div class="summary">
        <h2>Execution Summary</h2>
        <p><strong>Environment:</strong> ${this.results.environment}</p>
        <p><strong>Timestamp:</strong> ${this.results.timestamp}</p>
        <p><strong>Duration:</strong> ${(this.results.summary.duration / 1000 / 60).toFixed(2)} minutes</p>
        <p><strong>Pass Rate:</strong> ${passRate}%</p>
    </div>

    <div class="metrics">
        <div class="metric">
            <h3>Test Suites</h3>
            <p class="passed">Passed: ${this.results.summary.passed}</p>
            <p class="failed">Failed: ${this.results.summary.failed}</p>
            <p class="skipped">Skipped: ${this.results.summary.skipped}</p>
        </div>

        ${this.results.coverage ? `
        <div class="metric">
            <h3>Code Coverage</h3>
            <p>Lines: ${this.results.coverage.total.lines.pct}%</p>
            <p>Functions: ${this.results.coverage.total.functions.pct}%</p>
            <p>Branches: ${this.results.coverage.total.branches.pct}%</p>
        </div>
        ` : ''}

        ${this.results.testCounts ? `
        <div class="metric">
            <h3>Test Cases</h3>
            <p class="passed">Passed: ${this.results.testCounts.passed}</p>
            <p class="failed">Failed: ${this.results.testCounts.failed}</p>
            <p>Total: ${this.results.testCounts.total}</p>
        </div>
        ` : ''}
    </div>

    <h2>Test Suite Results</h2>
    ${Object.entries(this.results.suites).map(([name, suite]) => `
        <div class="suite">
            <h3 class="${suite.status}">${name.toUpperCase()}</h3>
            <p><strong>Status:</strong> <span class="${suite.status}">${suite.status.toUpperCase()}</span></p>
            <p><strong>Duration:</strong> ${(suite.duration / 1000).toFixed(2)}s</p>
            ${suite.exitCode !== undefined ? `<p><strong>Exit Code:</strong> ${suite.exitCode}</p>` : ''}
        </div>
    `).join('')}

    ${this.results.qualityGates ? `
    <h2>Quality Gates</h2>
    <table>
        <tr><th>Gate</th><th>Value</th><th>Threshold</th><th>Status</th></tr>
        ${this.results.qualityGates.map(gate => `
            <tr>
                <td>${gate.name}</td>
                <td>${gate.value}</td>
                <td>${gate.threshold}</td>
                <td class="${gate.passed ? 'passed' : 'failed'}">${gate.passed ? 'PASS' : 'FAIL'}</td>
            </tr>
        `).join('')}
    </table>
    ` : ''}

    <p><em>Generated on ${new Date().toISOString()}</em></p>
</body>
</html>
    `;
  }

  async generateMergedJUnitReport() {
    try {
      execSync('npx junit-merge --recursive --dir tests/reports --out tests/reports/merged-junit.xml', {
        stdio: 'inherit'
      });
    } catch (error) {
      console.warn('Failed to merge JUnit reports:', error.message);
    }
  }

  async generateSlackReport() {
    const slackMessage = {
      text: 'Test Automation Results',
      attachments: [{
        color: this.results.summary.failed > 0 ? 'danger' : 'good',
        fields: [
          {
            title: 'Environment',
            value: this.results.environment,
            short: true
          },
          {
            title: 'Duration',
            value: `${(this.results.summary.duration / 1000 / 60).toFixed(2)} min`,
            short: true
          },
          {
            title: 'Test Suites',
            value: `✅ ${this.results.summary.passed} ❌ ${this.results.summary.failed} ⏭️ ${this.results.summary.skipped}`,
            short: false
          }
        ]
      }]
    };

    try {
      await axios.post(this.config.slackWebhook, slackMessage);
      console.log('  ✅ Slack notification sent');
    } catch (error) {
      console.warn('  ⚠️  Failed to send Slack notification:', error.message);
    }
  }

  async sendNotifications() {
    console.log('\n📧 Sending notifications...');

    if (this.config.slackWebhook) {
      await this.generateSlackReport();
    }

    if (this.config.emailNotifications) {
      await this.sendEmailNotification();
    }

    console.log('✅ Notifications sent');
  }

  async sendEmailNotification() {
    // Email notification implementation would go here
    console.log('  📧 Email notification feature not implemented');
  }

  async handleFailure(error) {
    console.error('\n💥 Test automation failed:', error.message);

    // Generate failure report
    const failureReport = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      partialResults: this.results
    };

    fs.writeFileSync(
      path.join(this.config.reportDir, 'failure-report.json'),
      JSON.stringify(failureReport, null, 2)
    );

    // Send failure notification
    if (this.config.slackWebhook) {
      const failureMessage = {
        text: '🚨 Test Automation Failed',
        attachments: [{
          color: 'danger',
          fields: [
            {
              title: 'Error',
              value: error.message,
              short: false
            },
            {
              title: 'Environment',
              value: this.config.environment,
              short: true
            }
          ]
        }]
      };

      try {
        await axios.post(this.config.slackWebhook, failureMessage);
      } catch (notificationError) {
        console.error('Failed to send failure notification:', notificationError.message);
      }
    }
  }

  printSummary() {
    console.log('\n📊 Test Automation Summary');
    console.log('=' .repeat(50));
    console.log(`Environment: ${this.results.environment}`);
    console.log(`Duration: ${(this.results.summary.duration / 1000 / 60).toFixed(2)} minutes`);
    console.log(`Test Suites: ${this.results.summary.passed}/${this.results.summary.total} passed`);

    if (this.results.coverage) {
      console.log(`Code Coverage: ${this.results.coverage.total.lines.pct}%`);
    }

    if (this.results.testCounts) {
      console.log(`Test Cases: ${this.results.testCounts.passed}/${this.results.testCounts.total} passed`);
    }

    // Quality gates summary
    if (this.results.qualityGates) {
      const passedGates = this.results.qualityGates.filter(gate => gate.passed).length;
      const totalGates = this.results.qualityGates.length;
      console.log(`Quality Gates: ${passedGates}/${totalGates} passed`);
    }

    console.log('=' .repeat(50));
  }
}

// CLI execution
if (require.main === module) {
  const config = {
    environment: process.env.NODE_ENV || 'test',
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    apiUrl: process.env.API_URL || 'http://localhost:3001',
    parallel: process.env.PARALLEL === 'true',
    coverage: process.env.COVERAGE !== 'false',
    skipTests: (process.env.SKIP_TESTS || '').split(',').filter(Boolean),
    slackWebhook: process.env.SLACK_WEBHOOK_URL
  };

  const orchestrator = new TestAutomationOrchestrator(config);
  orchestrator.runAllTests();
}

module.exports = TestAutomationOrchestrator;