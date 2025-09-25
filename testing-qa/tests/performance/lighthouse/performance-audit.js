/**
 * Lighthouse Performance Auditing for GlobalTaxCalc
 * Automated performance testing for web vitals and optimization
 */

const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const path = require('path');

// Performance audit configuration
const AUDIT_CONFIG = {
  extends: 'lighthouse:default',
  settings: {
    onlyAudits: [
      'first-contentful-paint',
      'largest-contentful-paint',
      'first-meaningful-paint',
      'speed-index',
      'interactive',
      'cumulative-layout-shift',
      'total-blocking-time',
      'unused-css-rules',
      'unused-javascript',
      'modern-image-formats',
      'efficient-animated-content',
      'render-blocking-resources',
      'unminified-css',
      'unminified-javascript',
      'font-display',
      'critical-request-chains',
      'uses-rel-preload',
      'uses-rel-preconnect',
      'server-response-time',
      'redirects',
      'uses-text-compression',
      'uses-responsive-images',
      'offscreen-images',
      'properly-size-images'
    ],
    output: ['json', 'html'],
    maxWaitForLoad: 45000,
    throttling: {
      rttMs: 150,
      throughputKbps: 1638.4,
      requestLatencyMs: 150,
      downloadThroughputKbps: 1638.4,
      uploadThroughputKbps: 675,
      cpuSlowdownMultiplier: 4
    }
  }
};

// Pages to audit
const PAGES_TO_AUDIT = [
  {
    name: 'Homepage',
    url: '/',
    performanceThresholds: {
      'first-contentful-paint': 2000,
      'largest-contentful-paint': 2500,
      'speed-index': 3000,
      'interactive': 3500,
      'cumulative-layout-shift': 0.1,
      'total-blocking-time': 300
    }
  },
  {
    name: 'Tax Calculator',
    url: '/calculator',
    performanceThresholds: {
      'first-contentful-paint': 2500,
      'largest-contentful-paint': 3000,
      'speed-index': 3500,
      'interactive': 4000,
      'cumulative-layout-shift': 0.1,
      'total-blocking-time': 400
    },
    requiresAuth: true
  },
  {
    name: 'Dashboard',
    url: '/dashboard',
    performanceThresholds: {
      'first-contentful-paint': 2000,
      'largest-contentful-paint': 2500,
      'speed-index': 3000,
      'interactive': 3500,
      'cumulative-layout-shift': 0.15,
      'total-blocking-time': 350
    },
    requiresAuth: true
  },
  {
    name: 'Pricing Page',
    url: '/pricing',
    performanceThresholds: {
      'first-contentful-paint': 1800,
      'largest-contentful-paint': 2200,
      'speed-index': 2800,
      'interactive': 3200,
      'cumulative-layout-shift': 0.1,
      'total-blocking-time': 250
    }
  },
  {
    name: 'Reports',
    url: '/reports',
    performanceThresholds: {
      'first-contentful-paint': 2500,
      'largest-contentful-paint': 3500,
      'speed-index': 4000,
      'interactive': 4500,
      'cumulative-layout-shift': 0.2,
      'total-blocking-time': 500
    },
    requiresAuth: true
  }
];

// Device configurations for testing
const DEVICE_CONFIGS = [
  {
    name: 'Mobile',
    emulation: {
      mobile: true,
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      disabled: false
    }
  },
  {
    name: 'Desktop',
    emulation: {
      mobile: false,
      width: 1350,
      height: 940,
      deviceScaleFactor: 1,
      disabled: false
    }
  },
  {
    name: 'Tablet',
    emulation: {
      mobile: false,
      width: 768,
      height: 1024,
      deviceScaleFactor: 2,
      disabled: false
    }
  }
];

class PerformanceAuditor {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.results = [];
    this.reportDir = path.join(__dirname, '../reports/lighthouse');

    // Ensure report directory exists
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
  }

  async runAudit() {
    console.log('Starting Lighthouse performance audit...');

    for (const device of DEVICE_CONFIGS) {
      console.log(`\nTesting on ${device.name}...`);

      for (const page of PAGES_TO_AUDIT) {
        console.log(`  Auditing ${page.name}...`);

        try {
          const result = await this.auditPage(page, device);
          this.results.push(result);
        } catch (error) {
          console.error(`  Error auditing ${page.name} on ${device.name}:`, error.message);
        }
      }
    }

    await this.generateReports();
    await this.analyzeResults();
  }

  async auditPage(page, device) {
    const chrome = await chromeLauncher.launch({
      chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu']
    });

    try {
      const url = `${this.baseUrl}${page.url}`;
      const config = {
        ...AUDIT_CONFIG,
        settings: {
          ...AUDIT_CONFIG.settings,
          emulatedFormFactor: device.emulation.mobile ? 'mobile' : 'desktop',
          screenEmulation: device.emulation
        }
      };

      // Handle authentication if required
      if (page.requiresAuth) {
        await this.authenticateUser(chrome.port);
      }

      const runnerResult = await lighthouse(url, {
        port: chrome.port,
        disableDeviceEmulation: false,
        disableNetworkThrottling: false
      }, config);

      const result = {
        page: page.name,
        device: device.name,
        url: url,
        timestamp: new Date().toISOString(),
        scores: this.extractScores(runnerResult.lhr),
        metrics: this.extractMetrics(runnerResult.lhr),
        opportunities: this.extractOpportunities(runnerResult.lhr),
        diagnostics: this.extractDiagnostics(runnerResult.lhr),
        thresholds: page.performanceThresholds,
        passed: this.checkThresholds(runnerResult.lhr, page.performanceThresholds)
      };

      // Save individual report
      const reportFileName = `${page.name.toLowerCase().replace(/\s+/g, '-')}-${device.name.toLowerCase()}.html`;
      fs.writeFileSync(
        path.join(this.reportDir, reportFileName),
        runnerResult.report[1] // HTML report
      );

      return result;
    } finally {
      await chrome.kill();
    }
  }

  async authenticateUser(chromePort) {
    // Simulate user login for authenticated pages
    const chrome = await chromeLauncher.launch({ port: chromePort });

    try {
      // Navigate to login page and authenticate
      // This would be implemented based on your authentication flow
      console.log('  Authenticating user for protected pages...');
    } catch (error) {
      console.error('  Authentication failed:', error.message);
    }
  }

  extractScores(lhr) {
    return {
      performance: lhr.categories.performance.score * 100,
      accessibility: lhr.categories.accessibility ? lhr.categories.accessibility.score * 100 : null,
      bestPractices: lhr.categories['best-practices'] ? lhr.categories['best-practices'].score * 100 : null,
      seo: lhr.categories.seo ? lhr.categories.seo.score * 100 : null
    };
  }

  extractMetrics(lhr) {
    const audits = lhr.audits;
    return {
      firstContentfulPaint: audits['first-contentful-paint']?.numericValue,
      largestContentfulPaint: audits['largest-contentful-paint']?.numericValue,
      speedIndex: audits['speed-index']?.numericValue,
      interactive: audits['interactive']?.numericValue,
      cumulativeLayoutShift: audits['cumulative-layout-shift']?.numericValue,
      totalBlockingTime: audits['total-blocking-time']?.numericValue,
      serverResponseTime: audits['server-response-time']?.numericValue
    };
  }

  extractOpportunities(lhr) {
    const opportunities = [];

    Object.values(lhr.audits).forEach(audit => {
      if (audit.details && audit.details.type === 'opportunity' && audit.numericValue > 0) {
        opportunities.push({
          id: audit.id,
          title: audit.title,
          description: audit.description,
          score: audit.score,
          numericValue: audit.numericValue,
          displayValue: audit.displayValue
        });
      }
    });

    return opportunities.sort((a, b) => b.numericValue - a.numericValue);
  }

  extractDiagnostics(lhr) {
    const diagnostics = [];

    Object.values(lhr.audits).forEach(audit => {
      if (audit.details && audit.details.type === 'diagnostic' && audit.score < 1) {
        diagnostics.push({
          id: audit.id,
          title: audit.title,
          description: audit.description,
          score: audit.score,
          displayValue: audit.displayValue
        });
      }
    });

    return diagnostics;
  }

  checkThresholds(lhr, thresholds) {
    const metrics = this.extractMetrics(lhr);
    const passed = {};

    Object.entries(thresholds).forEach(([metric, threshold]) => {
      const metricKey = metric.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
      const actualValue = metrics[metricKey];

      if (actualValue !== undefined) {
        passed[metric] = actualValue <= threshold;
      }
    });

    return passed;
  }

  async generateReports() {
    console.log('\nGenerating performance reports...');

    // Generate summary report
    const summaryReport = this.generateSummaryReport();
    fs.writeFileSync(
      path.join(this.reportDir, 'summary-report.json'),
      JSON.stringify(summaryReport, null, 2)
    );

    // Generate HTML summary
    const htmlSummary = this.generateHTMLSummary(summaryReport);
    fs.writeFileSync(
      path.join(this.reportDir, 'summary-report.html'),
      htmlSummary
    );

    console.log(`Reports saved to: ${this.reportDir}`);
  }

  generateSummaryReport() {
    const summary = {
      timestamp: new Date().toISOString(),
      totalAudits: this.results.length,
      passedThresholds: 0,
      failedThresholds: 0,
      averageScores: {
        performance: 0,
        accessibility: 0,
        bestPractices: 0,
        seo: 0
      },
      pageResults: {},
      deviceResults: {},
      criticalIssues: [],
      recommendations: []
    };

    this.results.forEach(result => {
      // Count threshold passes/fails
      const thresholdResults = Object.values(result.passed);
      summary.passedThresholds += thresholdResults.filter(Boolean).length;
      summary.failedThresholds += thresholdResults.filter(p => !p).length;

      // Aggregate scores
      Object.keys(summary.averageScores).forEach(key => {
        if (result.scores[key] !== null) {
          summary.averageScores[key] += result.scores[key];
        }
      });

      // Group by page and device
      if (!summary.pageResults[result.page]) {
        summary.pageResults[result.page] = [];
      }
      summary.pageResults[result.page].push(result);

      if (!summary.deviceResults[result.device]) {
        summary.deviceResults[result.device] = [];
      }
      summary.deviceResults[result.device].push(result);

      // Identify critical issues
      if (result.scores.performance < 50) {
        summary.criticalIssues.push({
          page: result.page,
          device: result.device,
          issue: 'Poor performance score',
          score: result.scores.performance
        });
      }

      // Collect top opportunities
      result.opportunities.slice(0, 3).forEach(opp => {
        summary.recommendations.push({
          page: result.page,
          device: result.device,
          ...opp
        });
      });
    });

    // Calculate averages
    Object.keys(summary.averageScores).forEach(key => {
      summary.averageScores[key] = Math.round(summary.averageScores[key] / this.results.length);
    });

    return summary;
  }

  generateHTMLSummary(summary) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>GlobalTaxCalc Performance Audit Summary</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .metric { display: inline-block; margin: 10px; padding: 15px; border-radius: 5px; }
        .good { background-color: #d4edda; }
        .warning { background-color: #fff3cd; }
        .critical { background-color: #f8d7da; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>GlobalTaxCalc Performance Audit Summary</h1>
    <p><strong>Generated:</strong> ${summary.timestamp}</p>

    <h2>Overall Scores</h2>
    <div>
        <div class="metric ${summary.averageScores.performance >= 90 ? 'good' : summary.averageScores.performance >= 50 ? 'warning' : 'critical'}">
            <strong>Performance:</strong> ${summary.averageScores.performance}/100
        </div>
        <div class="metric ${summary.averageScores.accessibility >= 90 ? 'good' : 'warning'}">
            <strong>Accessibility:</strong> ${summary.averageScores.accessibility}/100
        </div>
        <div class="metric ${summary.averageScores.bestPractices >= 90 ? 'good' : 'warning'}">
            <strong>Best Practices:</strong> ${summary.averageScores.bestPractices}/100
        </div>
        <div class="metric ${summary.averageScores.seo >= 90 ? 'good' : 'warning'}">
            <strong>SEO:</strong> ${summary.averageScores.seo}/100
        </div>
    </div>

    <h2>Threshold Results</h2>
    <p><strong>Passed:</strong> ${summary.passedThresholds} | <strong>Failed:</strong> ${summary.failedThresholds}</p>

    ${summary.criticalIssues.length > 0 ? `
    <h2>Critical Issues</h2>
    <table>
        <tr><th>Page</th><th>Device</th><th>Issue</th><th>Score</th></tr>
        ${summary.criticalIssues.map(issue => `
            <tr>
                <td>${issue.page}</td>
                <td>${issue.device}</td>
                <td>${issue.issue}</td>
                <td>${issue.score}/100</td>
            </tr>
        `).join('')}
    </table>
    ` : ''}

    <h2>Top Recommendations</h2>
    <table>
        <tr><th>Page</th><th>Device</th><th>Optimization</th><th>Potential Savings</th></tr>
        ${summary.recommendations.slice(0, 10).map(rec => `
            <tr>
                <td>${rec.page}</td>
                <td>${rec.device}</td>
                <td>${rec.title}</td>
                <td>${rec.displayValue || 'N/A'}</td>
            </tr>
        `).join('')}
    </table>
</body>
</html>
    `;
  }

  async analyzeResults() {
    console.log('\n=== Performance Audit Analysis ===');

    const summary = this.generateSummaryReport();

    console.log(`\nOverall Performance Score: ${summary.averageScores.performance}/100`);
    console.log(`Threshold Compliance: ${summary.passedThresholds}/${summary.passedThresholds + summary.failedThresholds} passed`);

    if (summary.criticalIssues.length > 0) {
      console.log('\nCritical Issues Found:');
      summary.criticalIssues.forEach(issue => {
        console.log(`  - ${issue.page} (${issue.device}): ${issue.issue} (${issue.score}/100)`);
      });
    }

    console.log('\nTop Performance Opportunities:');
    summary.recommendations.slice(0, 5).forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec.title} - ${rec.displayValue || 'Improve performance'}`);
    });

    console.log(`\nDetailed reports available in: ${this.reportDir}`);
  }
}

// CLI execution
if (require.main === module) {
  const baseUrl = process.env.TARGET_URL || 'http://localhost:3000';
  const auditor = new PerformanceAuditor(baseUrl);

  auditor.runAudit()
    .then(() => {
      console.log('\nPerformance audit completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Performance audit failed:', error);
      process.exit(1);
    });
}

module.exports = PerformanceAuditor;