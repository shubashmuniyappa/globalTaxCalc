/**
 * Analytics Dashboard Component for GlobalTaxCalc PWA
 *
 * Provides a comprehensive dashboard for viewing PWA analytics,
 * performance metrics, and user insights.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Analytics } from '../../lib/pwa/analytics';

const AnalyticsDashboard = () => {
  const [data, setData] = useState({
    summary: null,
    performance: null,
    usage: null,
    conversions: null,
    realtime: null,
    alerts: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);

      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - getPeriodMs(selectedPeriod)).toISOString();

      const [summary, performance, usage, conversions, realtime, alerts] = await Promise.all([
        fetchAnalyticsAPI('summary', { startDate, endDate }),
        fetchAnalyticsAPI('performance', { startDate, endDate }),
        fetchAnalyticsAPI('usage', { startDate, endDate, platform: selectedPlatform }),
        fetchAnalyticsAPI('conversions', { startDate, endDate }),
        fetchAnalyticsAPI('realtime'),
        fetchAnalyticsAPI('alerts')
      ]);

      setData({
        summary,
        performance,
        usage,
        conversions,
        realtime,
        alerts
      });

      setError(null);
    } catch (err) {
      setError('Failed to load analytics data');
      console.error('Analytics data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, selectedPlatform]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchAnalyticsData, 30000); // Refresh every 30 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, fetchAnalyticsData]);

  const getPeriodMs = (period) => {
    switch (period) {
      case '1d': return 24 * 60 * 60 * 1000;
      case '7d': return 7 * 24 * 60 * 60 * 1000;
      case '30d': return 30 * 24 * 60 * 60 * 1000;
      case '90d': return 90 * 24 * 60 * 60 * 1000;
      default: return 7 * 24 * 60 * 60 * 1000;
    }
  };

  const fetchAnalyticsAPI = async (type, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`/api/analytics?type=${type}&${queryString}`);

    if (!response.ok) {
      throw new Error(`Analytics API error: ${response.statusText}`);
    }

    return response.json();
  };

  const exportData = () => {
    const analytics = Analytics.getInstance();
    analytics.exportAnalyticsData();
  };

  if (loading && !data.summary) {
    return (
      <div className="analytics-dashboard loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading analytics data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-dashboard error">
        <div className="error-message">
          <h3>Error Loading Analytics</h3>
          <p>{error}</p>
          <button onClick={fetchAnalyticsData} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>PWA Analytics Dashboard</h1>
          <div className="header-controls">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="period-selector"
            >
              <option value="1d">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>

            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="platform-selector"
            >
              <option value="all">All Platforms</option>
              <option value="ios">iOS</option>
              <option value="android">Android</option>
              <option value="windows">Windows</option>
              <option value="macos">macOS</option>
            </select>

            <label className="auto-refresh-toggle">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh
            </label>

            <button onClick={exportData} className="export-button">
              Export Data
            </button>

            <button onClick={fetchAnalyticsData} className="refresh-button">
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="dashboard-content">
        {/* Realtime Metrics */}
        <section className="realtime-section">
          <h2>Real-time Metrics</h2>
          <div className="realtime-grid">
            <MetricCard
              title="Active Users"
              value={data.realtime?.current?.activeUsers || 0}
              subtitle="Last 5 minutes"
              trend="neutral"
            />
            <MetricCard
              title="Events (1h)"
              value={data.realtime?.current?.eventsLastHour || 0}
              subtitle="Last hour"
              trend="up"
            />
            <MetricCard
              title="Events (24h)"
              value={data.realtime?.current?.eventsLast24Hours || 0}
              subtitle="Last 24 hours"
              trend="up"
            />
          </div>
        </section>

        {/* Summary Section */}
        <section className="summary-section">
          <h2>Overview</h2>
          <div className="summary-grid">
            <MetricCard
              title="Total Events"
              value={data.summary?.summary?.totalEvents || 0}
              subtitle={`${selectedPeriod.replace('d', ' days')}`}
            />
            <MetricCard
              title="Unique Users"
              value={data.summary?.summary?.uniqueUsers || 0}
              subtitle="Active users"
            />
            <MetricCard
              title="Sessions"
              value={data.summary?.summary?.uniqueSessions || 0}
              subtitle="User sessions"
            />
            <MetricCard
              title="Avg Events/Session"
              value={data.summary?.summary?.avgEventsPerSession?.toFixed(1) || 0}
              subtitle="Engagement rate"
            />
          </div>
        </section>

        {/* Performance Section */}
        <section className="performance-section">
          <h2>Performance Metrics</h2>
          <div className="performance-grid">
            <WebVitalsCard vitals={data.performance?.webVitals} />
            <PageLoadCard pageLoad={data.performance?.pageLoad} />
            <MemoryUsageCard memory={data.performance?.memory} />
          </div>
        </section>

        {/* Usage Section */}
        <section className="usage-section">
          <h2>Usage Analytics</h2>
          <div className="usage-grid">
            <CalculatorUsageCard calculators={data.usage?.calculators} />
            <FeatureUsageCard features={data.usage?.features} />
            <DailyActivityCard daily={data.usage?.daily} />
          </div>
        </section>

        {/* Conversion Section */}
        <section className="conversion-section">
          <h2>Conversions & Funnel</h2>
          <div className="conversion-grid">
            <ConversionCard conversions={data.conversions?.conversions} />
            <FunnelCard funnel={data.conversions?.funnel} rates={data.conversions?.conversionRates} />
          </div>
        </section>

        {/* Platform Breakdown */}
        <section className="platform-section">
          <h2>Platform Distribution</h2>
          <div className="platform-grid">
            <PlatformCard platforms={data.summary?.platforms} />
            <TopEventsCard events={data.summary?.topEvents} />
          </div>
        </section>

        {/* Alerts Section */}
        {data.alerts?.summary?.total > 0 && (
          <section className="alerts-section">
            <h2>Performance Alerts</h2>
            <AlertsCard alerts={data.alerts} />
          </section>
        )}
      </div>
    </div>
  );
};

// Metric Card Component
const MetricCard = ({ title, value, subtitle, trend = 'neutral' }) => (
  <div className={`metric-card ${trend}`}>
    <div className="metric-header">
      <h3>{title}</h3>
      {trend !== 'neutral' && (
        <span className={`trend-indicator ${trend}`}>
          {trend === 'up' ? '↗️' : '↘️'}
        </span>
      )}
    </div>
    <div className="metric-value">{typeof value === 'number' ? value.toLocaleString() : value}</div>
    <div className="metric-subtitle">{subtitle}</div>
  </div>
);

// Web Vitals Card
const WebVitalsCard = ({ vitals }) => (
  <div className="web-vitals-card">
    <h3>Core Web Vitals</h3>
    <div className="vitals-grid">
      {vitals && Object.entries(vitals).map(([metric, data]) => (
        <div key={metric} className="vital-metric">
          <div className="vital-name">{metric}</div>
          <div className="vital-value">{data.median?.toFixed(0) || 0}ms</div>
          <div className="vital-ratings">
            <span className="good">{data.ratings?.good || 0}%</span>
            <span className="needs-improvement">{data.ratings?.needsImprovement || 0}%</span>
            <span className="poor">{data.ratings?.poor || 0}%</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Page Load Card
const PageLoadCard = ({ pageLoad }) => (
  <div className="page-load-card">
    <h3>Page Load Performance</h3>
    <div className="load-metrics">
      <div className="load-metric">
        <span className="label">Average Load Time</span>
        <span className="value">{pageLoad?.averageDuration?.toFixed(0) || 0}ms</span>
      </div>
      <div className="load-metric">
        <span className="label">Total Page Loads</span>
        <span className="value">{pageLoad?.count || 0}</span>
      </div>
    </div>
    {pageLoad?.slowestPages?.length > 0 && (
      <div className="slowest-pages">
        <h4>Slowest Pages</h4>
        {pageLoad.slowestPages.map((page, index) => (
          <div key={index} className="slow-page">
            <span className="page-path">{page.page}</span>
            <span className="page-duration">{page.duration.toFixed(0)}ms</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

// Memory Usage Card
const MemoryUsageCard = ({ memory }) => (
  <div className="memory-card">
    <h3>Memory Usage</h3>
    <div className="memory-metrics">
      <div className="memory-metric">
        <span className="label">Average Usage</span>
        <span className="value">{(memory?.averageUsage * 100)?.toFixed(1) || 0}%</span>
      </div>
      <div className="memory-metric">
        <span className="label">Peak Usage</span>
        <span className="value">{(memory?.maxUsage * 100)?.toFixed(1) || 0}%</span>
      </div>
      <div className="memory-metric">
        <span className="label">Alerts</span>
        <span className="value alert">{memory?.alerts || 0}</span>
      </div>
    </div>
  </div>
);

// Calculator Usage Card
const CalculatorUsageCard = ({ calculators }) => (
  <div className="calculator-usage-card">
    <h3>Calculator Usage</h3>
    <div className="calculator-list">
      {calculators?.map((calc, index) => (
        <div key={index} className="calculator-item">
          <span className="calculator-name">{calc.calculator}</span>
          <span className="calculator-usage">{calc.usage}</span>
        </div>
      )) || <p>No calculator data available</p>}
    </div>
  </div>
);

// Feature Usage Card
const FeatureUsageCard = ({ features }) => (
  <div className="feature-usage-card">
    <h3>Feature Usage</h3>
    <div className="feature-list">
      {features?.slice(0, 10).map((feature, index) => (
        <div key={index} className="feature-item">
          <span className="feature-name">{feature.feature.replace(/_/g, ' ')}</span>
          <span className="feature-usage">{feature.usage}</span>
        </div>
      )) || <p>No feature data available</p>}
    </div>
  </div>
);

// Daily Activity Card
const DailyActivityCard = ({ daily }) => (
  <div className="daily-activity-card">
    <h3>Daily Activity</h3>
    <div className="activity-chart">
      {daily?.slice(-7).map((day, index) => (
        <div key={index} className="activity-day">
          <div className="day-date">{new Date(day.date).toLocaleDateString()}</div>
          <div className="day-metrics">
            <div className="day-events">{day.events} events</div>
            <div className="day-users">{day.users} users</div>
            <div className="day-sessions">{day.sessions} sessions</div>
          </div>
        </div>
      )) || <p>No daily data available</p>}
    </div>
  </div>
);

// Conversion Card
const ConversionCard = ({ conversions }) => (
  <div className="conversion-card">
    <h3>Conversion Events</h3>
    <div className="conversion-list">
      {conversions && Object.entries(conversions).map(([event, count]) => (
        <div key={event} className="conversion-item">
          <span className="conversion-name">{event.replace(/_/g, ' ')}</span>
          <span className="conversion-count">{count}</span>
        </div>
      ))}
    </div>
  </div>
);

// Funnel Card
const FunnelCard = ({ funnel, rates }) => (
  <div className="funnel-card">
    <h3>Conversion Funnel</h3>
    <div className="funnel-steps">
      {funnel && Object.entries(funnel).map(([step, count], index) => (
        <div key={step} className="funnel-step">
          <div className="step-name">{step.replace(/_/g, ' ')}</div>
          <div className="step-count">{count}</div>
          {index < Object.keys(funnel).length - 1 && (
            <div className="step-arrow">↓</div>
          )}
        </div>
      ))}
    </div>
    {rates && (
      <div className="conversion-rates">
        <h4>Conversion Rates</h4>
        {Object.entries(rates).map(([rate, value]) => (
          <div key={rate} className="rate-item">
            <span className="rate-name">{rate.replace(/_/g, ' ')}</span>
            <span className="rate-value">{value}%</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

// Platform Card
const PlatformCard = ({ platforms }) => (
  <div className="platform-card">
    <h3>Platforms</h3>
    <div className="platform-list">
      {platforms?.map((platform, index) => (
        <div key={index} className="platform-item">
          <span className="platform-name">{platform.platform}</span>
          <span className="platform-count">{platform.count}</span>
          <span className="platform-percentage">{platform.percentage}%</span>
        </div>
      )) || <p>No platform data available</p>}
    </div>
  </div>
);

// Top Events Card
const TopEventsCard = ({ events }) => (
  <div className="top-events-card">
    <h3>Top Events</h3>
    <div className="events-list">
      {events?.map((event, index) => (
        <div key={index} className="event-item">
          <span className="event-name">{event.event}</span>
          <span className="event-count">{event.count}</span>
          <span className="event-percentage">{event.percentage}%</span>
        </div>
      )) || <p>No event data available</p>}
    </div>
  </div>
);

// Alerts Card
const AlertsCard = ({ alerts }) => (
  <div className="alerts-card">
    <h3>Performance Alerts ({alerts.summary.total})</h3>
    <div className="alerts-summary">
      <span className="alert-count high">High: {alerts.summary.high}</span>
      <span className="alert-count medium">Medium: {alerts.summary.medium}</span>
      <span className="alert-count low">Low: {alerts.summary.low}</span>
    </div>
    <div className="alerts-list">
      {alerts.alerts.slice(0, 10).map((alert, index) => (
        <div key={index} className={`alert-item ${alert.severity}`}>
          <div className="alert-type">{alert.type.replace(/_/g, ' ')}</div>
          <div className="alert-time">{new Date(alert.timestamp).toLocaleString()}</div>
          {alert.value && <div className="alert-value">{alert.value}</div>}
        </div>
      ))}
    </div>
  </div>
);

export default AnalyticsDashboard;