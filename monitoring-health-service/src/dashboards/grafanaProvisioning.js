const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const config = require('../config');

class GrafanaProvisioner {
  constructor() {
    this.grafanaUrl = config.dashboard.grafanaUrl;
    this.username = config.dashboard.grafanaUsername;
    this.password = config.dashboard.grafanaPassword;
    this.auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
  }

  async provisionDashboards() {
    try {
      const dashboardsDir = path.join(__dirname, '../../dashboards');
      const dashboardFiles = await fs.readdir(dashboardsDir);

      for (const file of dashboardFiles) {
        if (file.endsWith('.json')) {
          await this.uploadDashboard(path.join(dashboardsDir, file));
        }
      }

      console.log('All dashboards provisioned successfully');
    } catch (error) {
      console.error('Error provisioning dashboards:', error);
      throw error;
    }
  }

  async uploadDashboard(filePath) {
    try {
      const dashboardContent = await fs.readFile(filePath, 'utf8');
      const dashboard = JSON.parse(dashboardContent);

      const payload = {
        dashboard: dashboard.dashboard,
        overwrite: true,
        message: `Uploaded by monitoring service at ${new Date().toISOString()}`
      };

      const response = await axios.post(
        `${this.grafanaUrl}/api/dashboards/db`,
        payload,
        {
          headers: {
            'Authorization': `Basic ${this.auth}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 10000
        }
      );

      if (response.status === 200) {
        console.log(`Dashboard uploaded successfully: ${path.basename(filePath)}`);
        return response.data;
      } else {
        throw new Error(`Unexpected response status: ${response.status}`);
      }
    } catch (error) {
      console.error(`Failed to upload dashboard ${path.basename(filePath)}:`, error.message);
      throw error;
    }
  }

  async createDataSource() {
    try {
      const dataSource = {
        name: 'GlobalTaxCalc Prometheus',
        type: 'prometheus',
        url: `http://localhost:${config.prometheus.port}`,
        access: 'proxy',
        isDefault: true,
        jsonData: {
          httpMethod: 'POST',
          queryTimeout: '60s',
          timeInterval: '5s'
        }
      };

      const response = await axios.post(
        `${this.grafanaUrl}/api/datasources`,
        dataSource,
        {
          headers: {
            'Authorization': `Basic ${this.auth}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      console.log('Prometheus data source created successfully');
      return response.data;
    } catch (error) {
      if (error.response?.status === 409) {
        console.log('Prometheus data source already exists');
        return null;
      }
      console.error('Failed to create Prometheus data source:', error.message);
      throw error;
    }
  }

  async setupGrafana() {
    try {
      await this.waitForGrafana();
      await this.createDataSource();
      await this.provisionDashboards();
      await this.createAlertRules();
      console.log('Grafana setup completed successfully');
    } catch (error) {
      console.error('Grafana setup failed:', error);
      throw error;
    }
  }

  async waitForGrafana(maxAttempts = 30, interval = 2000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await axios.get(`${this.grafanaUrl}/api/health`, {
          timeout: 5000
        });
        console.log('Grafana is ready');
        return;
      } catch (error) {
        console.log(`Waiting for Grafana... (attempt ${attempt}/${maxAttempts})`);
        if (attempt === maxAttempts) {
          throw new Error(`Grafana not available after ${maxAttempts} attempts`);
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
  }

  async createAlertRules() {
    const alertRules = [
      {
        uid: 'high-error-rate',
        title: 'High Error Rate',
        condition: 'A',
        data: [
          {
            refId: 'A',
            queryType: '',
            relativeTimeRange: {
              from: 300,
              to: 0
            },
            datasourceUid: 'prometheus-uid',
            model: {
              expr: 'sum(rate(globaltaxcalc_http_requests_total{status_code!~"2.."}[5m])) / sum(rate(globaltaxcalc_http_requests_total[5m])) * 100 > 5',
              intervalMs: 1000,
              maxDataPoints: 43200
            }
          }
        ],
        noDataState: 'NoData',
        execErrState: 'Alerting',
        for: '5m',
        annotations: {
          description: 'Error rate is above 5% for more than 5 minutes',
          summary: 'High error rate detected'
        },
        labels: {
          severity: 'warning',
          service: 'globaltaxcalc'
        }
      },
      {
        uid: 'high-response-time',
        title: 'High Response Time',
        condition: 'A',
        data: [
          {
            refId: 'A',
            queryType: '',
            relativeTimeRange: {
              from: 300,
              to: 0
            },
            datasourceUid: 'prometheus-uid',
            model: {
              expr: 'histogram_quantile(0.95, sum(rate(globaltaxcalc_http_request_duration_seconds_bucket[5m])) by (le)) > 1',
              intervalMs: 1000,
              maxDataPoints: 43200
            }
          }
        ],
        noDataState: 'NoData',
        execErrState: 'Alerting',
        for: '5m',
        annotations: {
          description: 'P95 response time is above 1 second for more than 5 minutes',
          summary: 'High response time detected'
        },
        labels: {
          severity: 'warning',
          service: 'globaltaxcalc'
        }
      },
      {
        uid: 'service-down',
        title: 'Service Down',
        condition: 'A',
        data: [
          {
            refId: 'A',
            queryType: '',
            relativeTimeRange: {
              from: 60,
              to: 0
            },
            datasourceUid: 'prometheus-uid',
            model: {
              expr: 'up{job=~".*globaltaxcalc.*"} == 0',
              intervalMs: 1000,
              maxDataPoints: 43200
            }
          }
        ],
        noDataState: 'Alerting',
        execErrState: 'Alerting',
        for: '1m',
        annotations: {
          description: 'Service {{ $labels.instance }} is down',
          summary: 'Service is not responding'
        },
        labels: {
          severity: 'critical',
          service: 'globaltaxcalc'
        }
      }
    ];

    try {
      for (const rule of alertRules) {
        await this.createAlertRule(rule);
      }
      console.log('Alert rules created successfully');
    } catch (error) {
      console.error('Failed to create alert rules:', error);
    }
  }

  async createAlertRule(rule) {
    try {
      const response = await axios.post(
        `${this.grafanaUrl}/api/ruler/grafana/api/v1/rules/default`,
        rule,
        {
          headers: {
            'Authorization': `Basic ${this.auth}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      console.log(`Alert rule '${rule.title}' created successfully`);
      return response.data;
    } catch (error) {
      console.error(`Failed to create alert rule '${rule.title}':`, error.message);
    }
  }

  async getDashboards() {
    try {
      const response = await axios.get(
        `${this.grafanaUrl}/api/search?type=dash-db`,
        {
          headers: {
            'Authorization': `Basic ${this.auth}`
          },
          timeout: 5000
        }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to get dashboards:', error.message);
      return [];
    }
  }

  async deleteDashboard(uid) {
    try {
      const response = await axios.delete(
        `${this.grafanaUrl}/api/dashboards/uid/${uid}`,
        {
          headers: {
            'Authorization': `Basic ${this.auth}`
          },
          timeout: 5000
        }
      );

      console.log(`Dashboard ${uid} deleted successfully`);
      return response.data;
    } catch (error) {
      console.error(`Failed to delete dashboard ${uid}:`, error.message);
      throw error;
    }
  }
}

module.exports = GrafanaProvisioner;