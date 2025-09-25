/**
 * Localized Tax Calculator Component
 * Renders country-specific tax calculators with cultural adaptations
 */

import React, { useState, useEffect, useMemo } from 'react';
import { FormattedMessage, FormattedNumber } from 'react-intl';
import { useI18n, useFormattedCurrency } from '../../lib/i18n/IntlProvider';
import { LocalizedTaxContent } from '../../lib/i18n/LocalizedTaxContent';
import { ChartBarIcon, DocumentTextIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

const LocalizedTaxCalculator = ({
  calculatorType = 'income-tax',
  country = 'us',
  className = '',
  showCulturalContext = true,
  showGuidance = true,
  onCalculationComplete,
  initialValues = {}
}) => {
  const { locale, localeConfig, isRTL } = useI18n();
  const [calculatorInterface, setCalculatorInterface] = useState(null);
  const [formData, setFormData] = useState(initialValues);
  const [calculationResults, setCalculationResults] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  // Initialize localized content
  const localizedContent = useMemo(() => new LocalizedTaxContent(), []);

  // Load calculator interface based on country and locale
  useEffect(() => {
    const loadInterface = async () => {
      try {
        const interface_ = localizedContent.getCalculatorInterface(
          calculatorType,
          country,
          locale
        );
        setCalculatorInterface(interface_);
      } catch (error) {
        console.error('Failed to load calculator interface:', error);
      }
    };

    loadInterface();
  }, [calculatorType, country, locale, localizedContent]);

  // Handle form field changes
  const handleFieldChange = (fieldName, value) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));

    // Clear validation error for this field
    if (validationErrors[fieldName]) {
      setValidationErrors(prev => {
        const updated = { ...prev };
        delete updated[fieldName];
        return updated;
      });
    }
  };

  // Validate form data
  const validateForm = () => {
    if (!calculatorInterface) return false;

    const errors = {};
    const fields = calculatorInterface.fields;

    Object.entries(fields).forEach(([fieldName, fieldConfig]) => {
      const value = formData[fieldName];

      // Required field validation
      if (fieldConfig.required && (!value || value === '')) {
        errors[fieldName] = 'forms.validation.required';
      }

      // Type-specific validation
      if (value && fieldConfig.type === 'currency') {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          errors[fieldName] = 'forms.validation.amount';
        } else if (fieldConfig.validation) {
          if (fieldConfig.validation.min !== undefined && numValue < fieldConfig.validation.min) {
            errors[fieldName] = 'forms.validation.minValue';
          }
          if (fieldConfig.validation.max !== undefined && numValue > fieldConfig.validation.max) {
            errors[fieldName] = 'forms.validation.maxValue';
          }
        }
      }

      if (value && fieldConfig.type === 'number') {
        const numValue = parseInt(value);
        if (isNaN(numValue)) {
          errors[fieldName] = 'forms.validation.amount';
        } else if (numValue < (fieldConfig.min || 0)) {
          errors[fieldName] = 'forms.validation.minValue';
        } else if (numValue > (fieldConfig.max || 100)) {
          errors[fieldName] = 'forms.validation.maxValue';
        }
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Calculate tax
  const handleCalculate = async () => {
    if (!validateForm()) return;

    setIsCalculating(true);
    try {
      // Simulate tax calculation (replace with actual calculation logic)
      const income = parseFloat(formData.income || 0);
      const filingStatus = formData.filingStatus || 'single';
      const dependents = parseInt(formData.dependents || 0);

      // Mock calculation results
      const federalTax = income * 0.15; // Simplified calculation
      const stateTax = income * 0.05; // Simplified calculation
      const totalTax = federalTax + stateTax;
      const effectiveRate = income > 0 ? (totalTax / income) * 100 : 0;
      const takeHome = income - totalTax;

      const results = {
        income,
        federalTax,
        stateTax,
        totalTax,
        effectiveRate,
        takeHome,
        filingStatus,
        dependents,
        breakdown: {
          gross: income,
          deductions: income * 0.1, // Simplified
          taxableIncome: income * 0.9,
          taxes: {
            federal: federalTax,
            state: stateTax,
            socialSecurity: income * 0.062,
            medicare: income * 0.0145
          }
        }
      };

      setCalculationResults(results);
      onCalculationComplete?.(results);
    } catch (error) {
      console.error('Calculation failed:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  // Render form field
  const renderField = (fieldName, fieldConfig) => {
    const value = formData[fieldName];
    const hasError = validationErrors[fieldName];

    const baseClasses = `
      w-full px-3 py-2 border rounded-md
      focus:outline-none focus:ring-2 focus:ring-blue-500
      ${hasError ? 'border-red-500' : 'border-gray-300'}
      ${isRTL ? 'text-right' : 'text-left'}
    `;

    switch (fieldConfig.type) {
      case 'currency':
        return (
          <div key={fieldName} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {fieldConfig.label}
              {fieldConfig.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="relative">
              <span className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-2 text-gray-500`}>
                {calculatorInterface.formatting.currency === 'USD' ? '$' : localeConfig.currencySymbol || '$'}
              </span>
              <input
                type="number"
                value={value || ''}
                onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                placeholder={fieldConfig.placeholder}
                className={`${baseClasses} ${isRTL ? 'pr-8' : 'pl-8'}`}
                min={fieldConfig.validation?.min}
                max={fieldConfig.validation?.max}
                step="0.01"
              />
            </div>
            {hasError && (
              <p className="mt-1 text-sm text-red-600">
                <FormattedMessage id={hasError} defaultMessage="Invalid value" />
              </p>
            )}
          </div>
        );

      case 'select':
        return (
          <div key={fieldName} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {fieldConfig.label}
              {fieldConfig.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              value={value || ''}
              onChange={(e) => handleFieldChange(fieldName, e.target.value)}
              className={baseClasses}
            >
              <option value="">
                <FormattedMessage id="common.select" defaultMessage="Select" />
              </option>
              {fieldConfig.options.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {hasError && (
              <p className="mt-1 text-sm text-red-600">
                <FormattedMessage id={hasError} defaultMessage="Invalid value" />
              </p>
            )}
          </div>
        );

      case 'radio':
        return (
          <div key={fieldName} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {fieldConfig.label}
              {fieldConfig.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="space-y-2">
              {fieldConfig.options.map(option => (
                <div key={option.value} className="flex items-center">
                  <input
                    type="radio"
                    id={`${fieldName}_${option.value}`}
                    name={fieldName}
                    value={option.value}
                    checked={value === option.value}
                    onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                    className={`${isRTL ? 'ml-2' : 'mr-2'} text-blue-600`}
                  />
                  <label htmlFor={`${fieldName}_${option.value}`} className="text-sm text-gray-700">
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
            {hasError && (
              <p className="mt-1 text-sm text-red-600">
                <FormattedMessage id={hasError} defaultMessage="Invalid value" />
              </p>
            )}
          </div>
        );

      case 'number':
        return (
          <div key={fieldName} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {fieldConfig.label}
              {fieldConfig.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="number"
              value={value || ''}
              onChange={(e) => handleFieldChange(fieldName, e.target.value)}
              className={baseClasses}
              min={fieldConfig.min}
              max={fieldConfig.max}
            />
            {hasError && (
              <p className="mt-1 text-sm text-red-600">
                <FormattedMessage id={hasError} defaultMessage="Invalid value" />
              </p>
            )}
          </div>
        );

      default:
        return (
          <div key={fieldName} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {fieldConfig.label}
              {fieldConfig.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="text"
              value={value || ''}
              onChange={(e) => handleFieldChange(fieldName, e.target.value)}
              placeholder={fieldConfig.placeholder}
              className={baseClasses}
            />
            {hasError && (
              <p className="mt-1 text-sm text-red-600">
                <FormattedMessage id={hasError} defaultMessage="Invalid value" />
              </p>
            )}
          </div>
        );
    }
  };

  // Render calculation results
  const renderResults = () => {
    if (!calculationResults) return null;

    return (
      <div className="mt-8 p-6 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <ChartBarIcon className="w-5 h-5 mr-2" />
          <FormattedMessage id="calculator.results" defaultMessage="Tax Calculation Results" />
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Summary */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h4 className="font-medium mb-3">
              <FormattedMessage id="calculator.summary" defaultMessage="Tax Summary" />
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>
                  <FormattedMessage id="calculator.taxOwed" defaultMessage="Total Tax Owed" />
                </span>
                <span className="font-semibold text-red-600">
                  <FormattedNumber
                    value={calculationResults.totalTax}
                    style="currency"
                    currency={calculatorInterface.formatting.currency}
                  />
                </span>
              </div>
              <div className="flex justify-between">
                <span>
                  <FormattedMessage id="calculator.effectiveRate" defaultMessage="Effective Tax Rate" />
                </span>
                <span className="font-semibold">
                  <FormattedNumber
                    value={calculationResults.effectiveRate}
                    style="percent"
                    minimumFractionDigits={2}
                    maximumFractionDigits={2}
                  />
                </span>
              </div>
              <div className="flex justify-between">
                <span>
                  <FormattedMessage id="calculator.takeHome" defaultMessage="Take-Home Income" />
                </span>
                <span className="font-semibold text-green-600">
                  <FormattedNumber
                    value={calculationResults.takeHome}
                    style="currency"
                    currency={calculatorInterface.formatting.currency}
                  />
                </span>
              </div>
            </div>
          </div>

          {/* Breakdown */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h4 className="font-medium mb-3">
              <FormattedMessage id="calculator.breakdown" defaultMessage="Tax Breakdown" />
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>
                  <FormattedMessage id="calculator.federalTax" defaultMessage="Federal Tax" />
                </span>
                <span>
                  <FormattedNumber
                    value={calculationResults.federalTax}
                    style="currency"
                    currency={calculatorInterface.formatting.currency}
                  />
                </span>
              </div>
              <div className="flex justify-between">
                <span>
                  <FormattedMessage id="calculator.stateTax" defaultMessage="State Tax" />
                </span>
                <span>
                  <FormattedNumber
                    value={calculationResults.stateTax}
                    style="currency"
                    currency={calculatorInterface.formatting.currency}
                  />
                </span>
              </div>
              {calculationResults.breakdown?.taxes?.socialSecurity && (
                <div className="flex justify-between">
                  <span>
                    <FormattedMessage id="calculator.socialSecurity" defaultMessage="Social Security" />
                  </span>
                  <span>
                    <FormattedNumber
                      value={calculationResults.breakdown.taxes.socialSecurity}
                      style="currency"
                      currency={calculatorInterface.formatting.currency}
                    />
                  </span>
                </div>
              )}
              {calculationResults.breakdown?.taxes?.medicare && (
                <div className="flex justify-between">
                  <span>
                    <FormattedMessage id="calculator.medicare" defaultMessage="Medicare" />
                  </span>
                  <span>
                    <FormattedNumber
                      value={calculationResults.breakdown.taxes.medicare}
                      style="currency"
                      currency={calculatorInterface.formatting.currency}
                    />
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Monthly breakdown */}
        <div className="mt-4 bg-white p-4 rounded-lg shadow">
          <h4 className="font-medium mb-3">
            <FormattedMessage id="calculator.monthlyBreakdown" defaultMessage="Monthly Breakdown" />
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-sm text-gray-600">
                <FormattedMessage id="calculator.monthlyTakeHome" defaultMessage="Monthly Take-Home" />
              </div>
              <div className="font-semibold text-green-600">
                <FormattedNumber
                  value={calculationResults.takeHome / 12}
                  style="currency"
                  currency={calculatorInterface.formatting.currency}
                />
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">
                <FormattedMessage id="calculator.biweeklyTakeHome" defaultMessage="Bi-weekly Take-Home" />
              </div>
              <div className="font-semibold text-green-600">
                <FormattedNumber
                  value={calculationResults.takeHome / 26}
                  style="currency"
                  currency={calculatorInterface.formatting.currency}
                />
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">
                <FormattedMessage id="calculator.weeklyTakeHome" defaultMessage="Weekly Take-Home" />
              </div>
              <div className="font-semibold text-green-600">
                <FormattedNumber
                  value={calculationResults.takeHome / 52}
                  style="currency"
                  currency={calculatorInterface.formatting.currency}
                />
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">
                <FormattedMessage id="calculator.dailyTakeHome" defaultMessage="Daily Take-Home" />
              </div>
              <div className="font-semibold text-green-600">
                <FormattedNumber
                  value={calculationResults.takeHome / 365}
                  style="currency"
                  currency={calculatorInterface.formatting.currency}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render help panel
  const renderHelpPanel = () => {
    if (!showHelp || !calculatorInterface) return null;

    return (
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
        <div className="flex items-start">
          <InformationCircleIcon className="w-5 h-5 text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-blue-800 mb-2">
              <FormattedMessage id="calculator.help" defaultMessage="Calculator Help" />
            </h4>
            <div className="text-sm text-blue-700 space-y-2">
              <p>{calculatorInterface.helpText.general}</p>
              {showCulturalContext && (
                <div>
                  <p className="font-medium">
                    <FormattedMessage id="calculator.culturalContext" defaultMessage="Cultural Context" />
                  </p>
                  <p>{calculatorInterface.helpText.culturalContext}</p>
                </div>
              )}
              {calculatorInterface.helpText.commonConcerns?.length > 0 && (
                <div>
                  <p className="font-medium">
                    <FormattedMessage id="calculator.commonConcerns" defaultMessage="Common Concerns" />
                  </p>
                  <ul className="list-disc list-inside ml-2">
                    {calculatorInterface.helpText.commonConcerns.map((concern, index) => (
                      <li key={index}>{concern}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render disclaimers
  const renderDisclaimers = () => {
    if (!calculatorInterface?.disclaimers) return null;

    return (
      <div className="mt-6 p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
        <div className="flex items-start">
          <InformationCircleIcon className="w-5 h-5 text-yellow-400 mt-0.5 mr-2 flex-shrink-0" />
          <div className="text-sm text-yellow-700">
            {calculatorInterface.disclaimers.map((disclaimer, index) => (
              <p key={index} className={index > 0 ? 'mt-2' : ''}>
                {disclaimer}
              </p>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (!calculatorInterface) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">
          <FormattedMessage id="common.loading" defaultMessage="Loading..." />
        </span>
      </div>
    );
  }

  return (
    <div className={`max-w-4xl mx-auto ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {calculatorInterface.title}
        </h2>
        <p className="text-gray-600">
          {calculatorInterface.description}
        </p>
      </div>

      {/* Calculator Form */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form Fields */}
          <div>
            <h3 className="text-lg font-semibold mb-4">
              <FormattedMessage id="calculator.inputInformation" defaultMessage="Input Information" />
            </h3>
            {Object.entries(calculatorInterface.fields).map(([fieldName, fieldConfig]) =>
              renderField(fieldName, fieldConfig)
            )}

            {/* Calculate Button */}
            <button
              onClick={handleCalculate}
              disabled={isCalculating}
              className={`
                w-full py-3 px-4 rounded-md font-medium
                ${isCalculating
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500'
                }
                text-white transition-colors duration-200
              `}
            >
              {isCalculating ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  <FormattedMessage id="calculator.calculating" defaultMessage="Calculating..." />
                </span>
              ) : (
                <FormattedMessage id="calculator.calculate" defaultMessage="Calculate" />
              )}
            </button>

            {/* Help Toggle */}
            {showGuidance && (
              <button
                onClick={() => setShowHelp(!showHelp)}
                className="mt-2 w-full py-2 px-4 text-sm text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 transition-colors duration-200"
              >
                <InformationCircleIcon className="w-4 h-4 inline mr-1" />
                {showHelp ? (
                  <FormattedMessage id="calculator.hideHelp" defaultMessage="Hide Help" />
                ) : (
                  <FormattedMessage id="calculator.showHelp" defaultMessage="Show Help" />
                )}
              </button>
            )}
          </div>

          {/* Results */}
          <div>
            {calculationResults ? (
              renderResults()
            ) : (
              <div className="text-center text-gray-500 py-12">
                <DocumentTextIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>
                  <FormattedMessage
                    id="calculator.enterDataPrompt"
                    defaultMessage="Enter your information and click calculate to see results"
                  />
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Help Panel */}
      {renderHelpPanel()}

      {/* Disclaimers */}
      {renderDisclaimers()}
    </div>
  );
};

export default LocalizedTaxCalculator;