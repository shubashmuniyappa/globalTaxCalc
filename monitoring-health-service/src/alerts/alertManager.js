const nodemailer = require('nodemailer');
const { WebClient } = require('@slack/web-api');
const twilio = require('twilio');
const axios = require('axios');
const config = require('../config');

class AlertManager {
  constructor() {
    this.isInitialized = false;
    this.emailTransporter = null;
    this.slackClient = null;
    this.twilioClient = null;
    this.alertQueue = [];
    this.escalationTimers = new Map();
    this.suppressedAlerts = new Set();
    this.alertHistory = new Map();
    this.onCallSchedule = {
      primary: config.onCall.primary,
      secondary: config.onCall.secondary,
      escalationTimeout: config.onCall.escalationTimeout * 1000
    };
  }

  async initialize() {
    if (this.isInitialized) {
      console.warn('Alert manager already initialized');
      return;
    }

    if (!config.alerting.enabled) {
      console.log('Alerting is disabled in configuration');
      return;
    }

    try {
      await this.initializeNotificationChannels();
      this.isInitialized = true;
      console.log('Alert manager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize alert manager:', error);
      throw error;
    }
  }

  async initializeNotificationChannels() {
    if (config.alerting.email.enabled) {
      await this.initializeEmail();
    }

    if (config.alerting.slack.enabled) {
      await this.initializeSlack();
    }

    if (config.alerting.sms.enabled) {
      await this.initializeSMS();
    }
  }

  async initializeEmail() {
    try {
      this.emailTransporter = nodemailer.createTransporter({
        host: config.alerting.email.smtp.host,
        port: config.alerting.email.smtp.port,
        secure: config.alerting.email.smtp.secure,
        auth: {
          user: config.alerting.email.smtp.user,
          pass: config.alerting.email.smtp.password
        }
      });

      await this.emailTransporter.verify();
      console.log('Email alerting initialized successfully');
    } catch (error) {
      console.error('Failed to initialize email alerting:', error);
      this.emailTransporter = null;
    }
  }

  async initializeSlack() {
    try {
      if (!config.alerting.slack.webhookUrl) {
        console.warn('Slack webhook URL not provided');
        return;
      }

      await axios.post(config.alerting.slack.webhookUrl, {
        text: 'GlobalTaxCalc Monitoring Service - Alert system initialized',
        channel: config.alerting.slack.channel,
        username: config.alerting.slack.username,
        icon_emoji: ':white_check_mark:'
      });

      console.log('Slack alerting initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Slack alerting:', error);
    }
  }

  async initializeSMS() {
    try {
      this.twilioClient = twilio(
        config.alerting.sms.twilio.accountSid,
        config.alerting.sms.twilio.authToken
      );

      console.log('SMS alerting initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SMS alerting:', error);
      this.twilioClient = null;
    }
  }

  async sendAlert(alert) {
    if (!this.isInitialized || !config.alerting.enabled) {
      console.warn('Alert manager not initialized or alerting disabled');
      return;
    }

    try {
      const enrichedAlert = this.enrichAlert(alert);

      if (this.shouldSuppressAlert(enrichedAlert)) {
        console.log(`Alert suppressed: ${enrichedAlert.title}`);
        return;
      }

      this.alertHistory.set(enrichedAlert.id, {
        ...enrichedAlert,
        sentAt: new Date().toISOString(),
        status: 'sent'
      });

      const results = await Promise.allSettled([
        this.sendEmailAlert(enrichedAlert),
        this.sendSlackAlert(enrichedAlert),
        this.sendSMSAlert(enrichedAlert),
        this.sendPagerDutyAlert(enrichedAlert)
      ]);

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`Alert sent: ${enrichedAlert.title} (${successful} successful, ${failed} failed)`);

      if (enrichedAlert.severity === 'critical' && config.onCall.enabled) {
        this.startEscalation(enrichedAlert);
      }

      return enrichedAlert.id;
    } catch (error) {
      console.error('Failed to send alert:', error);
      throw error;
    }
  }

  enrichAlert(alert) {
    const now = new Date();
    const id = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      id,
      timestamp: now.toISOString(),
      service: config.service.name,
      environment: config.service.environment,
      host: require('os').hostname(),
      ...alert,
      severity: alert.severity || 'warning',
      category: alert.category || 'system',
      source: alert.source || 'monitoring'
    };
  }

  shouldSuppressAlert(alert) {
    const suppressionKey = `${alert.category}-${alert.source}-${alert.severity}`;

    if (this.suppressedAlerts.has(suppressionKey)) {
      return true;
    }

    const recentSimilar = Array.from(this.alertHistory.values())
      .filter(a =>
        a.category === alert.category &&
        a.source === alert.source &&
        Date.now() - new Date(a.sentAt).getTime() < 300000 // 5 minutes
      );

    if (recentSimilar.length >= 3) {
      this.suppressedAlerts.add(suppressionKey);
      setTimeout(() => this.suppressedAlerts.delete(suppressionKey), 1800000); // 30 minutes
      return true;
    }

    return false;
  }

  async sendEmailAlert(alert) {
    if (!this.emailTransporter || !config.alerting.email.enabled) {
      return;
    }

    try {
      const subject = `[${alert.severity.toUpperCase()}] ${alert.title} - ${config.service.name}`;
      const html = this.generateEmailTemplate(alert);

      const recipients = Array.isArray(config.alerting.email.to)
        ? config.alerting.email.to
        : [config.alerting.email.to];

      await this.emailTransporter.sendMail({
        from: config.alerting.email.from,
        to: recipients.join(','),
        subject,
        html,
        priority: alert.severity === 'critical' ? 'high' : 'normal'
      });

      console.log(`Email alert sent: ${alert.title}`);
    } catch (error) {
      console.error('Failed to send email alert:', error);
      throw error;
    }
  }

  async sendSlackAlert(alert) {
    if (!config.alerting.slack.enabled || !config.alerting.slack.webhookUrl) {
      return;
    }

    try {
      const color = this.getSeverityColor(alert.severity);
      const emoji = this.getSeverityEmoji(alert.severity);

      const payload = {
        channel: config.alerting.slack.channel,
        username: config.alerting.slack.username,
        icon_emoji: emoji,
        attachments: [
          {
            color,
            title: `${emoji} ${alert.title}`,
            text: alert.description,
            fields: [
              { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
              { title: 'Service', value: alert.service, short: true },
              { title: 'Environment', value: alert.environment, short: true },
              { title: 'Host', value: alert.host, short: true },
              { title: 'Category', value: alert.category, short: true },
              { title: 'Source', value: alert.source, short: true }
            ],
            footer: 'GlobalTaxCalc Monitoring',
            ts: Math.floor(new Date(alert.timestamp).getTime() / 1000)
          }
        ]
      };

      if (alert.metadata) {
        payload.attachments[0].fields.push({
          title: 'Additional Info',
          value: JSON.stringify(alert.metadata, null, 2),
          short: false
        });
      }

      await axios.post(config.alerting.slack.webhookUrl, payload);
      console.log(`Slack alert sent: ${alert.title}`);
    } catch (error) {
      console.error('Failed to send Slack alert:', error);
      throw error;
    }
  }

  async sendSMSAlert(alert) {
    if (!this.twilioClient || !config.alerting.sms.enabled || alert.severity !== 'critical') {
      return;
    }

    try {
      const message = `🚨 CRITICAL ALERT\n${alert.title}\n${alert.description}\nService: ${alert.service}`;
      const recipients = Array.isArray(config.alerting.sms.to)
        ? config.alerting.sms.to
        : [config.alerting.sms.to];

      for (const recipient of recipients) {
        if (recipient) {
          await this.twilioClient.messages.create({
            body: message,
            from: config.alerting.sms.twilio.fromPhone,
            to: recipient
          });
        }
      }

      console.log(`SMS alert sent: ${alert.title}`);
    } catch (error) {
      console.error('Failed to send SMS alert:', error);
      throw error;
    }
  }

  async sendPagerDutyAlert(alert) {
    if (!config.alerting.pagerduty.enabled || !config.alerting.pagerduty.integrationKey) {
      return;
    }

    try {
      const payload = {
        routing_key: config.alerting.pagerduty.routingKey || config.alerting.pagerduty.integrationKey,
        event_action: 'trigger',
        client: 'GlobalTaxCalc Monitoring',
        client_url: `http://${config.server.host}:${config.server.port}`,
        payload: {
          summary: alert.title,
          source: alert.host,
          severity: alert.severity,
          component: alert.service,
          group: alert.category,
          class: alert.source,
          custom_details: {
            description: alert.description,
            environment: alert.environment,
            timestamp: alert.timestamp,
            metadata: alert.metadata
          }
        }
      };

      await axios.post('https://events.pagerduty.com/v2/enqueue', payload, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log(`PagerDuty alert sent: ${alert.title}`);
    } catch (error) {
      console.error('Failed to send PagerDuty alert:', error);
      throw error;
    }
  }

  startEscalation(alert) {
    if (!config.onCall.enabled) return;

    console.log(`Starting escalation for critical alert: ${alert.title}`);

    const escalationTimer = setTimeout(async () => {
      try {
        console.log(`Escalating alert to secondary: ${alert.title}`);

        const escalationAlert = {
          ...alert,
          title: `ESCALATED: ${alert.title}`,
          description: `This alert has been escalated to secondary on-call.\n\nOriginal Alert:\n${alert.description}`,
          severity: 'critical'
        };

        await this.sendAlert(escalationAlert);
      } catch (error) {
        console.error('Failed to escalate alert:', error);
      }
    }, this.onCallSchedule.escalationTimeout);

    this.escalationTimers.set(alert.id, escalationTimer);
  }

  stopEscalation(alertId) {
    const timer = this.escalationTimers.get(alertId);
    if (timer) {
      clearTimeout(timer);
      this.escalationTimers.delete(alertId);
      console.log(`Escalation stopped for alert: ${alertId}`);
    }
  }

  generateEmailTemplate(alert) {
    const color = this.getSeverityColor(alert.severity);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; }
          .header { background-color: ${color}; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; border: 1px solid #ddd; }
          .field { margin-bottom: 10px; }
          .label { font-weight: bold; color: #333; }
          .value { color: #666; }
          .metadata { background-color: #f5f5f5; padding: 10px; margin-top: 15px; font-family: monospace; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${alert.severity.toUpperCase()} ALERT</h1>
            <h2>${alert.title}</h2>
          </div>
          <div class="content">
            <div class="field">
              <span class="label">Description:</span>
              <span class="value">${alert.description}</span>
            </div>
            <div class="field">
              <span class="label">Service:</span>
              <span class="value">${alert.service}</span>
            </div>
            <div class="field">
              <span class="label">Environment:</span>
              <span class="value">${alert.environment}</span>
            </div>
            <div class="field">
              <span class="label">Host:</span>
              <span class="value">${alert.host}</span>
            </div>
            <div class="field">
              <span class="label">Timestamp:</span>
              <span class="value">${alert.timestamp}</span>
            </div>
            <div class="field">
              <span class="label">Category:</span>
              <span class="value">${alert.category}</span>
            </div>
            <div class="field">
              <span class="label">Source:</span>
              <span class="value">${alert.source}</span>
            </div>
            ${alert.metadata ? `<div class="metadata"><strong>Additional Information:</strong><br><pre>${JSON.stringify(alert.metadata, null, 2)}</pre></div>` : ''}
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getSeverityColor(severity) {
    switch (severity) {
      case 'critical': return '#ff0000';
      case 'warning': return '#ff8c00';
      case 'info': return '#0066cc';
      default: return '#666666';
    }
  }

  getSeverityEmoji(severity) {
    switch (severity) {
      case 'critical': return ':rotating_light:';
      case 'warning': return ':warning:';
      case 'info': return ':information_source:';
      default: return ':grey_question:';
    }
  }

  async acknowledgeAlert(alertId, acknowledgedBy) {
    const alert = this.alertHistory.get(alertId);
    if (alert) {
      alert.status = 'acknowledged';
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date().toISOString();

      this.stopEscalation(alertId);
      console.log(`Alert acknowledged: ${alertId} by ${acknowledgedBy}`);
    }
  }

  async resolveAlert(alertId, resolvedBy, resolution) {
    const alert = this.alertHistory.get(alertId);
    if (alert) {
      alert.status = 'resolved';
      alert.resolvedBy = resolvedBy;
      alert.resolvedAt = new Date().toISOString();
      alert.resolution = resolution;

      this.stopEscalation(alertId);
      console.log(`Alert resolved: ${alertId} by ${resolvedBy}`);
    }
  }

  getAlertHistory(limit = 100) {
    return Array.from(this.alertHistory.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  getActiveAlerts() {
    return Array.from(this.alertHistory.values())
      .filter(alert => alert.status === 'sent')
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  async testAlertChannels() {
    const testAlert = {
      title: 'Test Alert - System Check',
      description: 'This is a test alert to verify all notification channels are working correctly.',
      severity: 'info',
      category: 'test',
      source: 'monitoring',
      metadata: {
        test: true,
        timestamp: new Date().toISOString()
      }
    };

    return await this.sendAlert(testAlert);
  }

  shutdown() {
    this.escalationTimers.forEach(timer => clearTimeout(timer));
    this.escalationTimers.clear();

    if (this.emailTransporter) {
      this.emailTransporter.close();
    }

    console.log('Alert manager shut down');
  }
}

const alertManager = new AlertManager();

module.exports = {
  alertManager,
  AlertManager
};