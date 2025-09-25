const { createCanvas } = require('canvas');
const Chart = require('chart.js/auto');
const ChartDataLabels = require('chartjs-plugin-datalabels');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');
const { chartLogger } = require('../utils/logger');
const Formatters = require('../utils/formatters');

// Register Chart.js plugins
Chart.register(ChartDataLabels);

/**
 * Chart Generation Service for reports
 */
class ChartGenerator {
  constructor() {
    this.formatters = new Formatters();
  }

  /**
   * Generate tax bracket chart
   * @param {object} taxData - Tax calculation data
   * @param {object} options - Chart options
   * @returns {string} Base64 encoded chart image
   */
  async generateTaxBracketChart(taxData, options = {}) {
    try {
      const {
        width = config.charts.defaultWidth,
        height = config.charts.defaultHeight,
        locale = 'en',
        currency = 'USD',
        title = 'Tax Brackets Visualization'
      } = options;

      const formatter = new Formatters(locale, currency);
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      // Prepare data
      const brackets = taxData.taxBrackets || [];
      const labels = brackets.map((bracket, index) => {
        if (index === 0) {
          return `Up to ${formatter.formatCurrency(bracket.max)}`;
        } else if (bracket.max === Infinity) {
          return `Over ${formatter.formatCurrency(bracket.min)}`;
        } else {
          return `${formatter.formatCurrency(bracket.min)} - ${formatter.formatCurrency(bracket.max)}`;
        }
      });

      const data = {
        labels,
        datasets: [{
          label: 'Tax Rate',
          data: brackets.map(bracket => bracket.rate * 100),
          backgroundColor: config.charts.colors.slice(0, brackets.length),
          borderColor: '#ffffff',
          borderWidth: 2,
          borderRadius: 4
        }]
      };

      const chartConfig = {
        type: 'bar',
        data,
        options: {
          responsive: false,
          animation: false,
          plugins: {
            title: {
              display: true,
              text: title,
              font: {
                family: config.charts.fontFamily,
                size: 16,
                weight: 'bold'
              }
            },
            legend: {
              display: false
            },
            datalabels: {
              color: '#ffffff',
              font: {
                weight: 'bold'
              },
              formatter: (value) => `${value.toFixed(1)}%`
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Tax Rate (%)'
              },
              ticks: {
                callback: (value) => `${value}%`
              }
            },
            x: {
              title: {
                display: true,
                text: 'Income Range'
              },
              ticks: {
                maxRotation: 45
              }
            }
          }
        },
        plugins: [ChartDataLabels]
      };

      const chart = new Chart(ctx, chartConfig);
      await this.waitForChartRender();

      const imageBuffer = canvas.toBuffer('image/png');
      const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;

      chart.destroy();
      chartLogger.info('Tax bracket chart generated', {
        width, height, bracketsCount: brackets.length
      });

      return base64Image;

    } catch (error) {
      chartLogger.error('Error generating tax bracket chart', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate income vs tax breakdown pie chart
   * @param {object} taxData - Tax calculation data
   * @param {object} options - Chart options
   * @returns {string} Base64 encoded chart image
   */
  async generateIncomeBreakdownChart(taxData, options = {}) {
    try {
      const {
        width = config.charts.defaultWidth,
        height = config.charts.defaultHeight,
        locale = 'en',
        currency = 'USD',
        title = 'Income vs Tax Breakdown'
      } = options;

      const formatter = new Formatters(locale, currency);
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      // Calculate breakdown
      const totalIncome = taxData.grossIncome || 0;
      const totalTax = taxData.totalTax || 0;
      const netIncome = totalIncome - totalTax;
      const deductions = taxData.totalDeductions || 0;

      const data = {
        labels: ['Net Income', 'Federal Tax', 'State Tax', 'Deductions'],
        datasets: [{
          data: [
            netIncome,
            taxData.federalTax || 0,
            taxData.stateTax || 0,
            deductions
          ],
          backgroundColor: [
            '#10b981', // Green for net income
            '#ef4444', // Red for federal tax
            '#f59e0b', // Orange for state tax
            '#8b5cf6'  // Purple for deductions
          ],
          borderColor: '#ffffff',
          borderWidth: 2
        }]
      };

      const chartConfig = {
        type: 'doughnut',
        data,
        options: {
          responsive: false,
          animation: false,
          plugins: {
            title: {
              display: true,
              text: title,
              font: {
                family: config.charts.fontFamily,
                size: 16,
                weight: 'bold'
              }
            },
            legend: {
              position: 'right',
              labels: {
                generateLabels: (chart) => {
                  const data = chart.data;
                  return data.labels.map((label, index) => {
                    const value = data.datasets[0].data[index];
                    return {
                      text: `${label}: ${formatter.formatCurrency(value)}`,
                      fillStyle: data.datasets[0].backgroundColor[index],
                      hidden: false,
                      index
                    };
                  });
                }
              }
            },
            datalabels: {
              color: '#ffffff',
              font: {
                weight: 'bold'
              },
              formatter: (value, context) => {
                const percentage = ((value / totalIncome) * 100).toFixed(1);
                return `${percentage}%`;
              }
            }
          }
        },
        plugins: [ChartDataLabels]
      };

      const chart = new Chart(ctx, chartConfig);
      await this.waitForChartRender();

      const imageBuffer = canvas.toBuffer('image/png');
      const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;

      chart.destroy();
      chartLogger.info('Income breakdown chart generated', {
        width, height, totalIncome, totalTax
      });

      return base64Image;

    } catch (error) {
      chartLogger.error('Error generating income breakdown chart', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate year-over-year comparison chart
   * @param {array} yearlyData - Array of yearly tax data
   * @param {object} options - Chart options
   * @returns {string} Base64 encoded chart image
   */
  async generateYearComparisonChart(yearlyData, options = {}) {
    try {
      const {
        width = config.charts.defaultWidth,
        height = config.charts.defaultHeight,
        locale = 'en',
        currency = 'USD',
        title = 'Year-over-Year Tax Comparison'
      } = options;

      const formatter = new Formatters(locale, currency);
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      // Sort data by year
      const sortedData = [...yearlyData].sort((a, b) => a.year - b.year);

      const data = {
        labels: sortedData.map(item => item.year.toString()),
        datasets: [
          {
            label: 'Gross Income',
            data: sortedData.map(item => item.grossIncome || 0),
            backgroundColor: 'rgba(37, 99, 235, 0.2)',
            borderColor: '#2563eb',
            borderWidth: 2,
            fill: false,
            tension: 0.4
          },
          {
            label: 'Total Tax',
            data: sortedData.map(item => item.totalTax || 0),
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            borderColor: '#ef4444',
            borderWidth: 2,
            fill: false,
            tension: 0.4
          },
          {
            label: 'Net Income',
            data: sortedData.map(item => (item.grossIncome || 0) - (item.totalTax || 0)),
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            borderColor: '#10b981',
            borderWidth: 2,
            fill: false,
            tension: 0.4
          }
        ]
      };

      const chartConfig = {
        type: 'line',
        data,
        options: {
          responsive: false,
          animation: false,
          plugins: {
            title: {
              display: true,
              text: title,
              font: {
                family: config.charts.fontFamily,
                size: 16,
                weight: 'bold'
              }
            },
            legend: {
              position: 'top'
            },
            datalabels: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Amount'
              },
              ticks: {
                callback: (value) => formatter.formatCurrency(value, { showCents: false })
              }
            },
            x: {
              title: {
                display: true,
                text: 'Year'
              }
            }
          },
          interaction: {
            intersect: false,
            mode: 'index'
          }
        }
      };

      const chart = new Chart(ctx, chartConfig);
      await this.waitForChartRender();

      const imageBuffer = canvas.toBuffer('image/png');
      const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;

      chart.destroy();
      chartLogger.info('Year comparison chart generated', {
        width, height, yearsCount: sortedData.length
      });

      return base64Image;

    } catch (error) {
      chartLogger.error('Error generating year comparison chart', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate deduction categories chart
   * @param {object} deductionData - Deduction breakdown data
   * @param {object} options - Chart options
   * @returns {string} Base64 encoded chart image
   */
  async generateDeductionChart(deductionData, options = {}) {
    try {
      const {
        width = config.charts.defaultWidth,
        height = config.charts.defaultHeight,
        locale = 'en',
        currency = 'USD',
        title = 'Deduction Categories'
      } = options;

      const formatter = new Formatters(locale, currency);
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      // Prepare deduction categories
      const categories = Object.entries(deductionData.categories || {});
      const labels = categories.map(([category, _]) => category.replace(/_/g, ' ').toUpperCase());
      const amounts = categories.map(([_, amount]) => amount);

      const data = {
        labels,
        datasets: [{
          data: amounts,
          backgroundColor: config.charts.colors.slice(0, categories.length),
          borderColor: '#ffffff',
          borderWidth: 2
        }]
      };

      const chartConfig = {
        type: 'pie',
        data,
        options: {
          responsive: false,
          animation: false,
          plugins: {
            title: {
              display: true,
              text: title,
              font: {
                family: config.charts.fontFamily,
                size: 16,
                weight: 'bold'
              }
            },
            legend: {
              position: 'right'
            },
            datalabels: {
              color: '#ffffff',
              font: {
                weight: 'bold',
                size: 12
              },
              formatter: (value, context) => {
                const total = amounts.reduce((sum, amount) => sum + amount, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return percentage > 5 ? `${percentage}%` : '';
              }
            }
          }
        },
        plugins: [ChartDataLabels]
      };

      const chart = new Chart(ctx, chartConfig);
      await this.waitForChartRender();

      const imageBuffer = canvas.toBuffer('image/png');
      const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;

      chart.destroy();
      chartLogger.info('Deduction chart generated', {
        width, height, categoriesCount: categories.length
      });

      return base64Image;

    } catch (error) {
      chartLogger.error('Error generating deduction chart', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate state tax comparison chart
   * @param {array} stateData - Array of state tax data
   * @param {object} options - Chart options
   * @returns {string} Base64 encoded chart image
   */
  async generateStateTaxComparisonChart(stateData, options = {}) {
    try {
      const {
        width = config.charts.defaultWidth,
        height = config.charts.defaultHeight,
        locale = 'en',
        currency = 'USD',
        title = 'State Tax Comparison'
      } = options;

      const formatter = new Formatters(locale, currency);
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      // Sort by tax amount
      const sortedData = [...stateData].sort((a, b) => (b.stateTax || 0) - (a.stateTax || 0));

      const data = {
        labels: sortedData.map(item => item.state),
        datasets: [
          {
            label: 'State Tax',
            data: sortedData.map(item => item.stateTax || 0),
            backgroundColor: '#8b5cf6',
            borderColor: '#7c3aed',
            borderWidth: 1
          },
          {
            label: 'Effective Rate',
            data: sortedData.map(item => ((item.stateTax || 0) / (item.grossIncome || 1)) * 100),
            backgroundColor: '#f59e0b',
            borderColor: '#d97706',
            borderWidth: 1,
            yAxisID: 'y1'
          }
        ]
      };

      const chartConfig = {
        type: 'bar',
        data,
        options: {
          responsive: false,
          animation: false,
          plugins: {
            title: {
              display: true,
              text: title,
              font: {
                family: config.charts.fontFamily,
                size: 16,
                weight: 'bold'
              }
            },
            legend: {
              position: 'top'
            },
            datalabels: {
              display: false
            }
          },
          scales: {
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              title: {
                display: true,
                text: 'Tax Amount'
              },
              ticks: {
                callback: (value) => formatter.formatCurrency(value, { showCents: false })
              }
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              title: {
                display: true,
                text: 'Effective Rate (%)'
              },
              ticks: {
                callback: (value) => `${value.toFixed(1)}%`
              },
              grid: {
                drawOnChartArea: false,
              }
            },
            x: {
              title: {
                display: true,
                text: 'State'
              }
            }
          }
        }
      };

      const chart = new Chart(ctx, chartConfig);
      await this.waitForChartRender();

      const imageBuffer = canvas.toBuffer('image/png');
      const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;

      chart.destroy();
      chartLogger.info('State tax comparison chart generated', {
        width, height, statesCount: sortedData.length
      });

      return base64Image;

    } catch (error) {
      chartLogger.error('Error generating state tax comparison chart', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate custom chart
   * @param {object} chartConfig - Chart.js configuration
   * @param {object} options - Generation options
   * @returns {string} Base64 encoded chart image
   */
  async generateCustomChart(chartConfig, options = {}) {
    try {
      const {
        width = config.charts.defaultWidth,
        height = config.charts.defaultHeight
      } = options;

      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      // Ensure animation is disabled for server-side rendering
      if (chartConfig.options) {
        chartConfig.options.animation = false;
        chartConfig.options.responsive = false;
      } else {
        chartConfig.options = { animation: false, responsive: false };
      }

      const chart = new Chart(ctx, chartConfig);
      await this.waitForChartRender();

      const imageBuffer = canvas.toBuffer('image/png');
      const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;

      chart.destroy();
      chartLogger.info('Custom chart generated', {
        width, height, type: chartConfig.type
      });

      return base64Image;

    } catch (error) {
      chartLogger.error('Error generating custom chart', { error: error.message });
      throw error;
    }
  }

  /**
   * Wait for chart rendering to complete
   * @param {number} timeout - Timeout in milliseconds
   */
  async waitForChartRender(timeout = 1000) {
    return new Promise(resolve => setTimeout(resolve, timeout));
  }

  /**
   * Save chart as image file
   * @param {string} base64Image - Base64 encoded image
   * @param {string} filename - Output filename
   * @returns {string} File path
   */
  async saveChart(base64Image, filename) {
    try {
      const base64Data = base64Image.replace(/^data:image\/png;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      const filepath = path.join(config.reports.reportsDir, filename);
      await fs.writeFile(filepath, imageBuffer);

      chartLogger.info('Chart saved to file', { filepath });
      return filepath;
    } catch (error) {
      chartLogger.error('Error saving chart to file', { error: error.message, filename });
      throw error;
    }
  }

  /**
   * Get chart generation statistics
   * @returns {object} Statistics
   */
  getStatistics() {
    return {
      defaultWidth: config.charts.defaultWidth,
      defaultHeight: config.charts.defaultHeight,
      supportedTypes: ['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea'],
      availableColors: config.charts.colors.length,
      fontFamily: config.charts.fontFamily
    };
  }
}

module.exports = ChartGenerator;