const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const config = require('./config');

// Import routes
const notificationRoutes = require('./routes/notifications');

// Import services
const emailService = require('./services/emailService');
const schedulerService = require('./services/schedulerService');
const pushService = require('./services/pushService');

// Import middleware
const { rateLimitLenient } = require('./middleware/rateLimit');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: config.server.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(config.server.logLevel === 'debug' ? 'combined' : 'common'));
}

// Global rate limiting
app.use(rateLimitLenient);

// Health check endpoint (before authentication)
app.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: {
        email: await emailService.checkHealth(),
        push: await pushService.checkHealth(),
        scheduler: await schedulerService.checkHealth()
      }
    };

    // Check if any critical services are down
    const criticalServices = ['email', 'scheduler'];
    const unhealthyServices = criticalServices.filter(
      service => health.services[service].status !== 'healthy'
    );

    if (unhealthyServices.length > 0) {
      health.status = 'degraded';
      health.issues = unhealthyServices;
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);

  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// API routes
app.use('/api/notifications', notificationRoutes);

// Serve static files for email previews
app.use('/previews', express.static(path.join(__dirname, 'previews')));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'GlobalTaxCalc Notification Service',
    version: process.env.npm_package_version || '1.0.0',
    description: 'Email and push notification service for tax calculations and reminders',
    endpoints: {
      health: '/health',
      notifications: '/api/notifications/*',
      docs: '/api/docs'
    }
  });
});

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'Notification Service API',
    version: '1.0.0',
    endpoints: {
      'POST /api/notifications/send': 'Send immediate notification',
      'POST /api/notifications/schedule': 'Schedule notification',
      'GET /api/notifications/preferences/:userId': 'Get user preferences',
      'PUT /api/notifications/preferences/:userId': 'Update user preferences',
      'POST /api/notifications/unsubscribe': 'Unsubscribe user',
      'GET /api/notifications/status/:notificationId': 'Get notification status',
      'POST /api/notifications/campaign': 'Send campaign',
      'GET /api/notifications/templates': 'Get available templates',
      'POST /api/notifications/templates/:templateId/preview': 'Preview template',
      'GET /api/notifications/health': 'Service health check'
    },
    authentication: 'Bearer token or API key required for most endpoints',
    rateLimit: {
      strict: '10 requests per 15 minutes',
      moderate: '100 requests per 15 minutes',
      lenient: '1000 requests per 15 minutes'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    requestedPath: req.originalUrl
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);

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
      message: 'Invalid token'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
    });
  }

  // Rate limit errors
  if (error.name === 'TooManyRequestsError') {
    return res.status(429).json({
      success: false,
      message: 'Too many requests',
      retryAfter: error.retryAfter
    });
  }

  // Default error response
  const statusCode = error.statusCode || error.status || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : error.message;

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
      error: error
    })
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');

  // Stop accepting new connections
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');

  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

// Start server
const PORT = config.server.port || 3000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Notification Service running on port ${PORT}`);
  console.log(`📧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);

  // Initialize scheduler service
  schedulerService.init().catch(console.error);
});

module.exports = app;