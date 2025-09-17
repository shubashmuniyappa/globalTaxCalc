require('dotenv').config();

const config = {
  // Server configuration
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT) || 3001,

  // Database configuration
  DATABASE_URL: process.env.DATABASE_URL,
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT) || 5432,
  DB_NAME: process.env.DB_NAME || 'globaltaxcalc_dev',
  DB_USERNAME: process.env.DB_USERNAME || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || 'postgres',

  // Redis configuration
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT configuration
  JWT_SECRET: process.env.JWT_SECRET || 'fallback-secret-key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  JWT_ISSUER: process.env.JWT_ISSUER || 'globaltaxcalc.com',
  JWT_AUDIENCE: process.env.JWT_AUDIENCE || 'globaltaxcalc-api',

  // Session configuration
  SESSION_SECRET: process.env.SESSION_SECRET || 'fallback-session-secret',
  SESSION_COOKIE_MAX_AGE: parseInt(process.env.SESSION_COOKIE_MAX_AGE) || 24 * 60 * 60 * 1000, // 24 hours
  SESSION_COOKIE_SECURE: process.env.NODE_ENV === 'production',
  SESSION_COOKIE_HTTP_ONLY: true,
  SESSION_COOKIE_SAME_SITE: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',

  // OAuth configuration
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  APPLE_CLIENT_ID: process.env.APPLE_CLIENT_ID,
  APPLE_TEAM_ID: process.env.APPLE_TEAM_ID,
  APPLE_KEY_ID: process.env.APPLE_KEY_ID,
  APPLE_PRIVATE_KEY: process.env.APPLE_PRIVATE_KEY,

  // Email configuration
  EMAIL_FROM: process.env.EMAIL_FROM || 'noreply@globaltaxcalc.com',
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: parseInt(process.env.SMTP_PORT) || 587,
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,

  // Rate limiting
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  AUTH_RATE_LIMIT_WINDOW: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
  AUTH_RATE_LIMIT_MAX: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5,

  // Security configuration
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS) || 12,
  MAX_LOGIN_ATTEMPTS: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
  LOCKOUT_TIME: parseInt(process.env.LOCKOUT_TIME) || 30 * 60 * 1000, // 30 minutes
  PASSWORD_RESET_EXPIRES: parseInt(process.env.PASSWORD_RESET_EXPIRES) || 10 * 60 * 1000, // 10 minutes
  EMAIL_VERIFICATION_EXPIRES: parseInt(process.env.EMAIL_VERIFICATION_EXPIRES) || 24 * 60 * 60 * 1000, // 24 hours

  // Frontend URLs
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3009',
  PASSWORD_RESET_URL: process.env.PASSWORD_RESET_URL || 'http://localhost:3009/reset-password',
  EMAIL_VERIFICATION_URL: process.env.EMAIL_VERIFICATION_URL || 'http://localhost:3009/verify-email',

  // Two-Factor Authentication
  TWO_FACTOR_ISSUER: process.env.TWO_FACTOR_ISSUER || 'GlobalTaxCalc',
  TWO_FACTOR_WINDOW: parseInt(process.env.TWO_FACTOR_WINDOW) || 2,

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3009',

  // API Gateway
  API_GATEWAY_URL: process.env.API_GATEWAY_URL || 'http://localhost:3000',

  // Feature flags
  FEATURES: {
    EMAIL_VERIFICATION: process.env.FEATURE_EMAIL_VERIFICATION !== 'false',
    TWO_FACTOR_AUTH: process.env.FEATURE_TWO_FACTOR_AUTH !== 'false',
    OAUTH_GOOGLE: process.env.FEATURE_OAUTH_GOOGLE !== 'false',
    OAUTH_APPLE: process.env.FEATURE_OAUTH_APPLE !== 'false',
    GDPR_COMPLIANCE: process.env.FEATURE_GDPR_COMPLIANCE !== 'false',
    AUDIT_LOGGING: process.env.FEATURE_AUDIT_LOGGING !== 'false'
  },

  // Subscription tiers
  SUBSCRIPTION_TIERS: {
    FREE: {
      name: 'Free',
      calculationsPerMonth: 10,
      features: ['basic_calculations']
    },
    PREMIUM: {
      name: 'Premium',
      calculationsPerMonth: -1, // unlimited
      features: ['basic_calculations', 'advanced_calculations', 'reports', 'history', 'priority_support']
    },
    ENTERPRISE: {
      name: 'Enterprise',
      calculationsPerMonth: -1, // unlimited
      features: ['basic_calculations', 'advanced_calculations', 'reports', 'history', 'priority_support', 'api_access', 'white_label']
    }
  }
};

// Validation
const requiredEnvVars = [
  'JWT_SECRET',
  'SESSION_SECRET'
];

if (config.NODE_ENV === 'production') {
  requiredEnvVars.push(
    'DATABASE_URL',
    'SENDGRID_API_KEY',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET'
  );
}

requiredEnvVars.forEach(envVar => {
  const configKey = envVar.replace(/^([A-Z]+)_/, '').toLowerCase();
  if (!config[configKey] && !process.env[envVar]) {
    console.warn(`Warning: Missing environment variable: ${envVar}`);

    if (config.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }
});

module.exports = config;