const path = require('path');
require('dotenv').config();

const config = {
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT, 10) || 3003,
    host: process.env.HOST || 'localhost',
    env: process.env.NODE_ENV || 'development',
    corsOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    trustedProxies: process.env.TRUSTED_PROXIES?.split(',') || []
  },

  // Report Service Settings
  reports: {
    maxSizeMB: parseInt(process.env.MAX_REPORT_SIZE_MB, 10) || 50,
    concurrentReports: parseInt(process.env.CONCURRENT_REPORTS, 10) || 5,
    timeoutMs: parseInt(process.env.REPORT_TIMEOUT_MS, 10) || 30000,
    tempDir: process.env.TEMP_DIR || path.join(__dirname, '../../temp'),
    reportsDir: process.env.REPORTS_DIR || path.join(__dirname, '../../reports')
  },

  // PDF Generation Settings
  pdf: {
    puppeteerExecutablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
    quality: process.env.PDF_QUALITY || 'high',
    format: process.env.PDF_FORMAT || 'A4',
    margin: process.env.PDF_MARGIN || '20mm',
    chartRenderTimeout: parseInt(process.env.CHART_RENDER_TIMEOUT, 10) || 5000,
    options: {
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="font-size: 10px; width: 100%; text-align: center; color: #666;">
          <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>
      `
    }
  },

  // Branding Configuration
  branding: {
    companyName: process.env.COMPANY_NAME || 'GlobalTaxCalc',
    logoPath: process.env.COMPANY_LOGO_PATH || path.join(__dirname, '../../assets/logos/company-logo.png'),
    defaultBrandColor: process.env.DEFAULT_BRAND_COLOR || '#2563eb',
    watermarkEnabled: process.env.WATERMARK_ENABLED === 'true',
    premiumWatermarkDisabled: process.env.PREMIUM_WATERMARK_DISABLED === 'true',
    colors: {
      primary: '#2563eb',
      secondary: '#64748b',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      accent: '#8b5cf6'
    }
  },

  // Font Configuration
  fonts: {
    primary: process.env.FONT_PRIMARY || 'Inter',
    secondary: process.env.FONT_SECONDARY || 'Roboto',
    monospace: process.env.FONT_MONOSPACE || 'JetBrains Mono',
    customDir: process.env.CUSTOM_FONTS_DIR || path.join(__dirname, '../../assets/fonts')
  },

  // Localization
  i18n: {
    defaultLanguage: process.env.DEFAULT_LANGUAGE || 'en',
    supportedLanguages: process.env.SUPPORTED_LANGUAGES?.split(',') || ['en', 'es', 'fr', 'de', 'it'],
    defaultCurrency: process.env.DEFAULT_CURRENCY || 'USD',
    defaultTimezone: process.env.DEFAULT_TIMEZONE || 'America/New_York',
    rtlLanguages: process.env.RTL_LANGUAGES?.split(',') || ['ar', 'he', 'fa'],
    localesPath: path.join(__dirname, '../locales')
  },

  // Export Settings
  export: {
    csv: {
      delimiter: process.env.CSV_DELIMITER || ',',
      encoding: process.env.CSV_ENCODING || 'utf8'
    },
    excel: {
      sheetName: process.env.EXCEL_SHEET_NAME || 'Tax Report',
      passwordProtected: process.env.EXCEL_PASSWORD_PROTECTED === 'true'
    },
    json: {
      prettyPrint: process.env.JSON_PRETTY_PRINT === 'true'
    },
    formats: ['pdf', 'csv', 'excel', 'json'],
    maxConcurrentExports: 3
  },

  // Redis Cache
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    enabled: process.env.REDIS_ENABLED === 'true',
    ttlHours: parseInt(process.env.CACHE_TTL_HOURS, 10) || 24
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100
  },

  // Security
  security: {
    apiKeyRequired: process.env.API_KEY_REQUIRED === 'true',
    apiKey: process.env.API_KEY || null,
    jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret-key'
  },

  // File Upload
  upload: {
    maxSizeMB: parseInt(process.env.MAX_UPLOAD_SIZE_MB, 10) || 10,
    uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'),
    allowedExtensions: process.env.ALLOWED_EXTENSIONS?.split(',') || ['.json', '.csv', '.xlsx']
  },

  // Monitoring
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined',
    enableMetrics: process.env.ENABLE_METRICS === 'true'
  },

  // Chart Configuration
  charts: {
    defaultWidth: 800,
    defaultHeight: 400,
    backgroundColor: '#ffffff',
    fontFamily: 'Inter',
    colors: [
      '#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
      '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
    ]
  },

  // Template Configuration
  templates: {
    dir: path.join(__dirname, '../templates'),
    partialsDir: path.join(__dirname, '../templates/partials'),
    helpersDir: path.join(__dirname, '../templates/helpers'),
    extension: '.hbs',
    cache: process.env.NODE_ENV === 'production'
  }
};

// Validation
const validateConfig = () => {
  const required = [
    'server.port',
    'branding.companyName'
  ];

  for (const key of required) {
    const value = key.split('.').reduce((obj, k) => obj && obj[k], config);
    if (!value) {
      throw new Error(`Missing required configuration: ${key}`);
    }
  }
};

// Initialize directories
const initDirectories = () => {
  const fs = require('fs');
  const dirs = [
    config.reports.tempDir,
    config.reports.reportsDir,
    config.upload.uploadDir,
    path.join(__dirname, '../../assets'),
    path.join(__dirname, '../../assets/logos'),
    path.join(__dirname, '../../assets/fonts')
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
  config.templates.cache = true;
  config.pdf.options.printBackground = true;
}

if (config.server.env === 'test') {
  config.logging.level = 'error';
  config.reports.timeoutMs = 5000;
}

module.exports = {
  ...config,
  validateConfig,
  initDirectories
};