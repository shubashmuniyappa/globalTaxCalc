/**
 * K6 Load Testing for Tax Calculation API
 * Tests system performance under various load conditions
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const taxCalculationErrors = new Rate('tax_calculation_errors');
const taxCalculationDuration = new Trend('tax_calculation_duration');
const authenticationErrors = new Rate('authentication_errors');
const concurrentUsers = new Counter('concurrent_users');

// Test configuration
export const options = {
  stages: [
    // Ramp up
    { duration: '2m', target: 10 },   // Ramp up to 10 users over 2 minutes
    { duration: '5m', target: 10 },   // Stay at 10 users for 5 minutes
    { duration: '2m', target: 50 },   // Ramp up to 50 users over 2 minutes
    { duration: '10m', target: 50 },  // Stay at 50 users for 10 minutes
    { duration: '2m', target: 100 },  // Ramp up to 100 users over 2 minutes
    { duration: '5m', target: 100 },  // Stay at 100 users for 5 minutes
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s
    http_req_failed: ['rate<0.1'],     // Error rate must be below 10%
    tax_calculation_duration: ['p(95)<3000'], // Tax calculations under 3s
    tax_calculation_errors: ['rate<0.05'],    // Tax calculation errors under 5%
  },
};

// Test data
const API_BASE_URL = __ENV.API_URL || 'http://localhost:3001';
const TEST_USERS = [
  { email: 'load.test1@globaltaxcalc.com', password: 'LoadTest123!' },
  { email: 'load.test2@globaltaxcalc.com', password: 'LoadTest123!' },
  { email: 'load.test3@globaltaxcalc.com', password: 'LoadTest123!' },
];

const TAX_SCENARIOS = [
  {
    name: 'Low Income Single',
    data: {
      income: 25000,
      filingStatus: 'single',
      state: 'TX',
      deductions: { standard: 14600 }
    }
  },
  {
    name: 'Middle Income Married',
    data: {
      income: 75000,
      filingStatus: 'married-jointly',
      state: 'CA',
      deductions: {
        itemized: {
          charitable: 5000,
          medical: 2000,
          stateAndLocal: 10000
        }
      }
    }
  },
  {
    name: 'High Income Complex',
    data: {
      income: 250000,
      filingStatus: 'married-separately',
      state: 'NY',
      capitalGains: {
        shortTerm: 15000,
        longTerm: 50000
      },
      businessIncome: 80000,
      deductions: {
        itemized: {
          charitable: 25000,
          medical: 8000,
          stateAndLocal: 10000,
          mortgage: 30000
        }
      }
    }
  }
];

// Setup function
export function setup() {
  console.log('Setting up load test environment...');

  // Create test users if they don't exist
  TEST_USERS.forEach((user, index) => {
    const response = http.post(`${API_BASE_URL}/api/auth/register`, {
      email: user.email,
      password: user.password,
      firstName: `LoadTest${index + 1}`,
      lastName: 'User',
      country: 'US'
    });

    if (response.status !== 201 && response.status !== 409) {
      console.error(`Failed to create test user ${user.email}: ${response.status}`);
    }
  });

  return { apiUrl: API_BASE_URL };
}

// Authentication helper
function authenticate(userData) {
  const response = http.post(`${API_BASE_URL}/api/auth/login`, {
    email: userData.email,
    password: userData.password
  });

  const success = check(response, {
    'authentication successful': (r) => r.status === 200,
    'auth response time acceptable': (r) => r.timings.duration < 1000,
  });

  authenticationErrors.add(!success);

  if (success) {
    const body = JSON.parse(response.body);
    return body.token;
  }

  return null;
}

// Main test function
export default function(data) {
  concurrentUsers.add(1);

  group('User Authentication', function() {
    const userIndex = Math.floor(Math.random() * TEST_USERS.length);
    const user = TEST_USERS[userIndex];
    const token = authenticate(user);

    if (!token) {
      console.error('Authentication failed, skipping test iteration');
      return;
    }

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    group('Tax Calculation Load Test', function() {
      const scenarioIndex = Math.floor(Math.random() * TAX_SCENARIOS.length);
      const scenario = TAX_SCENARIOS[scenarioIndex];

      console.log(`Testing scenario: ${scenario.name}`);

      const startTime = Date.now();
      const response = http.post(
        `${API_BASE_URL}/api/tax/calculate`,
        JSON.stringify(scenario.data),
        { headers }
      );
      const endTime = Date.now();

      const calculationTime = endTime - startTime;
      taxCalculationDuration.add(calculationTime);

      const success = check(response, {
        'tax calculation successful': (r) => r.status === 200,
        'response has calculation data': (r) => {
          if (r.status === 200) {
            const body = JSON.parse(r.body);
            return body.calculation &&
                   body.calculation.taxOwed !== undefined &&
                   body.calculation.effectiveRate !== undefined;
          }
          return false;
        },
        'calculation time acceptable': (r) => calculationTime < 5000,
      });

      taxCalculationErrors.add(!success);

      if (success) {
        const body = JSON.parse(response.body);
        console.log(`Calculation completed: $${body.calculation.taxOwed} tax owed`);
      } else {
        console.error(`Tax calculation failed: ${response.status} - ${response.body}`);
      }
    });

    group('Calculation History', function() {
      const response = http.get(`${API_BASE_URL}/api/tax/calculations`, { headers });

      check(response, {
        'history retrieval successful': (r) => r.status === 200,
        'history response time acceptable': (r) => r.timings.duration < 1000,
      });
    });

    // Simulate user think time
    sleep(Math.random() * 3 + 1); // 1-4 seconds
  });
}

// Teardown function
export function teardown(data) {
  console.log('Load test completed. Cleaning up...');

  // Optional: Clean up test data
  TEST_USERS.forEach((user) => {
    const response = http.post(`${API_BASE_URL}/api/auth/login`, {
      email: user.email,
      password: user.password
    });

    if (response.status === 200) {
      const body = JSON.parse(response.body);
      const token = body.token;

      // Delete test calculations
      http.del(`${API_BASE_URL}/api/test/cleanup`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }
  });
}