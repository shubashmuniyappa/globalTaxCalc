/**
 * Quality Gates Evaluation Script
 * Enforces quality standards and gates for the CI/CD pipeline
 */

const fs = require('fs');
const path = require('path');

class QualityGatesEvaluator {
  constructor(options = {}) {
    this.config = {
      coverageThreshold: options.coverageThreshold || 90,
      maxFailedTests: options.maxFailedTests || 0,
      maxCriticalIssues: options.maxCriticalIssues || 0,
      performanceThreshold: options.performanceThreshold || 3000, // ms
      securityThreshold: options.securityThreshold || 0, // high/critical vulnerabilities
      codeQualityThreshold: options.codeQualityThreshold || 80,
      techDebtRatio: options.techDebtRatio || 5, // percentage
      duplicatedCodeThreshold: options.duplicatedCodeThreshold || 3, // percentage
      complexityThreshold: options.complexityThreshold || 10,
      reportDir: options.reportDir || './tests/reports'
    };

    this.results = {
      timestamp: new Date().toISOString(),
      gates: [],
      summary: {
        passed: 0,
        failed: 0,
        total: 0,
        overallStatus: 'PENDING'
      },
      metrics: {},
      recommendations: []
    };
  }

  async evaluateAllGates() {
    console.log('🏁 Evaluating quality gates...');

    try {
      // Load test results and metrics
      await this.loadMetrics();

      // Evaluate each quality gate
      await this.evaluateCodeCoverage();
      await this.evaluateTestResults();
      await this.evaluatePerformance();
      await this.evaluateSecurity();
      await this.evaluateCodeQuality();
      await this.evaluateTechnicalDebt();
      await this.evaluateComplexity();

      // Calculate overall result
      this.calculateOverallResult();

      // Generate recommendations
      this.generateRecommendations();

      // Save results
      await this.saveResults();

      // Print summary
      this.printSummary();

      return this.results;

    } catch (error) {
      console.error('❌ Quality gates evaluation failed:', error.message);
      throw error;
    }
  }

  async loadMetrics() {
    console.log('📊 Loading test metrics and reports...');

    // Load coverage data
    this.loadCoverageData();

    // Load test results
    this.loadTestResults();

    // Load performance data
    this.loadPerformanceData();

    // Load security scan results
    this.loadSecurityData();

    // Load code quality data
    this.loadCodeQualityData();

    console.log('✅ Metrics loaded successfully');
  }

  loadCoverageData() {
    const coveragePath = path.join(this.config.reportDir, 'coverage/coverage-summary.json');

    if (fs.existsSync(coveragePath)) {
      const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
      this.results.metrics.coverage = {
        lines: coverageData.total.lines.pct,
        functions: coverageData.total.functions.pct,
        branches: coverageData.total.branches.pct,
        statements: coverageData.total.statements.pct
      };
    } else {
      console.warn('⚠️  Coverage data not found');
      this.results.metrics.coverage = null;
    }
  }

  loadTestResults() {
    // Load JUnit test results
    const junitFiles = [
      'junit.xml',
      'junit-unit.xml',
      'integration-report.xml',
      'cypress-report.xml'
    ];

    let totalTests = 0;
    let failedTests = 0;
    let passedTests = 0;

    junitFiles.forEach(file => {
      const filePath = path.join(this.config.reportDir, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const testCounts = this.parseJUnitResults(content);
        totalTests += testCounts.total;
        failedTests += testCounts.failed;
        passedTests += testCounts.passed;
      }
    });

    this.results.metrics.tests = {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      passRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0
    };
  }

  parseJUnitResults(junitXml) {
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

  loadPerformanceData() {
    // Load K6 performance results
    const k6ReportPath = path.join(this.config.reportDir, 'k6-report.json');
    if (fs.existsSync(k6ReportPath)) {
      const k6Data = JSON.parse(fs.readFileSync(k6ReportPath, 'utf8'));
      this.results.metrics.performance = {
        avgResponseTime: k6Data.metrics?.http_req_duration?.avg,
        p95ResponseTime: k6Data.metrics?.http_req_duration?.['p(95)'],
        errorRate: k6Data.metrics?.http_req_failed?.rate,
        throughput: k6Data.metrics?.http_reqs?.rate
      };
    }

    // Load Lighthouse performance results
    const lighthouseReportPath = path.join(this.config.reportDir, 'lighthouse-report.json');
    if (fs.existsSync(lighthouseReportPath)) {
      const lighthouseData = JSON.parse(fs.readFileSync(lighthouseReportPath, 'utf8'));
      if (!this.results.metrics.performance) {
        this.results.metrics.performance = {};
      }
      this.results.metrics.performance.lighthouse = {
        performanceScore: lighthouseData.categories?.performance?.score * 100,
        firstContentfulPaint: lighthouseData.audits?.['first-contentful-paint']?.numericValue,
        largestContentfulPaint: lighthouseData.audits?.['largest-contentful-paint']?.numericValue,
        cumulativeLayoutShift: lighthouseData.audits?.['cumulative-layout-shift']?.numericValue
      };
    }
  }

  loadSecurityData() {
    // Load OWASP ZAP results
    const zapReportPath = path.join(this.config.reportDir, 'security/zap-security-report.json');
    if (fs.existsSync(zapReportPath)) {
      const zapData = JSON.parse(fs.readFileSync(zapReportPath, 'utf8'));
      this.results.metrics.security = {
        totalVulnerabilities: zapData.site?.[0]?.alerts?.length || 0,
        highRiskIssues: zapData.site?.[0]?.alerts?.filter(alert => alert.riskdesc === 'High')?.length || 0,
        mediumRiskIssues: zapData.site?.[0]?.alerts?.filter(alert => alert.riskdesc === 'Medium')?.length || 0
      };
    }

    // Load Snyk results
    const snykReportPath = path.join(this.config.reportDir, 'snyk-report.json');
    if (fs.existsSync(snykReportPath)) {
      const snykData = JSON.parse(fs.readFileSync(snykReportPath, 'utf8'));
      if (!this.results.metrics.security) {
        this.results.metrics.security = {};
      }
      this.results.metrics.security.dependencies = {
        totalVulnerabilities: snykData.vulnerabilities?.length || 0,
        criticalIssues: snykData.vulnerabilities?.filter(v => v.severity === 'critical')?.length || 0,
        highIssues: snykData.vulnerabilities?.filter(v => v.severity === 'high')?.length || 0
      };
    }
  }

  loadCodeQualityData() {
    // Load ESLint results
    const eslintReportPath = path.join(this.config.reportDir, 'eslint-report.json');
    if (fs.existsSync(eslintReportPath)) {
      const eslintData = JSON.parse(fs.readFileSync(eslintReportPath, 'utf8'));

      let totalErrors = 0;
      let totalWarnings = 0;
      let totalProblems = 0;

      eslintData.forEach(file => {
        totalErrors += file.errorCount;
        totalWarnings += file.warningCount;
        totalProblems += file.errorCount + file.warningCount;
      });

      this.results.metrics.codeQuality = {
        totalFiles: eslintData.length,
        totalErrors: totalErrors,
        totalWarnings: totalWarnings,
        totalProblems: totalProblems,
        filesWithIssues: eslintData.filter(file => file.errorCount > 0 || file.warningCount > 0).length
      };
    }

    // Load complexity analysis if available
    this.loadComplexityData();
  }

  loadComplexityData() {
    // Placeholder for complexity analysis data
    // This would typically come from tools like complexity-report or plato
    const complexityReportPath = path.join(this.config.reportDir, 'complexity-report.json');
    if (fs.existsSync(complexityReportPath)) {
      const complexityData = JSON.parse(fs.readFileSync(complexityReportPath, 'utf8'));
      this.results.metrics.complexity = {
        averageComplexity: complexityData.averageComplexity,
        maxComplexity: complexityData.maxComplexity,
        highComplexityFunctions: complexityData.functions?.filter(f => f.complexity > this.config.complexityThreshold)?.length || 0
      };
    }
  }

  async evaluateCodeCoverage() {
    const gate = {
      name: 'Code Coverage',
      description: 'Minimum code coverage threshold',
      threshold: `${this.config.coverageThreshold}%`,
      status: 'PENDING',
      value: null,
      details: {}
    };

    if (this.results.metrics.coverage) {
      const coverage = this.results.metrics.coverage;
      const lineCoverage = coverage.lines;

      gate.value = `${lineCoverage}%`;
      gate.details = {
        lines: `${coverage.lines}%`,
        functions: `${coverage.functions}%`,
        branches: `${coverage.branches}%`,
        statements: `${coverage.statements}%`
      };

      if (lineCoverage >= this.config.coverageThreshold) {
        gate.status = 'PASSED';
        gate.message = `Code coverage (${lineCoverage}%) meets the threshold (${this.config.coverageThreshold}%)`;
      } else {
        gate.status = 'FAILED';
        gate.message = `Code coverage (${lineCoverage}%) is below threshold (${this.config.coverageThreshold}%)`;
        gate.impact = 'Code coverage is insufficient to ensure quality';
        gate.recommendation = 'Add more unit tests to increase coverage';
      }
    } else {
      gate.status = 'FAILED';
      gate.message = 'Coverage data not available';
      gate.impact = 'Cannot verify code coverage compliance';
      gate.recommendation = 'Ensure coverage collection is enabled and working';
    }

    this.results.gates.push(gate);
  }

  async evaluateTestResults() {
    const gate = {
      name: 'Test Results',
      description: 'All tests must pass',
      threshold: `Max ${this.config.maxFailedTests} failed tests`,
      status: 'PENDING',
      value: null,
      details: {}
    };

    if (this.results.metrics.tests) {
      const tests = this.results.metrics.tests;

      gate.value = `${tests.failed} failed, ${tests.passed} passed`;
      gate.details = {
        total: tests.total,
        passed: tests.passed,
        failed: tests.failed,
        passRate: `${tests.passRate.toFixed(1)}%`
      };

      if (tests.failed <= this.config.maxFailedTests) {
        gate.status = 'PASSED';
        gate.message = `All tests passed (${tests.passed}/${tests.total})`;
      } else {
        gate.status = 'FAILED';
        gate.message = `${tests.failed} tests failed, exceeding threshold of ${this.config.maxFailedTests}`;
        gate.impact = 'Failed tests indicate potential bugs or regressions';
        gate.recommendation = 'Fix failing tests before deployment';
      }
    } else {
      gate.status = 'FAILED';
      gate.message = 'Test results not available';
      gate.impact = 'Cannot verify test compliance';
      gate.recommendation = 'Ensure tests are running and reporting results';
    }

    this.results.gates.push(gate);
  }

  async evaluatePerformance() {
    const gate = {
      name: 'Performance',
      description: 'Response time performance standards',
      threshold: `Max ${this.config.performanceThreshold}ms response time`,
      status: 'PENDING',
      value: null,
      details: {}
    };

    if (this.results.metrics.performance) {
      const perf = this.results.metrics.performance;
      let primaryMetric = null;

      if (perf.p95ResponseTime) {
        primaryMetric = perf.p95ResponseTime;
        gate.value = `${primaryMetric.toFixed(0)}ms (p95)`;
      } else if (perf.avgResponseTime) {
        primaryMetric = perf.avgResponseTime;
        gate.value = `${primaryMetric.toFixed(0)}ms (avg)`;
      }

      gate.details = {
        avgResponseTime: perf.avgResponseTime ? `${perf.avgResponseTime.toFixed(0)}ms` : 'N/A',
        p95ResponseTime: perf.p95ResponseTime ? `${perf.p95ResponseTime.toFixed(0)}ms` : 'N/A',
        errorRate: perf.errorRate ? `${(perf.errorRate * 100).toFixed(2)}%` : 'N/A'
      };

      if (perf.lighthouse) {
        gate.details.lighthouse = {
          performanceScore: `${perf.lighthouse.performanceScore}/100`,
          firstContentfulPaint: `${perf.lighthouse.firstContentfulPaint}ms`,
          largestContentfulPaint: `${perf.lighthouse.largestContentfulPaint}ms`
        };
      }

      if (primaryMetric && primaryMetric <= this.config.performanceThreshold) {
        gate.status = 'PASSED';
        gate.message = `Performance meets threshold (${primaryMetric.toFixed(0)}ms ≤ ${this.config.performanceThreshold}ms)`;
      } else if (primaryMetric) {
        gate.status = 'FAILED';
        gate.message = `Performance exceeds threshold (${primaryMetric.toFixed(0)}ms > ${this.config.performanceThreshold}ms)`;
        gate.impact = 'Poor performance may affect user experience';
        gate.recommendation = 'Optimize slow endpoints and database queries';
      } else {
        gate.status = 'WARNING';
        gate.message = 'Performance data incomplete';
      }
    } else {
      gate.status = 'WARNING';
      gate.message = 'Performance data not available';
      gate.recommendation = 'Enable performance testing to monitor response times';
    }

    this.results.gates.push(gate);
  }

  async evaluateSecurity() {
    const gate = {
      name: 'Security',
      description: 'No critical security vulnerabilities',
      threshold: `Max ${this.config.securityThreshold} high/critical issues`,
      status: 'PENDING',
      value: null,
      details: {}
    };

    if (this.results.metrics.security) {
      const security = this.results.metrics.security;
      let criticalIssues = 0;

      // Count high risk issues from ZAP scan
      if (security.highRiskIssues) {
        criticalIssues += security.highRiskIssues;
      }

      // Count critical/high issues from dependency scan
      if (security.dependencies) {
        criticalIssues += security.dependencies.criticalIssues || 0;
        criticalIssues += security.dependencies.highIssues || 0;
      }

      gate.value = `${criticalIssues} critical/high issues`;
      gate.details = {
        webVulnerabilities: security.totalVulnerabilities || 0,
        highRiskWebIssues: security.highRiskIssues || 0,
        dependencyVulnerabilities: security.dependencies?.totalVulnerabilities || 0,
        criticalDependencyIssues: security.dependencies?.criticalIssues || 0
      };

      if (criticalIssues <= this.config.securityThreshold) {
        gate.status = 'PASSED';
        gate.message = `Security scan passed with ${criticalIssues} critical/high issues`;
      } else {
        gate.status = 'FAILED';
        gate.message = `${criticalIssues} critical/high security issues found, exceeding threshold of ${this.config.securityThreshold}`;
        gate.impact = 'Security vulnerabilities pose risk to application and user data';
        gate.recommendation = 'Fix critical and high severity security issues before deployment';
      }
    } else {
      gate.status = 'WARNING';
      gate.message = 'Security scan results not available';
      gate.recommendation = 'Run security scans to identify vulnerabilities';
    }

    this.results.gates.push(gate);
  }

  async evaluateCodeQuality() {
    const gate = {
      name: 'Code Quality',
      description: 'Acceptable code quality standards',
      threshold: `Max code quality issues`,
      status: 'PENDING',
      value: null,
      details: {}
    };

    if (this.results.metrics.codeQuality) {
      const quality = this.results.metrics.codeQuality;

      gate.value = `${quality.totalErrors} errors, ${quality.totalWarnings} warnings`;
      gate.details = {
        totalFiles: quality.totalFiles,
        totalErrors: quality.totalErrors,
        totalWarnings: quality.totalWarnings,
        filesWithIssues: quality.filesWithIssues,
        issueRate: quality.totalFiles > 0 ? `${((quality.filesWithIssues / quality.totalFiles) * 100).toFixed(1)}%` : '0%'
      };

      // Calculate quality score (simplified)
      const qualityScore = quality.totalFiles > 0
        ? Math.max(0, 100 - (quality.totalProblems / quality.totalFiles * 10))
        : 100;

      if (quality.totalErrors === 0 && qualityScore >= this.config.codeQualityThreshold) {
        gate.status = 'PASSED';
        gate.message = `Code quality acceptable (score: ${qualityScore.toFixed(1)}/100)`;
      } else if (quality.totalErrors > 0) {
        gate.status = 'FAILED';
        gate.message = `${quality.totalErrors} code quality errors found`;
        gate.impact = 'Code quality issues may lead to bugs and maintenance problems';
        gate.recommendation = 'Fix linting errors and address warnings';
      } else {
        gate.status = 'WARNING';
        gate.message = `Code quality below threshold (score: ${qualityScore.toFixed(1)}/100)`;
        gate.recommendation = 'Address code quality warnings to improve maintainability';
      }
    } else {
      gate.status = 'WARNING';
      gate.message = 'Code quality data not available';
      gate.recommendation = 'Run linting and code quality analysis';
    }

    this.results.gates.push(gate);
  }

  async evaluateTechnicalDebt() {
    const gate = {
      name: 'Technical Debt',
      description: 'Acceptable technical debt levels',
      threshold: `Max ${this.config.techDebtRatio}% debt ratio`,
      status: 'PENDING',
      value: null,
      details: {}
    };

    // This would typically integrate with tools like SonarQube
    // For now, we'll estimate based on available metrics
    let debtRatio = 0;

    if (this.results.metrics.codeQuality) {
      const quality = this.results.metrics.codeQuality;
      // Simplified debt calculation based on warnings and errors
      debtRatio = quality.totalFiles > 0
        ? (quality.totalWarnings + quality.totalErrors * 2) / quality.totalFiles * 0.5
        : 0;
    }

    gate.value = `${debtRatio.toFixed(1)}%`;
    gate.details = {
      estimatedDebtRatio: `${debtRatio.toFixed(1)}%`,
      calculationMethod: 'Estimated from linting issues'
    };

    if (debtRatio <= this.config.techDebtRatio) {
      gate.status = 'PASSED';
      gate.message = `Technical debt within acceptable limits (${debtRatio.toFixed(1)}%)`;
    } else {
      gate.status = 'WARNING';
      gate.message = `Technical debt ratio (${debtRatio.toFixed(1)}%) exceeds threshold (${this.config.techDebtRatio}%)`;
      gate.impact = 'High technical debt may slow down future development';
      gate.recommendation = 'Plan technical debt reduction activities';
    }

    this.results.gates.push(gate);
  }

  async evaluateComplexity() {
    const gate = {
      name: 'Code Complexity',
      description: 'Acceptable code complexity levels',
      threshold: `Max ${this.config.complexityThreshold} cyclomatic complexity`,
      status: 'PENDING',
      value: null,
      details: {}
    };

    if (this.results.metrics.complexity) {
      const complexity = this.results.metrics.complexity;

      gate.value = `${complexity.maxComplexity} max, ${complexity.averageComplexity.toFixed(1)} avg`;
      gate.details = {
        maxComplexity: complexity.maxComplexity,
        averageComplexity: complexity.averageComplexity.toFixed(1),
        highComplexityFunctions: complexity.highComplexityFunctions
      };

      if (complexity.maxComplexity <= this.config.complexityThreshold) {
        gate.status = 'PASSED';
        gate.message = `Code complexity within acceptable limits`;
      } else {
        gate.status = 'WARNING';
        gate.message = `High complexity detected (max: ${complexity.maxComplexity})`;
        gate.impact = 'High complexity functions are harder to test and maintain';
        gate.recommendation = 'Refactor complex functions to improve maintainability';
      }
    } else {
      gate.status = 'WARNING';
      gate.message = 'Complexity analysis not available';
      gate.recommendation = 'Run complexity analysis to identify problematic functions';
    }

    this.results.gates.push(gate);
  }

  calculateOverallResult() {
    const passed = this.results.gates.filter(gate => gate.status === 'PASSED').length;
    const failed = this.results.gates.filter(gate => gate.status === 'FAILED').length;
    const warnings = this.results.gates.filter(gate => gate.status === 'WARNING').length;

    this.results.summary = {
      passed: passed,
      failed: failed,
      warnings: warnings,
      total: this.results.gates.length,
      overallStatus: failed > 0 ? 'FAILED' : warnings > 0 ? 'WARNING' : 'PASSED'
    };
  }

  generateRecommendations() {
    const recommendations = [];

    this.results.gates.forEach(gate => {
      if (gate.recommendation) {
        recommendations.push({
          gate: gate.name,
          priority: gate.status === 'FAILED' ? 'HIGH' : 'MEDIUM',
          recommendation: gate.recommendation,
          impact: gate.impact
        });
      }
    });

    // Sort by priority
    recommendations.sort((a, b) => {
      const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    this.results.recommendations = recommendations;
  }

  async saveResults() {
    const reportPath = path.join(this.config.reportDir, 'quality-gates-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));

    // Generate HTML report
    const htmlReport = this.generateHTMLReport();
    const htmlPath = path.join(this.config.reportDir, 'quality-gates-report.html');
    fs.writeFileSync(htmlPath, htmlReport);

    console.log(`📄 Quality gates report saved to ${reportPath}`);
  }

  generateHTMLReport() {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Quality Gates Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .passed { color: #4caf50; }
        .failed { color: #f44336; }
        .warning { color: #ff9800; }
        .gate { margin: 15px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .gate.passed { border-left: 4px solid #4caf50; }
        .gate.failed { border-left: 4px solid #f44336; }
        .gate.warning { border-left: 4px solid #ff9800; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>Quality Gates Report</h1>

    <div class="summary">
        <h2>Overall Status: <span class="${this.results.summary.overallStatus.toLowerCase()}">${this.results.summary.overallStatus}</span></h2>
        <p><strong>Generated:</strong> ${this.results.timestamp}</p>
        <p><strong>Passed:</strong> ${this.results.summary.passed}/${this.results.summary.total}</p>
        <p><strong>Failed:</strong> ${this.results.summary.failed}</p>
        <p><strong>Warnings:</strong> ${this.results.summary.warnings}</p>
    </div>

    <h2>Quality Gates</h2>
    ${this.results.gates.map(gate => `
        <div class="gate ${gate.status.toLowerCase()}">
            <h3>${gate.name} - <span class="${gate.status.toLowerCase()}">${gate.status}</span></h3>
            <p><strong>Description:</strong> ${gate.description}</p>
            <p><strong>Threshold:</strong> ${gate.threshold}</p>
            <p><strong>Value:</strong> ${gate.value || 'N/A'}</p>
            <p><strong>Message:</strong> ${gate.message}</p>
            ${gate.impact ? `<p><strong>Impact:</strong> ${gate.impact}</p>` : ''}
            ${gate.recommendation ? `<p><strong>Recommendation:</strong> ${gate.recommendation}</p>` : ''}
        </div>
    `).join('')}

    ${this.results.recommendations.length > 0 ? `
    <h2>Recommendations</h2>
    <table>
        <tr><th>Priority</th><th>Gate</th><th>Recommendation</th><th>Impact</th></tr>
        ${this.results.recommendations.map(rec => `
            <tr>
                <td class="${rec.priority.toLowerCase()}">${rec.priority}</td>
                <td>${rec.gate}</td>
                <td>${rec.recommendation}</td>
                <td>${rec.impact || 'N/A'}</td>
            </tr>
        `).join('')}
    </table>
    ` : ''}
</body>
</html>
    `;
  }

  printSummary() {
    console.log('\n🏁 Quality Gates Summary');
    console.log('=' .repeat(50));
    console.log(`Overall Status: ${this.results.summary.overallStatus}`);
    console.log(`Passed: ${this.results.summary.passed}/${this.results.summary.total}`);
    console.log(`Failed: ${this.results.summary.failed}`);
    console.log(`Warnings: ${this.results.summary.warnings}`);

    if (this.results.summary.failed > 0) {
      console.log('\n❌ Failed Gates:');
      this.results.gates
        .filter(gate => gate.status === 'FAILED')
        .forEach(gate => {
          console.log(`  - ${gate.name}: ${gate.message}`);
        });
    }

    if (this.results.recommendations.length > 0) {
      console.log('\n💡 Top Recommendations:');
      this.results.recommendations.slice(0, 3).forEach((rec, index) => {
        console.log(`  ${index + 1}. [${rec.priority}] ${rec.gate}: ${rec.recommendation}`);
      });
    }

    console.log('=' .repeat(50));
  }
}

// CLI execution
if (require.main === module) {
  const config = {
    coverageThreshold: parseInt(process.env.COVERAGE_THRESHOLD) || 90,
    maxFailedTests: parseInt(process.env.MAX_FAILED_TESTS) || 0,
    performanceThreshold: parseInt(process.env.PERFORMANCE_THRESHOLD) || 3000,
    securityThreshold: parseInt(process.env.SECURITY_THRESHOLD) || 0,
    reportDir: process.env.REPORT_DIR || './tests/reports'
  };

  const evaluator = new QualityGatesEvaluator(config);

  evaluator.evaluateAllGates()
    .then((results) => {
      const exitCode = results.summary.overallStatus === 'FAILED' ? 1 : 0;
      process.exit(exitCode);
    })
    .catch((error) => {
      console.error('Quality gates evaluation failed:', error);
      process.exit(1);
    });
}

module.exports = QualityGatesEvaluator;