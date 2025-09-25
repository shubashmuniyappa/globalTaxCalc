const ExcelJS = require('exceljs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const archiver = require('archiver');
const config = require('../config');
const { exportLogger, logExportStart, logExportComplete, logExportError } = require('../utils/logger');
const Formatters = require('../utils/formatters');

/**
 * Data Export Service supporting multiple formats
 */
class ExportService {
  constructor() {
    this.activeExports = new Map();
  }

  /**
   * Export tax data to CSV format
   * @param {object} taxData - Tax calculation data
   * @param {object} options - Export options
   * @returns {object} Export result with buffer
   */
  async exportToCSV(taxData, options = {}) {
    const exportId = uuidv4();
    const startTime = Date.now();

    try {
      const {
        locale = config.i18n.defaultLanguage,
        currency = config.i18n.defaultCurrency,
        userId = null,
        includeDetails = true,
        includeDeductions = true,
        includeCredits = true,
        filename = `tax-export-${exportId}.csv`
      } = options;

      logExportStart(exportId, 'csv', 1, userId);
      this.activeExports.set(exportId, { format: 'csv', startTime, userId });

      const formatter = new Formatters(locale, currency);

      // Prepare CSV data
      const csvData = [];

      // Basic tax information
      csvData.push({
        category: 'Basic Information',
        field: 'Tax Year',
        value: taxData.taxYear || 'N/A',
        formatted_value: taxData.taxYear || 'N/A'
      });

      csvData.push({
        category: 'Basic Information',
        field: 'Filing Status',
        value: taxData.filingStatus || 'N/A',
        formatted_value: (taxData.filingStatus || 'N/A').replace('_', ' ').toUpperCase()
      });

      csvData.push({
        category: 'Basic Information',
        field: 'State',
        value: taxData.state || 'N/A',
        formatted_value: taxData.state || 'N/A'
      });

      // Income data
      csvData.push({
        category: 'Income',
        field: 'Gross Income',
        value: taxData.grossIncome || 0,
        formatted_value: formatter.formatCurrency(taxData.grossIncome || 0)
      });

      csvData.push({
        category: 'Income',
        field: 'Taxable Income',
        value: taxData.taxableIncome || 0,
        formatted_value: formatter.formatCurrency(taxData.taxableIncome || 0)
      });

      csvData.push({
        category: 'Income',
        field: 'Adjusted Gross Income',
        value: taxData.adjustedGrossIncome || 0,
        formatted_value: formatter.formatCurrency(taxData.adjustedGrossIncome || 0)
      });

      // Tax calculations
      csvData.push({
        category: 'Federal Tax',
        field: 'Federal Income Tax',
        value: taxData.federalIncomeTax || 0,
        formatted_value: formatter.formatCurrency(taxData.federalIncomeTax || 0)
      });

      csvData.push({
        category: 'Federal Tax',
        field: 'Social Security Tax',
        value: taxData.socialSecurity || 0,
        formatted_value: formatter.formatCurrency(taxData.socialSecurity || 0)
      });

      csvData.push({
        category: 'Federal Tax',
        field: 'Medicare Tax',
        value: taxData.medicare || 0,
        formatted_value: formatter.formatCurrency(taxData.medicare || 0)
      });

      if (taxData.additionalMedicare) {
        csvData.push({
          category: 'Federal Tax',
          field: 'Additional Medicare Tax',
          value: taxData.additionalMedicare,
          formatted_value: formatter.formatCurrency(taxData.additionalMedicare)
        });
      }

      csvData.push({
        category: 'Federal Tax',
        field: 'Total Federal Tax',
        value: taxData.federalTax || 0,
        formatted_value: formatter.formatCurrency(taxData.federalTax || 0)
      });

      // State tax
      if (taxData.stateTax) {
        csvData.push({
          category: 'State Tax',
          field: 'State Income Tax',
          value: taxData.stateIncomeTax || 0,
          formatted_value: formatter.formatCurrency(taxData.stateIncomeTax || 0)
        });

        if (taxData.stateDisabilityTax) {
          csvData.push({
            category: 'State Tax',
            field: 'State Disability Tax',
            value: taxData.stateDisabilityTax,
            formatted_value: formatter.formatCurrency(taxData.stateDisabilityTax)
          });
        }

        csvData.push({
          category: 'State Tax',
          field: 'Total State Tax',
          value: taxData.stateTax,
          formatted_value: formatter.formatCurrency(taxData.stateTax)
        });
      }

      // Total tax and rates
      csvData.push({
        category: 'Tax Summary',
        field: 'Total Tax',
        value: taxData.totalTax || 0,
        formatted_value: formatter.formatCurrency(taxData.totalTax || 0)
      });

      csvData.push({
        category: 'Tax Summary',
        field: 'Effective Tax Rate',
        value: (taxData.totalTax || 0) / (taxData.grossIncome || 1),
        formatted_value: formatter.formatPercentage((taxData.totalTax || 0) / (taxData.grossIncome || 1))
      });

      csvData.push({
        category: 'Tax Summary',
        field: 'Net Income',
        value: (taxData.grossIncome || 0) - (taxData.totalTax || 0),
        formatted_value: formatter.formatCurrency((taxData.grossIncome || 0) - (taxData.totalTax || 0))
      });

      // Add deductions if included
      if (includeDeductions && taxData.deductions) {
        Object.entries(taxData.deductions).forEach(([key, value]) => {
          csvData.push({
            category: 'Deductions',
            field: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            value: value,
            formatted_value: formatter.formatCurrency(value)
          });
        });

        csvData.push({
          category: 'Deductions',
          field: 'Total Deductions',
          value: taxData.totalDeductions || 0,
          formatted_value: formatter.formatCurrency(taxData.totalDeductions || 0)
        });
      }

      // Add credits if included
      if (includeCredits && taxData.credits) {
        Object.entries(taxData.credits).forEach(([key, value]) => {
          csvData.push({
            category: 'Credits',
            field: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            value: value,
            formatted_value: formatter.formatCurrency(value)
          });
        });

        csvData.push({
          category: 'Credits',
          field: 'Total Credits',
          value: taxData.totalCredits || 0,
          formatted_value: formatter.formatCurrency(taxData.totalCredits || 0)
        });
      }

      // Add tax brackets if available
      if (includeDetails && taxData.taxBrackets) {
        taxData.taxBrackets.forEach((bracket, index) => {
          csvData.push({
            category: 'Tax Brackets',
            field: `Bracket ${index + 1} Rate`,
            value: bracket.rate,
            formatted_value: formatter.formatPercentage(bracket.rate)
          });

          csvData.push({
            category: 'Tax Brackets',
            field: `Bracket ${index + 1} Min`,
            value: bracket.min,
            formatted_value: formatter.formatCurrency(bracket.min)
          });

          csvData.push({
            category: 'Tax Brackets',
            field: `Bracket ${index + 1} Max`,
            value: bracket.max === Infinity ? 'Unlimited' : bracket.max,
            formatted_value: bracket.max === Infinity ? 'Unlimited' : formatter.formatCurrency(bracket.max)
          });
        });
      }

      // Create CSV file
      const filePath = path.join(config.reports.tempDir, filename);
      const csvWriter = createCsvWriter({
        path: filePath,
        header: [
          { id: 'category', title: 'Category' },
          { id: 'field', title: 'Field' },
          { id: 'value', title: 'Value' },
          { id: 'formatted_value', title: 'Formatted Value' }
        ],
        encoding: config.export.csv.encoding
      });

      await csvWriter.writeRecords(csvData);

      // Read the file back as buffer
      const buffer = await fs.readFile(filePath);

      // Clean up temp file
      await fs.unlink(filePath).catch(() => {});

      const result = {
        success: true,
        exportId,
        format: 'csv',
        buffer,
        metadata: {
          size: buffer.length,
          recordCount: csvData.length,
          filename,
          contentType: 'text/csv',
          encoding: config.export.csv.encoding,
          delimiter: config.export.csv.delimiter,
          duration: Date.now() - startTime
        }
      };

      logExportComplete(exportId, 'csv', result.metadata.duration, result.metadata.size, userId);
      this.activeExports.delete(exportId);

      return result;

    } catch (error) {
      logExportError(exportId, 'csv', error, userId);
      this.activeExports.delete(exportId);
      throw error;
    }
  }

  /**
   * Export tax data to Excel format
   * @param {object} taxData - Tax calculation data
   * @param {object} options - Export options
   * @returns {object} Export result with buffer
   */
  async exportToExcel(taxData, options = {}) {
    const exportId = uuidv4();
    const startTime = Date.now();

    try {
      const {
        locale = config.i18n.defaultLanguage,
        currency = config.i18n.defaultCurrency,
        userId = null,
        includeCharts = false,
        multipleSheets = true,
        filename = `tax-export-${exportId}.xlsx`
      } = options;

      logExportStart(exportId, 'excel', 1, userId);
      this.activeExports.set(exportId, { format: 'excel', startTime, userId });

      const formatter = new Formatters(locale, currency);
      const workbook = new ExcelJS.Workbook();

      // Set workbook properties
      workbook.creator = config.branding.companyName;
      workbook.created = new Date();
      workbook.modified = new Date();
      workbook.lastPrinted = new Date();

      if (multipleSheets) {
        // Create multiple worksheets
        await this.createSummarySheet(workbook, taxData, formatter);
        await this.createIncomeSheet(workbook, taxData, formatter);
        await this.createDeductionsSheet(workbook, taxData, formatter);
        await this.createTaxCalculationSheet(workbook, taxData, formatter);

        if (taxData.taxBrackets) {
          await this.createTaxBracketsSheet(workbook, taxData, formatter);
        }

        if (taxData.yearComparison) {
          await this.createYearComparisonSheet(workbook, taxData.yearComparison, formatter);
        }
      } else {
        // Single sheet with all data
        await this.createAllDataSheet(workbook, taxData, formatter);
      }

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();

      const result = {
        success: true,
        exportId,
        format: 'excel',
        buffer,
        metadata: {
          size: buffer.length,
          filename,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          worksheetCount: workbook.worksheets.length,
          multipleSheets,
          duration: Date.now() - startTime
        }
      };

      logExportComplete(exportId, 'excel', result.metadata.duration, result.metadata.size, userId);
      this.activeExports.delete(exportId);

      return result;

    } catch (error) {
      logExportError(exportId, 'excel', error, userId);
      this.activeExports.delete(exportId);
      throw error;
    }
  }

  /**
   * Export tax data to JSON format
   * @param {object} taxData - Tax calculation data
   * @param {object} options - Export options
   * @returns {object} Export result with buffer
   */
  async exportToJSON(taxData, options = {}) {
    const exportId = uuidv4();
    const startTime = Date.now();

    try {
      const {
        userId = null,
        prettyPrint = config.export.json.prettyPrint,
        includeMetadata = true,
        filename = `tax-export-${exportId}.json`
      } = options;

      logExportStart(exportId, 'json', 1, userId);
      this.activeExports.set(exportId, { format: 'json', startTime, userId });

      // Prepare export data
      const exportData = {
        ...taxData
      };

      // Add metadata if requested
      if (includeMetadata) {
        exportData._metadata = {
          exportId,
          exportDate: new Date().toISOString(),
          version: '1.0.0',
          source: config.branding.companyName,
          format: 'json'
        };
      }

      // Convert to JSON
      const jsonString = prettyPrint
        ? JSON.stringify(exportData, null, 2)
        : JSON.stringify(exportData);

      const buffer = Buffer.from(jsonString, 'utf8');

      const result = {
        success: true,
        exportId,
        format: 'json',
        buffer,
        metadata: {
          size: buffer.length,
          filename,
          contentType: 'application/json',
          prettyPrint,
          includeMetadata,
          duration: Date.now() - startTime
        }
      };

      logExportComplete(exportId, 'json', result.metadata.duration, result.metadata.size, userId);
      this.activeExports.delete(exportId);

      return result;

    } catch (error) {
      logExportError(exportId, 'json', error, userId);
      this.activeExports.delete(exportId);
      throw error;
    }
  }

  /**
   * Create bulk export with multiple formats
   * @param {object} taxData - Tax calculation data
   * @param {object} options - Export options
   * @returns {object} Export result with zip buffer
   */
  async createBulkExport(taxData, options = {}) {
    const exportId = uuidv4();
    const startTime = Date.now();

    try {
      const {
        formats = ['csv', 'excel', 'json'],
        userId = null,
        filename = `tax-bulk-export-${exportId}.zip`
      } = options;

      logExportStart(exportId, 'bulk', formats.length, userId);
      this.activeExports.set(exportId, { format: 'bulk', startTime, userId });

      const archive = archiver('zip', { zlib: { level: 9 } });
      const chunks = [];

      archive.on('data', chunk => chunks.push(chunk));

      // Generate each format
      const exports = {};
      for (const format of formats) {
        let exportResult;

        switch (format) {
          case 'csv':
            exportResult = await this.exportToCSV(taxData, { ...options, filename: `tax-data.csv` });
            break;
          case 'excel':
            exportResult = await this.exportToExcel(taxData, { ...options, filename: `tax-data.xlsx` });
            break;
          case 'json':
            exportResult = await this.exportToJSON(taxData, { ...options, filename: `tax-data.json` });
            break;
          default:
            continue;
        }

        if (exportResult.success) {
          exports[format] = exportResult;
          archive.append(exportResult.buffer, { name: exportResult.metadata.filename });
        }
      }

      // Add summary file
      const summary = {
        exportId,
        exportDate: new Date().toISOString(),
        taxYear: taxData.taxYear,
        formats: Object.keys(exports),
        totalSize: Object.values(exports).reduce((sum, exp) => sum + exp.metadata.size, 0),
        generatedBy: config.branding.companyName
      };

      archive.append(JSON.stringify(summary, null, 2), { name: 'export-summary.json' });

      return new Promise((resolve, reject) => {
        archive.on('end', () => {
          const buffer = Buffer.concat(chunks);

          const result = {
            success: true,
            exportId,
            format: 'bulk',
            buffer,
            metadata: {
              size: buffer.length,
              filename,
              contentType: 'application/zip',
              formats: Object.keys(exports),
              individualExports: exports,
              duration: Date.now() - startTime
            }
          };

          logExportComplete(exportId, 'bulk', result.metadata.duration, result.metadata.size, userId);
          this.activeExports.delete(exportId);

          resolve(result);
        });

        archive.on('error', (error) => {
          logExportError(exportId, 'bulk', error, userId);
          this.activeExports.delete(exportId);
          reject(error);
        });

        archive.finalize();
      });

    } catch (error) {
      logExportError(exportId, 'bulk', error, userId);
      this.activeExports.delete(exportId);
      throw error;
    }
  }

  /**
   * Create Excel summary sheet
   * @param {object} workbook - Excel workbook
   * @param {object} taxData - Tax data
   * @param {object} formatter - Formatter instance
   */
  async createSummarySheet(workbook, taxData, formatter) {
    const worksheet = workbook.addWorksheet('Summary');

    // Set column widths
    worksheet.columns = [
      { header: 'Metric', key: 'metric', width: 25 },
      { header: 'Value', key: 'value', width: 20 },
      { header: 'Percentage', key: 'percentage', width: 15 }
    ];

    // Style the header row
    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' }
    };

    // Add summary data
    const summaryData = [
      { metric: 'Tax Year', value: taxData.taxYear || 'N/A', percentage: '' },
      { metric: 'Gross Income', value: formatter.formatCurrency(taxData.grossIncome || 0), percentage: '100.0%' },
      { metric: 'Total Tax', value: formatter.formatCurrency(taxData.totalTax || 0), percentage: formatter.formatPercentage((taxData.totalTax || 0) / (taxData.grossIncome || 1)) },
      { metric: 'Net Income', value: formatter.formatCurrency((taxData.grossIncome || 0) - (taxData.totalTax || 0)), percentage: formatter.formatPercentage(((taxData.grossIncome || 0) - (taxData.totalTax || 0)) / (taxData.grossIncome || 1)) },
      { metric: 'Federal Tax', value: formatter.formatCurrency(taxData.federalTax || 0), percentage: formatter.formatPercentage((taxData.federalTax || 0) / (taxData.grossIncome || 1)) },
      { metric: 'State Tax', value: formatter.formatCurrency(taxData.stateTax || 0), percentage: formatter.formatPercentage((taxData.stateTax || 0) / (taxData.grossIncome || 1)) },
      { metric: 'Total Deductions', value: formatter.formatCurrency(taxData.totalDeductions || 0), percentage: formatter.formatPercentage((taxData.totalDeductions || 0) / (taxData.grossIncome || 1)) }
    ];

    worksheet.addRows(summaryData);

    // Add some styling
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.getCell(2).numFmt = '"$"#,##0.00';
      }
    });
  }

  /**
   * Create Excel income sheet
   * @param {object} workbook - Excel workbook
   * @param {object} taxData - Tax data
   * @param {object} formatter - Formatter instance
   */
  async createIncomeSheet(workbook, taxData, formatter) {
    const worksheet = workbook.addWorksheet('Income Details');

    worksheet.columns = [
      { header: 'Income Source', key: 'source', width: 25 },
      { header: 'Amount', key: 'amount', width: 20 }
    ];

    // Style header
    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' }
    };

    // Add income data
    const incomeData = [
      { source: 'Salary/Wages', amount: taxData.salary || 0 },
      { source: 'Business Income', amount: taxData.businessIncome || 0 },
      { source: 'Investment Income', amount: taxData.investmentIncome || 0 },
      { source: 'Rental Income', amount: taxData.rentalIncome || 0 },
      { source: 'Other Income', amount: taxData.otherIncome || 0 },
      { source: '', amount: '' },
      { source: 'Gross Income', amount: taxData.grossIncome || 0 },
      { source: 'Adjustments', amount: -(taxData.adjustments || 0) },
      { source: 'Adjusted Gross Income', amount: taxData.adjustedGrossIncome || 0 }
    ];

    worksheet.addRows(incomeData);

    // Format currency columns
    worksheet.getColumn('amount').numFmt = '"$"#,##0.00';

    // Bold the totals
    const totalRows = [7, 9]; // Gross Income and AGI rows
    totalRows.forEach(rowNum => {
      worksheet.getRow(rowNum).font = { bold: true };
    });
  }

  /**
   * Create Excel deductions sheet
   * @param {object} workbook - Excel workbook
   * @param {object} taxData - Tax data
   * @param {object} formatter - Formatter instance
   */
  async createDeductionsSheet(workbook, taxData, formatter) {
    const worksheet = workbook.addWorksheet('Deductions & Credits');

    worksheet.columns = [
      { header: 'Type', key: 'type', width: 25 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Amount', key: 'amount', width: 20 }
    ];

    // Style header
    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' }
    };

    const data = [];

    // Add deductions
    if (taxData.deductions) {
      Object.entries(taxData.deductions).forEach(([key, value]) => {
        data.push({
          type: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          category: 'Deduction',
          amount: value
        });
      });
    }

    // Add credits
    if (taxData.credits) {
      Object.entries(taxData.credits).forEach(([key, value]) => {
        data.push({
          type: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          category: 'Credit',
          amount: value
        });
      });
    }

    worksheet.addRows(data);

    // Format currency column
    worksheet.getColumn('amount').numFmt = '"$"#,##0.00';
  }

  /**
   * Create Excel tax calculation sheet
   * @param {object} workbook - Excel workbook
   * @param {object} taxData - Tax data
   * @param {object} formatter - Formatter instance
   */
  async createTaxCalculationSheet(workbook, taxData, formatter) {
    const worksheet = workbook.addWorksheet('Tax Calculation');

    worksheet.columns = [
      { header: 'Tax Component', key: 'component', width: 25 },
      { header: 'Amount', key: 'amount', width: 20 },
      { header: 'Rate', key: 'rate', width: 15 }
    ];

    // Style header
    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' }
    };

    const taxData_calc = [
      { component: 'Federal Income Tax', amount: taxData.federalIncomeTax || 0, rate: ((taxData.federalIncomeTax || 0) / (taxData.grossIncome || 1)) },
      { component: 'Social Security Tax', amount: taxData.socialSecurity || 0, rate: ((taxData.socialSecurity || 0) / (taxData.grossIncome || 1)) },
      { component: 'Medicare Tax', amount: taxData.medicare || 0, rate: ((taxData.medicare || 0) / (taxData.grossIncome || 1)) },
      { component: 'State Income Tax', amount: taxData.stateIncomeTax || 0, rate: ((taxData.stateIncomeTax || 0) / (taxData.grossIncome || 1)) },
      { component: '', amount: '', rate: '' },
      { component: 'Total Tax', amount: taxData.totalTax || 0, rate: ((taxData.totalTax || 0) / (taxData.grossIncome || 1)) }
    ];

    worksheet.addRows(taxData_calc);

    // Format columns
    worksheet.getColumn('amount').numFmt = '"$"#,##0.00';
    worksheet.getColumn('rate').numFmt = '0.00%';

    // Bold total row
    worksheet.getRow(6).font = { bold: true };
  }

  /**
   * Create Excel tax brackets sheet
   * @param {object} workbook - Excel workbook
   * @param {object} taxData - Tax data
   * @param {object} formatter - Formatter instance
   */
  async createTaxBracketsSheet(workbook, taxData, formatter) {
    const worksheet = workbook.addWorksheet('Tax Brackets');

    worksheet.columns = [
      { header: 'Bracket', key: 'bracket', width: 15 },
      { header: 'Min Income', key: 'min', width: 20 },
      { header: 'Max Income', key: 'max', width: 20 },
      { header: 'Tax Rate', key: 'rate', width: 15 }
    ];

    // Style header
    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' }
    };

    const bracketData = taxData.taxBrackets.map((bracket, index) => ({
      bracket: index + 1,
      min: bracket.min,
      max: bracket.max === Infinity ? 'Unlimited' : bracket.max,
      rate: bracket.rate
    }));

    worksheet.addRows(bracketData);

    // Format columns
    worksheet.getColumn('min').numFmt = '"$"#,##0.00';
    worksheet.getColumn('max').numFmt = '"$"#,##0.00';
    worksheet.getColumn('rate').numFmt = '0.00%';
  }

  /**
   * Create Excel year comparison sheet
   * @param {object} workbook - Excel workbook
   * @param {array} yearData - Year comparison data
   * @param {object} formatter - Formatter instance
   */
  async createYearComparisonSheet(workbook, yearData, formatter) {
    const worksheet = workbook.addWorksheet('Year Comparison');

    const columns = [{ header: 'Metric', key: 'metric', width: 20 }];

    // Add year columns
    yearData.forEach(year => {
      columns.push({ header: year.year.toString(), key: `year_${year.year}`, width: 15 });
    });

    worksheet.columns = columns;

    // Style header
    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' }
    };

    const metrics = ['grossIncome', 'totalTax', 'federalTax', 'stateTax'];

    metrics.forEach(metric => {
      const row = { metric: metric.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()) };
      yearData.forEach(year => {
        row[`year_${year.year}`] = year[metric] || 0;
      });
      worksheet.addRow(row);
    });

    // Format currency columns (all except first)
    for (let i = 2; i <= columns.length; i++) {
      worksheet.getColumn(i).numFmt = '"$"#,##0.00';
    }
  }

  /**
   * Create Excel single sheet with all data
   * @param {object} workbook - Excel workbook
   * @param {object} taxData - Tax data
   * @param {object} formatter - Formatter instance
   */
  async createAllDataSheet(workbook, taxData, formatter) {
    const worksheet = workbook.addWorksheet('Tax Data');

    worksheet.columns = [
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Field', key: 'field', width: 25 },
      { header: 'Value', key: 'value', width: 20 }
    ];

    // Style header
    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' }
    };

    // Add all tax data similar to CSV structure
    const allData = [];

    // Basic info
    allData.push({ category: 'Basic', field: 'Tax Year', value: taxData.taxYear });
    allData.push({ category: 'Basic', field: 'Filing Status', value: taxData.filingStatus });
    allData.push({ category: 'Basic', field: 'State', value: taxData.state });

    // Income
    allData.push({ category: 'Income', field: 'Gross Income', value: taxData.grossIncome || 0 });
    allData.push({ category: 'Income', field: 'Taxable Income', value: taxData.taxableIncome || 0 });
    allData.push({ category: 'Income', field: 'AGI', value: taxData.adjustedGrossIncome || 0 });

    // Taxes
    allData.push({ category: 'Tax', field: 'Federal Tax', value: taxData.federalTax || 0 });
    allData.push({ category: 'Tax', field: 'State Tax', value: taxData.stateTax || 0 });
    allData.push({ category: 'Tax', field: 'Total Tax', value: taxData.totalTax || 0 });

    worksheet.addRows(allData);

    // Format value column as currency for numeric values
    worksheet.getColumn('value').numFmt = '"$"#,##0.00';
  }

  /**
   * Get export statistics
   * @returns {object} Export statistics
   */
  getStatistics() {
    return {
      activeExports: this.activeExports.size,
      supportedFormats: ['csv', 'excel', 'json', 'bulk'],
      configuration: {
        csvDelimiter: config.export.csv.delimiter,
        csvEncoding: config.export.csv.encoding,
        excelSheetName: config.export.excel.sheetName,
        jsonPrettyPrint: config.export.json.prettyPrint
      }
    };
  }

  /**
   * Get active exports status
   * @returns {array} Active exports information
   */
  getActiveExports() {
    return Array.from(this.activeExports.entries()).map(([id, info]) => ({
      exportId: id,
      format: info.format,
      duration: Date.now() - info.startTime,
      userId: info.userId
    }));
  }

  /**
   * Cancel active export
   * @param {string} exportId - Export ID to cancel
   * @returns {boolean} Success status
   */
  cancelExport(exportId) {
    if (this.activeExports.has(exportId)) {
      this.activeExports.delete(exportId);
      exportLogger.info('Export cancelled', { exportId });
      return true;
    }
    return false;
  }
}

module.exports = ExportService;