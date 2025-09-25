const puppeteer = require('puppeteer');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { logger, logReportStart, logReportComplete, logReportError } = require('../utils/logger');

/**
 * PDF Generation Service using Puppeteer and PDFKit
 */
class PDFGenerator {
  constructor() {
    this.browser = null;
    this.isInitialized = false;
    this.activeGenerations = new Map();
  }

  /**
   * Initialize Puppeteer browser
   */
  async initialize() {
    try {
      logger.info('Initializing PDF Generator...');

      const puppeteerOptions = {
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      };

      // Add executable path if specified
      if (config.pdf.puppeteerExecutablePath) {
        puppeteerOptions.executablePath = config.pdf.puppeteerExecutablePath;
      }

      this.browser = await puppeteer.launch(puppeteerOptions);
      this.isInitialized = true;

      logger.info('PDF Generator initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize PDF Generator', { error: error.message });
      throw error;
    }
  }

  /**
   * Ensure browser is initialized
   */
  async ensureInitialized() {
    if (!this.isInitialized || !this.browser) {
      await this.initialize();
    }

    // Check if browser is still connected
    if (!this.browser.isConnected()) {
      logger.warn('Browser disconnected, reinitializing...');
      await this.initialize();
    }
  }

  /**
   * Generate PDF from HTML content
   * @param {string} html - HTML content
   * @param {object} options - PDF generation options
   * @returns {object} Generation result with buffer and metadata
   */
  async generateFromHTML(html, options = {}) {
    const reportId = uuidv4();
    const startTime = Date.now();

    try {
      await this.ensureInitialized();

      const {
        format = config.pdf.format,
        margin = config.pdf.options.margin,
        landscape = false,
        printBackground = true,
        displayHeaderFooter = config.pdf.options.displayHeaderFooter,
        headerTemplate = config.pdf.options.headerTemplate,
        footerTemplate = config.pdf.options.footerTemplate,
        waitForSelector = null,
        waitForTimeout = 2000,
        width = null,
        height = null,
        userId = null,
        reportType = 'html-report'
      } = options;

      logReportStart(reportId, reportType, userId);

      // Track active generation
      this.activeGenerations.set(reportId, {
        startTime,
        type: reportType,
        userId
      });

      // Create new page
      const page = await this.browser.newPage();

      try {
        // Set viewport if width/height specified
        if (width && height) {
          await page.setViewport({ width: parseInt(width), height: parseInt(height) });
        }

        // Set content
        await page.setContent(html, {
          waitUntil: 'networkidle0',
          timeout: config.reports.timeoutMs
        });

        // Wait for specific selector if provided
        if (waitForSelector) {
          await page.waitForSelector(waitForSelector, {
            timeout: waitForTimeout
          });
        }

        // Wait for charts to render
        await page.evaluate(() => {
          return new Promise((resolve) => {
            // Wait for Chart.js charts to complete rendering
            if (window.Chart && window.Chart.instances) {
              const charts = Object.values(window.Chart.instances);
              if (charts.length > 0) {
                Promise.all(
                  charts.map(chart =>
                    chart.options.animation ?
                      new Promise(res => setTimeout(res, 1000)) :
                      Promise.resolve()
                  )
                ).then(resolve);
              } else {
                resolve();
              }
            } else {
              // Fallback wait time for other visualizations
              setTimeout(resolve, 500);
            }
          });
        });

        // Generate PDF
        const pdfOptions = {
          format,
          landscape,
          printBackground,
          margin,
          displayHeaderFooter,
          headerTemplate,
          footerTemplate,
          preferCSSPageSize: false
        };

        const pdfBuffer = await page.pdf(pdfOptions);

        // Get page metrics
        const metrics = await page.metrics();

        const result = {
          success: true,
          reportId,
          buffer: pdfBuffer,
          metadata: {
            size: pdfBuffer.length,
            format,
            landscape,
            generatedAt: new Date().toISOString(),
            duration: Date.now() - startTime,
            pageCount: await this.getPDFPageCount(pdfBuffer),
            metrics: {
              JSEventListeners: metrics.JSEventListeners,
              Nodes: metrics.Nodes,
              JSHeapUsedSize: metrics.JSHeapUsedSize,
              JSHeapTotalSize: metrics.JSHeapTotalSize
            }
          }
        };

        logReportComplete(reportId, reportType, result.metadata.duration, result.metadata.size, userId);

        return result;

      } finally {
        await page.close();
        this.activeGenerations.delete(reportId);
      }

    } catch (error) {
      logReportError(reportId, reportType, error, userId);
      this.activeGenerations.delete(reportId);

      return {
        success: false,
        reportId,
        error: error.message,
        metadata: {
          duration: Date.now() - startTime,
          generatedAt: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Generate PDF using PDFKit for programmatic creation
   * @param {function} contentCallback - Function that adds content to PDF
   * @param {object} options - PDF options
   * @returns {object} Generation result with buffer and metadata
   */
  async generateProgrammatic(contentCallback, options = {}) {
    const reportId = uuidv4();
    const startTime = Date.now();

    try {
      const {
        size = 'A4',
        layout = 'portrait',
        margin = 50,
        userId = null,
        reportType = 'programmatic-report'
      } = options;

      logReportStart(reportId, reportType, userId);

      // Track active generation
      this.activeGenerations.set(reportId, {
        startTime,
        type: reportType,
        userId
      });

      // Create PDF document
      const doc = new PDFDocument({
        size,
        layout,
        margin,
        bufferPages: true,
        autoFirstPage: false
      });

      // Collect PDF buffer
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));

      return new Promise((resolve, reject) => {
        doc.on('end', () => {
          const buffer = Buffer.concat(chunks);

          const result = {
            success: true,
            reportId,
            buffer,
            metadata: {
              size: buffer.length,
              format: size,
              layout,
              generatedAt: new Date().toISOString(),
              duration: Date.now() - startTime,
              pageCount: doc.bufferedPageRange().count
            }
          };

          logReportComplete(reportId, reportType, result.metadata.duration, result.metadata.size, userId);
          this.activeGenerations.delete(reportId);

          resolve(result);
        });

        doc.on('error', (error) => {
          logReportError(reportId, reportType, error, userId);
          this.activeGenerations.delete(reportId);

          reject({
            success: false,
            reportId,
            error: error.message,
            metadata: {
              duration: Date.now() - startTime,
              generatedAt: new Date().toISOString()
            }
          });
        });

        try {
          // Execute content callback
          contentCallback(doc);

          // Finalize the PDF
          doc.end();
        } catch (error) {
          doc.destroy();
          reject(error);
        }
      });

    } catch (error) {
      logReportError(reportId, reportType, error, userId);
      this.activeGenerations.delete(reportId);

      return {
        success: false,
        reportId,
        error: error.message,
        metadata: {
          duration: Date.now() - startTime,
          generatedAt: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Generate PDF with watermark
   * @param {Buffer} pdfBuffer - Original PDF buffer
   * @param {string} watermarkText - Watermark text
   * @param {object} options - Watermark options
   * @returns {Buffer} PDF buffer with watermark
   */
  async addWatermark(pdfBuffer, watermarkText, options = {}) {
    try {
      const {
        opacity = 0.1,
        fontSize = 48,
        color = 'gray',
        angle = -45,
        position = 'center'
      } = options;

      // Create new PDF with watermark
      const doc = new PDFDocument();
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));

      return new Promise((resolve) => {
        doc.on('end', () => {
          resolve(Buffer.concat(chunks));
        });

        // Add watermark logic here
        // This is a simplified version - you might want to use a more sophisticated watermarking library
        doc.fontSize(fontSize)
           .fillColor(color)
           .fillOpacity(opacity)
           .rotate(angle)
           .text(watermarkText, position === 'center' ? doc.page.width / 2 : 50, doc.page.height / 2, {
             align: 'center'
           });

        doc.end();
      });

    } catch (error) {
      logger.error('Error adding watermark to PDF', { error: error.message });
      return pdfBuffer; // Return original if watermarking fails
    }
  }

  /**
   * Merge multiple PDFs
   * @param {Array<Buffer>} pdfBuffers - Array of PDF buffers to merge
   * @param {object} options - Merge options
   * @returns {Buffer} Merged PDF buffer
   */
  async mergePDFs(pdfBuffers, options = {}) {
    try {
      const {
        addPageNumbers = true,
        addBookmarks = false
      } = options;

      // This is a placeholder - implement actual PDF merging
      // You might want to use libraries like pdf-lib or PDF2pic
      logger.info('Merging PDFs', { count: pdfBuffers.length });

      // For now, return the first PDF
      return pdfBuffers[0];

    } catch (error) {
      logger.error('Error merging PDFs', { error: error.message });
      throw error;
    }
  }

  /**
   * Get PDF page count
   * @param {Buffer} pdfBuffer - PDF buffer
   * @returns {number} Number of pages
   */
  async getPDFPageCount(pdfBuffer) {
    try {
      // Simple regex to count pages - not 100% accurate but sufficient for basic needs
      const pdfString = pdfBuffer.toString();
      const matches = pdfString.match(/\/Type\s*\/Page[^s]/g);
      return matches ? matches.length : 1;
    } catch (error) {
      logger.error('Error counting PDF pages', { error: error.message });
      return 1;
    }
  }

  /**
   * Save PDF to file
   * @param {Buffer} pdfBuffer - PDF buffer
   * @param {string} filename - Output filename
   * @returns {string} File path
   */
  async savePDF(pdfBuffer, filename) {
    try {
      const filepath = path.join(config.reports.reportsDir, filename);
      await fs.writeFile(filepath, pdfBuffer);
      logger.info('PDF saved to file', { filepath });
      return filepath;
    } catch (error) {
      logger.error('Error saving PDF to file', { error: error.message, filename });
      throw error;
    }
  }

  /**
   * Get active generations status
   * @returns {object} Status information
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      browserConnected: this.browser ? this.browser.isConnected() : false,
      activeGenerations: this.activeGenerations.size,
      generations: Array.from(this.activeGenerations.entries()).map(([id, info]) => ({
        reportId: id,
        type: info.type,
        duration: Date.now() - info.startTime,
        userId: info.userId
      }))
    };
  }

  /**
   * Cancel active generation
   * @param {string} reportId - Report ID to cancel
   * @returns {boolean} Success status
   */
  async cancelGeneration(reportId) {
    if (this.activeGenerations.has(reportId)) {
      this.activeGenerations.delete(reportId);
      logger.info('Generation cancelled', { reportId });
      return true;
    }
    return false;
  }

  /**
   * Cleanup and close browser
   */
  async cleanup() {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      this.isInitialized = false;
      this.activeGenerations.clear();
      logger.info('PDF Generator cleaned up');
    } catch (error) {
      logger.error('Error during PDF Generator cleanup', { error: error.message });
    }
  }

  /**
   * Health check
   * @returns {object} Health status
   */
  async healthCheck() {
    try {
      const status = this.getStatus();

      if (!status.initialized || !status.browserConnected) {
        return {
          healthy: false,
          status: 'Browser not initialized or disconnected',
          details: status
        };
      }

      // Test basic functionality
      const testHTML = '<html><body><h1>Health Check</h1></body></html>';
      const result = await this.generateFromHTML(testHTML, {
        reportType: 'health-check',
        waitForTimeout: 1000
      });

      return {
        healthy: result.success,
        status: result.success ? 'Healthy' : 'Test generation failed',
        details: {
          ...status,
          testResult: result.success,
          testDuration: result.metadata?.duration
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

module.exports = PDFGenerator;