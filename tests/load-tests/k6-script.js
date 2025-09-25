import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomString, randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
export let errorRate = new Rate('errors');
export let calculationDuration = new Trend('calculation_duration');
export let reportGenerationDuration = new Trend('report_generation_duration');
export let totalRequests = new Counter('total_requests');

// Test configuration
export let options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up to 10 users
    { duration: '5m', target: 10 },   // Stay at 10 users
    { duration: '2m', target: 25 },   // Ramp up to 25 users
    { duration: '5m', target: 25 },   // Stay at 25 users
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '3m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s
    http_req_failed: ['rate<0.05'],    // Error rate must be below 5%
    calculation_duration: ['p(95)<3000'], // Tax calculations under 3s
    report_generation_duration: ['p(95)<10000'], // Report generation under 10s
  },
};

// Test data
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const countries = ['US', 'CA', 'UK', 'DE', 'FR'];
const filingStatuses = ['single', 'married', 'head_of_household'];

// Test user pool
const testUsers = [
  { email: 'user1@test.com', password: 'TestPassword123!' },
  { email: 'user2@test.com', password: 'TestPassword123!' },
  { email: 'user3@test.com', password: 'TestPassword123!' },
  { email: 'user4@test.com', password: 'TestPassword123!' },
  { email: 'user5@test.com', password: 'TestPassword123!' },
];

export default function () {
  totalRequests.add(1);

  // Random user selection
  const user = randomItem(testUsers);
  let authToken;

  group('Authentication Flow', function () {
    // Login
    const loginResponse = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
      email: user.email,
      password: user.password
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

    const loginSuccess = check(loginResponse, {
      'login status is 200': (r) => r.status === 200,
      'login has token': (r) => r.json().hasOwnProperty('token'),
      'login response time < 500ms': (r) => r.timings.duration < 500,
    });

    if (loginSuccess) {
      authToken = loginResponse.json().token;
    } else {
      errorRate.add(1);
      return; // Skip rest of test if login fails
    }
  });

  // Main test flows - randomly select one
  const testScenarios = [
    () => taxCalculationFlow(authToken),
    () => multiCountryComparisonFlow(authToken),
    () => reportGenerationFlow(authToken),
    () => fileUploadFlow(authToken),
  ];

  const selectedScenario = randomItem(testScenarios);
  selectedScenario();

  sleep(randomIntBetween(1, 3)); // Random think time
}

function taxCalculationFlow(authToken) {
  group('Tax Calculation Flow', function () {
    const calculationData = {
      income: randomIntBetween(30000, 150000),
      country: randomItem(countries),
      filingStatus: randomItem(filingStatuses),
      year: 2023,
      deductions: [
        { type: 'standard', amount: 12950 },
        { type: 'charitable', amount: randomIntBetween(0, 5000) }
      ]
    };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    };

    // Create calculation
    const calculationStart = Date.now();
    const calcResponse = http.post(
      `${BASE_URL}/api/calculations`,
      JSON.stringify(calculationData),
      { headers }
    );

    const calculationTime = Date.now() - calculationStart;
    calculationDuration.add(calculationTime);

    const calcSuccess = check(calcResponse, {
      'calculation status is 201': (r) => r.status === 201,
      'calculation has result': (r) => r.json().hasOwnProperty('result'),
      'calculation has total tax': (r) => r.json().result.hasOwnProperty('totalTax'),
      'total tax is positive': (r) => r.json().result.totalTax >= 0,
    });

    if (!calcSuccess) {
      errorRate.add(1);
      return;
    }

    const calculationId = calcResponse.json().calculationId;

    // Retrieve calculation
    const retrieveResponse = http.get(
      `${BASE_URL}/api/calculations/${calculationId}`,
      { headers }
    );

    check(retrieveResponse, {
      'retrieve status is 200': (r) => r.status === 200,
      'retrieve has same calculation ID': (r) => r.json().calculationId === calculationId,
    });

    // List calculations
    const listResponse = http.get(`${BASE_URL}/api/calculations`, { headers });

    check(listResponse, {
      'list status is 200': (r) => r.status === 200,
      'list has calculations array': (r) => Array.isArray(r.json().calculations),
    });
  });
}

function multiCountryComparisonFlow(authToken) {
  group('Multi-Country Comparison Flow', function () {
    const comparisonData = {
      scenarios: [
        {
          country: 'US',
          income: randomIntBetween(50000, 100000),
          filingStatus: 'single'
        },
        {
          country: 'CA',
          income: randomIntBetween(50000, 100000),
          filingStatus: 'single'
        },
        {
          country: 'UK',
          income: randomIntBetween(50000, 100000),
          filingStatus: 'single'
        }
      ]
    };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    };

    const comparisonResponse = http.post(
      `${BASE_URL}/api/comparisons`,
      JSON.stringify(comparisonData),
      { headers }
    );

    const comparisonSuccess = check(comparisonResponse, {
      'comparison status is 201': (r) => r.status === 201,
      'comparison has results': (r) => r.json().hasOwnProperty('results'),
      'comparison has 3 results': (r) => r.json().results.length === 3,
      'each result has total tax': (r) => {
        return r.json().results.every(result => result.hasOwnProperty('totalTax'));
      },
    });

    if (!comparisonSuccess) {
      errorRate.add(1);
    }
  });
}

function reportGenerationFlow(authToken) {
  group('Report Generation Flow', function () {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    };

    // First create a calculation
    const calculationData = {
      income: randomIntBetween(40000, 120000),
      country: randomItem(countries),
      filingStatus: 'single',
      year: 2023
    };

    const calcResponse = http.post(
      `${BASE_URL}/api/calculations`,
      JSON.stringify(calculationData),
      { headers }
    );

    if (calcResponse.status !== 201) {
      errorRate.add(1);
      return;
    }

    const calculationId = calcResponse.json().calculationId;

    // Generate report
    const reportData = {
      calculationId: calculationId,
      format: 'pdf',
      options: {
        includeCharts: true,
        template: 'summary'
      }
    };

    const reportStart = Date.now();
    const reportResponse = http.post(
      `${BASE_URL}/api/reports/generate`,
      JSON.stringify(reportData),
      { headers }
    );

    const reportSuccess = check(reportResponse, {
      'report generation status is 201': (r) => r.status === 201,
      'report has ID': (r) => r.json().hasOwnProperty('reportId'),
    });

    if (!reportSuccess) {
      errorRate.add(1);
      return;
    }

    const reportId = reportResponse.json().reportId;

    // Poll for report completion
    let reportReady = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!reportReady && attempts < maxAttempts) {
      sleep(1); // Wait 1 second between polls

      const statusResponse = http.get(
        `${BASE_URL}/api/reports/${reportId}/status`,
        { headers }
      );

      if (statusResponse.status === 200) {
        const status = statusResponse.json().status;
        if (status === 'completed') {
          reportReady = true;
          const reportTime = Date.now() - reportStart;
          reportGenerationDuration.add(reportTime);
        } else if (status === 'failed') {
          errorRate.add(1);
          break;
        }
      }

      attempts++;
    }

    if (!reportReady) {
      errorRate.add(1); // Report generation timeout
    }
  });
}

function fileUploadFlow(authToken) {
  group('File Upload Flow', function () {
    const headers = {
      'Authorization': `Bearer ${authToken}`
    };

    // Simulate file upload (using CSV data)
    const csvData = `income,country,filing_status,year
75000,US,single,2023
85000,CA,married,2023
65000,UK,single,2023`;

    const uploadResponse = http.post(
      `${BASE_URL}/api/files/upload`,
      {
        file: http.file(csvData, 'test-data.csv', 'text/csv'),
        documentType: 'tax_data',
        year: '2023'
      },
      { headers }
    );

    const uploadSuccess = check(uploadResponse, {
      'upload status is 201': (r) => r.status === 201,
      'upload has file ID': (r) => r.json().hasOwnProperty('fileId'),
    });

    if (!uploadSuccess) {
      errorRate.add(1);
      return;
    }

    const fileId = uploadResponse.json().fileId;

    // Check processing status
    sleep(2); // Give some time for processing to start

    const statusResponse = http.get(
      `${BASE_URL}/api/files/${fileId}/status`,
      { headers }
    );

    check(statusResponse, {
      'file status check is 200': (r) => r.status === 200,
      'file has processing status': (r) => r.json().hasOwnProperty('processingStatus'),
    });
  });
}

// Stress test specific scenarios
export function stressTest() {
  // High-intensity test for stress testing
  group('Stress Test Scenario', function () {
    const user = randomItem(testUsers);

    // Login
    const loginResponse = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
      email: user.email,
      password: user.password
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

    if (loginResponse.status !== 200) {
      errorRate.add(1);
      return;
    }

    const authToken = loginResponse.json().token;

    // Rapid fire calculations
    for (let i = 0; i < 5; i++) {
      const calculationData = {
        income: randomIntBetween(30000, 150000),
        country: randomItem(countries),
        filingStatus: randomItem(filingStatuses),
        year: 2023
      };

      const calcResponse = http.post(
        `${BASE_URL}/api/calculations`,
        JSON.stringify(calculationData),
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      check(calcResponse, {
        [`stress calculation ${i + 1} succeeds`]: (r) => r.status === 201,
      });

      sleep(0.1); // Very short delay between requests
    }
  });
}

// Spike test configuration
export let spikeOptions = {
  stages: [
    { duration: '10s', target: 100 }, // Sudden spike to 100 users
    { duration: '1m', target: 100 },  // Stay at 100 users
    { duration: '10s', target: 0 },   // Sudden drop to 0 users
  ],
};

// Setup function - runs once at the beginning
export function setup() {
  console.log('Setting up load test...');

  // Health check
  const healthResponse = http.get(`${BASE_URL}/health`);
  if (healthResponse.status !== 200) {
    throw new Error('Service health check failed');
  }

  // Create test users if they don't exist
  testUsers.forEach(user => {
    const registerResponse = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
      email: user.email,
      password: user.password,
      firstName: 'Load',
      lastName: 'Test',
      country: 'US'
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

    // 201 (created) or 409 (already exists) are both OK
    if (registerResponse.status !== 201 && registerResponse.status !== 409) {
      console.warn(`Failed to create test user ${user.email}: ${registerResponse.status}`);
    }
  });

  console.log('Load test setup completed');
  return { baseUrl: BASE_URL };
}

// Teardown function - runs once at the end
export function teardown(data) {
  console.log('Tearing down load test...');
  // Cleanup could go here if needed
  console.log('Load test teardown completed');
}