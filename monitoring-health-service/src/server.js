const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const responseTime = require('response-time');

const config = require('./config');
const { logger } = require('./logging/logger');
const { metricsManager } = require('./metrics');
const { healthManager } = require('./health');
const { alertManager } = require('./alerts/alertManager');
const { sentryManager } = require('./monitoring/sentry');
const { apmMonitor } = require('./performance/apmMonitor');
const LogAggregator = require('./logging/logAggregator');
const apiRoutes = require('./api/routes');

class MonitoringHealthServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.isShuttingDown = false;
    this.logAggregator = new LogAggregator();
  }

  async initialize() {
    try {
      console.log('Initializing GlobalTaxCalc Monitoring & Health Service...');

      config.validateConfig();
      config.initDirectories();

      await this.initializeServices();
      this.setupMiddleware();
      this.setupRoutes();
      this.setupErrorHandling();

      console.log('Monitoring & Health Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize service:', error);
      process.exit(1);
    }
  }

  async initializeServices() {
    sentryManager.initialize();

    logger.initialize();

    await metricsManager.initialize();

    await healthManager.initialize();

    await alertManager.initialize();

    apmMonitor.start();

    this.logAggregator.start();

    logger.info('All monitoring services initialized', {
      timestamp: new Date().toISOString(),
      service: config.service.name
    });
  }

  setupMiddleware() {
    if (config.sentry.enabled) {
      this.app.use(...sentryManager.createExpressMiddleware());
    }

    this.app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    }));

    this.app.use(cors({
      origin: config.server.corsOrigins,
      credentials: true
    }));

    this.app.use(compression());

    this.app.use(responseTime());

    this.app.use(metricsManager.getHttpMiddleware());
    this.app.use(metricsManager.getRequestLogger());
    this.app.use(apmMonitor.createExpressMiddleware());

    this.app.use(morgan('combined', {
      stream: {
        write: (message) => {
          logger.info('HTTP Request', { httpLog: message.trim() });
        }
      }
    }));

    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    this.app.use(logger.createRequestMiddleware());
  }

  setupRoutes() {
    this.app.get('/', (req, res) => {
      res.json({
        service: config.service.name,
        version: config.service.version,
        environment: config.service.environment,
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/health',
          metrics: '/metrics',
          status: '/status',
          api: '/api'
        },
        documentation: 'https://docs.globaltaxcalc.com/monitoring'
      });
    });

    this.app.use('/api', apiRoutes);

    this.app.get('/favicon.ico', (req, res) => res.status(204).end());

    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
      });
    });
  }

  setupErrorHandling() {
    if (config.sentry.enabled) {
      this.app.use(sentryManager.createExpressErrorHandler());
    }

    this.app.use(logger.createErrorMiddleware());

    this.app.use((err, req, res, next) => {
      if (res.headersSent) {
        return next(err);
      }

      const errorData = {
        error: err.message,
        stack: err.stack,
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        timestamp: new Date().toISOString()
      };

      logger.error('Unhandled Express Error', errorData);

      if (config.sentry.enabled) {
        sentryManager.captureError(err, {
          tags: { source: 'express' },
          extra: errorData
        });
      }

      res.status(err.status || 500).json({
        error: 'Internal Server Error',
        message: config.server.env === 'development' ? err.message : 'Something went wrong',
        requestId: req.id,
        timestamp: new Date().toISOString()
      });
    });
  }

  async start() {
    try {
      await this.initialize();

      this.server = this.app.listen(config.server.port, config.server.host, () => {
        const address = this.server.address();
        console.log(`🚀 Monitoring & Health Service running on ${address.address}:${address.port}`);
        console.log(`📊 Metrics available at http://${address.address}:${address.port}/metrics`);
        console.log(`❤️  Health checks at http://${address.address}:${address.port}/health`);
        console.log(`📈 API documentation at http://${address.address}:${address.port}/api`);

        logger.info('Service started successfully', {
          host: address.address,
          port: address.port,
          environment: config.server.env,
          features: {
            prometheus: config.prometheus.enabled,
            sentry: config.sentry.enabled,
            alerting: config.alerting.enabled,
            elasticsearch: config.elasticsearch.enabled
          }
        });

        this.sendStartupAlert();
      });

      this.server.on('error', this.handleServerError.bind(this));

      this.setupGracefulShutdown();

      return this.server;
    } catch (error) {
      console.error('Failed to start server:', error);
      await this.shutdown(1);
    }
  }

  async sendStartupAlert() {
    try {
      if (config.alerting.enabled && config.server.env === 'production') {
        await alertManager.sendAlert({
          title: 'Monitoring Service Started',
          description: `GlobalTaxCalc Monitoring & Health Service has started successfully in ${config.server.env} environment`,
          severity: 'info',
          category: 'system',
          source: 'startup',
          metadata: {
            version: config.service.version,
            host: require('os').hostname(),
            timestamp: new Date().toISOString()
          }
        });
      }
    } catch (error) {
      logger.warn('Failed to send startup alert', { error: error.message });
    }
  }

  handleServerError(error) {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${config.server.port} is already in use`);
    } else if (error.code === 'EACCES') {
      console.error(`Permission denied for port ${config.server.port}`);
    } else {
      console.error('Server error:', error);
    }

    logger.error('Server error', {
      error: error.message,
      code: error.code,
      port: config.server.port
    });

    process.exit(1);
  }

  setupGracefulShutdown() {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR1', 'SIGUSR2'];

    signals.forEach(signal => {
      process.on(signal, async () => {
        console.log(`Received ${signal}, initiating graceful shutdown...`);
        await this.shutdown(0);
      });
    });

    process.on('uncaughtException', async (error) => {
      console.error('Uncaught Exception:', error);
      logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack
      });

      if (config.sentry.enabled) {
        await sentryManager.captureError(error, {
          tags: { source: 'uncaughtException' }
        });
        await sentryManager.flush();
      }

      await this.shutdown(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      logger.error('Unhandled Rejection', {
        reason: reason?.toString() || 'Unknown',
        promise: promise?.toString() || 'Unknown'
      });

      if (config.sentry.enabled) {
        await sentryManager.captureError(new Error(`Unhandled Rejection: ${reason}`), {
          tags: { source: 'unhandledRejection' },
          extra: { promise: promise?.toString() }
        });
        await sentryManager.flush();
      }

      await this.shutdown(1);
    });
  }

  async shutdown(exitCode = 0) {
    if (this.isShuttingDown) {
      console.log('Shutdown already in progress...');
      return;
    }

    this.isShuttingDown = true;
    console.log('Shutting down Monitoring & Health Service...');

    try {
      if (config.alerting.enabled && config.server.env === 'production') {
        await alertManager.sendAlert({
          title: 'Monitoring Service Shutting Down',
          description: `GlobalTaxCalc Monitoring & Health Service is shutting down`,
          severity: 'warning',
          category: 'system',
          source: 'shutdown',
          metadata: {
            exitCode,
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
          }
        });
      }

      if (this.server) {
        console.log('Closing HTTP server...');
        await new Promise((resolve) => {
          this.server.close(() => {
            console.log('HTTP server closed');
            resolve();
          });
        });
      }

      console.log('Shutting down monitoring services...');

      apmMonitor.stop();
      this.logAggregator.stop();

      await metricsManager.shutdown();
      await healthManager.shutdown();

      alertManager.shutdown();

      if (config.sentry.enabled) {
        await sentryManager.flush();
        await sentryManager.close();
      }

      await logger.cleanup();

      console.log('Monitoring & Health Service shutdown complete');
    } catch (error) {
      console.error('Error during shutdown:', error);
    } finally {
      process.exit(exitCode);
    }
  }

  getApp() {
    return this.app;
  }

  getServer() {
    return this.server;
  }
}

if (require.main === module) {
  const server = new MonitoringHealthServer();
  server.start().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

module.exports = MonitoringHealthServer;