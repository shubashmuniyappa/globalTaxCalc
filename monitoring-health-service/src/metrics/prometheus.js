const promClient = require('prom-client');
const config = require('../config');

let register;
let httpDuration;
let httpRequests;
let httpRequestErrors;
let dbQueryDuration;
let dbConnectionPool;
let businessCalculations;
let businessRevenue;
let businessConversions;
let systemCpuUsage;
let systemMemoryUsage;
let systemDiskUsage;
let uptime;

const initializeMetrics = () => {
  register = new promClient.Registry();

  register.setDefaultLabels({
    service: config.service.name,
    version: config.service.version,
    environment: config.service.environment
  });

  if (config.prometheus.collectDefaultMetrics) {
    promClient.collectDefaultMetrics({
      register,
      prefix: `${config.prometheus.metricsPrefix}_`,
      labels: { service: config.service.name }
    });
  }

  httpDuration = new promClient.Histogram({
    name: `${config.prometheus.metricsPrefix}_http_request_duration_seconds`,
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code', 'service'],
    buckets: config.prometheus.buckets,
    registers: [register]
  });

  httpRequests = new promClient.Counter({
    name: `${config.prometheus.metricsPrefix}_http_requests_total`,
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code', 'service'],
    registers: [register]
  });

  httpRequestErrors = new promClient.Counter({
    name: `${config.prometheus.metricsPrefix}_http_request_errors_total`,
    help: 'Total number of HTTP request errors',
    labelNames: ['method', 'route', 'status_code', 'error_type', 'service'],
    registers: [register]
  });

  dbQueryDuration = new promClient.Histogram({
    name: `${config.prometheus.metricsPrefix}_db_query_duration_seconds`,
    help: 'Duration of database queries in seconds',
    labelNames: ['query_type', 'table', 'operation', 'database'],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [register]
  });

  dbConnectionPool = new promClient.Gauge({
    name: `${config.prometheus.metricsPrefix}_db_connection_pool`,
    help: 'Database connection pool status',
    labelNames: ['status', 'database'],
    registers: [register]
  });

  businessCalculations = new promClient.Counter({
    name: `${config.prometheus.metricsPrefix}_business_calculations_total`,
    help: 'Total number of tax calculations performed',
    labelNames: ['calculation_type', 'country', 'success'],
    registers: [register]
  });

  businessRevenue = new promClient.Gauge({
    name: `${config.prometheus.metricsPrefix}_business_revenue_total`,
    help: 'Total revenue generated',
    labelNames: ['currency', 'subscription_type', 'country'],
    registers: [register]
  });

  businessConversions = new promClient.Counter({
    name: `${config.prometheus.metricsPrefix}_business_conversions_total`,
    help: 'Total number of user conversions',
    labelNames: ['conversion_type', 'source', 'country'],
    registers: [register]
  });

  systemCpuUsage = new promClient.Gauge({
    name: `${config.prometheus.metricsPrefix}_system_cpu_usage_percent`,
    help: 'System CPU usage percentage',
    labelNames: ['core'],
    registers: [register]
  });

  systemMemoryUsage = new promClient.Gauge({
    name: `${config.prometheus.metricsPrefix}_system_memory_usage_bytes`,
    help: 'System memory usage in bytes',
    labelNames: ['type'],
    registers: [register]
  });

  systemDiskUsage = new promClient.Gauge({
    name: `${config.prometheus.metricsPrefix}_system_disk_usage_bytes`,
    help: 'System disk usage in bytes',
    labelNames: ['filesystem', 'mount'],
    registers: [register]
  });

  uptime = new promClient.Gauge({
    name: `${config.prometheus.metricsPrefix}_uptime_seconds`,
    help: 'Service uptime in seconds',
    registers: [register]
  });

  if (config.prometheus.collectGcMetrics) {
    promClient.collectDefaultMetrics({
      register,
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
    });
  }

  const startTime = Date.now();
  setInterval(() => {
    uptime.set((Date.now() - startTime) / 1000);
  }, 1000);

  console.log('Prometheus metrics initialized successfully');
};

const recordHttpRequest = (method, route, statusCode, duration, service = config.service.name) => {
  const labels = { method, route, status_code: statusCode, service };

  httpDuration.observe(labels, duration);
  httpRequests.inc(labels);

  if (statusCode >= 400) {
    const errorType = statusCode >= 500 ? 'server_error' : 'client_error';
    httpRequestErrors.inc({ ...labels, error_type: errorType });
  }
};

const recordDbQuery = (queryType, table, operation, duration, database = 'default') => {
  dbQueryDuration.observe({ query_type: queryType, table, operation, database }, duration);
};

const updateDbConnectionPool = (active, idle, total, database = 'default') => {
  dbConnectionPool.set({ status: 'active', database }, active);
  dbConnectionPool.set({ status: 'idle', database }, idle);
  dbConnectionPool.set({ status: 'total', database }, total);
};

const recordBusinessCalculation = (calculationType, country, success) => {
  businessCalculations.inc({
    calculation_type: calculationType,
    country,
    success: success.toString()
  });
};

const updateBusinessRevenue = (amount, currency, subscriptionType, country) => {
  businessRevenue.set({
    currency,
    subscription_type: subscriptionType,
    country
  }, amount);
};

const recordBusinessConversion = (conversionType, source, country) => {
  businessConversions.inc({
    conversion_type: conversionType,
    source,
    country
  });
};

const updateSystemMetrics = (cpu, memory, disk) => {
  if (cpu) {
    if (Array.isArray(cpu)) {
      cpu.forEach((usage, index) => {
        systemCpuUsage.set({ core: index.toString() }, usage);
      });
    } else {
      systemCpuUsage.set({ core: 'average' }, cpu);
    }
  }

  if (memory) {
    systemMemoryUsage.set({ type: 'used' }, memory.used || 0);
    systemMemoryUsage.set({ type: 'free' }, memory.free || 0);
    systemMemoryUsage.set({ type: 'total' }, memory.total || 0);
  }

  if (disk && Array.isArray(disk)) {
    disk.forEach(d => {
      systemDiskUsage.set({ filesystem: d.filesystem, mount: d.mount }, d.used || 0);
    });
  }
};

const getMetrics = async () => {
  return await register.metrics();
};

const getRegister = () => register;

module.exports = {
  initializeMetrics,
  recordHttpRequest,
  recordDbQuery,
  updateDbConnectionPool,
  recordBusinessCalculation,
  updateBusinessRevenue,
  recordBusinessConversion,
  updateSystemMetrics,
  getMetrics,
  getRegister
};