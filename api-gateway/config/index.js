require('dotenv').config();

const config = {
  // Server configuration
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT) || 3000,

  // Security
  JWT_SECRET: process.env.JWT_SECRET || 'fallback-secret-key',
  API_KEY_HEADER: 'X-API-Key',

  // Rate limiting
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX) || 100,

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3009',

  // Service configuration
  SERVICE_TIMEOUT: parseInt(process.env.SERVICE_TIMEOUT) || 30000, // 30 seconds
  SERVICE_RETRY_ATTEMPTS: parseInt(process.env.SERVICE_RETRY_ATTEMPTS) || 3,
  SERVICE_RETRY_DELAY: parseInt(process.env.SERVICE_RETRY_DELAY) || 1000,

  // Health check configuration
  HEALTH_CHECK_INTERVAL: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000, // 30 seconds
  HEALTH_CHECK_TIMEOUT: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 5000, // 5 seconds

  // Redis configuration
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // Service URLs - fallbacks for development
  SERVICES: {
    'auth-service': process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    'tax-engine': process.env.TAX_ENGINE_URL || 'http://localhost:8000',
    'geolocation-service': process.env.GEOLOCATION_SERVICE_URL || 'http://localhost:3002',
    'ai-service': process.env.AI_SERVICE_URL || 'http://localhost:8001',
    'content-service': process.env.CONTENT_SERVICE_URL || 'http://localhost:3003',
    'analytics-service': process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3004',
    'notification-service': process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005',
    'ad-service': process.env.AD_SERVICE_URL || 'http://localhost:3006',
    'file-service': process.env.FILE_SERVICE_URL || 'http://localhost:3007',
    'report-service': process.env.REPORT_SERVICE_URL || 'http://localhost:8002',
    'monitoring-service': process.env.MONITORING_SERVICE_URL || 'http://localhost:3008'
  },

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  // External APIs
  EXTERNAL_APIS: {
    timeout: 10000,
    retries: 2
  }
};

// Validation
const requiredEnvVars = ['JWT_SECRET'];

if (config.NODE_ENV === 'production') {
  requiredEnvVars.forEach(envVar => {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  });
}

module.exports = config;