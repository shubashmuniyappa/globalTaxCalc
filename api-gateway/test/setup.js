// Jest setup file for API Gateway tests

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests

// Mock external dependencies
jest.mock('../utils/redis', () => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
  ping: jest.fn().mockResolvedValue('PONG'),
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  isReady: jest.fn().mockReturnValue(true)
}));

// Global test timeout
jest.setTimeout(10000);

// Suppress console output during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};