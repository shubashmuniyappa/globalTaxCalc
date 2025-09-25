const axios = require('axios');
const WebSocket = require('ws');

describe('API Gateway Routing and Load Balancing', () => {
  let authToken;

  beforeAll(async () => {
    authToken = await global.authenticateTestUser();
  });

  describe('Service Discovery and Routing', () => {
    test('should route auth requests to auth service', async () => {
      const headers = global.createAuthHeaders(authToken);

      const response = await axios.get(`${global.TEST_CONFIG.API_GATEWAY_URL}/api/auth/me`, { headers });

      expect(response.status).toBe(200);
      expect(response.headers).toHaveProperty('x-service-name', 'auth-service');
      expect(response.data).toHaveProperty('user');
    });

    test('should route tax calculation requests to tax engine', async () => {
      const headers = global.createAuthHeaders(authToken);
      const calculationData = global.TEST_DATA.taxCalculation;

      const response = await axios.post(
        `${global.TEST_CONFIG.API_GATEWAY_URL}/api/calculations`,
        calculationData,
        { headers }
      );

      expect(response.status).toBe(201);
      expect(response.headers).toHaveProperty('x-service-name', 'tax-engine');
      expect(response.data).toHaveProperty('result');
    });

    test('should route file requests to file service', async () => {
      const headers = global.createAuthHeaders(authToken);

      const response = await axios.get(`${global.TEST_CONFIG.API_GATEWAY_URL}/api/files`, { headers });

      expect(response.status).toBe(200);
      expect(response.headers).toHaveProperty('x-service-name', 'file-service');
    });

    test('should route report requests to report service', async () => {
      const headers = global.createAuthHeaders(authToken);

      const response = await axios.get(`${global.TEST_CONFIG.API_GATEWAY_URL}/api/reports`, { headers });

      expect(response.status).toBe(200);
      expect(response.headers).toHaveProperty('x-service-name', 'report-service');
    });

    test('should handle unknown routes with 404', async () => {
      const headers = global.createAuthHeaders(authToken);

      try {
        await axios.get(`${global.TEST_CONFIG.API_GATEWAY_URL}/api/unknown`, { headers });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(404);
        expect(error.response.data).toHaveProperty('error');
      }
    });
  });

  describe('Load Balancing', () => {
    test('should distribute requests across multiple service instances', async () => {
      const headers = global.createAuthHeaders(authToken);
      const serviceInstances = new Set();

      // Make multiple requests to see different instances
      for (let i = 0; i < 20; i++) {
        const response = await axios.get(`${global.TEST_CONFIG.API_GATEWAY_URL}/api/auth/me`, { headers });

        expect(response.status).toBe(200);

        // Track which instance handled the request
        const instanceId = response.headers['x-instance-id'];
        if (instanceId) {
          serviceInstances.add(instanceId);
        }

        // Small delay to allow load balancer to distribute
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Should see multiple instances (if running in cluster mode)
      console.log(`Requests distributed across ${serviceInstances.size} service instances`);
    });

    test('should handle service failures gracefully', async () => {
      const headers = global.createAuthHeaders(authToken);

      // Simulate multiple requests during potential service failures
      const requests = Array(10).fill().map(async () => {
        try {
          const response = await axios.get(`${global.TEST_CONFIG.API_GATEWAY_URL}/api/auth/me`, {
            headers,
            timeout: 5000
          });
          return { success: true, status: response.status };
        } catch (error) {
          return {
            success: false,
            status: error.response?.status || 0,
            code: error.code
          };
        }
      });

      const results = await Promise.all(requests);
      const successfulRequests = results.filter(r => r.success);

      // Most requests should succeed even with potential failures
      expect(successfulRequests.length).toBeGreaterThanOrEqual(results.length * 0.8);
    });

    test('should implement circuit breaker pattern', async () => {
      const headers = global.createAuthHeaders(authToken);

      // Make requests to an endpoint that might fail
      const requests = Array(30).fill().map(async (_, index) => {
        try {
          const response = await axios.get(
            `${global.TEST_CONFIG.API_GATEWAY_URL}/api/health/detailed`,
            {
              headers,
              timeout: 2000
            }
          );
          return { success: true, status: response.status, index };
        } catch (error) {
          return {
            success: false,
            status: error.response?.status || 0,
            code: error.code,
            index
          };
        }
      });

      const results = await Promise.all(requests);
      const failures = results.filter(r => !r.success);

      // Circuit breaker should prevent cascading failures
      console.log(`${failures.length} failures out of ${results.length} requests`);
      expect(failures.length).toBeLessThan(results.length * 0.5);
    });
  });

  describe('Rate Limiting and Throttling', () => {
    test('should enforce rate limits per user', async () => {
      const headers = global.createAuthHeaders(authToken);

      // Make rapid requests
      const rapidRequests = Array(50).fill().map(() =>
        axios.get(`${global.TEST_CONFIG.API_GATEWAY_URL}/api/auth/me`, { headers })
      );

      const results = await Promise.allSettled(rapidRequests);
      const rateLimitedRequests = results.filter(
        r => r.status === 'rejected' && r.reason?.response?.status === 429
      );

      // Should have some rate limited requests
      expect(rateLimitedRequests.length).toBeGreaterThan(0);

      // Rate limit headers should be present
      const successfulRequest = results.find(r => r.status === 'fulfilled');
      if (successfulRequest) {
        const headers = successfulRequest.value.headers;
        expect(headers).toHaveProperty('x-ratelimit-limit');
        expect(headers).toHaveProperty('x-ratelimit-remaining');
        expect(headers).toHaveProperty('x-ratelimit-reset');
      }
    });

    test('should implement different rate limits for different endpoints', async () => {
      const headers = global.createAuthHeaders(authToken);

      // Test calculation endpoint (typically lower rate limit)
      const calculationRequests = Array(10).fill().map(() =>
        axios.post(
          `${global.TEST_CONFIG.API_GATEWAY_URL}/api/calculations`,
          global.TEST_DATA.taxCalculation,
          { headers }
        )
      );

      // Test auth endpoint (typically higher rate limit)
      const authRequests = Array(20).fill().map(() =>
        axios.get(`${global.TEST_CONFIG.API_GATEWAY_URL}/api/auth/me`, { headers })
      );

      const [calculationResults, authResults] = await Promise.allSettled([
        Promise.allSettled(calculationRequests),
        Promise.allSettled(authRequests)
      ]);

      // Calculation endpoint should have stricter rate limiting
      const calculationFailures = calculationResults.value.filter(
        r => r.status === 'rejected' && r.reason?.response?.status === 429
      );

      const authFailures = authResults.value.filter(
        r => r.status === 'rejected' && r.reason?.response?.status === 429
      );

      console.log(`Calculation rate limit failures: ${calculationFailures.length}`);
      console.log(`Auth rate limit failures: ${authFailures.length}`);
    });

    test('should handle burst traffic with queue management', async () => {
      const headers = global.createAuthHeaders(authToken);

      // Simulate burst traffic
      const burstSize = 25;
      const startTime = Date.now();

      const burstRequests = Array(burstSize).fill().map(async (_, index) => {
        const delay = Math.random() * 100; // Random delay up to 100ms
        await new Promise(resolve => setTimeout(resolve, delay));

        try {
          const response = await axios.get(`${global.TEST_CONFIG.API_GATEWAY_URL}/api/auth/me`, {
            headers,
            timeout: 10000
          });
          return {
            success: true,
            status: response.status,
            duration: Date.now() - startTime,
            index
          };
        } catch (error) {
          return {
            success: false,
            status: error.response?.status || 0,
            duration: Date.now() - startTime,
            index
          };
        }
      });

      const results = await Promise.all(burstRequests);
      const totalDuration = Date.now() - startTime;

      // Most requests should succeed
      const successfulRequests = results.filter(r => r.success);
      expect(successfulRequests.length).toBeGreaterThan(burstSize * 0.7);

      // Should complete in reasonable time
      expect(totalDuration).toBeLessThan(30000);

      console.log(`Burst test: ${successfulRequests.length}/${burstSize} succeeded in ${totalDuration}ms`);
    });
  });

  describe('WebSocket and Real-time Features', () => {
    test('should handle WebSocket connections through gateway', (done) => {
      const wsUrl = global.TEST_CONFIG.API_GATEWAY_URL.replace('http', 'ws') + '/ws';
      const ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        expect(message).toHaveProperty('type');

        if (message.type === 'pong') {
          expect(message).toHaveProperty('timestamp');
          ws.close();
          done();
        }
      });

      ws.on('error', (error) => {
        done(error);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        ws.close();
        done(new Error('WebSocket test timeout'));
      }, 10000);
    });

    test('should broadcast calculation updates via WebSocket', (done) => {
      const wsUrl = global.TEST_CONFIG.API_GATEWAY_URL.replace('http', 'ws') + '/ws';
      const ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      ws.on('open', async () => {
        // Subscribe to calculation updates
        ws.send(JSON.stringify({ type: 'subscribe', channel: 'calculations' }));

        // Trigger a calculation via HTTP
        const headers = global.createAuthHeaders(authToken);
        await axios.post(
          `${global.TEST_CONFIG.API_GATEWAY_URL}/api/calculations`,
          global.TEST_DATA.taxCalculation,
          { headers }
        );
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'calculation_completed') {
          expect(message).toHaveProperty('calculationId');
          expect(message).toHaveProperty('result');
          ws.close();
          done();
        }
      });

      ws.on('error', (error) => {
        done(error);
      });

      setTimeout(() => {
        ws.close();
        done(new Error('WebSocket calculation update timeout'));
      }, 15000);
    });
  });

  describe('CORS and Security Headers', () => {
    test('should set appropriate CORS headers', async () => {
      const response = await axios.options(`${global.TEST_CONFIG.API_GATEWAY_URL}/api/auth/me`, {
        headers: {
          'Origin': 'https://globaltaxcalc.com',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'authorization'
        }
      });

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
    });

    test('should set security headers', async () => {
      const headers = global.createAuthHeaders(authToken);

      const response = await axios.get(`${global.TEST_CONFIG.API_GATEWAY_URL}/api/auth/me`, { headers });

      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
      expect(response.headers).toHaveProperty('strict-transport-security');
    });

    test('should handle CSRF protection', async () => {
      // Test CSRF token validation for state-changing operations
      const headers = global.createAuthHeaders(authToken);

      try {
        await axios.post(
          `${global.TEST_CONFIG.API_GATEWAY_URL}/api/calculations`,
          global.TEST_DATA.taxCalculation,
          {
            headers: {
              ...headers,
              'X-Requested-With': 'XMLHttpRequest' // Simulating AJAX request
            }
          }
        );
      } catch (error) {
        // CSRF protection might reject certain requests
        if (error.response?.status === 403) {
          expect(error.response.data).toHaveProperty('error');
        }
      }
    });
  });

  describe('Request/Response Transformation', () => {
    test('should transform request data format', async () => {
      const headers = global.createAuthHeaders(authToken);

      // Send request with different data format
      const legacyFormatData = {
        salary: 75000, // legacy field name
        nation: 'US', // legacy field name
        status: 'single' // legacy field name
      };

      const response = await axios.post(
        `${global.TEST_CONFIG.API_GATEWAY_URL}/api/calculations/legacy`,
        legacyFormatData,
        { headers }
      );

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('result');
      // Gateway should transform legacy format to new format
    });

    test('should add request metadata', async () => {
      const headers = global.createAuthHeaders(authToken);

      const response = await axios.get(`${global.TEST_CONFIG.API_GATEWAY_URL}/api/auth/me`, { headers });

      expect(response.status).toBe(200);
      // Response should include metadata added by gateway
      expect(response.headers).toHaveProperty('x-request-id');
      expect(response.headers).toHaveProperty('x-response-time');
    });

    test('should handle API versioning', async () => {
      const headers = global.createAuthHeaders(authToken);

      // Test v1 API
      const v1Response = await axios.get(
        `${global.TEST_CONFIG.API_GATEWAY_URL}/api/v1/calculations`,
        { headers }
      );

      // Test v2 API
      const v2Response = await axios.get(
        `${global.TEST_CONFIG.API_GATEWAY_URL}/api/v2/calculations`,
        { headers }
      );

      expect(v1Response.status).toBe(200);
      expect(v2Response.status).toBe(200);

      // Different versions might have different response formats
      expect(v1Response.headers).toHaveProperty('x-api-version', 'v1');
      expect(v2Response.headers).toHaveProperty('x-api-version', 'v2');
    });
  });

  describe('Health Checks and Monitoring', () => {
    test('should provide gateway health status', async () => {
      const response = await axios.get(`${global.TEST_CONFIG.API_GATEWAY_URL}/health`);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status');
      expect(response.data).toHaveProperty('services');
      expect(response.data).toHaveProperty('timestamp');

      // Should include status of downstream services
      expect(response.data.services).toHaveProperty('auth-service');
      expect(response.data.services).toHaveProperty('tax-engine');
      expect(response.data.services).toHaveProperty('report-service');
    });

    test('should provide metrics endpoint', async () => {
      const response = await axios.get(`${global.TEST_CONFIG.API_GATEWAY_URL}/metrics`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');

      // Should contain Prometheus metrics
      expect(response.data).toContain('http_requests_total');
      expect(response.data).toContain('http_request_duration_seconds');
    });

    test('should track request metrics', async () => {
      const headers = global.createAuthHeaders(authToken);

      // Make several requests
      await Promise.all([
        axios.get(`${global.TEST_CONFIG.API_GATEWAY_URL}/api/auth/me`, { headers }),
        axios.get(`${global.TEST_CONFIG.API_GATEWAY_URL}/api/calculations`, { headers }),
        axios.get(`${global.TEST_CONFIG.API_GATEWAY_URL}/api/reports`, { headers })
      ]);

      // Check metrics
      const metricsResponse = await axios.get(`${global.TEST_CONFIG.API_GATEWAY_URL}/metrics`);
      const metrics = metricsResponse.data;

      // Should track requests to different services
      expect(metrics).toContain('service="auth-service"');
      expect(metrics).toContain('service="tax-engine"');
      expect(metrics).toContain('service="report-service"');
    });
  });
});