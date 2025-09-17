const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const database = require('./utils/database');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const oauthRoutes = require('./routes/oauth');

// Import middleware
const { rateLimiters } = require('./middleware/rateLimiting');

class Application {
  constructor() {
    this.app = express();
    this.port = config.PORT;
  }

  async initialize() {
    await this.connectDatabase();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  async connectDatabase() {
    try {
      await database.connect();
      console.log('Database connected successfully');

      // Run migrations in production
      if (config.NODE_ENV === 'production') {
        await database.migrate();
        console.log('Database migrations completed');
      }

      // Sync database in development
      if (config.NODE_ENV === 'development') {
        await database.sync({ alter: true });
        console.log('Database synchronized');

        // Run seeds in development
        try {
          await database.seed();
        } catch (error) {
          console.warn('Database seeding skipped:', error.message);
        }
      }

    } catch (error) {
      console.error('Database connection failed:', error);
      process.exit(1);
    }
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      crossOriginEmbedderPolicy: false
    }));

    // CORS configuration
    this.app.use(cors({
      origin: (origin, callback) => {
        const allowedOrigins = [
          config.CORS_ORIGIN,
          config.FRONTEND_URL,
          'http://localhost:3000',
          'http://localhost:3009'
        ].filter(Boolean);

        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
      exposedHeaders: ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset']
    }));

    // Compression
    this.app.use(compression());

    // Request parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    this.app.use(cookieParser());

    // Logging
    if (config.NODE_ENV === 'development') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined'));
    }

    // Global rate limiting
    this.app.use(rateLimiters.general);

    // Request ID and timing
    this.app.use((req, res, next) => {
      req.id = require('crypto').randomUUID();
      req.startTime = Date.now();
      res.setHeader('X-Request-ID', req.id);
      next();
    });

    // IP extraction
    this.app.use((req, res, next) => {
      req.ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
               req.headers['x-real-ip'] ||
               req.connection?.remoteAddress ||
               req.socket?.remoteAddress ||
               req.ip;
      next();
    });
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      try {
        const dbHealth = await database.healthCheck();

        const health = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          version: process.env.npm_package_version || '1.0.0',
          environment: config.NODE_ENV,
          database: dbHealth,
          memory: process.memoryUsage(),
          cpu: process.cpuUsage()
        };

        if (dbHealth.status !== 'healthy') {
          health.status = 'degraded';
          return res.status(503).json(health);
        }

        res.json(health);
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error.message
        });
      }
    });

    // Ready check (for Kubernetes)
    this.app.get('/ready', async (req, res) => {
      try {
        if (!database.isReady()) {
          return res.status(503).json({
            status: 'not ready',
            message: 'Database not ready'
          });
        }

        res.json({
          status: 'ready',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(503).json({
          status: 'not ready',
          error: error.message
        });
      }
    });

    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/users', userRoutes);
    this.app.use('/api/oauth', oauthRoutes);

    // API info endpoint
    this.app.get('/api', (req, res) => {
      res.json({
        name: 'GlobalTaxCalc Authentication Service',
        version: process.env.npm_package_version || '1.0.0',
        description: 'Authentication and authorization service for GlobalTaxCalc',
        environment: config.NODE_ENV,
        endpoints: {
          health: '/health',
          ready: '/ready',
          auth: '/api/auth',
          users: '/api/users',
          oauth: '/api/oauth'
        },
        features: config.FEATURES
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method
      });
    });
  }

  setupErrorHandling() {
    // Global error handler
    this.app.use((error, req, res, next) => {
      console.error(`Error ${req.id}:`, error);

      // Handle specific error types
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors
        });
      }

      if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Database validation error',
          errors: error.errors.map(err => ({
            field: err.path,
            message: err.message,
            value: err.value
          }))
        });
      }

      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          success: false,
          message: 'Resource already exists',
          field: error.errors[0]?.path
        });
      }

      if (error.name === 'SequelizeForeignKeyConstraintError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid reference to related resource'
        });
      }

      if (error.message === 'Not allowed by CORS') {
        return res.status(403).json({
          success: false,
          message: 'CORS policy violation'
        });
      }

      // JWT errors
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }

      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired'
        });
      }

      // Rate limiting errors
      if (error.status === 429) {
        return res.status(429).json({
          success: false,
          message: 'Too many requests',
          retryAfter: error.retryAfter
        });
      }

      // Default error response
      const statusCode = error.statusCode || error.status || 500;
      const message = config.NODE_ENV === 'production' && statusCode === 500
        ? 'Internal server error'
        : error.message || 'An unexpected error occurred';

      res.status(statusCode).json({
        success: false,
        message,
        requestId: req.id,
        ...(config.NODE_ENV === 'development' && {
          stack: error.stack,
          details: error
        })
      });
    });

    // Unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      // Don't exit the process in production
      if (config.NODE_ENV !== 'production') {
        process.exit(1);
      }
    });

    // Uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      process.exit(1);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      console.log(`Received ${signal}, starting graceful shutdown...`);

      try {
        await database.disconnect();
        console.log('Database disconnected');
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }

  async start() {
    try {
      await this.initialize();

      this.server = this.app.listen(this.port, () => {
        console.log(`🚀 Auth service running on port ${this.port}`);
        console.log(`📚 Environment: ${config.NODE_ENV}`);
        console.log(`🔗 Health check: http://localhost:${this.port}/health`);
        console.log(`📖 API info: http://localhost:${this.port}/api`);
      });

      return this.server;
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(resolve);
      });
    }
  }
}

module.exports = Application;