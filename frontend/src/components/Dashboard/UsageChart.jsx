import React, { useMemo } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import './UsageChart.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const UsageChart = ({ usage, limits, period = 'month', type = 'line' }) => {
  const chartData = useMemo(() => {
    if (!usage || !usage.length) {
      return {
        labels: [],
        datasets: []
      };
    }

    // Group usage by date and feature
    const groupedData = usage.reduce((acc, item) => {
      const date = new Date(item.createdAt).toLocaleDateString();
      if (!acc[date]) {
        acc[date] = {};
      }
      if (!acc[date][item.feature]) {
        acc[date][item.feature] = 0;
      }
      acc[date][item.feature] += item.quantity;
      return acc;
    }, {});

    const dates = Object.keys(groupedData).sort();
    const features = [...new Set(usage.map(item => item.feature))];

    const datasets = features.map((feature, index) => {
      const colors = [
        { bg: 'rgba(102, 126, 234, 0.1)', border: 'rgb(102, 126, 234)' },
        { bg: 'rgba(16, 185, 129, 0.1)', border: 'rgb(16, 185, 129)' },
        { bg: 'rgba(245, 101, 101, 0.1)', border: 'rgb(245, 101, 101)' },
        { bg: 'rgba(251, 191, 36, 0.1)', border: 'rgb(251, 191, 36)' },
        { bg: 'rgba(139, 92, 246, 0.1)', border: 'rgb(139, 92, 246)' }
      ];

      const colorIndex = index % colors.length;

      return {
        label: feature.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
        data: dates.map(date => groupedData[date][feature] || 0),
        backgroundColor: colors[colorIndex].bg,
        borderColor: colors[colorIndex].border,
        borderWidth: 2,
        fill: type === 'line',
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6
      };
    });

    return {
      labels: dates,
      datasets
    };
  }, [usage, type]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12
          }
        }
      },
      title: {
        display: true,
        text: `Usage Over Time (${period})`,
        font: {
          size: 16,
          weight: 'bold'
        },
        padding: 20
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        callbacks: {
          title: (context) => {
            return `Date: ${context[0].label}`;
          },
          label: (context) => {
            const limit = limits?.[context.dataset.label.toLowerCase().replace(/\s+/g, '')];
            let label = `${context.dataset.label}: ${context.parsed.y}`;

            if (limit && limit !== -1) {
              label += ` / ${limit}`;
              const percentage = ((context.parsed.y / limit) * 100).toFixed(1);
              label += ` (${percentage}%)`;
            } else if (limit === -1) {
              label += ' (Unlimited)';
            }

            return label;
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Date',
          font: {
            size: 12,
            weight: 'bold'
          }
        },
        grid: {
          display: false
        },
        ticks: {
          maxTicksLimit: 10
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Usage Count',
          font: {
            size: 12,
            weight: 'bold'
          }
        },
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        },
        ticks: {
          stepSize: 1
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    },
    elements: {
      point: {
        hoverBackgroundColor: 'white',
        hoverBorderWidth: 3
      }
    }
  };

  const getLimitIndicators = () => {
    if (!limits || !chartData.datasets.length) return null;

    return chartData.datasets.map((dataset, index) => {
      const feature = dataset.label.toLowerCase().replace(/\s+/g, '');
      const limit = limits[feature];

      if (!limit || limit === -1) return null;

      const maxUsage = Math.max(...dataset.data);
      const percentage = (maxUsage / limit) * 100;

      let status = 'good';
      if (percentage > 90) status = 'critical';
      else if (percentage > 75) status = 'warning';
      else if (percentage > 50) status = 'caution';

      return (
        <div key={index} className={`limit-indicator ${status}`}>
          <span className="feature-name">{dataset.label}</span>
          <div className="limit-bar">
            <div
              className="limit-fill"
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
          <span className="limit-text">
            {maxUsage} / {limit === -1 ? '∞' : limit}
          </span>
        </div>
      );
    }).filter(Boolean);
  };

  if (!usage || usage.length === 0) {
    return (
      <div className="usage-chart">
        <div className="chart-container">
          <div className="no-data">
            <div className="no-data-icon">📊</div>
            <h3>No Usage Data</h3>
            <p>Start using features to see your usage statistics here.</p>
          </div>
        </div>
      </div>
    );
  }

  const ChartComponent = type === 'line' ? Line : Bar;

  return (
    <div className="usage-chart">
      <div className="chart-header">
        <h3>Usage Analytics</h3>
        <div className="chart-controls">
          <select
            value={period}
            onChange={(e) => console.log('Period changed:', e.target.value)}
            className="period-selector"
          >
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="quarter">Last Quarter</option>
            <option value="year">Last Year</option>
          </select>
          <div className="chart-type-toggle">
            <button
              className={type === 'line' ? 'active' : ''}
              onClick={() => console.log('Chart type: line')}
            >
              Line
            </button>
            <button
              className={type === 'bar' ? 'active' : ''}
              onClick={() => console.log('Chart type: bar')}
            >
              Bar
            </button>
          </div>
        </div>
      </div>

      <div className="chart-container">
        <ChartComponent data={chartData} options={options} />
      </div>

      {limits && (
        <div className="limit-indicators">
          <h4>Current Usage vs Limits</h4>
          <div className="indicators-grid">
            {getLimitIndicators()}
          </div>
        </div>
      )}

      <div className="chart-summary">
        <div className="summary-stats">
          <div className="stat-item">
            <span className="stat-label">Total Features Used</span>
            <span className="stat-value">{chartData.datasets.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total Usage</span>
            <span className="stat-value">
              {usage.reduce((sum, item) => sum + item.quantity, 0)}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Most Used Feature</span>
            <span className="stat-value">
              {chartData.datasets.length > 0
                ? chartData.datasets.reduce((max, dataset) =>
                    Math.max(...dataset.data) > Math.max(...(max?.data || [0])) ? dataset : max
                  )?.label || 'None'
                : 'None'
              }
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsageChart;