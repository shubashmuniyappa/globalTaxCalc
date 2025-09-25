const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const path = require('path');
const config = require('../config');
const { templateLogger } = require('../utils/logger');
const Formatters = require('../utils/formatters');

/**
 * Localization Service using i18next
 */
class LocalizationService {
  constructor() {
    this.i18n = i18next.createInstance();
    this.isInitialized = false;
    this.formatters = new Map(); // Cache formatters by locale
  }

  /**
   * Initialize the localization service
   */
  async initialize() {
    try {
      templateLogger.info('Initializing Localization Service...');

      await this.i18n
        .use(Backend)
        .init({
          lng: config.i18n.defaultLanguage,
          fallbackLng: config.i18n.defaultLanguage,
          debug: config.server.env === 'development',

          // Namespace configuration
          ns: ['common', 'reports', 'forms'],
          defaultNS: 'common',

          // Backend configuration
          backend: {
            loadPath: path.join(config.i18n.localesPath, '{{lng}}/{{ns}}.json'),
            addPath: path.join(config.i18n.localesPath, '{{lng}}/{{ns}}.missing.json'),
          },

          // Interpolation options
          interpolation: {
            escapeValue: false, // React already does escaping
            formatSeparator: ',',
            format: (value, format, lng) => {
              return this.formatValue(value, format, lng);
            }
          },

          // Resource configuration
          resources: {},

          // Supported languages
          supportedLngs: config.i18n.supportedLanguages,
          preload: config.i18n.supportedLanguages,

          // Key separator
          keySeparator: '.',
          nsSeparator: ':',

          // Pluralization
          pluralSeparator: '_',
          contextSeparator: '_',

          // Missing key handling
          saveMissing: config.server.env === 'development',
          missingKeyHandler: (lng, ns, key, fallbackValue) => {
            templateLogger.warn('Missing translation key', {
              language: lng,
              namespace: ns,
              key,
              fallbackValue
            });
          }
        });

      // Preload formatters for supported languages
      for (const lang of config.i18n.supportedLanguages) {
        this.formatters.set(lang, new Formatters(lang, config.i18n.defaultCurrency));
      }

      this.isInitialized = true;
      templateLogger.info('Localization Service initialized successfully', {
        defaultLanguage: config.i18n.defaultLanguage,
        supportedLanguages: config.i18n.supportedLanguages.length
      });

    } catch (error) {
      templateLogger.error('Failed to initialize Localization Service', { error: error.message });
      throw error;
    }
  }

  /**
   * Get translation for a key
   * @param {string} key - Translation key
   * @param {object} options - Translation options
   * @returns {string} Translated text
   */
  t(key, options = {}) {
    if (!this.isInitialized) {
      return key; // Return key as fallback if not initialized
    }

    const { lng = config.i18n.defaultLanguage, ...i18nOptions } = options;

    try {
      return this.i18n.t(key, { lng, ...i18nOptions });
    } catch (error) {
      templateLogger.error('Translation error', { key, lng, error: error.message });
      return key;
    }
  }

  /**
   * Change language for the service
   * @param {string} language - Language code
   * @returns {Promise<void>}
   */
  async changeLanguage(language) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!config.i18n.supportedLanguages.includes(language)) {
      throw new Error(`Unsupported language: ${language}`);
    }

    await this.i18n.changeLanguage(language);
    templateLogger.info('Language changed', { language });
  }

  /**
   * Get localized date formatting patterns
   * @param {string} locale - Locale code
   * @returns {object} Date formatting patterns
   */
  getDateFormats(locale = config.i18n.defaultLanguage) {
    const formats = {
      'en': {
        short: 'MM/DD/YYYY',
        medium: 'MMM DD, YYYY',
        long: 'MMMM DD, YYYY',
        full: 'dddd, MMMM DD, YYYY'
      },
      'es': {
        short: 'DD/MM/YYYY',
        medium: 'DD MMM YYYY',
        long: 'DD [de] MMMM [de] YYYY',
        full: 'dddd, DD [de] MMMM [de] YYYY'
      },
      'fr': {
        short: 'DD/MM/YYYY',
        medium: 'DD MMM YYYY',
        long: 'DD MMMM YYYY',
        full: 'dddd DD MMMM YYYY'
      },
      'de': {
        short: 'DD.MM.YYYY',
        medium: 'DD. MMM YYYY',
        long: 'DD. MMMM YYYY',
        full: 'dddd, DD. MMMM YYYY'
      },
      'it': {
        short: 'DD/MM/YYYY',
        medium: 'DD MMM YYYY',
        long: 'DD MMMM YYYY',
        full: 'dddd DD MMMM YYYY'
      }
    };

    return formats[locale] || formats['en'];
  }

  /**
   * Get localized number formatting patterns
   * @param {string} locale - Locale code
   * @returns {object} Number formatting patterns
   */
  getNumberFormats(locale = config.i18n.defaultLanguage) {
    const formats = {
      'en': { decimal: '.', thousands: ',', grouping: 3 },
      'es': { decimal: ',', thousands: '.', grouping: 3 },
      'fr': { decimal: ',', thousands: ' ', grouping: 3 },
      'de': { decimal: ',', thousands: '.', grouping: 3 },
      'it': { decimal: ',', thousands: '.', grouping: 3 }
    };

    return formats[locale] || formats['en'];
  }

  /**
   * Get localized currency information
   * @param {string} locale - Locale code
   * @param {string} currency - Currency code
   * @returns {object} Currency formatting information
   */
  getCurrencyFormat(locale = config.i18n.defaultLanguage, currency = config.i18n.defaultCurrency) {
    const currencyInfo = {
      'USD': { symbol: '$', name: 'US Dollar', position: 'before' },
      'EUR': { symbol: '€', name: 'Euro', position: 'after' },
      'GBP': { symbol: '£', name: 'British Pound', position: 'before' },
      'CAD': { symbol: 'C$', name: 'Canadian Dollar', position: 'before' },
      'JPY': { symbol: '¥', name: 'Japanese Yen', position: 'before' },
      'AUD': { symbol: 'A$', name: 'Australian Dollar', position: 'before' }
    };

    const localizedNames = {
      'en': {
        'USD': 'US Dollar',
        'EUR': 'Euro',
        'GBP': 'British Pound',
        'CAD': 'Canadian Dollar',
        'JPY': 'Japanese Yen',
        'AUD': 'Australian Dollar'
      },
      'es': {
        'USD': 'Dólar Estadounidense',
        'EUR': 'Euro',
        'GBP': 'Libra Esterlina',
        'CAD': 'Dólar Canadiense',
        'JPY': 'Yen Japonés',
        'AUD': 'Dólar Australiano'
      },
      'fr': {
        'USD': 'Dollar Américain',
        'EUR': 'Euro',
        'GBP': 'Livre Sterling',
        'CAD': 'Dollar Canadien',
        'JPY': 'Yen Japonais',
        'AUD': 'Dollar Australien'
      }
    };

    const info = currencyInfo[currency] || currencyInfo['USD'];
    const names = localizedNames[locale] || localizedNames['en'];

    return {
      ...info,
      name: names[currency] || info.name,
      code: currency
    };
  }

  /**
   * Format value based on format type and locale
   * @param {any} value - Value to format
   * @param {string} format - Format type
   * @param {string} lng - Language code
   * @returns {string} Formatted value
   */
  formatValue(value, format, lng) {
    if (!value && value !== 0) return '';

    const formatter = this.getFormatter(lng);

    try {
      switch (format) {
        case 'currency':
          return formatter.formatCurrency(value);

        case 'percentage':
        case 'percent':
          return formatter.formatPercentage(value);

        case 'number':
          return formatter.formatNumber(value);

        case 'date':
          return formatter.formatDate(value);

        case 'date.short':
          return formatter.formatDate(value, 'short');

        case 'date.medium':
          return formatter.formatDate(value, 'medium');

        case 'date.long':
          return formatter.formatDate(value, 'long');

        case 'date.full':
          return formatter.formatDate(value, 'full');

        case 'fileSize':
          return formatter.formatFileSize(value);

        case 'duration':
          return formatter.formatDuration(value);

        default:
          return value.toString();
      }
    } catch (error) {
      templateLogger.error('Value formatting error', { value, format, lng, error: error.message });
      return value.toString();
    }
  }

  /**
   * Get or create formatter for locale
   * @param {string} locale - Locale code
   * @returns {Formatters} Formatter instance
   */
  getFormatter(locale = config.i18n.defaultLanguage) {
    if (!this.formatters.has(locale)) {
      this.formatters.set(locale, new Formatters(locale, config.i18n.defaultCurrency));
    }
    return this.formatters.get(locale);
  }

  /**
   * Get text direction for locale
   * @param {string} locale - Locale code
   * @returns {string} Text direction ('ltr' or 'rtl')
   */
  getTextDirection(locale = config.i18n.defaultLanguage) {
    return config.i18n.rtlLanguages.includes(locale) ? 'rtl' : 'ltr';
  }

  /**
   * Get localized report template data
   * @param {string} templateType - Template type
   * @param {string} locale - Locale code
   * @returns {object} Localized template data
   */
  getLocalizedTemplateData(templateType, locale = config.i18n.defaultLanguage) {
    const direction = this.getTextDirection(locale);
    const dateFormats = this.getDateFormats(locale);
    const numberFormats = this.getNumberFormats(locale);
    const currencyFormat = this.getCurrencyFormat(locale);

    return {
      locale,
      direction,
      dateFormats,
      numberFormats,
      currencyFormat,
      translations: {
        company: this.t('company', { lng: locale }),
        reports: this.t('reports', { lng: locale }),
        fields: this.t('fields', { lng: locale }),
        charts: this.t('charts', { lng: locale }),
        recommendations: this.t('recommendations', { lng: locale }),
        analysis: this.t('analysis', { lng: locale }),
        export: this.t('export', { lng: locale }),
        disclaimer: this.t('disclaimer', { lng: locale }),
        footer: this.t('footer', { lng: locale }),
        messages: this.t('messages', { lng: locale })
      }
    };
  }

  /**
   * Get localized report title
   * @param {string} reportType - Report type
   * @param {string} locale - Locale code
   * @param {object} params - Title parameters
   * @returns {string} Localized title
   */
  getLocalizedReportTitle(reportType, locale = config.i18n.defaultLanguage, params = {}) {
    const titleKey = `reports.title.${reportType}`;
    return this.t(titleKey, { lng: locale, ...params });
  }

  /**
   * Get localized field labels
   * @param {array} fields - Array of field names
   * @param {string} locale - Locale code
   * @returns {object} Localized field labels
   */
  getLocalizedFieldLabels(fields, locale = config.i18n.defaultLanguage) {
    const labels = {};

    fields.forEach(field => {
      // Try different field categories
      const categories = ['basic', 'income', 'taxes', 'rates', 'deductions', 'credits'];

      for (const category of categories) {
        const key = `fields.${category}.${field}`;
        const translation = this.t(key, { lng: locale });

        if (translation !== key) {
          labels[field] = translation;
          break;
        }
      }

      // Fallback to formatted field name
      if (!labels[field]) {
        labels[field] = field.replace(/([A-Z])/g, ' $1')
                           .replace(/^./, str => str.toUpperCase());
      }
    });

    return labels;
  }

  /**
   * Get supported languages information
   * @returns {array} Array of language information
   */
  getSupportedLanguages() {
    const languageNames = {
      'en': { native: 'English', english: 'English' },
      'es': { native: 'Español', english: 'Spanish' },
      'fr': { native: 'Français', english: 'French' },
      'de': { native: 'Deutsch', english: 'German' },
      'it': { native: 'Italiano', english: 'Italian' }
    };

    return config.i18n.supportedLanguages.map(lang => ({
      code: lang,
      ...languageNames[lang],
      rtl: config.i18n.rtlLanguages.includes(lang)
    }));
  }

  /**
   * Validate locale
   * @param {string} locale - Locale code to validate
   * @returns {boolean} Whether locale is supported
   */
  isValidLocale(locale) {
    return config.i18n.supportedLanguages.includes(locale);
  }

  /**
   * Get current language
   * @returns {string} Current language code
   */
  getCurrentLanguage() {
    return this.i18n.language || config.i18n.defaultLanguage;
  }

  /**
   * Load additional translations
   * @param {string} lng - Language code
   * @param {string} ns - Namespace
   * @param {object} resources - Translation resources
   */
  addTranslations(lng, ns, resources) {
    this.i18n.addResourceBundle(lng, ns, resources, true, true);
    templateLogger.info('Additional translations loaded', { lng, ns });
  }

  /**
   * Get missing translations
   * @param {string} lng - Language code
   * @returns {object} Missing translations by namespace
   */
  getMissingTranslations(lng) {
    return this.i18n.services.backendConnector.backend.missing[lng] || {};
  }

  /**
   * Health check
   * @returns {object} Health status
   */
  healthCheck() {
    return {
      healthy: this.isInitialized,
      currentLanguage: this.getCurrentLanguage(),
      supportedLanguages: config.i18n.supportedLanguages,
      loadedNamespaces: this.i18n.options?.ns || [],
      status: this.isInitialized ? 'Healthy' : 'Not initialized'
    };
  }

  /**
   * Get statistics
   * @returns {object} Service statistics
   */
  getStatistics() {
    return {
      initialized: this.isInitialized,
      currentLanguage: this.getCurrentLanguage(),
      supportedLanguagesCount: config.i18n.supportedLanguages.length,
      cachedFormatters: this.formatters.size,
      rtlLanguagesCount: config.i18n.rtlLanguages.length,
      namespaces: this.i18n.options?.ns || []
    };
  }
}

module.exports = LocalizationService;