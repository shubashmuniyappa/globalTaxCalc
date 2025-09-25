/**
 * Cultural Provider Component
 * Provides cultural adaptations and RTL support throughout the application
 */

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useI18n } from '../../lib/i18n/IntlProvider';
import { CulturalAdaptations } from '../../lib/i18n/CulturalAdaptations';

// Create cultural context
const CulturalContext = createContext({
  culturalAdaptations: null,
  isRTL: false,
  culturalPattern: null,
  culturalColors: null,
  layoutPreferences: null,
  numberPattern: null,
  dateTimePattern: null,
  formatNumber: () => '',
  formatCurrency: () => '',
  formatDate: () => '',
  formatAddress: () => ({}),
  formatName: () => '',
  validateInput: () => ({ isValid: true, errors: [] }),
  getPlaceholder: () => '',
  interactionPatterns: null
});

// Hook to use cultural context
export const useCultural = () => {
  const context = useContext(CulturalContext);
  if (!context) {
    throw new Error('useCultural must be used within a CulturalProvider');
  }
  return context;
};

// Cultural Provider Component
export const CulturalProvider = ({ children }) => {
  const { locale } = useI18n();
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize cultural adaptations system
  const culturalAdaptations = useMemo(() => new CulturalAdaptations(), []);

  // Get cultural data for current locale
  const culturalData = useMemo(() => {
    if (!locale) return null;

    return {
      isRTL: culturalAdaptations.isRTL(locale),
      culturalPattern: culturalAdaptations.getCulturalPattern(locale),
      culturalColors: culturalAdaptations.getCulturalColors(locale),
      layoutPreferences: culturalAdaptations.getLayoutPreferences(locale),
      numberPattern: culturalAdaptations.getNumberPattern(locale),
      dateTimePattern: culturalAdaptations.getDateTimePattern(locale),
      inputPreferences: culturalAdaptations.getInputPreferences(locale),
      interactionPatterns: culturalAdaptations.getInteractionPatterns(locale)
    };
  }, [locale, culturalAdaptations]);

  // Apply cultural adaptations to DOM when locale changes
  useEffect(() => {
    if (locale && culturalAdaptations) {
      try {
        culturalAdaptations.applyCulturalAdaptations(locale);
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to apply cultural adaptations:', error);
      }
    }
  }, [locale, culturalAdaptations]);

  // Wrapper functions for cultural formatting
  const formatNumber = (number, options = {}) => {
    if (!culturalAdaptations || !locale) return number?.toString() || '';
    return culturalAdaptations.formatNumber(number, locale, options);
  };

  const formatCurrency = (amount, currency, options = {}) => {
    if (!culturalAdaptations || !locale) return amount?.toString() || '';
    return culturalAdaptations.formatCurrency(amount, locale, currency, options);
  };

  const formatDate = (date, style = 'medium') => {
    if (!culturalAdaptations || !locale) return date?.toString() || '';
    return culturalAdaptations.formatDate(date, locale, style);
  };

  const formatAddress = (addressData) => {
    if (!culturalAdaptations || !locale) return { lines: [], rtl: false, joinedAddress: '' };
    return culturalAdaptations.formatAddress(addressData, locale);
  };

  const formatName = (nameData, style = 'full') => {
    if (!culturalAdaptations || !locale) return '';
    return culturalAdaptations.formatName(nameData, locale, style);
  };

  const validateInput = (inputType, value) => {
    if (!culturalAdaptations || !locale) return { isValid: true, errors: [] };
    return culturalAdaptations.validateCulturalInput(inputType, value, locale);
  };

  const getPlaceholder = (fieldType) => {
    if (!culturalAdaptations || !locale) return '';
    return culturalAdaptations.generatePlaceholder(fieldType, locale);
  };

  // Context value
  const contextValue = {
    culturalAdaptations,
    isRTL: culturalData?.isRTL || false,
    culturalPattern: culturalData?.culturalPattern,
    culturalColors: culturalData?.culturalColors,
    layoutPreferences: culturalData?.layoutPreferences,
    numberPattern: culturalData?.numberPattern,
    dateTimePattern: culturalData?.dateTimePattern,
    inputPreferences: culturalData?.inputPreferences,
    interactionPatterns: culturalData?.interactionPatterns,
    formatNumber,
    formatCurrency,
    formatDate,
    formatAddress,
    formatName,
    validateInput,
    getPlaceholder,
    isInitialized
  };

  return (
    <CulturalContext.Provider value={contextValue}>
      {children}
    </CulturalContext.Provider>
  );
};

// Higher-order component for class components
export const withCultural = (Component) => {
  const WrappedComponent = (props) => {
    const cultural = useCultural();
    return <Component {...props} cultural={cultural} />;
  };

  WrappedComponent.displayName = `withCultural(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

// Hook for RTL-aware styling
export const useRTLStyles = () => {
  const { isRTL, layoutPreferences } = useCultural();

  const getStyles = (ltrStyles, rtlStyles = {}) => {
    if (!isRTL) return ltrStyles;

    // Merge LTR styles with RTL overrides
    const mergedStyles = { ...ltrStyles };

    // Apply RTL-specific style transformations
    Object.entries(rtlStyles).forEach(([key, value]) => {
      mergedStyles[key] = value;
    });

    // Automatically flip directional properties
    if (ltrStyles.marginLeft && !rtlStyles.marginRight) {
      mergedStyles.marginRight = ltrStyles.marginLeft;
      delete mergedStyles.marginLeft;
    }
    if (ltrStyles.marginRight && !rtlStyles.marginLeft) {
      mergedStyles.marginLeft = ltrStyles.marginRight;
      delete mergedStyles.marginRight;
    }
    if (ltrStyles.paddingLeft && !rtlStyles.paddingRight) {
      mergedStyles.paddingRight = ltrStyles.paddingLeft;
      delete mergedStyles.paddingLeft;
    }
    if (ltrStyles.paddingRight && !rtlStyles.paddingLeft) {
      mergedStyles.paddingLeft = ltrStyles.paddingRight;
      delete mergedStyles.paddingRight;
    }
    if (ltrStyles.left && !rtlStyles.right) {
      mergedStyles.right = ltrStyles.left;
      delete mergedStyles.left;
    }
    if (ltrStyles.right && !rtlStyles.left) {
      mergedStyles.left = ltrStyles.right;
      delete mergedStyles.right;
    }

    return mergedStyles;
  };

  const getClassName = (ltrClasses, rtlClasses = '') => {
    const baseClasses = typeof ltrClasses === 'string' ? ltrClasses : '';
    const rtlClassOverrides = typeof rtlClasses === 'string' ? rtlClasses : '';

    if (!isRTL) return baseClasses;

    // Combine base classes with RTL overrides
    let classes = baseClasses;

    // Replace directional classes
    classes = classes
      .replace(/\bml-/g, 'temp-mr-')
      .replace(/\bmr-/g, 'ml-')
      .replace(/\btemp-mr-/g, 'mr-')
      .replace(/\bpl-/g, 'temp-pr-')
      .replace(/\bpr-/g, 'pl-')
      .replace(/\btemp-pr-/g, 'pr-')
      .replace(/\bleft-/g, 'temp-right-')
      .replace(/\bright-/g, 'left-')
      .replace(/\btemp-right-/g, 'right-');

    // Add RTL-specific classes
    if (rtlClassOverrides) {
      classes += ` ${rtlClassOverrides}`;
    }

    return classes;
  };

  return {
    isRTL,
    layoutPreferences,
    getStyles,
    getClassName
  };
};

// Hook for cultural colors
export const useCulturalColors = () => {
  const { culturalColors } = useCultural();

  const getColor = (colorType) => {
    return culturalColors?.[colorType] || '#2563eb';
  };

  const getColorMeaning = (color) => {
    return culturalColors?.culturalMeaning?.[color] || '';
  };

  return {
    colors: culturalColors,
    getColor,
    getColorMeaning,
    primary: getColor('primary'),
    success: getColor('success'),
    warning: getColor('warning'),
    error: getColor('error')
  };
};

// Hook for number formatting
export const useCulturalNumbers = () => {
  const { formatNumber, formatCurrency, numberPattern, culturalAdaptations } = useCultural();
  const { locale } = useI18n();

  const parseNumber = (numberString) => {
    if (!numberPattern || !numberString) return 0;

    // Remove thousands separators and replace decimal separator
    let cleaned = numberString
      .replace(new RegExp(`\\${numberPattern.thousands}`, 'g'), '')
      .replace(numberPattern.decimal, '.');

    // Handle cultural digits
    if (numberPattern.digits && numberPattern.digits !== '0123456789') {
      const westernDigits = '0123456789';
      const culturalDigits = numberPattern.digits;

      for (let i = 0; i < culturalDigits.length; i++) {
        cleaned = cleaned.replace(
          new RegExp(culturalDigits[i], 'g'),
          westernDigits[i]
        );
      }
    }

    return parseFloat(cleaned) || 0;
  };

  const formatPercentage = (value, options = {}) => {
    return formatNumber(value, { style: 'percent', ...options });
  };

  const formatInteger = (value) => {
    return formatNumber(value, { maximumFractionDigits: 0 });
  };

  return {
    formatNumber,
    formatCurrency,
    formatPercentage,
    formatInteger,
    parseNumber,
    pattern: numberPattern
  };
};

// Hook for date formatting
export const useCulturalDates = () => {
  const { formatDate, dateTimePattern } = useCultural();
  const { locale } = useI18n();

  const formatTime = (date, options = {}) => {
    if (!locale) return '';
    return new Intl.DateTimeFormat(locale, {
      timeStyle: 'short',
      hour12: dateTimePattern?.timeFormat === '12h',
      ...options
    }).format(date);
  };

  const formatDateTime = (date, options = {}) => {
    if (!locale) return '';
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      hour12: dateTimePattern?.timeFormat === '12h',
      ...options
    }).format(date);
  };

  const formatRelativeTime = (date) => {
    if (!locale) return '';
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const now = new Date();
    const diffInDays = Math.floor((date - now) / (1000 * 60 * 60 * 24));

    if (Math.abs(diffInDays) < 1) {
      const diffInHours = Math.floor((date - now) / (1000 * 60 * 60));
      return rtf.format(diffInHours, 'hour');
    } else if (Math.abs(diffInDays) < 7) {
      return rtf.format(diffInDays, 'day');
    } else if (Math.abs(diffInDays) < 30) {
      const diffInWeeks = Math.floor(diffInDays / 7);
      return rtf.format(diffInWeeks, 'week');
    } else {
      const diffInMonths = Math.floor(diffInDays / 30);
      return rtf.format(diffInMonths, 'month');
    }
  };

  const getWorkingDays = () => {
    return dateTimePattern?.workingDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  };

  const getWeekStart = () => {
    return dateTimePattern?.weekStart || 'sunday';
  };

  return {
    formatDate,
    formatTime,
    formatDateTime,
    formatRelativeTime,
    getWorkingDays,
    getWeekStart,
    pattern: dateTimePattern
  };
};

export default CulturalProvider;