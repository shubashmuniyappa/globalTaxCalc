'use client';

import * as React from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCurrency, formatPercentage } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface TaxBreakdownData {
  federalTax: number;
  stateTax: number;
  socialSecurity: number;
  medicare: number;
  netIncome: number;
}

interface TaxBracketData {
  range: string;
  rate: number;
  taxOwed: number;
  income: number;
}

interface TaxBreakdownChartProps {
  data: TaxBreakdownData;
  className?: string;
}

interface TaxBracketChartProps {
  data: TaxBracketData[];
  className?: string;
}

const COLORS = {
  federalTax: '#ef4444', // red-500
  stateTax: '#f97316', // orange-500
  socialSecurity: '#8b5cf6', // violet-500
  medicare: '#06b6d4', // cyan-500
  netIncome: '#10b981', // emerald-500
};

export function TaxBreakdownChart({ data, className }: TaxBreakdownChartProps) {
  const pieData = [
    {
      name: 'Federal Tax',
      value: data.federalTax,
      color: COLORS.federalTax,
    },
    {
      name: 'State Tax',
      value: data.stateTax,
      color: COLORS.stateTax,
    },
    {
      name: 'Social Security',
      value: data.socialSecurity,
      color: COLORS.socialSecurity,
    },
    {
      name: 'Medicare',
      value: data.medicare,
      color: COLORS.medicare,
    },
    {
      name: 'Take-Home Pay',
      value: data.netIncome,
      color: COLORS.netIncome,
    },
  ].filter(item => item.value > 0);

  const totalTax = data.federalTax + data.stateTax + data.socialSecurity + data.medicare;
  const totalIncome = totalTax + data.netIncome;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const percentage = ((data.value / totalIncome) * 100).toFixed(1);
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="font-medium text-gray-900 dark:text-gray-100">{data.name}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {formatCurrency(data.value)} ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null; // Don't show labels for slices less than 5%

    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className={cn('bg-white dark:bg-gray-800 rounded-xl p-6', className)}>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
        Income Distribution
      </h3>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={CustomLabel}
              outerRadius={120}
              fill="#8884d8"
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-3 mt-6">
        {pieData.map((item, index) => (
          <div key={index} className="flex items-center space-x-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {item.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatCurrency(item.value)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TaxBracketChart({ data, className }: TaxBracketChartProps) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="font-medium text-gray-900 dark:text-gray-100">{label}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Rate: {formatPercentage(data.payload.rate / 100)}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Tax: {formatCurrency(data.value)}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Income: {formatCurrency(data.payload.income)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={cn('bg-white dark:bg-gray-800 rounded-xl p-6', className)}>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
        Tax by Bracket
      </h3>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis
              dataKey="range"
              className="text-xs fill-gray-600 dark:fill-gray-400"
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              className="text-xs fill-gray-600 dark:fill-gray-400"
              tickFormatter={(value) => formatCurrency(value).replace('.00', '')}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="taxOwed"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
              className="fill-primary-500"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Brackets</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {data.length}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Highest Rate</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {formatPercentage(Math.max(...data.map(d => d.rate)) / 100)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Comparison Chart for different scenarios
interface ComparisonData {
  scenario: string;
  federalTax: number;
  stateTax: number;
  totalTax: number;
  netIncome: number;
}

interface TaxComparisonChartProps {
  data: ComparisonData[];
  className?: string;
}

export function TaxComparisonChart({ data, className }: TaxComparisonChartProps) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="font-medium text-gray-900 dark:text-gray-100">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
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
        Tax Scenario Comparison
      </h3>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis
              dataKey="scenario"
              className="text-xs fill-gray-600 dark:fill-gray-400"
            />
            <YAxis
              className="text-xs fill-gray-600 dark:fill-gray-400"
              tickFormatter={(value) => formatCurrency(value).replace('.00', '')}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar
              dataKey="federalTax"
              stackId="a"
              fill={COLORS.federalTax}
              name="Federal Tax"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="stateTax"
              stackId="a"
              fill={COLORS.stateTax}
              name="State Tax"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}