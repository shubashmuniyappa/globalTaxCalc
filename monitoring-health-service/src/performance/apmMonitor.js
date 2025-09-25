const os = require('os');
const v8 = require('v8');
const fs = require('fs').promises;
const config = require('../config');

class APMMonitor {
  constructor() {
    this.isRunning = false;
    this.interval = null;
    this.performanceData = new Map();
    this.transactionTraces = new Map();
    this.resourceUsageHistory = [];
    this.alertThresholds = {
      responseTime: config.performance.responseTimeAlertThreshold,
      errorRate: config.performance.errorRateThreshold,
      budgetP95: config.performance.budgetP95,
      budgetP99: config.performance.budgetP99
    };
    this.eventListeners = new Map();
  }

  start() {
    if (this.isRunning) {
      console.warn('APM Monitor is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting APM Monitor...');

    this.interval = setInterval(() => {
      this.collectResourceMetrics();
      this.analyzePerformanceData();
      this.cleanupOldData();
    }, 10000);

    this.initializeProcessMonitoring();
    this.collectResourceMetrics();
  }

  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    console.log('APM Monitor stopped');
  }

  initializeProcessMonitoring() {
    process.on('exit', (code) => {
      this.recordEvent('process_exit', { code, uptime: process.uptime() });
    });

    process.on('uncaughtException', (error) => {
      this.recordEvent('uncaught_exception', {
        error: error.message,
        stack: error.stack
      });
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.recordEvent('unhandled_rejection', {
        reason: reason?.toString() || 'Unknown',
        promise: promise?.toString() || 'Unknown'
      });
    });
  }

  collectResourceMetrics() {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const heapStats = v8.getHeapStatistics();
      const heapSpaceStats = v8.getHeapSpaceStatistics();
      const loadAvg = os.loadavg();

      const resourceMetrics = {
        timestamp: new Date().toISOString(),
        pid: process.pid,
        uptime: process.uptime(),

        memory: {
          rss: memUsage.rss,
          heapTotal: memUsage.heapTotal,
          heapUsed: memUsage.heapUsed,
          external: memUsage.external,
          arrayBuffers: memUsage.arrayBuffers,
          heapUsagePercent: (memUsage.heapUsed / memUsage.heapTotal) * 100
        },

        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
          loadAverage: {
            '1m': loadAvg[0],
            '5m': loadAvg[1],
            '15m': loadAvg[2]
          }
        },

        heap: {
          totalHeapSize: heapStats.total_heap_size,
          totalHeapSizeExecutable: heapStats.total_heap_size_executable,
          totalPhysicalSize: heapStats.total_physical_size,
          totalAvailableSize: heapStats.total_available_size,
          usedHeapSize: heapStats.used_heap_size,
          heapSizeLimit: heapStats.heap_size_limit,
          mallocedMemory: heapStats.malloced_memory,
          externalMemory: heapStats.external_memory,
          peakMallocedMemory: heapStats.peak_malloced_memory,
          numberOfNativeContexts: heapStats.number_of_native_contexts,
          numberOfDetachedContexts: heapStats.number_of_detached_contexts
        },

        heapSpaces: heapSpaceStats.map(space => ({
          name: space.space_name,
          size: space.space_size,
          used: space.space_used_size,
          available: space.space_available_size,
          physicalSize: space.physical_space_size
        })),

        eventLoop: {
          lag: this.measureEventLoopLag()
        },

        gc: this.getGCMetrics(),

        handles: {
          active: process._getActiveHandles().length,
          requests: process._getActiveRequests().length
        }
      };

      this.resourceUsageHistory.push(resourceMetrics);

      if (this.resourceUsageHistory.length > 1000) {
        this.resourceUsageHistory = this.resourceUsageHistory.slice(-1000);
      }

      this.checkResourceThresholds(resourceMetrics);

      return resourceMetrics;
    } catch (error) {
      console.error('Error collecting resource metrics:', error);
      return null;
    }
  }

  measureEventLoopLag() {
    const start = process.hrtime.bigint();
    return new Promise((resolve) => {
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1000000;
        resolve(lag);
      });
    });
  }

  getGCMetrics() {
    try {
      if (typeof global.gc === 'function') {
        const beforeGC = process.memoryUsage();
        const start = process.hrtime.bigint();

        global.gc();

        const afterGC = process.memoryUsage();
        const duration = Number(process.hrtime.bigint() - start) / 1000000;

        return {
          duration,
          memoryFreed: beforeGC.heapUsed - afterGC.heapUsed,
          beforeGC,
          afterGC
        };
      }
    } catch (error) {
      return null;
    }

    return null;
  }

  startTransaction(name, operation = 'unknown', metadata = {}) {
    const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const transaction = {
      id: transactionId,
      name,
      operation,
      startTime: process.hrtime.bigint(),
      startTimestamp: new Date().toISOString(),
      metadata,
      spans: [],
      status: 'started'
    };

    this.transactionTraces.set(transactionId, transaction);
    return transactionId;
  }

  endTransaction(transactionId, status = 'success', result = {}) {
    const transaction = this.transactionTraces.get(transactionId);
    if (!transaction) {
      console.warn(`Transaction not found: ${transactionId}`);
      return null;
    }

    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - transaction.startTime) / 1000000;

    transaction.endTime = endTime;
    transaction.endTimestamp = new Date().toISOString();
    transaction.duration = duration;
    transaction.status = status;
    transaction.result = result;

    this.analyzeTransaction(transaction);

    setTimeout(() => {
      this.transactionTraces.delete(transactionId);
    }, 300000);

    return transaction;
  }

  addSpan(transactionId, name, operation, metadata = {}) {
    const transaction = this.transactionTraces.get(transactionId);
    if (!transaction) {
      console.warn(`Transaction not found for span: ${transactionId}`);
      return null;
    }

    const spanId = `span_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const span = {
      id: spanId,
      transactionId,
      name,
      operation,
      startTime: process.hrtime.bigint(),
      startTimestamp: new Date().toISOString(),
      metadata
    };

    transaction.spans.push(span);
    return spanId;
  }

  endSpan(transactionId, spanId, status = 'success', result = {}) {
    const transaction = this.transactionTraces.get(transactionId);
    if (!transaction) {
      return null;
    }

    const span = transaction.spans.find(s => s.id === spanId);
    if (!span) {
      console.warn(`Span not found: ${spanId}`);
      return null;
    }

    const endTime = process.hrtime.bigint();
    span.endTime = endTime;
    span.endTimestamp = new Date().toISOString();
    span.duration = Number(endTime - span.startTime) / 1000000;
    span.status = status;
    span.result = result;

    return span;
  }

  analyzeTransaction(transaction) {
    if (transaction.duration > this.alertThresholds.responseTime) {
      this.recordEvent('slow_transaction', {
        transaction: transaction.name,
        duration: transaction.duration,
        threshold: this.alertThresholds.responseTime,
        spans: transaction.spans.length
      });
    }

    if (transaction.status === 'error') {
      this.recordEvent('transaction_error', {
        transaction: transaction.name,
        duration: transaction.duration,
        error: transaction.result?.error || 'Unknown error'
      });
    }

    this.updatePerformanceData(transaction);
  }

  updatePerformanceData(transaction) {
    const key = `${transaction.operation}_${transaction.name}`;

    if (!this.performanceData.has(key)) {
      this.performanceData.set(key, {
        operation: transaction.operation,
        name: transaction.name,
        count: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        durations: [],
        errors: 0,
        lastUpdated: new Date().toISOString()
      });
    }

    const data = this.performanceData.get(key);
    data.count++;
    data.totalDuration += transaction.duration;
    data.minDuration = Math.min(data.minDuration, transaction.duration);
    data.maxDuration = Math.max(data.maxDuration, transaction.duration);
    data.durations.push(transaction.duration);
    data.lastUpdated = new Date().toISOString();

    if (transaction.status === 'error') {
      data.errors++;
    }

    if (data.durations.length > 1000) {
      data.durations = data.durations.slice(-1000);
    }

    data.avgDuration = data.totalDuration / data.count;
    data.errorRate = (data.errors / data.count) * 100;
    data.p95 = this.calculatePercentile(data.durations, 95);
    data.p99 = this.calculatePercentile(data.durations, 99);
  }

  calculatePercentile(values, percentile) {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  analyzePerformanceData() {
    for (const [key, data] of this.performanceData.entries()) {
      if (data.p95 > this.alertThresholds.budgetP95) {
        this.recordEvent('performance_budget_exceeded', {
          operation: key,
          p95: data.p95,
          threshold: this.alertThresholds.budgetP95,
          type: 'P95'
        });
      }

      if (data.p99 > this.alertThresholds.budgetP99) {
        this.recordEvent('performance_budget_exceeded', {
          operation: key,
          p99: data.p99,
          threshold: this.alertThresholds.budgetP99,
          type: 'P99'
        });
      }

      if (data.errorRate > this.alertThresholds.errorRate * 100) {
        this.recordEvent('high_error_rate', {
          operation: key,
          errorRate: data.errorRate,
          threshold: this.alertThresholds.errorRate * 100,
          totalRequests: data.count,
          totalErrors: data.errors
        });
      }
    }
  }

  checkResourceThresholds(metrics) {
    if (metrics.memory.heapUsagePercent > 90) {
      this.recordEvent('high_memory_usage', {
        heapUsagePercent: metrics.memory.heapUsagePercent,
        heapUsed: metrics.memory.heapUsed,
        heapTotal: metrics.memory.heapTotal
      });
    }

    if (metrics.cpu.loadAverage['1m'] > os.cpus().length * 0.8) {
      this.recordEvent('high_cpu_load', {
        loadAverage: metrics.cpu.loadAverage['1m'],
        cpuCount: os.cpus().length,
        threshold: os.cpus().length * 0.8
      });
    }

    if (metrics.eventLoop.lag > 100) {
      this.recordEvent('high_event_loop_lag', {
        lag: metrics.eventLoop.lag,
        threshold: 100
      });
    }

    if (metrics.handles.active > 1000) {
      this.recordEvent('high_handle_count', {
        activeHandles: metrics.handles.active,
        activeRequests: metrics.handles.requests,
        threshold: 1000
      });
    }
  }

  recordEvent(eventType, data) {
    const event = {
      type: eventType,
      timestamp: new Date().toISOString(),
      data
    };

    console.log(`APM Event: ${eventType}`, data);

    const listeners = this.eventListeners.get(eventType) || [];
    listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error(`Error in APM event listener for ${eventType}:`, error);
      }
    });
  }

  addEventListener(eventType, listener) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType).push(listener);
  }

  removeEventListener(eventType, listener) {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  cleanupOldData() {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000);

    for (const [key, data] of this.performanceData.entries()) {
      if (new Date(data.lastUpdated).getTime() < cutoff) {
        this.performanceData.delete(key);
      }
    }

    this.resourceUsageHistory = this.resourceUsageHistory.filter(
      metric => new Date(metric.timestamp).getTime() > cutoff
    );
  }

  getPerformanceSummary() {
    const summary = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      currentResourceUsage: this.resourceUsageHistory[this.resourceUsageHistory.length - 1],
      transactionSummary: {},
      topSlowOperations: [],
      topErrorOperations: [],
      resourceTrends: this.getResourceTrends()
    };

    for (const [key, data] of this.performanceData.entries()) {
      summary.transactionSummary[key] = {
        count: data.count,
        avgDuration: data.avgDuration,
        p95: data.p95,
        p99: data.p99,
        errorRate: data.errorRate,
        minDuration: data.minDuration,
        maxDuration: data.maxDuration
      };
    }

    summary.topSlowOperations = Array.from(this.performanceData.values())
      .sort((a, b) => b.p95 - a.p95)
      .slice(0, 10)
      .map(data => ({
        operation: `${data.operation}_${data.name}`,
        p95: data.p95,
        count: data.count
      }));

    summary.topErrorOperations = Array.from(this.performanceData.values())
      .filter(data => data.errorRate > 0)
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, 10)
      .map(data => ({
        operation: `${data.operation}_${data.name}`,
        errorRate: data.errorRate,
        errors: data.errors,
        count: data.count
      }));

    return summary;
  }

  getResourceTrends() {
    if (this.resourceUsageHistory.length < 2) {
      return null;
    }

    const recent = this.resourceUsageHistory.slice(-10);
    const memoryTrend = this.calculateTrend(recent.map(r => r.memory.heapUsagePercent));
    const cpuTrend = this.calculateTrend(recent.map(r => r.cpu.loadAverage['1m']));

    return {
      memory: {
        trend: memoryTrend,
        current: recent[recent.length - 1].memory.heapUsagePercent,
        average: recent.reduce((sum, r) => sum + r.memory.heapUsagePercent, 0) / recent.length
      },
      cpu: {
        trend: cpuTrend,
        current: recent[recent.length - 1].cpu.loadAverage['1m'],
        average: recent.reduce((sum, r) => sum + r.cpu.loadAverage['1m'], 0) / recent.length
      }
    };
  }

  calculateTrend(values) {
    if (values.length < 2) return 'stable';

    const first = values[0];
    const last = values[values.length - 1];
    const change = ((last - first) / first) * 100;

    if (change > 10) return 'increasing';
    if (change < -10) return 'decreasing';
    return 'stable';
  }

  createExpressMiddleware() {
    return (req, res, next) => {
      const transactionId = this.startTransaction(
        `${req.method} ${req.route?.path || req.path}`,
        'http_request',
        {
          method: req.method,
          url: req.url,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        }
      );

      req.apmTransactionId = transactionId;

      const originalEnd = res.end;
      res.end = function(...args) {
        const statusCode = res.statusCode;
        const status = statusCode >= 400 ? 'error' : 'success';

        this.endTransaction(transactionId, status, {
          statusCode,
          error: statusCode >= 400 ? `HTTP ${statusCode}` : undefined
        });

        originalEnd.apply(res, args);
      }.bind(this);

      next();
    };
  }
}

const apmMonitor = new APMMonitor();

module.exports = {
  apmMonitor,
  APMMonitor
};