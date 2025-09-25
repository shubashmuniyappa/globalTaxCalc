const cron = require('node-cron');
const moment = require('moment-timezone');
const emailService = require('./emailService');
const pushService = require('./pushService');
const campaignService = require('./campaignService');
const redis = require('../utils/redis');
const config = require('../config');
const logger = require('../utils/logger');

class SchedulerService {
  constructor() {
    this.jobs = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      await redis.connect();

      // Schedule recurring tasks
      this.scheduleRecurringTasks();

      // Schedule tax deadline reminders
      this.scheduleTaxReminders();

      // Schedule marketing campaigns
      this.scheduleMarketingCampaigns();

      // Start cleanup tasks
      this.scheduleCleanupTasks();

      this.initialized = true;
      logger.info('SchedulerService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize SchedulerService:', error);
      throw error;
    }
  }

  // Schedule recurring tasks
  scheduleRecurringTasks() {
    // Daily task - Check and send tax reminders
    this.scheduleJob('daily-tax-reminders', '0 9 * * *', async () => {
      await this.processDailyTaxReminders();
    });

    // Weekly task - Send newsletters
    this.scheduleJob('weekly-newsletter', '0 10 * * 1', async () => {
      await this.processWeeklyNewsletter();
    });

    // Monthly task - Send monthly tax tips
    this.scheduleJob('monthly-tax-tips', '0 9 1 * *', async () => {
      await this.processMonthlyTaxTips();
    });

    // Daily task - Send abandoned calculation reminders
    this.scheduleJob('abandoned-calculations', '0 14 * * *', async () => {
      await this.processAbandonedCalculations();
    });

    // Hourly task - Process scheduled notifications
    this.scheduleJob('process-scheduled', '0 * * * *', async () => {
      await this.processScheduledNotifications();
    });
  }

  // Schedule tax deadline reminders
  scheduleTaxReminders() {
    const countries = Object.keys(config.taxCalendar.countries);

    countries.forEach(country => {
      const countryConfig = config.taxCalendar.countries[country];

      // Individual tax deadlines
      if (countryConfig.deadlines.individual) {
        this.scheduleTaxDeadlineReminders(country, 'individual', countryConfig.deadlines.individual);
      }

      // Business tax deadlines
      if (countryConfig.deadlines.business) {
        this.scheduleTaxDeadlineReminders(country, 'business', countryConfig.deadlines.business);
      }
    });
  }

  // Schedule tax deadline reminders for specific country and type
  scheduleTaxDeadlineReminders(country, taxType, deadlines) {
    const currentYear = new Date().getFullYear();
    const reminderSchedule = config.taxCalendar.countries[country].reminderSchedule?.beforeDeadline || [30, 14, 7, 3, 1];

    Object.entries(deadlines).forEach(([deadlineType, dates]) => {
      if (Array.isArray(dates)) {
        // Quarterly deadlines
        dates.forEach((date, index) => {
          const deadlineDate = moment(`${currentYear}-${date}`, 'YYYY-MM-DD');

          reminderSchedule.forEach(daysBefore => {
            const reminderDate = deadlineDate.clone().subtract(daysBefore, 'days');

            if (reminderDate.isAfter(moment())) {
              const jobId = `tax-reminder-${country}-${taxType}-${deadlineType}-q${index + 1}-${daysBefore}d`;

              this.scheduleJob(jobId, reminderDate.format('m H D M *'), async () => {
                await this.sendTaxDeadlineReminder({
                  country,
                  taxType,
                  deadlineType,
                  deadlineDate: deadlineDate.toDate(),
                  daysUntilDeadline: daysBefore,
                  quarter: index + 1
                });
              });
            }
          });
        });
      } else {
        // Annual deadlines
        const deadlineDate = moment(`${currentYear}-${dates}`, 'YYYY-MM-DD');

        reminderSchedule.forEach(daysBefore => {
          const reminderDate = deadlineDate.clone().subtract(daysBefore, 'days');

          if (reminderDate.isAfter(moment())) {
            const jobId = `tax-reminder-${country}-${taxType}-${deadlineType}-${daysBefore}d`;

            this.scheduleJob(jobId, reminderDate.format('m H D M *'), async () => {
              await this.sendTaxDeadlineReminder({
                country,
                taxType,
                deadlineType,
                deadlineDate: deadlineDate.toDate(),
                daysUntilDeadline: daysBefore
              });
            });
          }
        });
      }
    });
  }

  // Schedule marketing campaigns
  scheduleMarketingCampaigns() {
    // Premium upgrade campaigns
    this.scheduleJob('premium-upgrade-campaign', '0 11 * * 2,5', async () => {
      await this.processPremiumUpgradeCampaign();
    });

    // Re-engagement campaigns
    this.scheduleJob('re-engagement-campaign', '0 15 * * 3', async () => {
      await this.processReEngagementCampaign();
    });

    // Seasonal campaigns
    this.scheduleSeasonalCampaigns();
  }

  // Schedule seasonal campaigns
  scheduleSeasonalCampaigns() {
    // Tax season preparation (January)
    this.scheduleJob('tax-season-prep', '0 10 15 1 *', async () => {
      await campaignService.sendSeasonalCampaign('tax_season_preparation');
    });

    // Mid-year tax planning (July)
    this.scheduleJob('mid-year-planning', '0 10 1 7 *', async () => {
      await campaignService.sendSeasonalCampaign('mid_year_planning');
    });

    // Year-end tax tips (November)
    this.scheduleJob('year-end-tips', '0 10 1 11 *', async () => {
      await campaignService.sendSeasonalCampaign('year_end_tips');
    });
  }

  // Schedule cleanup tasks
  scheduleCleanupTasks() {
    // Clean up old scheduled notifications
    this.scheduleJob('cleanup-old-notifications', '0 2 * * *', async () => {
      await this.cleanupOldNotifications();
    });

    // Clean up failed jobs
    this.scheduleJob('cleanup-failed-jobs', '0 3 * * 0', async () => {
      await this.cleanupFailedJobs();
    });
  }

  // Schedule a cron job
  scheduleJob(jobId, cronExpression, taskFunction) {
    try {
      if (this.jobs.has(jobId)) {
        this.jobs.get(jobId).destroy();
      }

      const job = cron.schedule(cronExpression, async () => {
        try {
          logger.info(`Executing scheduled job: ${jobId}`);
          await taskFunction();
          logger.info(`Completed scheduled job: ${jobId}`);
        } catch (error) {
          logger.error(`Failed to execute scheduled job ${jobId}:`, error);
        }
      }, {
        scheduled: true,
        timezone: 'UTC'
      });

      this.jobs.set(jobId, job);
      logger.info(`Scheduled job: ${jobId} with expression: ${cronExpression}`);
    } catch (error) {
      logger.error(`Failed to schedule job ${jobId}:`, error);
    }
  }

  // Schedule a one-time notification
  async scheduleNotification(notificationData) {
    try {
      const {
        id,
        scheduledAt,
        type,
        channel,
        recipient,
        templateData,
        priority = 'normal'
      } = notificationData;

      const scheduleKey = `scheduled:${id}`;
      const notificationPayload = {
        id,
        type,
        channel,
        recipient,
        templateData,
        priority,
        scheduledAt,
        createdAt: new Date().toISOString(),
        status: 'scheduled'
      };

      // Store in Redis with expiry
      const expiryTime = Math.floor((new Date(scheduledAt).getTime() + 24 * 60 * 60 * 1000) / 1000); // 24 hours after scheduled time
      await redis.client.setEx(scheduleKey, expiryTime, JSON.stringify(notificationPayload));

      // Add to sorted set for processing
      await redis.client.zAdd('scheduled_notifications', {
        score: new Date(scheduledAt).getTime(),
        value: id
      });

      logger.info(`Scheduled notification: ${id} for ${scheduledAt}`);

      return {
        id,
        scheduledAt,
        status: 'scheduled'
      };
    } catch (error) {
      logger.error('Failed to schedule notification:', error);
      throw error;
    }
  }

  // Process scheduled notifications
  async processScheduledNotifications() {
    try {
      const now = Date.now();

      // Get notifications that are due
      const dueNotifications = await redis.client.zRangeByScore('scheduled_notifications', 0, now);

      for (const notificationId of dueNotifications) {
        try {
          await this.processScheduledNotification(notificationId);

          // Remove from scheduled set
          await redis.client.zRem('scheduled_notifications', notificationId);
        } catch (error) {
          logger.error(`Failed to process scheduled notification ${notificationId}:`, error);
        }
      }

      if (dueNotifications.length > 0) {
        logger.info(`Processed ${dueNotifications.length} scheduled notifications`);
      }
    } catch (error) {
      logger.error('Failed to process scheduled notifications:', error);
    }
  }

  // Process individual scheduled notification
  async processScheduledNotification(notificationId) {
    try {
      const scheduleKey = `scheduled:${notificationId}`;
      const notificationData = await redis.client.get(scheduleKey);

      if (!notificationData) {
        logger.warn(`Scheduled notification not found: ${notificationId}`);
        return;
      }

      const notification = JSON.parse(notificationData);

      // Update status
      notification.status = 'processing';
      notification.processedAt = new Date().toISOString();

      await redis.client.setEx(scheduleKey, 3600, JSON.stringify(notification)); // Keep for 1 hour

      // Send notification based on channel
      switch (notification.channel) {
        case 'email':
          await this.sendScheduledEmail(notification);
          break;
        case 'push':
          await this.sendScheduledPush(notification);
          break;
        case 'both':
          await Promise.all([
            this.sendScheduledEmail(notification),
            this.sendScheduledPush(notification)
          ]);
          break;
        default:
          throw new Error(`Unknown notification channel: ${notification.channel}`);
      }

      // Mark as completed
      notification.status = 'completed';
      notification.completedAt = new Date().toISOString();
      await redis.client.setEx(scheduleKey, 3600, JSON.stringify(notification));

      logger.info(`Completed scheduled notification: ${notificationId}`);
    } catch (error) {
      logger.error(`Failed to process scheduled notification ${notificationId}:`, error);

      // Mark as failed
      try {
        const scheduleKey = `scheduled:${notificationId}`;
        const notificationData = await redis.client.get(scheduleKey);
        if (notificationData) {
          const notification = JSON.parse(notificationData);
          notification.status = 'failed';
          notification.error = error.message;
          notification.failedAt = new Date().toISOString();
          await redis.client.setEx(scheduleKey, 3600, JSON.stringify(notification));
        }
      } catch (updateError) {
        logger.error('Failed to update notification status:', updateError);
      }

      throw error;
    }
  }

  // Send scheduled email
  async sendScheduledEmail(notification) {
    try {
      if (notification.templateData.templateId) {
        await emailService.sendTemplateEmail({
          to: notification.recipient.email,
          templateId: notification.templateData.templateId,
          dynamicTemplateData: notification.templateData.data,
          customArgs: {
            notificationId: notification.id,
            scheduled: true
          }
        });
      } else {
        await emailService.sendEmail({
          to: notification.recipient.email,
          subject: notification.templateData.subject,
          templateName: notification.templateData.templateName,
          templateData: notification.templateData.data,
          customArgs: {
            notificationId: notification.id,
            scheduled: true
          }
        });
      }
    } catch (error) {
      logger.error('Failed to send scheduled email:', error);
      throw error;
    }
  }

  // Send scheduled push notification
  async sendScheduledPush(notification) {
    try {
      await pushService.sendPushNotification({
        tokens: notification.recipient.pushTokens,
        title: notification.templateData.title,
        body: notification.templateData.body,
        data: {
          notificationId: notification.id,
          scheduled: true,
          ...notification.templateData.data
        }
      });
    } catch (error) {
      logger.error('Failed to send scheduled push notification:', error);
      throw error;
    }
  }

  // Process daily tax reminders
  async processDailyTaxReminders() {
    try {
      logger.info('Processing daily tax reminders');

      // This would typically query your user database for users with upcoming deadlines
      // For now, we'll just log the activity

      const countries = Object.keys(config.taxCalendar.countries);
      let remindersProcessed = 0;

      for (const country of countries) {
        const countryConfig = config.taxCalendar.countries[country];
        const users = await this.getUsersForTaxReminders(country);

        for (const user of users) {
          try {
            await this.sendUserTaxReminder(user, country, countryConfig);
            remindersProcessed++;
          } catch (error) {
            logger.error(`Failed to send tax reminder to user ${user.id}:`, error);
          }
        }
      }

      logger.info(`Processed ${remindersProcessed} tax reminders`);
    } catch (error) {
      logger.error('Failed to process daily tax reminders:', error);
    }
  }

  // Send tax deadline reminder
  async sendTaxDeadlineReminder(reminderData) {
    try {
      const {
        country,
        taxType,
        deadlineType,
        deadlineDate,
        daysUntilDeadline,
        quarter
      } = reminderData;

      // Get users for this country and tax type
      const users = await this.getUsersForTaxReminders(country, taxType);

      const templateData = {
        country,
        taxType,
        deadlineType,
        taxDeadline: deadlineDate,
        daysUntilDeadline,
        quarter,
        reminderType: this.getReminderType(daysUntilDeadline),
        checklistItems: this.getTaxChecklistItems(country, taxType, deadlineType),
        importantDates: this.getImportantDates(country, deadlineDate),
        taxTips: this.getTaxTips(country, taxType, daysUntilDeadline),
        countryInfo: this.getCountrySpecificInfo(country)
      };

      for (const user of users) {
        try {
          // Check user preferences
          if (!user.preferences?.taxReminders) continue;

          const userTemplateData = {
            ...templateData,
            firstName: user.firstName,
            userId: user.id
          };

          await emailService.sendTemplateEmail({
            to: user.email,
            templateId: config.sendgrid.templates.tax_reminder,
            dynamicTemplateData: userTemplateData,
            customArgs: {
              reminderType: 'tax_deadline',
              country,
              taxType,
              daysUntilDeadline: daysUntilDeadline.toString()
            }
          });

          // Also send push notification if enabled
          if (user.pushTokens && user.preferences?.pushNotifications?.taxReminders) {
            await pushService.sendPushNotification({
              tokens: user.pushTokens,
              title: `Tax Deadline: ${daysUntilDeadline} days left`,
              body: `Don't forget about your ${deadlineType} tax deadline on ${moment(deadlineDate).format('MMMM Do')}`,
              data: {
                type: 'tax_reminder',
                country,
                taxType,
                deadlineDate: deadlineDate.toISOString()
              }
            });
          }
        } catch (error) {
          logger.error(`Failed to send tax reminder to user ${user.id}:`, error);
        }
      }

      logger.info(`Sent tax deadline reminders for ${country} ${taxType} ${deadlineType} (${daysUntilDeadline} days)`);
    } catch (error) {
      logger.error('Failed to send tax deadline reminder:', error);
      throw error;
    }
  }

  // Process abandoned calculations
  async processAbandonedCalculations() {
    try {
      // Get abandoned calculations from the last 24-72 hours
      const abandonedCalculations = await this.getAbandonedCalculations();

      for (const calculation of abandonedCalculations) {
        try {
          await emailService.sendTemplateEmail({
            to: calculation.userEmail,
            templateId: config.sendgrid.templates.abandoned_calculation,
            dynamicTemplateData: {
              firstName: calculation.firstName,
              calculationType: calculation.type,
              progress: calculation.progress,
              continueUrl: `${process.env.BASE_URL}/calculator/${calculation.id}/continue`,
              estimatedTimeToComplete: this.calculateTimeToComplete(calculation.progress)
            },
            customArgs: {
              reminderType: 'abandoned_calculation',
              calculationId: calculation.id
            }
          });
        } catch (error) {
          logger.error(`Failed to send abandoned calculation reminder to ${calculation.userEmail}:`, error);
        }
      }

      logger.info(`Processed ${abandonedCalculations.length} abandoned calculation reminders`);
    } catch (error) {
      logger.error('Failed to process abandoned calculations:', error);
    }
  }

  // Process premium upgrade campaign
  async processPremiumUpgradeCampaign() {
    try {
      // Get eligible users for premium upgrade
      const eligibleUsers = await this.getEligibleUsersForPremium();

      for (const user of eligibleUsers) {
        try {
          const templateData = {
            firstName: user.firstName,
            userId: user.id,
            userStats: {
              calculationsUsed: user.calculationsUsed,
              lastLoginDate: user.lastLoginDate
            },
            specialOffer: this.generateSpecialOffer(user),
            pricing: this.getPricingData(user.country),
            testimonials: this.getPremiumTestimonials()
          };

          await emailService.sendTemplateEmail({
            to: user.email,
            templateId: config.sendgrid.templates.premium_upgrade,
            dynamicTemplateData: templateData,
            customArgs: {
              campaignType: 'premium_upgrade',
              userId: user.id.toString()
            }
          });
        } catch (error) {
          logger.error(`Failed to send premium upgrade email to user ${user.id}:`, error);
        }
      }

      logger.info(`Sent premium upgrade campaign to ${eligibleUsers.length} users`);
    } catch (error) {
      logger.error('Failed to process premium upgrade campaign:', error);
    }
  }

  // Utility methods for getting data (these would typically query your database)
  async getUsersForTaxReminders(country, taxType = null) {
    // Mock implementation - in reality, this would query your user database
    return [
      {
        id: 'user1',
        email: 'user1@example.com',
        firstName: 'John',
        country: country,
        taxType: taxType,
        preferences: {
          taxReminders: true,
          pushNotifications: { taxReminders: true }
        },
        pushTokens: ['token1']
      }
    ];
  }

  async getAbandonedCalculations() {
    // Mock implementation
    return [
      {
        id: 'calc1',
        userEmail: 'user@example.com',
        firstName: 'John',
        type: 'income_tax',
        progress: 0.6,
        lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
      }
    ];
  }

  async getEligibleUsersForPremium() {
    // Mock implementation
    return [
      {
        id: 'user1',
        email: 'user@example.com',
        firstName: 'Jane',
        country: 'US',
        calculationsUsed: 8,
        lastLoginDate: new Date(),
        isPremium: false
      }
    ];
  }

  // Helper methods
  getReminderType(daysUntilDeadline) {
    if (daysUntilDeadline <= 0) return 'overdue';
    if (daysUntilDeadline <= 1) return 'last_chance';
    return 'before_deadline';
  }

  getTaxChecklistItems(country, taxType, deadlineType) {
    // Return country/type specific checklist
    return [
      { description: 'Gather all tax documents (W-2, 1099, receipts)', completed: false, tip: 'Check your email and mail for missing documents' },
      { description: 'Review last year\'s tax return', completed: false, tip: 'This helps identify potential deductions you might miss' },
      { description: 'Calculate estimated taxes owed', completed: false, tip: 'Use our calculator to get an accurate estimate' },
      { description: 'File your tax return', completed: false }
    ];
  }

  getImportantDates(country, deadlineDate) {
    // Return important dates for the country
    return [
      { name: 'Tax Filing Deadline', date: deadlineDate },
      { name: 'Extension Deadline', date: new Date(deadlineDate.getTime() + 6 * 30 * 24 * 60 * 60 * 1000) }
    ];
  }

  getTaxTips(country, taxType, daysUntilDeadline) {
    return [
      {
        title: 'Maximize Your Deductions',
        description: 'Don\'t forget about business expenses, charitable donations, and education costs.'
      },
      {
        title: 'Double-Check Your Math',
        description: 'Simple calculation errors are the most common reason for IRS notices.'
      }
    ];
  }

  getCountrySpecificInfo(country) {
    const countryData = {
      'US': {
        name: 'United States',
        specificInfo: 'Federal taxes are due April 15th. State taxes may have different deadlines.',
        penalties: 'Late filing penalty is 5% per month, up to 25% of unpaid taxes.'
      },
      'CA': {
        name: 'Canada',
        specificInfo: 'Individual tax returns are due April 30th.',
        penalties: 'Late filing penalty is 5% of unpaid taxes plus 1% per month.'
      }
    };

    return countryData[country] || null;
  }

  generateSpecialOffer(user) {
    // Generate personalized offers based on user behavior
    return {
      description: 'First Month Free',
      discount: 100,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };
  }

  getPricingData(country) {
    return {
      monthlyPrice: 9.99,
      originalPrice: 9.99,
      discountedPrice: 0.00,
      currency: 'USD',
      annualSavings: 119.88,
      moneyBackGuarantee: true
    };
  }

  getPremiumTestimonials() {
    return [
      {
        quote: 'Premium features saved me over $2,000 in taxes this year!',
        name: 'Sarah Johnson',
        title: 'Small Business Owner',
        stars: [1, 1, 1, 1, 1]
      }
    ];
  }

  calculateTimeToComplete(progress) {
    const totalMinutes = 10;
    const remainingMinutes = Math.ceil(totalMinutes * (1 - progress));
    return `${remainingMinutes} minutes`;
  }

  // Cleanup methods
  async cleanupOldNotifications() {
    try {
      const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago

      // Remove old notifications from sorted set
      await redis.client.zRemRangeByScore('scheduled_notifications', 0, cutoffTime);

      logger.info('Cleaned up old scheduled notifications');
    } catch (error) {
      logger.error('Failed to cleanup old notifications:', error);
    }
  }

  async cleanupFailedJobs() {
    try {
      // Clean up failed job records
      const keys = await redis.client.keys('scheduled:*');
      let cleanedCount = 0;

      for (const key of keys) {
        try {
          const data = await redis.client.get(key);
          if (data) {
            const notification = JSON.parse(data);
            const createdAt = new Date(notification.createdAt);
            const isOld = Date.now() - createdAt.getTime() > (24 * 60 * 60 * 1000); // 24 hours

            if (isOld && (notification.status === 'failed' || notification.status === 'completed')) {
              await redis.client.del(key);
              cleanedCount++;
            }
          }
        } catch (error) {
          logger.error(`Error processing key ${key}:`, error);
        }
      }

      logger.info(`Cleaned up ${cleanedCount} old job records`);
    } catch (error) {
      logger.error('Failed to cleanup failed jobs:', error);
    }
  }

  // Cancel scheduled notification
  async cancelScheduledNotification(notificationId) {
    try {
      // Remove from sorted set
      await redis.client.zRem('scheduled_notifications', notificationId);

      // Update status in Redis
      const scheduleKey = `scheduled:${notificationId}`;
      const notificationData = await redis.client.get(scheduleKey);

      if (notificationData) {
        const notification = JSON.parse(notificationData);
        notification.status = 'cancelled';
        notification.cancelledAt = new Date().toISOString();
        await redis.client.setEx(scheduleKey, 3600, JSON.stringify(notification));
      }

      logger.info(`Cancelled scheduled notification: ${notificationId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to cancel scheduled notification ${notificationId}:`, error);
      throw error;
    }
  }

  // Get scheduled notification status
  async getScheduledNotificationStatus(notificationId) {
    try {
      const scheduleKey = `scheduled:${notificationId}`;
      const notificationData = await redis.client.get(scheduleKey);

      if (!notificationData) {
        return null;
      }

      return JSON.parse(notificationData);
    } catch (error) {
      logger.error(`Failed to get notification status ${notificationId}:`, error);
      throw error;
    }
  }

  // Stop scheduler
  async stop() {
    try {
      for (const [jobId, job] of this.jobs) {
        job.destroy();
        logger.info(`Stopped scheduled job: ${jobId}`);
      }

      this.jobs.clear();
      this.initialized = false;

      logger.info('SchedulerService stopped');
    } catch (error) {
      logger.error('Failed to stop SchedulerService:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    try {
      return {
        status: 'healthy',
        service: 'scheduler',
        activeJobs: this.jobs.size,
        initialized: this.initialized,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'scheduler',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new SchedulerService();