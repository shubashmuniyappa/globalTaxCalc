/**
 * Localized Content Provider
 * Provides country-specific tax content and guides with cultural context
 */

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useI18n } from '../../lib/i18n/IntlProvider';
import { LocalizedTaxContent } from '../../lib/i18n/LocalizedTaxContent';

// Create context for localized content
const LocalizedContentContext = createContext({
  taxContent: null,
  currentCountry: 'us',
  setCountry: () => {},
  getTaxTerminology: () => ({}),
  getTaxSystemInfo: () => ({}),
  getCalculatorInterface: () => ({}),
  generateTaxGuide: () => ({}),
  isLoading: false,
  error: null
});

// Hook to use localized content context
export const useLocalizedContent = () => {
  const context = useContext(LocalizedContentContext);
  if (!context) {
    throw new Error('useLocalizedContent must be used within a LocalizedContentProvider');
  }
  return context;
};

// Provider component
export const LocalizedContentProvider = ({
  children,
  initialCountry = 'us',
  cacheSize = 100
}) => {
  const { locale } = useI18n();
  const [currentCountry, setCurrentCountry] = useState(initialCountry);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [contentCache, setContentCache] = useState(new Map());

  // Initialize localized tax content system
  const taxContent = useMemo(() => new LocalizedTaxContent(), []);

  // Cache key generator
  const getCacheKey = (type, country, locale, ...params) => {
    return `${type}_${country}_${locale}_${params.join('_')}`;
  };

  // Generic cache handler
  const getCachedOrFetch = async (cacheKey, fetchFunction) => {
    if (contentCache.has(cacheKey)) {
      return contentCache.get(cacheKey);
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await fetchFunction();

      // Manage cache size
      if (contentCache.size >= cacheSize) {
        const firstKey = contentCache.keys().next().value;
        contentCache.delete(firstKey);
      }

      setContentCache(prev => new Map(prev).set(cacheKey, result));
      return result;
    } catch (err) {
      setError(err);
      console.error('Content fetch error:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Get tax terminology
  const getTaxTerminology = async (country = currentCountry, targetLocale = locale) => {
    const cacheKey = getCacheKey('terminology', country, targetLocale);
    return getCachedOrFetch(cacheKey, () => {
      return taxContent.getTaxTerminology(country, targetLocale);
    });
  };

  // Get tax system information
  const getTaxSystemInfo = async (country = currentCountry, targetLocale = locale) => {
    const cacheKey = getCacheKey('systemInfo', country, targetLocale);
    return getCachedOrFetch(cacheKey, () => {
      return taxContent.getTaxSystemInfo(country, targetLocale);
    });
  };

  // Get calculator interface
  const getCalculatorInterface = async (calculatorType, country = currentCountry, targetLocale = locale) => {
    const cacheKey = getCacheKey('calculator', country, targetLocale, calculatorType);
    return getCachedOrFetch(cacheKey, () => {
      return taxContent.getCalculatorInterface(calculatorType, country, targetLocale);
    });
  };

  // Generate tax guide
  const generateTaxGuide = async (country = currentCountry, targetLocale = locale, topic = 'overview') => {
    const cacheKey = getCacheKey('guide', country, targetLocale, topic);
    return getCachedOrFetch(cacheKey, () => {
      return taxContent.generateTaxGuideContent(country, targetLocale, topic);
    });
  };

  // Get country list with localized names
  const getCountryList = async (targetLocale = locale) => {
    const cacheKey = getCacheKey('countryList', 'all', targetLocale);
    return getCachedOrFetch(cacheKey, async () => {
      const countries = Object.keys(taxContent.TAX_SYSTEMS || {});
      return countries.map(countryCode => ({
        code: countryCode,
        name: taxContent.getCountryName(countryCode, targetLocale),
        flag: taxContent.getCountryFlag?.(countryCode) || '🏳️'
      }));
    });
  };

  // Get supported calculator types
  const getSupportedCalculators = async (country = currentCountry, targetLocale = locale) => {
    const cacheKey = getCacheKey('calculators', country, targetLocale);
    return getCachedOrFetch(cacheKey, async () => {
      const systemInfo = await getTaxSystemInfo(country, targetLocale);
      const calculators = [];

      // Income tax calculator (available for all countries)
      calculators.push({
        type: 'income-tax',
        name: taxContent.translationManager.getTranslation(
          'calculators.income_tax',
          targetLocale,
          { defaultValue: 'Income Tax Calculator' }
        ),
        description: taxContent.translationManager.getTranslation(
          'calculators.income_tax.description',
          targetLocale,
          { defaultValue: 'Calculate your income tax liability' }
        ),
        available: true
      });

      // Payroll tax calculator (for countries with payroll taxes)
      if (systemInfo.rules.socialSecurity || systemInfo.rules.medicare) {
        calculators.push({
          type: 'payroll-tax',
          name: taxContent.translationManager.getTranslation(
            'calculators.payroll_tax',
            targetLocale,
            { defaultValue: 'Payroll Tax Calculator' }
          ),
          description: taxContent.translationManager.getTranslation(
            'calculators.payroll_tax.description',
            targetLocale,
            { defaultValue: 'Calculate payroll taxes and deductions' }
          ),
          available: true
        });
      }

      // Property tax calculator (for applicable countries)
      if (['us', 'ca', 'gb', 'au'].includes(country)) {
        calculators.push({
          type: 'property-tax',
          name: taxContent.translationManager.getTranslation(
            'calculators.property_tax',
            targetLocale,
            { defaultValue: 'Property Tax Calculator' }
          ),
          description: taxContent.translationManager.getTranslation(
            'calculators.property_tax.description',
            targetLocale,
            { defaultValue: 'Calculate property tax based on assessed value' }
          ),
          available: true
        });
      }

      return calculators;
    });
  };

  // Get tax guide topics
  const getTaxGuideTopics = async (country = currentCountry, targetLocale = locale) => {
    const cacheKey = getCacheKey('guideTopics', country, targetLocale);
    return getCachedOrFetch(cacheKey, async () => {
      const topics = [
        {
          id: 'overview',
          title: taxContent.translationManager.getTranslation(
            'guides.topics.overview',
            targetLocale,
            { defaultValue: 'Tax System Overview' }
          ),
          description: taxContent.translationManager.getTranslation(
            'guides.topics.overview.description',
            targetLocale,
            { defaultValue: 'Understanding the basics of the tax system' }
          )
        },
        {
          id: 'filing',
          title: taxContent.translationManager.getTranslation(
            'guides.topics.filing',
            targetLocale,
            { defaultValue: 'Filing Requirements' }
          ),
          description: taxContent.translationManager.getTranslation(
            'guides.topics.filing.description',
            targetLocale,
            { defaultValue: 'How and when to file your tax return' }
          )
        },
        {
          id: 'deductions',
          title: taxContent.translationManager.getTranslation(
            'guides.topics.deductions',
            targetLocale,
            { defaultValue: 'Deductions and Credits' }
          ),
          description: taxContent.translationManager.getTranslation(
            'guides.topics.deductions.description',
            targetLocale,
            { defaultValue: 'Available deductions and tax credits' }
          )
        },
        {
          id: 'rates',
          title: taxContent.translationManager.getTranslation(
            'guides.topics.rates',
            targetLocale,
            { defaultValue: 'Tax Rates and Brackets' }
          ),
          description: taxContent.translationManager.getTranslation(
            'guides.topics.rates.description',
            targetLocale,
            { defaultValue: 'Current tax rates and income brackets' }
          )
        }
      ];

      return topics;
    });
  };

  // Set country and clear related cache
  const setCountry = (countryCode) => {
    setCurrentCountry(countryCode);

    // Clear country-specific cache entries
    const newCache = new Map();
    for (const [key, value] of contentCache.entries()) {
      if (!key.includes(`_${currentCountry}_`)) {
        newCache.set(key, value);
      }
    }
    setContentCache(newCache);
  };

  // Clear all cache
  const clearCache = () => {
    setContentCache(new Map());
    taxContent.clearCache();
  };

  // Get cache statistics
  const getCacheStats = () => {
    return {
      providerCacheSize: contentCache.size,
      maxCacheSize: cacheSize,
      ...taxContent.getCacheStats()
    };
  };

  // Preload content for better performance
  const preloadContent = async (country = currentCountry, targetLocale = locale) => {
    try {
      await Promise.all([
        getTaxTerminology(country, targetLocale),
        getTaxSystemInfo(country, targetLocale),
        getCalculatorInterface('income-tax', country, targetLocale),
        generateTaxGuide(country, targetLocale, 'overview')
      ]);
    } catch (err) {
      console.warn('Content preloading failed:', err);
    }
  };

  // Preload content when country or locale changes
  useEffect(() => {
    preloadContent(currentCountry, locale);
  }, [currentCountry, locale]);

  // Context value
  const contextValue = {
    taxContent,
    currentCountry,
    setCountry,
    isLoading,
    error,

    // Content methods
    getTaxTerminology,
    getTaxSystemInfo,
    getCalculatorInterface,
    generateTaxGuide,
    getCountryList,
    getSupportedCalculators,
    getTaxGuideTopics,

    // Utility methods
    clearCache,
    getCacheStats,
    preloadContent,

    // Direct access to content methods for advanced usage
    getCountryName: (country, targetLocale = locale) =>
      taxContent.getCountryName(country, targetLocale),
  };

  return (
    <LocalizedContentContext.Provider value={contextValue}>
      {children}
    </LocalizedContentContext.Provider>
  );
};

// Higher-order component for class components
export const withLocalizedContent = (Component) => {
  const WrappedComponent = (props) => {
    const localizedContent = useLocalizedContent();
    return <Component {...props} localizedContent={localizedContent} />;
  };

  WrappedComponent.displayName = `withLocalizedContent(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

// Hook for calculator-specific content
export const useCalculatorContent = (calculatorType, country) => {
  const { getCalculatorInterface, currentCountry } = useLocalizedContent();
  const { locale } = useI18n();
  const [calculatorInterface, setCalculatorInterface] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInterface = async () => {
      try {
        setLoading(true);
        const interface_ = await getCalculatorInterface(
          calculatorType,
          country || currentCountry,
          locale
        );
        setCalculatorInterface(interface_);
      } catch (error) {
        console.error('Failed to load calculator interface:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInterface();
  }, [calculatorType, country, currentCountry, locale, getCalculatorInterface]);

  return {
    calculatorInterface,
    loading
  };
};

// Hook for tax guide content
export const useTaxGuideContent = (topic = 'overview', country) => {
  const { generateTaxGuide, currentCountry } = useLocalizedContent();
  const { locale } = useI18n();
  const [guideContent, setGuideContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadGuide = async () => {
      try {
        setLoading(true);
        const content = await generateTaxGuide(
          country || currentCountry,
          locale,
          topic
        );
        setGuideContent(content);
      } catch (error) {
        console.error('Failed to load tax guide:', error);
      } finally {
        setLoading(false);
      }
    };

    loadGuide();
  }, [topic, country, currentCountry, locale, generateTaxGuide]);

  return {
    guideContent,
    loading
  };
};

export default LocalizedContentProvider;