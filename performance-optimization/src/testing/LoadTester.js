const axios = require('axios');
const os = require('os');
const EventEmitter = require('events');
const cluster = require('cluster');

class LoadTester extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      baseURL: options.baseURL || 'http://localhost:3000',
      scenarios: options.scenarios || [],
      concurrent: options.concurrent || 100,
      duration: options.duration || 60,
      rampUp: options.rampUp || 10,
      workers: options.workers || os.cpus().length,
      timeout: options.timeout || 30000,
      retries: options.retries || 0,
      warmup: options.warmup || true,
      thresholds: {
        responseTime: options.thresholds?.responseTime || 1000,
        errorRate: options.thresholds?.errorRate || 0.05,
        throughput: options.thresholds?.throughput || 100
      }
    };

    this.results = {
      requests: [],
      errors: [],
      summary: {},
      workers: new Map(),
      thresholdViolations: []
    };

    this.activeConnections = 0;
    this.startTime = null;
    this.endTime = null;
    this.isRunning = false;
  }

  async runLoadTest() {
    console.log('Starting load test...');
    this.startTime = Date.now();
    this.isRunning = true;

    if (this.config.warmup) {
      await this.runWarmup();
    }

    if (cluster.isMaster) {
      return this.runMaster();
    } else {
      return this.runWorker();
    }
  }

  async runMaster() {
    console.log(`Spawning ${this.config.workers} workers...`);

    const workers = [];
    const workerResults = new Map();

    for (let i = 0; i < this.config.workers; i++) {
      const worker = cluster.fork();
      workers.push(worker);
      workerResults.set(worker.id, { requests: [], errors: [] });

      worker.on('message', (msg) => {
        if (msg.type === 'result') {
          workerResults.get(worker.id).requests.push(msg.data);
        } else if (msg.type === 'error') {
          workerResults.get(worker.id).errors.push(msg.data);
        } else if (msg.type === 'progress') {
          this.emit('progress', msg.data);
        }
      });
    }

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        console.log('Test duration reached, stopping workers...');
        workers.forEach(worker => worker.kill());

        this.aggregateResults(workerResults);
        this.isRunning = false;
        this.endTime = Date.now();

        resolve(this.generateReport());
      }, this.config.duration * 1000);
    });
  }

  async runWorker() {
    const workerId = cluster.worker.id;
    const requestsPerWorker = Math.ceil(this.config.concurrent / this.config.workers);

    console.log(`Worker ${workerId} handling ${requestsPerWorker} concurrent users`);

    for (let i = 0; i < requestsPerWorker; i++) {
      setTimeout(() => {
        this.startUserSession(workerId);
      }, (i * this.config.rampUp * 1000) / requestsPerWorker);
    }

    process.on('SIGTERM', () => {
      console.log(`Worker ${workerId} shutting down`);
      process.exit(0);
    });
  }

  async startUserSession(workerId) {
    while (this.isRunning) {
      try {
        const scenario = this.selectScenario();
        const result = await this.executeScenario(scenario);

        process.send({
          type: 'result',
          data: { ...result, workerId }
        });

        await this.sleep(this.getThinkTime());
      } catch (error) {
        process.send({
          type: 'error',
          data: { error: error.message, workerId, timestamp: Date.now() }
        });
      }
    }
  }

  selectScenario() {
    if (this.config.scenarios.length === 0) {
      return this.getDefaultScenario();
    }

    const totalWeight = this.config.scenarios.reduce((sum, s) => sum + (s.weight || 1), 0);
    let random = Math.random() * totalWeight;

    for (const scenario of this.config.scenarios) {
      random -= (scenario.weight || 1);
      if (random <= 0) {
        return scenario;
      }
    }

    return this.config.scenarios[0];
  }

  getDefaultScenario() {
    return {
      name: 'default',
      requests: [
        { method: 'GET', path: '/', name: 'homepage' },
        { method: 'GET', path: '/api/health', name: 'health_check' }
      ]
    };
  }

  async executeScenario(scenario) {
    const scenarioStart = Date.now();
    const requests = [];

    for (const request of scenario.requests) {
      const requestResult = await this.executeRequest(request);
      requests.push(requestResult);

      if (requestResult.error) {
        break;
      }
    }

    return {
      scenario: scenario.name,
      duration: Date.now() - scenarioStart,
      requests,
      success: requests.every(r => !r.error)
    };
  }

  async executeRequest(request) {
    const startTime = Date.now();

    try {
      const config = {
        method: request.method || 'GET',
        url: `${this.config.baseURL}${request.path}`,
        timeout: this.config.timeout,
        headers: request.headers || {},
        data: request.data,
        params: request.params
      };

      const response = await axios(config);
      const endTime = Date.now();

      return {
        name: request.name,
        method: request.method,
        path: request.path,
        statusCode: response.status,
        responseTime: endTime - startTime,
        responseSize: JSON.stringify(response.data).length,
        timestamp: startTime,
        success: true
      };
    } catch (error) {
      const endTime = Date.now();

      return {
        name: request.name,
        method: request.method,
        path: request.path,
        statusCode: error.response?.status || 0,
        responseTime: endTime - startTime,
        error: error.message,
        timestamp: startTime,
        success: false
      };
    }
  }

  async runWarmup() {
    console.log('Running warmup...');

    const warmupRequests = 10;
    for (let i = 0; i < warmupRequests; i++) {
      try {
        await axios.get(`${this.config.baseURL}/api/health`, { timeout: 5000 });
      } catch (error) {
        console.warn('Warmup request failed:', error.message);
      }
    }

    console.log('Warmup completed');
  }

  aggregateResults(workerResults) {
    const allRequests = [];
    const allErrors = [];

    for (const [workerId, data] of workerResults) {
      allRequests.push(...data.requests);
      allErrors.push(...data.errors);
      this.results.workers.set(workerId, data);
    }

    this.results.requests = allRequests;
    this.results.errors = allErrors;
    this.calculateSummary();
    this.checkThresholds();
  }

  calculateSummary() {
    const requests = this.results.requests.flatMap(r => r.requests);
    const successful = requests.filter(r => r.success);
    const failed = requests.filter(r => !r.success);

    const responseTimes = successful.map(r => r.responseTime);
    const totalDuration = (this.endTime - this.startTime) / 1000;

    this.results.summary = {
      totalRequests: requests.length,
      successfulRequests: successful.length,
      failedRequests: failed.length,
      errorRate: failed.length / requests.length,
      throughput: requests.length / totalDuration,
      averageResponseTime: this.average(responseTimes),
      medianResponseTime: this.percentile(responseTimes, 50),
      p95ResponseTime: this.percentile(responseTimes, 95),
      p99ResponseTime: this.percentile(responseTimes, 99),
      minResponseTime: Math.min(...responseTimes),
      maxResponseTime: Math.max(...responseTimes),
      totalDuration,
      requestsPerSecond: requests.length / totalDuration,
      dataTransferred: successful.reduce((sum, r) => sum + (r.responseSize || 0), 0)
    };
  }

  checkThresholds() {
    const summary = this.results.summary;
    const violations = [];

    if (summary.averageResponseTime > this.config.thresholds.responseTime) {
      violations.push({
        metric: 'averageResponseTime',
        actual: summary.averageResponseTime,
        threshold: this.config.thresholds.responseTime,
        severity: 'critical'
      });
    }

    if (summary.errorRate > this.config.thresholds.errorRate) {
      violations.push({
        metric: 'errorRate',
        actual: summary.errorRate,
        threshold: this.config.thresholds.errorRate,
        severity: 'critical'
      });
    }

    if (summary.throughput < this.config.thresholds.throughput) {
      violations.push({
        metric: 'throughput',
        actual: summary.throughput,
        threshold: this.config.thresholds.throughput,
        severity: 'warning'
      });
    }

    this.results.thresholdViolations = violations;
  }

  generateReport() {
    const report = {
      testConfig: this.config,
      summary: this.results.summary,
      thresholdViolations: this.results.thresholdViolations,
      passed: this.results.thresholdViolations.length === 0,
      timestamp: new Date().toISOString()
    };

    console.log('\n=== LOAD TEST REPORT ===');
    console.log(`Total Requests: ${report.summary.totalRequests}`);
    console.log(`Successful: ${report.summary.successfulRequests}`);
    console.log(`Failed: ${report.summary.failedRequests}`);
    console.log(`Error Rate: ${(report.summary.errorRate * 100).toFixed(2)}%`);
    console.log(`Throughput: ${report.summary.throughput.toFixed(2)} req/s`);
    console.log(`Avg Response Time: ${report.summary.averageResponseTime.toFixed(2)}ms`);
    console.log(`95th Percentile: ${report.summary.p95ResponseTime.toFixed(2)}ms`);

    if (report.thresholdViolations.length > 0) {
      console.log('\n⚠️  THRESHOLD VIOLATIONS:');
      report.thresholdViolations.forEach(v => {
        console.log(`- ${v.metric}: ${v.actual} (threshold: ${v.threshold})`);
      });
    } else {
      console.log('\n✅ All thresholds passed!');
    }

    return report;
  }

  average(arr) {
    return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }

  percentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  getThinkTime() {
    return Math.random() * 2000 + 1000;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = LoadTester;