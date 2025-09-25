/**
 * E2E Tests for User Authentication
 * Tests the complete user authentication flow
 */

describe('User Authentication', () => {
  beforeEach(() => {
    cy.clearUserData();
    cy.visit('/');
  });

  describe('User Registration', () => {
    it('should allow new user registration with valid data', () => {
      cy.startPerformanceMonitoring();

      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: `john.doe.${Date.now()}@globaltaxcalc.com`,
        password: 'SecurePassword123!',
        confirmPassword: 'SecurePassword123!',
        country: 'US'
      };

      cy.visit('/register');
      cy.auditPageAccessibility('registration');

      // Fill registration form
      cy.getByTestId('first-name-input').type(userData.firstName);
      cy.getByTestId('last-name-input').type(userData.lastName);
      cy.getByTestId('email-input').type(userData.email);
      cy.getByTestId('password-input').type(userData.password);
      cy.getByTestId('confirm-password-input').type(userData.confirmPassword);
      cy.getByTestId('country-select').select(userData.country);
      cy.getByTestId('terms-checkbox').check();

      // Submit registration
      cy.getByTestId('register-button').click();

      // Verify successful registration
      cy.url().should('include', '/dashboard');
      cy.shouldBeLoggedIn();
      cy.contains('Welcome to GlobalTaxCalc').should('be.visible');

      cy.endPerformanceMonitoring('user-registration');
    });

    it('should show validation errors for invalid registration data', () => {
      cy.visit('/register');

      // Test empty form submission
      cy.getByTestId('register-button').click();
      cy.shouldShowError('Please fill in all required fields');

      // Test invalid email
      cy.getByTestId('email-input').type('invalid-email');
      cy.getByTestId('register-button').click();
      cy.shouldShowError('Please enter a valid email address');

      // Test password mismatch
      cy.getByTestId('email-input').clear().type('valid@email.com');
      cy.getByTestId('password-input').type('password123');
      cy.getByTestId('confirm-password-input').type('different-password');
      cy.getByTestId('register-button').click();
      cy.shouldShowError('Passwords do not match');

      // Test weak password
      cy.getByTestId('password-input').clear().type('weak');
      cy.getByTestId('confirm-password-input').clear().type('weak');
      cy.getByTestId('register-button').click();
      cy.shouldShowError('Password must be at least 8 characters');
    });

    it('should prevent registration with existing email', () => {
      const existingEmail = 'existing@globaltaxcalc.com';

      // Create existing user
      cy.seedTestData({
        users: [{
          email: existingEmail,
          firstName: 'Existing',
          lastName: 'User'
        }]
      });

      cy.visit('/register');
      cy.getByTestId('first-name-input').type('New');
      cy.getByTestId('last-name-input').type('User');
      cy.getByTestId('email-input').type(existingEmail);
      cy.getByTestId('password-input').type('NewPassword123!');
      cy.getByTestId('confirm-password-input').type('NewPassword123!');
      cy.getByTestId('country-select').select('US');
      cy.getByTestId('terms-checkbox').check();
      cy.getByTestId('register-button').click();

      cy.shouldShowError('Email address is already registered');
    });
  });

  describe('User Login', () => {
    beforeEach(() => {
      // Create test user
      cy.seedTestData({
        users: [{
          email: 'test@globaltaxcalc.com',
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User',
          verified: true
        }]
      });
    });

    it('should allow login with valid credentials', () => {
      cy.startPerformanceMonitoring();

      cy.visit('/login');
      cy.auditPageAccessibility('login');

      cy.getByTestId('email-input').type('test@globaltaxcalc.com');
      cy.getByTestId('password-input').type('TestPassword123!');
      cy.getByTestId('login-button').click();

      cy.url().should('include', '/dashboard');
      cy.shouldBeLoggedIn();
      cy.getByTestId('user-menu').should('contain', 'Test User');

      cy.endPerformanceMonitoring('user-login');
    });

    it('should reject login with invalid credentials', () => {
      cy.visit('/login');

      // Test invalid email
      cy.getByTestId('email-input').type('nonexistent@globaltaxcalc.com');
      cy.getByTestId('password-input').type('TestPassword123!');
      cy.getByTestId('login-button').click();
      cy.shouldShowError('Invalid email or password');

      // Test invalid password
      cy.getByTestId('email-input').clear().type('test@globaltaxcalc.com');
      cy.getByTestId('password-input').clear().type('wrongpassword');
      cy.getByTestId('login-button').click();
      cy.shouldShowError('Invalid email or password');
    });

    it('should handle remember me functionality', () => {
      cy.visit('/login');

      cy.getByTestId('email-input').type('test@globaltaxcalc.com');
      cy.getByTestId('password-input').type('TestPassword123!');
      cy.getByTestId('remember-me-checkbox').check();
      cy.getByTestId('login-button').click();

      cy.shouldBeLoggedIn();

      // Check that session persists after browser restart simulation
      cy.clearSessionStorage();
      cy.reload();
      cy.shouldBeLoggedIn();
    });

    it('should redirect to intended page after login', () => {
      cy.visit('/calculator');
      cy.url().should('include', '/login?redirect=/calculator');

      cy.getByTestId('email-input').type('test@globaltaxcalc.com');
      cy.getByTestId('password-input').type('TestPassword123!');
      cy.getByTestId('login-button').click();

      cy.url().should('include', '/calculator');
      cy.shouldBeLoggedIn();
    });
  });

  describe('Password Reset', () => {
    beforeEach(() => {
      cy.seedTestData({
        users: [{
          email: 'test@globaltaxcalc.com',
          firstName: 'Test',
          lastName: 'User'
        }]
      });
    });

    it('should allow password reset request', () => {
      cy.visit('/login');
      cy.getByTestId('forgot-password-link').click();

      cy.url().should('include', '/forgot-password');
      cy.getByTestId('email-input').type('test@globaltaxcalc.com');
      cy.getByTestId('reset-password-button').click();

      cy.shouldShowSuccess('Password reset email sent');
      cy.contains('Check your email for reset instructions').should('be.visible');
    });

    it('should handle invalid email for password reset', () => {
      cy.visit('/forgot-password');

      cy.getByTestId('email-input').type('nonexistent@globaltaxcalc.com');
      cy.getByTestId('reset-password-button').click();

      cy.shouldShowError('Email address not found');
    });

    it('should complete password reset flow', () => {
      // Simulate password reset token
      const resetToken = 'test-reset-token-123';
      cy.visit(`/reset-password?token=${resetToken}`);

      cy.getByTestId('new-password-input').type('NewPassword123!');
      cy.getByTestId('confirm-password-input').type('NewPassword123!');
      cy.getByTestId('update-password-button').click();

      cy.shouldShowSuccess('Password updated successfully');
      cy.url().should('include', '/login');

      // Test login with new password
      cy.getByTestId('email-input').type('test@globaltaxcalc.com');
      cy.getByTestId('password-input').type('NewPassword123!');
      cy.getByTestId('login-button').click();

      cy.shouldBeLoggedIn();
    });
  });

  describe('User Logout', () => {
    beforeEach(() => {
      cy.login();
    });

    it('should log out user and clear session', () => {
      cy.navigateToDashboard();
      cy.shouldBeLoggedIn();

      cy.logout();
      cy.shouldBeLoggedOut();

      // Verify session is cleared
      cy.visit('/dashboard');
      cy.url().should('include', '/login');
    });

    it('should handle logout from multiple tabs', () => {
      cy.shouldBeLoggedIn();

      // Simulate logout from another tab
      cy.clearCookies();
      cy.reload();

      cy.shouldBeLoggedOut();
    });
  });

  describe('Session Management', () => {
    beforeEach(() => {
      cy.login();
    });

    it('should maintain session across page refreshes', () => {
      cy.shouldBeLoggedIn();
      cy.reload();
      cy.shouldBeLoggedIn();
    });

    it('should handle session timeout', () => {
      cy.shouldBeLoggedIn();

      // Simulate session expiration
      cy.setCookie('auth-token', 'expired-token');
      cy.reload();

      cy.shouldBeLoggedOut();
    });

    it('should refresh token automatically', () => {
      cy.shouldBeLoggedIn();

      // Intercept token refresh
      cy.intercept('POST', '**/api/auth/refresh', {
        statusCode: 200,
        body: { token: 'new-token' }
      }).as('tokenRefresh');

      // Trigger token refresh (simulate near expiration)
      cy.window().then((win) => {
        win.dispatchEvent(new Event('token-refresh'));
      });

      cy.wait('@tokenRefresh');
      cy.shouldBeLoggedIn();
    });
  });

  describe('Security Features', () => {
    it('should prevent CSRF attacks', () => {
      cy.visit('/login');

      // Check for CSRF token
      cy.get('meta[name="csrf-token"]').should('exist');
      cy.get('input[name="_token"]').should('exist');
    });

    it('should handle rate limiting', () => {
      cy.visit('/login');

      // Make multiple failed login attempts
      for (let i = 0; i < 5; i++) {
        cy.getByTestId('email-input').clear().type('test@globaltaxcalc.com');
        cy.getByTestId('password-input').clear().type('wrongpassword');
        cy.getByTestId('login-button').click();
        cy.wait(1000);
      }

      cy.shouldShowError('Too many login attempts. Please try again later.');
      cy.getByTestId('login-button').should('be.disabled');
    });

    it('should enforce password complexity', () => {
      cy.visit('/register');

      const weakPasswords = [
        'password',
        '123456',
        'qwerty',
        'abc123'
      ];

      weakPasswords.forEach((password) => {
        cy.getByTestId('password-input').clear().type(password);
        cy.getByTestId('password-strength-indicator')
          .should('contain', 'Weak')
          .and('have.class', 'strength-weak');
      });

      cy.getByTestId('password-input').clear().type('StrongPassword123!');
      cy.getByTestId('password-strength-indicator')
        .should('contain', 'Strong')
        .and('have.class', 'strength-strong');
    });
  });
});