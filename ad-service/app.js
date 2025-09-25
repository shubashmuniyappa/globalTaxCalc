const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const config = require('./config');

// Import routes
const adRoutes = require('./routes/ads');

// Import middleware
const { rateLimitLenient } = require('./middleware/rateLimit');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "https://pagead2.googlesyndication.com", "https://www.googletagmanager.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https://pagead2.googlesyndication.com"],
      frameSrc: ["'self'", "https://googleads.g.doubleclick.net"]
    },
  },
  crossOriginEmbedderPolicy: false // Allow embedding ads
}));

// CORS configuration for ad serving
app.use(cors({
  origin: config.server.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Session-ID'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
}));

// Compression middleware
app.use(compression({
  level: 6,
  threshold: 1024, // Only compress responses larger than 1KB
  filter: (req, res) => {
    // Don't compress if the response has a Cache-Control header with no-transform
    if (res.getHeader('Cache-Control') && res.getHeader('Cache-Control').includes('no-transform')) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Body parsing middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Logging middleware
if (process.env.NODE_ENV !== 'test') {
  const logFormat = config.server.env === 'production' ? 'combined' : 'dev';
  app.use(morgan(logFormat));
}

// Trust proxy for accurate IP addresses
app.set('trust proxy', true);

// Global rate limiting
app.use(rateLimitLenient);

// Health check endpoint (before other routes)
app.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: config.server.env,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };

    res.json(health);

  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// API routes
app.use('/api/ads', adRoutes);

// Serve static files for ad assets
app.use('/assets', express.static(path.join(__dirname, 'assets'), {
  maxAge: '1d', // Cache static assets for 1 day
  etag: true,
  lastModified: true
}));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'GlobalTaxCalc Ad Management Service',
    version: process.env.npm_package_version || '1.0.0',
    description: 'Advanced ad placement optimization and revenue tracking service',
    endpoints: {
      health: '/health',
      ads: '/api/ads/*',
      assets: '/assets/*'
    },
    features: [
      'Dynamic ad placement optimization',
      'Multi-network integration (AdSense, Media.net, Direct)',
      'A/B testing framework',
      'Revenue optimization',
      'Loading performance optimization',
      'Comprehensive analytics',
      'Content filtering & brand safety'
    ]
  });
});

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'Ad Management Service API',
    version: '1.0.0',
    description: 'Comprehensive ad management with placement optimization and revenue tracking',
    endpoints: {
      'GET /api/ads/placement/{location}': 'Get optimized ad for specific placement location',
      'POST /api/ads/impression': 'Track ad impression with analytics',
      'POST /api/ads/click': 'Track ad click events',
      'POST /api/ads/viewability': 'Track ad viewability metrics',
      'POST /api/ads/revenue': 'Track revenue events (authenticated)',
      'GET /api/ads/performance': 'Get performance analytics (authenticated)',
      'GET /api/ads/revenue-report': 'Get revenue optimization report (authenticated)',
      'GET /api/ads/loading-performance': 'Get loading performance report (authenticated)',
      'PUT /api/ads/config': 'Update ad configuration (admin only)',
      'POST /api/ads/ab-test': 'Create A/B test (authenticated)',
      'GET /api/ads/ab-test/{testId}/results': 'Get A/B test results (authenticated)',
      'POST /api/ads/ab-test/{testId}/end': 'End A/B test (authenticated)',
      'GET /api/ads/filtering-report': 'Get content filtering report (authenticated)',
      'POST /api/ads/feedback': 'Submit user feedback about ads',
      'GET /api/ads/networks/status': 'Get ad network status (authenticated)',
      'POST /api/ads/core-web-vitals': 'Track Core Web Vitals metrics',
      'POST /api/ads/performance-data': 'Track loading performance data',
      'GET /api/ads/health': 'Service health check'
    },
    placement_locations: [
      'header', 'sidebar', 'content_top', 'content_middle',
      'content_bottom', 'footer', 'mobile_sticky'
    ],
    supported_networks: ['adsense', 'medianet', 'direct'],
    authentication: {
      bearer_token: 'JWT token for authenticated endpoints',
      api_key: 'X-API-Key header for service-to-service communication'
    },
    rate_limits: {
      strict: '100 requests per 15 minutes (sensitive operations)',
      moderate: '500 requests per 15 minutes (general API)',
      lenient: '1000 requests per 15 minutes (public endpoints)'
    }
  });
});

// Robots.txt for ad service
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Disallow: /api/
Disallow: /admin/
Allow: /assets/
Crawl-delay: 10`);
});

// Ads.txt for advertising transparency
app.get('/ads.txt', (req, res) => {
  res.type('text/plain');
  res.send(`# Ads.txt file for GlobalTaxCalc Ad Service
# This file is for transparency in programmatic advertising
google.com, ${config.adNetworks.googleAdsense.clientId}, DIRECT, f08c47fec0942fa0
media.net, ${config.adNetworks.medianet.siteId}, DIRECT
# Direct partnerships
globaltaxcalc.com, direct-001, DIRECT`);
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    requestedPath: req.originalUrl,
    availableEndpoints: [
      '/health',
      '/api/ads/*',
      '/assets/*',
      '/api/docs'
    ]
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: Object.values(error.errors).map(err => err.message)
    });
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Authentication token expired'
    });
  }

  // Rate limit errors
  if (error.name === 'TooManyRequestsError' || error.status === 429) {
    return res.status(429).json({
      success: false,
      message: 'Rate limit exceeded',
      retryAfter: error.retryAfter || '15 minutes'
    });
  }

  // MongoDB/Database errors
  if (error.name === 'MongoError' || error.name === 'MongooseError') {
    return res.status(503).json({
      success: false,
      message: 'Database service temporarily unavailable'
    });
  }

  // Redis/Cache errors
  if (error.message && error.message.includes('Redis')) {
    return res.status(503).json({
      success: false,
      message: 'Cache service temporarily unavailable'
    });
  }

  // Network/External service errors
  if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    return res.status(503).json({
      success: false,
      message: 'External service temporarily unavailable'
    });
  }

  // Default error response
  const statusCode = error.statusCode || error.status || 500;
  const message = config.server.env === 'production'
    ? 'Internal server error'
    : error.message;

  res.status(statusCode).json({
    success: false,
    message,
    ...(config.server.env === 'development' && {
      stack: error.stack,
      details: error
    })
  });
});

// Graceful shutdown handlers
const gracefulShutdown = (signal) => {
  console.log(`Received ${signal}, shutting down gracefully...`);

  server.close(() => {
    console.log('HTTP server closed');

    // Close database connections, Redis connections, etc.
    process.exit(0);
  });

  // Force close after 30 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in production, just log the error
  if (config.server.env !== 'production') {
    process.exit(1);
  }
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start server
const PORT = config.server.port || 3006;
const server = app.listen(PORT, () => {
  console.log(`🚀 Ad Management Service running on port ${PORT}`);
  console.log(`📊 Environment: ${config.server.env}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📖 API docs: http://localhost:${PORT}/api/docs`);
  console.log(`🎯 Features: Ad placement optimization, A/B testing, revenue tracking`);
});

module.exports = app;