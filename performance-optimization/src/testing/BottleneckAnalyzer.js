const EventEmitter = require('events');
const os = require('os');

class BottleneckAnalyzer extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      samplingInterval: options.samplingInterval || 1000,
      analysisWindow: options.analysisWindow || 60000,
      thresholds: {
        cpuUsage: options.thresholds?.cpuUsage || 80,
        memoryUsage: options.thresholds?.memoryUsage || 85,
        responseTime: options.thresholds?.responseTime || 1000,
        errorRate: options.thresholds?.errorRate || 0.05,
        queueDepth: options.thresholds?.queueDepth || 100,
        connectionCount: options.thresholds?.connectionCount || 1000
      },
      ...options
    };

    this.metrics = {
      system: [],
      application: [],
      requests: [],
      database: [],
      cache: []
    };

    this.bottlenecks = [];
    this.isMonitoring = false;
    this.monitoringInterval = null;
  }

  startMonitoring() {
    if (this.isMonitoring) {
      return;
    }

    console.log('🔍 Starting bottleneck monitoring...');
    this.isMonitoring = true;

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.analyzeBottlenecks();
      this.cleanupOldMetrics();
    }, this.config.samplingInterval);

    this.emit('monitoring_started');
  }

  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    console.log('⏹️  Stopping bottleneck monitoring...');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.emit('monitoring_stopped');
  }

  collectMetrics() {
    const timestamp = Date.now();

    this.collectSystemMetrics(timestamp);
    this.collectApplicationMetrics(timestamp);
  }

  collectSystemMetrics(timestamp) {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const loadAvg = os.loadavg();

    const systemMetrics = {
      timestamp,
      cpu: {
        count: cpus.length,
        loadAverage: loadAvg,
        usage: this.calculateCPUUsage()
      },
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        usage: ((totalMem - freeMem) / totalMem) * 100
      },
      uptime: os.uptime()
    };

    this.metrics.system.push(systemMetrics);
  }

  collectApplicationMetrics(timestamp) {
    const memUsage = process.memoryUsage();

    const appMetrics = {
      timestamp,
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        heapUsage: (memUsage.heapUsed / memUsage.heapTotal) * 100
      },
      eventLoop: this.measureEventLoopLag(),
      activeHandles: process._getActiveHandles().length,
      activeRequests: process._getActiveRequests().length
    };

    this.metrics.application.push(appMetrics);
  }

  calculateCPUUsage() {
    return new Promise((resolve) => {
      const startMeasure = this.getCPUInfo();

      setTimeout(() => {
        const endMeasure = this.getCPUInfo();
        const idleDifference = endMeasure.idle - startMeasure.idle;
        const totalDifference = endMeasure.total - startMeasure.total;
        const usage = 100 - ~~(100 * idleDifference / totalDifference);
        resolve(usage);
      }, 100);
    });
  }

  getCPUInfo() {
    const cpus = os.cpus();
    let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;

    for (const cpu of cpus) {
      user += cpu.times.user;
      nice += cpu.times.nice;
      sys += cpu.times.sys;
      idle += cpu.times.idle;
      irq += cpu.times.irq;
    }

    return {
      idle: idle,
      total: user + nice + sys + idle + irq
    };
  }

  measureEventLoopLag() {
    const start = process.hrtime.bigint();

    return new Promise((resolve) => {
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1e6;
        resolve(lag);
      });
    });
  }

  analyzeBottlenecks() {
    const currentTime = Date.now();
    const windowStart = currentTime - this.config.analysisWindow;

    this.analyzeSystemBottlenecks(windowStart, currentTime);
    this.analyzeApplicationBottlenecks(windowStart, currentTime);
    this.analyzeRequestBottlenecks(windowStart, currentTime);

    this.emit('analysis_complete', {
      timestamp: currentTime,
      bottlenecks: this.getActiveBottlenecks()
    });
  }

  analyzeSystemBottlenecks(windowStart, currentTime) {
    const recentMetrics = this.metrics.system.filter(m => m.timestamp >= windowStart);

    if (recentMetrics.length === 0) return;

    const avgCPUUsage = this.average(recentMetrics.map(m => m.cpu.usage));
    const avgMemoryUsage = this.average(recentMetrics.map(m => m.memory.usage));
    const avgLoadAvg = this.average(recentMetrics.map(m => m.cpu.loadAverage[0]));

    if (avgCPUUsage > this.config.thresholds.cpuUsage) {
      this.addBottleneck({
        type: 'system',
        component: 'cpu',
        severity: this.getSeverity(avgCPUUsage, this.config.thresholds.cpuUsage),
        metric: 'cpu_usage',
        value: avgCPUUsage,
        threshold: this.config.thresholds.cpuUsage,
        description: `High CPU usage detected: ${avgCPUUsage.toFixed(2)}%`,
        recommendations: [
          'Consider scaling horizontally',
          'Optimize CPU-intensive operations',
          'Review algorithm efficiency',
          'Enable CPU profiling'
        ],
        timestamp: currentTime
      });
    }

    if (avgMemoryUsage > this.config.thresholds.memoryUsage) {
      this.addBottleneck({
        type: 'system',
        component: 'memory',
        severity: this.getSeverity(avgMemoryUsage, this.config.thresholds.memoryUsage),
        metric: 'memory_usage',
        value: avgMemoryUsage,
        threshold: this.config.thresholds.memoryUsage,
        description: `High memory usage detected: ${avgMemoryUsage.toFixed(2)}%`,
        recommendations: [
          'Check for memory leaks',
          'Optimize data structures',
          'Implement garbage collection tuning',
          'Consider increasing memory allocation'
        ],
        timestamp: currentTime
      });
    }

    const cpuCount = os.cpus().length;
    if (avgLoadAvg > cpuCount * 0.8) {
      this.addBottleneck({
        type: 'system',
        component: 'load',
        severity: 'warning',
        metric: 'load_average',
        value: avgLoadAvg,
        threshold: cpuCount * 0.8,
        description: `High system load: ${avgLoadAvg.toFixed(2)} (${cpuCount} cores)`,
        recommendations: [
          'Review concurrent processes',
          'Optimize I/O operations',
          'Consider load balancing',
          'Monitor disk I/O'
        ],
        timestamp: currentTime
      });
    }
  }

  analyzeApplicationBottlenecks(windowStart, currentTime) {
    const recentMetrics = this.metrics.application.filter(m => m.timestamp >= windowStart);

    if (recentMetrics.length === 0) return;

    const avgHeapUsage = this.average(recentMetrics.map(m => m.memory.heapUsage));
    const avgEventLoopLag = this.average(recentMetrics.map(m => m.eventLoop || 0));
    const avgActiveHandles = this.average(recentMetrics.map(m => m.activeHandles));

    if (avgHeapUsage > 85) {
      this.addBottleneck({
        type: 'application',
        component: 'memory',
        severity: this.getSeverity(avgHeapUsage, 85),
        metric: 'heap_usage',
        value: avgHeapUsage,
        threshold: 85,
        description: `High heap usage: ${avgHeapUsage.toFixed(2)}%`,
        recommendations: [
          'Check for memory leaks in application code',
          'Optimize object creation patterns',
          'Review caching strategies',
          'Consider heap size tuning'
        ],
        timestamp: currentTime
      });
    }

    if (avgEventLoopLag > 10) {
      this.addBottleneck({
        type: 'application',
        component: 'event_loop',
        severity: this.getSeverity(avgEventLoopLag, 10),
        metric: 'event_loop_lag',
        value: avgEventLoopLag,
        threshold: 10,
        description: `High event loop lag: ${avgEventLoopLag.toFixed(2)}ms`,
        recommendations: [
          'Identify blocking operations',
          'Move CPU-intensive tasks to worker threads',
          'Optimize synchronous operations',
          'Review Promise handling'
        ],
        timestamp: currentTime
      });
    }

    if (avgActiveHandles > 1000) {
      this.addBottleneck({
        type: 'application',
        component: 'handles',
        severity: 'warning',
        metric: 'active_handles',
        value: avgActiveHandles,
        threshold: 1000,
        description: `High number of active handles: ${avgActiveHandles.toFixed(0)}`,
        recommendations: [
          'Check for unclosed connections',
          'Review file handle management',
          'Implement connection pooling',
          'Monitor resource cleanup'
        ],
        timestamp: currentTime
      });
    }
  }

  analyzeRequestBottlenecks(windowStart, currentTime) {
    const recentRequests = this.metrics.requests.filter(m => m.timestamp >= windowStart);

    if (recentRequests.length === 0) return;

    const avgResponseTime = this.average(recentRequests.map(r => r.responseTime));
    const errorRate = recentRequests.filter(r => r.error).length / recentRequests.length;
    const queueDepth = recentRequests.filter(r => r.queued).length;

    if (avgResponseTime > this.config.thresholds.responseTime) {
      this.addBottleneck({
        type: 'application',
        component: 'response_time',
        severity: this.getSeverity(avgResponseTime, this.config.thresholds.responseTime),
        metric: 'response_time',
        value: avgResponseTime,
        threshold: this.config.thresholds.responseTime,
        description: `High response time: ${avgResponseTime.toFixed(2)}ms`,
        recommendations: [
          'Optimize database queries',
          'Review API endpoint performance',
          'Implement caching strategies',
          'Check for external service delays'
        ],
        timestamp: currentTime
      });
    }

    if (errorRate > this.config.thresholds.errorRate) {
      this.addBottleneck({
        type: 'application',
        component: 'errors',
        severity: 'critical',
        metric: 'error_rate',
        value: errorRate * 100,
        threshold: this.config.thresholds.errorRate * 100,
        description: `High error rate: ${(errorRate * 100).toFixed(2)}%`,
        recommendations: [
          'Review application logs',
          'Check database connectivity',
          'Validate input handling',
          'Monitor external dependencies'
        ],
        timestamp: currentTime
      });
    }

    if (queueDepth > this.config.thresholds.queueDepth) {
      this.addBottleneck({
        type: 'application',
        component: 'queue',
        severity: 'warning',
        metric: 'queue_depth',
        value: queueDepth,
        threshold: this.config.thresholds.queueDepth,
        description: `High queue depth: ${queueDepth} requests`,
        recommendations: [
          'Increase worker processes',
          'Optimize request processing',
          'Implement request prioritization',
          'Review load balancing'
        ],
        timestamp: currentTime
      });
    }
  }

  addBottleneck(bottleneck) {
    const existing = this.bottlenecks.find(b =>
      b.type === bottleneck.type &&
      b.component === bottleneck.component &&
      b.metric === bottleneck.metric
    );

    if (existing) {
      existing.value = bottleneck.value;
      existing.timestamp = bottleneck.timestamp;
      existing.occurrences = (existing.occurrences || 1) + 1;
    } else {
      bottleneck.id = this.generateBottleneckId();
      bottleneck.occurrences = 1;
      bottleneck.firstSeen = bottleneck.timestamp;
      this.bottlenecks.push(bottleneck);
    }

    this.emit('bottleneck_detected', bottleneck);
  }

  getActiveBottlenecks() {
    const currentTime = Date.now();
    const staleThreshold = this.config.analysisWindow * 2;

    return this.bottlenecks.filter(b =>
      currentTime - b.timestamp < staleThreshold
    );
  }

  getSeverity(value, threshold) {
    const ratio = value / threshold;

    if (ratio >= 2) return 'critical';
    if (ratio >= 1.5) return 'high';
    if (ratio >= 1.2) return 'medium';
    if (ratio >= 1) return 'warning';
    return 'info';
  }

  generateBottleneckId() {
    return Math.random().toString(36).substr(2, 9);
  }

  addRequestMetric(requestData) {
    this.metrics.requests.push({
      timestamp: Date.now(),
      ...requestData
    });
  }

  addDatabaseMetric(dbData) {
    this.metrics.database.push({
      timestamp: Date.now(),
      ...dbData
    });
  }

  addCacheMetric(cacheData) {
    this.metrics.cache.push({
      timestamp: Date.now(),
      ...cacheData
    });
  }

  cleanupOldMetrics() {
    const cutoff = Date.now() - (this.config.analysisWindow * 2);

    this.metrics.system = this.metrics.system.filter(m => m.timestamp > cutoff);
    this.metrics.application = this.metrics.application.filter(m => m.timestamp > cutoff);
    this.metrics.requests = this.metrics.requests.filter(m => m.timestamp > cutoff);
    this.metrics.database = this.metrics.database.filter(m => m.timestamp > cutoff);
    this.metrics.cache = this.metrics.cache.filter(m => m.timestamp > cutoff);

    this.bottlenecks = this.bottlenecks.filter(b =>
      Date.now() - b.timestamp < this.config.analysisWindow * 4
    );
  }

  generateReport() {
    const activeBottlenecks = this.getActiveBottlenecks();
    const severityGroups = this.groupBySeverity(activeBottlenecks);

    return {
      summary: {
        totalBottlenecks: activeBottlenecks.length,
        criticalIssues: severityGroups.critical?.length || 0,
        highPriorityIssues: severityGroups.high?.length || 0,
        warningIssues: severityGroups.warning?.length || 0,
        status: this.getOverallStatus(activeBottlenecks)
      },
      bottlenecks: activeBottlenecks,
      severityBreakdown: severityGroups,
      recommendations: this.generateGlobalRecommendations(activeBottlenecks),
      metrics: this.getMetricsSummary(),
      timestamp: Date.now()
    };
  }

  groupBySeverity(bottlenecks) {
    return bottlenecks.reduce((groups, bottleneck) => {
      const severity = bottleneck.severity;
      if (!groups[severity]) {
        groups[severity] = [];
      }
      groups[severity].push(bottleneck);
      return groups;
    }, {});
  }

  getOverallStatus(bottlenecks) {
    if (bottlenecks.some(b => b.severity === 'critical')) return 'CRITICAL';
    if (bottlenecks.some(b => b.severity === 'high')) return 'HIGH_RISK';
    if (bottlenecks.some(b => b.severity === 'warning')) return 'WARNING';
    return 'HEALTHY';
  }

  generateGlobalRecommendations(bottlenecks) {
    const recommendations = [];
    const issueTypes = [...new Set(bottlenecks.map(b => b.component))];

    if (issueTypes.includes('cpu') && issueTypes.includes('memory')) {
      recommendations.push({
        priority: 'high',
        category: 'infrastructure',
        title: 'Resource Scaling Required',
        description: 'Both CPU and memory bottlenecks detected. Consider vertical or horizontal scaling.',
        actions: ['Scale server resources', 'Implement auto-scaling', 'Review resource allocation']
      });
    }

    if (issueTypes.includes('response_time') && issueTypes.includes('queue')) {
      recommendations.push({
        priority: 'high',
        category: 'performance',
        title: 'Request Processing Bottleneck',
        description: 'High response times and queue depth indicate processing bottleneck.',
        actions: ['Optimize critical paths', 'Increase worker processes', 'Implement request prioritization']
      });
    }

    return recommendations;
  }

  getMetricsSummary() {
    const recentSystem = this.metrics.system.slice(-10);
    const recentApp = this.metrics.application.slice(-10);

    return {
      system: {
        avgCpuUsage: this.average(recentSystem.map(m => m.cpu.usage)),
        avgMemoryUsage: this.average(recentSystem.map(m => m.memory.usage)),
        currentLoadAvg: recentSystem[recentSystem.length - 1]?.cpu.loadAverage[0] || 0
      },
      application: {
        avgHeapUsage: this.average(recentApp.map(m => m.memory.heapUsage)),
        avgEventLoopLag: this.average(recentApp.map(m => m.eventLoop || 0)),
        activeHandles: recentApp[recentApp.length - 1]?.activeHandles || 0
      }
    };
  }

  average(arr) {
    return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }
}

module.exports = BottleneckAnalyzer;