require('dotenv').config();

const config = {
  // Server configuration
  server: {
    port: process.env.PORT || 3006,
    host: process.env.HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'development'
  },

  // ClickHouse configuration
  clickhouse: {
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USERNAME || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DATABASE || 'analytics'
  },

  // Redis configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: process.env.REDIS_DB || 0
  },

  // Analytics configuration
  analytics: {
    // Session timeout in seconds
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 1800, // 30 minutes

    // Bot detection patterns
    botPatterns: [
      /bot/i,
      /spider/i,
      /crawler/i,
      /scraper/i,
      /facebook/i,
      /twitter/i,
      /linkedin/i,
      /whatsapp/i
    ],

    // Data retention periods
    retention: {
      events: parseInt(process.env.EVENTS_RETENTION_DAYS) || 730, // 2 years
      sessions: parseInt(process.env.SESSIONS_RETENTION_DAYS) || 730, // 2 years
      conversions: parseInt(process.env.CONVERSIONS_RETENTION_DAYS) || 1825, // 5 years
      experiments: parseInt(process.env.EXPERIMENTS_RETENTION_DAYS) || 365 // 1 year
    },

    // Sampling rates
    sampling: {
      events: parseFloat(process.env.EVENT_SAMPLING_RATE) || 1.0, // 100%
      sessions: parseFloat(process.env.SESSION_SAMPLING_RATE) || 1.0, // 100%
      experiments: parseFloat(process.env.EXPERIMENT_SAMPLING_RATE) || 1.0 // 100%
    }
  },

  // A/B Testing configuration
  abTesting: {
    // Default experiment duration in days
    defaultDuration: parseInt(process.env.AB_TEST_DEFAULT_DURATION) || 30,

    // Minimum sample size for statistical significance
    minSampleSize: parseInt(process.env.AB_TEST_MIN_SAMPLE_SIZE) || 1000,

    // Confidence level for statistical tests
    confidenceLevel: parseFloat(process.env.AB_TEST_CONFIDENCE_LEVEL) || 0.95,

    // Maximum number of concurrent experiments
    maxConcurrentExperiments: parseInt(process.env.AB_TEST_MAX_CONCURRENT) || 10
  },

  // Privacy and GDPR configuration
  privacy: {
    // Cookie consent tracking
    cookieConsent: {
      essential: true,
      analytics: false, // Requires user consent
      marketing: false  // Requires user consent
    },

    // Data anonymization
    anonymization: {
      ipMasking: true,
      userIdHashing: true,
      sessionIdHashing: false
    },

    // Data deletion
    deletion: {
      batchSize: parseInt(process.env.DELETION_BATCH_SIZE) || 1000,
      retryAttempts: parseInt(process.env.DELETION_RETRY_ATTEMPTS) || 3
    }
  },

  // Rate limiting
  rateLimit: {
    tracking: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000 // requests per window per IP
    },
    api: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // requests per window per IP
    }
  },

  // Conversion tracking
  conversions: {
    types: {
      'ad_click': { value: 0.1, currency: 'USD' },
      'affiliate_click': { value: 0.5, currency: 'USD' },
      'calculator_complete': { value: 1.0, currency: 'USD' },
      'newsletter_signup': { value: 2.0, currency: 'USD' },
      'premium_signup': { value: 50.0, currency: 'USD' }
    }
  },

  // External services
  external: {
    geoip: {
      enabled: true,
      provider: 'geoip-lite' // or 'maxmind'
    }
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    file: process.env.LOG_FILE || null
  }
};

module.exports = config;