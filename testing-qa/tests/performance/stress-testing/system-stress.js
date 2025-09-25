/**
 * K6 Stress Testing for GlobalTaxCalc System
 * Tests system behavior under extreme load conditions
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// Custom metrics
const systemErrors = new Rate('system_errors');
const responseTime = new Trend('response_time');
const memoryUsage = new Gauge('memory_usage');
const cpuUsage = new Gauge('cpu_usage');
const activeConnections = new Counter('active_connections');

// Stress test configuration
export const options = {
  stages: [
    // Gradual ramp up
    { duration: '5m', target: 100 },   // Ramp to 100 users
    { duration: '10m', target: 200 },  // Ramp to 200 users
    { duration: '15m', target: 500 },  // Ramp to 500 users (stress level)
    { duration: '20m', target: 1000 }, // Ramp to 1000 users (breaking point)
    { duration: '10m', target: 1500 }, // Push to 1500 users (extreme stress)
    { duration: '5m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(50)<3000', 'p(95)<10000'], // Relaxed thresholds for stress
    http_req_failed: ['rate<0.3'],     // Allow higher error rate under stress
    system_errors: ['rate<0.5'],       // System can have up to 50% errors under extreme stress
  },
};

const API_BASE_URL = __ENV.API_URL || 'http://localhost:3001';

// Stress test scenarios
const STRESS_SCENARIOS = [
  {
    name: 'Heavy Tax Calculation',
    weight: 40,
    endpoint: '/api/tax/calculate',
    method: 'POST',
    data: {
      income: 500000,
      filingStatus: 'married-jointly',
      state: 'CA',
      businessIncome: 200000,
      rentalIncome: 50000,
      capitalGains: {
        shortTerm: 75000,
        longTerm: 125000
      },
      deductions: {
        itemized: {
          charitable: 50000,
          medical: 25000,
          stateAndLocal: 10000,
          mortgage: 45000,
          business: 80000
        }
      },
      credits: {
        childTaxCredit: 4000,
        foreignTaxCredit: 5000
      }
    }
  },
  {
    name: 'Multi-Country Calculation',
    weight: 30,
    endpoint: '/api/tax/calculate/multi-country',
    method: 'POST',
    data: {
      countries: ['US', 'CA', 'UK'],
      income: {
        US: 80000,
        CA: 40000,
        UK: 30000
      },
      treatyBenefits: true,
      foreignTaxCredits: true
    }
  },
  {
    name: 'Document Processing',
    weight: 20,
    endpoint: '/api/documents/process',
    method: 'POST',
    data: {
      documents: [
        { type: 'w2', size: '2MB' },
        { type: '1099', size: '1MB' },
        { type: 'receipt', size: '500KB' }
      ],
      ocrEnabled: true,
      autoExtraction: true
    }
  },
  {
    name: 'Report Generation',
    weight: 10,
    endpoint: '/api/reports/generate',
    method: 'POST',
    data: {
      reportType: 'comprehensive',
      format: 'pdf',
      includeCharts: true,
      includeComparisons: true,
      years: [2022, 2023, 2024]
    }
  }
];

// Authentication tokens pool
let authTokens = [];

export function setup() {
  console.log('Setting up stress test environment...');

  // Create multiple test users for stress testing
  const userCount = 50;
  for (let i = 0; i < userCount; i++) {
    const userData = {
      email: `stress.test.${i}@globaltaxcalc.com`,
      password: 'StressTest123!',
      firstName: `Stress${i}`,
      lastName: 'TestUser',
      country: 'US'
    };

    const registerResponse = http.post(`${API_BASE_URL}/api/auth/register`, userData);

    if (registerResponse.status === 201 || registerResponse.status === 409) {
      // Login to get token
      const loginResponse = http.post(`${API_BASE_URL}/api/auth/login`, {
        email: userData.email,
        password: userData.password
      });

      if (loginResponse.status === 200) {
        const body = JSON.parse(loginResponse.body);
        authTokens.push(body.token);
      }
    }
  }

  console.log(`Created ${authTokens.length} authentication tokens for stress testing`);
  return { tokens: authTokens };
}

function getRandomToken() {
  return authTokens[Math.floor(Math.random() * authTokens.length)];
}

function selectScenario() {
  const random = Math.random() * 100;
  let cumulativeWeight = 0;

  for (const scenario of STRESS_SCENARIOS) {
    cumulativeWeight += scenario.weight;
    if (random <= cumulativeWeight) {
      return scenario;
    }
  }

  return STRESS_SCENARIOS[0]; // Fallback
}

export default function(data) {
  activeConnections.add(1);

  const token = getRandomToken();
  if (!token) {
    console.error('No authentication token available');
    return;
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  group('Stress Test Scenarios', function() {
    const scenario = selectScenario();

    console.log(`Executing stress scenario: ${scenario.name}`);

    const startTime = Date.now();
    let response;

    if (scenario.method === 'POST') {
      response = http.post(
        `${API_BASE_URL}${scenario.endpoint}`,
        JSON.stringify(scenario.data),
        { headers, timeout: '30s' }
      );
    } else {
      response = http.get(`${API_BASE_URL}${scenario.endpoint}`, { headers, timeout: '30s' });
    }

    const duration = Date.now() - startTime;
    responseTime.add(duration);

    const success = check(response, {
      'status is success or acceptable failure': (r) => {
        // Under stress, some failures are acceptable
        return r.status === 200 || r.status === 202 || r.status === 429 || r.status === 503;
      },
      'response received within timeout': (r) => duration < 30000,
    });

    systemErrors.add(!success);

    // Log performance under stress
    if (response.status === 429) {
      console.log('Rate limiting activated - system protecting itself');
    } else if (response.status === 503) {
      console.log('Service unavailable - system overloaded');
    } else if (response.status >= 500) {
      console.log(`Server error under stress: ${response.status}`);
    }

    // Monitor system resources (if available)
    group('System Resource Monitoring', function() {
      const healthResponse = http.get(`${API_BASE_URL}/api/health/detailed`, { headers });

      if (healthResponse.status === 200) {
        const healthData = JSON.parse(healthResponse.body);

        if (healthData.metrics) {
          memoryUsage.add(healthData.metrics.memoryUsage || 0);
          cpuUsage.add(healthData.metrics.cpuUsage || 0);
        }
      }
    });
  });

  // Simulate realistic user behavior under stress
  const thinkTime = Math.random() * 2; // Reduced think time under stress
  sleep(thinkTime);
}

// Spike test variation
export const spikeOptions = {
  stages: [
    { duration: '2m', target: 50 },    // Normal load
    { duration: '30s', target: 2000 }, // Sudden spike
    { duration: '3m', target: 2000 },  // Sustained spike
    { duration: '30s', target: 50 },   // Drop back
    { duration: '2m', target: 50 },    // Recovery
  ],
  thresholds: {
    http_req_duration: ['p(95)<15000'], // Very relaxed for spike
    http_req_failed: ['rate<0.8'],      // High failure rate acceptable during spike
  },
};

// Volume test variation
export const volumeOptions = {
  vus: 1000, // Constant high user count
  duration: '30m', // Extended duration
  thresholds: {
    http_req_duration: ['p(50)<5000', 'p(95)<15000'],
    http_req_failed: ['rate<0.2'],
  },
};

// Endurance test variation
export const enduranceOptions = {
  stages: [
    { duration: '10m', target: 200 },
    { duration: '2h', target: 200 },   // 2 hours at moderate load
    { duration: '10m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    http_req_failed: ['rate<0.1'],
  },
};

export function teardown(data) {
  console.log('Stress test completed. Generating final report...');

  // Optional: Get final system status
  const finalHealthResponse = http.get(`${API_BASE_URL}/api/health/detailed`);

  if (finalHealthResponse.status === 200) {
    const healthData = JSON.parse(finalHealthResponse.body);
    console.log('Final system status:', JSON.stringify(healthData, null, 2));
  }

  console.log('Stress test teardown complete.');
}