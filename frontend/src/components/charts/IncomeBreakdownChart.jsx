import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pie, Doughnut, Bar } from 'react-chartjs-2';
import * as d3 from 'd3';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  plugins
} from 'chart.js';
import ChartContainer from './ChartContainer';
import { useChartData } from '../../hooks/useChartData';
import './IncomeBreakdownChart.css';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const IncomeBreakdownChart = ({
  grossIncome = 100000,
  federalTax = 18000,
  stateTax = 5000,
  socialSecurity = 6200,
  medicare = 1450,
  deductions = 12950,
  chartType = 'pie', // 'pie', 'doughnut', 'waterfall', 'bar'
  className = '',
  height = 400,
  animated = true,
  showPercentages = true,
  showValues = true
}) => {
  const waterfallRef = useRef(null);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [chartMode, setChartMode] = useState(chartType);

  const { data, loading, error, updateData, formatCurrency, formatPercentage, isMobile } = useChartData();

  useEffect(() => {
    updateData({
      grossIncome,
      federalTax,
      stateTax,
      socialSecurity,
      medicare,
      deductions
    }, 'incomeBreakdown');
  }, [grossIncome, federalTax, stateTax, socialSecurity, medicare, deductions, updateData]);

  // Chart.js configuration
  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: isMobile ? 'bottom' : 'right',
        labels: {
          padding: 20,
          usePointStyle: true,
          font: {
            size: isMobile ? 11 : 12
          },
          generateLabels: (chart) => {
            const data = chart.data;
            if (data.labels.length && data.datasets.length) {
              return data.labels.map((label, i) => {
                const dataset = data.datasets[0];
                const value = dataset.data[i];
                const total = dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);

                return {
                  text: showPercentages ? `${label} (${percentage}%)` : label,
                  fillStyle: dataset.backgroundColor[i],
                  strokeStyle: dataset.borderColor[i],
                  lineWidth: 2,
                  hidden: false,
                  index: i
                };
              });
            }
            return [];
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
            const label = context.label || '';
            const value = context.raw;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);

            return [
              `${label}: ${formatCurrency(value)}`,
              `Percentage: ${percentage}%`
            ];
          }
        }
      }
    },
    animation: animated ? {
      animateRotate: true,
      animateScale: true,
      duration: 1500,
      easing: 'easeInOutQuart'
    } : false,
    onHover: (event, elements) => {
      if (elements.length > 0) {
        const index = elements[0].index;
        setSelectedSegment(data?.pieData[index] || null);
      } else {
        setSelectedSegment(null);
      }
    }
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
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
            const value = context.raw;
            const percentage = ((Math.abs(value) / grossIncome) * 100).toFixed(1);
            return [
              `${context.label}: ${formatCurrency(Math.abs(value))}`,
              `Percentage of Gross: ${percentage}%`
            ];
          }
        }
      }
    },
    scales: {
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
    },
    animation: animated ? {
      duration: 1500,
      easing: 'easeInOutQuart'
    } : false
  };

  // Waterfall chart with D3
  useEffect(() => {
    if (chartMode !== 'waterfall' || !data?.waterfallData || !waterfallRef.current) return;

    const svg = d3.select(waterfallRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 60, bottom: 60, left: 80 };
    const containerWidth = waterfallRef.current.clientWidth;
    const width = containerWidth - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const waterfallData = data.waterfallData;
    const maxValue = d3.max(waterfallData, d => Math.max(d.value, d.cumulative));
    const minValue = d3.min(waterfallData, d => Math.min(0, d.cumulative + d.value));

    // Scales
    const xScale = d3.scaleBand()
      .domain(waterfallData.map(d => d.label))
      .range([0, width])
      .padding(0.3);

    const yScale = d3.scaleLinear()
      .domain([minValue * 1.1, maxValue * 1.1])
      .range([chartHeight, 0]);

    // Axes
    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .style('font-size', isMobile ? '10px' : '12px')
      .attr('transform', isMobile ? 'rotate(-45)' : null)
      .style('text-anchor', isMobile ? 'end' : 'middle');

    g.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(yScale).tickFormat(d => formatCurrency(d)))
      .selectAll('text')
      .style('font-size', isMobile ? '10px' : '12px');

    // Zero line
    g.append('line')
      .attr('class', 'zero-line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', yScale(0))
      .attr('y2', yScale(0))
      .attr('stroke', '#6b7280')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3');

    // Bars
    const bars = g.selectAll('.waterfall-bar')
      .data(waterfallData)
      .enter()
      .append('g')
      .attr('class', 'waterfall-bar');

    bars.append('rect')
      .attr('x', d => xScale(d.label))
      .attr('width', xScale.bandwidth())
      .attr('y', d => {
        if (d.type === 'total') return yScale(d.cumulative);
        if (d.value >= 0) return yScale(d.cumulative);
        return yScale(d.cumulative - d.value);
      })
      .attr('height', 0)
      .attr('fill', d => {
        if (d.type === 'total') return '#8b5cf6';
        return d.value >= 0 ? '#10b981' : '#ef4444';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('rx', 4);

    if (animated) {
      bars.selectAll('rect')
        .transition()
        .duration(1200)
        .delay((d, i) => i * 150)
        .attr('height', d => Math.abs(yScale(d.cumulative) - yScale(d.cumulative - d.value)));
    } else {
      bars.selectAll('rect')
        .attr('height', d => Math.abs(yScale(d.cumulative) - yScale(d.cumulative - d.value)));
    }

    // Connecting lines
    const connections = g.selectAll('.connection-line')
      .data(waterfallData.slice(0, -1))
      .enter()
      .append('line')
      .attr('class', 'connection-line')
      .attr('x1', d => xScale(d.label) + xScale.bandwidth())
      .attr('x2', (d, i) => xScale(waterfallData[i + 1].label))
      .attr('y1', d => yScale(d.cumulative))
      .attr('y2', (d, i) => yScale(waterfallData[i + 1].cumulative - waterfallData[i + 1].value))
      .attr('stroke', '#9ca3af')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5')
      .attr('opacity', 0);

    if (animated) {
      connections.transition()
        .duration(800)
        .delay(1400)
        .attr('opacity', 0.7);
    } else {
      connections.attr('opacity', 0.7);
    }

    // Value labels
    bars.append('text')
      .attr('class', 'value-label')
      .attr('x', d => xScale(d.label) + xScale.bandwidth() / 2)
      .attr('y', d => {
        const barTop = d.type === 'total' ? yScale(d.cumulative) :
                     d.value >= 0 ? yScale(d.cumulative) : yScale(d.cumulative - d.value);
        return barTop - 8;
      })
      .attr('text-anchor', 'middle')
      .attr('font-size', isMobile ? '10px' : '12px')
      .attr('font-weight', '600')
      .attr('fill', '#374151')
      .text(d => formatCurrency(Math.abs(d.value)))
      .attr('opacity', animated ? 0 : 1);

    if (animated) {
      bars.selectAll('.value-label')
        .transition()
        .duration(600)
        .delay(1600)
        .attr('opacity', 1);
    }

  }, [data, chartMode, height, animated, isMobile, formatCurrency]);

  const getChartData = () => {
    if (!data) return null;

    if (chartMode === 'pie' || chartMode === 'doughnut') {
      return {
        labels: data.pieData.map(item => item.label),
        datasets: [{
          data: data.pieData.map(item => item.value),
          backgroundColor: data.pieData.map(item => item.color),
          borderColor: data.pieData.map(item => item.color),
          borderWidth: 2,
          hoverOffset: 4
        }]
      };
    }

    if (chartMode === 'bar') {
      return {
        labels: ['Gross Income', 'Net Income', 'Total Taxes'],
        datasets: [{
          data: [data.barData.gross, data.barData.net, data.barData.taxes],
          backgroundColor: ['#10b981', '#06b6d4', '#ef4444'],
          borderColor: ['#059669', '#0891b2', '#dc2626'],
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false
        }]
      };
    }

    return null;
  };

  const chartData = getChartData();

  return (
    <ChartContainer
      title="Income Breakdown Analysis"
      subtitle={`${formatCurrency(grossIncome)} gross income breakdown`}
      className={`income-breakdown-chart ${className}`}
      loading={loading}
      error={error}
      data={data}
      minHeight={height + 150}
      tools={[
        {
          icon: '🥧',
          tooltip: 'Pie Chart',
          onClick: () => setChartMode('pie'),
          className: chartMode === 'pie' ? 'active' : ''
        },
        {
          icon: '🍩',
          tooltip: 'Doughnut Chart',
          onClick: () => setChartMode('doughnut'),
          className: chartMode === 'doughnut' ? 'active' : ''
        },
        {
          icon: '📊',
          tooltip: 'Bar Chart',
          onClick: () => setChartMode('bar'),
          className: chartMode === 'bar' ? 'active' : ''
        },
        {
          icon: '📈',
          tooltip: 'Waterfall Chart',
          onClick: () => setChartMode('waterfall'),
          className: chartMode === 'waterfall' ? 'active' : ''
        }
      ]}
      accessibility={{
        ariaLabel: `Income breakdown chart showing distribution of ${formatCurrency(grossIncome)} gross income`,
        includeTable: true,
        tableHeaders: ['Category', 'Amount', 'Percentage'],
        tableData: data?.pieData.map(item => [
          item.label,
          formatCurrency(item.value),
          formatPercentage(item.percentage / 100)
        ]) || []
      }}
    >
      <div className="income-breakdown-content">
        <div className="chart-display">
          {chartMode === 'waterfall' ? (
            <div className="waterfall-container">
              <svg
                ref={waterfallRef}
                width="100%"
                height={height}
                className="waterfall-svg"
                role="img"
                aria-label="Waterfall chart showing income flow"
              />
            </div>
          ) : (
            <div className="chartjs-container" style={{ height: height }}>
              {chartMode === 'pie' && chartData && (
                <Pie
                  data={chartData}
                  options={pieChartOptions}
                  plugins={[{
                    id: 'centerText',
                    beforeDraw: (chart) => {
                      if (chartMode === 'doughnut') {
                        const { ctx, chartArea: { top, bottom, left, right } } = chart;
                        const centerX = (left + right) / 2;
                        const centerY = (top + bottom) / 2;

                        ctx.save();
                        ctx.font = 'bold 16px Arial';
                        ctx.fillStyle = '#374151';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText('Net Income', centerX, centerY - 10);

                        ctx.font = '14px Arial';
                        ctx.fillText(formatCurrency(data?.barData?.net || 0), centerX, centerY + 10);
                        ctx.restore();
                      }
                    }
                  }]}
                />
              )}

              {chartMode === 'doughnut' && chartData && (
                <Doughnut
                  data={chartData}
                  options={pieChartOptions}
                  plugins={[{
                    id: 'centerText',
                    beforeDraw: (chart) => {
                      const { ctx, chartArea: { top, bottom, left, right } } = chart;
                      const centerX = (left + right) / 2;
                      const centerY = (top + bottom) / 2;

                      ctx.save();
                      ctx.font = 'bold 16px Arial';
                      ctx.fillStyle = '#374151';
                      ctx.textAlign = 'center';
                      ctx.textBaseline = 'middle';
                      ctx.fillText('Net Income', centerX, centerY - 10);

                      ctx.font = '14px Arial';
                      ctx.fillText(formatCurrency(data?.barData?.net || 0), centerX, centerY + 10);
                      ctx.restore();
                    }
                  }]}
                />
              )}

              {chartMode === 'bar' && chartData && (
                <Bar data={chartData} options={barChartOptions} />
              )}
            </div>
          )}
        </div>

        {data && (
          <motion.div
            className="breakdown-summary"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: animated ? 1.8 : 0, duration: 0.6 }}
          >
            <div className="summary-header">
              <h4>Income Analysis</h4>
              <div className="effective-rate">
                Effective Tax Rate: <span>{formatPercentage(data.barData.effectiveRate / 100)}</span>
              </div>
            </div>

            <div className="breakdown-grid">
              {data.pieData.map((item, index) => (
                <motion.div
                  key={item.label}
                  className={`breakdown-item ${selectedSegment?.label === item.label ? 'highlighted' : ''}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: (index * 0.1) + (animated ? 2 : 0) }}
                >
                  <div className="item-indicator" style={{ backgroundColor: item.color }}></div>
                  <div className="item-details">
                    <div className="item-label">{item.label}</div>
                    <div className="item-value">{formatCurrency(item.value)}</div>
                    <div className="item-percentage">{formatPercentage(item.percentage / 100)}</div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="key-metrics">
              <div className="metric">
                <span className="metric-label">Gross Income:</span>
                <span className="metric-value">{formatCurrency(grossIncome)}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Total Deductions:</span>
                <span className="metric-value">{formatCurrency(data.barData.taxes)}</span>
              </div>
              <div className="metric highlight">
                <span className="metric-label">Take-Home Pay:</span>
                <span className="metric-value">{formatCurrency(data.barData.net)}</span>
              </div>
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {selectedSegment && (
            <motion.div
              className="segment-details-popup"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="popup-header">
                <div
                  className="popup-indicator"
                  style={{ backgroundColor: selectedSegment.color }}
                ></div>
                <h5>{selectedSegment.label}</h5>
                <button
                  onClick={() => setSelectedSegment(null)}
                  className="popup-close"
                  aria-label="Close details"
                >
                  ×
                </button>
              </div>

              <div className="popup-content">
                <div className="popup-metric">
                  <span>Amount:</span>
                  <strong>{formatCurrency(selectedSegment.value)}</strong>
                </div>
                <div className="popup-metric">
                  <span>Percentage of Gross:</span>
                  <strong>{formatPercentage(selectedSegment.percentage / 100)}</strong>
                </div>
                <div className="popup-metric">
                  <span>Monthly Amount:</span>
                  <strong>{formatCurrency(selectedSegment.value / 12)}</strong>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ChartContainer>
  );
};

export default IncomeBreakdownChart;