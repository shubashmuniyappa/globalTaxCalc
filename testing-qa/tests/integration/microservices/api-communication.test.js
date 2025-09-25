/**
 * Integration Tests for Microservice Communication
 * Tests the communication between different microservices
 */

const axios = require('axios');
const { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } = require('@jest/globals');

describe('Microservice Communication Integration Tests', () => {
  let testUserId;
  let testAuthToken;
  let testTaxCalculationId;

  const API_GATEWAY_URL = process.env.API_URL || 'http://localhost:3001';
  const AUTH_SERVICE_URL = process.env.AUTH_URL || 'http://localhost:3002';

  // Test data
  const testUser = {
    email: 'integration.test@globaltaxcalc.com',
    password: 'TestPassword123!',
    firstName: 'Integration',
    lastName: 'Test',
    country: 'US'
  };

  const testTaxData = {
    income: 75000,
    filingStatus: 'single',
    state: 'CA',
    deductions: {
      standard: 14600,
      itemized: {
        charitable: 5000,
        medical: 2000,
        stateAndLocal: 10000
      }
    },
    credits: {
      childTaxCredit: 0,
      earnedIncomeCredit: 0
    }
  };

  beforeAll(async () => {
    // Wait for services to be ready
    await waitForServices();

    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
  });

  beforeEach(async () => {
    // Reset any state between tests
    jest.clearAllMocks();
  });

  describe('Auth Service Communication', () => {
    test('should register user through API Gateway', async () => {
      const response = await axios.post(`${API_GATEWAY_URL}/api/auth/register`, testUser);

      expect(response.status).toBe(201);
      expect(response.data).toMatchObject({
        success: true,
        user: {
          email: testUser.email,
          firstName: testUser.firstName,
          lastName: testUser.lastName
        }
      });
      expect(response.data.user.password).toBeUndefined();

      testUserId = response.data.user.id;
    });

    test('should login user and receive JWT token', async () => {
      const loginData = {
        email: testUser.email,
        password: testUser.password
      };

      const response = await axios.post(`${API_GATEWAY_URL}/api/auth/login`, loginData);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        token: expect.any(String),
        user: {
          id: testUserId,
          email: testUser.email
        }
      });

      testAuthToken = response.data.token;
    });

    test('should validate JWT token across services', async () => {
      const authHeaders = {
        headers: { Authorization: `Bearer ${testAuthToken}` }
      };

      // Test token validation through API Gateway
      const profileResponse = await axios.get(`${API_GATEWAY_URL}/api/user/profile`, authHeaders);
      expect(profileResponse.status).toBe(200);
      expect(profileResponse.data.user.id).toBe(testUserId);

      // Test token validation for protected tax calculation endpoint
      const taxResponse = await axios.get(`${API_GATEWAY_URL}/api/tax/calculations`, authHeaders);
      expect(taxResponse.status).toBe(200);
    });

    test('should handle token refresh across services', async () => {
      // Get refresh token
      const refreshResponse = await axios.post(`${API_GATEWAY_URL}/api/auth/refresh`, {
        token: testAuthToken
      });

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.data.token).toBeDefined();
      expect(refreshResponse.data.token).not.toBe(testAuthToken);

      // Verify new token works
      const newToken = refreshResponse.data.token;
      const profileResponse = await axios.get(`${API_GATEWAY_URL}/api/user/profile`, {
        headers: { Authorization: `Bearer ${newToken}` }
      });

      expect(profileResponse.status).toBe(200);
    });
  });

  describe('Tax Calculation Service Communication', () => {
    test('should calculate taxes through microservice chain', async () => {
      const authHeaders = {
        headers: { Authorization: `Bearer ${testAuthToken}` }
      };

      // Submit tax calculation request
      const response = await axios.post(
        `${API_GATEWAY_URL}/api/tax/calculate`,
        testTaxData,
        authHeaders
      );

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        calculation: {
          id: expect.any(String),
          userId: testUserId,
          income: testTaxData.income,
          taxOwed: expect.any(Number),
          effectiveRate: expect.any(Number),
          marginalRate: expect.any(Number)
        }
      });

      testTaxCalculationId = response.data.calculation.id;
    });

    test('should save calculation to database through data service', async () => {
      const authHeaders = {
        headers: { Authorization: `Bearer ${testAuthToken}` }
      };

      // Retrieve saved calculation
      const response = await axios.get(
        `${API_GATEWAY_URL}/api/tax/calculations/${testTaxCalculationId}`,
        authHeaders
      );

      expect(response.status).toBe(200);
      expect(response.data.calculation).toMatchObject({
        id: testTaxCalculationId,
        userId: testUserId,
        income: testTaxData.income,
        status: 'completed'
      });
    });

    test('should handle multi-country calculations through routing', async () => {
      const authHeaders = {
        headers: { Authorization: `Bearer ${testAuthToken}` }
      };

      const canadaTaxData = {
        ...testTaxData,
        country: 'CA',
        province: 'ON',
        income: 75000
      };

      const response = await axios.post(
        `${API_GATEWAY_URL}/api/tax/calculate`,
        canadaTaxData,
        authHeaders
      );

      expect(response.status).toBe(200);
      expect(response.data.calculation.country).toBe('CA');
      expect(response.data.calculation.provincialTax).toBeDefined();
      expect(response.data.calculation.gst).toBeDefined();
    });
  });

  describe('Payment Service Communication', () => {
    test('should process subscription payment through payment service', async () => {
      const authHeaders = {
        headers: { Authorization: `Bearer ${testAuthToken}` }
      };

      const paymentData = {
        planId: 'premium_monthly',
        paymentMethodId: 'pm_card_visa', // Stripe test payment method
        billingAddress: {
          line1: '123 Test St',
          city: 'Test City',
          state: 'CA',
          postalCode: '12345',
          country: 'US'
        }
      };

      const response = await axios.post(
        `${API_GATEWAY_URL}/api/payment/subscribe`,
        paymentData,
        authHeaders
      );

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        subscription: {
          id: expect.any(String),
          status: 'active',
          planId: 'premium_monthly'
        }
      });
    });

    test('should handle payment webhooks and update user status', async () => {
      // Simulate Stripe webhook
      const webhookData = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_test_123',
            customer: testUserId,
            status: 'past_due'
          }
        }
      };

      const response = await axios.post(
        `${API_GATEWAY_URL}/api/payment/webhook`,
        webhookData,
        {
          headers: {
            'stripe-signature': 'test_signature'
          }
        }
      );

      expect(response.status).toBe(200);

      // Verify user status was updated
      const authHeaders = {
        headers: { Authorization: `Bearer ${testAuthToken}` }
      };

      const userResponse = await axios.get(
        `${API_GATEWAY_URL}/api/user/subscription`,
        authHeaders
      );

      expect(userResponse.data.subscription.status).toBe('past_due');
    });
  });

  describe('Notification Service Communication', () => {
    test('should send email notifications through notification service', async () => {
      const authHeaders = {
        headers: { Authorization: `Bearer ${testAuthToken}` }
      };

      const notificationData = {
        type: 'tax_calculation_complete',
        calculationId: testTaxCalculationId,
        recipientEmail: testUser.email
      };

      const response = await axios.post(
        `${API_GATEWAY_URL}/api/notifications/send`,
        notificationData,
        authHeaders
      );

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        messageId: expect.any(String),
        status: 'sent'
      });
    });

    test('should handle notification preferences across services', async () => {
      const authHeaders = {
        headers: { Authorization: `Bearer ${testAuthToken}` }
      };

      const preferences = {
        emailNotifications: true,
        smsNotifications: false,
        marketingEmails: false,
        calculationReminders: true
      };

      const updateResponse = await axios.put(
        `${API_GATEWAY_URL}/api/user/notification-preferences`,
        preferences,
        authHeaders
      );

      expect(updateResponse.status).toBe(200);

      // Verify preferences are applied in notification service
      const testNotification = {
        type: 'marketing_email',
        recipientEmail: testUser.email
      };

      const notificationResponse = await axios.post(
        `${API_GATEWAY_URL}/api/notifications/send`,
        testNotification,
        authHeaders
      );

      // Should be blocked due to preferences
      expect(notificationResponse.status).toBe(400);
      expect(notificationResponse.data.error).toContain('Marketing emails disabled');
    });
  });

  describe('File Processing Service Communication', () => {
    test('should upload and process tax documents', async () => {
      const authHeaders = {
        headers: {
          Authorization: `Bearer ${testAuthToken}`,
          'Content-Type': 'multipart/form-data'
        }
      };

      // Create test file buffer
      const testFile = Buffer.from('Test W2 document content', 'utf8');

      const formData = new FormData();
      formData.append('file', new Blob([testFile]), 'test-w2.pdf');
      formData.append('documentType', 'w2');
      formData.append('taxYear', '2024');

      const uploadResponse = await axios.post(
        `${API_GATEWAY_URL}/api/documents/upload`,
        formData,
        authHeaders
      );

      expect(uploadResponse.status).toBe(200);
      expect(uploadResponse.data).toMatchObject({
        success: true,
        document: {
          id: expect.any(String),
          type: 'w2',
          status: 'processing'
        }
      });

      const documentId = uploadResponse.data.document.id;

      // Wait for processing and check status
      await waitForDocumentProcessing(documentId, authHeaders);

      const statusResponse = await axios.get(
        `${API_GATEWAY_URL}/api/documents/${documentId}`,
        authHeaders
      );

      expect(statusResponse.data.document.status).toBe('processed');
      expect(statusResponse.data.document.extractedData).toBeDefined();
    });
  });

  describe('Analytics Service Communication', () => {
    test('should track user actions across services', async () => {
      const authHeaders = {
        headers: { Authorization: `Bearer ${testAuthToken}` }
      };

      // Perform tracked action
      await axios.post(
        `${API_GATEWAY_URL}/api/tax/calculate`,
        testTaxData,
        authHeaders
      );

      // Check analytics data
      const analyticsResponse = await axios.get(
        `${API_GATEWAY_URL}/api/analytics/user-actions`,
        {
          ...authHeaders,
          params: {
            userId: testUserId,
            timeRange: '1h'
          }
        }
      );

      expect(analyticsResponse.status).toBe(200);
      expect(analyticsResponse.data.actions).toContainEqual(
        expect.objectContaining({
          action: 'tax_calculation',
          userId: testUserId
        })
      );
    });
  });

  describe('Error Handling and Circuit Breakers', () => {
    test('should handle service timeouts gracefully', async () => {
      const authHeaders = {
        headers: { Authorization: `Bearer ${testAuthToken}` }
      };

      // Create request that will timeout (mock slow service)
      const slowRequest = axios.post(
        `${API_GATEWAY_URL}/api/test/slow-service`,
        { delay: 10000 }, // 10 second delay
        { ...authHeaders, timeout: 5000 } // 5 second timeout
      );

      await expect(slowRequest).rejects.toThrow();

      // Verify circuit breaker kicks in
      const circuitBreakerResponse = await axios.get(
        `${API_GATEWAY_URL}/api/health/circuit-breakers`,
        authHeaders
      );

      expect(circuitBreakerResponse.data.services.slowService.state).toBe('open');
    });

    test('should handle service failures with fallbacks', async () => {
      const authHeaders = {
        headers: { Authorization: `Bearer ${testAuthToken}` }
      };

      // Trigger service failure
      await axios.post(
        `${API_GATEWAY_URL}/api/test/fail-service`,
        { service: 'tax-calculation' },
        authHeaders
      );

      // Request should use fallback service
      const response = await axios.post(
        `${API_GATEWAY_URL}/api/tax/calculate`,
        testTaxData,
        authHeaders
      );

      expect(response.status).toBe(200);
      expect(response.headers['x-served-by-fallback']).toBe('true');
    });
  });

  // Helper functions
  async function waitForServices() {
    const services = [
      `${API_GATEWAY_URL}/health`,
      `${AUTH_SERVICE_URL}/health`
    ];

    for (const service of services) {
      let retries = 30;
      while (retries > 0) {
        try {
          await axios.get(service, { timeout: 5000 });
          break;
        } catch (error) {
          retries--;
          if (retries === 0) throw new Error(`Service ${service} not ready`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
  }

  async function setupTestData() {
    // Setup any required test data
    console.log('Setting up integration test data...');
  }

  async function cleanupTestData() {
    if (testUserId) {
      try {
        await axios.delete(`${API_GATEWAY_URL}/api/test/cleanup/user/${testUserId}`);
      } catch (error) {
        console.warn('Cleanup failed:', error.message);
      }
    }
  }

  async function waitForDocumentProcessing(documentId, authHeaders) {
    let retries = 10;
    while (retries > 0) {
      const response = await axios.get(
        `${API_GATEWAY_URL}/api/documents/${documentId}`,
        authHeaders
      );

      if (response.data.document.status === 'processed') {
        return;
      }

      retries--;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error('Document processing timeout');
  }
});