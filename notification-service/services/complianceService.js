const crypto = require('crypto');
const moment = require('moment');
const redis = require('../utils/redis');
const config = require('../config');
const logger = require('../utils/logger');

class ComplianceService {
  constructor() {
    this.unsubscribeTokens = new Map();
    this.suppressionList = new Set();
  }

  // Check if email can be sent (compliance check)
  async checkEmailCompliance(emailData) {
    try {
      const { to, type = 'transactional', templateId, campaignId } = emailData;

      // Check suppression list
      if (await this.isEmailSuppressed(to)) {
        return {
          allowed: false,
          reason: 'Email is on suppression list'
        };
      }

      // Check unsubscribe status
      const unsubscribeStatus = await this.getUnsubscribeStatus(to);
      if (unsubscribeStatus.isUnsubscribed) {
        // Allow transactional emails even if unsubscribed from marketing
        if (type === 'marketing' || type === 'campaign') {
          return {
            allowed: false,
            reason: 'User unsubscribed from marketing emails'
          };
        }
      }

      // Check user preferences
      const preferences = await this.getUserPreferences(to);
      if (!this.isEmailTypeAllowed(type, preferences)) {
        return {
          allowed: false,
          reason: 'Email type not allowed by user preferences'
        };
      }

      // Check rate limiting for marketing emails
      if (type === 'marketing' || type === 'campaign') {
        const rateLimitCheck = await this.checkMarketingRateLimit(to);
        if (!rateLimitCheck.allowed) {
          return {
            allowed: false,
            reason: rateLimitCheck.reason
          };
        }
      }

      // GDPR consent check
      if (config.compliance.gdpr.enabled) {
        const consentCheck = await this.checkGDPRConsent(to, type);
        if (!consentCheck.allowed) {
          return {
            allowed: false,
            reason: consentCheck.reason
          };
        }
      }

      return {
        allowed: true,
        reason: 'Compliance checks passed'
      };
    } catch (error) {
      logger.error('Error in compliance check:', error);
      return {
        allowed: false,
        reason: 'Compliance check failed'
      };
    }
  }

  // Generate unsubscribe token
  async generateUnsubscribeToken(email, expirationDays = 30) {
    try {
      const tokenId = crypto.randomBytes(32).toString('hex');
      const expiresAt = moment().add(expirationDays, 'days').toISOString();

      const tokenData = {
        email,
        tokenId,
        createdAt: new Date().toISOString(),
        expiresAt,
        used: false
      };

      // Store token
      const tokenKey = `unsubscribe_token:${tokenId}`;
      await redis.client.setEx(tokenKey, expirationDays * 24 * 60 * 60, JSON.stringify(tokenData));

      return tokenId;
    } catch (error) {
      logger.error('Failed to generate unsubscribe token:', error);
      throw error;
    }
  }

  // Process unsubscribe request
  async processUnsubscribe(token, unsubscribeData = {}) {
    try {
      const tokenData = await this.getUnsubscribeToken(token);
      if (!tokenData) {
        throw new Error('Invalid or expired unsubscribe token');
      }

      if (tokenData.used) {
        throw new Error('Unsubscribe token already used');
      }

      const {
        email,
        unsubscribeTypes = ['all'],
        reason = 'user_request',
        feedback = ''
      } = unsubscribeData;

      // Validate email matches token
      if (email && email !== tokenData.email) {
        throw new Error('Email does not match token');
      }

      const unsubscribeRecord = {
        email: tokenData.email,
        unsubscribeTypes,
        reason,
        feedback,
        token,
        unsubscribedAt: new Date().toISOString(),
        ipAddress: unsubscribeData.ipAddress,
        userAgent: unsubscribeData.userAgent
      };

      // Update user preferences
      await this.updateUnsubscribePreferences(tokenData.email, unsubscribeTypes);

      // Add to suppression list if unsubscribing from all
      if (unsubscribeTypes.includes('all')) {
        await this.addToSuppressionList(tokenData.email, reason);
      }

      // Mark token as used
      tokenData.used = true;
      tokenData.usedAt = new Date().toISOString();
      const tokenKey = `unsubscribe_token:${token}`;
      await redis.client.setEx(tokenKey, 7 * 24 * 60 * 60, JSON.stringify(tokenData)); // Keep for 7 days

      // Store unsubscribe record for compliance
      const recordKey = `unsubscribe_record:${tokenData.email}:${Date.now()}`;
      await redis.client.setEx(recordKey, 365 * 24 * 60 * 60, JSON.stringify(unsubscribeRecord)); // Keep for 1 year

      logger.info('Processed unsubscribe request', {
        email: tokenData.email,
        types: unsubscribeTypes,
        reason
      });

      return {
        success: true,
        email: tokenData.email,
        unsubscribeTypes,
        message: 'Successfully unsubscribed'
      };
    } catch (error) {
      logger.error('Failed to process unsubscribe:', error);
      throw error;
    }
  }

  // Get unsubscribe token data
  async getUnsubscribeToken(token) {
    try {
      const tokenKey = `unsubscribe_token:${token}`;
      const tokenData = await redis.client.get(tokenKey);

      if (!tokenData) {
        return null;
      }

      const data = JSON.parse(tokenData);

      // Check if token has expired
      if (moment().isAfter(moment(data.expiresAt))) {
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Failed to get unsubscribe token:', error);
      return null;
    }
  }

  // Update user unsubscribe preferences
  async updateUnsubscribePreferences(email, unsubscribeTypes) {
    try {
      const preferencesKey = `user_preferences:${email}`;
      let preferences = await redis.client.get(preferencesKey);

      preferences = preferences ? JSON.parse(preferences) : {
        email: {
          marketing: true,
          transactional: true,
          newsletters: true,
          promotions: true,
          reminders: true
        }
      };

      // Update preferences based on unsubscribe types
      unsubscribeTypes.forEach(type => {
        switch (type) {
          case 'all':
            Object.keys(preferences.email).forEach(key => {
              if (key !== 'transactional') { // Keep transactional emails
                preferences.email[key] = false;
              }
            });
            break;
          case 'marketing':
            preferences.email.marketing = false;
            preferences.email.promotions = false;
            break;
          case 'newsletters':
            preferences.email.newsletters = false;
            break;
          case 'reminders':
            preferences.email.reminders = false;
            break;
          default:
            if (preferences.email[type] !== undefined) {
              preferences.email[type] = false;
            }
        }
      });

      preferences.updatedAt = new Date().toISOString();

      // Store updated preferences
      await redis.client.setEx(preferencesKey, 365 * 24 * 60 * 60, JSON.stringify(preferences)); // 1 year

      return preferences;
    } catch (error) {
      logger.error('Failed to update unsubscribe preferences:', error);
      throw error;
    }
  }

  // Add email to suppression list
  async addToSuppressionList(email, reason = 'unsubscribed') {
    try {
      const suppressionRecord = {
        email,
        reason,
        addedAt: new Date().toISOString(),
        source: 'unsubscribe'
      };

      const suppressionKey = `suppression:${email}`;
      await redis.client.setEx(suppressionKey, 365 * 24 * 60 * 60, JSON.stringify(suppressionRecord)); // 1 year

      this.suppressionList.add(email);

      logger.info('Added email to suppression list', { email, reason });
    } catch (error) {
      logger.error('Failed to add email to suppression list:', error);
      throw error;
    }
  }

  // Check if email is suppressed
  async isEmailSuppressed(email) {
    try {
      // Check memory cache first
      if (this.suppressionList.has(email)) {
        return true;
      }

      // Check Redis
      const suppressionKey = `suppression:${email}`;
      const suppressionData = await redis.client.get(suppressionKey);

      if (suppressionData) {
        this.suppressionList.add(email);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to check suppression status:', error);
      return false; // Fail open to avoid blocking legitimate emails
    }
  }

  // Get unsubscribe status
  async getUnsubscribeStatus(email) {
    try {
      const isSupressed = await this.isEmailSuppressed(email);
      const preferences = await this.getUserPreferences(email);

      return {
        email,
        isUnsubscribed: isSupressed || !preferences.email.marketing,
        preferences: preferences.email,
        lastUpdated: preferences.updatedAt
      };
    } catch (error) {
      logger.error('Failed to get unsubscribe status:', error);
      return {
        email,
        isUnsubscribed: false,
        preferences: {},
        lastUpdated: null
      };
    }
  }

  // Get user preferences
  async getUserPreferences(email) {
    try {
      const preferencesKey = `user_preferences:${email}`;
      const preferences = await redis.client.get(preferencesKey);

      if (preferences) {
        return JSON.parse(preferences);
      }

      // Return default preferences
      return {
        email: {
          marketing: false, // Default to opt-in for GDPR compliance
          transactional: true,
          newsletters: false,
          promotions: false,
          reminders: true
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to get user preferences:', error);
      return {
        email: {
          marketing: false,
          transactional: true,
          newsletters: false,
          promotions: false,
          reminders: false
        }
      };
    }
  }

  // Update user preferences
  async updateUserPreferences(email, newPreferences) {
    try {
      const currentPreferences = await this.getUserPreferences(email);

      const updatedPreferences = {
        ...currentPreferences,
        email: {
          ...currentPreferences.email,
          ...newPreferences.email
        },
        push: {
          ...currentPreferences.push,
          ...newPreferences.push
        },
        updatedAt: new Date().toISOString()
      };

      const preferencesKey = `user_preferences:${email}`;
      await redis.client.setEx(preferencesKey, 365 * 24 * 60 * 60, JSON.stringify(updatedPreferences));

      // Remove from suppression list if re-subscribing to marketing
      if (newPreferences.email?.marketing === true) {
        await this.removeFromSuppressionList(email);
      }

      logger.info('Updated user preferences', { email });

      return updatedPreferences;
    } catch (error) {
      logger.error('Failed to update user preferences:', error);
      throw error;
    }
  }

  // Remove email from suppression list
  async removeFromSuppressionList(email) {
    try {
      const suppressionKey = `suppression:${email}`;
      await redis.client.del(suppressionKey);
      this.suppressionList.delete(email);

      logger.info('Removed email from suppression list', { email });
    } catch (error) {
      logger.error('Failed to remove email from suppression list:', error);
      throw error;
    }
  }

  // Check if email type is allowed
  isEmailTypeAllowed(emailType, preferences) {
    const typeMapping = {
      'transactional': 'transactional',
      'marketing': 'marketing',
      'campaign': 'marketing',
      'newsletter': 'newsletters',
      'promotion': 'promotions',
      'reminder': 'reminders',
      'tax_reminder': 'reminders'
    };

    const preferenceKey = typeMapping[emailType] || 'marketing';
    return preferences.email[preferenceKey] !== false;
  }

  // Check marketing email rate limits
  async checkMarketingRateLimit(email) {
    try {
      const now = moment();
      const weekStart = now.clone().startOf('week');
      const monthStart = now.clone().startOf('month');

      // Check weekly limit
      const weeklyKey = `marketing_sent:${email}:${weekStart.format('YYYY-WW')}`;
      const weeklySent = await redis.client.get(weeklyKey) || 0;

      if (parseInt(weeklySent) >= config.notifications.defaultPreferences.frequency.max_marketing_per_week) {
        return {
          allowed: false,
          reason: 'Weekly marketing email limit exceeded'
        };
      }

      // Check monthly limit for reminders
      const monthlyKey = `reminders_sent:${email}:${monthStart.format('YYYY-MM')}`;
      const monthlySent = await redis.client.get(monthlyKey) || 0;

      if (parseInt(monthlySent) >= config.notifications.defaultPreferences.frequency.max_reminders_per_month) {
        return {
          allowed: false,
          reason: 'Monthly reminder limit exceeded'
        };
      }

      return {
        allowed: true,
        weeklyCount: parseInt(weeklySent),
        monthlyCount: parseInt(monthlySent)
      };
    } catch (error) {
      logger.error('Failed to check marketing rate limit:', error);
      return { allowed: true }; // Fail open
    }
  }

  // Increment marketing email count
  async incrementMarketingCount(email, emailType) {
    try {
      const now = moment();

      if (emailType === 'marketing' || emailType === 'campaign') {
        const weekStart = now.clone().startOf('week');
        const weeklyKey = `marketing_sent:${email}:${weekStart.format('YYYY-WW')}`;
        await redis.client.incr(weeklyKey);
        await redis.client.expire(weeklyKey, 7 * 24 * 60 * 60); // 1 week
      }

      if (emailType === 'reminder' || emailType === 'tax_reminder') {
        const monthStart = now.clone().startOf('month');
        const monthlyKey = `reminders_sent:${email}:${monthStart.format('YYYY-MM')}`;
        await redis.client.incr(monthlyKey);
        await redis.client.expire(monthlyKey, 31 * 24 * 60 * 60); // 1 month
      }
    } catch (error) {
      logger.error('Failed to increment marketing count:', error);
    }
  }

  // GDPR consent management
  async checkGDPRConsent(email, emailType) {
    try {
      if (!config.compliance.gdpr.enabled) {
        return { allowed: true };
      }

      const consentKey = `gdpr_consent:${email}`;
      const consentData = await redis.client.get(consentKey);

      if (!consentData) {
        // No consent record - only allow transactional emails
        if (emailType === 'transactional') {
          return { allowed: true };
        }

        return {
          allowed: false,
          reason: 'GDPR consent required for marketing emails'
        };
      }

      const consent = JSON.parse(consentData);

      // Check if consent covers this email type
      if (emailType === 'marketing' || emailType === 'campaign') {
        if (!consent.marketing) {
          return {
            allowed: false,
            reason: 'GDPR marketing consent not granted'
          };
        }
      }

      return { allowed: true };
    } catch (error) {
      logger.error('Failed to check GDPR consent:', error);
      return { allowed: false, reason: 'GDPR consent check failed' };
    }
  }

  // Record GDPR consent
  async recordGDPRConsent(email, consentData) {
    try {
      const consent = {
        email,
        marketing: consentData.marketing || false,
        analytics: consentData.analytics || false,
        functional: consentData.functional || true,
        consentedAt: new Date().toISOString(),
        ipAddress: consentData.ipAddress,
        userAgent: consentData.userAgent,
        method: consentData.method || 'web_form',
        version: consentData.version || '1.0'
      };

      const consentKey = `gdpr_consent:${email}`;
      await redis.client.setEx(consentKey, 365 * 24 * 60 * 60, JSON.stringify(consent)); // 1 year

      // Update user preferences to reflect consent
      if (consent.marketing) {
        await this.updateUserPreferences(email, {
          email: {
            marketing: true,
            newsletters: true,
            promotions: true
          }
        });
      }

      logger.info('Recorded GDPR consent', { email, marketing: consent.marketing });

      return consent;
    } catch (error) {
      logger.error('Failed to record GDPR consent:', error);
      throw error;
    }
  }

  // Process bounce notification
  async processBounce(bounceData) {
    try {
      const { email, bounceType, reason, timestamp } = bounceData;

      // Store bounce record
      const bounceRecord = {
        email,
        bounceType, // hard, soft, complaint
        reason,
        timestamp,
        processedAt: new Date().toISOString()
      };

      const bounceKey = `bounce:${email}:${Date.now()}`;
      await redis.client.setEx(bounceKey, 365 * 24 * 60 * 60, JSON.stringify(bounceRecord)); // 1 year

      // Handle hard bounces
      if (bounceType === 'hard' || bounceType === 'complaint') {
        await this.addToSuppressionList(email, `${bounceType}_bounce`);
        logger.warn(`Added ${email} to suppression list due to ${bounceType} bounce`);
      }

      // Handle soft bounces (track but don't suppress immediately)
      if (bounceType === 'soft') {
        await this.trackSoftBounce(email);
      }

      logger.info('Processed bounce notification', { email, bounceType });
    } catch (error) {
      logger.error('Failed to process bounce:', error);
    }
  }

  // Track soft bounces and suppress after threshold
  async trackSoftBounce(email) {
    try {
      const softBounceKey = `soft_bounces:${email}`;
      const bounceCount = await redis.client.incr(softBounceKey);
      await redis.client.expire(softBounceKey, 30 * 24 * 60 * 60); // 30 days

      // Suppress after 5 soft bounces
      if (bounceCount >= 5) {
        await this.addToSuppressionList(email, 'excessive_soft_bounces');
        await redis.client.del(softBounceKey);
        logger.warn(`Suppressed ${email} due to excessive soft bounces`);
      }
    } catch (error) {
      logger.error('Failed to track soft bounce:', error);
    }
  }

  // Generate preference center URL
  generatePreferenceCenterUrl(email) {
    const token = crypto
      .createHash('sha256')
      .update(email + config.server.env + process.env.JWT_SECRET)
      .digest('hex');

    const baseUrl = process.env.BASE_URL || 'https://globaltaxcalc.com';
    return `${baseUrl}/preferences?email=${encodeURIComponent(email)}&token=${token}`;
  }

  // Validate preference center token
  validatePreferenceCenterToken(email, token) {
    const expectedToken = crypto
      .createHash('sha256')
      .update(email + config.server.env + process.env.JWT_SECRET)
      .digest('hex');

    return token === expectedToken;
  }

  // Get compliance summary
  async getComplianceSummary() {
    try {
      // Get suppression list count
      const suppressionKeys = await redis.client.keys('suppression:*');
      const suppressionCount = suppressionKeys.length;

      // Get unsubscribe records from last 30 days
      const thirtyDaysAgo = moment().subtract(30, 'days').valueOf();
      const unsubscribeKeys = await redis.client.keys('unsubscribe_record:*');
      let recentUnsubscribes = 0;

      for (const key of unsubscribeKeys) {
        const keyTimestamp = parseInt(key.split(':')[2]);
        if (keyTimestamp >= thirtyDaysAgo) {
          recentUnsubscribes++;
        }
      }

      // Get bounce counts
      const bounceKeys = await redis.client.keys('bounce:*');
      const totalBounces = bounceKeys.length;

      return {
        suppressionList: {
          totalEmails: suppressionCount,
          lastUpdated: new Date().toISOString()
        },
        unsubscribes: {
          last30Days: recentUnsubscribes
        },
        bounces: {
          total: totalBounces
        },
        compliance: {
          canSpamEnabled: config.compliance.canSpam.enabled,
          gdprEnabled: config.compliance.gdpr.enabled,
          unsubscribeLinksRequired: config.compliance.canSpam.unsubscribeRequired
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to get compliance summary:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    try {
      return {
        status: 'healthy',
        service: 'compliance',
        suppressionListSize: this.suppressionList.size,
        features: {
          canSpam: config.compliance.canSpam.enabled,
          gdpr: config.compliance.gdpr.enabled
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'compliance',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new ComplianceService();