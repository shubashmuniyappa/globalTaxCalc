import axios from 'axios';

/**
 * Chart Data Service
 * Handles API communication for chart data and analytics
 */
class ChartDataService {
  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes

    // Create axios instance with default config
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Request interceptor for authentication
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('Chart Data API Error:', error);

        if (error.response?.status === 401) {
          // Handle authentication errors
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
        }

        return Promise.reject({
          message: error.response?.data?.message || 'An error occurred while fetching chart data',
          status: error.response?.status,
          data: error.response?.data
        });
      }
    );
  }

  // Cache management
  getCachedData(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  setCachedData(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clearCache(pattern = null) {
    if (pattern) {
      for (const [key] of this.cache) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  // Tax Bracket Data
  async getTaxBracketData(params) {
    const { income, filingStatus, country = 'US', year = new Date().getFullYear() } = params;
    const cacheKey = `tax-brackets-${income}-${filingStatus}-${country}-${year}`;

    // Check cache first
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.api.post('/charts/tax-brackets', {
        income,
        filingStatus,
        country,
        year
      });

      const data = response.data;
      this.setCachedData(cacheKey, data);

      return data;
    } catch (error) {
      // Return fallback data if API fails
      console.warn('Using fallback tax bracket data');
      return this.getFallbackTaxBracketData(params);
    }
  }

  // Income Breakdown Data
  async getIncomeBreakdownData(params) {
    const {
      grossIncome,
      federalTax,
      stateTax,
      socialSecurity,
      medicare,
      deductions,
      filingStatus = 'single',
      state = null
    } = params;

    const cacheKey = `income-breakdown-${grossIncome}-${filingStatus}-${state || 'federal'}`;

    // Check cache first
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.api.post('/charts/income-breakdown', {
        grossIncome,
        federalTax,
        stateTax,
        socialSecurity,
        medicare,
        deductions,
        filingStatus,
        state
      });

      const data = response.data;
      this.setCachedData(cacheKey, data);

      return data;
    } catch (error) {
      // Return fallback data if API fails
      console.warn('Using fallback income breakdown data');
      return this.getFallbackIncomeBreakdownData(params);
    }
  }

  // Comparison Data
  async getComparisonData(params) {
    const { type, userIncome, scenarios, states, years } = params;
    const cacheKey = `comparison-${type}-${userIncome}-${JSON.stringify({ scenarios, states, years })}`;

    // Check cache first
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.api.post('/charts/comparison', {
        type,
        userIncome,
        scenarios,
        states,
        years
      });

      const data = response.data;
      this.setCachedData(cacheKey, data);

      return data;
    } catch (error) {
      // Return fallback data if API fails
      console.warn('Using fallback comparison data');
      return this.getFallbackComparisonData(params);
    }
  }

  // State Tax Data
  async getStateTaxData(income, states = []) {
    const cacheKey = `state-tax-${income}-${states.join(',')}`;

    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.api.post('/charts/state-tax', {
        income,
        states
      });

      const data = response.data;
      this.setCachedData(cacheKey, data);

      return data;
    } catch (error) {
      console.warn('Using fallback state tax data');
      return this.getFallbackStateTaxData(income, states);
    }
  }

  // Historical Tax Data
  async getHistoricalTaxData(params) {
    const { income, filingStatus, startYear, endYear } = params;
    const cacheKey = `historical-${income}-${filingStatus}-${startYear}-${endYear}`;

    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.api.post('/charts/historical', {
        income,
        filingStatus,
        startYear,
        endYear
      });

      const data = response.data;
      this.setCachedData(cacheKey, data);

      return data;
    } catch (error) {
      console.warn('Using fallback historical data');
      return this.getFallbackHistoricalData(params);
    }
  }

  // Tax Optimization Scenarios
  async getOptimizationScenarios(params) {
    const { income, currentSituation, filingStatus, dependents } = params;
    const cacheKey = `optimization-${income}-${filingStatus}-${dependents}`;

    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.api.post('/charts/optimization', {
        income,
        currentSituation,
        filingStatus,
        dependents
      });

      const data = response.data;
      this.setCachedData(cacheKey, data);

      return data;
    } catch (error) {
      console.warn('Using fallback optimization data');
      return this.getFallbackOptimizationData(params);
    }
  }

  // Analytics and Tracking
  async trackChartInteraction(eventData) {
    try {
      await this.api.post('/analytics/chart-interaction', {
        ...eventData,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href
      });
    } catch (error) {
      console.warn('Failed to track chart interaction:', error);
    }
  }

  async getUsageAnalytics(timeRange = '30d') {
    try {
      const response = await this.api.get(`/analytics/usage?timeRange=${timeRange}`);
      return response.data;
    } catch (error) {
      console.warn('Failed to get usage analytics:', error);
      return null;
    }
  }

  // Export Data
  async exportChartData(chartType, data, format = 'csv') {
    try {
      const response = await this.api.post('/charts/export', {
        chartType,
        data,
        format
      }, {
        responseType: format === 'pdf' ? 'blob' : 'text'
      });

      return response.data;
    } catch (error) {
      console.error('Failed to export chart data:', error);
      throw error;
    }
  }

  // Fallback Data Methods (for offline functionality)
  getFallbackTaxBracketData({ income, filingStatus }) {
    // US Federal Tax Brackets for 2023 (simplified)
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
        isUserBracket: income >= bracket.min && income < bracket.max,
        percentage: income > 0 ? (taxableInBracket / income) * 100 : 0
      };
    }).filter(bracket => bracket.taxableIncome > 0);

    const userBracket = userBrackets.find(bracket =>
      income >= bracket.min && income < bracket.max
    );

    return {
      brackets: bracketCalculations,
      userIncome: income,
      marginalRate: userBracket?.rate || 0,
      effectiveRate: income > 0 ? cumulativeTax / income : 0,
      totalTax: cumulativeTax,
      userBracket,
      filingStatus
    };
  }

  getFallbackIncomeBreakdownData({ grossIncome, federalTax, stateTax, socialSecurity, medicare }) {
    const netIncome = grossIncome - federalTax - stateTax - socialSecurity - medicare;

    return {
      pieData: [
        { label: 'Take Home', value: netIncome, color: '#10b981', percentage: (netIncome / grossIncome) * 100 },
        { label: 'Federal Tax', value: federalTax, color: '#ef4444', percentage: (federalTax / grossIncome) * 100 },
        { label: 'State Tax', value: stateTax, color: '#f59e0b', percentage: (stateTax / grossIncome) * 100 },
        { label: 'Social Security', value: socialSecurity, color: '#8b5cf6', percentage: (socialSecurity / grossIncome) * 100 },
        { label: 'Medicare', value: medicare, color: '#06b6d4', percentage: (medicare / grossIncome) * 100 }
      ].filter(item => item.value > 0),

      barData: {
        gross: grossIncome,
        net: netIncome,
        taxes: federalTax + stateTax + socialSecurity + medicare,
        effectiveRate: ((federalTax + stateTax + socialSecurity + medicare) / grossIncome) * 100
      }
    };
  }

  getFallbackComparisonData({ type, userIncome }) {
    if (type === 'states') {
      return {
        type: 'states',
        data: [
          { name: 'Wyoming', totalTax: userIncome * 0.16, stateTax: 0, federalTax: userIncome * 0.16, cost: 'Low' },
          { name: 'Nevada', totalTax: userIncome * 0.17, stateTax: 0, federalTax: userIncome * 0.17, cost: 'Medium' },
          { name: 'Florida', totalTax: userIncome * 0.18, stateTax: 0, federalTax: userIncome * 0.18, cost: 'Medium' },
          { name: 'Texas', totalTax: userIncome * 0.19, stateTax: 0, federalTax: userIncome * 0.19, cost: 'Low' },
          { name: 'Colorado', totalTax: userIncome * 0.22, stateTax: userIncome * 0.05, federalTax: userIncome * 0.17, cost: 'High' },
          { name: 'California', totalTax: userIncome * 0.35, stateTax: userIncome * 0.17, federalTax: userIncome * 0.18, cost: 'Very High' }
        ]
      };
    }

    return { type, data: [] };
  }

  getFallbackStateTaxData(income, states) {
    // Simplified state tax rates
    const stateTaxRates = {
      'California': 0.133,
      'New York': 0.103,
      'Hawaii': 0.11,
      'Oregon': 0.099,
      'Minnesota': 0.0985,
      'New Jersey': 0.1075,
      'Vermont': 0.0875,
      'Iowa': 0.0898,
      'Wisconsin': 0.0765,
      'Maine': 0.0715,
      'Texas': 0,
      'Florida': 0,
      'Nevada': 0,
      'Wyoming': 0,
      'Washington': 0,
      'South Dakota': 0,
      'Alaska': 0,
      'Tennessee': 0,
      'New Hampshire': 0
    };

    return states.map(state => ({
      state,
      taxRate: stateTaxRates[state] || 0.05,
      stateTax: income * (stateTaxRates[state] || 0.05),
      totalTax: income * (0.22 + (stateTaxRates[state] || 0.05)) // Approximate federal + state
    }));
  }

  getFallbackHistoricalData({ income, startYear, endYear }) {
    const years = [];
    for (let year = startYear; year <= endYear; year++) {
      // Simplified historical tax calculation
      const baseRate = 0.22;
      const variance = (Math.sin((year - 2000) * 0.1) * 0.03);
      const effectiveRate = Math.max(0.1, Math.min(0.35, baseRate + variance));

      years.push({
        year,
        totalTax: income * effectiveRate,
        effectiveRate: effectiveRate * 100,
        change: years.length > 0 ? (income * effectiveRate) - years[years.length - 1].totalTax : 0
      });
    }

    return { years };
  }

  getFallbackOptimizationData({ income }) {
    return {
      type: 'scenarios',
      data: [
        { name: 'Current Situation', totalTax: income * 0.24, description: 'No optimization', savings: 0 },
        { name: 'With 401k Max', totalTax: income * 0.20, description: 'Maximize 401k contribution', savings: income * 0.04 },
        { name: 'HSA + 401k', totalTax: income * 0.18, description: 'HSA and 401k optimization', savings: income * 0.06 },
        { name: 'Full Optimization', totalTax: income * 0.15, description: 'All deductions optimized', savings: income * 0.09 }
      ]
    };
  }
}

// Create singleton instance
const chartDataService = new ChartDataService();

// Export methods for easy importing
export const {
  getTaxBracketData,
  getIncomeBreakdownData,
  getComparisonData,
  getStateTaxData,
  getHistoricalTaxData,
  getOptimizationScenarios,
  trackChartInteraction,
  getUsageAnalytics,
  exportChartData,
  clearCache
} = chartDataService;

export default chartDataService;