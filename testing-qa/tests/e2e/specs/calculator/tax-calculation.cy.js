/**
 * E2E Tests for Tax Calculation
 * Tests the complete tax calculation workflow
 */

describe('Tax Calculation', () => {
  beforeEach(() => {
    cy.clearUserData();
    cy.login();
    cy.navigateToCalculator();
  });

  describe('Basic Tax Calculation', () => {
    it('should calculate US federal taxes correctly', () => {
      cy.startPerformanceMonitoring();

      const taxData = {
        income: 75000,
        filingStatus: 'single',
        state: 'CA',
        standardDeduction: true,
        dependents: 0
      };

      cy.auditPageAccessibility('tax-calculator');

      // Fill tax form
      cy.fillTaxForm(taxData);

      // Calculate taxes
      cy.calculateTax();

      // Verify results
      cy.shouldHaveCalculationResults();
      cy.getByTestId('federal-tax').should('contain', '$');
      cy.getByTestId('state-tax').should('contain', '$');
      cy.getByTestId('total-tax').should('contain', '$');

      // Verify calculation breakdown
      cy.getByTestId('calculation-breakdown').should('be.visible');
      cy.getByTestId('taxable-income').should('contain', '$');
      cy.getByTestId('deductions-applied').should('contain', '$');

      cy.endPerformanceMonitoring('tax-calculation');
    });

    it('should handle different filing statuses', () => {
      const filingStatuses = ['single', 'married-jointly', 'married-separately', 'head-of-household'];

      filingStatuses.forEach((status) => {
        cy.getByTestId('filing-status-select').select(status);
        cy.fillTaxForm({ income: 60000, filingStatus: status });
        cy.calculateTax();

        cy.shouldHaveCalculationResults();
        cy.getByTestId('filing-status-display').should('contain', status);

        // Verify results vary by filing status
        cy.getByTestId('tax-owed-amount').should('be.visible');
      });
    });

    it('should calculate taxes for different income brackets', () => {
      const incomes = [25000, 50000, 100000, 200000, 500000];

      incomes.forEach((income) => {
        cy.getByTestId('income-input').clear().type(income.toString());
        cy.calculateTax();

        cy.shouldHaveCalculationResults();

        // Verify progressive tax calculation
        cy.getByTestId('marginal-rate').should('be.visible');
        cy.getByTestId('effective-rate').should('be.visible');

        // Higher incomes should have higher effective rates
        if (income > 100000) {
          cy.getByTestId('effective-rate').invoke('text').then((rate) => {
            const effectiveRate = parseFloat(rate.replace('%', ''));
            expect(effectiveRate).to.be.above(15);
          });
        }
      });
    });

    it('should handle standard vs itemized deductions', () => {
      const income = 75000;

      // Test standard deduction
      cy.fillTaxForm({ income, standardDeduction: true });
      cy.calculateTax();

      cy.shouldHaveCalculationResults();
      cy.getByTestId('deduction-type').should('contain', 'Standard');

      let standardDeductionTax;
      cy.getByTestId('tax-owed-amount').invoke('text').then((text) => {
        standardDeductionTax = parseFloat(text.replace(/[$,]/g, ''));
      });

      // Test itemized deductions
      cy.getByTestId('itemized-deduction-radio').check();
      cy.getByTestId('charitable-deduction-input').type('10000');
      cy.getByTestId('medical-deduction-input').type('5000');
      cy.getByTestId('mortgage-interest-input').type('8000');

      cy.calculateTax();

      cy.shouldHaveCalculationResults();
      cy.getByTestId('deduction-type').should('contain', 'Itemized');

      // Itemized deductions should result in different tax amount
      cy.getByTestId('tax-owed-amount').invoke('text').then((text) => {
        const itemizedDeductionTax = parseFloat(text.replace(/[$,]/g, ''));
        expect(itemizedDeductionTax).to.not.equal(standardDeductionTax);
      });
    });
  });

  describe('Multi-State Tax Calculation', () => {
    it('should calculate state taxes for different states', () => {
      const states = [
        { code: 'CA', name: 'California', hasTax: true },
        { code: 'TX', name: 'Texas', hasTax: false },
        { code: 'NY', name: 'New York', hasTax: true },
        { code: 'FL', name: 'Florida', hasTax: false }
      ];

      states.forEach((state) => {
        cy.fillTaxForm({
          income: 75000,
          state: state.code
        });

        cy.calculateTax();
        cy.shouldHaveCalculationResults();

        if (state.hasTax) {
          cy.getByTestId('state-tax').should('not.contain', '$0.00');
        } else {
          cy.getByTestId('state-tax').should('contain', '$0.00');
        }

        cy.getByTestId('state-name').should('contain', state.name);
      });
    });

    it('should handle multi-state income scenarios', () => {
      cy.getByTestId('multi-state-toggle').click();

      // Add second state
      cy.getByTestId('add-state-button').click();
      cy.getByTestId('state-2-select').select('NY');
      cy.getByTestId('state-2-income').type('30000');

      // Primary state
      cy.fillTaxForm({
        income: 50000,
        state: 'CA'
      });

      cy.calculateTax();

      cy.shouldHaveCalculationResults();
      cy.getByTestId('total-state-tax').should('be.visible');
      cy.getByTestId('state-tax-breakdown').should('contain', 'CA');
      cy.getByTestId('state-tax-breakdown').should('contain', 'NY');
    });
  });

  describe('International Tax Calculation', () => {
    it('should calculate Canadian taxes', () => {
      cy.selectCountry('CA');

      cy.fillCanadianTaxForm({
        income: 75000,
        province: 'ON',
        rrspContribution: 5000
      });

      cy.calculateTax();

      cy.shouldHaveCalculationResults();
      cy.getByTestId('federal-tax-ca').should('be.visible');
      cy.getByTestId('provincial-tax').should('be.visible');
      cy.getByTestId('gst-hst').should('be.visible');
      cy.getByTestId('cpp-contribution').should('be.visible');
      cy.getByTestId('ei-contribution').should('be.visible');
    });

    it('should handle currency conversion', () => {
      cy.selectCountry('CA');

      cy.getByTestId('currency-display-toggle').click();
      cy.getByTestId('currency-selector').select('USD');

      cy.fillCanadianTaxForm({ income: 75000 });
      cy.calculateTax();

      cy.shouldHaveCalculationResults();
      cy.getByTestId('currency-indicator').should('contain', 'USD');
      cy.getByTestId('exchange-rate-info').should('be.visible');
    });

    it('should calculate UK taxes', () => {
      cy.selectCountry('UK');

      cy.getByTestId('income-input').type('50000');
      cy.getByTestId('tax-year-select').select('2024-25');
      cy.getByTestId('pension-contribution-input').type('3000');

      cy.calculateTax();

      cy.shouldHaveCalculationResults();
      cy.getByTestId('income-tax-uk').should('be.visible');
      cy.getByTestId('national-insurance').should('be.visible');
      cy.getByTestId('personal-allowance').should('be.visible');
    });
  });

  describe('Advanced Tax Scenarios', () => {
    it('should handle capital gains calculations', () => {
      cy.getByTestId('advanced-options-toggle').click();
      cy.getByTestId('capital-gains-section').should('be.visible');

      cy.getByTestId('short-term-gains-input').type('5000');
      cy.getByTestId('long-term-gains-input').type('10000');

      cy.fillTaxForm({ income: 75000 });
      cy.calculateTax();

      cy.shouldHaveCalculationResults();
      cy.getByTestId('capital-gains-tax').should('be.visible');
      cy.getByTestId('total-income-including-gains').should('contain', '$90,000');
    });

    it('should calculate self-employment taxes', () => {
      cy.getByTestId('income-type-select').select('self-employed');

      cy.getByTestId('business-income-input').type('80000');
      cy.getByTestId('business-expenses-input').type('15000');

      cy.calculateTax();

      cy.shouldHaveCalculationResults();
      cy.getByTestId('self-employment-tax').should('be.visible');
      cy.getByTestId('net-business-income').should('contain', '$65,000');
    });

    it('should handle rental income', () => {
      cy.getByTestId('additional-income-toggle').click();
      cy.getByTestId('rental-income-input').type('12000');
      cy.getByTestId('rental-expenses-input').type('3000');

      cy.fillTaxForm({ income: 60000 });
      cy.calculateTax();

      cy.shouldHaveCalculationResults();
      cy.getByTestId('rental-income-tax').should('be.visible');
      cy.getByTestId('total-income').should('contain', '$69,000');
    });
  });

  describe('Tax Credits and Deductions', () => {
    it('should apply child tax credits', () => {
      cy.fillTaxForm({
        income: 75000,
        filingStatus: 'married-jointly'
      });

      cy.getByTestId('dependents-input').type('2');
      cy.getByTestId('child-ages-input').type('8,12');

      cy.calculateTax();

      cy.shouldHaveCalculationResults();
      cy.getByTestId('child-tax-credit').should('be.visible');
      cy.getByTestId('credits-applied').should('contain', 'Child Tax Credit');
    });

    it('should calculate earned income credit', () => {
      cy.fillTaxForm({
        income: 25000,
        filingStatus: 'single'
      });

      cy.getByTestId('dependents-input').type('1');

      cy.calculateTax();

      cy.shouldHaveCalculationResults();
      cy.getByTestId('earned-income-credit').should('be.visible');
      cy.getByTestId('total-credits').should('be.visible');
    });

    it('should handle education credits', () => {
      cy.getByTestId('education-expenses-toggle').click();
      cy.getByTestId('tuition-expenses-input').type('8000');
      cy.getByTestId('education-credit-type').select('american-opportunity');

      cy.fillTaxForm({ income: 50000 });
      cy.calculateTax();

      cy.shouldHaveCalculationResults();
      cy.getByTestId('education-credit').should('be.visible');
    });
  });

  describe('Calculation History and Saving', () => {
    it('should save tax calculations', () => {
      cy.fillTaxForm({ income: 75000 });
      cy.calculateTax();

      cy.saveCalculation('Test Calculation 2024');

      cy.getByTestId('saved-calculations-list').should('contain', 'Test Calculation 2024');
      cy.shouldShowSuccess('Calculation saved successfully');
    });

    it('should load saved calculations', () => {
      // Save a calculation first
      cy.fillTaxForm({ income: 60000, state: 'NY' });
      cy.calculateTax();
      cy.saveCalculation('NY Calculation');

      // Clear form and load saved calculation
      cy.getByTestId('clear-form-button').click();
      cy.getByTestId('saved-calculations-dropdown').select('NY Calculation');
      cy.getByTestId('load-calculation-button').click();

      // Verify data is loaded
      cy.getByTestId('income-input').should('have.value', '60000');
      cy.getByTestId('state-select').should('have.value', 'NY');
    });

    it('should compare multiple calculations', () => {
      // Save first calculation
      cy.fillTaxForm({ income: 75000, state: 'CA' });
      cy.calculateTax();
      cy.saveCalculation('CA Calculation');

      // Save second calculation
      cy.fillTaxForm({ income: 75000, state: 'TX' });
      cy.calculateTax();
      cy.saveCalculation('TX Calculation');

      // Compare calculations
      cy.getByTestId('compare-calculations-button').click();
      cy.getByTestId('comparison-calculation-1').select('CA Calculation');
      cy.getByTestId('comparison-calculation-2').select('TX Calculation');
      cy.getByTestId('run-comparison-button').click();

      cy.getByTestId('comparison-results').should('be.visible');
      cy.getByTestId('tax-difference').should('be.visible');
      cy.getByTestId('savings-amount').should('be.visible');
    });
  });

  describe('Error Handling and Validation', () => {
    it('should validate required fields', () => {
      cy.getByTestId('calculate-button').click();

      cy.shouldShowError('Please enter your income');
      cy.getByTestId('income-input').should('have.class', 'error');
    });

    it('should handle invalid income values', () => {
      cy.getByTestId('income-input').type('-1000');
      cy.getByTestId('calculate-button').click();

      cy.shouldShowError('Income must be a positive number');
    });

    it('should handle extremely large income values', () => {
      cy.getByTestId('income-input').type('999999999999');
      cy.getByTestId('calculate-button').click();

      cy.shouldShowError('Income value is too large');
    });

    it('should handle network errors gracefully', () => {
      cy.intercept('POST', '**/api/tax/calculate', {
        statusCode: 500,
        body: { error: 'Server error' }
      }).as('calculationError');

      cy.fillTaxForm({ income: 75000 });
      cy.getByTestId('calculate-button').click();

      cy.wait('@calculationError');
      cy.shouldShowError('Unable to calculate taxes. Please try again.');
      cy.getByTestId('retry-button').should('be.visible');
    });
  });

  describe('Performance and Optimization', () => {
    it('should calculate taxes within acceptable time', () => {
      cy.fillTaxForm({ income: 75000 });

      const startTime = Date.now();
      cy.calculateTax();

      cy.shouldHaveCalculationResults().then(() => {
        const endTime = Date.now();
        const calculationTime = endTime - startTime;
        expect(calculationTime).to.be.below(5000); // Should complete within 5 seconds
      });
    });

    it('should handle concurrent calculations', () => {
      // Open multiple calculation tabs
      for (let i = 0; i < 3; i++) {
        cy.window().then((win) => {
          win.open('/calculator', `_blank${i}`);
        });
      }

      cy.fillTaxForm({ income: 75000 });
      cy.calculateTax();

      cy.shouldHaveCalculationResults();
    });
  });
});