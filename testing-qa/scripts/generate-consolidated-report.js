/**
 * Consolidated Test Report Generator
 * Generates comprehensive reports combining all testing activities
 */

const fs = require('fs');
const path = require('path');

class ConsolidatedReportGenerator {
  constructor(options = {}) {
    this.config = {
      reportsDir: options.reportsDir || './tests/reports',
      outputDir: options.outputDir || './tests/reports/consolidated',
      projectName: options.projectName || 'GlobalTaxCalc',
      includeCharts: options.includeCharts || true,
      format: options.format || 'html' // html, pdf, json
    };

    this.reportData = {
      metadata: {
        projectName: this.config.projectName,
        generatedAt: new Date().toISOString(),
        generatedBy: 'Automated Testing System',
        version: '1.0.0'
      },
      summary: {
        overallStatus: 'PENDING',
        testExecution: {},
        qualityMetrics: {},
        securityStatus: {},
        performanceMetrics: {},
        recommendations: []
      },
      sections: {
        testResults: {},
        coverage: {},
        performance: {},
        security: {},
        qualityGates: {},
        trends: {}
      }
    };

    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
  }

  async generateConsolidatedReport() {
    console.log('📊 Generating consolidated test report...');

    try {
      // Collect data from all test reports
      await this.collectTestResults();
      await this.collectCoverageData();
      await this.collectPerformanceData();
      await this.collectSecurityData();
      await this.collectQualityGatesData();

      // Analyze and summarize
      this.generateSummary();
      this.generateRecommendations();

      // Generate reports in different formats
      await this.generateHTMLReport();
      await this.generateJSONReport();

      if (this.config.format === 'pdf') {
        await this.generatePDFReport();
      }

      // Generate dashboard data
      await this.generateDashboardData();

      console.log('✅ Consolidated report generated successfully');
      this.printSummary();

    } catch (error) {
      console.error('❌ Failed to generate consolidated report:', error.message);
      throw error;
    }
  }

  async collectTestResults() {
    console.log('  📋 Collecting test results...');

    const testResults = {
      unit: this.loadJUnitReport('junit.xml'),
      integration: this.loadJUnitReport('integration-report.xml'),
      e2e: this.loadJUnitReport('cypress-report.xml'),
      api: this.loadJUnitReport('api-test-report.xml'),
      component: this.loadJUnitReport('component-test-report.xml')
    };

    // Calculate aggregated metrics
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    let skippedTests = 0;
    let totalDuration = 0;

    Object.values(testResults).forEach(result => {
      if (result) {
        totalTests += result.total;
        passedTests += result.passed;
        failedTests += result.failed;
        skippedTests += result.skipped || 0;
        totalDuration += result.duration || 0;
      }
    });

    this.reportData.sections.testResults = {
      byType: testResults,
      aggregate: {
        total: totalTests,
        passed: passedTests,
        failed: failedTests,
        skipped: skippedTests,
        passRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
        duration: totalDuration
      }
    };

    this.reportData.summary.testExecution = {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      passRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
      status: failedTests === 0 ? 'PASSED' : 'FAILED'
    };
  }

  loadJUnitReport(filename) {
    const filePath = path.join(this.config.reportsDir, filename);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return this.parseJUnitXML(content);
    } catch (error) {
      console.warn(`Failed to load ${filename}:`, error.message);
      return null;
    }
  }

  parseJUnitXML(xmlContent) {
    // Simple XML parsing for JUnit format
    const testsuiteMatch = xmlContent.match(
      /<testsuite[^>]*tests="(\d+)"[^>]*failures="(\d+)"[^>]*errors="(\d+)"[^>]*skipped="(\d+)"[^>]*time="([^"]*)"[^>]*>/
    );

    if (testsuiteMatch) {
      const total = parseInt(testsuiteMatch[1]);
      const failures = parseInt(testsuiteMatch[2]);
      const errors = parseInt(testsuiteMatch[3]);
      const skipped = parseInt(testsuiteMatch[4]);
      const duration = parseFloat(testsuiteMatch[5]);

      const failed = failures + errors;
      const passed = total - failed - skipped;

      return {
        total,
        passed,
        failed,
        skipped,
        duration,
        passRate: total > 0 ? (passed / total) * 100 : 0
      };
    }

    return null;
  }

  async collectCoverageData() {
    console.log('  📊 Collecting coverage data...');

    const coverageSummaryPath = path.join(this.config.reportsDir, 'coverage/coverage-summary.json');

    if (fs.existsSync(coverageSummaryPath)) {
      const coverageData = JSON.parse(fs.readFileSync(coverageSummaryPath, 'utf8'));

      this.reportData.sections.coverage = {
        total: coverageData.total,
        byFile: Object.entries(coverageData)
          .filter(([key]) => key !== 'total')
          .map(([file, data]) => ({
            file,
            lines: data.lines.pct,
            functions: data.functions.pct,
            branches: data.branches.pct,
            statements: data.statements.pct
          }))
      };

      this.reportData.summary.qualityMetrics.coverage = {
        lines: coverageData.total.lines.pct,
        functions: coverageData.total.functions.pct,
        branches: coverageData.total.branches.pct,
        statements: coverageData.total.statements.pct,
        status: coverageData.total.lines.pct >= 80 ? 'PASSED' : 'FAILED'
      };
    }
  }

  async collectPerformanceData() {
    console.log('  ⚡ Collecting performance data...');

    // Load K6 performance results
    const k6ReportPath = path.join(this.config.reportsDir, 'performance/k6-report.json');
    if (fs.existsSync(k6ReportPath)) {
      const k6Data = JSON.parse(fs.readFileSync(k6ReportPath, 'utf8'));

      this.reportData.sections.performance.loadTesting = {
        avgResponseTime: k6Data.metrics?.http_req_duration?.avg,
        p95ResponseTime: k6Data.metrics?.http_req_duration?.['p(95)'],
        errorRate: k6Data.metrics?.http_req_failed?.rate,
        throughput: k6Data.metrics?.http_reqs?.rate,
        virtualUsers: k6Data.metrics?.vus?.value
      };
    }

    // Load Lighthouse performance results
    const lighthouseReportPath = path.join(this.config.reportsDir, 'performance/lighthouse-report.json');
    if (fs.existsSync(lighthouseReportPath)) {
      const lighthouseData = JSON.parse(fs.readFileSync(lighthouseReportPath, 'utf8'));

      this.reportData.sections.performance.webVitals = {
        performanceScore: lighthouseData.categories?.performance?.score * 100,
        firstContentfulPaint: lighthouseData.audits?.['first-contentful-paint']?.numericValue,
        largestContentfulPaint: lighthouseData.audits?.['largest-contentful-paint']?.numericValue,
        cumulativeLayoutShift: lighthouseData.audits?.['cumulative-layout-shift']?.numericValue,
        totalBlockingTime: lighthouseData.audits?.['total-blocking-time']?.numericValue
      };
    }

    // Aggregate performance metrics
    const performance = this.reportData.sections.performance;
    this.reportData.summary.performanceMetrics = {
      averageResponseTime: performance.loadTesting?.avgResponseTime || 0,
      lighthouseScore: performance.webVitals?.performanceScore || 0,
      status: (performance.loadTesting?.avgResponseTime || 0) < 2000 ? 'PASSED' : 'FAILED'
    };
  }

  async collectSecurityData() {
    console.log('  🔒 Collecting security data...');

    // Load OWASP ZAP results
    const zapReportPath = path.join(this.config.reportsDir, 'security/zap-security-report.json');
    if (fs.existsSync(zapReportPath)) {
      const zapData = JSON.parse(fs.readFileSync(zapReportPath, 'utf8'));

      const alerts = zapData.site?.[0]?.alerts || [];
      this.reportData.sections.security.webScan = {
        totalIssues: alerts.length,
        highRisk: alerts.filter(alert => alert.riskdesc === 'High').length,
        mediumRisk: alerts.filter(alert => alert.riskdesc === 'Medium').length,
        lowRisk: alerts.filter(alert => alert.riskdesc === 'Low').length,
        informational: alerts.filter(alert => alert.riskdesc === 'Informational').length,
        vulnerabilities: alerts.map(alert => ({
          name: alert.name,
          risk: alert.riskdesc,
          confidence: alert.confidence,
          description: alert.desc,
          solution: alert.solution
        }))
      };
    }

    // Load dependency scan results
    const dependencyReportPath = path.join(this.config.reportsDir, 'security/dependency-security-report.json');
    if (fs.existsSync(dependencyReportPath)) {
      const depData = JSON.parse(fs.readFileSync(dependencyReportPath, 'utf8'));

      this.reportData.sections.security.dependencies = {
        totalVulnerabilities: depData.summary?.totalVulnerabilities || 0,
        criticalIssues: depData.summary?.criticalIssues || 0,
        highSeverityIssues: depData.summary?.highSeverityIssues || 0,
        recommendations: depData.recommendations || []
      };
    }

    // Aggregate security status
    const security = this.reportData.sections.security;
    const totalCritical = (security.webScan?.highRisk || 0) + (security.dependencies?.criticalIssues || 0);

    this.reportData.summary.securityStatus = {
      totalIssues: (security.webScan?.totalIssues || 0) + (security.dependencies?.totalVulnerabilities || 0),
      criticalIssues: totalCritical,
      status: totalCritical === 0 ? 'PASSED' : 'FAILED'
    };
  }

  async collectQualityGatesData() {
    console.log('  🏁 Collecting quality gates data...');

    const qualityGatesPath = path.join(this.config.reportsDir, 'quality-gates-report.json');

    if (fs.existsSync(qualityGatesPath)) {
      const qualityData = JSON.parse(fs.readFileSync(qualityGatesPath, 'utf8'));

      this.reportData.sections.qualityGates = {
        gates: qualityData.gates || [],
        summary: qualityData.summary || {},
        recommendations: qualityData.recommendations || []
      };
    }
  }

  generateSummary() {
    console.log('  📈 Generating summary...');

    const { testExecution, qualityMetrics, securityStatus, performanceMetrics } = this.reportData.summary;

    // Determine overall status
    let overallStatus = 'PASSED';

    if (testExecution.status === 'FAILED' ||
        securityStatus.status === 'FAILED' ||
        performanceMetrics.status === 'FAILED' ||
        qualityMetrics.coverage?.status === 'FAILED') {
      overallStatus = 'FAILED';
    } else if (testExecution.failed > 0 ||
               securityStatus.totalIssues > 0 ||
               performanceMetrics.averageResponseTime > 1500) {
      overallStatus = 'WARNING';
    }

    this.reportData.summary.overallStatus = overallStatus;

    // Calculate quality score (0-100)
    let qualityScore = 100;

    // Deduct points for test failures
    if (testExecution.total > 0) {
      qualityScore -= (testExecution.failed / testExecution.total) * 30;
    }

    // Deduct points for low coverage
    if (qualityMetrics.coverage) {
      const coverageDeduction = Math.max(0, (80 - qualityMetrics.coverage.lines) * 0.5);
      qualityScore -= coverageDeduction;
    }

    // Deduct points for security issues
    qualityScore -= securityStatus.criticalIssues * 10;
    qualityScore -= Math.max(0, securityStatus.totalIssues - securityStatus.criticalIssues) * 2;

    // Deduct points for performance issues
    if (performanceMetrics.averageResponseTime > 2000) {
      qualityScore -= 15;
    } else if (performanceMetrics.averageResponseTime > 1000) {
      qualityScore -= 5;
    }

    this.reportData.summary.qualityScore = Math.max(0, Math.round(qualityScore));
  }

  generateRecommendations() {
    console.log('  💡 Generating recommendations...');

    const recommendations = [];
    const { testExecution, securityStatus, performanceMetrics, qualityMetrics } = this.reportData.summary;

    // Test recommendations
    if (testExecution.failed > 0) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Testing',
        title: 'Fix failing tests',
        description: `${testExecution.failed} tests are currently failing`,
        action: 'Review and fix failing test cases before deployment',
        impact: 'Failed tests indicate potential bugs or regressions'
      });
    }

    if (testExecution.passRate < 95) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Testing',
        title: 'Improve test pass rate',
        description: `Test pass rate is ${testExecution.passRate.toFixed(1)}%`,
        action: 'Investigate and fix unstable tests',
        impact: 'Low pass rate indicates test instability'
      });
    }

    // Coverage recommendations
    if (qualityMetrics.coverage && qualityMetrics.coverage.lines < 80) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Quality',
        title: 'Increase test coverage',
        description: `Code coverage is ${qualityMetrics.coverage.lines}%`,
        action: 'Add unit tests for uncovered code paths',
        impact: 'Low coverage increases risk of undetected bugs'
      });
    }

    // Security recommendations
    if (securityStatus.criticalIssues > 0) {
      recommendations.push({
        priority: 'CRITICAL',
        category: 'Security',
        title: 'Fix critical security vulnerabilities',
        description: `${securityStatus.criticalIssues} critical security issues found`,
        action: 'Address critical security vulnerabilities immediately',
        impact: 'Critical vulnerabilities pose immediate risk to application security'
      });
    }

    // Performance recommendations
    if (performanceMetrics.averageResponseTime > 2000) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Performance',
        title: 'Optimize application performance',
        description: `Average response time is ${performanceMetrics.averageResponseTime}ms`,
        action: 'Profile and optimize slow endpoints and database queries',
        impact: 'Poor performance affects user experience and scalability'
      });
    }

    // Sort by priority
    const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    this.reportData.summary.recommendations = recommendations.slice(0, 10); // Top 10
  }

  async generateHTMLReport() {
    console.log('  📄 Generating HTML report...');

    const htmlContent = this.generateHTMLContent();
    const htmlPath = path.join(this.config.outputDir, 'consolidated-report.html');

    fs.writeFileSync(htmlPath, htmlContent);
    console.log(`    ✅ HTML report saved: ${htmlPath}`);
  }

  generateHTMLContent() {
    const data = this.reportData;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.metadata.projectName} - Consolidated Test Report</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f8f9fa;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
            border-radius: 10px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
        }

        .header p {
            font-size: 1.1rem;
            opacity: 0.9;
        }

        .summary-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }

        .card {
            background: white;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            text-align: center;
            position: relative;
            overflow: hidden;
        }

        .card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: var(--accent-color);
        }

        .card-value {
            font-size: 2.5rem;
            font-weight: bold;
            color: var(--accent-color);
            margin-bottom: 10px;
        }

        .card-label {
            font-size: 0.9rem;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .status-passed {
            --accent-color: #28a745;
        }

        .status-failed {
            --accent-color: #dc3545;
        }

        .status-warning {
            --accent-color: #ffc107;
        }

        .section {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            margin-bottom: 30px;
        }

        .section h2 {
            color: #333;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e9ecef;
        }

        .table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }

        .table th,
        .table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e9ecef;
        }

        .table th {
            background-color: #f8f9fa;
            font-weight: 600;
            color: #495057;
        }

        .badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8rem;
            font-weight: 500;
            text-transform: uppercase;
        }

        .badge-success {
            background-color: #d4edda;
            color: #155724;
        }

        .badge-danger {
            background-color: #f8d7da;
            color: #721c24;
        }

        .badge-warning {
            background-color: #fff3cd;
            color: #856404;
        }

        .chart-container {
            position: relative;
            height: 300px;
            margin: 20px 0;
        }

        .recommendations {
            list-style: none;
            padding: 0;
        }

        .recommendation {
            padding: 15px;
            margin: 10px 0;
            border-left: 4px solid #667eea;
            background: #f8f9fa;
            border-radius: 0 8px 8px 0;
        }

        .recommendation.critical {
            border-left-color: #dc3545;
        }

        .recommendation.high {
            border-left-color: #fd7e14;
        }

        .recommendation.medium {
            border-left-color: #ffc107;
        }

        .recommendation-title {
            font-weight: 600;
            color: #333;
            margin-bottom: 5px;
        }

        .recommendation-desc {
            color: #666;
            font-size: 0.9rem;
        }

        .metadata {
            font-size: 0.9rem;
            color: #666;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${data.metadata.projectName}</h1>
            <p>Consolidated Test Report</p>
            <p style="font-size: 0.9rem; margin-top: 10px;">
                Generated on ${new Date(data.metadata.generatedAt).toLocaleString()}
            </p>
        </div>

        <!-- Summary Cards -->
        <div class="summary-cards">
            <div class="card status-${data.summary.overallStatus.toLowerCase()}">
                <div class="card-value">${data.summary.overallStatus}</div>
                <div class="card-label">Overall Status</div>
            </div>

            <div class="card status-${data.summary.testExecution.status?.toLowerCase() || 'warning'}">
                <div class="card-value">${data.summary.testExecution.passRate?.toFixed(1) || 0}%</div>
                <div class="card-label">Test Pass Rate</div>
            </div>

            <div class="card status-${data.summary.qualityMetrics.coverage?.status?.toLowerCase() || 'warning'}">
                <div class="card-value">${data.summary.qualityMetrics.coverage?.lines?.toFixed(1) || 0}%</div>
                <div class="card-label">Code Coverage</div>
            </div>

            <div class="card status-${data.summary.securityStatus.status?.toLowerCase() || 'warning'}">
                <div class="card-value">${data.summary.securityStatus.criticalIssues || 0}</div>
                <div class="card-label">Critical Issues</div>
            </div>

            <div class="card status-${data.summary.performanceMetrics.status?.toLowerCase() || 'warning'}">
                <div class="card-value">${data.summary.performanceMetrics.averageResponseTime?.toFixed(0) || 0}ms</div>
                <div class="card-label">Avg Response Time</div>
            </div>

            <div class="card">
                <div class="card-value" style="--accent-color: #6f42c1;">${data.summary.qualityScore || 0}</div>
                <div class="card-label">Quality Score</div>
            </div>
        </div>

        <!-- Test Results Section -->
        <div class="section">
            <h2>📋 Test Execution Summary</h2>
            <div class="summary-cards">
                <div class="card">
                    <div class="card-value" style="--accent-color: #17a2b8;">${data.summary.testExecution.total || 0}</div>
                    <div class="card-label">Total Tests</div>
                </div>
                <div class="card status-passed">
                    <div class="card-value">${data.summary.testExecution.passed || 0}</div>
                    <div class="card-label">Passed</div>
                </div>
                <div class="card status-failed">
                    <div class="card-value">${data.summary.testExecution.failed || 0}</div>
                    <div class="card-label">Failed</div>
                </div>
            </div>

            ${this.generateTestResultsTable(data.sections.testResults)}
        </div>

        <!-- Security Section -->
        ${data.sections.security ? `
        <div class="section">
            <h2>🔒 Security Analysis</h2>
            ${this.generateSecurityContent(data.sections.security)}
        </div>
        ` : ''}

        <!-- Performance Section -->
        ${data.sections.performance ? `
        <div class="section">
            <h2>⚡ Performance Metrics</h2>
            ${this.generatePerformanceContent(data.sections.performance)}
        </div>
        ` : ''}

        <!-- Recommendations Section -->
        ${data.summary.recommendations.length > 0 ? `
        <div class="section">
            <h2>💡 Recommendations</h2>
            <ul class="recommendations">
                ${data.summary.recommendations.map(rec => `
                    <li class="recommendation ${rec.priority.toLowerCase()}">
                        <div class="recommendation-title">
                            [${rec.priority}] ${rec.title}
                        </div>
                        <div class="recommendation-desc">
                            ${rec.description} - ${rec.action}
                        </div>
                    </li>
                `).join('')}
            </ul>
        </div>
        ` : ''}

        <div class="metadata">
            <p><strong>Report Generated:</strong> ${new Date(data.metadata.generatedAt).toLocaleString()}</p>
            <p><strong>Generated By:</strong> ${data.metadata.generatedBy}</p>
            <p><strong>Version:</strong> ${data.metadata.version}</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  generateTestResultsTable(testResults) {
    if (!testResults.byType) return '';

    const tableRows = Object.entries(testResults.byType)
      .filter(([_, result]) => result !== null)
      .map(([type, result]) => `
        <tr>
            <td>${type.charAt(0).toUpperCase() + type.slice(1)}</td>
            <td>${result.total}</td>
            <td><span class="badge badge-success">${result.passed}</span></td>
            <td><span class="badge badge-danger">${result.failed}</span></td>
            <td>${result.passRate.toFixed(1)}%</td>
            <td>${result.duration ? this.formatDuration(result.duration) : 'N/A'}</td>
        </tr>
      `).join('');

    return `
      <table class="table">
          <thead>
              <tr>
                  <th>Test Type</th>
                  <th>Total</th>
                  <th>Passed</th>
                  <th>Failed</th>
                  <th>Pass Rate</th>
                  <th>Duration</th>
              </tr>
          </thead>
          <tbody>
              ${tableRows}
          </tbody>
      </table>
    `;
  }

  generateSecurityContent(security) {
    let content = '';

    if (security.webScan) {
      content += `
        <h3>Web Application Scan</h3>
        <div class="summary-cards">
            <div class="card status-failed">
                <div class="card-value">${security.webScan.highRisk}</div>
                <div class="card-label">High Risk</div>
            </div>
            <div class="card status-warning">
                <div class="card-value">${security.webScan.mediumRisk}</div>
                <div class="card-label">Medium Risk</div>
            </div>
            <div class="card">
                <div class="card-value" style="--accent-color: #17a2b8;">${security.webScan.lowRisk}</div>
                <div class="card-label">Low Risk</div>
            </div>
        </div>
      `;
    }

    if (security.dependencies) {
      content += `
        <h3>Dependency Scan</h3>
        <div class="summary-cards">
            <div class="card status-failed">
                <div class="card-value">${security.dependencies.criticalIssues}</div>
                <div class="card-label">Critical</div>
            </div>
            <div class="card status-warning">
                <div class="card-value">${security.dependencies.highSeverityIssues}</div>
                <div class="card-label">High Severity</div>
            </div>
            <div class="card">
                <div class="card-value" style="--accent-color: #17a2b8;">${security.dependencies.totalVulnerabilities}</div>
                <div class="card-label">Total Issues</div>
            </div>
        </div>
      `;
    }

    return content;
  }

  generatePerformanceContent(performance) {
    let content = '';

    if (performance.loadTesting) {
      content += `
        <h3>Load Testing Results</h3>
        <div class="summary-cards">
            <div class="card">
                <div class="card-value" style="--accent-color: #28a745;">${performance.loadTesting.avgResponseTime?.toFixed(0) || 0}ms</div>
                <div class="card-label">Avg Response Time</div>
            </div>
            <div class="card">
                <div class="card-value" style="--accent-color: #17a2b8;">${performance.loadTesting.p95ResponseTime?.toFixed(0) || 0}ms</div>
                <div class="card-label">95th Percentile</div>
            </div>
            <div class="card">
                <div class="card-value" style="--accent-color: #6f42c1;">${performance.loadTesting.throughput?.toFixed(1) || 0}</div>
                <div class="card-label">Requests/sec</div>
            </div>
        </div>
      `;
    }

    if (performance.webVitals) {
      content += `
        <h3>Web Vitals</h3>
        <div class="summary-cards">
            <div class="card">
                <div class="card-value" style="--accent-color: #fd7e14;">${performance.webVitals.performanceScore?.toFixed(0) || 0}</div>
                <div class="card-label">Lighthouse Score</div>
            </div>
            <div class="card">
                <div class="card-value" style="--accent-color: #20c997;">${performance.webVitals.firstContentfulPaint?.toFixed(0) || 0}ms</div>
                <div class="card-label">First Contentful Paint</div>
            </div>
            <div class="card">
                <div class="card-value" style="--accent-color: #e83e8c;">${performance.webVitals.largestContentfulPaint?.toFixed(0) || 0}ms</div>
                <div class="card-label">Largest Contentful Paint</div>
            </div>
        </div>
      `;
    }

    return content;
  }

  async generateJSONReport() {
    console.log('  📄 Generating JSON report...');

    const jsonPath = path.join(this.config.outputDir, 'consolidated-report.json');
    fs.writeFileSync(jsonPath, JSON.stringify(this.reportData, null, 2));

    console.log(`    ✅ JSON report saved: ${jsonPath}`);
  }

  async generateDashboardData() {
    console.log('  📊 Generating dashboard data...');

    const dashboardData = {
      lastUpdated: new Date().toISOString(),
      summary: this.reportData.summary,
      testSuites: this.generateTestSuitesData(),
      trends: this.generateTrendsData(),
      charts: this.generateChartsData()
    };

    const dashboardPath = path.join(this.config.outputDir, 'dashboard-data.json');
    fs.writeFileSync(dashboardPath, JSON.stringify(dashboardData, null, 2));

    console.log(`    ✅ Dashboard data saved: ${dashboardPath}`);
  }

  generateTestSuitesData() {
    const { byType } = this.reportData.sections.testResults;

    return Object.entries(byType)
      .filter(([_, result]) => result !== null)
      .map(([type, result]) => ({
        name: type.charAt(0).toUpperCase() + type.slice(1),
        status: result.failed === 0 ? 'passed' : 'failed',
        total: result.total,
        passed: result.passed,
        failed: result.failed,
        passRate: result.passRate,
        duration: result.duration
      }));
  }

  generateTrendsData() {
    // This would typically come from historical data
    // For now, return mock trend data
    return {
      testResults: {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        datasets: [
          {
            label: 'Pass Rate',
            data: [95, 97, 94, 98]
          }
        ]
      },
      coverage: {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        datasets: [
          {
            label: 'Coverage %',
            data: [82, 85, 87, 87]
          }
        ]
      }
    };
  }

  generateChartsData() {
    return {
      testDistribution: {
        labels: ['Unit', 'Integration', 'E2E', 'Performance'],
        data: [245, 78, 35, 12]
      },
      issuesByCategory: {
        labels: ['Security', 'Performance', 'Quality', 'Coverage'],
        data: [2, 1, 3, 1]
      }
    };
  }

  formatDuration(seconds) {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }

  printSummary() {
    console.log('\n📊 Consolidated Report Summary');
    console.log('=' .repeat(50));
    console.log(`Overall Status: ${this.reportData.summary.overallStatus}`);
    console.log(`Quality Score: ${this.reportData.summary.qualityScore}/100`);
    console.log(`Test Pass Rate: ${this.reportData.summary.testExecution.passRate?.toFixed(1) || 0}%`);
    console.log(`Code Coverage: ${this.reportData.summary.qualityMetrics.coverage?.lines?.toFixed(1) || 0}%`);
    console.log(`Critical Issues: ${this.reportData.summary.securityStatus.criticalIssues || 0}`);

    if (this.reportData.summary.recommendations.length > 0) {
      console.log('\n💡 Top Recommendations:');
      this.reportData.summary.recommendations.slice(0, 3).forEach((rec, index) => {
        console.log(`  ${index + 1}. [${rec.priority}] ${rec.title}`);
      });
    }

    console.log(`\n📁 Reports generated in: ${this.config.outputDir}`);
    console.log('=' .repeat(50));
  }
}

// CLI execution
if (require.main === module) {
  const config = {
    reportsDir: process.env.REPORTS_DIR || './tests/reports',
    outputDir: process.env.OUTPUT_DIR || './tests/reports/consolidated',
    projectName: process.env.PROJECT_NAME || 'GlobalTaxCalc',
    format: process.env.REPORT_FORMAT || 'html'
  };

  const generator = new ConsolidatedReportGenerator(config);

  generator.generateConsolidatedReport()
    .then(() => {
      console.log('✅ Consolidated report generation completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Consolidated report generation failed:', error);
      process.exit(1);
    });
}

module.exports = ConsolidatedReportGenerator;