/**
 * GlobalTaxCalc API Gateway
 * Enterprise-grade API Gateway with advanced features
 */

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const responseTime = require('response-time');
require('dotenv').config();

// Import middleware and services
const { createRateLimiter } = require('./middleware/rateLimiter');
const { createVersionManager } = require('./middleware/versioning');
const { createTransformationEngine } = require('./middleware/transformation');
const { createSecurityManager } = require('./middleware/security');
const { createMonitoringManager, prometheus } = require('./middleware/monitoring');
const { createCachingManager } = require('./middleware/caching');
const { createDocumentationGenerator } = require('./services/documentation');
const { createLoadBalancer } = require('./services/loadBalancer');

// Redis client
const Redis = require('ioredis');

class APIGateway {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.environment = process.env.NODE_ENV || 'development';

    // Initialize Redis client
    this.redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 3
    });

    // Initialize components
    this.initializeComponents();
  }

  /**
   * Initialize all gateway components
   */
  initializeComponents() {
    // Core components
    this.rateLimiter = createRateLimiter(this.redisClient);
    this.versionManager = createVersionManager();
    this.transformationEngine = createTransformationEngine();
    this.securityManager = createSecurityManager(this.redisClient);
    this.monitoringManager = createMonitoringManager(this.redisClient);
    this.cachingManager = createCachingManager(this.redisClient);
    this.documentationGenerator = createDocumentationGenerator();
    this.loadBalancer = createLoadBalancer({
      algorithm: 'weighted-round-robin',
      healthCheckInterval: 30000,
      retryAttempts: 3
    });

    // Make Redis client globally available
    global.redisClient = this.redisClient;

    console.log('✅ All components initialized successfully');
  }

  /**
   * Setup middleware pipeline
   */
  setupMiddleware() {
    // Basic middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    this.app.use(compression());

    // CORS configuration
    this.app.use(cors({
      origin: this.getAllowedOrigins(),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-API-Version', 'X-Correlation-ID']
    }));

    // Security middleware
    this.app.use(this.securityManager.securityMiddleware());

    // Monitoring and correlation
    this.app.use(this.monitoringManager.correlationMiddleware());
    this.app.use(this.monitoringManager.requestLogging());
    this.app.use(this.monitoringManager.performanceMonitoring());
    this.app.use(this.monitoringManager.slaMonitoring());
    this.app.use(this.monitoringManager.usageAnalytics());

    // Rate limiting
    this.app.use(this.rateLimiter.middleware());

    // API versioning
    this.app.use(this.versionManager.middleware());
    this.app.use(this.versionManager.versionRouter());
    this.app.use(this.versionManager.backwardCompatibilityMiddleware());

    // Caching
    this.app.use(this.cachingManager.middleware());
    this.app.use(this.cachingManager.conditionalCaching());
    this.app.use(this.cachingManager.cdnIntegration());

    // Request/Response transformation
    this.app.use(this.transformationEngine.middleware());
    this.app.use(this.transformationEngine.contentNegotiation());
    this.app.use(this.transformationEngine.normalizationMiddleware());

    console.log('✅ Middleware pipeline configured');
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', this.monitoringManager.getHealthEndpoint());

    // Metrics endpoint (Prometheus)
    this.app.get('/metrics', this.monitoringManager.getMetricsEndpoint());

    // API Gateway management endpoints
    this.setupManagementRoutes();

    // Documentation routes
    this.setupDocumentationRoutes();

    // Main API routes with load balancing
    this.setupAPIRoutes();

    // GraphQL endpoint
    this.app.use('/graphql', this.transformationEngine.graphqlMiddleware());

    // Error handling
    this.app.use(this.monitoringManager.errorTracking());

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Endpoint not found',
          path: req.originalUrl
        }
      });
    });

    console.log('✅ Routes configured');
  }

  /**
   * Setup management routes
   */
  setupManagementRoutes() {
    const managementRouter = express.Router();

    // Require admin authentication for management endpoints
    managementRouter.use(this.securityManager.jwtAuth());
    managementRouter.use(this.securityManager.requireScopes(['admin']));

    // Rate limiter management
    managementRouter.get('/rate-limiter/status', async (req, res) => {
      try {
        const status = await this.rateLimiter.getRateLimitStatus(req.query.key, req.query.type);
        res.json(status);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    managementRouter.post('/rate-limiter/reset', async (req, res) => {
      try {
        await this.rateLimiter.resetRateLimit(req.body.key, req.body.type);
        res.json({ message: 'Rate limit reset successfully' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Cache management
    managementRouter.get('/cache/stats', this.cachingManager.getStatsEndpoint());
    managementRouter.post('/cache/flush', this.cachingManager.getFlushEndpoint());

    managementRouter.post('/cache/invalidate', async (req, res) => {
      try {
        await this.cachingManager.invalidateByPattern(req.body.pattern);
        res.json({ message: 'Cache invalidated successfully' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Load balancer management
    managementRouter.get('/load-balancer/status', (req, res) => {
      const status = this.loadBalancer.getAllServicesStatus();
      res.json(status);
    });

    managementRouter.post('/load-balancer/algorithm', (req, res) => {
      try {
        this.loadBalancer.setLoadBalancingAlgorithm(req.body.algorithm);
        res.json({ message: 'Algorithm updated successfully' });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    managementRouter.post('/load-balancer/instance/health', (req, res) => {
      try {
        const { serviceName, instanceId, healthy } = req.body;
        const success = this.loadBalancer.setInstanceHealth(serviceName, instanceId, healthy);
        if (success) {
          res.json({ message: 'Instance health updated successfully' });
        } else {
          res.status(404).json({ error: 'Instance not found' });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // API key management
    managementRouter.post('/api-keys/generate', async (req, res) => {
      try {
        const apiKey = await this.securityManager.generateAPIKey(req.body);
        res.json(apiKey);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    managementRouter.delete('/api-keys/:keyId', async (req, res) => {
      try {
        const success = await this.securityManager.revokeAPIKey(req.params.keyId);
        if (success) {
          res.json({ message: 'API key revoked successfully' });
        } else {
          res.status(404).json({ error: 'API key not found' });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Version management
    managementRouter.get('/versions/stats', async (req, res) => {
      try {
        const stats = await this.versionManager.getVersionStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    managementRouter.post('/versions/:version/deprecate', (req, res) => {
      try {
        this.versionManager.deprecateVersion(req.params.version, req.body.sunsetDate);
        res.json({ message: 'Version deprecated successfully' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.use('/management', managementRouter);
  }

  /**
   * Setup documentation routes
   */
  setupDocumentationRoutes() {
    const docsMiddleware = this.documentationGenerator.getDocumentationMiddleware();

    // OpenAPI specification
    this.app.get('/api-spec/:version?', docsMiddleware.spec);

    // Interactive documentation
    this.app.use('/docs/v1', docsMiddleware.docs('v1'));
    this.app.use('/docs/v2', docsMiddleware.docs('v2'));
    this.app.use('/docs', docsMiddleware.docs('v2')); // Default to v2

    // SDK downloads
    this.app.get('/sdk/:language/:version?', docsMiddleware.sdk);

    // Postman collection
    this.app.get('/postman/:version?', docsMiddleware.postman);

    // API information
    this.app.get('/api/info', (req, res) => {
      const info = this.versionManager.getApiInfo();
      res.json(info);
    });
  }

  /**
   * Setup main API routes with load balancing
   */
  setupAPIRoutes() {
    // Authentication service routes
    this.app.use('/api/*/auth/*', this.createServiceProxy('auth-service'));

    // User management routes
    this.app.use('/api/*/users/*', [
      this.securityManager.jwtAuth(),
      this.createServiceProxy('user-service')
    ]);

    // Tax calculation routes
    this.app.use('/api/*/calculate*', [
      this.securityManager.apiKeyAuth(),
      this.securityManager.requireScopes(['calculate']),
      this.createServiceProxy('calculation-service')
    ]);

    // Report generation routes
    this.app.use('/api/*/reports*', [
      this.securityManager.jwtAuth(),
      this.securityManager.requireScopes(['read']),
      this.createServiceProxy('report-service')
    ]);

    // Notification routes
    this.app.use('/api/*/notifications*', [
      this.securityManager.jwtAuth(),
      this.createServiceProxy('notification-service')
    ]);

    // Public routes (no authentication required)
    this.app.use('/api/*/public/*', this.createServiceProxy('calculation-service'));
  }

  /**
   * Create service proxy middleware
   */
  createServiceProxy(serviceName) {
    return async (req, res, next) => {
      try {
        await this.loadBalancer.proxyRequest(serviceName, req, res);
      } catch (error) {
        console.error(`Error proxying to ${serviceName}:`, error.message);

        // Send appropriate error response
        const statusCode = error.response?.status || 503;
        res.status(statusCode).json({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: `${serviceName} is currently unavailable`,
            details: this.environment === 'development' ? error.message : undefined
          }
        });
      }
    };
  }

  /**
   * Get allowed origins for CORS
   */
  getAllowedOrigins() {
    const origins = process.env.ALLOWED_ORIGINS?.split(',') || [];

    if (this.environment === 'development') {
      origins.push('http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000');
    }

    return origins.length > 0 ? origins : true;
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // Global error handler
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.gracefulShutdown('SIGTERM');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // Graceful shutdown handlers
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
  }

  /**
   * Graceful shutdown
   */
  async gracefulShutdown(signal) {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

    const server = this.server;
    if (server) {
      server.close(async () => {
        console.log('📡 HTTP server closed');

        try {
          // Cleanup components
          await this.loadBalancer.shutdown();
          await this.redisClient.quit();

          console.log('✅ Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          console.error('❌ Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        console.error('❌ Forced shutdown due to timeout');
        process.exit(1);
      }, 30000);
    }
  }

  /**
   * Start the API Gateway
   */
  async start() {
    try {
      console.log('🚀 Starting GlobalTaxCalc API Gateway...');

      // Setup components
      this.setupMiddleware();
      this.setupRoutes();
      this.setupErrorHandling();

      // Start server
      this.server = this.app.listen(this.port, () => {
        console.log(`
╔══════════════════════════════════════════════════════════════╗
║                GlobalTaxCalc API Gateway                     ║
║                                                              ║
║  🌐 Server:     http://localhost:${this.port}                         ║
║  📚 Docs:       http://localhost:${this.port}/docs                    ║
║  📊 Metrics:    http://localhost:${this.port}/metrics                 ║
║  💚 Health:     http://localhost:${this.port}/health                  ║
║  ⚙️  Management: http://localhost:${this.port}/management             ║
║                                                              ║
║  Environment: ${this.environment.toUpperCase().padEnd(8)} Redis: Connected          ║
╚══════════════════════════════════════════════════════════════╝
        `);
      });

      // Generate initial API documentation
      await this.generateInitialDocs();

    } catch (error) {
      console.error('❌ Failed to start API Gateway:', error);
      process.exit(1);
    }
  }

  /**
   * Generate initial API documentation
   */
  async generateInitialDocs() {
    try {
      console.log('📚 Generating API documentation...');

      // Generate OpenAPI specs for all versions
      this.documentationGenerator.generateOpenAPISpec('v1');
      this.documentationGenerator.generateOpenAPISpec('v2');

      // Generate SDKs
      await Promise.all([
        this.documentationGenerator.generateSDK('javascript', 'v2'),
        this.documentationGenerator.generateSDK('python', 'v2'),
        this.documentationGenerator.generateSDK('php', 'v2')
      ]);

      // Generate Postman collection
      await this.documentationGenerator.generatePostmanCollection('v2');

      console.log('✅ API documentation generated successfully');
    } catch (error) {
      console.error('⚠️  Error generating documentation:', error.message);
    }
  }
}

// Start the API Gateway
if (require.main === module) {
  const gateway = new APIGateway();
  gateway.start();
}

module.exports = APIGateway;