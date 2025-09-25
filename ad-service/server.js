#!/usr/bin/env node

/**
 * GlobalTaxCalc Ad Management Service
 * Entry point for the ad management service with placement optimization
 */

require('dotenv').config();

// Validate required environment variables
const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
  'REDIS_HOST'
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

// Optional environment variables with warnings
const optionalEnvVars = [
  'GOOGLE_ADSENSE_CLIENT_ID',
  'MEDIANET_SITE_ID'
];

const missingOptionalVars = optionalEnvVars.filter(varName => !process.env[varName]);

if (missingOptionalVars.length > 0) {
  console.warn('⚠️  Optional environment variables not set (ad networks may not work):');
  missingOptionalVars.forEach(varName => {
    console.warn(`   - ${varName}`);
  });
}

// Start the application
const app = require('./app');

console.log('✅ Ad Management Service started successfully');
console.log('📊 Features enabled:');
console.log('   - Dynamic ad placement optimization');
console.log('   - Multi-network integration (AdSense, Media.net, Direct)');
console.log('   - A/B testing framework');
console.log('   - Revenue optimization with RPM tracking');
console.log('   - Loading performance optimization (lazy loading, Core Web Vitals)');
console.log('   - Comprehensive analytics and reporting');
console.log('   - Content filtering and brand safety');
console.log('📈 Monitoring for optimal ad performance and revenue');

module.exports = app;