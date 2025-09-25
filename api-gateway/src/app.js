/**
 * Main Application Entry Point
 * GlobalTaxCalc API Gateway with GraphQL
 */

const express = require('express');
const http = require('http');
const { json } = require('body-parser');
const { startServer } = require('./graphql/server');

// Import middleware and portal
const { createVersionManager } = require('./middleware/versioning');
const { securityHeaders } = require('./middleware/authentication');
const DocumentationPortal = require('./portal/documentation');

// Environment configuration
require('dotenv').config();

const app = express();
const port = process.env.PORT || 4000;

// Initialize components
const versionManager = createVersionManager();
const documentationPortal = new DocumentationPortal();

// Security headers
app.use(securityHeaders());

// Basic middleware
app.use(json({ limit: '10mb' }));

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// API versioning middleware
app.use(versionManager.middleware());

// Developer portal routes
app.use('/portal', documentationPortal.getRouter());

// API version routing
app.use(versionManager.versionRouter());

// Basic health check before GraphQL setup
app.get('/', (req, res) => {
  res.json({
    name: 'GlobalTaxCalc API Gateway',
    version: process.env.API_VERSION || '1.0.0',
    status: 'running',
    graphql: '/graphql',
    health: '/health',
    portal: '/portal',
    documentation: '/portal/docs',
    playground: '/portal/playground',
    timestamp: new Date().toISOString(),
    apiInfo: versionManager.getApiInfo()
  });
});

// Create HTTP server
const httpServer = http.createServer(app);

// Start the Apollo Server with Express integration
async function bootstrap() {
  try {
    console.log('🚀 Starting GlobalTaxCalc API Gateway...');
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔧 API Version: ${process.env.API_VERSION || '1.0.0'}`);

    // Start the GraphQL server
    await startServer(app, httpServer, port);

    // Start HTTP server
    httpServer.listen(port, () => {
      console.log(`🌟 Server running at http://localhost:${port}`);
      console.log(`📖 GraphQL Endpoint: http://localhost:${port}/graphql`);
      console.log(`🔍 Health Check: http://localhost:${port}/health`);
      console.log(`🏛️  Developer Portal: http://localhost:${port}/portal`);
      console.log(`📚 API Documentation: http://localhost:${port}/portal/docs`);

      if (process.env.NODE_ENV === 'development') {
        console.log(`🎮 GraphQL Playground: http://localhost:${port}/portal/playground`);
      }

      console.log('\n🎯 Available Endpoints:');
      console.log(`   • GraphQL API: http://localhost:${port}/graphql`);
      console.log(`   • REST API v1: http://localhost:${port}/api/v1`);
      console.log(`   • REST API v2: http://localhost:${port}/api/v2`);
      console.log(`   • OpenAPI Spec: http://localhost:${port}/portal/openapi`);
      console.log(`   • API Console: http://localhost:${port}/portal/console`);

      console.log('\n🎯 Available Services:');
      console.log(`   • Tax Calculator: ${process.env.TAX_SERVICE_URL || 'http://localhost:3001'}`);
      console.log(`   • User Management: ${process.env.USER_SERVICE_URL || 'http://localhost:3002'}`);
      console.log(`   • Analytics: ${process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3003'}`);
      console.log(`   • Billing: ${process.env.BILLING_SERVICE_URL || 'http://localhost:3004'}`);
      console.log(`   • Content: ${process.env.CONTENT_SERVICE_URL || 'http://localhost:3005'}`);
      console.log(`   • API Management: ${process.env.API_MANAGEMENT_URL || 'http://localhost:3006'}`);

      console.log('\n✅ GlobalTaxCalc API Gateway is ready!');
      console.log('🚀 Features enabled:');
      console.log('   • GraphQL API with Apollo Server');
      console.log('   • Comprehensive API schema for tax operations');
      console.log('   • API versioning and management system');
      console.log('   • Developer portal with documentation');
      console.log('   • API authentication and security');
      console.log('   • Real-time subscriptions');
      console.log('   • Rate limiting and monitoring');
    });

    // Graceful shutdown
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown handler
function gracefulShutdown(signal) {
  console.log(`\n📡 Received ${signal}. Starting graceful shutdown...`);

  httpServer.close(() => {
    console.log('🔌 HTTP server closed');

    // Close database connections, clean up resources, etc.
    console.log('🧹 Cleanup completed');
    console.log('👋 GlobalTaxCalc API Gateway shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
bootstrap();

module.exports = { app, httpServer };