/**
 * Cypress Configuration for End-to-End Testing
 */

const { defineConfig } = require('cypress');
const cucumber = require('cypress-cucumber-preprocessor').default;

module.exports = defineConfig({
  // Global configuration
  watchForFileChanges: false,
  defaultCommandTimeout: 10000,
  requestTimeout: 15000,
  responseTimeout: 30000,
  pageLoadTimeout: 30000,

  // Video and screenshot settings
  video: true,
  videoCompression: 32,
  screenshotOnRunFailure: true,
  screenshotsFolder: 'tests/e2e/screenshots',
  videosFolder: 'tests/e2e/videos',

  // Viewport settings
  viewportWidth: 1280,
  viewportHeight: 720,

  // Chrome flags for better stability
  chromeWebSecurity: false,

  // Retry configuration
  retries: {
    runMode: 2,
    openMode: 0
  },

  // E2E Testing configuration
  e2e: {
    setupNodeEvents(on, config) {
      // Cucumber preprocessor
      on('file:preprocessor', cucumber());

      // Custom tasks
      on('task', {
        // Database seeding
        seedDatabase(data) {
          return require('./tests/e2e/support/database-seeder')(data);
        },

        // Clear database
        clearDatabase() {
          return require('./tests/e2e/support/database-seeder').clear();
        },

        // Generate test data
        generateTestData(options) {
          return require('./tests/e2e/support/test-data-generator')(options);
        },

        // Log messages
        log(message) {
          console.log(message);
          return null;
        },

        // File operations
        readFile(filename) {
          return require('fs').readFileSync(filename, 'utf8');
        },

        // Environment operations
        setEnvironmentVariable(variable) {
          process.env[variable.name] = variable.value;
          return null;
        },

        // Wait for service
        waitForService(config) {
          return require('./tests/e2e/support/service-waiter')(config);
        },

        // Performance metrics
        getPerformanceMetrics() {
          return require('./tests/e2e/support/performance-collector')();
        }
      });

      // Browser launch arguments
      on('before:browser:launch', (browser = {}, launchOptions) => {
        if (browser.name === 'chrome') {
          launchOptions.args.push('--disable-dev-shm-usage');
          launchOptions.args.push('--no-sandbox');
          launchOptions.args.push('--disable-gpu');
          launchOptions.args.push('--disable-web-security');
          launchOptions.args.push('--allow-running-insecure-content');
        }

        if (browser.name === 'electron') {
          launchOptions.preferences.fullscreen = false;
        }

        return launchOptions;
      });

      // Lighthouse integration
      on('task', require('@cypress-audit/lighthouse/commands'));
      on('task', require('@cypress-audit/pa11y/commands'));

      // Test reporting
      on('after:spec', (spec, results) => {
        require('./tests/e2e/support/test-reporter')(spec, results);
      });

      // Environment-specific configuration
      const environment = config.env.NODE_ENV || 'test';

      if (environment === 'local') {
        config.baseUrl = 'http://localhost:3000';
        config.env.API_URL = 'http://localhost:3001';
      } else if (environment === 'staging') {
        config.baseUrl = 'https://staging.globaltaxcalc.com';
        config.env.API_URL = 'https://api-staging.globaltaxcalc.com';
      } else if (environment === 'production') {
        config.baseUrl = 'https://globaltaxcalc.com';
        config.env.API_URL = 'https://api.globaltaxcalc.com';
      }

      return config;
    },

    // Test file patterns
    specPattern: [
      'tests/e2e/specs/**/*.cy.{js,ts}',
      'tests/e2e/features/**/*.feature'
    ],

    // Support file
    supportFile: 'tests/e2e/support/index.js',

    // Fixtures folder
    fixturesFolder: 'tests/e2e/fixtures',

    // Base URL
    baseUrl: 'http://localhost:3000',

    // Environment variables
    env: {
      NODE_ENV: 'test',
      API_URL: 'http://localhost:3001',
      TEST_USER_EMAIL: 'test@globaltaxcalc.com',
      TEST_USER_PASSWORD: 'TestPassword123!',
      ADMIN_EMAIL: 'admin@globaltaxcalc.com',
      ADMIN_PASSWORD: 'AdminPassword123!',

      // Feature flags
      ENABLE_MULTI_COUNTRY: true,
      ENABLE_PREMIUM_FEATURES: true,
      ENABLE_ANALYTICS: false,

      // Test configuration
      COVERAGE: true,
      RECORD_VIDEO: true,
      TAKE_SCREENSHOTS: true,

      // External services
      STRIPE_TEST_MODE: true,
      MOCK_EXTERNAL_APIS: true,

      // Database
      TEST_DATABASE_URL: 'postgresql://test:test@localhost:5432/globaltaxcalc_test',

      // Accessibility testing
      A11Y_OPTIONS: {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21aa']
        }
      }
    },

    // Exclude patterns
    excludeSpecPattern: [
      '**/*.skip.cy.{js,ts}',
      '**/examples/**/*'
    ]
  },

  // Component Testing configuration
  component: {
    setupNodeEvents(on, config) {
      // Component testing specific setup
      return config;
    },
    devServer: {
      framework: 'react',
      bundler: 'webpack',
    },
    specPattern: 'tests/component/**/*.cy.{js,ts}',
    supportFile: 'tests/component/support/index.js'
  },

  // Reporter configuration
  reporter: 'cypress-multi-reporters',
  reporterOptions: {
    configFile: 'tests/e2e/config/reporter.json'
  },

  // Experimental features
  experimentalStudio: true,
  experimentalSourceRewriting: true,

  // Performance monitoring
  numTestsKeptInMemory: 10,

  // Node.js version compatibility
  nodeVersion: 'system'
});