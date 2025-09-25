const config = require('../config');
const { templateLogger } = require('../utils/logger');

/**
 * Report Customization Service
 */
class CustomizationService {
  constructor() {
    this.defaultOptions = {
      // Layout options
      format: 'A4',
      landscape: false,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      },

      // Content options
      includeCoverPage: true,
      includeTableOfContents: false,
      includeCharts: true,
      includeRecommendations: true,
      includeComparison: true,
      includeDisclaimer: true,

      // Visual options
      colorScheme: 'default',
      fontFamily: 'Inter',
      fontSize: 14,
      lineHeight: 1.6,

      // Branding options
      showLogo: true,
      showWatermark: false,
      watermarkText: config.branding.companyName,
      customBranding: null,

      // Privacy options
      maskSSN: true,
      maskBankAccount: true,
      hidePersonalInfo: false,

      // Accessibility options
      highContrast: false,
      largeText: false,
      alternativeText: true,

      // Export options
      embedImages: true,
      compressImages: true,
      pdfA: false,
      bookmarks: true
    };

    // Predefined color schemes
    this.colorSchemes = {
      default: {
        primary: '#2563eb',
        secondary: '#64748b',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        accent: '#8b5cf6',
        background: '#ffffff',
        text: '#374151'
      },
      dark: {
        primary: '#3b82f6',
        secondary: '#94a3b8',
        success: '#34d399',
        warning: '#fbbf24',
        error: '#f87171',
        accent: '#a78bfa',
        background: '#1f2937',
        text: '#f9fafb'
      },
      corporate: {
        primary: '#1e40af',
        secondary: '#6b7280',
        success: '#059669',
        warning: '#d97706',
        error: '#dc2626',
        accent: '#7c3aed',
        background: '#ffffff',
        text: '#111827'
      },
      professional: {
        primary: '#374151',
        secondary: '#9ca3af',
        success: '#065f46',
        warning: '#92400e',
        error: '#991b1b',
        accent: '#581c87',
        background: '#ffffff',
        text: '#1f2937'
      },
      accessible: {
        primary: '#1e3a8a',
        secondary: '#4b5563',
        success: '#047857',
        warning: '#b45309',
        error: '#b91c1c',
        accent: '#6b21a8',
        background: '#ffffff',
        text: '#000000'
      }
    };

    // Predefined templates
    this.templates = {
      standard: {
        name: 'Standard Tax Report',
        description: 'Complete tax summary with all sections',
        sections: ['overview', 'breakdown', 'brackets', 'deductions', 'recommendations', 'comparison']
      },
      executive: {
        name: 'Executive Summary',
        description: 'High-level overview for executives',
        sections: ['overview', 'summary', 'recommendations']
      },
      detailed: {
        name: 'Detailed Analysis',
        description: 'Comprehensive analysis with all details',
        sections: ['overview', 'breakdown', 'brackets', 'deductions', 'credits', 'recommendations', 'comparison', 'analysis']
      },
      minimal: {
        name: 'Minimal Report',
        description: 'Basic tax information only',
        sections: ['overview', 'breakdown']
      },
      comparison: {
        name: 'Comparison Report',
        description: 'Focus on year-over-year comparisons',
        sections: ['overview', 'comparison', 'analysis', 'recommendations']
      }
    };
  }

  /**
   * Apply customization options to report configuration
   * @param {object} userOptions - User-provided customization options
   * @param {object} context - Report context (user info, data, etc.)
   * @returns {object} Merged customization configuration
   */
  applyCustomizations(userOptions = {}, context = {}) {
    try {
      templateLogger.info('Applying report customizations', {
        userOptionsKeys: Object.keys(userOptions),
        contextKeys: Object.keys(context)
      });

      // Start with default options
      const customizations = { ...this.defaultOptions };

      // Apply user options
      Object.keys(userOptions).forEach(key => {
        if (userOptions[key] !== undefined && userOptions[key] !== null) {
          customizations[key] = userOptions[key];
        }
      });

      // Apply template if specified
      if (userOptions.template && this.templates[userOptions.template]) {
        const template = this.templates[userOptions.template];
        customizations.sections = template.sections;
        customizations.templateName = template.name;
        customizations.templateDescription = template.description;
      }

      // Apply color scheme
      if (customizations.colorScheme && this.colorSchemes[customizations.colorScheme]) {
        customizations.colors = this.colorSchemes[customizations.colorScheme];
      } else if (customizations.customColors) {
        customizations.colors = { ...this.colorSchemes.default, ...customizations.customColors };
      } else {
        customizations.colors = this.colorSchemes.default;
      }

      // Apply accessibility enhancements
      if (customizations.highContrast) {
        customizations.colors = this.enhanceContrastColors(customizations.colors);
      }

      if (customizations.largeText) {
        customizations.fontSize = Math.max(customizations.fontSize, 16);
        customizations.lineHeight = Math.max(customizations.lineHeight, 1.8);
      }

      // Apply privacy settings based on context
      if (context.userPreferences?.privacy) {
        customizations.maskSSN = context.userPreferences.privacy.maskSSN ?? customizations.maskSSN;
        customizations.maskBankAccount = context.userPreferences.privacy.maskBankAccount ?? customizations.maskBankAccount;
        customizations.hidePersonalInfo = context.userPreferences.privacy.hidePersonalInfo ?? customizations.hidePersonalInfo;
      }

      // Apply user tier-based restrictions
      if (context.userTier) {
        customizations = this.applyTierRestrictions(customizations, context.userTier);
      }

      // Validate customizations
      customizations = this.validateCustomizations(customizations);

      templateLogger.info('Customizations applied successfully', {
        template: customizations.templateName,
        colorScheme: customizations.colorScheme,
        sectionsCount: customizations.sections.length,
        accessibilityEnabled: customizations.highContrast || customizations.largeText
      });

      return customizations;

    } catch (error) {
      templateLogger.error('Error applying customizations', { error: error.message });
      return this.defaultOptions;
    }
  }

  /**
   * Get section configuration for template
   * @param {array} sections - Array of section names
   * @returns {object} Section configuration
   */
  getSectionConfiguration(sections = []) {
    const sectionConfig = {
      overview: {
        name: 'Tax Summary Overview',
        required: true,
        description: 'Key tax metrics and summary information',
        charts: ['income_breakdown']
      },
      breakdown: {
        name: 'Tax Calculation Details',
        required: false,
        description: 'Detailed breakdown of tax calculations',
        charts: []
      },
      brackets: {
        name: 'Tax Brackets Analysis',
        required: false,
        description: 'Visualization and analysis of tax brackets',
        charts: ['tax_brackets']
      },
      deductions: {
        name: 'Deductions and Credits',
        required: false,
        description: 'Breakdown of deductions and tax credits',
        charts: ['deduction_categories']
      },
      recommendations: {
        name: 'Tax Optimization Recommendations',
        required: false,
        description: 'Personalized recommendations for tax optimization',
        charts: []
      },
      comparison: {
        name: 'Year-over-Year Comparison',
        required: false,
        description: 'Comparison with previous tax years',
        charts: ['year_comparison']
      },
      summary: {
        name: 'Executive Summary',
        required: false,
        description: 'High-level summary and key findings',
        charts: []
      },
      analysis: {
        name: 'Detailed Analysis',
        required: false,
        description: 'In-depth analysis of tax situation',
        charts: []
      }
    };

    const enabledSections = {};
    sections.forEach(section => {
      if (sectionConfig[section]) {
        enabledSections[section] = sectionConfig[section];
      }
    });

    return enabledSections;
  }

  /**
   * Generate CSS customizations
   * @param {object} customizations - Customization options
   * @returns {string} CSS string
   */
  generateCustomCSS(customizations) {
    const {
      colors,
      fontFamily,
      fontSize,
      lineHeight,
      margin,
      highContrast,
      largeText
    } = customizations;

    let css = `
      :root {
        --primary-color: ${colors.primary};
        --secondary-color: ${colors.secondary};
        --success-color: ${colors.success};
        --warning-color: ${colors.warning};
        --error-color: ${colors.error};
        --accent-color: ${colors.accent};
        --background-color: ${colors.background};
        --text-color: ${colors.text};

        --font-primary: '${fontFamily}', -apple-system, BlinkMacSystemFont, sans-serif;
        --font-size-base: ${fontSize}px;
        --line-height-base: ${lineHeight};

        --page-margin-top: ${typeof margin === 'object' ? margin.top : margin};
        --page-margin-right: ${typeof margin === 'object' ? margin.right : margin};
        --page-margin-bottom: ${typeof margin === 'object' ? margin.bottom : margin};
        --page-margin-left: ${typeof margin === 'object' ? margin.left : margin};
      }

      body {
        font-family: var(--font-primary);
        font-size: var(--font-size-base);
        line-height: var(--line-height-base);
        color: var(--text-color);
        background-color: var(--background-color);
      }

      .report-container {
        margin: var(--page-margin-top) var(--page-margin-right) var(--page-margin-bottom) var(--page-margin-left);
      }

      .primary-color { color: var(--primary-color); }
      .secondary-color { color: var(--secondary-color); }
      .success-color { color: var(--success-color); }
      .warning-color { color: var(--warning-color); }
      .error-color { color: var(--error-color); }
      .accent-color { color: var(--accent-color); }

      .bg-primary { background-color: var(--primary-color); }
      .bg-secondary { background-color: var(--secondary-color); }
      .bg-success { background-color: var(--success-color); }
      .bg-warning { background-color: var(--warning-color); }
      .bg-error { background-color: var(--error-color); }
      .bg-accent { background-color: var(--accent-color); }
    `;

    // High contrast adjustments
    if (highContrast) {
      css += `
        .section {
          border: 2px solid var(--text-color);
        }

        .data-table th,
        .data-table td {
          border: 1px solid var(--text-color);
        }

        .metric-card {
          border: 2px solid var(--text-color);
        }
      `;
    }

    // Large text adjustments
    if (largeText) {
      css += `
        .page-title { font-size: 2rem; }
        .section-title { font-size: 1.5rem; }
        .metric-value { font-size: 1.8rem; }

        .data-table th,
        .data-table td {
          padding: 16px 20px;
          font-size: ${fontSize + 1}px;
        }
      `;
    }

    return css.trim();
  }

  /**
   * Apply tier-based restrictions
   * @param {object} customizations - Customization options
   * @param {string} userTier - User tier (free, basic, premium, enterprise)
   * @returns {object} Updated customizations
   */
  applyTierRestrictions(customizations, userTier) {
    switch (userTier) {
      case 'free':
        // Free tier has limited customizations and watermark
        customizations.showWatermark = true;
        customizations.watermarkText = `${config.branding.companyName} - Free Version`;
        customizations.includeCharts = false;
        customizations.includeRecommendations = false;
        customizations.sections = customizations.sections.filter(s =>
          ['overview', 'breakdown'].includes(s)
        );
        customizations.customBranding = null;
        break;

      case 'basic':
        // Basic tier has some restrictions
        customizations.showWatermark = false;
        customizations.includeCharts = true;
        customizations.includeRecommendations = true;
        customizations.customBranding = null;
        break;

      case 'premium':
        // Premium tier has most features
        customizations.showWatermark = false;
        customizations.includeCharts = true;
        customizations.includeRecommendations = true;
        // Custom branding allowed but limited
        break;

      case 'enterprise':
        // Enterprise tier has all features
        // No restrictions
        break;

      default:
        // Default to free tier restrictions
        return this.applyTierRestrictions(customizations, 'free');
    }

    return customizations;
  }

  /**
   * Enhance colors for high contrast
   * @param {object} colors - Original colors
   * @returns {object} Enhanced colors
   */
  enhanceContrastColors(colors) {
    return {
      ...colors,
      primary: this.increaseMostContrast(colors.primary, colors.background),
      secondary: this.increaseMostContrast(colors.secondary, colors.background),
      success: this.increaseMostContrast(colors.success, colors.background),
      warning: this.increaseMostContrast(colors.warning, colors.background),
      error: this.increaseMostContrast(colors.error, colors.background),
      text: colors.background === '#ffffff' ? '#000000' : '#ffffff'
    };
  }

  /**
   * Increase contrast between two colors
   * @param {string} color - Foreground color
   * @param {string} background - Background color
   * @returns {string} Enhanced color
   */
  increaseMostContrast(color, background) {
    // Simple implementation - in practice, you'd use a proper color contrast library
    if (background === '#ffffff' || background === 'white') {
      // Dark background, make color darker
      return this.darkenColor(color, 0.3);
    } else {
      // Light background, make color lighter
      return this.lightenColor(color, 0.3);
    }
  }

  /**
   * Darken a hex color
   * @param {string} color - Hex color
   * @param {number} amount - Amount to darken (0-1)
   * @returns {string} Darkened color
   */
  darkenColor(color, amount) {
    // Simple darkening - remove # and convert to RGB, then darken
    const hex = color.replace('#', '');
    const r = Math.max(0, parseInt(hex.slice(0, 2), 16) * (1 - amount));
    const g = Math.max(0, parseInt(hex.slice(2, 4), 16) * (1 - amount));
    const b = Math.max(0, parseInt(hex.slice(4, 6), 16) * (1 - amount));

    return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
  }

  /**
   * Lighten a hex color
   * @param {string} color - Hex color
   * @param {number} amount - Amount to lighten (0-1)
   * @returns {string} Lightened color
   */
  lightenColor(color, amount) {
    const hex = color.replace('#', '');
    const r = Math.min(255, parseInt(hex.slice(0, 2), 16) + (255 * amount));
    const g = Math.min(255, parseInt(hex.slice(2, 4), 16) + (255 * amount));
    const b = Math.min(255, parseInt(hex.slice(4, 6), 16) + (255 * amount));

    return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
  }

  /**
   * Validate customization options
   * @param {object} customizations - Customization options
   * @returns {object} Validated customizations
   */
  validateCustomizations(customizations) {
    const validated = { ...customizations };

    // Validate format
    if (!['A4', 'Letter', 'A3', 'Legal'].includes(validated.format)) {
      validated.format = 'A4';
    }

    // Validate font size
    if (validated.fontSize < 8 || validated.fontSize > 24) {
      validated.fontSize = 14;
    }

    // Validate line height
    if (validated.lineHeight < 1.0 || validated.lineHeight > 3.0) {
      validated.lineHeight = 1.6;
    }

    // Validate sections
    if (!Array.isArray(validated.sections)) {
      validated.sections = ['overview', 'breakdown'];
    }

    // Ensure at least one section is included
    if (validated.sections.length === 0) {
      validated.sections = ['overview'];
    }

    // Validate color scheme
    if (validated.colorScheme && !this.colorSchemes[validated.colorScheme]) {
      validated.colorScheme = 'default';
      validated.colors = this.colorSchemes.default;
    }

    return validated;
  }

  /**
   * Get available customization options
   * @param {string} userTier - User tier
   * @returns {object} Available customization options
   */
  getAvailableOptions(userTier = 'free') {
    const baseOptions = {
      formats: ['A4', 'Letter'],
      colorSchemes: Object.keys(this.colorSchemes),
      templates: Object.keys(this.templates),
      sections: Object.keys(this.getSectionConfiguration()),
      fontSizes: [10, 12, 14, 16, 18, 20],
      accessibility: ['highContrast', 'largeText', 'alternativeText']
    };

    switch (userTier) {
      case 'premium':
      case 'enterprise':
        return {
          ...baseOptions,
          formats: ['A4', 'Letter', 'A3', 'Legal'],
          customBranding: true,
          customColors: true,
          advancedOptions: true
        };

      case 'basic':
        return {
          ...baseOptions,
          customColors: true
        };

      case 'free':
      default:
        return {
          ...baseOptions,
          formats: ['A4', 'Letter'],
          colorSchemes: ['default'],
          templates: ['standard', 'minimal']
        };
    }
  }

  /**
   * Get template information
   * @param {string} templateName - Template name
   * @returns {object} Template information
   */
  getTemplate(templateName) {
    return this.templates[templateName] || null;
  }

  /**
   * Get all available templates
   * @returns {object} All templates
   */
  getAllTemplates() {
    return this.templates;
  }

  /**
   * Get color scheme information
   * @param {string} schemeName - Color scheme name
   * @returns {object} Color scheme information
   */
  getColorScheme(schemeName) {
    return this.colorSchemes[schemeName] || null;
  }

  /**
   * Get all available color schemes
   * @returns {object} All color schemes
   */
  getAllColorSchemes() {
    return this.colorSchemes;
  }

  /**
   * Create custom template
   * @param {string} name - Template name
   * @param {object} config - Template configuration
   * @returns {boolean} Success status
   */
  createCustomTemplate(name, config) {
    try {
      this.templates[name] = {
        name: config.displayName || name,
        description: config.description || 'Custom template',
        sections: config.sections || ['overview'],
        custom: true
      };

      templateLogger.info('Custom template created', { name, sections: config.sections });
      return true;
    } catch (error) {
      templateLogger.error('Error creating custom template', { name, error: error.message });
      return false;
    }
  }

  /**
   * Get default customization options
   * @returns {object} Default options
   */
  getDefaultOptions() {
    return { ...this.defaultOptions };
  }

  /**
   * Get service statistics
   * @returns {object} Service statistics
   */
  getStatistics() {
    return {
      availableColorSchemes: Object.keys(this.colorSchemes).length,
      availableTemplates: Object.keys(this.templates).length,
      defaultSections: Object.keys(this.getSectionConfiguration()).length,
      customTemplates: Object.values(this.templates).filter(t => t.custom).length
    };
  }
}

module.exports = CustomizationService;