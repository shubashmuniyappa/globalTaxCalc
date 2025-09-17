const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');

const config = require('./config');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/auth');
const validationMiddleware = require('./middleware/validation');
const serviceRegistry = require('./services/serviceRegistry');
const healthCheck = require('./routes/health');
const swaggerSetup = require('./swagger');

const app = express();

// Trust proxy for accurate IP addresses behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.globaltaxcalc.com"]
    }
  }
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, postman, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:3009',
      'https://globaltaxcalc.com',
      'https://www.globaltaxcalc.com',
      'https://*.railway.app',
      config.CORS_ORIGIN
    ];

    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (allowedOrigin.includes('*')) {
        const pattern = allowedOrigin.replace('*', '.*');
        return new RegExp(pattern).test(origin);
      }
      return allowedOrigin === origin;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Client-Version']
};

app.use(cors(corsOptions));

// Request parsing and compression
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW,
  max: config.RATE_LIMIT_MAX,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(config.RATE_LIMIT_WINDOW / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip;
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';
  }
});

app.use(limiter);

// Premium rate limiting for authenticated users
const premiumLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW,
  max: config.RATE_LIMIT_MAX * 5, // 5x higher limit for premium users
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  }
});

// Request validation middleware
app.use(validationMiddleware);

// Health check endpoints
app.use('/health', healthCheck);
app.use('/api/health', healthCheck);

// API documentation
swaggerSetup(app);

// Service proxy routes with authentication and load balancing
const serviceRoutes = [
  {
    path: '/api/auth',
    target: 'auth-service',
    auth: false,
    rateLimit: 'standard'
  },
  {
    path: '/api/tax',
    target: 'tax-engine',
    auth: true,
    rateLimit: 'premium'
  },
  {
    path: '/api/location',
    target: 'geolocation-service',
    auth: true,
    rateLimit: 'standard'
  },
  {
    path: '/api/ai',
    target: 'ai-service',
    auth: true,
    rateLimit: 'premium'
  },
  {
    path: '/api/content',
    target: 'content-service',
    auth: false,
    rateLimit: 'standard'
  },
  {
    path: '/api/analytics',
    target: 'analytics-service',
    auth: true,
    rateLimit: 'standard'
  },
  {
    path: '/api/notifications',
    target: 'notification-service',
    auth: true,
    rateLimit: 'standard'
  },
  {
    path: '/api/ads',
    target: 'ad-service',
    auth: false,
    rateLimit: 'standard'
  },
  {
    path: '/api/files',
    target: 'file-service',
    auth: true,
    rateLimit: 'standard'
  },
  {
    path: '/api/reports',
    target: 'report-service',
    auth: true,
    rateLimit: 'premium'
  },
  {
    path: '/api/monitoring',
    target: 'monitoring-service',
    auth: true,
    rateLimit: 'standard'
  }
];

// Setup proxy routes
serviceRoutes.forEach(route => {
  const middleware = [];

  // Add authentication middleware if required
  if (route.auth) {
    middleware.push(authMiddleware);
  }

  // Add appropriate rate limiting
  if (route.rateLimit === 'premium') {
    middleware.push(premiumLimiter);
  }

  // Create proxy middleware with service discovery
  const proxyOptions = {
    target: () => serviceRegistry.getServiceUrl(route.target),
    changeOrigin: true,
    timeout: config.SERVICE_TIMEOUT,
    proxyTimeout: config.SERVICE_TIMEOUT,
    pathRewrite: (path) => {
      // Remove /api prefix for internal service calls
      return path.replace(route.path, '');
    },
    onProxyReq: (proxyReq, req, res) => {
      // Add request headers for service communication
      proxyReq.setHeader('X-Gateway-Request-ID', req.id);
      proxyReq.setHeader('X-Gateway-Timestamp', Date.now());
      proxyReq.setHeader('X-Client-IP', req.ip);

      if (req.user) {
        proxyReq.setHeader('X-User-ID', req.user.id);
        proxyReq.setHeader('X-User-Role', req.user.role);
      }
    },
    onProxyRes: (proxyRes, req, res) => {
      // Add CORS headers to proxied responses
      proxyRes.headers['Access-Control-Allow-Origin'] = res.get('Access-Control-Allow-Origin');
      proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
    },
    onError: (err, req, res) => {
      logger.error('Proxy error:', {
        error: err.message,
        service: route.target,
        path: req.path,
        method: req.method
      });

      res.status(503).json({
        error: 'Service temporarily unavailable',
        service: route.target,
        timestamp: new Date().toISOString()
      });
    },
    logLevel: 'warn',
    router: async (req) => {
      // Dynamic service discovery
      try {
        const serviceUrl = await serviceRegistry.getHealthyServiceUrl(route.target);
        return serviceUrl;
      } catch (error) {
        logger.error(`Service ${route.target} unavailable:`, error.message);
        throw error;
      }
    }
  };

  const proxy = createProxyMiddleware(proxyOptions);

  app.use(route.path, ...middleware, proxy);

  logger.info(`Registered proxy route: ${route.path} -> ${route.target}`);
});

// API version endpoints
app.get('/api/v1/info', (req, res) => {
  res.json({
    service: 'GlobalTaxCalc API Gateway',
    version: '1.0.0',
    environment: config.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: serviceRegistry.getRegisteredServices()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'GlobalTaxCalc API Gateway',
    version: '1.0.0',
    documentation: '/api-docs',
    health: '/health',
    status: 'operational'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Global error handler (must be last)
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');

  // Stop accepting new requests
  server.close(() => {
    logger.info('HTTP server closed');

    // Close database connections, cleanup resources
    serviceRegistry.cleanup();

    process.exit(0);
  });

  // Force close after 30 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
});

const PORT = config.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(`API Gateway started on port ${PORT}`);
  logger.info(`Environment: ${config.NODE_ENV}`);
  logger.info(`Documentation: http://localhost:${PORT}/api-docs`);

  // Initialize service discovery
  serviceRegistry.initialize();
});

module.exports = app;