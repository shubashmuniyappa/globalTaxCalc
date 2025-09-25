const Handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');
const { templateLogger } = require('../utils/logger');
const Formatters = require('../utils/formatters');

/**
 * Template Engine Service using Handlebars
 */
class TemplateEngine {
  constructor() {
    this.handlebars = Handlebars.create();
    this.templatesCache = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize template engine
   */
  async initialize() {
    try {
      templateLogger.info('Initializing Template Engine...');

      // Register helpers
      await this.registerHelpers();

      // Register partials
      await this.registerPartials();

      // Preload templates if caching is enabled
      if (config.templates.cache) {
        await this.preloadTemplates();
      }

      this.isInitialized = true;
      templateLogger.info('Template Engine initialized successfully');

    } catch (error) {
      templateLogger.error('Failed to initialize Template Engine', { error: error.message });
      throw error;
    }
  }

  /**
   * Register Handlebars helpers
   */
  async registerHelpers() {
    // Format currency helper
    this.handlebars.registerHelper('formatCurrency', function(amount, options) {
      const { locale = 'en', currency = 'USD', showSymbol = true, showCents = true } = options.hash;
      const formatter = new Formatters(locale, currency);
      return formatter.formatCurrency(amount, { showSymbol, showCents });
    });

    // Format percentage helper
    this.handlebars.registerHelper('formatPercent', function(value, options) {
      const { decimals = 2, locale = 'en' } = options.hash;
      const formatter = new Formatters(locale);
      return formatter.formatPercentage(value, { decimals });
    });

    // Format number helper
    this.handlebars.registerHelper('formatNumber', function(value, options) {
      const { decimals = 0, showThousands = true, locale = 'en' } = options.hash;
      const formatter = new Formatters(locale);
      return formatter.formatNumber(value, { decimals, showThousands });
    });

    // Format date helper
    this.handlebars.registerHelper('formatDate', function(date, options) {
      const { format = 'medium', locale = 'en', timezone = 'America/New_York' } = options.hash;
      const formatter = new Formatters(locale, 'USD', timezone);
      return formatter.formatDate(date, format);
    });

    // Math helpers
    this.handlebars.registerHelper('add', function(a, b) {
      return (parseFloat(a) || 0) + (parseFloat(b) || 0);
    });

    this.handlebars.registerHelper('subtract', function(a, b) {
      return (parseFloat(a) || 0) - (parseFloat(b) || 0);
    });

    this.handlebars.registerHelper('multiply', function(a, b) {
      return (parseFloat(a) || 0) * (parseFloat(b) || 0);
    });

    this.handlebars.registerHelper('divide', function(a, b) {
      const divisor = parseFloat(b);
      return divisor !== 0 ? (parseFloat(a) || 0) / divisor : 0;
    });

    // Comparison helpers
    this.handlebars.registerHelper('gt', function(a, b) {
      return parseFloat(a) > parseFloat(b);
    });

    this.handlebars.registerHelper('lt', function(a, b) {
      return parseFloat(a) < parseFloat(b);
    });

    this.handlebars.registerHelper('eq', function(a, b) {
      return a === b;
    });

    this.handlebars.registerHelper('ne', function(a, b) {
      return a !== b;
    });

    // Array helpers
    this.handlebars.registerHelper('each_with_index', function(array, options) {
      let result = '';
      for (let i = 0; i < array.length; i++) {
        result += options.fn({
          ...array[i],
          index: i,
          first: i === 0,
          last: i === array.length - 1
        });
      }
      return result;
    });

    // String helpers
    this.handlebars.registerHelper('uppercase', function(str) {
      return str ? str.toString().toUpperCase() : '';
    });

    this.handlebars.registerHelper('lowercase', function(str) {
      return str ? str.toString().toLowerCase() : '';
    });

    this.handlebars.registerHelper('capitalize', function(str) {
      return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';
    });

    // Conditional helpers
    this.handlebars.registerHelper('if_positive', function(value, options) {
      return parseFloat(value) > 0 ? options.fn(this) : options.inverse(this);
    });

    this.handlebars.registerHelper('if_negative', function(value, options) {
      return parseFloat(value) < 0 ? options.fn(this) : options.inverse(this);
    });

    this.handlebars.registerHelper('if_zero', function(value, options) {
      return parseFloat(value) === 0 ? options.fn(this) : options.inverse(this);
    });

    // Default value helper
    this.handlebars.registerHelper('default', function(value, defaultValue) {
      return value || defaultValue;
    });

    // JSON helper
    this.handlebars.registerHelper('json', function(context) {
      return JSON.stringify(context, null, 2);
    });

    // Date range helper
    this.handlebars.registerHelper('dateRange', function(startDate, endDate, options) {
      const { format = 'medium', locale = 'en', separator = ' - ' } = options.hash;
      const formatter = new Formatters(locale);
      return formatter.formatDateRange(startDate, endDate, format, { separator });
    });

    // Tax year helper
    this.handlebars.registerHelper('taxYear', function(year, options) {
      const { locale = 'en', showLabel = true } = options.hash;
      const formatter = new Formatters(locale);
      return formatter.formatTaxYear(year, { showLabel });
    });

    // Pluralize helper
    this.handlebars.registerHelper('pluralize', function(count, singular, plural) {
      return count === 1 ? singular : (plural || singular + 's');
    });

    // Chart data helper
    this.handlebars.registerHelper('chartData', function(data) {
      return new Handlebars.SafeString(JSON.stringify(data));
    });

    // Color helper for charts
    this.handlebars.registerHelper('getColor', function(index) {
      return config.charts.colors[index % config.charts.colors.length];
    });

    // Load custom helpers from helpers directory
    await this.loadCustomHelpers();
  }

  /**
   * Load custom helpers from helpers directory
   */
  async loadCustomHelpers() {
    try {
      const helpersDir = config.templates.helpersDir;
      const helperFiles = await fs.readdir(helpersDir);

      for (const file of helperFiles) {
        if (file.endsWith('.js')) {
          const helperPath = path.join(helpersDir, file);
          const helperModule = require(helperPath);

          if (typeof helperModule === 'object') {
            Object.entries(helperModule).forEach(([name, helper]) => {
              this.handlebars.registerHelper(name, helper);
            });
          }
        }
      }

      templateLogger.info('Custom helpers loaded', { count: helperFiles.length });
    } catch (error) {
      // Helpers directory might not exist yet
      templateLogger.info('No custom helpers directory found');
    }
  }

  /**
   * Register partials
   */
  async registerPartials() {
    try {
      const partialsDir = config.templates.partialsDir;
      const partialFiles = await fs.readdir(partialsDir);

      for (const file of partialFiles) {
        if (file.endsWith('.hbs')) {
          const partialName = path.basename(file, '.hbs');
          const partialPath = path.join(partialsDir, file);
          const partialContent = await fs.readFile(partialPath, 'utf-8');

          this.handlebars.registerPartial(partialName, partialContent);
        }
      }

      templateLogger.info('Partials registered', { count: partialFiles.length });
    } catch (error) {
      // Partials directory might not exist yet
      templateLogger.info('No partials directory found');
    }
  }

  /**
   * Preload templates into cache
   */
  async preloadTemplates() {
    try {
      const templatesDir = config.templates.dir;
      const templateFiles = await fs.readdir(templatesDir);

      for (const file of templateFiles) {
        if (file.endsWith('.hbs')) {
          const templateName = path.basename(file, '.hbs');
          await this.getTemplate(templateName);
        }
      }

      templateLogger.info('Templates preloaded', { count: this.templatesCache.size });
    } catch (error) {
      templateLogger.error('Error preloading templates', { error: error.message });
    }
  }

  /**
   * Get compiled template
   * @param {string} templateName - Template name (without extension)
   * @returns {function} Compiled template function
   */
  async getTemplate(templateName) {
    // Check cache first
    if (this.templatesCache.has(templateName)) {
      return this.templatesCache.get(templateName);
    }

    try {
      const templatePath = path.join(config.templates.dir, `${templateName}${config.templates.extension}`);
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      const compiledTemplate = this.handlebars.compile(templateContent);

      // Cache if enabled
      if (config.templates.cache) {
        this.templatesCache.set(templateName, compiledTemplate);
      }

      return compiledTemplate;

    } catch (error) {
      templateLogger.error('Error loading template', {
        templateName,
        error: error.message
      });
      throw new Error(`Template '${templateName}' not found or invalid`);
    }
  }

  /**
   * Render template with data
   * @param {string} templateName - Template name
   * @param {object} data - Template data
   * @param {object} options - Render options
   * @returns {string} Rendered HTML
   */
  async render(templateName, data = {}, options = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const template = await this.getTemplate(templateName);

      // Add global data
      const globalData = {
        ...data,
        config: {
          branding: config.branding,
          charts: config.charts
        },
        timestamp: new Date().toISOString(),
        generatedBy: 'GlobalTaxCalc Report Service',
        ...options.globals
      };

      const rendered = template(globalData);

      templateLogger.info('Template rendered', {
        templateName,
        dataSize: JSON.stringify(data).length
      });

      return rendered;

    } catch (error) {
      templateLogger.error('Error rendering template', {
        templateName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Render string template
   * @param {string} templateString - Template string
   * @param {object} data - Template data
   * @returns {string} Rendered string
   */
  renderString(templateString, data = {}) {
    try {
      const template = this.handlebars.compile(templateString);
      return template(data);
    } catch (error) {
      templateLogger.error('Error rendering template string', { error: error.message });
      throw error;
    }
  }

  /**
   * Check if template exists
   * @param {string} templateName - Template name
   * @returns {boolean} Whether template exists
   */
  async templateExists(templateName) {
    try {
      const templatePath = path.join(config.templates.dir, `${templateName}${config.templates.extension}`);
      await fs.access(templatePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List available templates
   * @returns {array} Array of template names
   */
  async listTemplates() {
    try {
      const templatesDir = config.templates.dir;
      const files = await fs.readdir(templatesDir);

      return files
        .filter(file => file.endsWith('.hbs'))
        .map(file => path.basename(file, '.hbs'));
    } catch (error) {
      templateLogger.error('Error listing templates', { error: error.message });
      return [];
    }
  }

  /**
   * Clear template cache
   */
  clearCache() {
    this.templatesCache.clear();
    templateLogger.info('Template cache cleared');
  }

  /**
   * Get template cache statistics
   * @returns {object} Cache statistics
   */
  getCacheStats() {
    return {
      size: this.templatesCache.size,
      keys: Array.from(this.templatesCache.keys())
    };
  }

  /**
   * Create template from data
   * @param {string} templateName - Template name
   * @param {string} content - Template content
   */
  async createTemplate(templateName, content) {
    try {
      const templatePath = path.join(config.templates.dir, `${templateName}${config.templates.extension}`);
      await fs.writeFile(templatePath, content, 'utf-8');

      // Clear from cache if it exists
      this.templatesCache.delete(templateName);

      templateLogger.info('Template created', { templateName });
    } catch (error) {
      templateLogger.error('Error creating template', {
        templateName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get template source
   * @param {string} templateName - Template name
   * @returns {string} Template source code
   */
  async getTemplateSource(templateName) {
    try {
      const templatePath = path.join(config.templates.dir, `${templateName}${config.templates.extension}`);
      return await fs.readFile(templatePath, 'utf-8');
    } catch (error) {
      templateLogger.error('Error getting template source', {
        templateName,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = TemplateEngine;