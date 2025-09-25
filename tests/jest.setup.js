const axios = require('axios');
require('dotenv').config();

// Global test configuration
global.TEST_CONFIG = {
  // Service URLs
  API_GATEWAY_URL: process.env.API_GATEWAY_URL || 'http://localhost:3000',
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  TAX_ENGINE_URL: process.env.TAX_ENGINE_URL || 'http://localhost:3002',
  REPORT_SERVICE_URL: process.env.REPORT_SERVICE_URL || 'http://localhost:3003',
  FILE_SERVICE_URL: process.env.FILE_SERVICE_URL || 'http://localhost:3004',
  MONITORING_URL: process.env.MONITORING_URL || 'http://localhost:3005',

  // Test timeouts
  DEFAULT_TIMEOUT: 30000,
  LOAD_TEST_TIMEOUT: 300000,
  E2E_TIMEOUT: 60000,

  // Test data
  TEST_USER: {
    email: 'test@globaltaxcalc.com',
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User',
    country: 'US'
  },

  // Test files
  TEST_FILES: {
    CSV_SAMPLE: 'test-data/sample-tax-data.csv',
    PDF_SAMPLE: 'test-data/sample-document.pdf',
    JSON_SAMPLE: 'test-data/sample-calculation.json'
  },

  // API Keys and tokens
  API_KEY: process.env.TEST_API_KEY || 'test-api-key',
  JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret'
};

// Global axios configuration
axios.defaults.timeout = global.TEST_CONFIG.DEFAULT_TIMEOUT;
axios.defaults.headers.common['User-Agent'] = 'GlobalTaxCalc-IntegrationTests/1.0.0';

// Global setup before all tests
beforeAll(async () => {
  console.log('🚀 Starting GlobalTaxCalc Integration Tests');

  // Wait for services to be ready
  await waitForServices();

  // Initialize test database
  await initializeTestDatabase();

  // Create test data
  await createTestData();
});

// Global cleanup after all tests
afterAll(async () => {
  console.log('🧹 Cleaning up after tests');

  // Cleanup test data
  await cleanupTestData();

  // Close any open connections
  await cleanup();
});

// Utility functions
global.waitForServices = async () => {
  const services = [
    { name: 'API Gateway', url: global.TEST_CONFIG.API_GATEWAY_URL },
    { name: 'Auth Service', url: global.TEST_CONFIG.AUTH_SERVICE_URL },
    { name: 'Tax Engine', url: global.TEST_CONFIG.TAX_ENGINE_URL },
    { name: 'Report Service', url: global.TEST_CONFIG.REPORT_SERVICE_URL },
    { name: 'File Service', url: global.TEST_CONFIG.FILE_SERVICE_URL },
    { name: 'Monitoring', url: global.TEST_CONFIG.MONITORING_URL }
  ];

  console.log('⏳ Waiting for services to be ready...');

  for (const service of services) {
    let retries = 0;
    const maxRetries = 30;

    while (retries < maxRetries) {
      try {
        const response = await axios.get(`${service.url}/health`, { timeout: 5000 });
        if (response.status === 200) {
          console.log(`✅ ${service.name} is ready`);
          break;
        }
      } catch (error) {
        retries++;
        if (retries === maxRetries) {
          console.error(`❌ ${service.name} failed to start after ${maxRetries} attempts`);
          throw new Error(`Service ${service.name} is not available`);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  console.log('✅ All services are ready');
};

global.initializeTestDatabase = async () => {
  try {
    // Create test user if doesn't exist
    const response = await axios.post(`${global.TEST_CONFIG.AUTH_SERVICE_URL}/api/auth/register`, {
      email: global.TEST_CONFIG.TEST_USER.email,
      password: global.TEST_CONFIG.TEST_USER.password,
      firstName: global.TEST_CONFIG.TEST_USER.firstName,
      lastName: global.TEST_CONFIG.TEST_USER.lastName,
      country: global.TEST_CONFIG.TEST_USER.country
    });

    if (response.status === 201 || response.status === 409) {
      console.log('✅ Test user initialized');
    }
  } catch (error) {
    if (error.response?.status !== 409) {
      console.warn('⚠️ Could not initialize test user:', error.message);
    }
  }
};

global.createTestData = async () => {
  // Create test calculation data
  global.TEST_DATA = {
    taxCalculation: {
      income: 75000,
      country: 'US',
      state: 'CA',
      filingStatus: 'single',
      deductions: [
        { type: 'standard', amount: 12950 },
        { type: 'charitable', amount: 5000 }
      ],
      year: 2023
    },

    comparisonData: {
      scenarios: [
        { country: 'US', income: 75000, filingStatus: 'single' },
        { country: 'CA', income: 75000, filingStatus: 'single' },
        { country: 'UK', income: 75000, filingStatus: 'single' }
      ]
    }
  };

  console.log('✅ Test data created');
};

global.cleanupTestData = async () => {
  try {
    // Clean up any test files
    const fs = require('fs').promises;
    const path = require('path');

    const testUploadsDir = path.join(__dirname, 'test-uploads');
    try {
      await fs.rmdir(testUploadsDir, { recursive: true });
    } catch (error) {
      // Directory doesn't exist, that's fine
    }

    console.log('✅ Test data cleaned up');
  } catch (error) {
    console.warn('⚠️ Error during cleanup:', error.message);
  }
};

global.cleanup = async () => {
  // Close any open connections
  // This will be called by Jest automatically
};

// Utility functions for tests
global.authenticateTestUser = async () => {
  try {
    const response = await axios.post(`${global.TEST_CONFIG.AUTH_SERVICE_URL}/api/auth/login`, {
      email: global.TEST_CONFIG.TEST_USER.email,
      password: global.TEST_CONFIG.TEST_USER.password
    });

    return response.data.token;
  } catch (error) {
    throw new Error(`Failed to authenticate test user: ${error.message}`);
  }
};

global.createAuthHeaders = (token) => {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

global.generateTestData = (type) => {
  const faker = require('faker');

  switch (type) {
    case 'user':
      return {
        email: faker.internet.email(),
        password: 'TestPassword123!',
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
        country: faker.random.arrayElement(['US', 'CA', 'UK', 'DE', 'FR'])
      };

    case 'calculation':
      return {
        income: faker.datatype.number({ min: 25000, max: 200000 }),
        country: faker.random.arrayElement(['US', 'CA', 'UK', 'DE', 'FR']),
        filingStatus: faker.random.arrayElement(['single', 'married', 'head_of_household']),
        year: faker.datatype.number({ min: 2020, max: 2023 })
      };

    default:
      throw new Error(`Unknown test data type: ${type}`);
  }
};

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

console.log('📋 Jest setup completed');

async function waitForServices() {
  await global.waitForServices();
}

async function initializeTestDatabase() {
  await global.initializeTestDatabase();
}

async function createTestData() {
  await global.createTestData();
}

async function cleanupTestData() {
  await global.cleanupTestData();
}

async function cleanup() {
  await global.cleanup();
}