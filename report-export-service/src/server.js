const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const multer = require('multer');
const Joi = require('joi');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const { logger, requestLogger } = require('./utils/logger');

// Import services
const ReportGenerator = require('./services/reportGenerator');
const ExportService = require('./services/exportService');
const LocalizationService = require('./services/localizationService');
const CustomizationService = require('./services/customizationService');

// Initialize services
const reportGenerator = new ReportGenerator();
const exportService = new ExportService();
const localizationService = new LocalizationService();
const customizationService = new CustomizationService();

// Create Express app
const app = express();

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: config.server.corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

// Request parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (config.logging.enableMetrics) {
  app.use(morgan(config.logging.format));
}
app.use(requestLogger);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    error: 'Too many requests from this IP',
    retryAfter: Math.ceil(config.rateLimit.windowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api', limiter);

// File upload middleware
const upload = multer({
  limits: {
    fileSize: config.upload.maxSizeMB * 1024 * 1024,
    files: 5
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = config.upload.allowedExtensions;
    const fileExtension = '.' + file.originalname.split('.').pop().toLowerCase();

    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${fileExtension} not allowed`), false);
    }
  }
});

// Validation schemas
const taxDataSchema = Joi.object({
  taxYear: Joi.number().integer().min(2000).max(2030).required(),
  grossIncome: Joi.number().min(0).required(),
  taxableIncome: Joi.number().min(0),
  adjustedGrossIncome: Joi.number().min(0),
  federalTax: Joi.number().min(0),
  stateTax: Joi.number().min(0),
  totalTax: Joi.number().min(0),
  filingStatus: Joi.string().valid('single', 'married_filing_jointly', 'married_filing_separately', 'head_of_household'),
  state: Joi.string().length(2),
  deductions: Joi.object().pattern(Joi.string(), Joi.number().min(0)),
  credits: Joi.object().pattern(Joi.string(), Joi.number().min(0)),
  taxBrackets: Joi.array().items(Joi.object({
    min: Joi.number().min(0).required(),
    max: Joi.number().min(0).allow(Infinity),
    rate: Joi.number().min(0).max(1).required()
  })),
  yearComparison: Joi.array().items(Joi.object()),
  userInfo: Joi.object({
    fullName: Joi.string(),
    email: Joi.string().email(),
    userId: Joi.string()
  })
});

const reportOptionsSchema = Joi.object({
  locale: Joi.string().valid(...config.i18n.supportedLanguages).default(config.i18n.defaultLanguage),
  currency: Joi.string().length(3).default(config.i18n.defaultCurrency),
  timezone: Joi.string().default(config.i18n.defaultTimezone),
  format: Joi.string().valid('A4', 'Letter', 'A3', 'Legal').default('A4'),
  landscape: Joi.boolean().default(false),
  includeCharts: Joi.boolean().default(true),
  includeBranding: Joi.boolean().default(true),
  showWatermark: Joi.boolean(),
  watermarkText: Joi.string().max(100),
  template: Joi.string(),
  colorScheme: Joi.string(),
  customBranding: Joi.object({
    companyName: Joi.string().max(100),
    logoUrl: Joi.string().uri(),
    colors: Joi.object()
  }),
  sections: Joi.array().items(Joi.string()),
  userTier: Joi.string().valid('free', 'basic', 'premium', 'enterprise').default('free'),
  isPremium: Joi.boolean().default(false),
  accessibility: Joi.object({
    highContrast: Joi.boolean().default(false),
    largeText: Joi.boolean().default(false),
    alternativeText: Joi.boolean().default(true)
  }),
  privacy: Joi.object({
    maskSSN: Joi.boolean().default(true),
    maskBankAccount: Joi.boolean().default(true),
    hidePersonalInfo: Joi.boolean().default(false)
  })
});

// API Authentication middleware (simple API key check)
const authenticate = (req, res, next) => {
  if (!config.security.apiKeyRequired) {
    return next();
  }

  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!apiKey || apiKey !== config.security.apiKey) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or missing API key'
    });
  }

  next();
};

// Error handling middleware
const handleError = (error, req, res, next) => {
  logger.error('API Error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  if (error.isJoi) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: error.details.map(d => d.message)
    });
  }

  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: 'File too large',
      maxSize: `${config.upload.maxSizeMB}MB`
    });
  }

  const status = error.status || error.statusCode || 500;
  res.status(status).json({
    success: false,
    error: status === 500 ? 'Internal server error' : error.message
  });
};

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const [
      reportHealth,
      localizationHealth
    ] = await Promise.all([
      reportGenerator.healthCheck(),
      localizationService.healthCheck()
    ]);

    const overallHealthy = reportHealth.healthy && localizationHealth.healthy;

    res.status(overallHealthy ? 200 : 503).json({
      status: overallHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        reportGenerator: reportHealth,
        localization: localizationHealth
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Main API routes

// Generate tax summary report
app.post('/api/reports/generate', authenticate, async (req, res) => {
  try {
    // Validate request body
    const { error: dataError, value: taxData } = taxDataSchema.validate(req.body.taxData);
    if (dataError) throw dataError;

    const { error: optionsError, value: options } = reportOptionsSchema.validate(req.body.options || {});
    if (optionsError) throw optionsError;

    // Apply customizations
    const customizations = customizationService.applyCustomizations(options, {
      userTier: options.userTier,
      userPreferences: options
    });

    // Generate report
    const result = await reportGenerator.generateTaxSummaryReport(taxData, {
      ...options,
      ...customizations,
      userId: req.headers['x-user-id'] || options.userId,
      saveToFile: false
    });

    if (result.success) {
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Length': result.buffer.length,
        'Content-Disposition': `attachment; filename="tax-report-${result.reportId}.pdf"`
      });

      res.send(result.buffer);
    } else {
      res.status(500).json({
        success: false,
        error: 'Report generation failed',
        details: result.error
      });
    }
  } catch (error) {
    handleError(error, req, res);
  }
});

// Get download link for generated report
app.get('/api/reports/download/:reportId', authenticate, async (req, res) => {
  try {
    const { reportId } = req.params;

    // In a real implementation, you'd store generated reports temporarily
    // and allow downloads via the report ID
    res.status(404).json({
      success: false,
      error: 'Report not found or expired'
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

// Export data to CSV
app.post('/api/exports/csv', authenticate, async (req, res) => {
  try {
    const { error: dataError, value: taxData } = taxDataSchema.validate(req.body.taxData);
    if (dataError) throw dataError;

    const options = {
      locale: req.body.locale || config.i18n.defaultLanguage,
      currency: req.body.currency || config.i18n.defaultCurrency,
      includeDetails: req.body.includeDetails !== false,
      includeDeductions: req.body.includeDeductions !== false,
      includeCredits: req.body.includeCredits !== false,
      userId: req.headers['x-user-id']
    };

    const result = await exportService.exportToCSV(taxData, options);

    if (result.success) {
      res.set({
        'Content-Type': 'text/csv',
        'Content-Length': result.buffer.length,
        'Content-Disposition': `attachment; filename="tax-data-${result.exportId}.csv"`
      });

      res.send(result.buffer);
    } else {
      res.status(500).json({
        success: false,
        error: 'CSV export failed'
      });
    }
  } catch (error) {
    handleError(error, req, res);
  }
});

// Export data to Excel
app.post('/api/exports/excel', authenticate, async (req, res) => {
  try {
    const { error: dataError, value: taxData } = taxDataSchema.validate(req.body.taxData);
    if (dataError) throw dataError;

    const options = {
      locale: req.body.locale || config.i18n.defaultLanguage,
      currency: req.body.currency || config.i18n.defaultCurrency,
      multipleSheets: req.body.multipleSheets !== false,
      userId: req.headers['x-user-id']
    };

    const result = await exportService.exportToExcel(taxData, options);

    if (result.success) {
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Length': result.buffer.length,
        'Content-Disposition': `attachment; filename="tax-data-${result.exportId}.xlsx"`
      });

      res.send(result.buffer);
    } else {
      res.status(500).json({
        success: false,
        error: 'Excel export failed'
      });
    }
  } catch (error) {
    handleError(error, req, res);
  }
});

// Export data to JSON
app.post('/api/exports/json', authenticate, async (req, res) => {
  try {
    const { error: dataError, value: taxData } = taxDataSchema.validate(req.body.taxData);
    if (dataError) throw dataError;

    const options = {
      prettyPrint: req.body.prettyPrint !== false,
      includeMetadata: req.body.includeMetadata !== false,
      userId: req.headers['x-user-id']
    };

    const result = await exportService.exportToJSON(taxData, options);

    if (result.success) {
      res.set({
        'Content-Type': 'application/json',
        'Content-Length': result.buffer.length,
        'Content-Disposition': `attachment; filename="tax-data-${result.exportId}.json"`
      });

      res.send(result.buffer);
    } else {
      res.status(500).json({
        success: false,
        error: 'JSON export failed'
      });
    }
  } catch (error) {
    handleError(error, req, res);
  }
});

// Bulk export
app.post('/api/exports/bulk', authenticate, async (req, res) => {
  try {
    const { error: dataError, value: taxData } = taxDataSchema.validate(req.body.taxData);
    if (dataError) throw dataError;

    const options = {
      formats: req.body.formats || ['csv', 'excel', 'json'],
      locale: req.body.locale || config.i18n.defaultLanguage,
      currency: req.body.currency || config.i18n.defaultCurrency,
      userId: req.headers['x-user-id']
    };

    const result = await exportService.createBulkExport(taxData, options);

    if (result.success) {
      res.set({
        'Content-Type': 'application/zip',
        'Content-Length': result.buffer.length,
        'Content-Disposition': `attachment; filename="tax-bulk-export-${result.exportId}.zip"`
      });

      res.send(result.buffer);
    } else {
      res.status(500).json({
        success: false,
        error: 'Bulk export failed'
      });
    }
  } catch (error) {
    handleError(error, req, res);
  }
});

// Get available report templates
app.get('/api/reports/templates', authenticate, async (req, res) => {
  try {
    const userTier = req.query.tier || 'free';
    const templates = customizationService.getAllTemplates();
    const options = customizationService.getAvailableOptions(userTier);

    res.json({
      success: true,
      templates,
      customizationOptions: options,
      supportedLocales: localizationService.getSupportedLanguages()
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

// Get service status
app.get('/api/status', authenticate, async (req, res) => {
  try {
    const status = {
      timestamp: new Date().toISOString(),
      services: {
        reportGenerator: reportGenerator.getStatus(),
        exportService: exportService.getStatistics(),
        customization: customizationService.getStatistics(),
        localization: localizationService.getStatistics()
      },
      configuration: {
        maxConcurrentReports: config.reports.concurrentReports,
        maxFileSize: `${config.upload.maxSizeMB}MB`,
        supportedLanguages: config.i18n.supportedLanguages,
        supportedFormats: config.export.formats
      }
    };

    res.json({ success: true, status });
  } catch (error) {
    handleError(error, req, res);
  }
});

// File upload for custom logo/assets
app.post('/api/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // In a real implementation, you'd save the file to cloud storage
    // and return the URL for use in custom branding

    res.json({
      success: true,
      file: {
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      },
      message: 'File uploaded successfully'
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Error handling
app.use(handleError);

// Initialize services and start server
async function startServer() {
  try {
    logger.info('Starting Report & Export Service...');

    // Validate configuration
    config.validateConfig();

    // Initialize directories
    config.initDirectories();

    // Initialize services
    await Promise.all([
      reportGenerator.initialize(),
      localizationService.initialize()
    ]);

    // Start server
    const server = app.listen(config.server.port, config.server.host, () => {
      logger.info(`Server running on ${config.server.host}:${config.server.port}`, {
        environment: config.server.env,
        apiKeyRequired: config.security.apiKeyRequired
      });
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);

      server.close(async () => {
        try {
          await Promise.all([
            reportGenerator.cleanup()
          ]);

          logger.info('Server shut down successfully');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', { error: error.message });
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = app;