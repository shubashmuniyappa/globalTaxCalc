/**
 * Cypress Support File
 * Global configuration and custom commands for E2E tests
 */

import './commands';
import './accessibility';
import './performance';
import 'cypress-axe';
import 'cypress-file-upload';
import '@testing-library/cypress/add-commands';

// Global configuration
Cypress.on('uncaught:exception', (err, runnable) => {
  // Prevent Cypress from failing on uncaught exceptions in some cases
  if (err.message.includes('ResizeObserver loop limit exceeded')) {
    return false;
  }
  return true;
});

// Set default viewport
beforeEach(() => {
  cy.viewport(1280, 720);
});

// Clean up between tests
afterEach(() => {
  cy.clearCookies();
  cy.clearLocalStorage();
  cy.clearSessionStorage();
});

// Global error handling
Cypress.on('fail', (error, runnable) => {
  debugger;
  throw error;
});

// Screenshot configuration
Cypress.Screenshot.defaults({
  screenshotOnRunFailure: true,
  capture: 'viewport'
});

// Custom Cypress commands for global use
Cypress.Commands.add('getByTestId', (selector, ...args) => {
  return cy.get(`[data-testid="${selector}"]`, ...args);
});

Cypress.Commands.add('waitForPageLoad', () => {
  cy.window().should('have.property', 'document');
  cy.document().should('have.property', 'readyState', 'complete');
});

// API testing helpers
Cypress.Commands.add('apiRequest', (method, url, body = {}, headers = {}) => {
  return cy.request({
    method,
    url: `${Cypress.env('API_URL')}${url}`,
    body,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    failOnStatusCode: false
  });
});

// Performance monitoring
Cypress.Commands.add('startPerformanceMonitoring', () => {
  cy.window().then((win) => {
    win.performance.mark('test-start');
  });
});

Cypress.Commands.add('endPerformanceMonitoring', (testName) => {
  cy.window().then((win) => {
    win.performance.mark('test-end');
    win.performance.measure(testName, 'test-start', 'test-end');
  });
});