'use client';

import * as React from 'react';
import { TrendingUp, TrendingDown, DollarSign, FileText, Download, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatPercentage } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { TaxBreakdownChart, TaxBracketChart } from '@/components/charts/tax-breakdown-chart';
import { IncomeComparison, TaxRateProgression } from '@/components/charts/income-comparison';

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

interface TaxResultsProps {
  results: TaxBreakdown;
  onRecalculate: () => void;
  onSaveResults: () => void;
  isLoading?: boolean;
}

export function TaxResults({ results, onRecalculate, onSaveResults, isLoading = false }: TaxResultsProps) {
  const {
    grossIncome,
    adjustedGrossIncome,
    taxableIncome,
    federalTax,
    stateTax,
    totalTax,
    effectiveRate,
    marginalRate,
    netIncome,
    refund,
    brackets
  } = results;

  const summaryCards = [
    {
      title: 'Total Tax Owed',
      value: formatCurrency(totalTax),
      change: null,
      icon: DollarSign,
      color: 'text-error-600 dark:text-error-400',
      bgColor: 'bg-error-50 dark:bg-error-900/20',
    },
    {
      title: 'Effective Tax Rate',
      value: formatPercentage(effectiveRate / 100),
      change: null,
      icon: TrendingUp,
      color: 'text-warning-600 dark:text-warning-400',
      bgColor: 'bg-warning-50 dark:bg-warning-900/20',
    },
    {
      title: 'After-Tax Income',
      value: formatCurrency(netIncome),
      change: null,
      icon: TrendingUp,
      color: 'text-success-600 dark:text-success-400',
      bgColor: 'bg-success-50 dark:bg-success-900/20',
    },
    {
      title: refund > 0 ? 'Expected Refund' : 'Amount Owed',
      value: formatCurrency(Math.abs(refund)),
      change: null,
      icon: refund > 0 ? TrendingUp : TrendingDown,
      color: refund > 0 ? 'text-success-600 dark:text-success-400' : 'text-error-600 dark:text-error-400',
      bgColor: refund > 0 ? 'bg-success-50 dark:bg-success-900/20' : 'bg-error-50 dark:bg-error-900/20',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Your Tax Calculation Results
        </h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Here's a detailed breakdown of your tax situation
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {summaryCards.map((card, index) => (
          <div
            key={index}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {card.title}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {card.value}
                </p>
              </div>
              <div className={cn('p-3 rounded-lg', card.bgColor)}>
                <card.icon className={cn('h-6 w-6', card.color)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Visual Breakdown Chart */}
        <TaxBreakdownChart
          data={{
            federalTax,
            stateTax,
            socialSecurity: grossIncome * 0.062, // 6.2% Social Security
            medicare: grossIncome * 0.0145, // 1.45% Medicare
            netIncome,
          }}
        />

        {/* Tax Brackets Chart */}
        <TaxBracketChart
          data={brackets.map(bracket => ({
            range: `${formatCurrency(bracket.min).replace('.00', '')} - ${bracket.max ? formatCurrency(bracket.max).replace('.00', '') : 'Above'}`,
            rate: bracket.rate,
            taxOwed: bracket.taxOwed,
            income: bracket.max ? (bracket.max - bracket.min) : grossIncome - bracket.min,
          }))}
        />
      </div>

      {/* Income Comparison Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <IncomeComparison currentIncome={grossIncome} />
        <TaxRateProgression currentIncome={grossIncome} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Detailed Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
            Tax Breakdown
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">Gross Income</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatCurrency(grossIncome)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">Adjusted Gross Income</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatCurrency(adjustedGrossIncome)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">Taxable Income</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatCurrency(taxableIncome)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">Federal Tax</span>
              <span className="font-medium text-error-600 dark:text-error-400">
                {formatCurrency(federalTax)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">State Tax</span>
              <span className="font-medium text-error-600 dark:text-error-400">
                {formatCurrency(stateTax)}
              </span>
            </div>
            <div className="flex justify-between items-center py-3 bg-gray-50 dark:bg-gray-700 -mx-2 px-2 rounded">
              <span className="font-medium text-gray-900 dark:text-gray-100">Total Tax</span>
              <span className="font-bold text-lg text-error-600 dark:text-error-400">
                {formatCurrency(totalTax)}
              </span>
            </div>
          </div>
        </div>

        {/* Tax Brackets */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
            Tax Brackets Applied
          </h3>
          <div className="space-y-3">
            {brackets.map((bracket, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatPercentage(bracket.rate / 100)} Rate
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatCurrency(bracket.min)} - {bracket.max ? formatCurrency(bracket.max) : 'Above'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatCurrency(bracket.taxOwed)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-primary-800 dark:text-primary-200">
                Marginal Tax Rate
              </span>
              <span className="text-lg font-bold text-primary-900 dark:text-primary-100">
                {formatPercentage(marginalRate / 100)}
              </span>
            </div>
            <p className="text-xs text-primary-700 dark:text-primary-300 mt-1">
              Rate applied to your next dollar of income
            </p>
          </div>
        </div>
      </div>

      {/* Tax Savings Tips */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Tax Optimization Tips
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 bg-success-50 dark:bg-success-900/20 rounded-lg">
            <h4 className="font-medium text-success-800 dark:text-success-200 mb-2">
              Retirement Contributions
            </h4>
            <p className="text-sm text-success-700 dark:text-success-300">
              Increase 401(k) or IRA contributions to reduce taxable income
            </p>
          </div>
          <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
            <h4 className="font-medium text-primary-800 dark:text-primary-200 mb-2">
              Health Savings Account
            </h4>
            <p className="text-sm text-primary-700 dark:text-primary-300">
              Maximize HSA contributions for triple tax benefits
            </p>
          </div>
          <div className="p-4 bg-warning-50 dark:bg-warning-900/20 rounded-lg">
            <h4 className="font-medium text-warning-800 dark:text-warning-200 mb-2">
              Tax Loss Harvesting
            </h4>
            <p className="text-sm text-warning-700 dark:text-warning-300">
              Offset capital gains with investment losses
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button
          variant="outline"
          onClick={onRecalculate}
          leftIcon={<FileText className="h-4 w-4" />}
        >
          Recalculate
        </Button>
        <Button
          onClick={onSaveResults}
          leftIcon={<Download className="h-4 w-4" />}
          disabled={isLoading}
          isLoading={isLoading}
        >
          Save Results
        </Button>
        <Button
          variant="outline"
          leftIcon={<Share className="h-4 w-4" />}
        >
          Share Results
        </Button>
      </div>

      {/* Disclaimer */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
          <strong>Disclaimer:</strong> These calculations are estimates for informational purposes only.
          Tax laws are complex and change frequently. For specific tax situations, please consult a
          qualified tax professional or the relevant tax authority. We do not guarantee the accuracy
          of calculations and are not liable for any errors or omissions.
        </p>
      </div>
    </div>
  );
}