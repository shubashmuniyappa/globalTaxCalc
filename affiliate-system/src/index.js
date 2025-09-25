/**
 * GlobalTaxCalc Affiliate Marketing System
 * Comprehensive affiliate management platform with advanced features
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
require('dotenv').config();

// Import middleware and services
const authMiddleware = require('./middleware/auth');
const validationMiddleware = require('./middleware/validation');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const affiliateRoutes = require('./routes/affiliates');
const linkRoutes = require('./routes/links');
const dashboardRoutes = require('./routes/dashboard');
const paymentRoutes = require('./routes/payments');
const complianceRoutes = require('./routes/compliance');
const adminRoutes = require('./routes/admin');

// Import services
const PaymentService = require('./services/PaymentService');
const FraudDetectionService = require('./services/FraudDetectionService');
const ComplianceService = require('./services/ComplianceService');

// Import database configuration
const db = require('./config/database');
const Redis = require('ioredis');

class AffiliateMarketingSystem {
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

    // Initialize services
    this.paymentService = new PaymentService();
    this.fraudDetection = new FraudDetectionService();
    this.complianceService = new ComplianceService();

    // Make services globally available
    global.redisClient = this.redisClient;
    global.paymentService = this.paymentService;
    global.fraudDetection = this.fraudDetection;
    global.complianceService = this.complianceService;
  }

  /**
   * Configure middleware
   */
  setupMiddleware() {
    // Security and basic middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          scriptSrc: ["'self'"]
        }
      }
    }));

    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // CORS configuration
    this.app.use(cors({
      origin: this.getAllowedOrigins(),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Correlation-ID']
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: this.environment === 'production' ? 100 : 1000, // requests per window
      message: {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.'
      },
      standardHeaders: true,
      legacyHeaders: false
    });

    this.app.use('/api/', limiter);

    // Logging
    if (this.environment === 'development') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined'));
    }

    // Request ID middleware
    this.app.use((req, res, next) => {
      req.id = require('crypto').randomUUID();
      res.set('X-Request-ID', req.id);
      next();
    });

    console.log('✅ Middleware configured');
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: this.environment
      });
    });

    // API routes
    this.app.use('/api/affiliates', affiliateRoutes);
    this.app.use('/api/links', authMiddleware, linkRoutes);
    this.app.use('/api/dashboard', authMiddleware, dashboardRoutes);
    this.app.use('/api/payments', authMiddleware, paymentRoutes);
    this.app.use('/api/compliance', authMiddleware, complianceRoutes);
    this.app.use('/api/admin', authMiddleware, adminRoutes);

    // Tracking endpoint (public)
    this.app.get('/click/:linkCode', this.handleTrackingClick.bind(this));

    // Conversion tracking webhook
    this.app.post('/webhook/conversion', this.handleConversionWebhook.bind(this));

    // Static files
    this.app.use('/public', express.static('public'));

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

    // Error handling
    this.app.use(errorHandler);

    console.log('✅ Routes configured');
  }

  /**
   * Handle click tracking
   */
  async handleTrackingClick(req, res) {
    try {
      const { linkCode } = req.params;
      const TrackingService = require('./services/TrackingService');
      const trackingService = new TrackingService();

      const requestData = {
        req,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        referer: req.get('Referer'),
        customData: req.query
      };

      const result = await trackingService.processClick(linkCode, requestData);

      if (result.blocked) {
        return res.status(403).json({
          error: 'Request blocked due to suspicious activity'
        });
      }

      // Set visitor ID cookie
      res.cookie('visitor_id', result.clickId, {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: true,
        secure: this.environment === 'production'
      });

      // Redirect to original URL
      res.redirect(302, result.redirectUrl);

    } catch (error) {
      console.error('Error handling click tracking:', error);
      res.status(500).json({
        error: 'Tracking error occurred'
      });
    }
  }

  /**
   * Handle conversion webhook
   */
  async handleConversionWebhook(req, res) {
    try {
      const TrackingService = require('./services/TrackingService');
      const trackingService = new TrackingService();

      const conversionResult = await trackingService.processConversion(req.body);

      res.json({
        success: true,
        conversionId: conversionResult.conversionId
      });

    } catch (error) {
      console.error('Error handling conversion webhook:', error);
      res.status(500).json({
        error: 'Conversion processing failed'
      });
    }
  }

  /**
   * Setup scheduled tasks
   */
  setupScheduledTasks() {
    const cron = require('node-cron');

    // Process payments daily at 2 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('Running scheduled payment processing...');
      try {
        await this.paymentService.processScheduledPayments();
      } catch (error) {
        console.error('Error in scheduled payment processing:', error);
      }
    });

    // Retry failed payments every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      console.log('Retrying failed payments...');
      try {
        await this.paymentService.retryFailedPayments();
      } catch (error) {
        console.error('Error retrying failed payments:', error);
      }
    });

    // Clean up old data weekly
    cron.schedule('0 3 * * 0', async () => {
      console.log('Running data cleanup...');
      try {
        await this.complianceService.cleanupOldData();
        await this.fraudDetection.cleanupOldData();
      } catch (error) {
        console.error('Error in data cleanup:', error);
      }
    });

    console.log('✅ Scheduled tasks configured');
  }

  /**
   * Get allowed origins for CORS
   */
  getAllowedOrigins() {
    const origins = process.env.ALLOWED_ORIGINS?.split(',') || [];

    if (this.environment === 'development') {
      origins.push('http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000');
    }

    return origins.length > 0 ? origins : '*';
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.gracefulShutdown('SIGTERM');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

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
          // Close database connections
          await db.destroy();
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
   * Start the affiliate system
   */
  async start() {
    try {
      console.log('🚀 Starting GlobalTaxCalc Affiliate Marketing System...');

      // Test database connection
      await db.raw('SELECT 1');
      console.log('✅ Database connected');

      // Test Redis connection
      await this.redisClient.ping();
      console.log('✅ Redis connected');

      // Setup components
      this.setupMiddleware();
      this.setupRoutes();
      this.setupScheduledTasks();
      this.setupErrorHandling();

      // Start server
      this.server = this.app.listen(this.port, () => {
        console.log(`
╔══════════════════════════════════════════════════════════════╗
║           GlobalTaxCalc Affiliate Marketing System          ║
║                                                              ║
║  🌐 Server:     http://localhost:${this.port}                         ║
║  🔗 Tracking:   http://localhost:${this.port}/click/<code>           ║
║  📊 Health:     http://localhost:${this.port}/health                 ║
║  📈 Dashboard:  http://localhost:${this.port}/api/dashboard          ║
║                                                              ║
║  Environment: ${this.environment.toUpperCase().padEnd(8)} Database: Connected        ║
║  Redis: Connected    Payment: Ready                          ║
╚══════════════════════════════════════════════════════════════╝
        `);
      });

    } catch (error) {
      console.error('❌ Failed to start affiliate system:', error);
      process.exit(1);
    }
  }
}

// Start the system
if (require.main === module) {
  const affiliateSystem = new AffiliateMarketingSystem();
  affiliateSystem.start();
}

module.exports = AffiliateMarketingSystem;