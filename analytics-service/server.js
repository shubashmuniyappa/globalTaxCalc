const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const config = require('./config');
const logger = require('./utils/logger');
const clickhouse = require('./utils/clickhouse');
const redis = require('./utils/redis');

// Import routes
const trackingRoutes = require('./routes/tracking');
const analyticsRoutes = require('./routes/analytics');

// Import services for initialization
const sessionManager = require('./services/sessionManager');
const abTesting = require('./services/abTesting');
const funnelAnalysis = require('./services/funnelAnalysis');
const dashboardService = require('./services/dashboardService');
const privacyService = require('./services/privacyService');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    // Allow all origins in development
    if (config.server.env === 'development') {
      return callback(null, true);
    }

    // In production, you would check against allowed origins
    const allowedOrigins = [
      'https://globaltaxcalc.com',
      'https://www.globaltaxcalc.com',
      'https://staging.globaltaxcalc.com'
    ];

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-User-ID', 'X-Session-ID']
}));

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Trust proxy for accurate IP addresses
app.set('trust proxy', true);

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    referer: req.headers.referer
  });
  next();
});

// Session management middleware
app.use(async (req, res, next) => {
  try {
    let sessionId = req.cookies?.analytics_session;

    // Create new session if none exists and this is a tracking request
    if (!sessionId && (req.path.startsWith('/track') || req.path.startsWith('/ab-test'))) {
      // Get user properties for session creation
      const userProperties = {
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        referrer: req.headers.referer,
        country: req.headers['cf-ipcountry'] || 'Unknown', // Cloudflare country header
        first_page: req.headers.referer || req.path
      };

      const session = await sessionManager.createSession(userProperties);
      sessionId = session.session_id;

      // Set session cookie
      res.cookie('analytics_session', sessionId, {
        maxAge: config.analytics.sessionTimeout * 1000,
        httpOnly: true,
        secure: config.server.env === 'production',
        sameSite: 'lax'
      });

      req.sessionId = sessionId;
      req.session = session;
    } else if (sessionId) {
      req.sessionId = sessionId;
      req.session = await sessionManager.getSession(sessionId);
    }

    next();
  } catch (error) {
    logger.error('Error in session middleware:', error);
    next();
  }
});

// Routes
app.use('/track', trackingRoutes);
app.use('/analytics', analyticsRoutes);

// Root endpoint with service information
app.get('/', (req, res) => {
  res.json({
    service: 'GlobalTaxCalc Analytics Service',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      tracking: '/track/*',
      analytics: '/analytics/*',
      health: '/health'
    },
    documentation: '/docs'
  });
});

// API documentation endpoint
app.get('/docs', (req, res) => {
  res.json({
    service: 'GlobalTaxCalc Analytics Service API',
    version: '1.0.0',
    endpoints: {
      tracking: {
        'POST /track': 'General event tracking',
        'POST /track/page-view': 'Page view tracking',
        'POST /track/calculator': 'Calculator event tracking',
        'POST /track/interaction': 'User interaction tracking',
        'POST /track/conversion': 'Conversion tracking',
        'POST /track/error': 'Error tracking',
        'POST /track/performance': 'Performance tracking',
        'POST /track/funnel': 'Funnel step tracking',
        'POST /consent': 'Record user consent',
        'GET /consent': 'Get consent status',
        'PUT /consent': 'Update consent preferences'
      },
      analytics: {
        'GET /analytics/dashboard': 'Real-time dashboard data',
        'GET /analytics/dashboard/historical': 'Historical dashboard data',
        'GET /analytics/dashboard/ab-testing': 'A/B testing dashboard',
        'GET /analytics/funnel/:id': 'Funnel analysis',
        'POST /analytics/funnel': 'Create funnel',
        'GET /analytics/sessions': 'Session analytics',
        'GET /ab-test/:id': 'Get A/B test assignment',
        'POST /ab-test/:id/conversion': 'Track A/B test conversion',
        'GET /ab-test/:id/results': 'Get experiment results',
        'POST /privacy/delete': 'Request data deletion',
        'POST /privacy/export': 'Export user data'
      }
    },
    authentication: 'API Key required for analytics endpoints',
    privacy: 'GDPR compliant with consent management'
  });
});

// Global error handler
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);

  if (res.headersSent) {
    return next(error);
  }

  const status = error.status || 500;
  const message = config.server.env === 'production'
    ? 'Internal server error'
    : error.message;

  res.status(status).json({
    error: message,
    timestamp: new Date().toISOString(),
    path: req.path
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');

  try {
    // Flush any remaining events
    const eventTracker = require('./services/eventTracker');
    await eventTracker.flush();

    // Close database connections
    await clickhouse.disconnect();
    await redis.disconnect();

    logger.info('Analytics service shut down successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');

  try {
    // Flush any remaining events
    const eventTracker = require('./services/eventTracker');
    await eventTracker.flush();

    // Close database connections
    await clickhouse.disconnect();
    await redis.disconnect();

    logger.info('Analytics service shut down successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Initialize services and start server
async function startServer() {
  try {
    logger.info('Starting GlobalTaxCalc Analytics Service...');

    // Initialize database connections
    await clickhouse.connect();
    await redis.connect();

    // Initialize services
    logger.info('Services initialized successfully');

    // Start server
    const server = app.listen(config.server.port, config.server.host, () => {
      logger.info(`Analytics service running on ${config.server.host}:${config.server.port}`);
      logger.info(`Environment: ${config.server.env}`);
      logger.info(`ClickHouse: ${config.clickhouse.url}`);
      logger.info(`Redis: ${config.redis.host}:${config.redis.port}`);
    });

    // Handle server errors
    server.on('error', (error) => {
      logger.error('Server error:', error);
      process.exit(1);
    });

    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

module.exports = app;