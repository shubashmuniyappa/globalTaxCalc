const moment = require('moment-timezone');
const numeral = require('numeral');

/**
 * Formatting utilities for reports and exports
 */
class Formatters {
  constructor(locale = 'en', currency = 'USD', timezone = 'America/New_York') {
    this.locale = locale;
    this.currency = currency;
    this.timezone = timezone;

    // Set moment locale
    moment.locale(locale);

    // Currency symbols mapping
    this.currencySymbols = {
      'USD': '$',
      'CAD': 'C$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'AUD': 'A$',
      'CHF': 'CHF',
      'CNY': '¥',
      'INR': '₹',
      'MXN': 'MX$'
    };

    // Number formatting patterns by locale
    this.numberFormats = {
      'en': {
        decimal: '.',
        thousands: ',',
        currency: '$0,0.00',
        percentage: '0.00%',
        integer: '0,0'
      },
      'fr': {
        decimal: ',',
        thousands: ' ',
        currency: '0,0.00 €',
        percentage: '0,00%',
        integer: '0,0'
      },
      'de': {
        decimal: ',',
        thousands: '.',
        currency: '0,0.00 €',
        percentage: '0,00%',
        integer: '0,0'
      },
      'es': {
        decimal: ',',
        thousands: '.',
        currency: '$0,0.00',
        percentage: '0,00%',
        integer: '0,0'
      },
      'it': {
        decimal: ',',
        thousands: '.',
        currency: '€ 0,0.00',
        percentage: '0,00%',
        integer: '0,0'
      }
    };

    // Date formatting patterns by locale
    this.dateFormats = {
      'en': {
        short: 'MM/DD/YYYY',
        medium: 'MMM DD, YYYY',
        long: 'MMMM DD, YYYY',
        full: 'dddd, MMMM DD, YYYY'
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
      'es': {
        short: 'DD/MM/YYYY',
        medium: 'DD MMM YYYY',
        long: 'DD [de] MMMM [de] YYYY',
        full: 'dddd, DD [de] MMMM [de] YYYY'
      },
      'it': {
        short: 'DD/MM/YYYY',
        medium: 'DD MMM YYYY',
        long: 'DD MMMM YYYY',
        full: 'dddd DD MMMM YYYY'
      }
    };
  }

  /**
   * Format currency amount
   * @param {number} amount - Amount to format
   * @param {object} options - Formatting options
   * @returns {string} Formatted currency string
   */
  formatCurrency(amount, options = {}) {
    const {
      showSymbol = true,
      showCents = true,
      locale = this.locale,
      currency = this.currency
    } = options;

    if (amount === null || amount === undefined || isNaN(amount)) {
      return showSymbol ? this.currencySymbols[currency] + '0.00' : '0.00';
    }

    const format = this.numberFormats[locale] || this.numberFormats['en'];
    const symbol = this.currencySymbols[currency] || '$';

    let formatPattern;
    if (showSymbol) {
      formatPattern = showCents ? format.currency : symbol + '0,0';
    } else {
      formatPattern = showCents ? '0,0.00' : '0,0';
    }

    // Handle negative amounts
    if (amount < 0) {
      const positiveFormatted = numeral(Math.abs(amount)).format(formatPattern);
      return showSymbol ? `(${positiveFormatted})` : `(${positiveFormatted})`;
    }

    return numeral(amount).format(formatPattern);
  }

  /**
   * Format percentage
   * @param {number} value - Value to format as percentage
   * @param {object} options - Formatting options
   * @returns {string} Formatted percentage string
   */
  formatPercentage(value, options = {}) {
    const {
      decimals = 2,
      locale = this.locale,
      multiplier = 1
    } = options;

    if (value === null || value === undefined || isNaN(value)) {
      return '0.00%';
    }

    const actualValue = value * multiplier;
    const format = this.numberFormats[locale] || this.numberFormats['en'];

    return numeral(actualValue).format(
      decimals === 0 ? '0%' : `0.${'0'.repeat(decimals)}%`
    );
  }

  /**
   * Format regular numbers
   * @param {number} value - Value to format
   * @param {object} options - Formatting options
   * @returns {string} Formatted number string
   */
  formatNumber(value, options = {}) {
    const {
      decimals = 0,
      showThousands = true,
      locale = this.locale
    } = options;

    if (value === null || value === undefined || isNaN(value)) {
      return '0';
    }

    const format = this.numberFormats[locale] || this.numberFormats['en'];

    let formatPattern;
    if (showThousands) {
      formatPattern = decimals > 0 ? `0,0.${'0'.repeat(decimals)}` : '0,0';
    } else {
      formatPattern = decimals > 0 ? `0.${'0'.repeat(decimals)}` : '0';
    }

    return numeral(value).format(formatPattern);
  }

  /**
   * Format dates
   * @param {Date|string} date - Date to format
   * @param {string} format - Format type (short, medium, long, full) or custom format
   * @param {object} options - Formatting options
   * @returns {string} Formatted date string
   */
  formatDate(date, format = 'medium', options = {}) {
    const {
      locale = this.locale,
      timezone = this.timezone
    } = options;

    if (!date) return '';

    const momentDate = moment.tz(date, timezone);
    const formats = this.dateFormats[locale] || this.dateFormats['en'];

    // Check if format is a predefined format
    if (formats[format]) {
      return momentDate.format(formats[format]);
    }

    // Use custom format
    return momentDate.format(format);
  }

  /**
   * Format date range
   * @param {Date|string} startDate - Start date
   * @param {Date|string} endDate - End date
   * @param {string} format - Format type
   * @param {object} options - Formatting options
   * @returns {string} Formatted date range string
   */
  formatDateRange(startDate, endDate, format = 'medium', options = {}) {
    const {
      separator = ' - ',
      locale = this.locale
    } = options;

    if (!startDate || !endDate) return '';

    const formattedStart = this.formatDate(startDate, format, options);
    const formattedEnd = this.formatDate(endDate, format, options);

    return `${formattedStart}${separator}${formattedEnd}`;
  }

  /**
   * Format tax year
   * @param {number} year - Tax year
   * @param {object} options - Formatting options
   * @returns {string} Formatted tax year string
   */
  formatTaxYear(year, options = {}) {
    const {
      locale = this.locale,
      showLabel = true
    } = options;

    if (!year) return '';

    const labels = {
      'en': 'Tax Year',
      'fr': 'Année fiscale',
      'de': 'Steuerjahr',
      'es': 'Año fiscal',
      'it': 'Anno fiscale'
    };

    const label = labels[locale] || labels['en'];

    return showLabel ? `${label} ${year}` : year.toString();
  }

  /**
   * Format file size
   * @param {number} bytes - File size in bytes
   * @param {object} options - Formatting options
   * @returns {string} Formatted file size string
   */
  formatFileSize(bytes, options = {}) {
    const {
      decimals = 1,
      locale = this.locale
    } = options;

    if (bytes === 0) return '0 Bytes';
    if (!bytes || bytes < 0) return '';

    const k = 1024;
    const sizes = {
      'en': ['Bytes', 'KB', 'MB', 'GB', 'TB'],
      'fr': ['Octets', 'Ko', 'Mo', 'Go', 'To'],
      'de': ['Bytes', 'KB', 'MB', 'GB', 'TB'],
      'es': ['Bytes', 'KB', 'MB', 'GB', 'TB'],
      'it': ['Byte', 'KB', 'MB', 'GB', 'TB']
    };

    const sizeLabels = sizes[locale] || sizes['en'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = parseFloat((bytes / Math.pow(k, i)).toFixed(decimals));

    return `${this.formatNumber(size, { decimals: decimals })} ${sizeLabels[i]}`;
  }

  /**
   * Format duration in milliseconds
   * @param {number} milliseconds - Duration in milliseconds
   * @param {object} options - Formatting options
   * @returns {string} Formatted duration string
   */
  formatDuration(milliseconds, options = {}) {
    const {
      format = 'auto',
      locale = this.locale
    } = options;

    if (!milliseconds || milliseconds < 0) return '';

    const duration = moment.duration(milliseconds);

    const labels = {
      'en': {
        days: 'd', hours: 'h', minutes: 'm', seconds: 's',
        day: 'day', days_plural: 'days',
        hour: 'hour', hours_plural: 'hours',
        minute: 'minute', minutes_plural: 'minutes',
        second: 'second', seconds_plural: 'seconds'
      },
      'fr': {
        days: 'j', hours: 'h', minutes: 'm', seconds: 's',
        day: 'jour', days_plural: 'jours',
        hour: 'heure', hours_plural: 'heures',
        minute: 'minute', minutes_plural: 'minutes',
        second: 'seconde', seconds_plural: 'secondes'
      }
    };

    const l = labels[locale] || labels['en'];

    if (format === 'short') {
      if (duration.days() > 0) return `${duration.days()}${l.days}`;
      if (duration.hours() > 0) return `${duration.hours()}${l.hours}`;
      if (duration.minutes() > 0) return `${duration.minutes()}${l.minutes}`;
      return `${duration.seconds()}${l.seconds}`;
    }

    // Auto format - show most significant unit
    if (duration.days() > 0) {
      return `${duration.days()} ${duration.days() === 1 ? l.day : l.days_plural}`;
    }
    if (duration.hours() > 0) {
      return `${duration.hours()} ${duration.hours() === 1 ? l.hour : l.hours_plural}`;
    }
    if (duration.minutes() > 0) {
      return `${duration.minutes()} ${duration.minutes() === 1 ? l.minute : l.minutes_plural}`;
    }
    return `${duration.seconds()} ${duration.seconds() === 1 ? l.second : l.seconds_plural}`;
  }

  /**
   * Format social security number
   * @param {string} ssn - SSN to format
   * @param {object} options - Formatting options
   * @returns {string} Formatted SSN string
   */
  formatSSN(ssn, options = {}) {
    const { mask = false, country = 'US' } = options;

    if (!ssn) return '';

    // Remove all non-digits
    const digits = ssn.replace(/\D/g, '');

    if (country === 'US') {
      if (digits.length !== 9) return ssn; // Return original if invalid length

      if (mask) {
        return `XXX-XX-${digits.slice(-4)}`;
      }

      return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
    }

    // Add more country-specific formatting as needed
    return ssn;
  }

  /**
   * Format employer identification number
   * @param {string} ein - EIN to format
   * @param {object} options - Formatting options
   * @returns {string} Formatted EIN string
   */
  formatEIN(ein, options = {}) {
    const { mask = false } = options;

    if (!ein) return '';

    // Remove all non-digits
    const digits = ein.replace(/\D/g, '');

    if (digits.length !== 9) return ein; // Return original if invalid length

    if (mask) {
      return `XX-${digits.slice(-6)}`;
    }

    return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  }

  /**
   * Create formatter instance for specific locale
   * @param {string} locale - Locale code
   * @param {string} currency - Currency code
   * @param {string} timezone - Timezone
   * @returns {Formatters} New formatter instance
   */
  static createFormatter(locale, currency, timezone) {
    return new Formatters(locale, currency, timezone);
  }

  /**
   * Get available locales
   * @returns {array} Array of supported locale codes
   */
  static getSupportedLocales() {
    return ['en', 'fr', 'de', 'es', 'it'];
  }

  /**
   * Get available currencies
   * @returns {array} Array of supported currency codes
   */
  static getSupportedCurrencies() {
    return ['USD', 'CAD', 'EUR', 'GBP', 'JPY', 'AUD', 'CHF', 'CNY', 'INR', 'MXN'];
  }
}

module.exports = Formatters;