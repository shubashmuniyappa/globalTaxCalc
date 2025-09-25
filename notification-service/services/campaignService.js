const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const emailService = require('./emailService');
const pushService = require('./pushService');
const redis = require('../utils/redis');
const config = require('../config');
const logger = require('../utils/logger');

class CampaignService {
  constructor() {
    this.activeCampaigns = new Map();
    this.campaignQueue = [];
    this.processing = false;
  }

  // Create new email campaign
  async createCampaign(campaignData) {
    try {
      const campaignId = uuidv4();
      const timestamp = new Date().toISOString();

      const campaign = {
        id: campaignId,
        name: campaignData.name,
        description: campaignData.description || '',
        type: campaignData.type || 'email', // email, push, both
        status: 'draft',

        // Content
        subject: campaignData.subject,
        templateId: campaignData.templateId,
        templateName: campaignData.templateName,
        templateData: campaignData.templateData || {},

        // Push notification content (if applicable)
        pushTitle: campaignData.pushTitle,
        pushBody: campaignData.pushBody,
        pushImageUrl: campaignData.pushImageUrl,

        // Targeting
        audience: campaignData.audience || {}, // Segmentation criteria
        recipientLists: campaignData.recipientLists || [],
        excludedLists: campaignData.excludedLists || [],

        // Scheduling
        scheduledAt: campaignData.scheduledAt,
        timezone: campaignData.timezone || 'UTC',

        // A/B Testing
        abTest: campaignData.abTest || null,

        // Tracking
        trackingEnabled: campaignData.trackingEnabled !== false,
        utmParams: campaignData.utmParams || {},

        // Metadata
        createdBy: campaignData.createdBy,
        createdAt: timestamp,
        updatedAt: timestamp,

        // Results (populated after sending)
        results: {
          totalRecipients: 0,
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          unsubscribed: 0,
          bounced: 0,
          failed: 0
        }
      };

      // Validate campaign
      this.validateCampaign(campaign);

      // Store campaign
      await this.storeCampaign(campaign);

      logger.info(`Created campaign: ${campaignId} - ${campaign.name}`);

      return campaign;
    } catch (error) {
      logger.error('Failed to create campaign:', error);
      throw error;
    }
  }

  // Update campaign
  async updateCampaign(campaignId, updates) {
    try {
      const campaign = await this.getCampaign(campaignId);
      if (!campaign) {
        throw new Error(`Campaign not found: ${campaignId}`);
      }

      if (campaign.status === 'sent' || campaign.status === 'sending') {
        throw new Error('Cannot update campaign that has been sent or is being sent');
      }

      const updatedCampaign = {
        ...campaign,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      // Validate updated campaign
      this.validateCampaign(updatedCampaign);

      // Store updated campaign
      await this.storeCampaign(updatedCampaign);

      logger.info(`Updated campaign: ${campaignId}`);

      return updatedCampaign;
    } catch (error) {
      logger.error('Failed to update campaign:', error);
      throw error;
    }
  }

  // Send campaign immediately
  async sendCampaign(campaignId) {
    try {
      const campaign = await this.getCampaign(campaignId);
      if (!campaign) {
        throw new Error(`Campaign not found: ${campaignId}`);
      }

      if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
        throw new Error(`Cannot send campaign with status: ${campaign.status}`);
      }

      // Update status
      campaign.status = 'sending';
      campaign.sentAt = new Date().toISOString();
      await this.storeCampaign(campaign);

      // Get recipients
      const recipients = await this.getCampaignRecipients(campaign);
      if (recipients.length === 0) {
        throw new Error('No recipients found for campaign');
      }

      // Send based on campaign type
      let results;
      switch (campaign.type) {
        case 'email':
          results = await this.sendEmailCampaign(campaign, recipients);
          break;
        case 'push':
          results = await this.sendPushCampaign(campaign, recipients);
          break;
        case 'both':
          results = await this.sendMultiChannelCampaign(campaign, recipients);
          break;
        default:
          throw new Error(`Unknown campaign type: ${campaign.type}`);
      }

      // Update campaign with results
      campaign.status = 'sent';
      campaign.results = results;
      campaign.completedAt = new Date().toISOString();
      await this.storeCampaign(campaign);

      logger.info(`Sent campaign: ${campaignId}`, results);

      return {
        campaignId,
        status: 'sent',
        results
      };
    } catch (error) {
      logger.error(`Failed to send campaign ${campaignId}:`, error);

      // Update campaign status to failed
      try {
        const campaign = await this.getCampaign(campaignId);
        if (campaign) {
          campaign.status = 'failed';
          campaign.error = error.message;
          campaign.failedAt = new Date().toISOString();
          await this.storeCampaign(campaign);
        }
      } catch (updateError) {
        logger.error('Failed to update campaign status:', updateError);
      }

      throw error;
    }
  }

  // Schedule campaign
  async scheduleCampaign(campaignId, scheduledAt, timezone = 'UTC') {
    try {
      const campaign = await this.getCampaign(campaignId);
      if (!campaign) {
        throw new Error(`Campaign not found: ${campaignId}`);
      }

      const scheduleTime = moment.tz(scheduledAt, timezone);
      if (scheduleTime.isBefore(moment())) {
        throw new Error('Cannot schedule campaign in the past');
      }

      campaign.status = 'scheduled';
      campaign.scheduledAt = scheduleTime.utc().toISOString();
      campaign.timezone = timezone;
      campaign.updatedAt = new Date().toISOString();

      await this.storeCampaign(campaign);

      // Add to campaign queue
      this.campaignQueue.push({
        campaignId,
        scheduledAt: scheduleTime.valueOf()
      });

      // Sort queue by scheduled time
      this.campaignQueue.sort((a, b) => a.scheduledAt - b.scheduledAt);

      logger.info(`Scheduled campaign: ${campaignId} for ${scheduleTime.format()}`);

      return {
        campaignId,
        status: 'scheduled',
        scheduledAt: campaign.scheduledAt,
        timezone
      };
    } catch (error) {
      logger.error('Failed to schedule campaign:', error);
      throw error;
    }
  }

  // Send email campaign
  async sendEmailCampaign(campaign, recipients) {
    try {
      // Prepare template data with UTM parameters
      const baseTemplateData = {
        ...campaign.templateData,
        campaignId: campaign.id,
        campaignName: campaign.name,
        utmParams: campaign.utmParams
      };

      // Handle A/B testing
      if (campaign.abTest && campaign.abTest.enabled) {
        return await this.sendABTestEmailCampaign(campaign, recipients, baseTemplateData);
      }

      // Regular campaign
      const emailData = recipients.map(recipient => ({
        to: recipient.email,
        templateId: campaign.templateId,
        templateName: campaign.templateName,
        dynamicTemplateData: {
          ...baseTemplateData,
          firstName: recipient.firstName || 'Valued Customer',
          lastName: recipient.lastName || '',
          ...recipient.customData
        },
        customArgs: {
          campaignId: campaign.id,
          recipientId: recipient.id,
          variant: 'control'
        }
      }));

      const results = await emailService.sendBulkEmails(emailData);

      return {
        totalRecipients: recipients.length,
        sent: results.successful.length,
        failed: results.failed.length,
        delivered: 0, // Will be updated via webhooks
        opened: 0,
        clicked: 0,
        unsubscribed: 0,
        bounced: 0
      };
    } catch (error) {
      logger.error('Failed to send email campaign:', error);
      throw error;
    }
  }

  // Send A/B test email campaign
  async sendABTestEmailCampaign(campaign, recipients, baseTemplateData) {
    try {
      const { variants, splitRatio = 0.5, testDuration = 24 } = campaign.abTest;

      if (!variants || variants.length < 2) {
        throw new Error('A/B test requires at least 2 variants');
      }

      // Split recipients
      const shuffledRecipients = [...recipients].sort(() => Math.random() - 0.5);
      const splitIndex = Math.floor(shuffledRecipients.length * splitRatio);

      const groups = [
        {
          variant: 'control',
          recipients: shuffledRecipients.slice(0, splitIndex),
          templateId: variants[0].templateId,
          templateName: variants[0].templateName,
          subject: variants[0].subject
        },
        {
          variant: 'test',
          recipients: shuffledRecipients.slice(splitIndex),
          templateId: variants[1].templateId,
          templateName: variants[1].templateName,
          subject: variants[1].subject
        }
      ];

      const results = {
        totalRecipients: recipients.length,
        sent: 0,
        failed: 0,
        groups: []
      };

      // Send to each group
      for (const group of groups) {
        const emailData = group.recipients.map(recipient => ({
          to: recipient.email,
          templateId: group.templateId,
          templateName: group.templateName,
          subject: group.subject,
          dynamicTemplateData: {
            ...baseTemplateData,
            firstName: recipient.firstName || 'Valued Customer',
            lastName: recipient.lastName || '',
            ...recipient.customData
          },
          customArgs: {
            campaignId: campaign.id,
            recipientId: recipient.id,
            variant: group.variant,
            abTestId: campaign.abTest.id
          }
        }));

        const groupResults = await emailService.sendBulkEmails(emailData);

        results.sent += groupResults.successful.length;
        results.failed += groupResults.failed.length;

        results.groups.push({
          variant: group.variant,
          recipients: group.recipients.length,
          sent: groupResults.successful.length,
          failed: groupResults.failed.length
        });
      }

      // Schedule A/B test winner selection
      if (campaign.abTest.autoSelectWinner) {
        setTimeout(async () => {
          await this.selectABTestWinner(campaign.id);
        }, testDuration * 60 * 60 * 1000); // Convert hours to milliseconds
      }

      return results;
    } catch (error) {
      logger.error('Failed to send A/B test email campaign:', error);
      throw error;
    }
  }

  // Send push campaign
  async sendPushCampaign(campaign, recipients) {
    try {
      const userIds = recipients.map(r => r.id);

      const results = await pushService.sendCampaignPush({
        userIds,
        title: campaign.pushTitle,
        body: campaign.pushBody,
        imageUrl: campaign.pushImageUrl,
        clickAction: campaign.templateData?.clickAction,
        campaignId: campaign.id
      });

      return {
        totalRecipients: recipients.length,
        sent: results.sent,
        failed: results.failed,
        delivered: results.sent // For push, sent = delivered
      };
    } catch (error) {
      logger.error('Failed to send push campaign:', error);
      throw error;
    }
  }

  // Send multi-channel campaign
  async sendMultiChannelCampaign(campaign, recipients) {
    try {
      const [emailResults, pushResults] = await Promise.all([
        this.sendEmailCampaign(campaign, recipients),
        this.sendPushCampaign(campaign, recipients)
      ]);

      return {
        totalRecipients: recipients.length,
        email: emailResults,
        push: pushResults,
        sent: emailResults.sent + pushResults.sent,
        failed: emailResults.failed + pushResults.failed
      };
    } catch (error) {
      logger.error('Failed to send multi-channel campaign:', error);
      throw error;
    }
  }

  // Get campaign recipients based on audience criteria
  async getCampaignRecipients(campaign) {
    try {
      let recipients = [];

      // Get recipients from lists
      if (campaign.recipientLists && campaign.recipientLists.length > 0) {
        for (const listId of campaign.recipientLists) {
          const listRecipients = await this.getRecipientsFromList(listId);
          recipients = recipients.concat(listRecipients);
        }
      }

      // Apply audience segmentation
      if (campaign.audience && Object.keys(campaign.audience).length > 0) {
        recipients = this.filterRecipientsByAudience(recipients, campaign.audience);
      }

      // Exclude recipients from excluded lists
      if (campaign.excludedLists && campaign.excludedLists.length > 0) {
        const excludedIds = new Set();
        for (const listId of campaign.excludedLists) {
          const excludedRecipients = await this.getRecipientsFromList(listId);
          excludedRecipients.forEach(r => excludedIds.add(r.id));
        }
        recipients = recipients.filter(r => !excludedIds.has(r.id));
      }

      // Remove duplicates
      const uniqueRecipients = new Map();
      recipients.forEach(recipient => {
        uniqueRecipients.set(recipient.id || recipient.email, recipient);
      });

      return Array.from(uniqueRecipients.values());
    } catch (error) {
      logger.error('Failed to get campaign recipients:', error);
      throw error;
    }
  }

  // Filter recipients by audience criteria
  filterRecipientsByAudience(recipients, audience) {
    return recipients.filter(recipient => {
      // Country filter
      if (audience.countries && audience.countries.length > 0) {
        if (!audience.countries.includes(recipient.country)) {
          return false;
        }
      }

      // User type filter
      if (audience.userType) {
        if (audience.userType === 'premium' && !recipient.isPremium) {
          return false;
        }
        if (audience.userType === 'free' && recipient.isPremium) {
          return false;
        }
      }

      // Activity filter
      if (audience.lastActivityDays) {
        const lastActivity = new Date(recipient.lastActivity);
        const daysSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceActivity > audience.lastActivityDays) {
          return false;
        }
      }

      // Registration date filter
      if (audience.registeredAfter) {
        const registrationDate = new Date(recipient.registrationDate);
        if (registrationDate < new Date(audience.registeredAfter)) {
          return false;
        }
      }

      return true;
    });
  }

  // Create recipient list
  async createRecipientList(listData) {
    try {
      const listId = uuidv4();
      const timestamp = new Date().toISOString();

      const list = {
        id: listId,
        name: listData.name,
        description: listData.description || '',
        recipients: listData.recipients || [],
        tags: listData.tags || [],
        createdBy: listData.createdBy,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      // Store list
      const listKey = `recipient_list:${listId}`;
      await redis.client.setEx(listKey, 86400 * 365, JSON.stringify(list)); // 1 year

      logger.info(`Created recipient list: ${listId} - ${list.name} (${list.recipients.length} recipients)`);

      return list;
    } catch (error) {
      logger.error('Failed to create recipient list:', error);
      throw error;
    }
  }

  // Get recipients from list
  async getRecipientsFromList(listId) {
    try {
      const listKey = `recipient_list:${listId}`;
      const listData = await redis.client.get(listKey);

      if (!listData) {
        logger.warn(`Recipient list not found: ${listId}`);
        return [];
      }

      const list = JSON.parse(listData);
      return list.recipients || [];
    } catch (error) {
      logger.error(`Failed to get recipients from list ${listId}:`, error);
      return [];
    }
  }

  // Send seasonal campaign
  async sendSeasonalCampaign(campaignType) {
    try {
      const seasonalCampaigns = {
        tax_season_preparation: {
          name: 'Tax Season Preparation 2024',
          subject: 'Get Ready for Tax Season - Important Updates Inside',
          templateId: config.sendgrid.templates.seasonal,
          templateData: {
            seasonType: 'tax_preparation',
            year: new Date().getFullYear(),
            tips: this.getTaxSeasonTips()
          }
        },
        mid_year_planning: {
          name: 'Mid-Year Tax Planning',
          subject: 'Mid-Year Tax Planning: Strategies to Save More',
          templateId: config.sendgrid.templates.seasonal,
          templateData: {
            seasonType: 'mid_year',
            year: new Date().getFullYear(),
            strategies: this.getMidYearStrategies()
          }
        },
        year_end_tips: {
          name: 'Year-End Tax Tips',
          subject: 'Last Chance: Year-End Tax Savings Opportunities',
          templateId: config.sendgrid.templates.seasonal,
          templateData: {
            seasonType: 'year_end',
            year: new Date().getFullYear(),
            opportunities: this.getYearEndOpportunities()
          }
        }
      };

      const campaignConfig = seasonalCampaigns[campaignType];
      if (!campaignConfig) {
        throw new Error(`Unknown seasonal campaign type: ${campaignType}`);
      }

      // Create and send campaign
      const campaign = await this.createCampaign({
        ...campaignConfig,
        type: 'email',
        audience: {
          countries: ['US', 'CA', 'GB'] // Adjust based on tax relevance
        },
        createdBy: 'system',
        trackingEnabled: true,
        utmParams: {
          source: 'email',
          medium: 'seasonal_campaign',
          campaign: campaignType
        }
      });

      return await this.sendCampaign(campaign.id);
    } catch (error) {
      logger.error(`Failed to send seasonal campaign ${campaignType}:`, error);
      throw error;
    }
  }

  // Validate campaign
  validateCampaign(campaign) {
    if (!campaign.name) {
      throw new Error('Campaign name is required');
    }

    if (campaign.type === 'email' || campaign.type === 'both') {
      if (!campaign.subject && !campaign.templateId) {
        throw new Error('Email subject or template ID is required for email campaigns');
      }
    }

    if (campaign.type === 'push' || campaign.type === 'both') {
      if (!campaign.pushTitle || !campaign.pushBody) {
        throw new Error('Push title and body are required for push campaigns');
      }
    }

    if (campaign.abTest && campaign.abTest.enabled) {
      if (!campaign.abTest.variants || campaign.abTest.variants.length < 2) {
        throw new Error('A/B test requires at least 2 variants');
      }
    }
  }

  // Store campaign
  async storeCampaign(campaign) {
    try {
      const campaignKey = `campaign:${campaign.id}`;
      await redis.client.setEx(campaignKey, 86400 * 365, JSON.stringify(campaign)); // 1 year
      this.activeCampaigns.set(campaign.id, campaign);
    } catch (error) {
      logger.error('Failed to store campaign:', error);
      throw error;
    }
  }

  // Get campaign
  async getCampaign(campaignId) {
    try {
      // Try memory cache first
      if (this.activeCampaigns.has(campaignId)) {
        return this.activeCampaigns.get(campaignId);
      }

      // Try Redis
      const campaignKey = `campaign:${campaignId}`;
      const campaignData = await redis.client.get(campaignKey);

      if (campaignData) {
        const campaign = JSON.parse(campaignData);
        this.activeCampaigns.set(campaignId, campaign);
        return campaign;
      }

      return null;
    } catch (error) {
      logger.error(`Failed to get campaign ${campaignId}:`, error);
      return null;
    }
  }

  // Get campaign analytics
  async getCampaignAnalytics(campaignId) {
    try {
      const campaign = await this.getCampaign(campaignId);
      if (!campaign) {
        throw new Error(`Campaign not found: ${campaignId}`);
      }

      // Get real-time metrics from webhooks/tracking
      const analytics = await this.getRealtimeAnalytics(campaignId);

      return {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          type: campaign.type,
          status: campaign.status,
          sentAt: campaign.sentAt,
          completedAt: campaign.completedAt
        },
        metrics: {
          ...campaign.results,
          ...analytics
        },
        performance: this.calculatePerformanceMetrics(campaign.results, analytics)
      };
    } catch (error) {
      logger.error(`Failed to get campaign analytics ${campaignId}:`, error);
      throw error;
    }
  }

  // Helper methods for seasonal campaigns
  getTaxSeasonTips() {
    return [
      'Organize your tax documents early',
      'Review last year\'s return for missed deductions',
      'Consider tax-loss harvesting for investments',
      'Maximize retirement contributions before the deadline'
    ];
  }

  getMidYearStrategies() {
    return [
      'Adjust your tax withholdings',
      'Make estimated tax payments',
      'Consider Roth IRA conversions',
      'Review your tax strategy with changing income'
    ];
  }

  getYearEndOpportunities() {
    return [
      'Maximize 401(k) contributions',
      'Harvest investment losses',
      'Make charitable donations',
      'Consider equipment purchases for business'
    ];
  }

  // Get real-time analytics (mock implementation)
  async getRealtimeAnalytics(campaignId) {
    // In a real implementation, this would query your analytics service
    return {
      delivered: 0,
      opened: 0,
      clicked: 0,
      unsubscribed: 0,
      bounced: 0
    };
  }

  // Calculate performance metrics
  calculatePerformanceMetrics(results, analytics) {
    const total = results.totalRecipients || 0;

    if (total === 0) {
      return {};
    }

    return {
      deliveryRate: ((analytics.delivered || 0) / total) * 100,
      openRate: ((analytics.opened || 0) / (analytics.delivered || total)) * 100,
      clickRate: ((analytics.clicked || 0) / (analytics.delivered || total)) * 100,
      unsubscribeRate: ((analytics.unsubscribed || 0) / (analytics.delivered || total)) * 100,
      bounceRate: ((analytics.bounced || 0) / total) * 100
    };
  }

  // Process scheduled campaigns
  async processScheduledCampaigns() {
    if (this.processing) return;

    this.processing = true;

    try {
      const now = Date.now();
      const dueCampaigns = [];

      // Find campaigns that are due
      for (let i = 0; i < this.campaignQueue.length; i++) {
        const item = this.campaignQueue[i];
        if (item.scheduledAt <= now) {
          dueCampaigns.push(item);
        } else {
          break; // Queue is sorted, so we can break here
        }
      }

      // Remove due campaigns from queue
      this.campaignQueue.splice(0, dueCampaigns.length);

      // Send due campaigns
      for (const item of dueCampaigns) {
        try {
          await this.sendCampaign(item.campaignId);
        } catch (error) {
          logger.error(`Failed to send scheduled campaign ${item.campaignId}:`, error);
        }
      }

      if (dueCampaigns.length > 0) {
        logger.info(`Processed ${dueCampaigns.length} scheduled campaigns`);
      }
    } catch (error) {
      logger.error('Failed to process scheduled campaigns:', error);
    } finally {
      this.processing = false;
    }
  }

  // Health check
  async healthCheck() {
    try {
      return {
        status: 'healthy',
        service: 'campaign',
        activeCampaigns: this.activeCampaigns.size,
        queuedCampaigns: this.campaignQueue.length,
        processing: this.processing,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'campaign',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new CampaignService();