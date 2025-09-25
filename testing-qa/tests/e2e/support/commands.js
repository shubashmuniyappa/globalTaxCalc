/**
 * Custom Cypress Commands for GlobalTaxCalc E2E Testing
 */

// Authentication commands
Cypress.Commands.add('login', (email = Cypress.env('TEST_USER_EMAIL'), password = Cypress.env('TEST_USER_PASSWORD')) => {
  cy.session([email, password], () => {
    cy.visit('/login');
    cy.getByTestId('email-input').type(email);
    cy.getByTestId('password-input').type(password);
    cy.getByTestId('login-button').click();
    cy.url().should('not.include', '/login');
    cy.getCookie('auth-token').should('exist');
  });
});

Cypress.Commands.add('logout', () => {
  cy.getByTestId('user-menu').click();
  cy.getByTestId('logout-button').click();
  cy.url().should('include', '/login');
});

Cypress.Commands.add('register', (userData = {}) => {
  const defaultData = {
    firstName: 'Test',
    lastName: 'User',
    email: `test-${Date.now()}@globaltaxcalc.com`,
    password: 'TestPassword123!',
    confirmPassword: 'TestPassword123!',
    country: 'US'
  };

  const data = { ...defaultData, ...userData };

  cy.visit('/register');
  cy.getByTestId('first-name-input').type(data.firstName);
  cy.getByTestId('last-name-input').type(data.lastName);
  cy.getByTestId('email-input').type(data.email);
  cy.getByTestId('password-input').type(data.password);
  cy.getByTestId('confirm-password-input').type(data.confirmPassword);
  cy.getByTestId('country-select').select(data.country);
  cy.getByTestId('terms-checkbox').check();
  cy.getByTestId('register-button').click();

  return cy.wrap(data);
});

// Tax calculation commands
Cypress.Commands.add('fillTaxForm', (taxData) => {
  const defaultData = {
    income: 75000,
    filingStatus: 'single',
    state: 'CA',
    standardDeduction: true,
    dependents: 0
  };

  const data = { ...defaultData, ...taxData };

  cy.getByTestId('income-input').clear().type(data.income.toString());
  cy.getByTestId('filing-status-select').select(data.filingStatus);
  cy.getByTestId('state-select').select(data.state);

  if (data.standardDeduction) {
    cy.getByTestId('standard-deduction-radio').check();
  } else {
    cy.getByTestId('itemized-deduction-radio').check();
  }

  if (data.dependents > 0) {
    cy.getByTestId('dependents-input').clear().type(data.dependents.toString());
  }
});

Cypress.Commands.add('calculateTax', () => {
  cy.getByTestId('calculate-button').click();
  cy.getByTestId('calculation-results').should('be.visible');
  cy.getByTestId('loading-spinner').should('not.exist');
});

Cypress.Commands.add('saveCalculation', (name) => {
  cy.getByTestId('save-calculation-button').click();
  cy.getByTestId('calculation-name-input').type(name);
  cy.getByTestId('save-confirm-button').click();
  cy.contains('Calculation saved successfully').should('be.visible');
});

// Navigation commands
Cypress.Commands.add('navigateToCalculator', () => {
  cy.getByTestId('calculator-nav-link').click();
  cy.url().should('include', '/calculator');
  cy.getByTestId('tax-calculator-form').should('be.visible');
});

Cypress.Commands.add('navigateToDashboard', () => {
  cy.getByTestId('dashboard-nav-link').click();
  cy.url().should('include', '/dashboard');
  cy.getByTestId('dashboard-content').should('be.visible');
});

Cypress.Commands.add('navigateToProfile', () => {
  cy.getByTestId('profile-nav-link').click();
  cy.url().should('include', '/profile');
  cy.getByTestId('profile-form').should('be.visible');
});

// File upload commands
Cypress.Commands.add('uploadTaxDocument', (fileName, documentType = 'w2') => {
  cy.getByTestId('document-upload-area').should('be.visible');
  cy.getByTestId('document-type-select').select(documentType);
  cy.getByTestId('file-input').attachFile(fileName);
  cy.getByTestId('upload-button').click();
  cy.contains('Document uploaded successfully').should('be.visible');
});

// Payment commands
Cypress.Commands.add('selectPremiumPlan', (planType = 'monthly') => {
  cy.getByTestId('premium-plans').should('be.visible');
  cy.getByTestId(`${planType}-plan-button`).click();
  cy.url().should('include', '/checkout');
});

Cypress.Commands.add('fillPaymentForm', (paymentData = {}) => {
  const defaultData = {
    cardNumber: '4242424242424242',
    expiryMonth: '12',
    expiryYear: '2025',
    cvc: '123',
    name: 'Test User',
    address: '123 Test St',
    city: 'Test City',
    state: 'CA',
    zipCode: '12345'
  };

  const data = { ...defaultData, ...paymentData };

  cy.getByTestId('card-number-input').type(data.cardNumber);
  cy.getByTestId('expiry-month-select').select(data.expiryMonth);
  cy.getByTestId('expiry-year-select').select(data.expiryYear);
  cy.getByTestId('cvc-input').type(data.cvc);
  cy.getByTestId('cardholder-name-input').type(data.name);
  cy.getByTestId('address-input').type(data.address);
  cy.getByTestId('city-input').type(data.city);
  cy.getByTestId('state-select').select(data.state);
  cy.getByTestId('zip-input').type(data.zipCode);
});

Cypress.Commands.add('completePurchase', () => {
  cy.getByTestId('complete-purchase-button').click();
  cy.contains('Payment successful').should('be.visible');
  cy.url().should('include', '/confirmation');
});

// Data management commands
Cypress.Commands.add('clearUserData', () => {
  cy.task('clearDatabase');
});

Cypress.Commands.add('seedTestData', (data) => {
  return cy.task('seedDatabase', data);
});

Cypress.Commands.add('generateTestUser', () => {
  return cy.task('generateTestData', { type: 'user' });
});

// Wait commands
Cypress.Commands.add('waitForApi', (url, timeout = 10000) => {
  cy.intercept('GET', `**/api${url}`).as('apiCall');
  cy.wait('@apiCall', { timeout });
});

Cypress.Commands.add('waitForCalculation', () => {
  cy.intercept('POST', '**/api/tax/calculate').as('taxCalculation');
  cy.wait('@taxCalculation');
});

// Assertion commands
Cypress.Commands.add('shouldHaveCalculationResults', () => {
  cy.getByTestId('tax-owed-amount').should('be.visible').and('contain', '$');
  cy.getByTestId('effective-rate').should('be.visible').and('contain', '%');
  cy.getByTestId('marginal-rate').should('be.visible').and('contain', '%');
  cy.getByTestId('federal-tax').should('be.visible');
  cy.getByTestId('state-tax').should('be.visible');
});

Cypress.Commands.add('shouldBeLoggedIn', () => {
  cy.getCookie('auth-token').should('exist');
  cy.getByTestId('user-menu').should('be.visible');
  cy.url().should('not.include', '/login');
});

Cypress.Commands.add('shouldBeLoggedOut', () => {
  cy.getCookie('auth-token').should('not.exist');
  cy.url().should('include', '/login');
});

// Error handling commands
Cypress.Commands.add('shouldShowError', (message) => {
  cy.getByTestId('error-message').should('be.visible').and('contain', message);
});

Cypress.Commands.add('shouldShowSuccess', (message) => {
  cy.getByTestId('success-message').should('be.visible').and('contain', message);
});

// Multi-country testing commands
Cypress.Commands.add('selectCountry', (country) => {
  cy.getByTestId('country-selector').click();
  cy.getByTestId(`country-option-${country}`).click();
  cy.url().should('include', `country=${country}`);
});

Cypress.Commands.add('fillCanadianTaxForm', (taxData) => {
  const defaultData = {
    income: 75000,
    province: 'ON',
    rrspContribution: 5000,
    childBenefit: true
  };

  const data = { ...defaultData, ...taxData };

  cy.getByTestId('income-input').clear().type(data.income.toString());
  cy.getByTestId('province-select').select(data.province);
  cy.getByTestId('rrsp-input').clear().type(data.rrspContribution.toString());

  if (data.childBenefit) {
    cy.getByTestId('child-benefit-checkbox').check();
  }
});