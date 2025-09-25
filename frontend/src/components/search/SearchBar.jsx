/**
 * Advanced Search Bar Component
 * Features autocomplete, voice search, and smart suggestions
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  X,
  Mic,
  MicOff,
  Filter,
  Clock,
  TrendingUp,
  Bookmark,
  ChevronDown,
  Loader2
} from 'lucide-react';
import { useSearch } from './SearchProvider';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';

const SearchBar = ({
  placeholder = "Search tax calculators, guides, and FAQs...",
  showFilters = true,
  showVoiceSearch = true,
  onSearchFocus,
  onSearchBlur,
  className = ""
}) => {
  const {
    query,
    setQuery,
    search,
    autocomplete,
    recentSearches,
    savedSearches,
    showSuggestions,
    toggleSuggestions,
    toggleFilters,
    isSearching,
    trackResultClick
  } = useSearch();

  const [inputFocused, setInputFocused] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  const inputRef = useRef(null);
  const suggestionRefs = useRef([]);

  // Voice search hook
  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    isSupported: voiceSupported
  } = useSpeechRecognition();

  // Update query when voice transcript changes
  useEffect(() => {
    if (transcript) {
      setQuery(transcript);
    }
  }, [transcript, setQuery]);

  // Handle input change
  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    setSelectedSuggestion(-1);
  };

  // Handle input focus
  const handleInputFocus = () => {
    setInputFocused(true);
    if (query.length > 0 || recentSearches.length > 0) {
      toggleSuggestions(true);
    }
    onSearchFocus?.();
  };

  // Handle input blur
  const handleInputBlur = (e) => {
    // Delay hiding suggestions to allow clicks
    setTimeout(() => {
      setInputFocused(false);
      toggleSuggestions(false);
      onSearchBlur?.();
    }, 200);
  };

  // Handle form submit
  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      search();
      toggleSuggestions(false);
      inputRef.current?.blur();
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    if (typeof suggestion === 'string') {
      setQuery(suggestion);
      search({ query: suggestion });
    } else {
      setQuery(suggestion.text);
      search({ query: suggestion.text });
      trackResultClick(suggestion, 0);
    }
    toggleSuggestions(false);
    inputRef.current?.blur();
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    const allSuggestions = [
      ...autocomplete,
      ...recentSearches.map(s => ({ text: s, type: 'recent' })),
      ...savedSearches.map(s => ({ text: s.query, type: 'saved', name: s.name }))
    ];

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestion(prev =>
          prev < allSuggestions.length - 1 ? prev + 1 : 0
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestion(prev =>
          prev > 0 ? prev - 1 : allSuggestions.length - 1
        );
        break;

      case 'Enter':
        e.preventDefault();
        if (selectedSuggestion >= 0 && allSuggestions[selectedSuggestion]) {
          handleSuggestionClick(allSuggestions[selectedSuggestion]);
        } else {
          handleSubmit(e);
        }
        break;

      case 'Escape':
        toggleSuggestions(false);
        inputRef.current?.blur();
        break;

      default:
        break;
    }
  };

  // Clear search
  const clearSearch = () => {
    setQuery('');
    toggleSuggestions(false);
    inputRef.current?.focus();
  };

  // Toggle voice search
  const toggleVoiceSearch = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Get suggestion icon
  const getSuggestionIcon = (suggestion) => {
    if (suggestion.type === 'recent') {
      return <Clock className="w-4 h-4 text-gray-400" />;
    }
    if (suggestion.type === 'saved') {
      return <Bookmark className="w-4 h-4 text-blue-500" />;
    }
    if (suggestion.type === 'popular') {
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    }
    return <Search className="w-4 h-4 text-gray-400" />;
  };

  // Render suggestions dropdown
  const renderSuggestions = () => {
    if (!showSuggestions || (!inputFocused && !query)) return null;

    const hasAutocomplete = autocomplete.length > 0;
    const hasRecent = recentSearches.length > 0;
    const hasSaved = savedSearches.length > 0;

    if (!hasAutocomplete && !hasRecent && !hasSaved) return null;

    return (
      <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
        {/* Autocomplete suggestions */}
        {hasAutocomplete && (
          <div className="border-b border-gray-100 last:border-b-0">
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Suggestions
            </div>
            {autocomplete.map((suggestion, index) => (
              <button
                key={`autocomplete-${index}`}
                ref={el => suggestionRefs.current[index] = el}
                className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 ${
                  selectedSuggestion === index ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                }`}
                onClick={() => handleSuggestionClick(suggestion)}
                onMouseEnter={() => setSelectedSuggestion(index)}
              >
                {getSuggestionIcon(suggestion)}
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{suggestion.text}</div>
                  {suggestion.type && (
                    <div className="text-xs text-gray-500 capitalize">{suggestion.type}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Recent searches */}
        {hasRecent && (
          <div className="border-b border-gray-100 last:border-b-0">
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Recent Searches
            </div>
            {recentSearches.slice(0, 5).map((search, index) => {
              const suggestionIndex = autocomplete.length + index;
              return (
                <button
                  key={`recent-${index}`}
                  ref={el => suggestionRefs.current[suggestionIndex] = el}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 ${
                    selectedSuggestion === suggestionIndex ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                  }`}
                  onClick={() => handleSuggestionClick(search)}
                  onMouseEnter={() => setSelectedSuggestion(suggestionIndex)}
                >
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">{search}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Saved searches */}
        {hasSaved && (
          <div className="border-b border-gray-100 last:border-b-0">
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Saved Searches
            </div>
            {savedSearches.slice(0, 3).map((search, index) => {
              const suggestionIndex = autocomplete.length + recentSearches.length + index;
              return (
                <button
                  key={`saved-${index}`}
                  ref={el => suggestionRefs.current[suggestionIndex] = el}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 ${
                    selectedSuggestion === suggestionIndex ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                  }`}
                  onClick={() => handleSuggestionClick({ text: search.query })}
                  onMouseEnter={() => setSelectedSuggestion(suggestionIndex)}
                >
                  <Bookmark className="w-4 h-4 text-blue-500" />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{search.name}</div>
                    <div className="text-sm text-gray-500">{search.query}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className={`w-full pl-12 pr-24 py-4 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                inputFocused ? 'shadow-lg' : 'shadow-sm'
              }`}
              aria-label="Search"
              autoComplete="off"
            />

            {/* Clear button */}
            {query && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-20 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Clear search"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}

            {/* Voice search button */}
            {showVoiceSearch && voiceSupported && (
              <button
                type="button"
                onClick={toggleVoiceSearch}
                className={`absolute right-12 top-1/2 transform -translate-y-1/2 p-2 rounded-full transition-all duration-200 ${
                  isListening
                    ? 'bg-red-500 text-white shadow-lg'
                    : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'
                }`}
                aria-label={isListening ? "Stop voice search" : "Start voice search"}
              >
                {isListening ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>
            )}

            {/* Loading indicator */}
            {isSearching && (
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              </div>
            )}
          </div>

          {/* Filters button */}
          {showFilters && (
            <button
              type="button"
              onClick={() => toggleFilters()}
              className="ml-3 px-4 py-4 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg transition-colors flex items-center gap-2"
              aria-label="Toggle filters"
            >
              <Filter className="w-5 h-5" />
              <span className="hidden sm:inline">Filters</span>
              <ChevronDown className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Voice search feedback */}
        {isListening && (
          <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-red-700">Listening... Speak now</span>
            </div>
            {transcript && (
              <div className="mt-2 text-sm text-red-600">
                Heard: "{transcript}"
              </div>
            )}
          </div>
        )}

        {/* Suggestions dropdown */}
        {renderSuggestions()}
      </form>
    </div>
  );
};

export default SearchBar;