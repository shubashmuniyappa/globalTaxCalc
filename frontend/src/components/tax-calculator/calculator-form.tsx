'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { ChevronLeft, ChevronRight, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useFormAnnouncements } from '@/hooks/use-screen-reader';
import { useKeyboardNavigation } from '@/hooks/use-keyboard-navigation';

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

interface CalculatorFormProps {
  onSubmit: (data: TaxCalculatorFormData) => void;
  isLoading?: boolean;
}

const FILING_STATUS_OPTIONS = [
  { value: 'single', label: 'Single', description: 'Not married' },
  { value: 'marriedJoint', label: 'Married Filing Jointly', description: 'Married, filing together' },
  { value: 'marriedSeparate', label: 'Married Filing Separately', description: 'Married, filing separately' },
  { value: 'headOfHousehold', label: 'Head of Household', description: 'Unmarried with dependents' },
];

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming'
];

const STEP_TITLES = [
  'Personal Information',
  'Income Details',
  'Deductions',
  'Tax Credits',
  'Review & Calculate'
];

export function CalculatorForm({ onSubmit, isLoading = false }: CalculatorFormProps) {
  const [currentStep, setCurrentStep] = React.useState(0);
  const { announceStepChange, announceFormErrors } = useFormAnnouncements();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid }
  } = useForm<TaxCalculatorFormData>({
    defaultValues: {
      filingStatus: 'single',
      annualIncome: 0,
      state: '',
      country: 'United States',
      deductions: {
        standardDeduction: true,
        itemizedDeductions: 0,
      },
      credits: {
        childTaxCredit: 0,
        earnedIncomeCredit: 0,
        educationCredit: 0,
      },
    },
  });

  const watchedValues = watch();
  const totalSteps = STEP_TITLES.length;

  const nextStep = () => {
    if (currentStep < totalSteps - 1) {
      const newStep = currentStep + 1;
      setCurrentStep(newStep);
      announceStepChange(newStep + 1, totalSteps, STEP_TITLES[newStep]);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      const newStep = currentStep - 1;
      setCurrentStep(newStep);
      announceStepChange(newStep + 1, totalSteps, STEP_TITLES[newStep]);
    }
  };

  const onFormSubmit = (data: TaxCalculatorFormData) => {
    const errorCount = Object.keys(errors).length;
    if (errorCount > 0) {
      announceFormErrors(errorCount);
      return;
    }
    onSubmit(data);
  };

  // Keyboard navigation
  useKeyboardNavigation({
    onArrowLeft: prevStep,
    onArrowRight: nextStep,
    enabled: true,
  });

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Filing Status
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {FILING_STATUS_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      'relative flex cursor-pointer rounded-lg border p-4 focus:outline-none transition-colors',
                      watchedValues.filingStatus === option.value
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-300 bg-white hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700'
                    )}
                  >
                    <input
                      type="radio"
                      value={option.value}
                      {...register('filingStatus', { required: 'Filing status is required' })}
                      className="sr-only"
                    />
                    <div className="flex w-full items-center justify-between">
                      <div className="flex items-center">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {option.label}
                          </div>
                          <div className="text-gray-500 dark:text-gray-400">
                            {option.description}
                          </div>
                        </div>
                      </div>
                      {watchedValues.filingStatus === option.value && (
                        <div className="shrink-0 text-primary-600">
                          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              {errors.filingStatus && (
                <p className="mt-2 text-sm text-error-600 dark:text-error-400">
                  {errors.filingStatus.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Country
                </label>
                <Input
                  {...register('country', { required: 'Country is required' })}
                  placeholder="United States"
                  error={errors.country?.message}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  State/Province
                </label>
                <select
                  {...register('state', { required: 'State is required' })}
                  className={cn(
                    'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400',
                    errors.state && 'border-error-300 focus:border-error-500 focus:ring-error-500'
                  )}
                >
                  <option value="">Select a state</option>
                  {US_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
                {errors.state && (
                  <p className="mt-1 text-sm text-error-600 dark:text-error-400">
                    {errors.state.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Annual Income
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Gross Annual Income
                  </label>
                  <Input
                    type="currency"
                    {...register('annualIncome', {
                      required: 'Annual income is required',
                      min: { value: 0, message: 'Income must be positive' },
                      valueAsNumber: true,
                    })}
                    placeholder="0.00"
                    error={errors.annualIncome?.message}
                  />
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Enter your total income before taxes and deductions
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Deductions
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      {...register('deductions.standardDeduction')}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Use Standard Deduction
                    </span>
                  </label>
                  <p className="mt-1 ml-7 text-sm text-gray-500 dark:text-gray-400">
                    Most taxpayers benefit from the standard deduction
                  </p>
                </div>

                {!watchedValues.deductions?.standardDeduction && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Itemized Deductions
                    </label>
                    <Input
                      type="currency"
                      {...register('deductions.itemizedDeductions', {
                        valueAsNumber: true,
                        min: { value: 0, message: 'Deductions must be positive' },
                      })}
                      placeholder="0.00"
                      error={errors.deductions?.itemizedDeductions?.message}
                    />
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Total of mortgage interest, charitable giving, state taxes, etc.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Tax Credits
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Child Tax Credit
                  </label>
                  <Input
                    type="currency"
                    {...register('credits.childTaxCredit', {
                      valueAsNumber: true,
                      min: { value: 0, message: 'Credit must be positive' },
                    })}
                    placeholder="0.00"
                    error={errors.credits?.childTaxCredit?.message}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Earned Income Tax Credit
                  </label>
                  <Input
                    type="currency"
                    {...register('credits.earnedIncomeCredit', {
                      valueAsNumber: true,
                      min: { value: 0, message: 'Credit must be positive' },
                    })}
                    placeholder="0.00"
                    error={errors.credits?.earnedIncomeCredit?.message}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Education Credits
                  </label>
                  <Input
                    type="currency"
                    {...register('credits.educationCredit', {
                      valueAsNumber: true,
                      min: { value: 0, message: 'Credit must be positive' },
                    })}
                    placeholder="0.00"
                    error={errors.credits?.educationCredit?.message}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Review Your Information
              </h3>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Filing Status:
                    </span>
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {FILING_STATUS_OPTIONS.find(opt => opt.value === watchedValues.filingStatus)?.label}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Location:
                    </span>
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {watchedValues.state}, {watchedValues.country}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Annual Income:
                    </span>
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      ${watchedValues.annualIncome?.toLocaleString() || '0'}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Deduction Type:
                    </span>
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {watchedValues.deductions?.standardDeduction ? 'Standard' : 'Itemized'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Step {currentStep + 1} of {totalSteps}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {Math.round(((currentStep + 1) / totalSteps) * 100)}% Complete
          </span>
        </div>
        <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-600 transition-all duration-300 ease-out"
            style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Step title */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {STEP_TITLES[currentStep]}
        </h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Please provide the following information to calculate your taxes.
        </p>
      </div>

      {/* Form content */}
      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          {renderStepContent()}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 0}
            leftIcon={<ChevronLeft className="h-4 w-4" />}
          >
            Previous
          </Button>

          <div className="flex space-x-3">
            {currentStep < totalSteps - 1 ? (
              <Button
                type="button"
                onClick={nextStep}
                rightIcon={<ChevronRight className="h-4 w-4" />}
              >
                Next Step
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!isValid || isLoading}
                leftIcon={<Calculator className="h-4 w-4" />}
                isLoading={isLoading}
              >
                Calculate Taxes
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}