require('dotenv').config();

const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT) || 3000,

  // Database URLs
  DATABASE_URL: process.env.DATABASE_URL,
  MONGODB_URL: process.env.MONGODB_URL,
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'fallback-secret-key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  JWT_COOKIE_EXPIRES_IN: parseInt(process.env.JWT_COOKIE_EXPIRES_IN) || 7,

  // API Keys
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,

  // Email
  EMAIL_FROM: process.env.EMAIL_FROM,
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,

  // AWS
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,

  // Rate Limiting
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX) || 100,

  // Service URLs
  API_GATEWAY_URL: process.env.API_GATEWAY_URL || 'http://localhost:3000',
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  TAX_ENGINE_URL: process.env.TAX_ENGINE_URL || 'http://localhost:8000',
  GEOLOCATION_SERVICE_URL: process.env.GEOLOCATION_SERVICE_URL || 'http://localhost:3002',
  AI_SERVICE_URL: process.env.AI_SERVICE_URL || 'http://localhost:8001',

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3009',
};

// Validation
const requiredEnvVars = ['DATABASE_URL', 'MONGODB_URL', 'JWT_SECRET'];

if (config.NODE_ENV === 'production') {
  requiredEnvVars.forEach(envVar => {
    if (!config[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  });
}

module.exports = config;