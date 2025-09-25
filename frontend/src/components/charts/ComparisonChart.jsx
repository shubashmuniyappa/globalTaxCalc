import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Line, Bar, Radar } from 'react-chartjs-2';
import * as d3 from 'd3';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import ChartContainer from './ChartContainer';
import { useChartData } from '../../hooks/useChartData';
import './ComparisonChart.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

const ComparisonChart = ({
  comparisonType = 'states', // 'states', 'scenarios', 'trends'
  data: externalData = null,
  userIncome = 75000,
  className = '',
  height = 450,
  animated = true,
  showRankings = true,
  interactive = true
}) => {
  const customRef = useRef(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [chartType, setChartType] = useState('bar'); // 'bar', 'line', 'radar', 'custom'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc', 'desc'

  const { data, loading, error, updateData, formatCurrency, formatPercentage, isMobile } = useChartData();

  useEffect(() => {
    if (externalData) {
      updateData({ [comparisonType]: externalData }, 'comparison');
    } else {
      // Generate sample data for demonstration
      generateSampleData();
    }
  }, [externalData, comparisonType, userIncome, updateData]);

  const generateSampleData = () => {
    let sampleData = {};

    if (comparisonType === 'states') {
      sampleData.states = [
        { name: 'Wyoming', totalTax: userIncome * 0.16, stateTax: 0, federalTax: userIncome * 0.16, cost: 'Low' },
        { name: 'Nevada', totalTax: userIncome * 0.17, stateTax: 0, federalTax: userIncome * 0.17, cost: 'Medium' },
        { name: 'Florida', totalTax: userIncome * 0.18, stateTax: 0, federalTax: userIncome * 0.18, cost: 'Medium' },
        { name: 'Texas', totalTax: userIncome * 0.19, stateTax: 0, federalTax: userIncome * 0.19, cost: 'Low' },
        { name: 'Colorado', totalTax: userIncome * 0.22, stateTax: userIncome * 0.05, federalTax: userIncome * 0.17, cost: 'High' },
        { name: 'Georgia', totalTax: userIncome * 0.24, stateTax: userIncome * 0.06, federalTax: userIncome * 0.18, cost: 'Medium' },
        { name: 'North Carolina', totalTax: userIncome * 0.25, stateTax: userIncome * 0.07, federalTax: userIncome * 0.18, cost: 'Low' },
        { name: 'Virginia', totalTax: userIncome * 0.27, stateTax: userIncome * 0.09, federalTax: userIncome * 0.18, cost: 'Medium' },
        { name: 'New York', totalTax: userIncome * 0.32, stateTax: userIncome * 0.14, federalTax: userIncome * 0.18, cost: 'Very High' },
        { name: 'California', totalTax: userIncome * 0.35, stateTax: userIncome * 0.17, federalTax: userIncome * 0.18, cost: 'Very High' }
      ];
    } else if (comparisonType === 'scenarios') {
      sampleData.scenarios = [
        { name: 'Current Situation', totalTax: userIncome * 0.24, description: 'No optimization' },
        { name: 'With 401k Max', totalTax: userIncome * 0.20, description: 'Maximize 401k contribution', savings: userIncome * 0.04 },
        { name: 'HSA + 401k', totalTax: userIncome * 0.18, description: 'HSA and 401k optimization', savings: userIncome * 0.06 },
        { name: 'Full Optimization', totalTax: userIncome * 0.15, description: 'All deductions optimized', savings: userIncome * 0.09 }
      ];
    } else if (comparisonType === 'trends') {
      sampleData.years = Array.from({ length: 10 }, (_, i) => ({
        year: 2014 + i,
        totalTax: userIncome * (0.22 + Math.random() * 0.06 - 0.03),
        effectiveRate: (0.22 + Math.random() * 0.06 - 0.03) * 100
      }));
    }

    updateData(sampleData, 'comparison');
  };

  const getChartData = () => {
    if (!data || !data.data) return null;

    const items = data.data;
    const sortedItems = [...items].sort((a, b) => {
      const aValue = a.totalTax || a.value || 0;
      const bValue = b.totalTax || b.value || 0;
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });

    const labels = sortedItems.map(item => item.name || item.year);
    const values = sortedItems.map(item => item.totalTax || item.value || 0);
    const colors = generateColors(values.length);

    if (chartType === 'radar' && comparisonType === 'states') {
      // Special radar chart for states comparison
      const metrics = ['Total Tax', 'State Tax', 'Cost of Living', 'Business Climate', 'Quality of Life'];
      return {
        labels: metrics,
        datasets: sortedItems.slice(0, 5).map((state, index) => ({
          label: state.name,
          data: [
            100 - (state.totalTax / userIncome) * 100, // Lower tax = higher score
            100 - (state.stateTax / userIncome) * 100,
            state.cost === 'Low' ? 90 : state.cost === 'Medium' ? 70 : state.cost === 'High' ? 50 : 30,
            Math.random() * 30 + 60, // Random business climate score
            Math.random() * 20 + 70   // Random quality of life score
          ],
          backgroundColor: `rgba(${colors[index]}, 0.2)`,
          borderColor: `rgb(${colors[index]})`,
          borderWidth: 2,
          pointBackgroundColor: `rgb(${colors[index]})`,
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: `rgb(${colors[index]})`
        }))
      };
    }

    return {
      labels,
      datasets: [{
        label: comparisonType === 'states' ? 'Total Tax Burden' :
               comparisonType === 'scenarios' ? 'Tax Amount' : 'Tax Trend',
        data: values,
        backgroundColor: colors.map(color => `rgba(${color}, 0.7)`),
        borderColor: colors.map(color => `rgb(${color})`),
        borderWidth: 2,
        borderRadius: chartType === 'bar' ? 6 : 0,
        tension: chartType === 'line' ? 0.4 : 0,
        fill: chartType === 'line' ? false : undefined,
        pointRadius: chartType === 'line' ? 6 : undefined,
        pointHoverRadius: chartType === 'line' ? 8 : undefined
      }]
    };
  };

  const generateColors = (count) => {
    const baseColors = [
      '59, 130, 246',   // blue
      '16, 185, 129',   // emerald
      '245, 158, 11',   // amber
      '239, 68, 68',    // red
      '139, 92, 246',   // violet
      '6, 182, 212',    // cyan
      '34, 197, 94',    // green
      '251, 146, 60',   // orange
      '168, 85, 247',   // purple
      '20, 184, 166'    // teal
    ];

    return Array.from({ length: count }, (_, i) => baseColors[i % baseColors.length]);
  };

  const getChartOptions = () => {
    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: isMobile ? 'bottom' : 'top',
          labels: {
            padding: 20,
            usePointStyle: true,
            font: {
              size: isMobile ? 11 : 12
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          titleColor: '#f9fafb',
          bodyColor: '#f9fafb',
          borderColor: '#374151',
          borderWidth: 1,
          cornerRadius: 8,
          callbacks: {
            label: (context) => {
              const item = data.data[context.dataIndex];
              const value = context.raw;

              let lines = [`Total Tax: ${formatCurrency(value)}`];

              if (comparisonType === 'states') {
                lines.push(`Effective Rate: ${formatPercentage(value / userIncome)}`);
                if (item.stateTax) lines.push(`State Tax: ${formatCurrency(item.stateTax)}`);
                lines.push(`Cost of Living: ${item.cost}`);
                if (item.rank) lines.push(`Rank: #${item.rank}`);
              } else if (comparisonType === 'scenarios') {
                lines.push(`Description: ${item.description}`);
                if (item.savings) lines.push(`Savings: ${formatCurrency(item.savings)}`);
              } else if (comparisonType === 'trends') {
                lines.push(`Year: ${item.year}`);
                lines.push(`Effective Rate: ${formatPercentage(value / userIncome)}`);
              }

              return lines;
            }
          }
        }
      },
      animation: animated ? {
        duration: 1500,
        easing: 'easeInOutQuart'
      } : false,
      onClick: interactive ? (event, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          setSelectedItem(data.data[index]);
        }
      } : undefined
    };

    if (chartType === 'bar') {
      baseOptions.scales = {
        x: {
          grid: {
            display: false
          },
          ticks: {
            maxRotation: isMobile ? 45 : 0,
            font: {
              size: isMobile ? 10 : 12
            }
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(156, 163, 175, 0.1)'
          },
          ticks: {
            callback: (value) => formatCurrency(value),
            font: {
              size: isMobile ? 10 : 12
            }
          }
        }
      };
    } else if (chartType === 'line') {
      baseOptions.scales = {
        x: {
          grid: {
            color: 'rgba(156, 163, 175, 0.1)'
          },
          ticks: {
            font: {
              size: isMobile ? 10 : 12
            }
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(156, 163, 175, 0.1)'
          },
          ticks: {
            callback: (value) => formatCurrency(value),
            font: {
              size: isMobile ? 10 : 12
            }
          }
        }
      };
    } else if (chartType === 'radar') {
      baseOptions.scales = {
        r: {
          angleLines: {
            color: 'rgba(156, 163, 175, 0.2)'
          },
          grid: {
            color: 'rgba(156, 163, 175, 0.2)'
          },
          pointLabels: {
            font: {
              size: isMobile ? 10 : 12
            }
          },
          ticks: {
            display: false
          },
          suggestedMin: 0,
          suggestedMax: 100
        }
      };
    }

    return baseOptions;
  };

  const chartData = getChartData();
  const chartOptions = getChartOptions();

  const getChartTitle = () => {
    switch (comparisonType) {
      case 'states':
        return 'State Tax Comparison';
      case 'scenarios':
        return 'Tax Optimization Scenarios';
      case 'trends':
        return 'Historical Tax Trends';
      default:
        return 'Tax Comparison';
    }
  };

  const getChartSubtitle = () => {
    return `${formatCurrency(userIncome)} annual income comparison`;
  };

  return (
    <ChartContainer
      title={getChartTitle()}
      subtitle={getChartSubtitle()}
      className={`comparison-chart ${className}`}
      loading={loading}
      error={error}
      data={data}
      minHeight={height + 150}
      tools={[
        {
          icon: '📊',
          tooltip: 'Bar Chart',
          onClick: () => setChartType('bar'),
          className: chartType === 'bar' ? 'active' : ''
        },
        {
          icon: '📈',
          tooltip: 'Line Chart',
          onClick: () => setChartType('line'),
          className: chartType === 'line' ? 'active' : ''
        },
        {
          icon: '🎯',
          tooltip: 'Radar Chart',
          onClick: () => setChartType('radar'),
          className: chartType === 'radar' ? 'active' : '',
          disabled: comparisonType !== 'states'
        },
        {
          icon: sortOrder === 'asc' ? '⬆️' : '⬇️',
          tooltip: `Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`,
          onClick: () => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        }
      ]}
      accessibility={{
        ariaLabel: `${getChartTitle()} showing comparison data`,
        includeTable: true,
        tableHeaders: comparisonType === 'states'
          ? ['State', 'Total Tax', 'State Tax', 'Federal Tax', 'Cost of Living']
          : comparisonType === 'scenarios'
          ? ['Scenario', 'Tax Amount', 'Savings', 'Description']
          : ['Year', 'Tax Amount', 'Effective Rate'],
        tableData: data?.data?.map(item => {
          if (comparisonType === 'states') {
            return [
              item.name,
              formatCurrency(item.totalTax),
              formatCurrency(item.stateTax || 0),
              formatCurrency(item.federalTax),
              item.cost
            ];
          } else if (comparisonType === 'scenarios') {
            return [
              item.name,
              formatCurrency(item.totalTax),
              formatCurrency(item.savings || 0),
              item.description
            ];
          } else {
            return [
              item.year,
              formatCurrency(item.totalTax),
              formatPercentage(item.effectiveRate / 100)
            ];
          }
        }) || []
      }}
    >
      <div className="comparison-chart-content">
        <div className="chart-display">
          {chartData && (
            <div className="chart-container" style={{ height: height }}>
              {chartType === 'bar' && (
                <Bar data={chartData} options={chartOptions} />
              )}
              {chartType === 'line' && (
                <Line data={chartData} options={chartOptions} />
              )}
              {chartType === 'radar' && (
                <Radar data={chartData} options={chartOptions} />
              )}
            </div>
          )}
        </div>

        {data && showRankings && (
          <motion.div
            className="comparison-rankings"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: animated ? 1.8 : 0, duration: 0.6 }}
          >
            <div className="rankings-header">
              <h4>
                {comparisonType === 'states' ? 'State Rankings' :
                 comparisonType === 'scenarios' ? 'Optimization Impact' :
                 'Historical Analysis'}
              </h4>
            </div>

            <div className="rankings-grid">
              {data.data.slice(0, 6).map((item, index) => (
                <motion.div
                  key={item.name || item.year}
                  className={`ranking-card ${selectedItem?.name === item.name ? 'selected' : ''}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: (index * 0.1) + (animated ? 2 : 0) }}
                  onClick={() => setSelectedItem(selectedItem?.name === item.name ? null : item)}
                >
                  <div className="ranking-position">
                    {index + 1}
                  </div>

                  <div className="ranking-details">
                    <div className="ranking-name">
                      {item.name || `Year ${item.year}`}
                    </div>

                    <div className="ranking-value">
                      {formatCurrency(item.totalTax || item.value || 0)}
                    </div>

                    {comparisonType === 'states' && (
                      <div className="ranking-meta">
                        <span>State: {formatCurrency(item.stateTax || 0)}</span>
                        <span>Cost: {item.cost}</span>
                      </div>
                    )}

                    {comparisonType === 'scenarios' && item.savings && (
                      <div className="ranking-meta savings">
                        Saves: {formatCurrency(item.savings)}
                      </div>
                    )}

                    {comparisonType === 'trends' && (
                      <div className="ranking-meta">
                        Rate: {formatPercentage((item.totalTax || item.value || 0) / userIncome)}
                      </div>
                    )}
                  </div>

                  <div className="ranking-indicator">
                    {comparisonType === 'scenarios' && item.savings ? '💰' :
                     comparisonType === 'states' && item.stateTax === 0 ? '🆓' :
                     '📊'}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {selectedItem && (
            <motion.div
              className="comparison-details-modal"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
            >
              <div className="modal-header">
                <h3>{selectedItem.name}</h3>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="modal-close"
                  aria-label="Close details"
                >
                  ×
                </button>
              </div>

              <div className="modal-content">
                <div className="detail-metric">
                  <label>Total Tax:</label>
                  <span className="highlight">{formatCurrency(selectedItem.totalTax || selectedItem.value || 0)}</span>
                </div>

                <div className="detail-metric">
                  <label>Effective Rate:</label>
                  <span>{formatPercentage((selectedItem.totalTax || selectedItem.value || 0) / userIncome)}</span>
                </div>

                {comparisonType === 'states' && (
                  <>
                    {selectedItem.stateTax > 0 && (
                      <div className="detail-metric">
                        <label>State Tax:</label>
                        <span>{formatCurrency(selectedItem.stateTax)}</span>
                      </div>
                    )}

                    <div className="detail-metric">
                      <label>Federal Tax:</label>
                      <span>{formatCurrency(selectedItem.federalTax)}</span>
                    </div>

                    <div className="detail-metric">
                      <label>Cost of Living:</label>
                      <span className={`cost-${selectedItem.cost?.toLowerCase()}`}>
                        {selectedItem.cost}
                      </span>
                    </div>
                  </>
                )}

                {comparisonType === 'scenarios' && (
                  <>
                    <div className="detail-metric">
                      <label>Description:</label>
                      <span>{selectedItem.description}</span>
                    </div>

                    {selectedItem.savings && (
                      <div className="detail-metric">
                        <label>Annual Savings:</label>
                        <span className="savings">{formatCurrency(selectedItem.savings)}</span>
                      </div>
                    )}
                  </>
                )}

                {comparisonType === 'trends' && (
                  <>
                    <div className="detail-metric">
                      <label>Year:</label>
                      <span>{selectedItem.year}</span>
                    </div>

                    {selectedItem.change && (
                      <div className="detail-metric">
                        <label>Change from Previous:</label>
                        <span className={selectedItem.change >= 0 ? 'increase' : 'decrease'}>
                          {selectedItem.change >= 0 ? '+' : ''}{formatCurrency(selectedItem.change)}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ChartContainer>
  );
};

export default ComparisonChart;