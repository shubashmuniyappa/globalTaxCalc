'use client';

import * as React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { formatCurrency, formatPercentage } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface IncomeComparisonData {
  income: number;
  federalTax: number;
  stateTax: number;
  totalTax: number;
  netIncome: number;
  effectiveRate: number;
  marginalRate: number;
}

interface IncomeComparisonProps {
  currentIncome: number;
  className?: string;
}

export function IncomeComparison({ currentIncome, className }: IncomeComparisonProps) {
  // Generate data points around the current income
  const generateComparisonData = React.useMemo(() => {
    const dataPoints: IncomeComparisonData[] = [];
    const minIncome = Math.max(0, currentIncome - 50000);
    const maxIncome = currentIncome + 100000;
    const step = (maxIncome - minIncome) / 20;

    for (let income = minIncome; income <= maxIncome; income += step) {
      // Simplified tax calculation for visualization
      const federalTax = calculateFederalTax(income);
      const stateTax = income * 0.05; // Simplified 5% state tax
      const totalTax = federalTax + stateTax;
      const netIncome = income - totalTax;
      const effectiveRate = income > 0 ? (totalTax / income) * 100 : 0;
      const marginalRate = getMarginalRate(income);

      dataPoints.push({
        income: Math.round(income),
        federalTax: Math.round(federalTax),
        stateTax: Math.round(stateTax),
        totalTax: Math.round(totalTax),
        netIncome: Math.round(netIncome),
        effectiveRate: Number(effectiveRate.toFixed(2)),
        marginalRate,
      });
    }

    return dataPoints;
  }, [currentIncome]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="font-medium text-gray-900 dark:text-gray-100 mb-2">
            Income: {formatCurrency(data.income)}
          </p>
          <div className="space-y-1">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Federal Tax: {formatCurrency(data.federalTax)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              State Tax: {formatCurrency(data.stateTax)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Total Tax: {formatCurrency(data.totalTax)}
            </p>
            <p className="text-sm font-medium text-success-600 dark:text-success-400">
              Take-Home: {formatCurrency(data.netIncome)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Effective Rate: {formatPercentage(data.effectiveRate / 100)}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const currentIncomeData = generateComparisonData.find(
    d => Math.abs(d.income - currentIncome) < 5000
  );

  return (
    <div className={cn('bg-white dark:bg-gray-800 rounded-xl p-6', className)}>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
        Income vs. Take-Home Pay
      </h3>

      <div className="h-80 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={generateComparisonData}>
            <defs>
              <linearGradient id="taxGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis
              dataKey="income"
              className="text-xs fill-gray-600 dark:fill-gray-400"
              tickFormatter={(value) => formatCurrency(value).replace('.00', '')}
            />
            <YAxis
              className="text-xs fill-gray-600 dark:fill-gray-400"
              tickFormatter={(value) => formatCurrency(value).replace('.00', '')}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="income"
              stackId="1"
              stroke="#6b7280"
              fill="url(#incomeGradient)"
              fillOpacity={0.1}
            />
            <Area
              type="monotone"
              dataKey="totalTax"
              stackId="2"
              stroke="#ef4444"
              fill="url(#taxGradient)"
            />
            <Line
              type="monotone"
              dataKey="netIncome"
              stroke="#10b981"
              strokeWidth={3}
              dot={false}
            />
            {/* Highlight current income */}
            {currentIncomeData && (
              <Line
                type="monotone"
                dataKey={() => currentIncomeData.netIncome}
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{
                  fill: '#3b82f6',
                  strokeWidth: 2,
                  r: 6,
                }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Current position indicator */}
      {currentIncomeData && (
        <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-primary-800 dark:text-primary-200">
                Your Position
              </p>
              <p className="text-xs text-primary-600 dark:text-primary-400">
                Income: {formatCurrency(currentIncomeData.income)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-primary-800 dark:text-primary-200">
                Take-Home: {formatCurrency(currentIncomeData.netIncome)}
              </p>
              <p className="text-xs text-primary-600 dark:text-primary-400">
                Effective Rate: {formatPercentage(currentIncomeData.effectiveRate / 100)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Tax rate progression chart
export function TaxRateProgression({ currentIncome, className }: IncomeComparisonProps) {
  const generateRateData = React.useMemo(() => {
    const dataPoints = [];
    const maxIncome = Math.max(200000, currentIncome * 2);
    const step = maxIncome / 50;

    for (let income = 0; income <= maxIncome; income += step) {
      const federalTax = calculateFederalTax(income);
      const stateTax = income * 0.05;
      const totalTax = federalTax + stateTax;
      const effectiveRate = income > 0 ? (totalTax / income) * 100 : 0;
      const marginalRate = getMarginalRate(income);

      dataPoints.push({
        income: Math.round(income),
        effectiveRate: Number(effectiveRate.toFixed(2)),
        marginalRate,
      });
    }

    return dataPoints;
  }, [currentIncome]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="font-medium text-gray-900 dark:text-gray-100">
            Income: {formatCurrency(label)}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatPercentage(entry.value / 100)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className={cn('bg-white dark:bg-gray-800 rounded-xl p-6', className)}>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
        Tax Rate Progression
      </h3>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={generateRateData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis
              dataKey="income"
              className="text-xs fill-gray-600 dark:fill-gray-400"
              tickFormatter={(value) => formatCurrency(value).replace('.00', '')}
            />
            <YAxis
              className="text-xs fill-gray-600 dark:fill-gray-400"
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="effectiveRate"
              stroke="#3b82f6"
              strokeWidth={2}
              name="Effective Rate"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="marginalRate"
              stroke="#ef4444"
              strokeWidth={2}
              name="Marginal Rate"
              dot={false}
              strokeDasharray="5 5"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex items-center justify-center space-x-6">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-0.5 bg-blue-500"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">Effective Rate</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-0.5 bg-red-500" style={{ borderTop: '2px dashed' }}></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">Marginal Rate</span>
        </div>
      </div>
    </div>
  );
}

// Helper functions for tax calculations
function calculateFederalTax(income: number): number {
  const brackets = [
    { min: 0, max: 11000, rate: 0.10 },
    { min: 11000, max: 44725, rate: 0.12 },
    { min: 44725, max: 95375, rate: 0.22 },
    { min: 95375, max: 182050, rate: 0.24 },
    { min: 182050, max: 231250, rate: 0.32 },
    { min: 231250, max: 578125, rate: 0.35 },
    { min: 578125, max: Infinity, rate: 0.37 },
  ];

  let tax = 0;
  let remainingIncome = income;

  for (const bracket of brackets) {
    if (remainingIncome <= 0) break;

    const taxableAtBracket = Math.min(remainingIncome, bracket.max - bracket.min);
    tax += taxableAtBracket * bracket.rate;
    remainingIncome -= taxableAtBracket;
  }

  return tax;
}

function getMarginalRate(income: number): number {
  const brackets = [
    { min: 0, max: 11000, rate: 10 },
    { min: 11000, max: 44725, rate: 12 },
    { min: 44725, max: 95375, rate: 22 },
    { min: 95375, max: 182050, rate: 24 },
    { min: 182050, max: 231250, rate: 32 },
    { min: 231250, max: 578125, rate: 35 },
    { min: 578125, max: Infinity, rate: 37 },
  ];

  for (const bracket of brackets) {
    if (income >= bracket.min && income < bracket.max) {
      return bracket.rate;
    }
  }

  return brackets[brackets.length - 1].rate;
}