import React, { useRef, useState, useCallback } from 'react';
import { VoiceInput } from '../VoiceInput';
import './TaxCalculatorWithVoice.css';

/**
 * Tax Calculator Component with Voice Input Integration
 * Example implementation showing how to integrate voice input with tax calculator
 */
const TaxCalculatorWithVoice = () => {
  const formRef = useRef(null);
  const [formData, setFormData] = useState({
    income: '',
    filingStatus: 'single',
    dependents: '0',
    country: 'US',
    taxYear: '2023',
    additionalIncome: '',
    deductions: ''
  });
  const [calculationResult, setCalculationResult] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Handle form field changes
  const handleFieldChange = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // Handle tax calculation
  const handleCalculate = useCallback(async () => {
    if (!formData.income || isNaN(parseFloat(formData.income))) {
      alert('Please enter a valid income amount');
      return;
    }

    setIsCalculating(true);
    try {
      // Simulate API call to tax calculation service
      await new Promise(resolve => setTimeout(resolve, 1500));

      const income = parseFloat(formData.income);
      const dependents = parseInt(formData.dependents) || 0;

      // Simple tax calculation (for demo purposes)
      let taxRate = 0.22; // Base rate
      if (income < 40000) taxRate = 0.12;
      else if (income < 85000) taxRate = 0.22;
      else if (income < 165000) taxRate = 0.24;
      else taxRate = 0.32;

      // Apply deductions
      const standardDeduction = formData.filingStatus === 'married' ? 25900 : 12950;
      const dependentDeduction = dependents * 2000;
      const additionalDeductions = parseFloat(formData.deductions) || 0;
      const totalDeductions = standardDeduction + dependentDeduction + additionalDeductions;

      const taxableIncome = Math.max(0, income - totalDeductions);
      const federalTax = taxableIncome * taxRate;
      const stateTax = taxableIncome * 0.05; // Simplified state tax
      const totalTax = federalTax + stateTax;

      setCalculationResult({
        grossIncome: income,
        taxableIncome,
        federalTax,
        stateTax,
        totalTax,
        afterTaxIncome: income - totalTax,
        effectiveRate: (totalTax / income) * 100,
        marginalRate: taxRate * 100,
        deductions: totalDeductions
      });

      setShowResults(true);
    } catch (error) {
      console.error('Tax calculation error:', error);
      alert('Error calculating taxes. Please try again.');
    } finally {
      setIsCalculating(false);
    }
  }, [formData]);

  // Handle form clearing
  const handleClearForm = useCallback(() => {
    setFormData({
      income: '',
      filingStatus: 'single',
      dependents: '0',
      country: 'US',
      taxYear: '2023',
      additionalIncome: '',
      deductions: ''
    });
    setCalculationResult(null);
    setShowResults(false);
  }, []);

  // Handle showing help
  const handleShowHelp = useCallback(() => {
    alert('Voice Input Help:\n\nYou can say things like:\n• "I make fifty thousand dollars"\n• "I am married with two kids"\n• "Calculate my taxes"\n• "Clear all fields"');
  }, []);

  // Handle showing results
  const handleShowResults = useCallback(() => {
    if (calculationResult) {
      setShowResults(true);
    } else {
      alert('No calculation results available. Please calculate your taxes first.');
    }
  }, [calculationResult]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatPercentage = (rate) => {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(rate / 100);
  };

  return (
    <div className="tax-calculator-with-voice">
      <div className="calculator-header">
        <h1>🧮 GlobalTaxCalc.com</h1>
        <p>Calculate your taxes with voice input</p>
      </div>

      {/* Voice Input Component */}
      <VoiceInput
        formRef={formRef}
        onCalculate={handleCalculate}
        onClearForm={handleClearForm}
        onShowHelp={handleShowHelp}
        onShowResults={handleShowResults}
      />

      {/* Tax Calculator Form */}
      <form ref={formRef} className="tax-form" id="tax-form">
        <div className="form-section">
          <h3>Basic Information</h3>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="income">Annual Income *</label>
              <input
                type="number"
                id="income"
                name="income"
                className="income-field"
                value={formData.income}
                onChange={(e) => handleFieldChange('income', e.target.value)}
                placeholder="Enter your annual income"
                min="0"
                step="0.01"
              />
            </div>

            <div className="form-group">
              <label htmlFor="filingStatus">Filing Status</label>
              <select
                id="filingStatus"
                name="filingStatus"
                className="filing-status-field"
                value={formData.filingStatus}
                onChange={(e) => handleFieldChange('filingStatus', e.target.value)}
              >
                <option value="single">Single</option>
                <option value="married">Married Filing Jointly</option>
                <option value="marriedFilingSeparately">Married Filing Separately</option>
                <option value="headOfHousehold">Head of Household</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="dependents">Number of Dependents</label>
              <input
                type="number"
                id="dependents"
                name="dependents"
                className="dependents-field"
                value={formData.dependents}
                onChange={(e) => handleFieldChange('dependents', e.target.value)}
                min="0"
                max="20"
              />
            </div>

            <div className="form-group">
              <label htmlFor="country">Country</label>
              <select
                id="country"
                name="country"
                className="country-field"
                value={formData.country}
                onChange={(e) => handleFieldChange('country', e.target.value)}
              >
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="UK">United Kingdom</option>
                <option value="AU">Australia</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="taxYear">Tax Year</label>
              <select
                id="taxYear"
                name="taxYear"
                className="tax-year-field"
                value={formData.taxYear}
                onChange={(e) => handleFieldChange('taxYear', e.target.value)}
              >
                <option value="2023">2023</option>
                <option value="2022">2022</option>
                <option value="2021">2021</option>
                <option value="2020">2020</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Additional Information (Optional)</h3>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="additionalIncome">Additional Income</label>
              <input
                type="number"
                id="additionalIncome"
                name="additionalIncome"
                value={formData.additionalIncome}
                onChange={(e) => handleFieldChange('additionalIncome', e.target.value)}
                placeholder="Freelance, investments, etc."
                min="0"
                step="0.01"
              />
            </div>

            <div className="form-group">
              <label htmlFor="deductions">Additional Deductions</label>
              <input
                type="number"
                id="deductions"
                name="deductions"
                value={formData.deductions}
                onChange={(e) => handleFieldChange('deductions', e.target.value)}
                placeholder="Charitable donations, etc."
                min="0"
                step="0.01"
              />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            onClick={handleCalculate}
            disabled={isCalculating || !formData.income}
            className="calculate-btn"
          >
            {isCalculating ? (
              <>
                <span className="spinner"></span>
                Calculating...
              </>
            ) : (
              '🧮 Calculate Taxes'
            )}
          </button>

          <button
            type="button"
            onClick={handleClearForm}
            className="clear-btn"
          >
            🗑️ Clear Form
          </button>
        </div>
      </form>

      {/* Results Section */}
      {showResults && calculationResult && (
        <div className="results-section" id="results">
          <div className="results-header">
            <h3>📊 Tax Calculation Results</h3>
            <button
              onClick={() => setShowResults(false)}
              className="close-results-btn"
              aria-label="Close results"
            >
              ✕
            </button>
          </div>

          <div className="results-grid">
            <div className="result-card primary">
              <div className="result-label">Total Tax Owed</div>
              <div className="result-value">{formatCurrency(calculationResult.totalTax)}</div>
            </div>

            <div className="result-card">
              <div className="result-label">After-Tax Income</div>
              <div className="result-value">{formatCurrency(calculationResult.afterTaxIncome)}</div>
            </div>

            <div className="result-card">
              <div className="result-label">Effective Tax Rate</div>
              <div className="result-value">{formatPercentage(calculationResult.effectiveRate)}</div>
            </div>

            <div className="result-card">
              <div className="result-label">Marginal Tax Rate</div>
              <div className="result-value">{formatPercentage(calculationResult.marginalRate)}</div>
            </div>
          </div>

          <div className="results-breakdown">
            <h4>Breakdown</h4>
            <div className="breakdown-grid">
              <div className="breakdown-item">
                <span className="breakdown-label">Gross Income:</span>
                <span className="breakdown-value">{formatCurrency(calculationResult.grossIncome)}</span>
              </div>
              <div className="breakdown-item">
                <span className="breakdown-label">Total Deductions:</span>
                <span className="breakdown-value">{formatCurrency(calculationResult.deductions)}</span>
              </div>
              <div className="breakdown-item">
                <span className="breakdown-label">Taxable Income:</span>
                <span className="breakdown-value">{formatCurrency(calculationResult.taxableIncome)}</span>
              </div>
              <div className="breakdown-item">
                <span className="breakdown-label">Federal Tax:</span>
                <span className="breakdown-value">{formatCurrency(calculationResult.federalTax)}</span>
              </div>
              <div className="breakdown-item">
                <span className="breakdown-label">State Tax:</span>
                <span className="breakdown-value">{formatCurrency(calculationResult.stateTax)}</span>
              </div>
            </div>
          </div>

          <div className="results-actions">
            <button className="export-btn">
              📄 Export PDF
            </button>
            <button className="save-btn">
              💾 Save Calculation
            </button>
            <button className="share-btn">
              🔗 Share Results
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="calculator-footer">
        <p>
          <strong>Disclaimer:</strong> This is a simplified tax calculator for demonstration purposes.
          Consult a tax professional for accurate calculations.
        </p>
      </footer>
    </div>
  );
};

export default TaxCalculatorWithVoice;