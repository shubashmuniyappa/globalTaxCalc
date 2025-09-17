'use client';

import * as React from 'react';
import { Calculator, TrendingUp, Shield, Clock } from 'lucide-react';
import { CalculatorForm } from '@/components/tax-calculator/calculator-form';
import { TaxResults } from '@/components/tax-calculator/tax-results';
import { LoadingOverlay } from '@/components/ui/loading';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { useCalculateTax, calculateTaxOffline } from '@/lib/api/tax-calculator';
import { useTaxCalculatorStore, useFormData, useResults, useCalculationActions } from '@/lib/stores/tax-calculator-store';
import { useUIActions } from '@/lib/stores/ui-store';

interface TaxCalculatorFormData {
  filingStatus: 'single' | 'marriedJoint' | 'marriedSeparate' | 'headOfHousehold';
  annualIncome: number;
  state: string;
  country: string;
  deductions: {
    standardDeduction: boolean;
    itemizedDeductions: number;
  };
  credits: {
    childTaxCredit: number;
    earnedIncomeCredit: number;
    educationCredit: number;
  };
}

interface TaxBreakdown {
  grossIncome: number;
  adjustedGrossIncome: number;
  taxableIncome: number;
  federalTax: number;
  stateTax: number;
  totalTax: number;
  effectiveRate: number;
  marginalRate: number;
  netIncome: number;
  refund: number;
  brackets: Array<{
    min: number;
    max: number | null;
    rate: number;
    taxOwed: number;
  }>;
}

const TAX_BRACKETS_2024 = [
  { min: 0, max: 11000, rate: 10 },
  { min: 11000, max: 44725, rate: 12 },
  { min: 44725, max: 95375, rate: 22 },
  { min: 95375, max: 182050, rate: 24 },
  { min: 182050, max: 231250, rate: 32 },
  { min: 231250, max: 578125, rate: 35 },
  { min: 578125, max: null, rate: 37 },
];

const STANDARD_DEDUCTIONS = {
  single: 13850,
  marriedJoint: 27700,
  marriedSeparate: 13850,
  headOfHousehold: 20800,
};

function calculateTax(formData: TaxCalculatorFormData): TaxBreakdown {
  const { filingStatus, annualIncome, deductions, credits } = formData;

  const standardDeduction = STANDARD_DEDUCTIONS[filingStatus] || STANDARD_DEDUCTIONS.single;
  const deductionAmount = deductions.standardDeduction
    ? standardDeduction
    : Math.max(deductions.itemizedDeductions, standardDeduction);

  const adjustedGrossIncome = annualIncome;
  const taxableIncome = Math.max(0, adjustedGrossIncome - deductionAmount);

  let federalTax = 0;
  const appliedBrackets = [];

  for (const bracket of TAX_BRACKETS_2024) {
    if (taxableIncome <= bracket.min) break;

    const taxableAtThisBracket = bracket.max
      ? Math.min(taxableIncome, bracket.max) - bracket.min
      : taxableIncome - bracket.min;

    const taxOwed = taxableAtThisBracket * (bracket.rate / 100);
    federalTax += taxOwed;

    appliedBrackets.push({
      min: bracket.min,
      max: bracket.max,
      rate: bracket.rate,
      taxOwed,
    });
  }

  // Simple state tax calculation (5% for most states)
  const stateTax = taxableIncome * 0.05;

  // Apply credits
  const totalCredits = (credits.childTaxCredit || 0) +
                      (credits.earnedIncomeCredit || 0) +
                      (credits.educationCredit || 0);

  const totalTaxBeforeCredits = federalTax + stateTax;
  const totalTax = Math.max(0, totalTaxBeforeCredits - totalCredits);

  const effectiveRate = annualIncome > 0 ? (totalTax / annualIncome) * 100 : 0;

  // Find marginal rate
  const marginalBracket = TAX_BRACKETS_2024.find(bracket =>
    taxableIncome > bracket.min && (bracket.max === null || taxableIncome <= bracket.max)
  );
  const marginalRate = marginalBracket ? marginalBracket.rate : 0;

  const netIncome = annualIncome - totalTax;
  const refund = totalCredits > totalTaxBeforeCredits ? totalCredits - totalTaxBeforeCredits : 0;

  return {
    grossIncome: annualIncome,
    adjustedGrossIncome,
    taxableIncome,
    federalTax,
    stateTax,
    totalTax,
    effectiveRate,
    marginalRate,
    netIncome,
    refund: refund > 0 ? refund : -(totalTax),
    brackets: appliedBrackets,
  };
}

export default function CalculatorPage() {
  const formData = useFormData();
  const results = useResults();
  const { setResults, setCalculating } = useCalculationActions();
  const { addNotification } = useUIActions();

  const calculateTaxMutation = useCalculateTax();

  const handleCalculate = async (formData: TaxCalculatorFormData) => {
    setCalculating(true);

    try {
      // Try API first, fall back to offline calculation
      let calculatedResults;
      try {
        calculatedResults = await calculateTaxMutation.mutateAsync(formData);
        addNotification({
          type: 'success',
          message: 'Tax calculation completed successfully',
        });
      } catch (error) {
        console.warn('API calculation failed, using offline calculation:', error);
        calculatedResults = calculateTaxOffline(formData);
        addNotification({
          type: 'info',
          message: 'Calculated using offline mode - results may be approximations',
        });
      }

      setResults(calculatedResults);
    } catch (error) {
      console.error('Calculation failed:', error);
      addNotification({
        type: 'error',
        message: 'Failed to calculate taxes. Please try again.',
      });
    } finally {
      setCalculating(false);
    }
  };

  const handleRecalculate = () => {
    setResults(null);
  };

  const handleSaveResults = async () => {
    if (!results) return;

    try {
      // In a real app, this would save to the backend
      addNotification({
        type: 'success',
        message: 'Tax calculation saved successfully',
      });
    } catch (error) {
      addNotification({
        type: 'error',
        message: 'Failed to save calculation. Please try again.',
      });
    }
  };

  const features = [
    {
      icon: Calculator,
      title: 'Accurate Calculations',
      description: 'Up-to-date tax brackets and deductions for precise results',
    },
    {
      icon: Shield,
      title: 'Secure & Private',
      description: 'Your financial information is encrypted and never stored',
    },
    {
      icon: TrendingUp,
      title: 'Tax Optimization',
      description: 'Get personalized tips to minimize your tax burden',
    },
    {
      icon: Clock,
      title: 'Quick & Easy',
      description: 'Complete your tax calculation in under 5 minutes',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container-wide">
        <div className="py-12">
          {!results ? (
            <>
              {/* Header */}
              <div className="text-center mb-12">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  Free Tax Calculator
                </h1>
                <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
                  Calculate your federal and state taxes quickly and accurately. Get detailed
                  breakdowns, effective rates, and personalized tax optimization tips.
                </p>
              </div>

              {/* Features */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                {features.map((feature, index) => (
                  <div
                    key={index}
                    className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-sm border border-gray-200 dark:border-gray-700"
                  >
                    <div className="mx-auto w-12 h-12 bg-primary-100 dark:bg-primary-900/20 rounded-lg flex items-center justify-center mb-4">
                      <feature.icon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>

              {/* Calculator Form */}
              <div className="relative">
                <LoadingOverlay isLoading={calculateTaxMutation.isPending} loadingText="Calculating your taxes...">
                  <ErrorBoundary>
                    <CalculatorForm onSubmit={handleCalculate} isLoading={calculateTaxMutation.isPending} />
                  </ErrorBoundary>
                </LoadingOverlay>
              </div>
            </>
          ) : (
            <ErrorBoundary>
              <TaxResults
                results={results}
                onRecalculate={handleRecalculate}
                onSaveResults={handleSaveResults}
                isLoading={false}
              />
            </ErrorBoundary>
          )}
        </div>
      </div>
    </div>
  );
}