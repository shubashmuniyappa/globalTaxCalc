import { useState, useEffect, useMemo, useCallback } from 'react';
import { debounce } from 'lodash';

/**
 * Custom hook for managing chart data and visualization state
 * Provides data processing, caching, and responsive updates for charts
 */
export const useChartData = (initialData = null, options = {}) => {
  const {
    autoRefresh = false,
    refreshInterval = 30000,
    enableCache = true,
    responsive = true,
    debounceMs = 300
  } = options;

  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [cache, setCache] = useState(new Map());

  // Responsive chart dimensions
  useEffect(() => {
    if (!responsive) return;

    const updateDimensions = () => {
      const container = document.querySelector('.chart-container');
      if (container) {
        const rect = container.getBoundingClientRect();
        setDimensions({
          width: rect.width,
          height: rect.height || Math.min(rect.width * 0.6, 400)
        });
      }
    };

    const debouncedUpdate = debounce(updateDimensions, debounceMs);

    updateDimensions();
    window.addEventListener('resize', debouncedUpdate);

    return () => {
      window.removeEventListener('resize', debouncedUpdate);
      debouncedUpdate.cancel();
    };
  }, [responsive, debounceMs]);

  // Data processing utilities
  const processData = useCallback((rawData, type = 'default') => {
    if (!rawData) return null;

    switch (type) {
      case 'taxBrackets':
        return processTaxBracketData(rawData);
      case 'incomeBreakdown':
        return processIncomeBreakdownData(rawData);
      case 'comparison':
        return processComparisonData(rawData);
      case 'trends':
        return processTrendData(rawData);
      default:
        return rawData;
    }
  }, []);

  // Tax bracket data processor
  const processTaxBracketData = useCallback((rawData) => {
    const { income, filingStatus, country, year } = rawData;

    // US Federal Tax Brackets for 2023
    const brackets = {
      single: [
        { min: 0, max: 11000, rate: 0.10, color: '#10b981' },
        { min: 11000, max: 44725, rate: 0.12, color: '#06b6d4' },
        { min: 44725, max: 95375, rate: 0.22, color: '#8b5cf6' },
        { min: 95375, max: 182050, rate: 0.24, color: '#f59e0b' },
        { min: 182050, max: 231250, rate: 0.32, color: '#ef4444' },
        { min: 231250, max: 578125, rate: 0.35, color: '#dc2626' },
        { min: 578125, max: Infinity, rate: 0.37, color: '#991b1b' }
      ],
      married: [
        { min: 0, max: 22000, rate: 0.10, color: '#10b981' },
        { min: 22000, max: 89450, rate: 0.12, color: '#06b6d4' },
        { min: 89450, max: 190750, rate: 0.22, color: '#8b5cf6' },
        { min: 190750, max: 364200, rate: 0.24, color: '#f59e0b' },
        { min: 364200, max: 462500, rate: 0.32, color: '#ef4444' },
        { min: 462500, max: 693750, rate: 0.35, color: '#dc2626' },
        { min: 693750, max: Infinity, rate: 0.37, color: '#991b1b' }
      ]
    };

    const userBrackets = brackets[filingStatus] || brackets.single;
    const userBracket = userBrackets.find(bracket =>
      income >= bracket.min && income < bracket.max
    );

    // Calculate tax per bracket
    let cumulativeTax = 0;
    const bracketCalculations = userBrackets.map((bracket, index) => {
      const taxableInBracket = Math.min(
        Math.max(income - bracket.min, 0),
        bracket.max - bracket.min
      );
      const taxInBracket = taxableInBracket * bracket.rate;
      cumulativeTax += taxInBracket;

      return {
        ...bracket,
        index,
        taxableIncome: taxableInBracket,
        tax: taxInBracket,
        cumulativeTax,
        isUserBracket: bracket === userBracket,
        percentage: income > 0 ? (taxableInBracket / income) * 100 : 0
      };
    }).filter(bracket => bracket.taxableIncome > 0);

    const marginalRate = userBracket?.rate || 0;
    const effectiveRate = income > 0 ? cumulativeTax / income : 0;

    return {
      brackets: bracketCalculations,
      userIncome: income,
      marginalRate,
      effectiveRate,
      totalTax: cumulativeTax,
      userBracket,
      filingStatus,
      country,
      year
    };
  }, []);

  // Income breakdown data processor
  const processIncomeBreakdownData = useCallback((rawData) => {
    const { grossIncome, federalTax, stateTax, socialSecurity, medicare, deductions } = rawData;

    const netIncome = grossIncome - federalTax - stateTax - socialSecurity - medicare;

    return {
      pieData: [
        { label: 'Take Home', value: netIncome, color: '#10b981', percentage: (netIncome / grossIncome) * 100 },
        { label: 'Federal Tax', value: federalTax, color: '#ef4444', percentage: (federalTax / grossIncome) * 100 },
        { label: 'State Tax', value: stateTax, color: '#f59e0b', percentage: (stateTax / grossIncome) * 100 },
        { label: 'Social Security', value: socialSecurity, color: '#8b5cf6', percentage: (socialSecurity / grossIncome) * 100 },
        { label: 'Medicare', value: medicare, color: '#06b6d4', percentage: (medicare / grossIncome) * 100 }
      ].filter(item => item.value > 0),

      waterfallData: [
        { label: 'Gross Income', value: grossIncome, type: 'positive', cumulative: grossIncome },
        { label: 'Federal Tax', value: -federalTax, type: 'negative', cumulative: grossIncome - federalTax },
        { label: 'State Tax', value: -stateTax, type: 'negative', cumulative: grossIncome - federalTax - stateTax },
        { label: 'Social Security', value: -socialSecurity, type: 'negative', cumulative: grossIncome - federalTax - stateTax - socialSecurity },
        { label: 'Medicare', value: -medicare, type: 'negative', cumulative: netIncome },
        { label: 'Net Income', value: netIncome, type: 'total', cumulative: netIncome }
      ],

      barData: {
        gross: grossIncome,
        net: netIncome,
        taxes: federalTax + stateTax + socialSecurity + medicare,
        deductions,
        effectiveRate: ((federalTax + stateTax + socialSecurity + medicare) / grossIncome) * 100
      }
    };
  }, []);

  // Comparison data processor
  const processComparisonData = useCallback((rawData) => {
    const { scenarios, states, years } = rawData;

    if (scenarios) {
      // Scenario comparison (before/after optimization)
      return {
        type: 'scenarios',
        data: scenarios.map((scenario, index) => ({
          ...scenario,
          id: index,
          savings: scenarios[0] && index > 0 ? scenarios[0].totalTax - scenario.totalTax : 0
        }))
      };
    }

    if (states) {
      // State comparison
      return {
        type: 'states',
        data: states.map(state => ({
          ...state,
          rank: states.findIndex(s => s.totalTax >= state.totalTax) + 1
        })).sort((a, b) => a.totalTax - b.totalTax)
      };
    }

    if (years) {
      // Year-over-year comparison
      return {
        type: 'trends',
        data: years.map((year, index) => ({
          ...year,
          change: index > 0 ? year.totalTax - years[index - 1].totalTax : 0,
          changePercent: index > 0 ? ((year.totalTax - years[index - 1].totalTax) / years[index - 1].totalTax) * 100 : 0
        }))
      };
    }

    return rawData;
  }, []);

  // Trend data processor
  const processTrendData = useCallback((rawData) => {
    const { timeline, metric } = rawData;

    return timeline.map((point, index) => ({
      ...point,
      index,
      change: index > 0 ? point.value - timeline[index - 1].value : 0,
      changePercent: index > 0 ? ((point.value - timeline[index - 1].value) / timeline[index - 1].value) * 100 : 0,
      movingAverage: calculateMovingAverage(timeline, index, 3)
    }));
  }, []);

  // Helper function for moving average
  const calculateMovingAverage = (data, index, window) => {
    const start = Math.max(0, index - window + 1);
    const slice = data.slice(start, index + 1);
    return slice.reduce((sum, point) => sum + point.value, 0) / slice.length;
  };

  // Cache management
  const getCachedData = useCallback((key) => {
    if (!enableCache) return null;
    return cache.get(key);
  }, [cache, enableCache]);

  const setCachedData = useCallback((key, data) => {
    if (!enableCache) return;
    setCache(prev => new Map(prev.set(key, {
      data,
      timestamp: Date.now()
    })));
  }, [enableCache]);

  // Data fetching with cache
  const fetchData = useCallback(async (endpoint, params = {}, type = 'default') => {
    const cacheKey = `${endpoint}-${JSON.stringify(params)}`;

    // Check cache first
    const cached = getCachedData(cacheKey);
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 min cache
      setData(processData(cached.data, type));
      return cached.data;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/charts/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const rawData = await response.json();
      const processedData = processData(rawData, type);

      setData(processedData);
      setCachedData(cacheKey, rawData);

      return rawData;
    } catch (err) {
      setError(err.message);
      console.error('Chart data fetch error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [getCachedData, setCachedData, processData]);

  // Update data with processing
  const updateData = useCallback((newData, type = 'default') => {
    const processedData = processData(newData, type);
    setData(processedData);
  }, [processData]);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh || !data) return;

    const interval = setInterval(() => {
      // Re-fetch current data
      if (data.endpoint) {
        fetchData(data.endpoint, data.params, data.type);
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, data, fetchData]);

  // Export utilities
  const exportData = useCallback((format = 'json') => {
    if (!data) return null;

    switch (format) {
      case 'csv':
        return convertToCSV(data);
      case 'json':
        return JSON.stringify(data, null, 2);
      default:
        return data;
    }
  }, [data]);

  const convertToCSV = (data) => {
    if (!data || !Array.isArray(data)) return '';

    const headers = Object.keys(data[0] || {});
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header =>
        JSON.stringify(row[header] || '')
      ).join(','))
    ].join('\n');

    return csvContent;
  };

  // Memoized chart configuration
  const chartConfig = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 750,
      easing: 'easeInOutQuart'
    },
    interaction: {
      intersect: false,
      mode: 'index'
    },
    plugins: {
      legend: {
        display: true,
        position: 'top'
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        titleColor: '#f9fafb',
        bodyColor: '#f9fafb',
        borderColor: '#374151',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(156, 163, 175, 0.1)'
        },
        ticks: {
          color: '#6b7280'
        }
      },
      y: {
        grid: {
          color: 'rgba(156, 163, 175, 0.1)'
        },
        ticks: {
          color: '#6b7280',
          callback: function(value) {
            return new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0
            }).format(value);
          }
        }
      }
    }
  }), []);

  return {
    // Data state
    data,
    loading,
    error,
    dimensions,

    // Data management
    fetchData,
    updateData,
    processData,

    // Cache management
    cache: cache.size,
    clearCache: () => setCache(new Map()),

    // Export utilities
    exportData,

    // Chart configuration
    chartConfig,

    // Utilities
    formatCurrency: (value) => new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value),

    formatPercentage: (value) => new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(value / 100),

    // Responsive helpers
    isMobile: dimensions.width < 768,
    isTablet: dimensions.width >= 768 && dimensions.width < 1024,
    isDesktop: dimensions.width >= 1024
  };
};