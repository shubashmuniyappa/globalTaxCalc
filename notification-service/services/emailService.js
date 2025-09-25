const sgMail = require('@sendgrid/mail');
const config = require('../config');
const logger = require('../utils/logger');
const templateService = require('./templateService');
const complianceService = require('./complianceService');

class EmailService {
  constructor() {
    this.initialized = false;
    this.rateLimits = new Map();
  }

  async initialize() {
    if (this.initialized) return;

    try {
      if (!config.sendgrid.apiKey) {
        throw new Error('SendGrid API key is required');
      }

      sgMail.setApiKey(config.sendgrid.apiKey);
      this.initialized = true;

      logger.info('EmailService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize EmailService:', error);
      throw error;
    }
  }

  // Send individual email
  async sendEmail(emailData) {
    await this.initialize();

    try {
      // Validate email data
      this.validateEmailData(emailData);

      // Check rate limits
      await this.checkRateLimit(emailData.to);

      // Check compliance
      const isCompliant = await complianceService.checkEmailCompliance(emailData);
      if (!isCompliant.allowed) {
        throw new Error(`Email blocked: ${isCompliant.reason}`);
      }

      // Prepare email message
      const message = await this.prepareEmailMessage(emailData);

      // Send email via SendGrid
      const response = await sgMail.send(message);

      // Log successful send
      logger.info('Email sent successfully', {
        to: emailData.to,
        subject: emailData.subject,
        messageId: response[0].headers['x-message-id'],
        templateId: emailData.templateId
      });

      // Track email metrics
      await this.trackEmailSent(emailData, response);

      return {
        success: true,
        messageId: response[0].headers['x-message-id'],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to send email:', error);

      // Track failed send
      await this.trackEmailFailed(emailData, error);

      throw error;
    }
  }

  // Send email using SendGrid dynamic template
  async sendTemplateEmail(templateData) {
    await this.initialize();

    try {
      const {
        to,
        templateId,
        dynamicTemplateData = {},
        subject,
        customArgs = {},
        sendAt,
        headers = {}
      } = templateData;

      // Validate required fields
      if (!to || !templateId) {
        throw new Error('Recipient and template ID are required');
      }

      // Check user preferences and compliance
      const isCompliant = await complianceService.checkEmailCompliance({
        to,
        templateId,
        type: 'template'
      });

      if (!isCompliant.allowed) {
        throw new Error(`Template email blocked: ${isCompliant.reason}`);
      }

      // Add compliance data to template
      const enhancedTemplateData = {
        ...dynamicTemplateData,
        ...await this.addComplianceData(to, templateData),
        ...await this.addPersonalizationData(to)
      };

      const message = {
        to,
        from: {
          email: config.sendgrid.fromEmail,
          name: config.sendgrid.fromName
        },
        replyTo: config.sendgrid.replyToEmail,
        templateId,
        dynamicTemplateData: enhancedTemplateData,
        customArgs: {
          service: 'notification-service',
          timestamp: new Date().toISOString(),
          ...customArgs
        },
        trackingSettings: {
          clickTracking: { enable: true },
          openTracking: { enable: true },
          subscriptionTracking: { enable: false } // We handle this ourselves
        },
        headers
      };

      // Add subject if provided (overrides template subject)
      if (subject) {
        message.subject = subject;
      }

      // Schedule email if sendAt is provided
      if (sendAt) {
        message.sendAt = Math.floor(new Date(sendAt).getTime() / 1000);
      }

      const response = await sgMail.send(message);

      logger.info('Template email sent successfully', {
        to,
        templateId,
        messageId: response[0].headers['x-message-id']
      });

      await this.trackEmailSent({ ...templateData, type: 'template' }, response);

      return {
        success: true,
        messageId: response[0].headers['x-message-id'],
        templateId,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to send template email:', error);
      await this.trackEmailFailed({ ...templateData, type: 'template' }, error);
      throw error;
    }
  }

  // Send bulk emails
  async sendBulkEmails(emailsData) {
    await this.initialize();

    const results = {
      successful: [],
      failed: [],
      total: emailsData.length
    };

    try {
      // Process emails in batches to avoid rate limits
      const batchSize = 100;
      const batches = this.chunkArray(emailsData, batchSize);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchPromises = batch.map(emailData =>
          this.sendEmail(emailData)
            .then(result => ({ ...result, email: emailData.to }))
            .catch(error => ({
              success: false,
              error: error.message,
              email: emailData.to
            }))
        );

        const batchResults = await Promise.all(batchPromises);

        batchResults.forEach(result => {
          if (result.success) {
            results.successful.push(result);
          } else {
            results.failed.push(result);
          }
        });

        // Delay between batches
        if (i < batches.length - 1) {
          await this.delay(config.campaigns.batchDelay);
        }
      }

      logger.info('Bulk email send completed', {
        total: results.total,
        successful: results.successful.length,
        failed: results.failed.length
      });

      return results;
    } catch (error) {
      logger.error('Bulk email send failed:', error);
      throw error;
    }
  }

  // Send campaign emails
  async sendCampaignEmails(campaignData) {
    await this.initialize();

    try {
      const {
        recipients,
        templateId,
        dynamicTemplateData = {},
        subject,
        campaignId,
        scheduledAt,
        abTest = null
      } = campaignData;

      // Validate campaign
      if (!recipients || recipients.length === 0) {
        throw new Error('Campaign must have recipients');
      }

      // Filter recipients based on preferences and compliance
      const validRecipients = await this.filterCampaignRecipients(recipients, {
        templateId,
        campaignId,
        type: 'campaign'
      });

      if (validRecipients.length === 0) {
        throw new Error('No valid recipients for campaign');
      }

      // Handle A/B testing
      let recipientGroups = [{ recipients: validRecipients, templateId, subject }];

      if (abTest && abTest.enabled) {
        recipientGroups = this.splitRecipientsForABTest(validRecipients, abTest);
      }

      const campaignResults = {
        campaignId,
        groups: [],
        totalRecipients: validRecipients.length,
        sentAt: new Date().toISOString()
      };

      // Send to each group
      for (const group of recipientGroups) {
        const groupEmails = group.recipients.map(recipient => ({
          to: recipient.email,
          templateId: group.templateId,
          dynamicTemplateData: {
            ...dynamicTemplateData,
            ...recipient.personalData,
            firstName: recipient.firstName || 'Valued Customer',
            campaignId,
            abTestVariant: group.variant || 'control'
          },
          subject: group.subject,
          customArgs: {
            campaignId,
            variant: group.variant || 'control',
            recipientId: recipient.id
          }
        }));

        const groupResult = await this.sendBulkEmails(groupEmails);

        campaignResults.groups.push({
          variant: group.variant || 'control',
          templateId: group.templateId,
          recipients: group.recipients.length,
          sent: groupResult.successful.length,
          failed: groupResult.failed.length,
          results: groupResult
        });
      }

      // Track campaign metrics
      await this.trackCampaignSent(campaignResults);

      logger.info('Campaign sent successfully', {
        campaignId,
        totalRecipients: campaignResults.totalRecipients,
        groups: campaignResults.groups.length
      });

      return campaignResults;
    } catch (error) {
      logger.error('Failed to send campaign:', error);
      throw error;
    }
  }

  // Prepare email message for SendGrid
  async prepareEmailMessage(emailData) {
    const {
      to,
      subject,
      content,
      templateName,
      templateData = {},
      attachments = [],
      headers = {},
      customArgs = {}
    } = emailData;

    let html = content;
    let text = null;

    // Render template if templateName is provided
    if (templateName) {
      const rendered = await templateService.renderTemplate(templateName, templateData);
      html = rendered.html;
      text = rendered.text;
    }

    // Add compliance footer
    html = await this.addComplianceFooter(html, to);

    const message = {
      to,
      from: {
        email: config.sendgrid.fromEmail,
        name: config.sendgrid.fromName
      },
      replyTo: config.sendgrid.replyToEmail,
      subject,
      html,
      customArgs: {
        service: 'notification-service',
        timestamp: new Date().toISOString(),
        ...customArgs
      },
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true },
        subscriptionTracking: { enable: false }
      },
      headers
    };

    if (text) {
      message.text = text;
    }

    if (attachments.length > 0) {
      message.attachments = attachments;
    }

    return message;
  }

  // Add compliance data (unsubscribe links, etc.)
  async addComplianceData(email, templateData) {
    const unsubscribeToken = await complianceService.generateUnsubscribeToken(email);
    const baseUrl = process.env.BASE_URL || 'https://globaltaxcalc.com';

    return {
      unsubscribeUrl: `${baseUrl}/unsubscribe?token=${unsubscribeToken}`,
      preferencesUrl: `${baseUrl}/preferences?token=${unsubscribeToken}`,
      companyAddress: config.compliance.canSpam.physicalAddress,
      companyName: config.sendgrid.fromName,
      currentYear: new Date().getFullYear()
    };
  }

  // Add personalization data
  async addPersonalizationData(email) {
    try {
      // In a real implementation, you would fetch user data from your user service
      // For now, we'll extract basic info from email
      const [localPart, domain] = email.split('@');
      const firstName = localPart.charAt(0).toUpperCase() + localPart.slice(1);

      return {
        firstName,
        email,
        domain,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        firstName: 'Valued Customer',
        email,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Add compliance footer to HTML
  async addComplianceFooter(html, email) {
    if (!config.compliance.canSpam.enabled) {
      return html;
    }

    const complianceData = await this.addComplianceData(email);

    const footer = `
      <div style="margin-top: 40px; padding: 20px; background-color: #f8f9fa; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; text-align: center;">
        <p>
          <strong>${complianceData.companyName}</strong><br>
          ${complianceData.companyAddress}
        </p>
        <p>
          You are receiving this email because you have an account with GlobalTaxCalc.
          <br>
          <a href="${complianceData.unsubscribeUrl}" style="color: #007bff;">Unsubscribe</a> |
          <a href="${complianceData.preferencesUrl}" style="color: #007bff;">Manage Preferences</a>
        </p>
        <p style="font-size: 10px; color: #868e96;">
          © ${complianceData.currentYear} ${complianceData.companyName}. All rights reserved.
        </p>
      </div>
    `;

    // Insert footer before closing body tag, or append if no body tag
    if (html.includes('</body>')) {
      return html.replace('</body>', `${footer}</body>`);
    } else {
      return html + footer;
    }
  }

  // Check rate limits
  async checkRateLimit(email) {
    const key = `rate_limit:email:${email}`;
    const now = Date.now();
    const windowMs = config.rateLimit.email.windowMs;
    const maxEmails = config.rateLimit.email.max;

    if (!this.rateLimits.has(key)) {
      this.rateLimits.set(key, []);
    }

    const timestamps = this.rateLimits.get(key);

    // Remove old timestamps outside the window
    const validTimestamps = timestamps.filter(timestamp => now - timestamp < windowMs);

    if (validTimestamps.length >= maxEmails) {
      throw new Error(`Rate limit exceeded for ${email}`);
    }

    validTimestamps.push(now);
    this.rateLimits.set(key, validTimestamps);
  }

  // Filter campaign recipients based on preferences
  async filterCampaignRecipients(recipients, campaignData) {
    const validRecipients = [];

    for (const recipient of recipients) {
      try {
        const isCompliant = await complianceService.checkEmailCompliance({
          to: recipient.email,
          type: 'campaign',
          ...campaignData
        });

        if (isCompliant.allowed) {
          validRecipients.push(recipient);
        }
      } catch (error) {
        logger.warn(`Recipient ${recipient.email} filtered out:`, error.message);
      }
    }

    return validRecipients;
  }

  // Split recipients for A/B testing
  splitRecipientsForABTest(recipients, abTest) {
    const { variants, splitRatio = 0.5 } = abTest;

    if (!variants || variants.length < 2) {
      return [{ recipients, variant: 'control' }];
    }

    const shuffled = [...recipients].sort(() => Math.random() - 0.5);
    const splitIndex = Math.floor(shuffled.length * splitRatio);

    return [
      {
        recipients: shuffled.slice(0, splitIndex),
        variant: 'control',
        templateId: variants[0].templateId,
        subject: variants[0].subject
      },
      {
        recipients: shuffled.slice(splitIndex),
        variant: 'test',
        templateId: variants[1].templateId,
        subject: variants[1].subject
      }
    ];
  }

  // Validate email data
  validateEmailData(emailData) {
    const { to, subject } = emailData;

    if (!to) {
      throw new Error('Recipient email is required');
    }

    if (!this.isValidEmail(to)) {
      throw new Error('Invalid recipient email format');
    }

    if (!subject && !emailData.templateId && !emailData.templateName) {
      throw new Error('Subject is required when not using a template');
    }
  }

  // Email validation
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Utility functions
  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Tracking functions (to be implemented with analytics service)
  async trackEmailSent(emailData, response) {
    try {
      // Track email metrics
      logger.info('Email tracking - sent', {
        to: emailData.to,
        type: emailData.type || 'transactional',
        templateId: emailData.templateId,
        messageId: response[0].headers['x-message-id']
      });
    } catch (error) {
      logger.error('Failed to track email sent:', error);
    }
  }

  async trackEmailFailed(emailData, error) {
    try {
      logger.error('Email tracking - failed', {
        to: emailData.to,
        type: emailData.type || 'transactional',
        templateId: emailData.templateId,
        error: error.message
      });
    } catch (trackingError) {
      logger.error('Failed to track email failure:', trackingError);
    }
  }

  async trackCampaignSent(campaignResults) {
    try {
      logger.info('Campaign tracking - sent', {
        campaignId: campaignResults.campaignId,
        totalRecipients: campaignResults.totalRecipients,
        groups: campaignResults.groups.length
      });
    } catch (error) {
      logger.error('Failed to track campaign sent:', error);
    }
  }

  // Health check
  async healthCheck() {
    try {
      await this.initialize();
      return {
        status: 'healthy',
        service: 'email',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'email',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new EmailService();