const path = require('path');
require('dotenv').config();

const config = {
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT, 10) || 3004,
    host: process.env.HOST || 'localhost',
    env: process.env.NODE_ENV || 'development',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000']
  },

  // Service Information
  service: {
    name: process.env.SERVICE_NAME || 'monitoring-health-service',
    version: process.env.SERVICE_VERSION || '1.0.0',
    environment: process.env.ENVIRONMENT || 'development'
  },

  // Prometheus Configuration
  prometheus: {
    enabled: process.env.PROMETHEUS_ENABLED === 'true',
    port: parseInt(process.env.PROMETHEUS_PORT, 10) || 9090,
    metricsPrefix: process.env.METRICS_PREFIX || 'globaltaxcalc',
    collectDefaultMetrics: process.env.COLLECT_DEFAULT_METRICS === 'true',
    collectGcMetrics: process.env.COLLECT_GC_METRICS === 'true',
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
  },

  // Health Check Configuration
  healthCheck: {
    interval: parseInt(process.env.HEALTH_CHECK_INTERVAL, 10) || 30000,
    timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT, 10) || 5000,
    retries: parseInt(process.env.HEALTH_CHECK_RETRIES, 10) || 3,
    dependencyCheckEnabled: process.env.DEPENDENCY_CHECK_ENABLED === 'true'
  },

  // Service Endpoints
  services: {
    calculationService: process.env.CALCULATION_SERVICE_URL || 'http://localhost:3001',
    comparisonService: process.env.COMPARISON_SERVICE_URL || 'http://localhost:3002',
    reportService: process.env.REPORT_SERVICE_URL || 'http://localhost:3003',
    userService: process.env.USER_SERVICE_URL || 'http://localhost:3005',
    endpoints: {
      health: '/health',
      metrics: '/metrics',
      status: '/status'
    }
  },

  // Database Configuration
  database: {
    type: process.env.DATABASE_TYPE || 'mysql',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT, 10) || 3306,
    name: process.env.DATABASE_NAME || 'globaltaxcalc',
    user: process.env.DATABASE_USER || 'monitoring_user',
    password: process.env.DATABASE_PASSWORD || 'monitoring_password',
    pool: {
      min: parseInt(process.env.DATABASE_POOL_MIN, 10) || 2,
      max: parseInt(process.env.DATABASE_POOL_MAX, 10) || 10
    }
  },

  // Redis Configuration
  redis: {
    enabled: process.env.REDIS_ENABLED === 'true',
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB, 10) || 0
  },

  // Elasticsearch Configuration
  elasticsearch: {
    enabled: process.env.ELASTICSEARCH_ENABLED === 'true',
    node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
    index: process.env.ELASTICSEARCH_INDEX || 'globaltaxcalc-logs',
    username: process.env.ELASTICSEARCH_USERNAME || '',
    password: process.env.ELASTICSEARCH_PASSWORD || ''
  },

  // Sentry Configuration
  sentry: {
    enabled: process.env.SENTRY_ENABLED === 'true',
    dsn: process.env.SENTRY_DSN || '',
    environment: process.env.SENTRY_ENVIRONMENT || 'development',
    release: process.env.SENTRY_RELEASE || '1.0.0',
    sampleRate: parseFloat(process.env.SENTRY_SAMPLE_RATE) || 1.0,
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1
  },

  // Alerting Configuration
  alerting: {
    enabled: process.env.ALERTING_ENABLED === 'true',
    email: {
      enabled: process.env.ALERT_EMAIL_ENABLED === 'true',
      smtp: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT, 10) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER || '',
        password: process.env.SMTP_PASSWORD || ''
      },
      from: process.env.ALERT_EMAIL_FROM || 'alerts@globaltaxcalc.com',
      to: process.env.ALERT_EMAIL_TO?.split(',') || ['admin@globaltaxcalc.com']
    },
    slack: {
      enabled: process.env.ALERT_SLACK_ENABLED === 'true',
      webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
      channel: process.env.SLACK_CHANNEL || '#alerts',
      username: process.env.SLACK_USERNAME || 'GlobalTaxCalc Monitor',
      emoji: process.env.SLACK_EMOJI || ':warning:'
    },
    pagerduty: {
      enabled: process.env.ALERT_PAGERDUTY_ENABLED === 'true',
      integrationKey: process.env.PAGERDUTY_INTEGRATION_KEY || '',
      routingKey: process.env.PAGERDUTY_ROUTING_KEY || ''
    },
    sms: {
      enabled: process.env.ALERT_SMS_ENABLED === 'true',
      twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID || '',
        authToken: process.env.TWILIO_AUTH_TOKEN || '',
        fromPhone: process.env.TWILIO_FROM_PHONE || ''
      },
      to: process.env.ALERT_SMS_TO?.split(',') || []
    }
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: process.env.LOG_MAX_FILES || '14',
    datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
    consoleEnabled: process.env.CONSOLE_LOG_ENABLED === 'true',
    fileEnabled: process.env.FILE_LOG_ENABLED === 'true',
    dir: path.join(__dirname, '../../logs')
  },

  // Performance Monitoring
  performance: {
    apmEnabled: process.env.APM_ENABLED === 'true',
    budgetP95: parseInt(process.env.PERFORMANCE_BUDGET_P95, 10) || 500,
    budgetP99: parseInt(process.env.PERFORMANCE_BUDGET_P99, 10) || 1000,
    errorRateThreshold: parseFloat(process.env.ERROR_RATE_THRESHOLD) || 0.05,
    responseTimeAlertThreshold: parseInt(process.env.RESPONSE_TIME_ALERT_THRESHOLD, 10) || 1000
  },

  // System Monitoring
  system: {
    metricsEnabled: process.env.SYSTEM_METRICS_ENABLED === 'true',
    cpuThreshold: parseFloat(process.env.CPU_THRESHOLD) || 80,
    memoryThreshold: parseFloat(process.env.MEMORY_THRESHOLD) || 85,
    diskThreshold: parseFloat(process.env.DISK_THRESHOLD) || 90,
    networkMonitoringEnabled: process.env.NETWORK_MONITORING_ENABLED === 'true'
  },

  // Business Metrics
  business: {
    metricsEnabled: process.env.BUSINESS_METRICS_ENABLED === 'true',
    revenueTrackingEnabled: process.env.REVENUE_TRACKING_ENABLED === 'true',
    userActivityTrackingEnabled: process.env.USER_ACTIVITY_TRACKING_ENABLED === 'true',
    conversionTrackingEnabled: process.env.CONVERSION_TRACKING_ENABLED === 'true'
  },

  // Security Configuration
  security: {
    apiKeyRequired: process.env.API_KEY_REQUIRED === 'true',
    apiKey: process.env.API_KEY || '',
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
      max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 1000
    }
  },

  // Dashboard Configuration
  dashboard: {
    grafanaUrl: process.env.GRAFANA_URL || 'http://localhost:3000',
    grafanaUsername: process.env.GRAFANA_USERNAME || 'admin',
    grafanaPassword: process.env.GRAFANA_PASSWORD || 'admin',
    refreshInterval: process.env.DASHBOARD_REFRESH_INTERVAL || '5s'
  },

  // Circuit Breaker Configuration
  circuitBreaker: {
    enabled: process.env.CIRCUIT_BREAKER_ENABLED === 'true',
    threshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD, 10) || 5,
    timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT, 10) || 60000,
    resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT, 10) || 30000
  },

  // On-Call Configuration
  onCall: {
    enabled: process.env.ON_CALL_ENABLED === 'true',
    scheduleType: process.env.ON_CALL_SCHEDULE_TYPE || 'weekly',
    primary: process.env.ON_CALL_PRIMARY || 'admin@globaltaxcalc.com',
    secondary: process.env.ON_CALL_SECONDARY || 'ops@globaltaxcalc.com',
    escalationTimeout: parseInt(process.env.ON_CALL_ESCALATION_TIMEOUT, 10) || 300
  }
};

// Validation
const validateConfig = () => {
  const required = [
    'server.port',
    'service.name'
  ];

  for (const key of required) {
    const value = key.split('.').reduce((obj, k) => obj && obj[k], config);
    if (!value) {
      throw new Error(`Missing required configuration: ${key}`);
    }
  }

  // Validate Sentry DSN if enabled
  if (config.sentry.enabled && !config.sentry.dsn) {
    console.warn('Sentry is enabled but no DSN provided');
  }

  // Validate alerting configuration
  if (config.alerting.enabled) {
    if (config.alerting.email.enabled && !config.alerting.email.smtp.user) {
      console.warn('Email alerting is enabled but no SMTP user provided');
    }
    if (config.alerting.slack.enabled && !config.alerting.slack.webhookUrl) {
      console.warn('Slack alerting is enabled but no webhook URL provided');
    }
  }
};

// Initialize directories
const initDirectories = () => {
  const fs = require('fs');
  const dirs = [
    config.logging.dir,
    path.join(__dirname, '../../dashboards'),
    path.join(__dirname, '../../alerts')
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Environment-specific overrides
if (config.server.env === 'production') {
  config.logging.level = 'warn';
  config.logging.consoleEnabled = false;
}

if (config.server.env === 'test') {
  config.logging.level = 'error';
  config.healthCheck.interval = 60000;
  config.alerting.enabled = false;
}

module.exports = {
  ...config,
  validateConfig,
  initDirectories
};