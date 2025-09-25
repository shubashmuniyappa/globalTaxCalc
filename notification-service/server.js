#!/usr/bin/env node

/**
 * GlobalTaxCalc Notification Service
 * Entry point for the notification service
 */

require('dotenv').config();

// Validate required environment variables
const requiredEnvVars = [
  'SENDGRID_API_KEY',
  'MONGODB_URI',
  'JWT_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingEnvVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\nPlease check your .env file and ensure all required variables are set.');
  process.exit(1);
}

// Start the application
const app = require('./app');

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('✅ Notification Service started successfully');
console.log('📊 Monitoring for uncaught exceptions and unhandled rejections');

module.exports = app;