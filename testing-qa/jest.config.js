/**
 * Jest Configuration for GlobalTaxCalc Testing Suite
 */

module.exports = {
  // Test environment
  testEnvironment: 'jsdom',

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/config/jest.setup.js'
  ],

  // Test file patterns
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.{js,ts}',
    '<rootDir>/tests/integration/**/*.test.{js,ts}',
    '<rootDir>/tests/component/**/*.test.{js,ts}'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,ts,jsx,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.{js,ts}',
    '!src/**/*.stories.{js,ts}',
    '!src/**/*.config.{js,ts}',
    '!src/**/types.{js,ts}',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**'
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    // Critical modules require higher coverage
    './src/services/tax-calculation.js': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './src/services/payment-processing.js': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './src/utils/security.js': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    }
  },

  // Coverage reporters
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
    'json',
    'clover'
  ],

  // Coverage directory
  coverageDirectory: '<rootDir>/tests/coverage',

  // Test reporters
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './tests/reports/html',
        filename: 'jest-report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'GlobalTaxCalc Test Report'
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: './tests/reports',
        outputName: 'junit.xml',
        ancestorSeparator: ' › ',
        uniqueOutputName: 'false',
        suiteNameTemplate: '{filepath}',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}'
      }
    ]
  ],

  // Module name mapping for aliases
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1'
  },

  // Transform configuration
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
    '^.+\\.css$': 'jest-transform-css',
    '^.+\\.(png|jpg|jpeg|gif|webp|svg)$': 'jest-transform-file'
  },

  // Transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$|@testing-library/.*|axios))'
  ],

  // Module file extensions
  moduleFileExtensions: [
    'js',
    'jsx',
    'ts',
    'tsx',
    'json',
    'node'
  ],

  // Test timeout
  testTimeout: 10000,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Reset modules between tests
  resetModules: true,

  // Verbose output
  verbose: true,

  // Notify mode
  notify: false,

  // Watch plugins
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],

  // Global test variables
  globals: {
    'ts-jest': {
      useESM: true
    },
    __DEV__: true,
    __TEST__: true,
    __PROD__: false
  },

  // Test environments for different test types
  projects: [
    // Unit tests
    {
      displayName: 'Unit Tests',
      testMatch: ['<rootDir>/tests/unit/**/*.test.{js,ts}'],
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/config/jest.setup.js']
    },

    // Integration tests
    {
      displayName: 'Integration Tests',
      testMatch: ['<rootDir>/tests/integration/**/*.test.{js,ts}'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/config/jest.setup.integration.js'],
      globalSetup: '<rootDir>/config/jest.integration.setup.js',
      globalTeardown: '<rootDir>/config/jest.integration.teardown.js'
    },

    // API tests
    {
      displayName: 'API Tests',
      testMatch: ['<rootDir>/tests/api/**/*.test.{js,ts}'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/config/jest.setup.api.js']
    },

    // Component tests
    {
      displayName: 'Component Tests',
      testMatch: ['<rootDir>/tests/component/**/*.test.{js,ts}'],
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: [
        '<rootDir>/config/jest.setup.js',
        '<rootDir>/config/jest.setup.component.js'
      ]
    }
  ],

  // Max worker processes
  maxWorkers: '50%',

  // Cache directory
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',

  // Error on deprecated features
  errorOnDeprecated: true,

  // Collect coverage from all files
  collectCoverage: false, // Only when explicitly requested

  // Force exit after tests complete
  forceExit: true,

  // Detect leaks
  detectLeaks: false,

  // Detect open handles
  detectOpenHandles: true
};