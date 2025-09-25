const axios = require('axios');
const jwt = require('jsonwebtoken');

describe('Authentication and Authorization Flow', () => {
  let testUser;
  let authToken;

  beforeAll(() => {
    testUser = global.generateTestData('user');
  });

  describe('User Registration', () => {
    test('should register a new user successfully', async () => {
      const response = await axios.post(`${global.TEST_CONFIG.AUTH_SERVICE_URL}/api/auth/register`, testUser);

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('message', 'User registered successfully');
      expect(response.data).toHaveProperty('user');
      expect(response.data.user).toHaveProperty('email', testUser.email);
      expect(response.data.user).not.toHaveProperty('password');
    });

    test('should reject duplicate email registration', async () => {
      try {
        await axios.post(`${global.TEST_CONFIG.AUTH_SERVICE_URL}/api/auth/register`, testUser);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(409);
        expect(error.response.data).toHaveProperty('error');
      }
    });

    test('should validate required fields', async () => {
      const incompleteUser = { email: 'test@example.com' };

      try {
        await axios.post(`${global.TEST_CONFIG.AUTH_SERVICE_URL}/api/auth/register`, incompleteUser);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(400);
        expect(error.response.data).toHaveProperty('error');
      }
    });

    test('should validate email format', async () => {
      const invalidUser = { ...testUser, email: 'invalid-email' };

      try {
        await axios.post(`${global.TEST_CONFIG.AUTH_SERVICE_URL}/api/auth/register`, invalidUser);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(400);
        expect(error.response.data).toHaveProperty('error');
      }
    });
  });

  describe('User Login', () => {
    test('should login with valid credentials', async () => {
      const loginData = {
        email: testUser.email,
        password: testUser.password
      };

      const response = await axios.post(`${global.TEST_CONFIG.AUTH_SERVICE_URL}/api/auth/login`, loginData);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('token');
      expect(response.data).toHaveProperty('user');
      expect(response.data.user).toHaveProperty('email', testUser.email);

      authToken = response.data.token;

      // Verify JWT token
      const decoded = jwt.verify(authToken, global.TEST_CONFIG.JWT_SECRET);
      expect(decoded).toHaveProperty('userId');
      expect(decoded).toHaveProperty('email', testUser.email);
    });

    test('should reject invalid email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: testUser.password
      };

      try {
        await axios.post(`${global.TEST_CONFIG.AUTH_SERVICE_URL}/api/auth/login`, loginData);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(401);
        expect(error.response.data).toHaveProperty('error');
      }
    });

    test('should reject invalid password', async () => {
      const loginData = {
        email: testUser.email,
        password: 'wrongpassword'
      };

      try {
        await axios.post(`${global.TEST_CONFIG.AUTH_SERVICE_URL}/api/auth/login`, loginData);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(401);
        expect(error.response.data).toHaveProperty('error');
      }
    });
  });

  describe('Token Validation', () => {
    test('should validate token and return user info', async () => {
      const headers = global.createAuthHeaders(authToken);

      const response = await axios.get(`${global.TEST_CONFIG.AUTH_SERVICE_URL}/api/auth/me`, { headers });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('user');
      expect(response.data.user).toHaveProperty('email', testUser.email);
    });

    test('should reject invalid token', async () => {
      const headers = global.createAuthHeaders('invalid-token');

      try {
        await axios.get(`${global.TEST_CONFIG.AUTH_SERVICE_URL}/api/auth/me`, { headers });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(401);
        expect(error.response.data).toHaveProperty('error');
      }
    });

    test('should reject expired token', async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { userId: 'test', email: testUser.email },
        global.TEST_CONFIG.JWT_SECRET,
        { expiresIn: '-1h' }
      );

      const headers = global.createAuthHeaders(expiredToken);

      try {
        await axios.get(`${global.TEST_CONFIG.AUTH_SERVICE_URL}/api/auth/me`, { headers });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(401);
        expect(error.response.data).toHaveProperty('error');
      }
    });
  });

  describe('Authorization Levels', () => {
    test('should access user-level endpoints with valid token', async () => {
      const headers = global.createAuthHeaders(authToken);

      const response = await axios.get(`${global.TEST_CONFIG.TAX_ENGINE_URL}/api/calculations`, { headers });

      expect(response.status).toBe(200);
    });

    test('should reject access without token', async () => {
      try {
        await axios.get(`${global.TEST_CONFIG.TAX_ENGINE_URL}/api/calculations`);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(401);
      }
    });

    test('should enforce rate limiting', async () => {
      const headers = global.createAuthHeaders(authToken);

      // Make multiple requests rapidly
      const requests = Array(20).fill().map(() =>
        axios.get(`${global.TEST_CONFIG.AUTH_SERVICE_URL}/api/auth/me`, { headers })
      );

      const responses = await Promise.allSettled(requests);
      const rateLimitedResponses = responses.filter(
        r => r.status === 'rejected' && r.reason?.response?.status === 429
      );

      // Should have at least some rate limited responses
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Password Reset Flow', () => {
    test('should initiate password reset', async () => {
      const response = await axios.post(`${global.TEST_CONFIG.AUTH_SERVICE_URL}/api/auth/forgot-password`, {
        email: testUser.email
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('message');
    });

    test('should handle non-existent email gracefully', async () => {
      const response = await axios.post(`${global.TEST_CONFIG.AUTH_SERVICE_URL}/api/auth/forgot-password`, {
        email: 'nonexistent@example.com'
      });

      // Should return 200 for security reasons (don't reveal if email exists)
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('message');
    });
  });

  describe('Session Management', () => {
    test('should refresh token', async () => {
      const headers = global.createAuthHeaders(authToken);

      const response = await axios.post(`${global.TEST_CONFIG.AUTH_SERVICE_URL}/api/auth/refresh`, {}, { headers });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('token');

      // New token should be different
      expect(response.data.token).not.toBe(authToken);
    });

    test('should logout and invalidate token', async () => {
      const headers = global.createAuthHeaders(authToken);

      const logoutResponse = await axios.post(`${global.TEST_CONFIG.AUTH_SERVICE_URL}/api/auth/logout`, {}, { headers });
      expect(logoutResponse.status).toBe(200);

      // Token should be invalidated
      try {
        await axios.get(`${global.TEST_CONFIG.AUTH_SERVICE_URL}/api/auth/me`, { headers });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(401);
      }
    });
  });

  describe('API Gateway Authentication', () => {
    beforeAll(async () => {
      // Re-login to get fresh token
      const loginData = {
        email: testUser.email,
        password: testUser.password
      };

      const response = await axios.post(`${global.TEST_CONFIG.AUTH_SERVICE_URL}/api/auth/login`, loginData);
      authToken = response.data.token;
    });

    test('should route authenticated requests through API Gateway', async () => {
      const headers = global.createAuthHeaders(authToken);

      const response = await axios.get(`${global.TEST_CONFIG.API_GATEWAY_URL}/api/auth/me`, { headers });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('user');
    });

    test('should handle authentication at gateway level', async () => {
      try {
        await axios.get(`${global.TEST_CONFIG.API_GATEWAY_URL}/api/calculations`);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(401);
      }
    });

    test('should forward user context to downstream services', async () => {
      const headers = global.createAuthHeaders(authToken);

      const response = await axios.get(`${global.TEST_CONFIG.API_GATEWAY_URL}/api/user/profile`, { headers });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('user');
      expect(response.data.user).toHaveProperty('email', testUser.email);
    });
  });

  afterAll(async () => {
    // Cleanup: Delete test user
    try {
      const headers = global.createAuthHeaders(authToken);
      await axios.delete(`${global.TEST_CONFIG.AUTH_SERVICE_URL}/api/user/account`, { headers });
    } catch (error) {
      console.warn('Could not cleanup test user:', error.message);
    }
  });
});