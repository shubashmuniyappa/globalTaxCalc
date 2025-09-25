/**
 * E2E Tests for Subscription and Payment Flow
 * Tests the complete payment and subscription workflow
 */

describe('Subscription and Payment Flow', () => {
  beforeEach(() => {
    cy.clearUserData();
    cy.login();
  });

  describe('Premium Plan Selection', () => {
    it('should display available premium plans', () => {
      cy.visit('/pricing');
      cy.auditPageAccessibility('pricing');

      // Verify plan cards are displayed
      cy.getByTestId('basic-plan-card').should('be.visible');
      cy.getByTestId('premium-plan-card').should('be.visible');
      cy.getByTestId('pro-plan-card').should('be.visible');

      // Verify plan details
      cy.getByTestId('premium-plan-features').should('contain', 'Unlimited calculations');
      cy.getByTestId('premium-plan-features').should('contain', 'Multi-country support');
      cy.getByTestId('premium-plan-features').should('contain', 'Priority support');

      // Verify pricing
      cy.getByTestId('premium-monthly-price').should('contain', '$9.99');
      cy.getByTestId('premium-annual-price').should('contain', '$99.99');
    });

    it('should allow plan comparison', () => {
      cy.visit('/pricing');

      cy.getByTestId('compare-plans-button').click();
      cy.getByTestId('plan-comparison-table').should('be.visible');

      // Verify comparison features
      cy.getByTestId('feature-calculations').should('be.visible');
      cy.getByTestId('feature-countries').should('be.visible');
      cy.getByTestId('feature-support').should('be.visible');
      cy.getByTestId('feature-reports').should('be.visible');
    });

    it('should select premium monthly plan', () => {
      cy.startPerformanceMonitoring();

      cy.visit('/pricing');
      cy.selectPremiumPlan('monthly');

      // Verify checkout page
      cy.url().should('include', '/checkout');
      cy.getByTestId('selected-plan').should('contain', 'Premium Monthly');
      cy.getByTestId('plan-price').should('contain', '$9.99');
      cy.getByTestId('billing-cycle').should('contain', 'Monthly');

      cy.endPerformanceMonitoring('plan-selection');
    });

    it('should select premium annual plan with discount', () => {
      cy.visit('/pricing');
      cy.getByTestId('annual-toggle').click();
      cy.selectPremiumPlan('annual');

      cy.url().should('include', '/checkout');
      cy.getByTestId('selected-plan').should('contain', 'Premium Annual');
      cy.getByTestId('plan-price').should('contain', '$99.99');
      cy.getByTestId('discount-amount').should('contain', 'Save $19.89');
    });
  });

  describe('Checkout Process', () => {
    beforeEach(() => {
      cy.visit('/pricing');
      cy.selectPremiumPlan('monthly');
    });

    it('should complete payment with valid card', () => {
      cy.startPerformanceMonitoring();

      cy.auditPageAccessibility('checkout');

      // Fill payment form
      cy.fillPaymentForm({
        cardNumber: '4242424242424242',
        expiryMonth: '12',
        expiryYear: '2025',
        cvc: '123',
        name: 'John Doe',
        address: '123 Test Street',
        city: 'San Francisco',
        state: 'CA',
        zipCode: '94105'
      });

      // Complete purchase
      cy.completePurchase();

      // Verify success
      cy.url().should('include', '/confirmation');
      cy.getByTestId('payment-success-message').should('be.visible');
      cy.getByTestId('subscription-id').should('be.visible');
      cy.getByTestId('next-billing-date').should('be.visible');

      cy.endPerformanceMonitoring('payment-completion');
    });

    it('should handle payment with different card types', () => {
      const cardTypes = [
        { type: 'Visa', number: '4242424242424242' },
        { type: 'Mastercard', number: '5555555555554444' },
        { type: 'American Express', number: '378282246310005' }
      ];

      cardTypes.forEach((card) => {
        cy.visit('/pricing');
        cy.selectPremiumPlan('monthly');

        cy.fillPaymentForm({ cardNumber: card.number });
        cy.getByTestId('card-type-indicator').should('contain', card.type);

        cy.completePurchase();
        cy.shouldShowSuccess('Payment successful');

        // Clean up for next iteration
        cy.visit('/account/subscription');
        cy.getByTestId('cancel-subscription-button').click();
        cy.getByTestId('confirm-cancellation-button').click();
      });
    });

    it('should apply promo codes', () => {
      cy.getByTestId('promo-code-toggle').click();
      cy.getByTestId('promo-code-input').type('SAVE20');
      cy.getByTestId('apply-promo-button').click();

      cy.shouldShowSuccess('Promo code applied');
      cy.getByTestId('discount-amount').should('contain', '20% off');
      cy.getByTestId('final-price').should('contain', '$7.99');
    });

    it('should handle invalid promo codes', () => {
      cy.getByTestId('promo-code-toggle').click();
      cy.getByTestId('promo-code-input').type('INVALID');
      cy.getByTestId('apply-promo-button').click();

      cy.shouldShowError('Invalid promo code');
      cy.getByTestId('discount-amount').should('not.exist');
    });

    it('should validate payment form fields', () => {
      cy.getByTestId('complete-purchase-button').click();

      // Check validation errors
      cy.shouldShowError('Please enter a valid card number');
      cy.getByTestId('card-number-input').should('have.class', 'error');

      // Test invalid card number
      cy.getByTestId('card-number-input').type('1234567890123456');
      cy.getByTestId('complete-purchase-button').click();
      cy.shouldShowError('Invalid card number');

      // Test expired card
      cy.fillPaymentForm({
        cardNumber: '4242424242424242',
        expiryMonth: '12',
        expiryYear: '2020'
      });
      cy.getByTestId('complete-purchase-button').click();
      cy.shouldShowError('Card has expired');
    });

    it('should handle declined payments', () => {
      // Use test card that will be declined
      cy.fillPaymentForm({
        cardNumber: '4000000000000002'
      });

      cy.getByTestId('complete-purchase-button').click();

      cy.shouldShowError('Your card was declined');
      cy.getByTestId('retry-payment-button').should('be.visible');
      cy.getByTestId('change-payment-method-button').should('be.visible');
    });
  });

  describe('Subscription Management', () => {
    beforeEach(() => {
      // Setup user with active subscription
      cy.seedTestData({
        subscriptions: [{
          userId: 'test-user-id',
          planId: 'premium_monthly',
          status: 'active',
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }]
      });
    });

    it('should display subscription details', () => {
      cy.visit('/account/subscription');
      cy.auditPageAccessibility('subscription-management');

      cy.getByTestId('current-plan').should('contain', 'Premium Monthly');
      cy.getByTestId('subscription-status').should('contain', 'Active');
      cy.getByTestId('next-billing-date').should('be.visible');
      cy.getByTestId('billing-amount').should('contain', '$9.99');
    });

    it('should allow plan upgrades', () => {
      cy.visit('/account/subscription');

      cy.getByTestId('upgrade-plan-button').click();
      cy.getByTestId('pro-plan-option').click();
      cy.getByTestId('confirm-upgrade-button').click();

      cy.shouldShowSuccess('Plan upgraded successfully');
      cy.getByTestId('current-plan').should('contain', 'Pro Monthly');
    });

    it('should allow plan downgrades', () => {
      cy.visit('/account/subscription');

      cy.getByTestId('change-plan-button').click();
      cy.getByTestId('basic-plan-option').click();
      cy.getByTestId('confirm-downgrade-button').click();

      cy.getByTestId('downgrade-confirmation-modal').should('be.visible');
      cy.getByTestId('acknowledge-feature-loss').check();
      cy.getByTestId('confirm-downgrade-final').click();

      cy.shouldShowSuccess('Plan will be downgraded at next billing cycle');
    });

    it('should update payment method', () => {
      cy.visit('/account/subscription');

      cy.getByTestId('update-payment-method-button').click();
      cy.getByTestId('payment-method-modal').should('be.visible');

      cy.fillPaymentForm({
        cardNumber: '5555555555554444',
        name: 'Updated Card'
      });

      cy.getByTestId('save-payment-method-button').click();

      cy.shouldShowSuccess('Payment method updated');
      cy.getByTestId('current-payment-method').should('contain', '**** 4444');
    });

    it('should handle billing address updates', () => {
      cy.visit('/account/subscription');

      cy.getByTestId('billing-address-section').click();
      cy.getByTestId('edit-billing-address-button').click();

      cy.getByTestId('billing-address-input').clear().type('456 New Street');
      cy.getByTestId('billing-city-input').clear().type('Los Angeles');
      cy.getByTestId('billing-state-select').select('CA');
      cy.getByTestId('billing-zip-input').clear().type('90210');

      cy.getByTestId('save-billing-address-button').click();

      cy.shouldShowSuccess('Billing address updated');
    });

    it('should pause subscription', () => {
      cy.visit('/account/subscription');

      cy.getByTestId('pause-subscription-button').click();
      cy.getByTestId('pause-duration-select').select('3 months');
      cy.getByTestId('pause-reason-select').select('financial_hardship');
      cy.getByTestId('confirm-pause-button').click();

      cy.shouldShowSuccess('Subscription paused');
      cy.getByTestId('subscription-status').should('contain', 'Paused');
      cy.getByTestId('resume-date').should('be.visible');
    });

    it('should cancel subscription', () => {
      cy.visit('/account/subscription');

      cy.getByTestId('cancel-subscription-button').click();
      cy.getByTestId('cancellation-modal').should('be.visible');

      // Fill cancellation survey
      cy.getByTestId('cancellation-reason-select').select('too_expensive');
      cy.getByTestId('cancellation-feedback-textarea').type('Testing cancellation flow');

      cy.getByTestId('confirm-cancellation-button').click();

      cy.shouldShowSuccess('Subscription cancelled');
      cy.getByTestId('subscription-status').should('contain', 'Cancelled');
      cy.getByTestId('access-until-date').should('be.visible');
    });
  });

  describe('Billing and Invoices', () => {
    beforeEach(() => {
      cy.seedTestData({
        subscriptions: [{
          userId: 'test-user-id',
          planId: 'premium_monthly',
          status: 'active'
        }],
        invoices: [
          {
            id: 'inv_001',
            amount: 999,
            status: 'paid',
            date: '2024-01-01'
          },
          {
            id: 'inv_002',
            amount: 999,
            status: 'paid',
            date: '2024-02-01'
          }
        ]
      });
    });

    it('should display billing history', () => {
      cy.visit('/account/billing');
      cy.auditPageAccessibility('billing-history');

      cy.getByTestId('invoice-list').should('be.visible');
      cy.getByTestId('invoice-inv_001').should('contain', '$9.99');
      cy.getByTestId('invoice-inv_002').should('contain', '$9.99');

      // Check invoice details
      cy.getByTestId('invoice-inv_001').click();
      cy.getByTestId('invoice-details-modal').should('be.visible');
      cy.getByTestId('invoice-amount').should('contain', '$9.99');
      cy.getByTestId('invoice-date').should('be.visible');
      cy.getByTestId('payment-method').should('be.visible');
    });

    it('should download invoice PDF', () => {
      cy.visit('/account/billing');

      cy.getByTestId('invoice-inv_001').within(() => {
        cy.getByTestId('download-invoice-button').click();
      });

      // Verify download initiated
      cy.getByTestId('download-status').should('contain', 'Downloading');
    });

    it('should handle failed payments', () => {
      cy.seedTestData({
        invoices: [{
          id: 'inv_failed',
          amount: 999,
          status: 'payment_failed',
          date: '2024-03-01'
        }]
      });

      cy.visit('/account/billing');

      cy.getByTestId('failed-payment-alert').should('be.visible');
      cy.getByTestId('retry-payment-button').should('be.visible');

      cy.getByTestId('retry-payment-button').click();
      cy.getByTestId('payment-retry-modal').should('be.visible');

      cy.fillPaymentForm({
        cardNumber: '4242424242424242'
      });

      cy.getByTestId('submit-payment-button').click();
      cy.shouldShowSuccess('Payment processed successfully');
    });

    it('should update billing preferences', () => {
      cy.visit('/account/billing');

      cy.getByTestId('billing-preferences-section').click();
      cy.getByTestId('email-invoices-checkbox').check();
      cy.getByTestId('invoice-email-input').type('billing@example.com');
      cy.getByTestId('billing-notifications-checkbox').check();

      cy.getByTestId('save-preferences-button').click();

      cy.shouldShowSuccess('Billing preferences updated');
    });
  });

  describe('Tax Calculations for Subscription', () => {
    it('should apply correct tax rates based on location', () => {
      cy.visit('/pricing');

      // Test different locations
      const locations = [
        { country: 'US', state: 'CA', expectedTax: true },
        { country: 'US', state: 'OR', expectedTax: false },
        { country: 'CA', province: 'ON', expectedTax: true },
        { country: 'UK', expectedTax: true }
      ];

      locations.forEach((location) => {
        cy.getByTestId('billing-location-selector').click();

        if (location.country === 'US') {
          cy.getByTestId('country-select').select('US');
          cy.getByTestId('state-select').select(location.state);
        } else {
          cy.getByTestId('country-select').select(location.country);
          if (location.province) {
            cy.getByTestId('province-select').select(location.province);
          }
        }

        cy.getByTestId('update-location-button').click();

        if (location.expectedTax) {
          cy.getByTestId('tax-amount').should('be.visible');
          cy.getByTestId('total-with-tax').should('be.visible');
        } else {
          cy.getByTestId('tax-amount').should('not.exist');
        }
      });
    });

    it('should handle VAT for EU customers', () => {
      cy.visit('/pricing');

      cy.getByTestId('billing-location-selector').click();
      cy.getByTestId('country-select').select('DE');
      cy.getByTestId('vat-number-input').type('DE123456789');
      cy.getByTestId('update-location-button').click();

      cy.getByTestId('vat-rate').should('contain', '19%');
      cy.getByTestId('vat-amount').should('be.visible');

      // Test VAT exemption for business customers
      cy.getByTestId('business-customer-checkbox').check();
      cy.getByTestId('vat-amount').should('contain', '$0.00');
    });
  });

  describe('Performance and Security', () => {
    it('should process payments securely', () => {
      cy.visit('/pricing');
      cy.selectPremiumPlan('monthly');

      // Verify secure connection
      cy.location('protocol').should('eq', 'https:');
      cy.get('meta[name="csrf-token"]').should('exist');

      // Check for security indicators
      cy.getByTestId('secure-payment-badge').should('be.visible');
      cy.getByTestId('pci-compliance-badge').should('be.visible');
    });

    it('should handle payment timeouts gracefully', () => {
      cy.visit('/pricing');
      cy.selectPremiumPlan('monthly');

      // Simulate slow payment processing
      cy.intercept('POST', '**/api/payment/process', {
        delay: 30000
      }).as('slowPayment');

      cy.fillPaymentForm();
      cy.getByTestId('complete-purchase-button').click();

      // Should show loading state
      cy.getByTestId('payment-processing-indicator').should('be.visible');
      cy.getByTestId('complete-purchase-button').should('be.disabled');

      // Should handle timeout
      cy.shouldShowError('Payment is taking longer than expected');
      cy.getByTestId('retry-payment-button').should('be.visible');
    });

    it('should maintain session during checkout', () => {
      cy.visit('/pricing');
      cy.selectPremiumPlan('monthly');

      // Simulate session refresh during checkout
      cy.reload();

      // Should maintain checkout state
      cy.url().should('include', '/checkout');
      cy.getByTestId('selected-plan').should('contain', 'Premium Monthly');
    });
  });
});