const fs = require('fs').promises;
const path = require('path');
const { Transform } = require('stream');
const readline = require('readline');
const config = require('../config');

class LogAggregator {
  constructor() {
    this.logDir = config.logging.dir;
    this.aggregationIntervals = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000
    };
    this.isRunning = false;
    this.intervals = new Map();
  }

  start() {
    if (this.isRunning) {
      console.warn('Log aggregator is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting log aggregator...');

    Object.entries(this.aggregationIntervals).forEach(([period, interval]) => {
      const intervalId = setInterval(async () => {
        try {
          await this.aggregateLogs(period);
        } catch (error) {
          console.error(`Error aggregating logs for period ${period}:`, error);
        }
      }, interval);

      this.intervals.set(period, intervalId);
    });

    this.aggregateLogs('1m');
  }

  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.intervals.forEach(intervalId => clearInterval(intervalId));
    this.intervals.clear();
    console.log('Log aggregator stopped');
  }

  async aggregateLogs(period) {
    try {
      const now = new Date();
      const endTime = new Date(Math.floor(now.getTime() / this.aggregationIntervals[period]) * this.aggregationIntervals[period]);
      const startTime = new Date(endTime.getTime() - this.aggregationIntervals[period]);

      const aggregation = await this.processLogsForPeriod(startTime, endTime, period);
      await this.saveAggregation(aggregation, period, endTime);

      console.log(`Log aggregation completed for period ${period}: ${startTime.toISOString()} - ${endTime.toISOString()}`);
    } catch (error) {
      console.error(`Failed to aggregate logs for period ${period}:`, error);
    }
  }

  async processLogsForPeriod(startTime, endTime, period) {
    const logFiles = await this.getLogFilesForPeriod(startTime, endTime);
    const aggregation = {
      period,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      totalEvents: 0,
      errorCount: 0,
      warnCount: 0,
      infoCount: 0,
      debugCount: 0,
      httpRequests: {
        total: 0,
        byStatusCode: {},
        byMethod: {},
        avgResponseTime: 0,
        errorRate: 0
      },
      businessEvents: {
        total: 0,
        byType: {},
        revenue: 0,
        calculations: 0,
        conversions: 0
      },
      performance: {
        avgDuration: 0,
        slowOperations: [],
        dbQueries: {
          total: 0,
          avgDuration: 0,
          slowQueries: []
        }
      },
      errors: {
        total: 0,
        byType: {},
        topErrors: []
      },
      topIPs: {},
      topUserAgents: {},
      uniqueUsers: new Set(),
      securityEvents: []
    };

    for (const logFile of logFiles) {
      await this.processLogFile(logFile, aggregation, startTime, endTime);
    }

    aggregation.uniqueUsers = aggregation.uniqueUsers.size;
    this.calculateDerivedMetrics(aggregation);

    return aggregation;
  }

  async processLogFile(filePath, aggregation, startTime, endTime) {
    try {
      const fileStream = require('fs').createReadStream(filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      for await (const line of rl) {
        try {
          const logEntry = JSON.parse(line);
          const logTime = new Date(logEntry.timestamp);

          if (logTime >= startTime && logTime < endTime) {
            this.processLogEntry(logEntry, aggregation);
          }
        } catch (parseError) {
          continue;
        }
      }
    } catch (error) {
      console.warn(`Could not process log file ${filePath}:`, error.message);
    }
  }

  processLogEntry(entry, aggregation) {
    aggregation.totalEvents++;

    switch (entry.level) {
      case 'error':
        aggregation.errorCount++;
        break;
      case 'warn':
        aggregation.warnCount++;
        break;
      case 'info':
        aggregation.infoCount++;
        break;
      case 'debug':
        aggregation.debugCount++;
        break;
    }

    if (entry.type === 'request' && entry.method && entry.statusCode) {
      this.processRequestLog(entry, aggregation);
    } else if (entry.type === 'business') {
      this.processBusinessLog(entry, aggregation);
    } else if (entry.type === 'performance') {
      this.processPerformanceLog(entry, aggregation);
    } else if (entry.level === 'error') {
      this.processErrorLog(entry, aggregation);
    }

    if (entry.ip) {
      aggregation.topIPs[entry.ip] = (aggregation.topIPs[entry.ip] || 0) + 1;
    }

    if (entry.userAgent) {
      aggregation.topUserAgents[entry.userAgent] = (aggregation.topUserAgents[entry.userAgent] || 0) + 1;
    }

    if (entry.userId) {
      aggregation.uniqueUsers.add(entry.userId);
    }

    if (entry.event && entry.event.includes('security')) {
      aggregation.securityEvents.push({
        timestamp: entry.timestamp,
        event: entry.event,
        details: entry
      });
    }
  }

  processRequestLog(entry, aggregation) {
    aggregation.httpRequests.total++;

    const statusCode = entry.statusCode.toString();
    aggregation.httpRequests.byStatusCode[statusCode] = (aggregation.httpRequests.byStatusCode[statusCode] || 0) + 1;

    aggregation.httpRequests.byMethod[entry.method] = (aggregation.httpRequests.byMethod[entry.method] || 0) + 1;

    if (entry.responseTime) {
      const currentAvg = aggregation.httpRequests.avgResponseTime;
      const count = aggregation.httpRequests.total;
      aggregation.httpRequests.avgResponseTime = (currentAvg * (count - 1) + entry.responseTime) / count;
    }
  }

  processBusinessLog(entry, aggregation) {
    aggregation.businessEvents.total++;

    if (entry.event) {
      aggregation.businessEvents.byType[entry.event] = (aggregation.businessEvents.byType[entry.event] || 0) + 1;
    }

    if (entry.revenue) {
      aggregation.businessEvents.revenue += entry.revenue;
    }

    if (entry.event === 'calculation') {
      aggregation.businessEvents.calculations++;
    }

    if (entry.event === 'conversion') {
      aggregation.businessEvents.conversions++;
    }
  }

  processPerformanceLog(entry, aggregation) {
    if (entry.duration) {
      const currentAvg = aggregation.performance.avgDuration;
      const currentCount = aggregation.performance.slowOperations.length + 1;
      aggregation.performance.avgDuration = (currentAvg * (currentCount - 1) + entry.duration) / currentCount;

      if (entry.duration > 1000) {
        aggregation.performance.slowOperations.push({
          operation: entry.operation,
          duration: entry.duration,
          timestamp: entry.timestamp
        });
      }
    }

    if (entry.operation && entry.operation.includes('database')) {
      aggregation.performance.dbQueries.total++;

      if (entry.duration) {
        const currentAvg = aggregation.performance.dbQueries.avgDuration;
        const count = aggregation.performance.dbQueries.total;
        aggregation.performance.dbQueries.avgDuration = (currentAvg * (count - 1) + entry.duration) / count;

        if (entry.duration > 500) {
          aggregation.performance.dbQueries.slowQueries.push({
            query: entry.query,
            duration: entry.duration,
            timestamp: entry.timestamp
          });
        }
      }
    }
  }

  processErrorLog(entry, aggregation) {
    aggregation.errors.total++;

    const errorType = entry.error || entry.message || 'Unknown Error';
    aggregation.errors.byType[errorType] = (aggregation.errors.byType[errorType] || 0) + 1;

    aggregation.errors.topErrors.push({
      error: errorType,
      timestamp: entry.timestamp,
      stack: entry.stack,
      url: entry.url,
      method: entry.method
    });
  }

  calculateDerivedMetrics(aggregation) {
    const totalRequests = aggregation.httpRequests.total;
    const errorRequests = Object.entries(aggregation.httpRequests.byStatusCode)
      .filter(([code]) => code.startsWith('4') || code.startsWith('5'))
      .reduce((sum, [, count]) => sum + count, 0);

    aggregation.httpRequests.errorRate = totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;

    aggregation.topIPs = Object.entries(aggregation.topIPs)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .reduce((obj, [ip, count]) => ({ ...obj, [ip]: count }), {});

    aggregation.topUserAgents = Object.entries(aggregation.topUserAgents)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .reduce((obj, [ua, count]) => ({ ...obj, [ua]: count }), {});

    aggregation.performance.slowOperations = aggregation.performance.slowOperations
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 20);

    aggregation.performance.dbQueries.slowQueries = aggregation.performance.dbQueries.slowQueries
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 20);

    aggregation.errors.topErrors = aggregation.errors.topErrors
      .slice(-50);
  }

  async getLogFilesForPeriod(startTime, endTime) {
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = [];

      for (const file of files) {
        if (file.endsWith('.log') && !file.includes('aggregation')) {
          const filePath = path.join(this.logDir, file);
          const stats = await fs.stat(filePath);

          if (stats.mtime >= startTime && stats.mtime <= endTime) {
            logFiles.push(filePath);
          }
        }
      }

      return logFiles;
    } catch (error) {
      console.warn('Error reading log directory:', error);
      return [];
    }
  }

  async saveAggregation(aggregation, period, timestamp) {
    try {
      const filename = `aggregation-${period}-${timestamp.toISOString().replace(/[:.]/g, '-')}.json`;
      const filePath = path.join(this.logDir, filename);

      await fs.writeFile(filePath, JSON.stringify(aggregation, null, 2));
      console.log(`Aggregation saved: ${filename}`);
    } catch (error) {
      console.error('Failed to save aggregation:', error);
    }
  }

  async getAggregations(period, limit = 24) {
    try {
      const files = await fs.readdir(this.logDir);
      const aggregationFiles = files
        .filter(file => file.startsWith(`aggregation-${period}-`) && file.endsWith('.json'))
        .sort()
        .slice(-limit);

      const aggregations = [];
      for (const file of aggregationFiles) {
        try {
          const content = await fs.readFile(path.join(this.logDir, file), 'utf8');
          aggregations.push(JSON.parse(content));
        } catch (error) {
          console.warn(`Could not read aggregation file ${file}:`, error);
        }
      }

      return aggregations;
    } catch (error) {
      console.error('Error getting aggregations:', error);
      return [];
    }
  }

  async getMetricsSummary() {
    try {
      const recent1m = await this.getAggregations('1m', 5);
      const recent1h = await this.getAggregations('1h', 24);

      return {
        recent5Minutes: recent1m,
        recent24Hours: recent1h,
        summary: {
          totalRequests: recent1h.reduce((sum, agg) => sum + agg.httpRequests.total, 0),
          avgErrorRate: recent1h.reduce((sum, agg) => sum + agg.httpRequests.errorRate, 0) / recent1h.length,
          totalErrors: recent1h.reduce((sum, agg) => sum + agg.errors.total, 0),
          avgResponseTime: recent1h.reduce((sum, agg) => sum + agg.httpRequests.avgResponseTime, 0) / recent1h.length,
          totalRevenue: recent1h.reduce((sum, agg) => sum + agg.businessEvents.revenue, 0),
          totalCalculations: recent1h.reduce((sum, agg) => sum + agg.businessEvents.calculations, 0)
        }
      };
    } catch (error) {
      console.error('Error generating metrics summary:', error);
      return null;
    }
  }
}

module.exports = LogAggregator;