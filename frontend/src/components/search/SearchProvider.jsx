/**
 * Search Context Provider
 * Manages search state and provides search functionality across the app
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { searchAPI } from '../../services/searchService';
import { debounce } from 'lodash';

const SearchContext = createContext();

// Search state management
const initialState = {
  // Query state
  query: '',
  suggestions: [],
  autocomplete: [],

  // Results state
  results: [],
  total: 0,
  pages: 0,
  currentPage: 1,

  // UI state
  isLoading: false,
  isSearching: false,
  showSuggestions: false,
  showFilters: false,

  // Filters state
  filters: {
    content_type: [],
    category: [],
    country: [],
    language: [],
    tags: [],
    difficulty: [],
    date_from: null,
    date_to: null
  },

  // Facets from search results
  facets: {},

  // Search configuration
  sort: 'relevance',
  size: 20,
  highlight: true,
  fuzzy: true,

  // Analytics
  searchHistory: [],
  recentSearches: [],
  savedSearches: [],

  // Error state
  error: null
};

// Search reducer
function searchReducer(state, action) {
  switch (action.type) {
    case 'SET_QUERY':
      return {
        ...state,
        query: action.payload,
        error: null
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload
      };

    case 'SET_SEARCHING':
      return {
        ...state,
        isSearching: action.payload
      };

    case 'SET_RESULTS':
      return {
        ...state,
        results: action.payload.hits || [],
        total: action.payload.total || 0,
        pages: Math.ceil((action.payload.total || 0) / state.size),
        facets: action.payload.facets || {},
        isLoading: false,
        isSearching: false,
        error: null
      };

    case 'SET_AUTOCOMPLETE':
      return {
        ...state,
        autocomplete: action.payload,
        showSuggestions: action.payload.length > 0
      };

    case 'SET_SUGGESTIONS':
      return {
        ...state,
        suggestions: action.payload
      };

    case 'SET_FILTERS':
      return {
        ...state,
        filters: {
          ...state.filters,
          ...action.payload
        },
        currentPage: 1 // Reset to first page when filters change
      };

    case 'CLEAR_FILTERS':
      return {
        ...state,
        filters: initialState.filters,
        currentPage: 1
      };

    case 'SET_PAGE':
      return {
        ...state,
        currentPage: action.payload
      };

    case 'SET_SORT':
      return {
        ...state,
        sort: action.payload,
        currentPage: 1
      };

    case 'SET_SIZE':
      return {
        ...state,
        size: action.payload,
        currentPage: 1
      };

    case 'TOGGLE_SUGGESTIONS':
      return {
        ...state,
        showSuggestions: action.payload
      };

    case 'TOGGLE_FILTERS':
      return {
        ...state,
        showFilters: action.payload
      };

    case 'ADD_TO_HISTORY':
      return {
        ...state,
        searchHistory: [
          action.payload,
          ...state.searchHistory.filter(item => item.query !== action.payload.query)
        ].slice(0, 50) // Keep last 50 searches
      };

    case 'ADD_RECENT_SEARCH':
      return {
        ...state,
        recentSearches: [
          action.payload,
          ...state.recentSearches.filter(item => item !== action.payload)
        ].slice(0, 10) // Keep last 10 recent searches
      };

    case 'SAVE_SEARCH':
      return {
        ...state,
        savedSearches: [
          ...state.savedSearches.filter(item => item.id !== action.payload.id),
          action.payload
        ]
      };

    case 'REMOVE_SAVED_SEARCH':
      return {
        ...state,
        savedSearches: state.savedSearches.filter(item => item.id !== action.payload)
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
        isSearching: false
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null
      };

    case 'RESET_SEARCH':
      return {
        ...initialState,
        searchHistory: state.searchHistory,
        recentSearches: state.recentSearches,
        savedSearches: state.savedSearches
      };

    default:
      return state;
  }
}

// Search Provider Component
export function SearchProvider({ children }) {
  const [state, dispatch] = useReducer(searchReducer, initialState);

  // Load saved state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('searchState');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        if (parsed.searchHistory) {
          dispatch({ type: 'ADD_TO_HISTORY', payload: parsed.searchHistory });
        }
        if (parsed.recentSearches) {
          parsed.recentSearches.forEach(search => {
            dispatch({ type: 'ADD_RECENT_SEARCH', payload: search });
          });
        }
        if (parsed.savedSearches) {
          parsed.savedSearches.forEach(search => {
            dispatch({ type: 'SAVE_SEARCH', payload: search });
          });
        }
      } catch (error) {
        console.error('Failed to load search state:', error);
      }
    }
  }, []);

  // Save state to localStorage when it changes
  useEffect(() => {
    const stateToSave = {
      searchHistory: state.searchHistory,
      recentSearches: state.recentSearches,
      savedSearches: state.savedSearches
    };
    localStorage.setItem('searchState', JSON.stringify(stateToSave));
  }, [state.searchHistory, state.recentSearches, state.savedSearches]);

  // Debounced autocomplete function
  const debouncedAutocomplete = useCallback(
    debounce(async (query) => {
      if (query.trim().length < 2) {
        dispatch({ type: 'SET_AUTOCOMPLETE', payload: [] });
        return;
      }

      try {
        const suggestions = await searchAPI.autocomplete(query, {
          size: 10,
          type: 'all'
        });
        dispatch({ type: 'SET_AUTOCOMPLETE', payload: suggestions });
      } catch (error) {
        console.error('Autocomplete failed:', error);
        dispatch({ type: 'SET_AUTOCOMPLETE', payload: [] });
      }
    }, 300),
    []
  );

  // Search function
  const search = useCallback(async (options = {}) => {
    const {
      query = state.query,
      page = state.currentPage,
      size = state.size,
      sort = state.sort,
      filters = state.filters,
      saveToHistory = true
    } = options;

    if (!query.trim()) {
      dispatch({ type: 'SET_RESULTS', payload: { hits: [], total: 0 } });
      return;
    }

    dispatch({ type: 'SET_SEARCHING', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });

    try {
      const searchParams = {
        query: query.trim(),
        filters,
        sort,
        page,
        size,
        highlight: state.highlight,
        facets: true,
        fuzzy: state.fuzzy
      };

      const results = await searchAPI.search(searchParams);

      dispatch({ type: 'SET_RESULTS', payload: results });

      // Add to search history
      if (saveToHistory) {
        dispatch({
          type: 'ADD_TO_HISTORY',
          payload: {
            query: query.trim(),
            filters,
            timestamp: new Date().toISOString(),
            results: results.total
          }
        });

        dispatch({ type: 'ADD_RECENT_SEARCH', payload: query.trim() });
      }

      // Track search analytics
      await searchAPI.trackEvent({
        event_type: 'search',
        query: query.trim(),
        filters,
        results_count: results.total
      });

    } catch (error) {
      console.error('Search failed:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: 'Search failed. Please try again.'
      });
    }
  }, [state.query, state.currentPage, state.size, state.sort, state.filters, state.highlight, state.fuzzy]);

  // Set query and trigger autocomplete
  const setQuery = useCallback((query) => {
    dispatch({ type: 'SET_QUERY', payload: query });

    if (query.trim()) {
      debouncedAutocomplete(query);
    } else {
      dispatch({ type: 'SET_AUTOCOMPLETE', payload: [] });
    }
  }, [debouncedAutocomplete]);

  // Set filters
  const setFilters = useCallback((newFilters) => {
    dispatch({ type: 'SET_FILTERS', payload: newFilters });
  }, []);

  // Clear filters
  const clearFilters = useCallback(() => {
    dispatch({ type: 'CLEAR_FILTERS' });
  }, []);

  // Set current page
  const setPage = useCallback((page) => {
    dispatch({ type: 'SET_PAGE', payload: page });
  }, []);

  // Set sort option
  const setSort = useCallback((sort) => {
    dispatch({ type: 'SET_SORT', payload: sort });
  }, []);

  // Set page size
  const setSize = useCallback((size) => {
    dispatch({ type: 'SET_SIZE', payload: size });
  }, []);

  // Toggle suggestions dropdown
  const toggleSuggestions = useCallback((show) => {
    dispatch({ type: 'TOGGLE_SUGGESTIONS', payload: show });
  }, []);

  // Toggle filters panel
  const toggleFilters = useCallback((show) => {
    dispatch({ type: 'TOGGLE_FILTERS', payload: show });
  }, []);

  // Get search suggestions for empty results
  const getSuggestions = useCallback(async (query) => {
    try {
      const suggestions = await searchAPI.suggestions(query, { size: 5 });
      dispatch({ type: 'SET_SUGGESTIONS', payload: suggestions });
      return suggestions;
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      return [];
    }
  }, []);

  // Find similar content
  const findSimilar = useCallback(async (documentId, index = 'search_all') => {
    try {
      const similar = await searchAPI.similar(documentId, { index, size: 5 });
      return similar;
    } catch (error) {
      console.error('Failed to find similar content:', error);
      return [];
    }
  }, []);

  // Save current search
  const saveSearch = useCallback((name) => {
    const searchToSave = {
      id: Date.now().toString(),
      name,
      query: state.query,
      filters: state.filters,
      sort: state.sort,
      created_at: new Date().toISOString()
    };
    dispatch({ type: 'SAVE_SEARCH', payload: searchToSave });
  }, [state.query, state.filters, state.sort]);

  // Remove saved search
  const removeSavedSearch = useCallback((id) => {
    dispatch({ type: 'REMOVE_SAVED_SEARCH', payload: id });
  }, []);

  // Load saved search
  const loadSavedSearch = useCallback((savedSearch) => {
    dispatch({ type: 'SET_QUERY', payload: savedSearch.query });
    dispatch({ type: 'SET_FILTERS', payload: savedSearch.filters });
    dispatch({ type: 'SET_SORT', payload: savedSearch.sort });
  }, []);

  // Reset search state
  const resetSearch = useCallback(() => {
    dispatch({ type: 'RESET_SEARCH' });
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  // Track result click
  const trackResultClick = useCallback(async (result, position) => {
    try {
      await searchAPI.trackEvent({
        event_type: 'click',
        query: state.query,
        document_id: result.id,
        position: position + 1
      });
    } catch (error) {
      console.error('Failed to track click:', error);
    }
  }, [state.query]);

  // Context value
  const value = {
    // State
    ...state,

    // Actions
    setQuery,
    search,
    setFilters,
    clearFilters,
    setPage,
    setSort,
    setSize,
    toggleSuggestions,
    toggleFilters,
    getSuggestions,
    findSimilar,
    saveSearch,
    removeSavedSearch,
    loadSavedSearch,
    resetSearch,
    clearError,
    trackResultClick
  };

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
}

// Custom hook to use search context
export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
}

export default SearchProvider;