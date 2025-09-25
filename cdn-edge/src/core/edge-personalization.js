/**
 * Edge Personalization - Location-based content delivery and personalization
 */

export class EdgePersonalization {
  constructor() {
    this.countryConfigs = this.initializeCountryConfigs();
    this.currencyRates = new Map();
    this.languageConfigs = this.initializeLanguageConfigs();
    this.taxConfigs = this.initializeTaxConfigs();
    this.regionFeatures = this.initializeRegionFeatures();
  }

  /**
   * Initialize country-specific configurations
   */
  initializeCountryConfigs() {
    return {
      'US': {
        currency: 'USD',
        locale: 'en-US',
        dateFormat: 'MM/DD/YYYY',
        taxYear: 2024,
        filingDeadline: '2024-04-15',
        defaultState: null,
        supportedFeatures: ['federal', 'state', 'local', 'business'],
        timezone: 'America/New_York'
      },
      'CA': {
        currency: 'CAD',
        locale: 'en-CA',
        dateFormat: 'DD/MM/YYYY',
        taxYear: 2024,
        filingDeadline: '2024-04-30',
        defaultState: null,
        supportedFeatures: ['federal', 'provincial', 'gst'],
        timezone: 'America/Toronto'
      },
      'GB': {
        currency: 'GBP',
        locale: 'en-GB',
        dateFormat: 'DD/MM/YYYY',
        taxYear: '2023-24',
        filingDeadline: '2025-01-31',
        defaultState: null,
        supportedFeatures: ['income', 'vat', 'corporate'],
        timezone: 'Europe/London'
      },
      'DE': {
        currency: 'EUR',
        locale: 'de-DE',
        dateFormat: 'DD.MM.YYYY',
        taxYear: 2024,
        filingDeadline: '2025-05-31',
        defaultState: null,
        supportedFeatures: ['income', 'vat', 'corporate', 'church'],
        timezone: 'Europe/Berlin'
      },
      'AU': {
        currency: 'AUD',
        locale: 'en-AU',
        dateFormat: 'DD/MM/YYYY',
        taxYear: '2023-24',
        filingDeadline: '2024-10-31',
        defaultState: null,
        supportedFeatures: ['income', 'gst', 'fringe'],
        timezone: 'Australia/Sydney'
      },
      'IN': {
        currency: 'INR',
        locale: 'en-IN',
        dateFormat: 'DD/MM/YYYY',
        taxYear: '2024-25',
        filingDeadline: '2024-07-31',
        defaultState: null,
        supportedFeatures: ['income', 'gst', 'tds'],
        timezone: 'Asia/Kolkata'
      },
      'JP': {
        currency: 'JPY',
        locale: 'ja-JP',
        dateFormat: 'YYYY/MM/DD',
        taxYear: 2024,
        filingDeadline: '2025-03-15',
        defaultState: null,
        supportedFeatures: ['income', 'consumption', 'corporate'],
        timezone: 'Asia/Tokyo'
      },
      'BR': {
        currency: 'BRL',
        locale: 'pt-BR',
        dateFormat: 'DD/MM/YYYY',
        taxYear: 2024,
        filingDeadline: '2025-04-30',
        defaultState: null,
        supportedFeatures: ['income', 'ipi', 'icms'],
        timezone: 'America/Sao_Paulo'
      }
    };
  }

  /**
   * Initialize language configurations
   */
  initializeLanguageConfigs() {
    return {
      'en': {
        name: 'English',
        rtl: false,
        fallback: 'en-US',
        supportedCountries: ['US', 'CA', 'GB', 'AU', 'IN']
      },
      'es': {
        name: 'Español',
        rtl: false,
        fallback: 'es-ES',
        supportedCountries: ['ES', 'MX', 'AR', 'CO', 'CL']
      },
      'fr': {
        name: 'Français',
        rtl: false,
        fallback: 'fr-FR',
        supportedCountries: ['FR', 'CA', 'BE', 'CH']
      },
      'de': {
        name: 'Deutsch',
        rtl: false,
        fallback: 'de-DE',
        supportedCountries: ['DE', 'AT', 'CH']
      },
      'pt': {
        name: 'Português',
        rtl: false,
        fallback: 'pt-BR',
        supportedCountries: ['BR', 'PT']
      },
      'ja': {
        name: '日本語',
        rtl: false,
        fallback: 'ja-JP',
        supportedCountries: ['JP']
      },
      'hi': {
        name: 'हिन्दी',
        rtl: false,
        fallback: 'hi-IN',
        supportedCountries: ['IN']
      }
    };
  }

  /**
   * Initialize tax configurations by country
   */
  initializeTaxConfigs() {
    return {
      'US': {
        standardDeduction: {
          single: 14600,
          marriedFilingJointly: 29200,
          marriedFilingSeparately: 14600,
          headOfHousehold: 21900
        },
        taxBrackets: [
          { min: 0, max: 11000, rate: 0.10 },
          { min: 11000, max: 44725, rate: 0.12 },
          { min: 44725, max: 95375, rate: 0.22 },
          { min: 95375, max: 182050, rate: 0.24 },
          { min: 182050, max: 231250, rate: 0.32 },
          { min: 231250, max: 578125, rate: 0.35 },
          { min: 578125, max: Infinity, rate: 0.37 }
        ],
        businessDeductions: ['homeOffice', 'equipment', 'travel', 'meals'],
        maxContributions: {
          '401k': 23000,
          'ira': 7000,
          'hsa': 4300
        }
      },
      'CA': {
        standardDeduction: 15000, // Basic personal amount
        taxBrackets: [
          { min: 0, max: 53359, rate: 0.15 },
          { min: 53359, max: 106717, rate: 0.205 },
          { min: 106717, max: 165430, rate: 0.26 },
          { min: 165430, max: 235675, rate: 0.29 },
          { min: 235675, max: Infinity, rate: 0.33 }
        ],
        provincialRates: {
          'ON': [0.0505, 0.0915, 0.1116, 0.1216, 0.1316],
          'BC': [0.0506, 0.077, 0.105, 0.1229, 0.1479],
          'AB': [0.10, 0.12, 0.13, 0.14, 0.15]
        },
        gstRate: 0.05,
        businessDeductions: ['homeOffice', 'equipment', 'travel', 'advertising']
      },
      'GB': {
        personalAllowance: 12570,
        taxBrackets: [
          { min: 0, max: 37700, rate: 0.20 },
          { min: 37700, max: 125140, rate: 0.40 },
          { min: 125140, max: Infinity, rate: 0.45 }
        ],
        vatRate: 0.20,
        businessDeductions: ['equipment', 'travel', 'office', 'professional']
      }
    };
  }

  /**
   * Initialize region-specific features
   */
  initializeRegionFeatures() {
    return {
      'NA': { // North America
        features: ['multiState', 'retirement401k', 'healthSavings'],
        paymentMethods: ['card', 'ach', 'paypal'],
        preferredCurrency: 'USD'
      },
      'EU': { // Europe
        features: ['vat', 'crossBorder', 'gdprCompliance'],
        paymentMethods: ['card', 'sepa', 'paypal'],
        preferredCurrency: 'EUR'
      },
      'APAC': { // Asia Pacific
        features: ['consumption', 'crossBorder', 'localPayments'],
        paymentMethods: ['card', 'alipay', 'wechat'],
        preferredCurrency: 'local'
      }
    };
  }

  /**
   * Serve personalized calculator based on location and preferences
   */
  async servePersonalizedCalculator(request, context) {
    try {
      const personalizationData = await this.extractPersonalizationData(request, context);
      const calculatorConfig = await this.buildCalculatorConfig(personalizationData);

      // Get base calculator page
      const baseResponse = await this.fetchCalculatorPage(request, context);

      if (!baseResponse.ok) {
        return baseResponse;
      }

      // Inject personalization
      const personalizedResponse = await this.injectPersonalization(
        baseResponse,
        calculatorConfig,
        personalizationData
      );

      // Add personalization headers
      this.addPersonalizationHeaders(personalizedResponse, personalizationData);

      return personalizedResponse;

    } catch (error) {
      console.error('Personalization error:', error);
      // Fallback to non-personalized version
      return await this.fetchCalculatorPage(request, context);
    }
  }

  /**
   * Extract personalization data from request
   */
  async extractPersonalizationData(request, context) {
    const url = new URL(request.url);

    // Extract country from Cloudflare or IP geolocation
    const country = context.country || 'US';

    // Extract language from Accept-Language header or URL parameter
    const acceptLanguage = request.headers.get('Accept-Language') || '';
    const urlLang = url.searchParams.get('lang');
    const detectedLanguage = this.detectLanguage(acceptLanguage, country, urlLang);

    // Extract currency preference
    const currency = this.getCurrencyForCountry(country);

    // Extract user preferences from cookies
    const preferences = await this.extractUserPreferences(request);

    // Determine timezone
    const timezone = this.getTimezoneForCountry(country);

    // Get regional features
    const region = this.getRegionForCountry(country);
    const regionalFeatures = this.regionFeatures[region] || this.regionFeatures['NA'];

    return {
      country,
      language: detectedLanguage,
      currency,
      timezone,
      region,
      preferences,
      regionalFeatures,
      countryConfig: this.countryConfigs[country] || this.countryConfigs['US'],
      taxConfig: this.taxConfigs[country] || this.taxConfigs['US'],
      isReturningUser: this.isReturningUser(request),
      deviceType: this.getDeviceType(request.headers.get('User-Agent')),
      sessionData: await this.getSessionData(request, context)
    };
  }

  /**
   * Build calculator configuration based on personalization
   */
  async buildCalculatorConfig(personalizationData) {
    const { country, taxConfig, countryConfig, currency, language } = personalizationData;

    return {
      taxYear: countryConfig.taxYear,
      currency: {
        code: currency,
        symbol: this.getCurrencySymbol(currency),
        rate: await this.getCurrencyRate(currency)
      },
      locale: {
        language,
        dateFormat: countryConfig.dateFormat,
        numberFormat: this.getNumberFormat(country, language),
        rtl: this.languageConfigs[language]?.rtl || false
      },
      taxSettings: {
        standardDeduction: taxConfig.standardDeduction,
        taxBrackets: taxConfig.taxBrackets,
        availableDeductions: taxConfig.businessDeductions || [],
        filingStatus: this.getAvailableFilingStatuses(country),
        maxContributions: taxConfig.maxContributions || {}
      },
      features: {
        enabled: countryConfig.supportedFeatures,
        paymentMethods: personalizationData.regionalFeatures.paymentMethods,
        multiCurrency: this.shouldEnableMultiCurrency(country),
        crossBorder: personalizationData.regionalFeatures.features.includes('crossBorder')
      },
      compliance: {
        filingDeadline: countryConfig.filingDeadline,
        requiredFields: this.getRequiredFields(country),
        validationRules: this.getValidationRules(country)
      },
      ui: {
        theme: this.getThemeForRegion(personalizationData.region),
        layout: this.getLayoutForDevice(personalizationData.deviceType),
        animations: this.shouldEnableAnimations(personalizationData.deviceType)
      }
    };
  }

  /**
   * Inject personalization into calculator page
   */
  async injectPersonalization(response, config, personalizationData) {
    try {
      const html = await response.text();

      // Create personalization script
      const personalizationScript = this.createPersonalizationScript(config, personalizationData);

      // Inject script before closing head tag
      const personalizedHtml = html.replace(
        '</head>',
        `${personalizationScript}\n</head>`
      );

      // Apply language-specific modifications
      const localizedHtml = await this.applyLanguageLocalization(
        personalizedHtml,
        personalizationData.language
      );

      // Apply region-specific content
      const regionSpecificHtml = await this.applyRegionSpecificContent(
        localizedHtml,
        personalizationData
      );

      return new Response(regionSpecificHtml, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });

    } catch (error) {
      console.error('Personalization injection error:', error);
      return response;
    }
  }

  /**
   * Create personalization script to inject
   */
  createPersonalizationScript(config, personalizationData) {
    const scriptContent = `
      window.GlobalTaxCalcPersonalization = ${JSON.stringify({
        config,
        userContext: {
          country: personalizationData.country,
          language: personalizationData.language,
          currency: personalizationData.currency,
          timezone: personalizationData.timezone,
          isReturningUser: personalizationData.isReturningUser
        },
        features: config.features,
        compliance: config.compliance
      })};

      // Initialize personalization on DOM ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePersonalization);
      } else {
        initializePersonalization();
      }

      function initializePersonalization() {
        const p = window.GlobalTaxCalcPersonalization;

        // Set currency formatting
        if (window.formatCurrency) {
          window.formatCurrency = function(amount) {
            return new Intl.NumberFormat(p.config.locale.language, {
              style: 'currency',
              currency: p.config.currency.code
            }).format(amount);
          };
        }

        // Set date formatting
        if (window.formatDate) {
          window.formatDate = function(date) {
            return new Intl.DateTimeFormat(p.config.locale.language, {
              timeZone: p.userContext.timezone
            }).format(new Date(date));
          };
        }

        // Initialize calculator with personalized settings
        if (window.initCalculator) {
          window.initCalculator(p.config.taxSettings);
        }

        // Apply UI theme
        document.body.className += ' theme-' + p.config.ui.theme;

        // Set language attribute
        document.documentElement.lang = p.userContext.language;

        // Set direction for RTL languages
        if (p.config.locale.rtl) {
          document.documentElement.dir = 'rtl';
        }

        // Show/hide features based on availability
        p.config.features.enabled.forEach(feature => {
          const elements = document.querySelectorAll('[data-feature="' + feature + '"]');
          elements.forEach(el => el.style.display = 'block');
        });

        // Hide unsupported features
        const allFeatures = ['federal', 'state', 'local', 'business', 'provincial', 'gst', 'vat'];
        allFeatures.filter(f => !p.config.features.enabled.includes(f)).forEach(feature => {
          const elements = document.querySelectorAll('[data-feature="' + feature + '"]');
          elements.forEach(el => el.style.display = 'none');
        });

        console.log('GlobalTaxCalc personalization initialized for', p.userContext.country);
      }
    `;

    return `<script type="text/javascript">${scriptContent}</script>`;
  }

  /**
   * Apply language localization to HTML
   */
  async applyLanguageLocalization(html, language) {
    // In production, this would fetch translations from a localization service
    // For now, we'll apply basic language-specific changes

    if (language !== 'en') {
      // Replace common English text with localized versions
      const translations = await this.getTranslations(language);

      Object.entries(translations).forEach(([key, value]) => {
        const regex = new RegExp(`\\b${key}\\b`, 'gi');
        html = html.replace(regex, value);
      });
    }

    return html;
  }

  /**
   * Apply region-specific content
   */
  async applyRegionSpecificContent(html, personalizationData) {
    const { country, countryConfig } = personalizationData;

    // Replace country-specific placeholders
    html = html.replace(/\{\{FILING_DEADLINE\}\}/g, countryConfig.filingDeadline);
    html = html.replace(/\{\{TAX_YEAR\}\}/g, countryConfig.taxYear);
    html = html.replace(/\{\{CURRENCY\}\}/g, personalizationData.currency);

    // Add country-specific notices or warnings
    const notices = this.getCountrySpecificNotices(country);
    if (notices.length > 0) {
      const noticeHtml = notices.map(notice =>
        `<div class="notice notice-${notice.type}">${notice.message}</div>`
      ).join('');

      html = html.replace(
        '<main',
        `${noticeHtml}<main`
      );
    }

    return html;
  }

  /**
   * Detect user's preferred language
   */
  detectLanguage(acceptLanguageHeader, country, urlLang) {
    // URL parameter takes highest priority
    if (urlLang && this.languageConfigs[urlLang]) {
      return urlLang;
    }

    // Parse Accept-Language header
    if (acceptLanguageHeader) {
      const languages = acceptLanguageHeader
        .split(',')
        .map(lang => lang.split(';')[0].trim().split('-')[0])
        .filter(lang => this.languageConfigs[lang]);

      if (languages.length > 0) {
        return languages[0];
      }
    }

    // Fallback to country default
    const countryLanguages = {
      'US': 'en', 'CA': 'en', 'GB': 'en', 'AU': 'en',
      'ES': 'es', 'MX': 'es', 'AR': 'es',
      'FR': 'fr', 'BE': 'fr',
      'DE': 'de', 'AT': 'de', 'CH': 'de',
      'BR': 'pt', 'PT': 'pt',
      'JP': 'ja',
      'IN': 'hi'
    };

    return countryLanguages[country] || 'en';
  }

  /**
   * Get currency for country
   */
  getCurrencyForCountry(country) {
    const countryConfig = this.countryConfigs[country];
    return countryConfig ? countryConfig.currency : 'USD';
  }

  /**
   * Get timezone for country
   */
  getTimezoneForCountry(country) {
    const countryConfig = this.countryConfigs[country];
    return countryConfig ? countryConfig.timezone : 'UTC';
  }

  /**
   * Get region for country
   */
  getRegionForCountry(country) {
    const regionMap = {
      'US': 'NA', 'CA': 'NA', 'MX': 'NA',
      'GB': 'EU', 'FR': 'EU', 'DE': 'EU', 'ES': 'EU', 'IT': 'EU',
      'JP': 'APAC', 'AU': 'APAC', 'SG': 'APAC', 'HK': 'APAC', 'IN': 'APAC',
      'BR': 'SA', 'AR': 'SA', 'CL': 'SA',
      'ZA': 'AF', 'NG': 'AF',
      'AE': 'ME', 'SA': 'ME'
    };

    return regionMap[country] || 'NA';
  }

  /**
   * Extract user preferences from cookies
   */
  async extractUserPreferences(request) {
    const cookieHeader = request.headers.get('Cookie');
    const preferences = {
      theme: 'light',
      notifications: true,
      autoSave: true,
      currencyDisplay: 'symbol'
    };

    if (cookieHeader) {
      const cookies = this.parseCookies(cookieHeader);

      if (cookies.theme) preferences.theme = cookies.theme;
      if (cookies.notifications) preferences.notifications = cookies.notifications === 'true';
      if (cookies.autoSave) preferences.autoSave = cookies.autoSave === 'true';
      if (cookies.currencyDisplay) preferences.currencyDisplay = cookies.currencyDisplay;
    }

    return preferences;
  }

  /**
   * Check if user is returning user
   */
  isReturningUser(request) {
    const cookieHeader = request.headers.get('Cookie');
    if (cookieHeader) {
      const cookies = this.parseCookies(cookieHeader);
      return cookies.hasOwnProperty('gt_returning_user');
    }
    return false;
  }

  /**
   * Get device type from user agent
   */
  getDeviceType(userAgent) {
    if (!userAgent) return 'desktop';

    if (/Mobi|Android/i.test(userAgent)) return 'mobile';
    if (/Tablet|iPad/i.test(userAgent)) return 'tablet';
    return 'desktop';
  }

  /**
   * Get session data
   */
  async getSessionData(request, context) {
    // In production, this would fetch from KV or Durable Objects
    return {
      sessionId: crypto.randomUUID(),
      startTime: Date.now(),
      pageViews: 1
    };
  }

  /**
   * Get currency symbol
   */
  getCurrencySymbol(currency) {
    const symbols = {
      'USD': '$', 'CAD': 'C$', 'GBP': '£', 'EUR': '€',
      'JPY': '¥', 'AUD': 'A$', 'INR': '₹', 'BRL': 'R$'
    };
    return symbols[currency] || currency;
  }

  /**
   * Get currency rate (mock implementation)
   */
  async getCurrencyRate(currency) {
    // In production, this would fetch from a currency API
    if (currency === 'USD') return 1;

    const rates = {
      'CAD': 1.35, 'GBP': 0.8, 'EUR': 0.92,
      'JPY': 150, 'AUD': 1.55, 'INR': 83, 'BRL': 5.1
    };

    return rates[currency] || 1;
  }

  /**
   * Get number format for locale
   */
  getNumberFormat(country, language) {
    return {
      decimal: country === 'DE' ? ',' : '.',
      thousands: country === 'DE' ? '.' : ',',
      currency: this.getCurrencySymbol(this.getCurrencyForCountry(country))
    };
  }

  /**
   * Get available filing statuses for country
   */
  getAvailableFilingStatuses(country) {
    const statuses = {
      'US': ['single', 'marriedFilingJointly', 'marriedFilingSeparately', 'headOfHousehold'],
      'CA': ['single', 'married', 'commonLaw'],
      'GB': ['single', 'married', 'civil'],
      'DE': ['single', 'married', 'divorced', 'widowed']
    };

    return statuses[country] || statuses['US'];
  }

  /**
   * Check if multi-currency should be enabled
   */
  shouldEnableMultiCurrency(country) {
    // Enable for border countries or major financial centers
    const multiCurrencyCountries = ['US', 'CA', 'CH', 'SG', 'HK'];
    return multiCurrencyCountries.includes(country);
  }

  /**
   * Get required fields for country
   */
  getRequiredFields(country) {
    const fields = {
      'US': ['ssn', 'income', 'filingStatus'],
      'CA': ['sin', 'income', 'province'],
      'GB': ['ni', 'income', 'taxCode'],
      'DE': ['steuerid', 'income', 'klasse']
    };

    return fields[country] || fields['US'];
  }

  /**
   * Get validation rules for country
   */
  getValidationRules(country) {
    return {
      'US': {
        ssn: /^\d{3}-?\d{2}-?\d{4}$/,
        income: { min: 0, max: 10000000 },
        zip: /^\d{5}(-\d{4})?$/
      },
      'CA': {
        sin: /^\d{3}-?\d{3}-?\d{3}$/,
        income: { min: 0, max: 10000000 },
        postal: /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/
      }
    }[country] || {};
  }

  /**
   * Get theme for region
   */
  getThemeForRegion(region) {
    const themes = {
      'NA': 'blue',
      'EU': 'green',
      'APAC': 'red',
      'SA': 'orange',
      'AF': 'purple',
      'ME': 'gold'
    };

    return themes[region] || 'blue';
  }

  /**
   * Get layout for device
   */
  getLayoutForDevice(deviceType) {
    return {
      'mobile': 'single-column',
      'tablet': 'two-column',
      'desktop': 'three-column'
    }[deviceType] || 'single-column';
  }

  /**
   * Check if animations should be enabled
   */
  shouldEnableAnimations(deviceType) {
    return deviceType !== 'mobile'; // Disable on mobile for performance
  }

  /**
   * Get translations for language
   */
  async getTranslations(language) {
    // Mock translations - in production, fetch from translation service
    const translations = {
      'es': {
        'Calculate': 'Calcular',
        'Income': 'Ingresos',
        'Tax': 'Impuesto',
        'Deductions': 'Deducciones'
      },
      'fr': {
        'Calculate': 'Calculer',
        'Income': 'Revenus',
        'Tax': 'Impôt',
        'Deductions': 'Déductions'
      },
      'de': {
        'Calculate': 'Berechnen',
        'Income': 'Einkommen',
        'Tax': 'Steuer',
        'Deductions': 'Abzüge'
      }
    };

    return translations[language] || {};
  }

  /**
   * Get country-specific notices
   */
  getCountrySpecificNotices(country) {
    const notices = {
      'US': [
        {
          type: 'info',
          message: 'Tax season deadline: April 15, 2024'
        }
      ],
      'CA': [
        {
          type: 'info',
          message: 'Filing deadline: April 30, 2024'
        }
      ],
      'GB': [
        {
          type: 'warning',
          message: 'Self Assessment deadline: January 31, 2025'
        }
      ]
    };

    return notices[country] || [];
  }

  /**
   * Fetch calculator page from origin
   */
  async fetchCalculatorPage(request, context) {
    // This would integrate with CDNManager to fetch the base page
    const url = new URL(request.url);
    const originUrl = `https://origin.globaltaxcalc.com${url.pathname}${url.search}`;

    return await fetch(originUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body
    });
  }

  /**
   * Add personalization headers to response
   */
  addPersonalizationHeaders(response, personalizationData) {
    response.headers.set('X-Personalized-Country', personalizationData.country);
    response.headers.set('X-Personalized-Language', personalizationData.language);
    response.headers.set('X-Personalized-Currency', personalizationData.currency);
    response.headers.set('X-Personalized-Region', personalizationData.region);
    response.headers.set('X-Personalized-Timezone', personalizationData.timezone);

    // Set cookies for preferences
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
    response.headers.append('Set-Cookie', `gt_country=${personalizationData.country}; Expires=${expires}; Path=/; SameSite=Strict`);
    response.headers.append('Set-Cookie', `gt_language=${personalizationData.language}; Expires=${expires}; Path=/; SameSite=Strict`);
    response.headers.append('Set-Cookie', `gt_currency=${personalizationData.currency}; Expires=${expires}; Path=/; SameSite=Strict`);

    if (personalizationData.isReturningUser) {
      response.headers.append('Set-Cookie', `gt_returning_user=true; Expires=${expires}; Path=/; SameSite=Strict`);
    }
  }

  /**
   * Parse cookies from header
   */
  parseCookies(cookieHeader) {
    const cookies = {};
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });
    return cookies;
  }

  /**
   * Create geo-redirected response
   */
  createGeoRedirect(targetCountry, originalUrl) {
    const redirectUrls = {
      'US': 'https://us.globaltaxcalc.com',
      'CA': 'https://ca.globaltaxcalc.com',
      'GB': 'https://uk.globaltaxcalc.com',
      'DE': 'https://de.globaltaxcalc.com'
    };

    const redirectUrl = redirectUrls[targetCountry];
    if (redirectUrl) {
      const url = new URL(originalUrl);
      const targetUrl = `${redirectUrl}${url.pathname}${url.search}`;

      return Response.redirect(targetUrl, 302);
    }

    return null;
  }

  /**
   * Handle language switching
   */
  async handleLanguageSwitch(request, targetLanguage) {
    const url = new URL(request.url);

    // Update URL with language parameter
    url.searchParams.set('lang', targetLanguage);

    // Redirect to same page with new language
    const response = Response.redirect(url.toString(), 302);

    // Set language cookie
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
    response.headers.set('Set-Cookie', `gt_language=${targetLanguage}; Expires=${expires}; Path=/; SameSite=Strict`);

    return response;
  }

  /**
   * Handle currency switching
   */
  async handleCurrencySwitch(request, targetCurrency) {
    const url = new URL(request.url);

    // Update URL with currency parameter
    url.searchParams.set('currency', targetCurrency);

    // Get current exchange rate
    const rate = await this.getCurrencyRate(targetCurrency);

    // Create response with currency data
    const response = new Response(JSON.stringify({
      currency: targetCurrency,
      symbol: this.getCurrencySymbol(targetCurrency),
      rate: rate
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

    // Set currency cookie
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
    response.headers.set('Set-Cookie', `gt_currency=${targetCurrency}; Expires=${expires}; Path=/; SameSite=Strict`);

    return response;
  }
}