const PDFGenerator = require('./pdfGenerator');
const ChartGenerator = require('./chartGenerator');
const TemplateEngine = require('./templateEngine');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;
const config = require('../config');
const { reportLogger, logReportStart, logReportComplete, logReportError } = require('../utils/logger');
const Formatters = require('../utils/formatters');

/**
 * Main Report Generation Service
 */
class ReportGenerator {
  constructor() {
    this.pdfGenerator = new PDFGenerator();
    this.chartGenerator = new ChartGenerator();
    this.templateEngine = new TemplateEngine();
    this.activeReports = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize the report generator
   */
  async initialize() {
    try {
      reportLogger.info('Initializing Report Generator...');

      // Initialize all sub-services
      await Promise.all([
        this.pdfGenerator.initialize(),
        this.templateEngine.initialize()
      ]);

      // Initialize directories
      config.initDirectories();

      this.isInitialized = true;
      reportLogger.info('Report Generator initialized successfully');

    } catch (error) {
      reportLogger.error('Failed to initialize Report Generator', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate comprehensive tax summary report
   * @param {object} taxData - Tax calculation data
   * @param {object} options - Report generation options
   * @returns {object} Report generation result
   */
  async generateTaxSummaryReport(taxData, options = {}) {
    const reportId = uuidv4();
    const startTime = Date.now();

    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const {
        locale = config.i18n.defaultLanguage,
        currency = config.i18n.defaultCurrency,
        timezone = config.i18n.defaultTimezone,
        userId = null,
        includeCharts = true,
        includeBranding = true,
        showWatermark = !options.isPremium,
        watermarkText = config.branding.companyName,
        customBranding = null,
        reportTitle = 'Comprehensive Tax Summary Report',
        sections = ['overview', 'breakdown', 'brackets', 'deductions', 'recommendations', 'comparison']
      } = options;

      logReportStart(reportId, 'tax-summary', userId);

      // Track active report
      this.activeReports.set(reportId, {
        type: 'tax-summary',
        startTime,
        userId,
        status: 'processing'
      });

      // Prepare template data
      const templateData = await this.prepareTaxSummaryData(taxData, {
        locale,
        currency,
        timezone,
        includeCharts,
        sections,
        reportId
      });

      // Generate charts if needed
      if (includeCharts) {
        await this.generateReportCharts(templateData, options);
      }

      // Apply branding
      if (includeBranding) {
        await this.applyBranding(templateData, customBranding);
      }

      // Add report metadata
      templateData.reportId = reportId;
      templateData.reportTitle = reportTitle;
      templateData.showWatermark = showWatermark;
      templateData.watermarkText = watermarkText;
      templateData.locale = locale;
      templateData.currency = currency;
      templateData.timestamp = new Date();
      templateData.version = '1.0.0';

      // Render HTML template
      const html = await this.templateEngine.render('tax-summary-report', templateData);

      // Generate PDF
      const pdfOptions = {
        format: options.format || 'A4',
        landscape: options.landscape || false,
        margin: options.margin || config.pdf.options.margin,
        waitForSelector: '.report-container',
        waitForTimeout: 3000,
        userId,
        reportType: 'tax-summary'
      };

      const pdfResult = await this.pdfGenerator.generateFromHTML(html, pdfOptions);

      if (!pdfResult.success) {
        throw new Error(`PDF generation failed: ${pdfResult.error}`);
      }

      // Apply watermark if needed
      let finalBuffer = pdfResult.buffer;
      if (showWatermark) {
        finalBuffer = await this.pdfGenerator.addWatermark(
          pdfResult.buffer,
          watermarkText,
          { opacity: 0.1, fontSize: 48, color: 'gray' }
        );
      }

      // Save report if requested
      let filePath = null;
      if (options.saveToFile) {
        const filename = `tax-summary-${reportId}.pdf`;
        filePath = await this.pdfGenerator.savePDF(finalBuffer, filename);
      }

      const result = {
        success: true,
        reportId,
        type: 'tax-summary',
        buffer: finalBuffer,
        filePath,
        metadata: {
          ...pdfResult.metadata,
          taxYear: taxData.taxYear,
          userId,
          sections: sections.length,
          chartsIncluded: includeCharts,
          brandingApplied: includeBranding,
          watermarkApplied: showWatermark,
          locale,
          currency
        }
      };

      logReportComplete(reportId, 'tax-summary', result.metadata.duration, result.metadata.size, userId);
      this.activeReports.delete(reportId);

      return result;

    } catch (error) {
      logReportError(reportId, 'tax-summary', error, userId);
      this.activeReports.delete(reportId);
      throw error;
    }
  }

  /**
   * Generate tax bracket visualization report
   * @param {object} taxData - Tax calculation data
   * @param {object} options - Report generation options
   * @returns {object} Report generation result
   */
  async generateTaxBracketReport(taxData, options = {}) {
    const reportId = uuidv4();

    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const {
        locale = config.i18n.defaultLanguage,
        currency = config.i18n.defaultCurrency,
        userId = null
      } = options;

      logReportStart(reportId, 'tax-bracket', userId);

      // Generate tax bracket chart
      const chartImage = await this.chartGenerator.generateTaxBracketChart(taxData, {
        locale,
        currency,
        title: 'Tax Brackets Visualization'
      });

      // Prepare template data
      const templateData = {
        reportId,
        taxData,
        chartImage,
        locale,
        currency,
        timestamp: new Date(),
        reportTitle: 'Tax Bracket Analysis Report'
      };

      // Render HTML template
      const html = await this.templateEngine.render('tax-bracket-report', templateData);

      // Generate PDF
      const pdfResult = await this.pdfGenerator.generateFromHTML(html, {
        userId,
        reportType: 'tax-bracket'
      });

      const result = {
        success: true,
        reportId,
        type: 'tax-bracket',
        buffer: pdfResult.buffer,
        metadata: pdfResult.metadata
      };

      logReportComplete(reportId, 'tax-bracket', result.metadata.duration, result.metadata.size, userId);

      return result;

    } catch (error) {
      logReportError(reportId, 'tax-bracket', error, userId);
      throw error;
    }
  }

  /**
   * Generate year-over-year comparison report
   * @param {array} yearlyData - Array of yearly tax data
   * @param {object} options - Report generation options
   * @returns {object} Report generation result
   */
  async generateYearComparisonReport(yearlyData, options = {}) {
    const reportId = uuidv4();

    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const {
        locale = config.i18n.defaultLanguage,
        currency = config.i18n.defaultCurrency,
        userId = null
      } = options;

      logReportStart(reportId, 'year-comparison', userId);

      // Generate comparison chart
      const chartImage = await this.chartGenerator.generateYearComparisonChart(yearlyData, {
        locale,
        currency,
        title: 'Year-over-Year Tax Comparison'
      });

      // Prepare template data
      const templateData = {
        reportId,
        yearlyData: yearlyData.sort((a, b) => a.year - b.year),
        chartImage,
        locale,
        currency,
        timestamp: new Date(),
        reportTitle: 'Year-over-Year Tax Comparison Report'
      };

      // Add comparison analysis
      templateData.analysis = this.generateYearComparisonAnalysis(yearlyData);

      // Render HTML template
      const html = await this.templateEngine.render('year-comparison-report', templateData);

      // Generate PDF
      const pdfResult = await this.pdfGenerator.generateFromHTML(html, {
        userId,
        reportType: 'year-comparison'
      });

      const result = {
        success: true,
        reportId,
        type: 'year-comparison',
        buffer: pdfResult.buffer,
        metadata: pdfResult.metadata
      };

      logReportComplete(reportId, 'year-comparison', result.metadata.duration, result.metadata.size, userId);

      return result;

    } catch (error) {
      logReportError(reportId, 'year-comparison', error, userId);
      throw error;
    }
  }

  /**
   * Generate state tax comparison report
   * @param {array} stateData - Array of state tax data
   * @param {object} options - Report generation options
   * @returns {object} Report generation result
   */
  async generateStateTaxComparisonReport(stateData, options = {}) {
    const reportId = uuidv4();

    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const {
        locale = config.i18n.defaultLanguage,
        currency = config.i18n.defaultCurrency,
        userId = null
      } = options;

      logReportStart(reportId, 'state-comparison', userId);

      // Generate state comparison chart
      const chartImage = await this.chartGenerator.generateStateTaxComparisonChart(stateData, {
        locale,
        currency,
        title: 'State Tax Comparison'
      });

      // Prepare template data
      const templateData = {
        reportId,
        stateData: stateData.sort((a, b) => (b.stateTax || 0) - (a.stateTax || 0)),
        chartImage,
        locale,
        currency,
        timestamp: new Date(),
        reportTitle: 'State Tax Comparison Report'
      };

      // Add state analysis
      templateData.analysis = this.generateStateTaxAnalysis(stateData);

      // Render HTML template
      const html = await this.templateEngine.render('state-comparison-report', templateData);

      // Generate PDF
      const pdfResult = await this.pdfGenerator.generateFromHTML(html, {
        userId,
        reportType: 'state-comparison'
      });

      const result = {
        success: true,
        reportId,
        type: 'state-comparison',
        buffer: pdfResult.buffer,
        metadata: pdfResult.metadata
      };

      logReportComplete(reportId, 'state-comparison', result.metadata.duration, result.metadata.size, userId);

      return result;

    } catch (error) {
      logReportError(reportId, 'state-comparison', error, userId);
      throw error;
    }
  }

  /**
   * Prepare tax summary template data
   * @param {object} taxData - Raw tax data
   * @param {object} options - Preparation options
   * @returns {object} Processed template data
   */
  async prepareTaxSummaryData(taxData, options = {}) {
    const {
      locale,
      currency,
      timezone,
      sections = [],
      reportId
    } = options;

    const formatter = new Formatters(locale, currency, timezone);

    // Process tax data
    const processedData = {
      taxData: {
        ...taxData,
        effectiveRate: (taxData.totalTax || 0) / (taxData.grossIncome || 1),
        marginalRate: this.calculateMarginalRate(taxData),
        takeHomeRate: ((taxData.grossIncome || 0) - (taxData.totalTax || 0)) / (taxData.grossIncome || 1)
      },
      userInfo: taxData.userInfo || {},
      deductions: taxData.deductions || {},
      credits: taxData.credits || {},
      config: {
        branding: config.branding,
        charts: config.charts
      }
    };

    // Add recommendations if section included
    if (sections.includes('recommendations')) {
      processedData.recommendations = await this.generateTaxRecommendations(taxData);
    }

    // Add year comparison if data available and section included
    if (sections.includes('comparison') && taxData.yearComparison) {
      processedData.yearComparison = taxData.yearComparison;
      processedData.comparison = this.calculateYearOverYearChanges(taxData.yearComparison);
    }

    return processedData;
  }

  /**
   * Generate charts for report
   * @param {object} templateData - Template data
   * @param {object} options - Chart options
   */
  async generateReportCharts(templateData, options = {}) {
    const {
      locale = 'en',
      currency = 'USD'
    } = options;

    try {
      // Generate income breakdown chart
      templateData.incomeBreakdownChart = await this.chartGenerator.generateIncomeBreakdownChart(
        templateData.taxData,
        { locale, currency, title: 'Income vs Tax Breakdown' }
      );

      // Generate deduction chart if deductions exist
      if (templateData.deductions && Object.keys(templateData.deductions).length > 0) {
        templateData.deductionChart = await this.chartGenerator.generateDeductionChart(
          { categories: templateData.deductions },
          { locale, currency, title: 'Deduction Categories' }
        );
      }

      reportLogger.info('Report charts generated', { reportId: templateData.reportId });

    } catch (error) {
      reportLogger.error('Error generating report charts', {
        reportId: templateData.reportId,
        error: error.message
      });
      // Continue without charts rather than failing the entire report
    }
  }

  /**
   * Apply branding to template data
   * @param {object} templateData - Template data
   * @param {object} customBranding - Custom branding options
   */
  async applyBranding(templateData, customBranding = null) {
    if (customBranding) {
      // Apply custom branding
      templateData.config.branding = {
        ...config.branding,
        ...customBranding
      };
    }

    // Ensure logo exists
    try {
      await fs.access(templateData.config.branding.logoPath);
    } catch {
      // Remove logo path if file doesn't exist
      delete templateData.config.branding.logoPath;
    }
  }

  /**
   * Generate tax optimization recommendations
   * @param {object} taxData - Tax data
   * @returns {array} Array of recommendations
   */
  async generateTaxRecommendations(taxData) {
    const recommendations = [];

    // Check for retirement contribution opportunities
    if (!taxData.retirement401k || taxData.retirement401k < 22500) { // 2023 limit
      recommendations.push({
        title: 'Maximize 401(k) Contributions',
        description: 'Consider increasing your 401(k) contributions to reduce taxable income.',
        category: 'warning',
        savings: Math.min(22500 - (taxData.retirement401k || 0), 5000) * 0.22,
        impact: 'High - Immediate tax savings plus retirement growth'
      });
    }

    // Check for IRA opportunities
    if (!taxData.iraContribution || taxData.iraContribution < 6500) { // 2023 limit
      recommendations.push({
        title: 'Consider IRA Contributions',
        description: 'Traditional IRA contributions may be tax-deductible depending on your income.',
        category: 'success',
        savings: 1430, // Rough estimate
        impact: 'Medium - Additional tax-deferred retirement savings'
      });
    }

    // Check for HSA opportunities
    if (taxData.healthInsurance === 'high_deductible' && (!taxData.hsaContribution || taxData.hsaContribution < 3850)) {
      recommendations.push({
        title: 'Maximize HSA Contributions',
        description: 'HSA contributions are triple tax-advantaged: deductible, grow tax-free, and withdraw tax-free for medical expenses.',
        category: 'success',
        savings: (3850 - (taxData.hsaContribution || 0)) * 0.22,
        impact: 'High - Best tax-advantaged account available'
      });
    }

    // Check for tax-loss harvesting
    if (taxData.capitalGains > 0) {
      recommendations.push({
        title: 'Tax-Loss Harvesting',
        description: 'Consider realizing capital losses to offset gains and reduce tax liability.',
        category: 'warning',
        impact: 'Variable - Depends on available losses'
      });
    }

    return recommendations;
  }

  /**
   * Calculate marginal tax rate
   * @param {object} taxData - Tax data
   * @returns {number} Marginal tax rate
   */
  calculateMarginalRate(taxData) {
    if (!taxData.taxBrackets || !taxData.taxableIncome) {
      return 0;
    }

    const income = taxData.taxableIncome;
    const brackets = taxData.taxBrackets.sort((a, b) => a.min - b.min);

    for (const bracket of brackets) {
      if (income >= bracket.min && (income < bracket.max || bracket.max === Infinity)) {
        return bracket.rate;
      }
    }

    return 0;
  }

  /**
   * Generate year-over-year comparison analysis
   * @param {array} yearlyData - Yearly tax data
   * @returns {object} Analysis results
   */
  generateYearComparisonAnalysis(yearlyData) {
    if (yearlyData.length < 2) {
      return null;
    }

    const sorted = [...yearlyData].sort((a, b) => a.year - b.year);
    const latest = sorted[sorted.length - 1];
    const previous = sorted[sorted.length - 2];

    return {
      incomeChange: latest.grossIncome - previous.grossIncome,
      incomeChangePercent: (latest.grossIncome - previous.grossIncome) / previous.grossIncome,
      taxChange: latest.totalTax - previous.totalTax,
      taxChangePercent: (latest.totalTax - previous.totalTax) / previous.totalTax,
      effectiveRateChange: (latest.totalTax / latest.grossIncome) - (previous.totalTax / previous.grossIncome)
    };
  }

  /**
   * Generate state tax analysis
   * @param {array} stateData - State tax data
   * @returns {object} Analysis results
   */
  generateStateTaxAnalysis(stateData) {
    const totalStates = stateData.length;
    const statesWithTax = stateData.filter(s => (s.stateTax || 0) > 0).length;
    const avgStateTax = stateData.reduce((sum, s) => sum + (s.stateTax || 0), 0) / totalStates;

    const sorted = [...stateData].sort((a, b) => (b.stateTax || 0) - (a.stateTax || 0));

    return {
      totalStates,
      statesWithTax,
      statesWithoutTax: totalStates - statesWithTax,
      averageStateTax: avgStateTax,
      highestTaxState: sorted[0],
      lowestTaxState: sorted[sorted.length - 1]
    };
  }

  /**
   * Calculate year-over-year changes
   * @param {array} yearData - Year comparison data
   * @returns {object} Change calculations
   */
  calculateYearOverYearChanges(yearData) {
    if (yearData.length < 2) return null;

    const current = yearData[yearData.length - 1];
    const previous = yearData[yearData.length - 2];

    return {
      grossIncome: {
        change: current.grossIncome - previous.grossIncome,
        changePercent: (current.grossIncome - previous.grossIncome) / previous.grossIncome
      },
      totalTax: {
        change: current.totalTax - previous.totalTax,
        changePercent: (current.totalTax - previous.totalTax) / previous.totalTax
      },
      netIncome: {
        change: (current.grossIncome - current.totalTax) - (previous.grossIncome - previous.totalTax),
        changePercent: ((current.grossIncome - current.totalTax) - (previous.grossIncome - previous.totalTax)) / (previous.grossIncome - previous.totalTax)
      }
    };
  }

  /**
   * Get available report templates
   * @returns {array} Available templates
   */
  async getAvailableTemplates() {
    return await this.templateEngine.listTemplates();
  }

  /**
   * Get report generation status
   * @returns {object} Status information
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      activeReports: this.activeReports.size,
      reports: Array.from(this.activeReports.entries()).map(([id, info]) => ({
        reportId: id,
        type: info.type,
        duration: Date.now() - info.startTime,
        userId: info.userId,
        status: info.status
      })),
      subServices: {
        pdfGenerator: this.pdfGenerator.getStatus(),
        chartGenerator: this.chartGenerator.getStatistics(),
        templateEngine: this.templateEngine.getCacheStats()
      }
    };
  }

  /**
   * Cancel active report generation
   * @param {string} reportId - Report ID to cancel
   * @returns {boolean} Success status
   */
  async cancelReport(reportId) {
    if (this.activeReports.has(reportId)) {
      this.activeReports.delete(reportId);
      await this.pdfGenerator.cancelGeneration(reportId);
      reportLogger.info('Report generation cancelled', { reportId });
      return true;
    }
    return false;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      await this.pdfGenerator.cleanup();
      this.activeReports.clear();
      this.isInitialized = false;
      reportLogger.info('Report Generator cleaned up');
    } catch (error) {
      reportLogger.error('Error during Report Generator cleanup', { error: error.message });
    }
  }

  /**
   * Health check
   * @returns {object} Health status
   */
  async healthCheck() {
    try {
      const status = this.getStatus();
      const pdfHealthCheck = await this.pdfGenerator.healthCheck();

      return {
        healthy: status.initialized && pdfHealthCheck.healthy,
        status: status.initialized && pdfHealthCheck.healthy ? 'Healthy' : 'Unhealthy',
        details: {
          ...status,
          pdfGenerator: pdfHealthCheck
        }
      };

    } catch (error) {
      return {
        healthy: false,
        status: 'Health check failed',
        error: error.message
      };
    }
  }
}

module.exports = ReportGenerator;