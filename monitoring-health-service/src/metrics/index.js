const prometheus = require('./prometheus');
const middleware = require('./middleware');
const SystemMonitor = require('./systemMonitor');
const config = require('../config');

class MetricsManager {
  constructor() {
    this.systemMonitor = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      console.warn('Metrics manager already initialized');
      return;
    }

    try {
      prometheus.initializeMetrics();

      if (config.system.metricsEnabled) {
        this.systemMonitor = new SystemMonitor();
        await this.systemMonitor.start();
      }

      this.isInitialized = true;
      console.log('Metrics manager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize metrics manager:', error);
      throw error;
    }
  }

  async shutdown() {
    if (!this.isInitialized) {
      return;
    }

    if (this.systemMonitor) {
      this.systemMonitor.stop();
    }

    this.isInitialized = false;
    console.log('Metrics manager shut down');
  }

  getHttpMiddleware() {
    return middleware.createMetricsMiddleware();
  }

  getRequestLogger() {
    return middleware.createRequestLogger();
  }

  wrapDbClient(dbClient, database = 'default') {
    return middleware.createDbMetricsWrapper(dbClient, database);
  }

  getBusinessMetrics() {
    return middleware.createBusinessMetricsWrapper();
  }

  async getMetrics() {
    return await prometheus.getMetrics();
  }

  getRegister() {
    return prometheus.getRegister();
  }

  async getSystemSummary() {
    if (this.systemMonitor) {
      return await this.systemMonitor.getSystemSummary();
    }
    return { error: 'System monitoring not enabled' };
  }

  recordHttpRequest(method, route, statusCode, duration, service) {
    prometheus.recordHttpRequest(method, route, statusCode, duration, service);
  }

  recordDbQuery(queryType, table, operation, duration, database) {
    prometheus.recordDbQuery(queryType, table, operation, duration, database);
  }

  updateDbConnectionPool(active, idle, total, database) {
    prometheus.updateDbConnectionPool(active, idle, total, database);
  }

  recordBusinessCalculation(calculationType, country, success) {
    prometheus.recordBusinessCalculation(calculationType, country, success);
  }

  updateBusinessRevenue(amount, currency, subscriptionType, country) {
    prometheus.updateBusinessRevenue(amount, currency, subscriptionType, country);
  }

  recordBusinessConversion(conversionType, source, country) {
    prometheus.recordBusinessConversion(conversionType, source, country);
  }

  updateSystemMetrics(cpu, memory, disk) {
    prometheus.updateSystemMetrics(cpu, memory, disk);
  }
}

const metricsManager = new MetricsManager();

module.exports = {
  metricsManager,
  MetricsManager,
  prometheus,
  middleware,
  SystemMonitor
};