const fs = require('fs').promises;
const path = require('path');
const Handlebars = require('handlebars');
const mjml = require('mjml');
const juice = require('juice');
const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const config = require('../config');
const logger = require('../utils/logger');

class TemplateService {
  constructor() {
    this.templates = new Map();
    this.compiled = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Initialize i18next for translations
      await i18next
        .use(Backend)
        .init({
          lng: config.i18n.defaultLanguage,
          fallbackLng: config.i18n.fallbackLng,
          supportedLngs: config.i18n.supportedLanguages,
          backend: {
            loadPath: path.join(__dirname, '..', config.i18n.directory, '{{lng}}/{{ns}}.json')
          },
          interpolation: {
            escapeValue: false
          }
        });

      // Register Handlebars helpers
      this.registerHelpers();

      // Load templates
      await this.loadTemplates();

      // Compile templates if configured
      if (config.templates.compileOnStartup) {
        await this.compileAllTemplates();
      }

      this.initialized = true;
      logger.info('TemplateService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize TemplateService:', error);
      throw error;
    }
  }

  // Register Handlebars helpers
  registerHelpers() {
    // Date formatting helper
    Handlebars.registerHelper('formatDate', (date, format, locale = 'en') => {
      const moment = require('moment');
      if (locale !== 'en') {
        moment.locale(locale);
      }
      return moment(date).format(format);
    });

    // Currency formatting helper
    Handlebars.registerHelper('formatCurrency', (amount, currency = 'USD', locale = 'en') => {
      try {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: currency
        }).format(amount);
      } catch (error) {
        return `${currency} ${amount}`;
      }
    });

    // Translation helper
    Handlebars.registerHelper('t', (key, options) => {
      const lng = options.hash.lng || config.i18n.defaultLanguage;
      const params = { ...options.hash };
      delete params.lng;

      return i18next.t(key, { lng, ...params });
    });

    // Conditional helper
    Handlebars.registerHelper('if_eq', function(a, b, opts) {
      if (a === b) {
        return opts.fn(this);
      } else {
        return opts.inverse(this);
      }
    });

    // Loop helper with index
    Handlebars.registerHelper('each_with_index', function(array, opts) {
      let result = '';
      for (let i = 0; i < array.length; i++) {
        result += opts.fn({ ...array[i], index: i, first: i === 0, last: i === array.length - 1 });
      }
      return result;
    });

    // URL helper
    Handlebars.registerHelper('url', (path, params = {}) => {
      const baseUrl = process.env.BASE_URL || 'https://globaltaxcalc.com';
      const url = new URL(path, baseUrl);

      Object.keys(params).forEach(key => {
        url.searchParams.set(key, params[key]);
      });

      return url.toString();
    });

    // Asset helper
    Handlebars.registerHelper('asset', (assetPath) => {
      const baseUrl = process.env.ASSETS_URL || 'https://assets.globaltaxcalc.com';
      return `${baseUrl}/${assetPath}`;
    });

    // Math helpers
    Handlebars.registerHelper('add', (a, b) => a + b);
    Handlebars.registerHelper('subtract', (a, b) => a - b);
    Handlebars.registerHelper('multiply', (a, b) => a * b);
    Handlebars.registerHelper('divide', (a, b) => b !== 0 ? a / b : 0);

    // String helpers
    Handlebars.registerHelper('capitalize', (str) => {
      return str.charAt(0).toUpperCase() + str.slice(1);
    });

    Handlebars.registerHelper('truncate', (str, length = 100) => {
      if (str.length <= length) return str;
      return str.substring(0, length) + '...';
    });
  }

  // Load all templates from the templates directory
  async loadTemplates() {
    try {
      const templatesDir = path.join(__dirname, '..', config.templates.directory);
      const templateFiles = await this.findTemplateFiles(templatesDir);

      for (const filePath of templateFiles) {
        const templateName = this.getTemplateName(filePath, templatesDir);
        const content = await fs.readFile(filePath, 'utf8');

        this.templates.set(templateName, {
          content,
          filePath,
          lastModified: (await fs.stat(filePath)).mtime
        });
      }

      logger.info(`Loaded ${this.templates.size} templates`);
    } catch (error) {
      logger.error('Failed to load templates:', error);
      throw error;
    }
  }

  // Find all template files recursively
  async findTemplateFiles(dir, fileList = []) {
    const files = await fs.readdir(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = await fs.stat(filePath);

      if (stat.isDirectory()) {
        await this.findTemplateFiles(filePath, fileList);
      } else if (file.endsWith('.mjml') || file.endsWith('.hbs') || file.endsWith('.handlebars')) {
        fileList.push(filePath);
      }
    }

    return fileList;
  }

  // Get template name from file path
  getTemplateName(filePath, templatesDir) {
    const relativePath = path.relative(templatesDir, filePath);
    return relativePath.replace(/\.(mjml|hbs|handlebars)$/, '').replace(/\\/g, '/');
  }

  // Render template with data
  async renderTemplate(templateName, data = {}, options = {}) {
    await this.initialize();

    try {
      const {
        language = config.i18n.defaultLanguage,
        format = 'html',
        minify = config.templates.mjml.minify
      } = options;

      // Get template
      const template = await this.getTemplate(templateName);
      if (!template) {
        throw new Error(`Template not found: ${templateName}`);
      }

      // Prepare template data
      const templateData = {
        ...data,
        _meta: {
          language,
          timestamp: new Date().toISOString(),
          baseUrl: process.env.BASE_URL || 'https://globaltaxcalc.com',
          assetsUrl: process.env.ASSETS_URL || 'https://assets.globaltaxcalc.com'
        }
      };

      // Get or compile template
      const compiled = await this.getCompiledTemplate(templateName, language);

      // Render template
      let rendered = compiled(templateData);

      // Process MJML if the template uses MJML
      if (template.content.includes('<mjml>')) {
        const mjmlResult = mjml(rendered, {
          keepComments: config.templates.mjml.keepComments,
          beautify: config.templates.mjml.beautify,
          minify
        });

        if (mjmlResult.errors.length > 0) {
          logger.warn('MJML compilation warnings:', mjmlResult.errors);
        }

        rendered = mjmlResult.html;
      }

      // Inline CSS for better email client compatibility
      rendered = juice(rendered);

      // Generate text version
      const textVersion = this.generateTextVersion(rendered);

      return {
        html: rendered,
        text: textVersion,
        subject: this.extractSubject(rendered, templateData),
        language,
        templateName
      };
    } catch (error) {
      logger.error(`Failed to render template ${templateName}:`, error);
      throw error;
    }
  }

  // Get template by name
  async getTemplate(templateName) {
    let template = this.templates.get(templateName);

    if (!template) {
      // Try to load template dynamically
      await this.loadTemplate(templateName);
      template = this.templates.get(templateName);
    }

    // Check if template file has been modified
    if (template && !config.templates.cacheEnabled) {
      try {
        const currentMtime = (await fs.stat(template.filePath)).mtime;
        if (currentMtime > template.lastModified) {
          await this.loadTemplate(templateName);
          template = this.templates.get(templateName);
        }
      } catch (error) {
        // File might have been deleted
        logger.warn(`Template file not found: ${template.filePath}`);
      }
    }

    return template;
  }

  // Load a specific template
  async loadTemplate(templateName) {
    try {
      const templatesDir = path.join(__dirname, '..', config.templates.directory);
      const possibleExtensions = ['.mjml', '.hbs', '.handlebars'];

      for (const ext of possibleExtensions) {
        const filePath = path.join(templatesDir, `${templateName}${ext}`);

        try {
          const content = await fs.readFile(filePath, 'utf8');
          const stats = await fs.stat(filePath);

          this.templates.set(templateName, {
            content,
            filePath,
            lastModified: stats.mtime
          });

          return;
        } catch (error) {
          // Try next extension
        }
      }

      throw new Error(`Template file not found: ${templateName}`);
    } catch (error) {
      logger.error(`Failed to load template ${templateName}:`, error);
      throw error;
    }
  }

  // Get or compile template
  async getCompiledTemplate(templateName, language = 'en') {
    const cacheKey = `${templateName}:${language}`;

    if (this.compiled.has(cacheKey) && config.templates.cacheEnabled) {
      return this.compiled.get(cacheKey);
    }

    const template = await this.getTemplate(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    // Set language for i18next
    await i18next.changeLanguage(language);

    // Compile template
    const compiled = Handlebars.compile(template.content);

    if (config.templates.cacheEnabled) {
      this.compiled.set(cacheKey, compiled);
    }

    return compiled;
  }

  // Compile all templates
  async compileAllTemplates() {
    const languages = config.i18n.supportedLanguages;

    for (const [templateName] of this.templates) {
      for (const language of languages) {
        try {
          await this.getCompiledTemplate(templateName, language);
        } catch (error) {
          logger.warn(`Failed to compile template ${templateName} for language ${language}:`, error);
        }
      }
    }

    logger.info(`Compiled templates for ${languages.length} languages`);
  }

  // Extract subject from rendered HTML
  extractSubject(html, data) {
    // Look for subject in meta tag
    const subjectMatch = html.match(/<meta name="subject" content="([^"]*)">/i);
    if (subjectMatch) {
      return subjectMatch[1];
    }

    // Look for title tag
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    if (titleMatch) {
      return titleMatch[1];
    }

    // Fallback to data subject
    return data.subject || 'GlobalTaxCalc Notification';
  }

  // Generate text version from HTML
  generateTextVersion(html) {
    try {
      // Simple HTML to text conversion
      let text = html
        .replace(/<style[^>]*>.*?<\/style>/gis, '')
        .replace(/<script[^>]*>.*?<\/script>/gis, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();

      return text;
    } catch (error) {
      logger.error('Failed to generate text version:', error);
      return 'Please view this email in HTML format.';
    }
  }

  // Get available templates
  getAvailableTemplates() {
    return Array.from(this.templates.keys());
  }

  // Validate template
  async validateTemplate(templateName, sampleData = {}) {
    try {
      const result = await this.renderTemplate(templateName, sampleData);

      return {
        valid: true,
        templateName,
        hasSubject: !!result.subject,
        hasHtml: !!result.html,
        hasText: !!result.text,
        htmlLength: result.html.length,
        textLength: result.text.length
      };
    } catch (error) {
      return {
        valid: false,
        templateName,
        error: error.message
      };
    }
  }

  // Create template from MJML
  async createTemplate(templateName, mjmlContent, metadata = {}) {
    try {
      const templatesDir = path.join(__dirname, '..', config.templates.directory);
      const filePath = path.join(templatesDir, `${templateName}.mjml`);

      // Ensure directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Add metadata as comments
      const mjmlWithMeta = `<!--
Template: ${templateName}
Created: ${new Date().toISOString()}
${Object.entries(metadata).map(([key, value]) => `${key}: ${value}`).join('\n')}
-->
${mjmlContent}`;

      // Write template file
      await fs.writeFile(filePath, mjmlWithMeta, 'utf8');

      // Load template into memory
      await this.loadTemplate(templateName);

      logger.info(`Template created: ${templateName}`);

      return {
        templateName,
        filePath,
        created: true
      };
    } catch (error) {
      logger.error(`Failed to create template ${templateName}:`, error);
      throw error;
    }
  }

  // Update template
  async updateTemplate(templateName, content) {
    try {
      const template = await this.getTemplate(templateName);
      if (!template) {
        throw new Error(`Template not found: ${templateName}`);
      }

      // Write updated content
      await fs.writeFile(template.filePath, content, 'utf8');

      // Reload template
      await this.loadTemplate(templateName);

      // Clear compiled cache
      const languages = config.i18n.supportedLanguages;
      languages.forEach(lang => {
        this.compiled.delete(`${templateName}:${lang}`);
      });

      logger.info(`Template updated: ${templateName}`);

      return {
        templateName,
        updated: true
      };
    } catch (error) {
      logger.error(`Failed to update template ${templateName}:`, error);
      throw error;
    }
  }

  // Preview template
  async previewTemplate(templateName, sampleData = {}, language = 'en') {
    try {
      const defaultSampleData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        companyName: 'GlobalTaxCalc',
        currentYear: new Date().getFullYear(),
        taxDeadline: '2024-04-15',
        calculationResult: {
          taxOwed: 5250.00,
          refund: 0,
          effectiveRate: 12.5
        }
      };

      const mergedData = { ...defaultSampleData, ...sampleData };
      const result = await this.renderTemplate(templateName, mergedData, { language });

      return {
        ...result,
        sampleData: mergedData,
        preview: true
      };
    } catch (error) {
      logger.error(`Failed to preview template ${templateName}:`, error);
      throw error;
    }
  }

  // Clear template cache
  clearCache(templateName = null) {
    if (templateName) {
      const languages = config.i18n.supportedLanguages;
      languages.forEach(lang => {
        this.compiled.delete(`${templateName}:${lang}`);
      });
    } else {
      this.compiled.clear();
    }
  }

  // Health check
  async healthCheck() {
    try {
      await this.initialize();
      return {
        status: 'healthy',
        service: 'template',
        templatesLoaded: this.templates.size,
        compiledTemplates: this.compiled.size,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'template',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new TemplateService();