/**
 * OWASP ZAP Security Scanning for GlobalTaxCalc
 * Automated security testing using ZAP API
 */

const ZapClient = require('zaproxy');
const fs = require('fs');
const path = require('path');

class SecurityScanner {
  constructor(options = {}) {
    this.zapOptions = {
      proxy: options.proxy || 'http://127.0.0.1:8080',
      target: options.target || 'http://localhost:3000',
      zapPath: options.zapPath || '/usr/share/zaproxy/zap.sh'
    };

    this.zaproxy = new ZapClient({
      proxy: this.zapOptions.proxy
    });

    this.reportDir = path.join(__dirname, '../reports');
    this.ensureReportDir();
  }

  ensureReportDir() {
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
  }

  async startZAP() {
    console.log('Starting OWASP ZAP...');

    try {
      // Start ZAP daemon
      const { spawn } = require('child_process');
      this.zapProcess = spawn(this.zapOptions.zapPath, [
        '-daemon',
        '-host', '127.0.0.1',
        '-port', '8080',
        '-config', 'api.addrs.addr.name=.*',
        '-config', 'api.addrs.addr.regex=true'
      ]);

      // Wait for ZAP to start
      await this.waitForZAP();
      console.log('OWASP ZAP started successfully');
    } catch (error) {
      console.error('Failed to start ZAP:', error);
      throw error;
    }
  }

  async waitForZAP(timeout = 60000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        await this.zaproxy.core.version();
        return;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error('ZAP failed to start within timeout');
  }

  async runSecurityScan() {
    console.log('Starting comprehensive security scan...');

    try {
      await this.startZAP();

      // Configure ZAP
      await this.configureZAP();

      // Run various security tests
      const results = {
        spiderResults: await this.runSpiderScan(),
        activeScanResults: await this.runActiveScan(),
        passiveScanResults: await this.runPassiveScan(),
        authenticationTests: await this.testAuthentication(),
        apiSecurityTests: await this.testAPIEndpoints(),
        vulnerabilityAssessment: await this.getVulnerabilityReport()
      };

      // Generate comprehensive report
      await this.generateSecurityReport(results);

      return results;
    } finally {
      await this.stopZAP();
    }
  }

  async configureZAP() {
    console.log('Configuring ZAP for comprehensive scan...');

    // Enable all passive scan rules
    await this.zaproxy.pscan.enableAllScanners();

    // Configure authentication
    await this.configureAuthentication();

    // Set up custom contexts
    await this.setupSecurityContexts();
  }

  async configureAuthentication() {
    console.log('Configuring authentication for security testing...');

    // Create authentication context
    const contextId = await this.zaproxy.context.newContext('GlobalTaxCalc');

    // Configure form-based authentication
    await this.zaproxy.authentication.setAuthenticationMethod(contextId, 'formBasedAuthentication', {
      loginUrl: `${this.zapOptions.target}/login`,
      loginRequestData: 'email={%username%}&password={%password%}',
      usernameParameter: 'email',
      passwordParameter: 'password'
    });

    // Set up test user
    await this.zaproxy.users.newUser(contextId, 'testuser', {
      name: 'Security Test User',
      credentials: {
        username: 'security.test@globaltaxcalc.com',
        password: 'SecurityTest123!'
      }
    });

    console.log('Authentication configured successfully');
  }

  async setupSecurityContexts() {
    console.log('Setting up security contexts...');

    // Create contexts for different application areas
    const contexts = [
      {
        name: 'Public Pages',
        urls: [`${this.zapOptions.target}/`, `${this.zapOptions.target}/pricing`]
      },
      {
        name: 'Authentication',
        urls: [`${this.zapOptions.target}/login`, `${this.zapOptions.target}/register`]
      },
      {
        name: 'Protected Pages',
        urls: [
          `${this.zapOptions.target}/dashboard`,
          `${this.zapOptions.target}/calculator`,
          `${this.zapOptions.target}/reports`
        ]
      },
      {
        name: 'API Endpoints',
        urls: [`${this.zapOptions.target}/api/.*`]
      }
    ];

    for (const context of contexts) {
      const contextId = await this.zaproxy.context.newContext(context.name);
      for (const url of context.urls) {
        await this.zaproxy.context.includeInContext(contextId, url);
      }
    }
  }

  async runSpiderScan() {
    console.log('Running spider scan to discover URLs...');

    const spiderScanId = await this.zaproxy.spider.scan(this.zapOptions.target);

    // Wait for spider to complete
    let progress = 0;
    while (progress < 100) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      progress = parseInt(await this.zaproxy.spider.status(spiderScanId));
      console.log(`Spider progress: ${progress}%`);
    }

    const urls = await this.zaproxy.spider.results(spiderScanId);
    console.log(`Spider discovered ${urls.length} URLs`);

    return {
      scanId: spiderScanId,
      urlsFound: urls.length,
      urls: urls
    };
  }

  async runActiveScan() {
    console.log('Running active security scan...');

    const activeScanId = await this.zaproxy.ascan.scan(this.zapOptions.target);

    // Configure active scan policies
    await this.configureActiveScanPolicies();

    // Wait for active scan to complete
    let progress = 0;
    while (progress < 100) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      progress = parseInt(await this.zaproxy.ascan.status(activeScanId));
      console.log(`Active scan progress: ${progress}%`);
    }

    console.log('Active scan completed');

    return {
      scanId: activeScanId,
      completed: true
    };
  }

  async configureActiveScanPolicies() {
    // Enable all active scan rules for comprehensive testing
    const scanPolicies = [
      'SQL Injection',
      'Cross Site Scripting (Persistent)',
      'Cross Site Scripting (Reflected)',
      'Path Traversal',
      'Remote File Inclusion',
      'Server Side Include',
      'Script Active Scan Rules',
      'Cross Site Request Forgery',
      'Session Fixation',
      'Buffer Overflow',
      'Format String Error',
      'LDAP Injection',
      'XPath Injection',
      'XML External Entity Attack',
      'Generic Padding Oracle',
      'Expression Language Injection'
    ];

    for (const policy of scanPolicies) {
      try {
        await this.zaproxy.ascan.enableScanners(policy);
      } catch (error) {
        console.warn(`Could not enable scan policy: ${policy}`);
      }
    }
  }

  async runPassiveScan() {
    console.log('Running passive security scan...');

    // Passive scan runs automatically, just wait for it to complete
    let recordsToScan = 1;
    while (recordsToScan > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      recordsToScan = parseInt(await this.zaproxy.pscan.recordsToScan());
    }

    console.log('Passive scan completed');

    return {
      completed: true,
      recordsScanned: await this.zaproxy.pscan.scanners()
    };
  }

  async testAuthentication() {
    console.log('Testing authentication security...');

    const authTests = {
      bruteForceResistance: await this.testBruteForceResistance(),
      sessionManagement: await this.testSessionManagement(),
      passwordSecurity: await this.testPasswordSecurity(),
      accountLockout: await this.testAccountLockout()
    };

    return authTests;
  }

  async testBruteForceResistance() {
    console.log('Testing brute force resistance...');

    const testResults = [];
    const commonPasswords = ['password', '123456', 'admin', 'test'];

    for (const password of commonPasswords) {
      try {
        const response = await this.makeRequest('POST', '/api/auth/login', {
          email: 'test@example.com',
          password: password
        });

        testResults.push({
          password: password,
          statusCode: response.status,
          blocked: response.status === 429 || response.status === 423
        });

        // Add delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        testResults.push({
          password: password,
          error: error.message
        });
      }
    }

    return {
      testType: 'Brute Force Resistance',
      results: testResults,
      vulnerable: testResults.some(r => !r.blocked && r.statusCode === 200)
    };
  }

  async testSessionManagement() {
    console.log('Testing session management...');

    const sessionTests = {
      sessionFixation: await this.testSessionFixation(),
      sessionTimeout: await this.testSessionTimeout(),
      secureCookies: await this.testSecureCookies()
    };

    return sessionTests;
  }

  async testSessionFixation() {
    // Test for session fixation vulnerability
    const initialSession = await this.getSessionId();

    // Login with the same session
    await this.makeRequest('POST', '/api/auth/login', {
      email: 'security.test@globaltaxcalc.com',
      password: 'SecurityTest123!'
    });

    const postLoginSession = await this.getSessionId();

    return {
      testType: 'Session Fixation',
      vulnerable: initialSession === postLoginSession,
      initialSession: initialSession,
      postLoginSession: postLoginSession
    };
  }

  async testSessionTimeout() {
    // Test session timeout implementation
    const loginResponse = await this.makeRequest('POST', '/api/auth/login', {
      email: 'security.test@globaltaxcalc.com',
      password: 'SecurityTest123!'
    });

    // Wait and test if session is still valid
    await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute

    const protectedResponse = await this.makeRequest('GET', '/api/user/profile');

    return {
      testType: 'Session Timeout',
      sessionExpired: protectedResponse.status === 401,
      responseStatus: protectedResponse.status
    };
  }

  async testSecureCookies() {
    const response = await this.makeRequest('GET', '/');
    const cookies = response.headers['set-cookie'] || [];

    const cookieAnalysis = cookies.map(cookie => {
      const isSecure = cookie.includes('Secure');
      const isHttpOnly = cookie.includes('HttpOnly');
      const hasSameSite = cookie.includes('SameSite');

      return {
        cookie: cookie.split(';')[0],
        secure: isSecure,
        httpOnly: isHttpOnly,
        sameSite: hasSameSite,
        isSecure: isSecure && isHttpOnly && hasSameSite
      };
    });

    return {
      testType: 'Secure Cookies',
      cookies: cookieAnalysis,
      allSecure: cookieAnalysis.every(c => c.isSecure)
    };
  }

  async testPasswordSecurity() {
    console.log('Testing password security policies...');

    const weakPasswords = [
      'password',
      '123456',
      'test',
      'admin',
      'password123'
    ];

    const testResults = [];

    for (const password of weakPasswords) {
      try {
        const response = await this.makeRequest('POST', '/api/auth/register', {
          firstName: 'Test',
          lastName: 'User',
          email: `test.${Date.now()}@example.com`,
          password: password,
          country: 'US'
        });

        testResults.push({
          password: password,
          accepted: response.status === 201,
          statusCode: response.status
        });
      } catch (error) {
        testResults.push({
          password: password,
          error: error.message
        });
      }
    }

    return {
      testType: 'Password Security',
      results: testResults,
      vulnerable: testResults.some(r => r.accepted)
    };
  }

  async testAccountLockout() {
    console.log('Testing account lockout mechanism...');

    const attempts = [];
    const testEmail = 'lockout.test@example.com';

    // Make multiple failed login attempts
    for (let i = 0; i < 10; i++) {
      try {
        const response = await this.makeRequest('POST', '/api/auth/login', {
          email: testEmail,
          password: 'wrongpassword'
        });

        attempts.push({
          attempt: i + 1,
          statusCode: response.status,
          locked: response.status === 423 || response.status === 429
        });

        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        attempts.push({
          attempt: i + 1,
          error: error.message
        });
      }
    }

    return {
      testType: 'Account Lockout',
      attempts: attempts,
      lockoutImplemented: attempts.some(a => a.locked)
    };
  }

  async testAPIEndpoints() {
    console.log('Testing API endpoint security...');

    const apiTests = {
      sqlInjection: await this.testSQLInjection(),
      xssVulnerabilities: await this.testXSSVulnerabilities(),
      inputValidation: await this.testInputValidation(),
      rateLimiting: await this.testRateLimiting()
    };

    return apiTests;
  }

  async testSQLInjection() {
    const sqlPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "' UNION SELECT * FROM users --",
      "1' OR '1'='1' --"
    ];

    const testResults = [];

    for (const payload of sqlPayloads) {
      try {
        const response = await this.makeRequest('POST', '/api/tax/calculate', {
          income: payload,
          filingStatus: 'single',
          state: 'CA'
        });

        testResults.push({
          payload: payload,
          statusCode: response.status,
          vulnerable: response.status === 200 && response.body.includes('error')
        });
      } catch (error) {
        testResults.push({
          payload: payload,
          error: error.message,
          vulnerable: false
        });
      }
    }

    return {
      testType: 'SQL Injection',
      results: testResults,
      vulnerable: testResults.some(r => r.vulnerable)
    };
  }

  async testXSSVulnerabilities() {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src="x" onerror="alert(1)">',
      'javascript:alert("XSS")',
      '<svg onload="alert(1)">'
    ];

    const testResults = [];

    for (const payload of xssPayloads) {
      try {
        const response = await this.makeRequest('POST', '/api/user/profile', {
          firstName: payload,
          lastName: 'Test'
        });

        testResults.push({
          payload: payload,
          statusCode: response.status,
          vulnerable: response.body && response.body.includes(payload)
        });
      } catch (error) {
        testResults.push({
          payload: payload,
          error: error.message,
          vulnerable: false
        });
      }
    }

    return {
      testType: 'XSS Vulnerabilities',
      results: testResults,
      vulnerable: testResults.some(r => r.vulnerable)
    };
  }

  async testInputValidation() {
    const invalidInputs = [
      { field: 'income', value: -1000 },
      { field: 'income', value: 'not_a_number' },
      { field: 'email', value: 'invalid_email' },
      { field: 'state', value: 'INVALID_STATE' }
    ];

    const testResults = [];

    for (const input of invalidInputs) {
      try {
        const payload = {
          income: 50000,
          filingStatus: 'single',
          state: 'CA',
          email: 'test@example.com'
        };

        payload[input.field] = input.value;

        const response = await this.makeRequest('POST', '/api/tax/calculate', payload);

        testResults.push({
          field: input.field,
          value: input.value,
          statusCode: response.status,
          properValidation: response.status === 400
        });
      } catch (error) {
        testResults.push({
          field: input.field,
          value: input.value,
          error: error.message,
          properValidation: true
        });
      }
    }

    return {
      testType: 'Input Validation',
      results: testResults,
      allValidated: testResults.every(r => r.properValidation)
    };
  }

  async testRateLimiting() {
    console.log('Testing rate limiting...');

    const requests = [];
    const endpoint = '/api/tax/calculate';

    // Make rapid requests
    for (let i = 0; i < 20; i++) {
      try {
        const response = await this.makeRequest('POST', endpoint, {
          income: 50000,
          filingStatus: 'single',
          state: 'CA'
        });

        requests.push({
          request: i + 1,
          statusCode: response.status,
          rateLimited: response.status === 429
        });
      } catch (error) {
        requests.push({
          request: i + 1,
          error: error.message,
          rateLimited: true
        });
      }
    }

    return {
      testType: 'Rate Limiting',
      requests: requests,
      rateLimitingActive: requests.some(r => r.rateLimited)
    };
  }

  async getVulnerabilityReport() {
    console.log('Generating vulnerability report...');

    const alerts = await this.zaproxy.core.alerts();
    const vulnerabilities = [];

    for (const alert of alerts) {
      vulnerabilities.push({
        name: alert.alert,
        risk: alert.risk,
        confidence: alert.confidence,
        description: alert.description,
        solution: alert.solution,
        reference: alert.reference,
        evidence: alert.evidence,
        url: alert.url,
        param: alert.param
      });
    }

    // Group by risk level
    const riskLevels = {
      High: vulnerabilities.filter(v => v.risk === 'High'),
      Medium: vulnerabilities.filter(v => v.risk === 'Medium'),
      Low: vulnerabilities.filter(v => v.risk === 'Low'),
      Informational: vulnerabilities.filter(v => v.risk === 'Informational')
    };

    return {
      totalVulnerabilities: vulnerabilities.length,
      riskBreakdown: {
        High: riskLevels.High.length,
        Medium: riskLevels.Medium.length,
        Low: riskLevels.Low.length,
        Informational: riskLevels.Informational.length
      },
      vulnerabilities: riskLevels
    };
  }

  async generateSecurityReport(results) {
    console.log('Generating comprehensive security report...');

    const report = {
      timestamp: new Date().toISOString(),
      target: this.zapOptions.target,
      summary: this.generateSummary(results),
      results: results
    };

    // Save JSON report
    fs.writeFileSync(
      path.join(this.reportDir, 'security-report.json'),
      JSON.stringify(report, null, 2)
    );

    // Generate HTML report
    const htmlReport = this.generateHTMLReport(report);
    fs.writeFileSync(
      path.join(this.reportDir, 'security-report.html'),
      htmlReport
    );

    // Generate ZAP reports
    await this.generateZAPReports();

    console.log(`Security reports saved to: ${this.reportDir}`);
  }

  generateSummary(results) {
    const vulnerabilityCount = results.vulnerabilityAssessment.totalVulnerabilities;
    const highRiskCount = results.vulnerabilityAssessment.riskBreakdown.High;
    const authIssues = Object.values(results.authenticationTests).filter(test =>
      test.vulnerable || !test.allSecure || !test.lockoutImplemented
    ).length;

    return {
      overallRisk: highRiskCount > 0 ? 'High' : vulnerabilityCount > 5 ? 'Medium' : 'Low',
      totalVulnerabilities: vulnerabilityCount,
      highRiskVulnerabilities: highRiskCount,
      authenticationIssues: authIssues,
      urlsScanned: results.spiderResults.urlsFound,
      recommendationsCount: highRiskCount + authIssues
    };
  }

  generateHTMLReport(report) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>GlobalTaxCalc Security Assessment Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .risk-high { color: #d32f2f; }
        .risk-medium { color: #f57c00; }
        .risk-low { color: #388e3c; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>GlobalTaxCalc Security Assessment Report</h1>
    <p><strong>Generated:</strong> ${report.timestamp}</p>
    <p><strong>Target:</strong> ${report.target}</p>

    <div class="summary">
        <h2>Executive Summary</h2>
        <p><strong>Overall Risk Level:</strong> <span class="risk-${report.summary.overallRisk.toLowerCase()}">${report.summary.overallRisk}</span></p>
        <p><strong>Total Vulnerabilities:</strong> ${report.summary.totalVulnerabilities}</p>
        <p><strong>High Risk Issues:</strong> ${report.summary.highRiskVulnerabilities}</p>
        <p><strong>Authentication Issues:</strong> ${report.summary.authenticationIssues}</p>
        <p><strong>URLs Scanned:</strong> ${report.summary.urlsScanned}</p>
    </div>

    <h2>Vulnerability Breakdown</h2>
    <table>
        <tr><th>Risk Level</th><th>Count</th><th>Percentage</th></tr>
        <tr><td class="risk-high">High</td><td>${report.results.vulnerabilityAssessment.riskBreakdown.High}</td><td>${((report.results.vulnerabilityAssessment.riskBreakdown.High / report.summary.totalVulnerabilities) * 100).toFixed(1)}%</td></tr>
        <tr><td class="risk-medium">Medium</td><td>${report.results.vulnerabilityAssessment.riskBreakdown.Medium}</td><td>${((report.results.vulnerabilityAssessment.riskBreakdown.Medium / report.summary.totalVulnerabilities) * 100).toFixed(1)}%</td></tr>
        <tr><td class="risk-low">Low</td><td>${report.results.vulnerabilityAssessment.riskBreakdown.Low}</td><td>${((report.results.vulnerabilityAssessment.riskBreakdown.Low / report.summary.totalVulnerabilities) * 100).toFixed(1)}%</td></tr>
        <tr><td>Informational</td><td>${report.results.vulnerabilityAssessment.riskBreakdown.Informational}</td><td>${((report.results.vulnerabilityAssessment.riskBreakdown.Informational / report.summary.totalVulnerabilities) * 100).toFixed(1)}%</td></tr>
    </table>

    <h2>Authentication Security Test Results</h2>
    ${Object.entries(report.results.authenticationTests).map(([testName, testResult]) => `
        <h3>${testName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</h3>
        <p><strong>Status:</strong> ${this.getTestStatus(testResult)}</p>
    `).join('')}

    <h2>High Risk Vulnerabilities</h2>
    ${report.results.vulnerabilityAssessment.vulnerabilities.High.length > 0 ? `
        <table>
            <tr><th>Vulnerability</th><th>URL</th><th>Description</th><th>Solution</th></tr>
            ${report.results.vulnerabilityAssessment.vulnerabilities.High.map(vuln => `
                <tr>
                    <td>${vuln.name}</td>
                    <td>${vuln.url}</td>
                    <td>${vuln.description.substring(0, 100)}...</td>
                    <td>${vuln.solution.substring(0, 100)}...</td>
                </tr>
            `).join('')}
        </table>
    ` : '<p>No high risk vulnerabilities found.</p>'}

    <h2>Recommendations</h2>
    <ul>
        ${report.results.vulnerabilityAssessment.vulnerabilities.High.map(vuln => `<li>${vuln.solution}</li>`).join('')}
        ${this.generateAuthRecommendations(report.results.authenticationTests).map(rec => `<li>${rec}</li>`).join('')}
    </ul>
</body>
</html>
    `;
  }

  getTestStatus(testResult) {
    if (testResult.vulnerable === true) return 'VULNERABLE';
    if (testResult.allSecure === false) return 'INSECURE';
    if (testResult.lockoutImplemented === false) return 'NOT IMPLEMENTED';
    return 'PASSED';
  }

  generateAuthRecommendations(authTests) {
    const recommendations = [];

    if (authTests.bruteForceResistance.vulnerable) {
      recommendations.push('Implement rate limiting and account lockout for login attempts');
    }

    if (!authTests.sessionManagement.secureCookies.allSecure) {
      recommendations.push('Ensure all cookies are marked as Secure, HttpOnly, and have SameSite attribute');
    }

    if (authTests.passwordSecurity.vulnerable) {
      recommendations.push('Implement stronger password complexity requirements');
    }

    if (!authTests.accountLockout.lockoutImplemented) {
      recommendations.push('Implement account lockout mechanism after multiple failed login attempts');
    }

    return recommendations;
  }

  async generateZAPReports() {
    // Generate ZAP HTML report
    const htmlReport = await this.zaproxy.core.htmlreport();
    fs.writeFileSync(path.join(this.reportDir, 'zap-security-report.html'), htmlReport);

    // Generate ZAP XML report
    const xmlReport = await this.zaproxy.core.xmlreport();
    fs.writeFileSync(path.join(this.reportDir, 'zap-security-report.xml'), xmlReport);

    // Generate ZAP JSON report
    const jsonReport = await this.zaproxy.core.jsonreport();
    fs.writeFileSync(path.join(this.reportDir, 'zap-security-report.json'), jsonReport);
  }

  async makeRequest(method, endpoint, data = null) {
    const axios = require('axios');

    const config = {
      method: method,
      url: `${this.zapOptions.target}${endpoint}`,
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: () => true // Don't throw on any status code
    };

    if (data) {
      config.data = data;
    }

    return await axios(config);
  }

  async getSessionId() {
    const response = await this.makeRequest('GET', '/');
    const cookies = response.headers['set-cookie'] || [];
    const sessionCookie = cookies.find(cookie => cookie.includes('session'));
    return sessionCookie ? sessionCookie.split('=')[1].split(';')[0] : null;
  }

  async stopZAP() {
    console.log('Stopping OWASP ZAP...');

    try {
      await this.zaproxy.core.shutdown();
      if (this.zapProcess) {
        this.zapProcess.kill();
      }
    } catch (error) {
      console.error('Error stopping ZAP:', error);
    }
  }
}

// CLI execution
if (require.main === module) {
  const targetUrl = process.env.TARGET_URL || 'http://localhost:3000';
  const scanner = new SecurityScanner({ target: targetUrl });

  scanner.runSecurityScan()
    .then((results) => {
      console.log('\n=== Security Scan Complete ===');
      console.log(`Total vulnerabilities found: ${results.vulnerabilityAssessment.totalVulnerabilities}`);
      console.log(`High risk issues: ${results.vulnerabilityAssessment.riskBreakdown.High}`);
      console.log('Detailed reports generated in security/reports directory');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Security scan failed:', error);
      process.exit(1);
    });
}

module.exports = SecurityScanner;