import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as d3 from 'd3';
import ChartContainer from './ChartContainer';
import { useChartData } from '../../hooks/useChartData';
import './TaxBracketChart.css';

const TaxBracketChart = ({
  income = 75000,
  filingStatus = 'single',
  country = 'US',
  year = 2023,
  className = '',
  height = 400,
  interactive = true,
  showTooltip = true,
  animated = true
}) => {
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const [selectedBracket, setSelectedBracket] = useState(null);
  const [hoveredBracket, setHoveredBracket] = useState(null);

  const { data, loading, error, updateData, formatCurrency, formatPercentage, isMobile } = useChartData();

  useEffect(() => {
    updateData({ income, filingStatus, country, year }, 'taxBrackets');
  }, [income, filingStatus, country, year, updateData]);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 60, bottom: 60, left: 80 };
    const containerWidth = svgRef.current.clientWidth;
    const width = containerWidth - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleLinear()
      .domain([0, Math.max(data.userIncome * 1.2, d3.max(data.brackets, d => d.max === Infinity ? data.userIncome * 1.5 : d.max))])
      .range([0, width]);

    const yScale = d3.scaleBand()
      .domain(data.brackets.map((_, i) => i))
      .range([0, chartHeight])
      .padding(0.1);

    const colorScale = d3.scaleOrdinal()
      .domain(data.brackets.map((_, i) => i))
      .range(data.brackets.map(b => b.color));

    // Axes
    const xAxis = g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${chartHeight})`);

    xAxis.call(d3.axisBottom(xScale)
      .tickFormat(d => formatCurrency(d))
      .ticks(isMobile ? 4 : 6));

    const yAxis = g.append('g')
      .attr('class', 'y-axis');

    yAxis.call(d3.axisLeft(yScale)
      .tickFormat(i => `${formatPercentage(data.brackets[i].rate)} Bracket`));

    // Bracket bars
    const brackets = g.selectAll('.bracket-bar')
      .data(data.brackets)
      .enter()
      .append('g')
      .attr('class', 'bracket-group')
      .attr('transform', (d, i) => `translate(0,${yScale(i)})`);

    // Background bars (full bracket ranges)
    const backgroundBars = brackets.append('rect')
      .attr('class', 'bracket-background')
      .attr('x', d => xScale(d.min))
      .attr('y', 0)
      .attr('width', d => d.max === Infinity ? xScale(data.userIncome * 1.5) - xScale(d.min) : xScale(d.max) - xScale(d.min))
      .attr('height', yScale.bandwidth())
      .attr('fill', d => d.color)
      .attr('opacity', 0.2)
      .attr('stroke', d => d.color)
      .attr('stroke-width', 1);

    // Income bars (actual taxable income in each bracket)
    const incomeBars = brackets.append('rect')
      .attr('class', 'bracket-income')
      .attr('x', d => xScale(d.min))
      .attr('y', yScale.bandwidth() * 0.2)
      .attr('width', 0)
      .attr('height', yScale.bandwidth() * 0.6)
      .attr('fill', d => d.color)
      .attr('opacity', 0.8)
      .attr('rx', 4);

    if (animated) {
      incomeBars.transition()
        .duration(1500)
        .delay((d, i) => i * 200)
        .attr('width', d => d.taxableIncome > 0 ? xScale(d.taxableIncome) : 0);
    } else {
      incomeBars.attr('width', d => d.taxableIncome > 0 ? xScale(d.taxableIncome) : 0);
    }

    // User income line
    const userIncomeLine = g.append('line')
      .attr('class', 'user-income-line')
      .attr('x1', xScale(data.userIncome))
      .attr('x2', xScale(data.userIncome))
      .attr('y1', -10)
      .attr('y2', chartHeight + 10)
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 3)
      .attr('stroke-dasharray', '5,5')
      .attr('opacity', animated ? 0 : 1);

    if (animated) {
      userIncomeLine.transition()
        .duration(1000)
        .delay(800)
        .attr('opacity', 1);
    }

    // User income label
    const incomeLabel = g.append('g')
      .attr('class', 'income-label')
      .attr('transform', `translate(${xScale(data.userIncome)}, -15)`);

    incomeLabel.append('rect')
      .attr('x', -40)
      .attr('y', -20)
      .attr('width', 80)
      .attr('height', 25)
      .attr('fill', '#ef4444')
      .attr('rx', 4)
      .attr('opacity', animated ? 0 : 1);

    incomeLabel.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', -5)
      .attr('fill', 'white')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .text(formatCurrency(data.userIncome))
      .attr('opacity', animated ? 0 : 1);

    if (animated) {
      incomeLabel.selectAll('*').transition()
        .duration(800)
        .delay(1200)
        .attr('opacity', 1);
    }

    // Interactive features
    if (interactive) {
      brackets.append('rect')
        .attr('class', 'bracket-overlay')
        .attr('x', d => xScale(d.min))
        .attr('y', 0)
        .attr('width', d => d.max === Infinity ? xScale(data.userIncome * 1.5) - xScale(d.min) : xScale(d.max) - xScale(d.min))
        .attr('height', yScale.bandwidth())
        .attr('fill', 'transparent')
        .style('cursor', 'pointer')
        .on('mouseenter', function(event, d) {
          if (!isMobile) {
            setHoveredBracket(d);
            showTooltipHandler(event, d);
          }

          d3.select(this.parentNode).select('.bracket-income')
            .transition()
            .duration(200)
            .attr('opacity', 1)
            .attr('stroke', d.color)
            .attr('stroke-width', 2);
        })
        .on('mousemove', function(event, d) {
          if (!isMobile && showTooltip) {
            showTooltipHandler(event, d);
          }
        })
        .on('mouseleave', function(event, d) {
          if (!isMobile) {
            setHoveredBracket(null);
            hideTooltip();
          }

          d3.select(this.parentNode).select('.bracket-income')
            .transition()
            .duration(200)
            .attr('opacity', 0.8)
            .attr('stroke', 'none');
        })
        .on('click', function(event, d) {
          setSelectedBracket(selectedBracket?.index === d.index ? null : d);
        });
    }

    // Tooltip functionality
    const showTooltipHandler = (event, d) => {
      if (!tooltipRef.current) return;

      const tooltip = d3.select(tooltipRef.current);
      const [x, y] = d3.pointer(event, svgRef.current);

      tooltip
        .style('opacity', 1)
        .style('left', `${x + 15}px`)
        .style('top', `${y - 10}px`)
        .html(`
          <div class="tooltip-header">
            <strong>${formatPercentage(d.rate)} Tax Bracket</strong>
          </div>
          <div class="tooltip-content">
            <div class="tooltip-row">
              <span>Range:</span>
              <span>${formatCurrency(d.min)} - ${d.max === Infinity ? '∞' : formatCurrency(d.max)}</span>
            </div>
            <div class="tooltip-row">
              <span>Your Taxable Income:</span>
              <span>${formatCurrency(d.taxableIncome)}</span>
            </div>
            <div class="tooltip-row">
              <span>Tax on This Bracket:</span>
              <span>${formatCurrency(d.tax)}</span>
            </div>
            <div class="tooltip-row">
              <span>Cumulative Tax:</span>
              <span>${formatCurrency(d.cumulativeTax)}</span>
            </div>
            ${d.isUserBracket ? '<div class="tooltip-highlight">Your Current Bracket</div>' : ''}
          </div>
        `);
    };

    const hideTooltip = () => {
      if (tooltipRef.current) {
        d3.select(tooltipRef.current).style('opacity', 0);
      }
    };

    // Legend
    const legend = g.append('g')
      .attr('class', 'chart-legend')
      .attr('transform', `translate(${width - 150}, 20)`);

    const legendItems = legend.selectAll('.legend-item')
      .data([
        { label: 'Bracket Range', color: data.brackets[0]?.color || '#ccc', opacity: 0.2 },
        { label: 'Your Taxable Income', color: data.brackets[0]?.color || '#ccc', opacity: 0.8 },
        { label: 'Your Income Level', color: '#ef4444', opacity: 1, dashed: true }
      ])
      .enter()
      .append('g')
      .attr('class', 'legend-item')
      .attr('transform', (d, i) => `translate(0, ${i * 25})`);

    legendItems.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 15)
      .attr('height', 15)
      .attr('fill', d => d.color)
      .attr('opacity', d => d.opacity)
      .attr('stroke-dasharray', d => d.dashed ? '3,3' : 'none');

    legendItems.append('text')
      .attr('x', 20)
      .attr('y', 12)
      .attr('font-size', '12px')
      .attr('fill', '#374151')
      .text(d => d.label);

  }, [data, height, interactive, showTooltip, animated, isMobile, formatCurrency, formatPercentage]);

  const summaryData = data ? {
    marginalRate: data.marginalRate,
    effectiveRate: data.effectiveRate,
    totalTax: data.totalTax,
    afterTaxIncome: data.userIncome - data.totalTax,
    userBracket: data.userBracket
  } : null;

  return (
    <ChartContainer
      title="Tax Bracket Visualization"
      subtitle={`${filingStatus} filer - ${formatCurrency(income)} income`}
      className={`tax-bracket-chart ${className}`}
      loading={loading}
      error={error}
      data={data}
      minHeight={height + 100}
      accessibility={{
        ariaLabel: `Tax bracket chart showing ${filingStatus} filer with ${formatCurrency(income)} income`,
        includeTable: true,
        tableHeaders: ['Tax Bracket', 'Rate', 'Range', 'Taxable Income', 'Tax Amount'],
        tableData: data?.brackets.map(bracket => [
          `${formatPercentage(bracket.rate)} Bracket`,
          formatPercentage(bracket.rate),
          `${formatCurrency(bracket.min)} - ${bracket.max === Infinity ? '∞' : formatCurrency(bracket.max)}`,
          formatCurrency(bracket.taxableIncome),
          formatCurrency(bracket.tax)
        ]) || []
      }}
    >
      <div className="tax-bracket-content">
        <div className="chart-svg-container">
          <svg
            ref={svgRef}
            width="100%"
            height={height}
            className="tax-bracket-svg"
            role="img"
            aria-label="Tax bracket visualization chart"
          />

          <div
            ref={tooltipRef}
            className="chart-tooltip"
            style={{ opacity: 0 }}
          />
        </div>

        {summaryData && (
          <motion.div
            className="tax-summary"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: animated ? 1.8 : 0, duration: 0.6 }}
          >
            <div className="summary-grid">
              <div className="summary-card">
                <div className="summary-label">Marginal Rate</div>
                <div className="summary-value marginal">
                  {formatPercentage(summaryData.marginalRate)}
                </div>
                <div className="summary-description">
                  Rate on your last dollar earned
                </div>
              </div>

              <div className="summary-card">
                <div className="summary-label">Effective Rate</div>
                <div className="summary-value effective">
                  {formatPercentage(summaryData.effectiveRate)}
                </div>
                <div className="summary-description">
                  Average rate on all income
                </div>
              </div>

              <div className="summary-card">
                <div className="summary-label">Total Tax</div>
                <div className="summary-value total-tax">
                  {formatCurrency(summaryData.totalTax)}
                </div>
                <div className="summary-description">
                  Total federal income tax
                </div>
              </div>

              <div className="summary-card">
                <div className="summary-label">After-Tax Income</div>
                <div className="summary-value after-tax">
                  {formatCurrency(summaryData.afterTaxIncome)}
                </div>
                <div className="summary-description">
                  Income after federal taxes
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {selectedBracket && (
            <motion.div
              className="bracket-details-modal"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
            >
              <div className="modal-header">
                <h3>{formatPercentage(selectedBracket.rate)} Tax Bracket Details</h3>
                <button
                  onClick={() => setSelectedBracket(null)}
                  className="modal-close"
                  aria-label="Close bracket details"
                >
                  ×
                </button>
              </div>

              <div className="modal-content">
                <div className="detail-row">
                  <label>Income Range:</label>
                  <span>{formatCurrency(selectedBracket.min)} - {selectedBracket.max === Infinity ? 'No Limit' : formatCurrency(selectedBracket.max)}</span>
                </div>

                <div className="detail-row">
                  <label>Tax Rate:</label>
                  <span>{formatPercentage(selectedBracket.rate)}</span>
                </div>

                <div className="detail-row">
                  <label>Your Taxable Income in Bracket:</label>
                  <span>{formatCurrency(selectedBracket.taxableIncome)}</span>
                </div>

                <div className="detail-row">
                  <label>Tax on This Bracket:</label>
                  <span className="tax-amount">{formatCurrency(selectedBracket.tax)}</span>
                </div>

                <div className="detail-row">
                  <label>Percentage of Total Income:</label>
                  <span>{formatPercentage(selectedBracket.percentage / 100)}</span>
                </div>

                {selectedBracket.isUserBracket && (
                  <div className="current-bracket-notice">
                    <span className="notice-icon">🎯</span>
                    This is your current marginal tax bracket
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ChartContainer>
  );
};

export default TaxBracketChart;