#!/usr/bin/env node

const Application = require('./app');

// Create and start the application
const app = new Application();

// Start the server
app.start().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});

module.exports = app;