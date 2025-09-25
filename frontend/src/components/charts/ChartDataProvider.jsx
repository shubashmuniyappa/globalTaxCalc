import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import chartDataService from '../../services/chartDataService';

// Chart Data Context
const ChartDataContext = createContext();

// Action Types
const CHART_DATA_ACTIONS = {
  FETCH_START: 'FETCH_START',
  FETCH_SUCCESS: 'FETCH_SUCCESS',
  FETCH_ERROR: 'FETCH_ERROR',
  UPDATE_FILTERS: 'UPDATE_FILTERS',
  CLEAR_DATA: 'CLEAR_DATA',
  SET_LOADING: 'SET_LOADING',
  TRACK_INTERACTION: 'TRACK_INTERACTION'
};

// Initial State
const initialState = {
  // Data storage
  taxBrackets: { data: null, loading: false, error: null },
  incomeBreakdown: { data: null, loading: false, error: null },
  comparison: { data: null, loading: false, error: null },
  stateTax: { data: null, loading: false, error: null },
  historical: { data: null, loading: false, error: null },
  optimization: { data: null, loading: false, error: null },

  // Global filters and settings
  filters: {
    income: 75000,
    filingStatus: 'single',
    country: 'US',
    year: new Date().getFullYear(),
    state: null,
    dependents: 0
  },

  // Analytics and tracking
  analytics: {
    interactions: [],
    usageData: null,
    performanceMetrics: {}
  },

  // UI state
  globalLoading: false,
  lastUpdated: null
};

// Reducer
const chartDataReducer = (state, action) => {
  switch (action.type) {
    case CHART_DATA_ACTIONS.FETCH_START:
      return {
        ...state,
        [action.chartType]: {
          ...state[action.chartType],
          loading: true,
          error: null
        },
        globalLoading: true
      };

    case CHART_DATA_ACTIONS.FETCH_SUCCESS:
      return {
        ...state,
        [action.chartType]: {
          data: action.data,
          loading: false,
          error: null
        },
        globalLoading: false,
        lastUpdated: Date.now()
      };

    case CHART_DATA_ACTIONS.FETCH_ERROR:
      return {
        ...state,
        [action.chartType]: {
          ...state[action.chartType],
          loading: false,
          error: action.error
        },
        globalLoading: false
      };

    case CHART_DATA_ACTIONS.UPDATE_FILTERS:
      return {
        ...state,
        filters: {
          ...state.filters,
          ...action.filters
        }
      };

    case CHART_DATA_ACTIONS.CLEAR_DATA:
      if (action.chartType) {
        return {
          ...state,
          [action.chartType]: initialState[action.chartType]
        };
      }
      // Clear all data
      return {
        ...initialState,
        filters: state.filters
      };

    case CHART_DATA_ACTIONS.SET_LOADING:
      return {
        ...state,
        globalLoading: action.loading
      };

    case CHART_DATA_ACTIONS.TRACK_INTERACTION:
      return {
        ...state,
        analytics: {
          ...state.analytics,
          interactions: [
            ...state.analytics.interactions.slice(-99), // Keep last 100 interactions
            {
              id: Date.now(),
              ...action.interaction,
              timestamp: Date.now()
            }
          ]
        }
      };

    default:
      return state;
  }
};

// Chart Data Provider Component
export const ChartDataProvider = ({ children, initialFilters = {} }) => {
  const [state, dispatch] = useReducer(chartDataReducer, {
    ...initialState,
    filters: {
      ...initialState.filters,
      ...initialFilters
    }
  });

  // Generic data fetching function
  const fetchChartData = useCallback(async (chartType, params, forceRefresh = false) => {
    // Check if we already have valid data and don't need to refresh
    if (!forceRefresh && state[chartType]?.data && !state[chartType]?.error) {
      return state[chartType].data;
    }

    dispatch({ type: CHART_DATA_ACTIONS.FETCH_START, chartType });

    try {
      let data;

      switch (chartType) {
        case 'taxBrackets':
          data = await chartDataService.getTaxBracketData(params);
          break;

        case 'incomeBreakdown':
          data = await chartDataService.getIncomeBreakdownData(params);
          break;

        case 'comparison':
          data = await chartDataService.getComparisonData(params);
          break;

        case 'stateTax':
          data = await chartDataService.getStateTaxData(params.income, params.states);
          break;

        case 'historical':
          data = await chartDataService.getHistoricalTaxData(params);
          break;

        case 'optimization':
          data = await chartDataService.getOptimizationScenarios(params);
          break;

        default:
          throw new Error(`Unknown chart type: ${chartType}`);
      }

      dispatch({
        type: CHART_DATA_ACTIONS.FETCH_SUCCESS,
        chartType,
        data
      });

      return data;
    } catch (error) {
      dispatch({
        type: CHART_DATA_ACTIONS.FETCH_ERROR,
        chartType,
        error: error.message || 'Failed to fetch chart data'
      });

      throw error;
    }
  }, []);

  // Specific chart data fetchers
  const fetchTaxBrackets = useCallback((customParams = {}, forceRefresh = false) => {
    const params = {
      income: state.filters.income,
      filingStatus: state.filters.filingStatus,
      country: state.filters.country,
      year: state.filters.year,
      ...customParams
    };

    return fetchChartData('taxBrackets', params, forceRefresh);
  }, [state.filters, fetchChartData]);

  const fetchIncomeBreakdown = useCallback((customParams = {}, forceRefresh = false) => {
    // Calculate breakdown components if not provided
    const federalTax = customParams.federalTax || (state.filters.income * 0.18);
    const stateTax = customParams.stateTax || (state.filters.income * 0.05);
    const socialSecurity = customParams.socialSecurity || Math.min(state.filters.income * 0.062, 9114); // 2023 limit
    const medicare = customParams.medicare || (state.filters.income * 0.0145);

    const params = {
      grossIncome: state.filters.income,
      federalTax,
      stateTax,
      socialSecurity,
      medicare,
      deductions: 12950, // Standard deduction 2023
      filingStatus: state.filters.filingStatus,
      state: state.filters.state,
      ...customParams
    };

    return fetchChartData('incomeBreakdown', params, forceRefresh);
  }, [state.filters, fetchChartData]);

  const fetchComparison = useCallback((customParams = {}, forceRefresh = false) => {
    const params = {
      type: 'states',
      userIncome: state.filters.income,
      ...customParams
    };

    return fetchChartData('comparison', params, forceRefresh);
  }, [state.filters, fetchChartData]);

  const fetchStateTax = useCallback((states = [], forceRefresh = false) => {
    const params = {
      income: state.filters.income,
      states: states.length > 0 ? states : ['California', 'Texas', 'New York', 'Florida', 'Wyoming']
    };

    return fetchChartData('stateTax', params, forceRefresh);
  }, [state.filters, fetchChartData]);

  const fetchHistorical = useCallback((customParams = {}, forceRefresh = false) => {
    const currentYear = new Date().getFullYear();
    const params = {
      income: state.filters.income,
      filingStatus: state.filters.filingStatus,
      startYear: currentYear - 10,
      endYear: currentYear,
      ...customParams
    };

    return fetchChartData('historical', params, forceRefresh);
  }, [state.filters, fetchChartData]);

  const fetchOptimization = useCallback((customParams = {}, forceRefresh = false) => {
    const params = {
      income: state.filters.income,
      filingStatus: state.filters.filingStatus,
      dependents: state.filters.dependents,
      currentSituation: {
        has401k: false,
        hasHSA: false,
        hasIRA: false,
        charitableDeductions: 0
      },
      ...customParams
    };

    return fetchChartData('optimization', params, forceRefresh);
  }, [state.filters, fetchChartData]);

  // Filter management
  const updateFilters = useCallback((newFilters) => {
    dispatch({
      type: CHART_DATA_ACTIONS.UPDATE_FILTERS,
      filters: newFilters
    });

    // Clear relevant cached data when filters change
    if (newFilters.income !== undefined || newFilters.filingStatus !== undefined) {
      chartDataService.clearCache('tax-brackets');
      chartDataService.clearCache('income-breakdown');
      chartDataService.clearCache('comparison');
    }
  }, []);

  const resetFilters = useCallback(() => {
    updateFilters(initialState.filters);
  }, [updateFilters]);

  // Data management
  const clearChartData = useCallback((chartType = null) => {
    dispatch({
      type: CHART_DATA_ACTIONS.CLEAR_DATA,
      chartType
    });

    if (chartType) {
      chartDataService.clearCache(chartType);
    } else {
      chartDataService.clearCache();
    }
  }, []);

  const refreshAllData = useCallback(async () => {
    dispatch({ type: CHART_DATA_ACTIONS.SET_LOADING, loading: true });

    try {
      // Refresh all chart data in parallel
      await Promise.allSettled([
        fetchTaxBrackets({}, true),
        fetchIncomeBreakdown({}, true),
        fetchComparison({}, true),
        fetchStateTax([], true)
      ]);
    } catch (error) {
      console.error('Error refreshing chart data:', error);
    } finally {
      dispatch({ type: CHART_DATA_ACTIONS.SET_LOADING, loading: false });
    }
  }, [fetchTaxBrackets, fetchIncomeBreakdown, fetchComparison, fetchStateTax]);

  // Analytics and tracking
  const trackInteraction = useCallback((interaction) => {
    const enrichedInteraction = {
      ...interaction,
      filters: { ...state.filters },
      userAgent: navigator.userAgent,
      url: window.location.href,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`
    };

    dispatch({
      type: CHART_DATA_ACTIONS.TRACK_INTERACTION,
      interaction: enrichedInteraction
    });

    // Also send to service for server-side tracking
    chartDataService.trackChartInteraction(enrichedInteraction).catch(console.warn);
  }, [state.filters]);

  const exportData = useCallback(async (chartType, format = 'csv') => {
    const chartData = state[chartType]?.data;
    if (!chartData) {
      throw new Error(`No data available for chart type: ${chartType}`);
    }

    try {
      return await chartDataService.exportChartData(chartType, chartData, format);
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
  }, [state]);

  // Auto-refresh based on filters
  useEffect(() => {
    // Don't auto-fetch on mount if we already have data
    if (state.lastUpdated) return;

    const timer = setTimeout(() => {
      // Fetch initial data
      fetchTaxBrackets();
      fetchIncomeBreakdown();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Performance monitoring
  useEffect(() => {
    const performanceMetrics = {
      loadTime: Date.now() - (window.performance?.timing?.navigationStart || Date.now()),
      chartTypes: Object.keys(state).filter(key =>
        typeof state[key] === 'object' && state[key]?.data
      ).length,
      lastUpdated: state.lastUpdated,
      cacheHits: 0 // This would be tracked by the service
    };

    // Update performance metrics periodically
    const interval = setInterval(() => {
      // Update metrics if needed
    }, 30000);

    return () => clearInterval(interval);
  }, [state.lastUpdated]);

  // Context value
  const contextValue = {
    // State
    state,

    // Data fetchers
    fetchTaxBrackets,
    fetchIncomeBreakdown,
    fetchComparison,
    fetchStateTax,
    fetchHistorical,
    fetchOptimization,

    // Filter management
    updateFilters,
    resetFilters,

    // Data management
    clearChartData,
    refreshAllData,

    // Analytics
    trackInteraction,
    exportData,

    // Utilities
    isLoading: (chartType) => state[chartType]?.loading || state.globalLoading,
    hasError: (chartType) => !!state[chartType]?.error,
    getData: (chartType) => state[chartType]?.data,
    getError: (chartType) => state[chartType]?.error
  };

  return (
    <ChartDataContext.Provider value={contextValue}>
      {children}
    </ChartDataContext.Provider>
  );
};

// Custom hook to use chart data context
export const useChartDataContext = () => {
  const context = useContext(ChartDataContext);

  if (!context) {
    throw new Error('useChartDataContext must be used within a ChartDataProvider');
  }

  return context;
};

// HOC for providing chart data to components
export const withChartData = (WrappedComponent) => {
  return function WithChartDataComponent(props) {
    return (
      <ChartDataProvider>
        <WrappedComponent {...props} />
      </ChartDataProvider>
    );
  };
};

export default ChartDataProvider;