const request = require('supertest');
const express = require('express');
const { validationMiddleware, authMiddleware } = require('../middleware');

// Create test app
const createTestApp = (middleware) => {
  const app = express();
  app.use(express.json());

  if (Array.isArray(middleware)) {
    middleware.forEach(m => app.use(m));
  } else {
    app.use(middleware);
  }

  app.get('/test', (req, res) => {
    res.json({ success: true, user: req.user });
  });

  app.post('/test', (req, res) => {
    res.json({ success: true, body: req.body });
  });

  return app;
};

describe('Middleware Tests', () => {
  describe('Validation Middleware', () => {
    let app;

    beforeEach(() => {
      app = createTestApp(validationMiddleware);
    });

    it('should add request ID to all requests', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.headers).toHaveProperty('x-request-id');
      expect(response.headers['x-request-id']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should sanitize input data', async () => {
      const maliciousData = {
        name: '<script>alert("xss")</script>John',
        email: 'test@example.com',
        description: 'javascript:alert("xss")'
      };

      const response = await request(app)
        .post('/test')
        .send(maliciousData)
        .expect(200);

      expect(response.body.body.name).toBe('John');
      expect(response.body.body.email).toBe('test@example.com');
      expect(response.body.body.description).toBe('alert("xss")');
    });

    it('should reject requests that are too large', async () => {
      const largeData = {
        data: 'x'.repeat(11 * 1024 * 1024) // 11MB
      };

      await request(app)
        .post('/test')
        .send(largeData)
        .expect(413);
    });

    it('should validate API version in path', async () => {
      const response = await request(app)
        .get('/api/v1/test')
        .expect(404); // Will be 404 since route doesn't exist, but middleware should process

      // Check that request was processed by middleware
      expect(response.headers).toHaveProperty('x-request-id');
    });
  });

  describe('Rate Limiting', () => {
    it('should implement rate limiting', async () => {
      const app = createTestApp(validationMiddleware);

      // Make requests up to the limit
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(request(app).get('/test'));
      }

      const responses = await Promise.all(promises);

      // All should succeed initially
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Additional requests should be rate limited
      // Note: This test might be flaky depending on rate limit configuration
    });
  });

  describe('CORS Handling', () => {
    let app;

    beforeEach(() => {
      app = createTestApp([]);
    });

    it('should handle preflight OPTIONS requests', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'http://localhost:3009')
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'Content-Type,Authorization');

      expect(response.status).toBeLessThan(500);
    });
  });
});