const admin = require('firebase-admin');
const config = require('../config');
const logger = require('../utils/logger');
const redis = require('../utils/redis');

class PushService {
  constructor() {
    this.initialized = false;
    this.app = null;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      if (!config.firebase.projectId || !config.firebase.privateKey || !config.firebase.clientEmail) {
        throw new Error('Firebase configuration is incomplete');
      }

      // Initialize Firebase Admin SDK
      const serviceAccount = {
        type: 'service_account',
        project_id: config.firebase.projectId,
        private_key: config.firebase.privateKey,
        client_email: config.firebase.clientEmail
      };

      this.app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: config.firebase.databaseURL
      }, 'notification-service');

      this.messaging = admin.messaging(this.app);
      this.initialized = true;

      logger.info('PushService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize PushService:', error);
      throw error;
    }
  }

  // Send push notification to single device
  async sendPushNotification(notificationData) {
    await this.initialize();

    try {
      const {
        token,
        tokens,
        title,
        body,
        data = {},
        imageUrl,
        clickAction,
        badge,
        sound = 'default',
        priority = 'high',
        timeToLive = 86400, // 24 hours
        collapseKey,
        analytics = true
      } = notificationData;

      // Validate tokens
      const targetTokens = this.validateTokens(token ? [token] : tokens);
      if (targetTokens.length === 0) {
        throw new Error('No valid push tokens provided');
      }

      // Build notification payload
      const notification = {
        title,
        body
      };

      if (imageUrl) {
        notification.imageUrl = imageUrl;
      }

      // Build data payload
      const dataPayload = {
        timestamp: new Date().toISOString(),
        service: 'notification-service',
        ...data
      };

      // Convert all data values to strings (FCM requirement)
      Object.keys(dataPayload).forEach(key => {
        if (typeof dataPayload[key] !== 'string') {
          dataPayload[key] = JSON.stringify(dataPayload[key]);
        }
      });

      // Build message
      const message = {
        notification,
        data: dataPayload,
        android: {
          priority,
          ttl: timeToLive * 1000,
          notification: {
            sound,
            clickAction,
            badge: badge ? badge.toString() : undefined,
            channelId: 'tax_notifications'
          },
          data: dataPayload
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title,
                body
              },
              sound,
              badge,
              'content-available': 1
            }
          },
          headers: {
            'apns-expiration': Math.floor(Date.now() / 1000) + timeToLive,
            'apns-priority': priority === 'high' ? '10' : '5'
          }
        },
        webpush: {
          notification: {
            title,
            body,
            icon: process.env.PUSH_ICON_URL || `${process.env.ASSETS_URL}/images/icon-192.png`,
            badge: process.env.PUSH_BADGE_URL || `${process.env.ASSETS_URL}/images/badge-72.png`,
            image: imageUrl,
            requireInteraction: priority === 'high',
            actions: this.buildWebPushActions(data.type)
          },
          headers: {
            TTL: timeToLive.toString()
          },
          data: dataPayload
        }
      };

      if (collapseKey) {
        message.android.collapseKey = collapseKey;
        message.apns.headers['apns-collapse-id'] = collapseKey;
      }

      let results;

      if (targetTokens.length === 1) {
        // Single token
        message.token = targetTokens[0];
        const response = await this.messaging.send(message);
        results = {
          successCount: 1,
          failureCount: 0,
          responses: [{ success: true, messageId: response }]
        };
      } else {
        // Multiple tokens
        const multicastMessage = {
          ...message,
          tokens: targetTokens
        };
        delete multicastMessage.token;

        results = await this.messaging.sendMulticast(multicastMessage);
      }

      // Process results and update token validity
      await this.processResults(targetTokens, results, analytics);

      logger.info('Push notification sent successfully', {
        title,
        tokensCount: targetTokens.length,
        successCount: results.successCount,
        failureCount: results.failureCount
      });

      return {
        success: true,
        successCount: results.successCount,
        failureCount: results.failureCount,
        results: results.responses,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to send push notification:', error);
      throw error;
    }
  }

  // Send push notification to topic
  async sendTopicNotification(topicData) {
    await this.initialize();

    try {
      const {
        topic,
        title,
        body,
        data = {},
        imageUrl,
        condition,
        analytics = true
      } = topicData;

      if (!topic && !condition) {
        throw new Error('Topic or condition is required');
      }

      const notification = {
        title,
        body,
        imageUrl
      };

      const dataPayload = {
        timestamp: new Date().toISOString(),
        service: 'notification-service',
        ...data
      };

      // Convert all data values to strings
      Object.keys(dataPayload).forEach(key => {
        if (typeof dataPayload[key] !== 'string') {
          dataPayload[key] = JSON.stringify(dataPayload[key]);
        }
      });

      const message = {
        notification,
        data: dataPayload,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'tax_notifications'
          }
        },
        apns: {
          payload: {
            aps: {
              alert: { title, body },
              sound: 'default'
            }
          }
        },
        webpush: {
          notification: {
            title,
            body,
            icon: process.env.PUSH_ICON_URL || `${process.env.ASSETS_URL}/images/icon-192.png`,
            image: imageUrl
          }
        }
      };

      if (topic) {
        message.topic = topic;
      } else if (condition) {
        message.condition = condition;
      }

      const messageId = await this.messaging.send(message);

      if (analytics) {
        await this.trackTopicNotification(topic || condition, title, messageId);
      }

      logger.info('Topic notification sent successfully', {
        topic: topic || condition,
        title,
        messageId
      });

      return {
        success: true,
        messageId,
        topic: topic || condition,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to send topic notification:', error);
      throw error;
    }
  }

  // Subscribe token to topic
  async subscribeToTopic(tokens, topic) {
    await this.initialize();

    try {
      const validTokens = this.validateTokens(Array.isArray(tokens) ? tokens : [tokens]);

      if (validTokens.length === 0) {
        throw new Error('No valid tokens provided');
      }

      const response = await this.messaging.subscribeToTopic(validTokens, topic);

      logger.info('Subscribed tokens to topic', {
        topic,
        tokensCount: validTokens.length,
        successCount: response.successCount,
        failureCount: response.failureCount
      });

      return {
        success: true,
        topic,
        successCount: response.successCount,
        failureCount: response.failureCount,
        errors: response.errors
      };
    } catch (error) {
      logger.error('Failed to subscribe to topic:', error);
      throw error;
    }
  }

  // Unsubscribe token from topic
  async unsubscribeFromTopic(tokens, topic) {
    await this.initialize();

    try {
      const validTokens = this.validateTokens(Array.isArray(tokens) ? tokens : [tokens]);

      if (validTokens.length === 0) {
        throw new Error('No valid tokens provided');
      }

      const response = await this.messaging.unsubscribeFromTopic(validTokens, topic);

      logger.info('Unsubscribed tokens from topic', {
        topic,
        tokensCount: validTokens.length,
        successCount: response.successCount,
        failureCount: response.failureCount
      });

      return {
        success: true,
        topic,
        successCount: response.successCount,
        failureCount: response.failureCount,
        errors: response.errors
      };
    } catch (error) {
      logger.error('Failed to unsubscribe from topic:', error);
      throw error;
    }
  }

  // Send notification with user preferences
  async sendNotificationWithPreferences(notificationData) {
    try {
      const { userId, ...notificationPayload } = notificationData;

      // Get user preferences
      const preferences = await this.getUserPushPreferences(userId);

      if (!preferences.enabled) {
        logger.info(`Push notifications disabled for user ${userId}`);
        return { success: false, reason: 'Push notifications disabled' };
      }

      // Check specific notification type preferences
      if (notificationPayload.data?.type && !this.isNotificationTypeAllowed(notificationPayload.data.type, preferences)) {
        logger.info(`Notification type ${notificationPayload.data.type} not allowed for user ${userId}`);
        return { success: false, reason: 'Notification type not allowed' };
      }

      // Get user's push tokens
      const tokens = await this.getUserPushTokens(userId);

      if (!tokens || tokens.length === 0) {
        logger.info(`No push tokens found for user ${userId}`);
        return { success: false, reason: 'No push tokens' };
      }

      // Send notification
      return await this.sendPushNotification({
        ...notificationPayload,
        tokens
      });
    } catch (error) {
      logger.error('Failed to send notification with preferences:', error);
      throw error;
    }
  }

  // Send tax deadline reminder push notification
  async sendTaxDeadlineReminder(reminderData) {
    try {
      const {
        userId,
        country,
        taxType,
        deadlineDate,
        daysUntilDeadline
      } = reminderData;

      const title = daysUntilDeadline === 1
        ? 'Tax Deadline Tomorrow!'
        : `Tax Deadline: ${daysUntilDeadline} Days Left`;

      const body = `Don't forget your ${taxType} tax deadline on ${new Date(deadlineDate).toLocaleDateString()}`;

      return await this.sendNotificationWithPreferences({
        userId,
        title,
        body,
        data: {
          type: 'tax_reminder',
          country,
          taxType,
          deadlineDate: deadlineDate.toISOString(),
          daysUntilDeadline: daysUntilDeadline.toString(),
          clickAction: '/tax-calendar'
        },
        priority: daysUntilDeadline <= 3 ? 'high' : 'normal',
        badge: 1
      });
    } catch (error) {
      logger.error('Failed to send tax deadline reminder push:', error);
      throw error;
    }
  }

  // Send campaign push notification
  async sendCampaignPush(campaignData) {
    try {
      const {
        userIds,
        title,
        body,
        imageUrl,
        clickAction,
        campaignId,
        segmentId
      } = campaignData;

      const results = {
        sent: 0,
        failed: 0,
        errors: []
      };

      for (const userId of userIds) {
        try {
          const result = await this.sendNotificationWithPreferences({
            userId,
            title,
            body,
            imageUrl,
            data: {
              type: 'campaign',
              campaignId,
              segmentId,
              clickAction
            },
            priority: 'normal'
          });

          if (result.success) {
            results.sent++;
          } else {
            results.failed++;
            results.errors.push({ userId, reason: result.reason });
          }
        } catch (error) {
          results.failed++;
          results.errors.push({ userId, error: error.message });
        }
      }

      logger.info('Campaign push notifications sent', {
        campaignId,
        sent: results.sent,
        failed: results.failed
      });

      return results;
    } catch (error) {
      logger.error('Failed to send campaign push notifications:', error);
      throw error;
    }
  }

  // Validate push tokens
  validateTokens(tokens) {
    if (!Array.isArray(tokens)) {
      return [];
    }

    return tokens.filter(token => {
      if (!token || typeof token !== 'string') {
        return false;
      }

      // Basic FCM token validation
      if (token.length < 140 || token.length > 200) {
        return false;
      }

      return true;
    });
  }

  // Process FCM results and update token validity
  async processResults(tokens, results, analytics = true) {
    try {
      for (let i = 0; i < results.responses.length; i++) {
        const result = results.responses[i];
        const token = tokens[i];

        if (result.success) {
          // Update token as valid
          await this.markTokenAsValid(token);

          if (analytics) {
            await this.trackPushSent(token, result.messageId);
          }
        } else {
          // Handle errors
          const errorCode = result.error?.code;

          if (this.isTokenInvalid(errorCode)) {
            await this.markTokenAsInvalid(token, errorCode);
            logger.warn(`Invalid push token removed: ${token.substring(0, 20)}...`);
          } else {
            logger.error(`Push notification failed for token ${token.substring(0, 20)}...:`, result.error);
          }

          if (analytics) {
            await this.trackPushFailed(token, errorCode);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to process push results:', error);
    }
  }

  // Check if error code indicates invalid token
  isTokenInvalid(errorCode) {
    const invalidErrorCodes = [
      'messaging/invalid-registration-token',
      'messaging/registration-token-not-registered',
      'messaging/invalid-argument'
    ];

    return invalidErrorCodes.includes(errorCode);
  }

  // Mark token as valid
  async markTokenAsValid(token) {
    try {
      const key = `push_token:valid:${token}`;
      await redis.client.setEx(key, 86400 * 30, 'true'); // 30 days
    } catch (error) {
      logger.error('Failed to mark token as valid:', error);
    }
  }

  // Mark token as invalid
  async markTokenAsInvalid(token, reason) {
    try {
      // Remove from valid tokens
      await redis.client.del(`push_token:valid:${token}`);

      // Add to invalid tokens
      const key = `push_token:invalid:${token}`;
      await redis.client.setEx(key, 86400 * 7, reason); // 7 days

      // TODO: Remove from user's token list in database
    } catch (error) {
      logger.error('Failed to mark token as invalid:', error);
    }
  }

  // Build web push actions based on notification type
  buildWebPushActions(notificationType) {
    const actions = {
      tax_reminder: [
        { action: 'calculate', title: 'Calculate Taxes', icon: '/icons/calculator.png' },
        { action: 'dismiss', title: 'Dismiss', icon: '/icons/dismiss.png' }
      ],
      campaign: [
        { action: 'view', title: 'View Offer', icon: '/icons/view.png' },
        { action: 'dismiss', title: 'Not Now', icon: '/icons/dismiss.png' }
      ],
      default: [
        { action: 'open', title: 'Open App', icon: '/icons/open.png' }
      ]
    };

    return actions[notificationType] || actions.default;
  }

  // Get user push preferences (mock implementation)
  async getUserPushPreferences(userId) {
    try {
      const key = `user_preferences:push:${userId}`;
      const preferences = await redis.client.get(key);

      if (preferences) {
        return JSON.parse(preferences);
      }

      // Default preferences
      return {
        enabled: true,
        taxReminders: true,
        marketing: false,
        productUpdates: true,
        breakingNews: false
      };
    } catch (error) {
      logger.error('Failed to get user push preferences:', error);
      return { enabled: false };
    }
  }

  // Get user push tokens (mock implementation)
  async getUserPushTokens(userId) {
    try {
      const key = `user_push_tokens:${userId}`;
      const tokens = await redis.client.sMembers(key);
      return tokens || [];
    } catch (error) {
      logger.error('Failed to get user push tokens:', error);
      return [];
    }
  }

  // Check if notification type is allowed
  isNotificationTypeAllowed(notificationType, preferences) {
    const typeMap = {
      'tax_reminder': 'taxReminders',
      'campaign': 'marketing',
      'product_update': 'productUpdates',
      'breaking_news': 'breakingNews'
    };

    const preferenceKey = typeMap[notificationType];
    return preferenceKey ? preferences[preferenceKey] : true;
  }

  // Register user push token
  async registerPushToken(userId, token, deviceInfo = {}) {
    try {
      if (!this.validateTokens([token]).length) {
        throw new Error('Invalid push token');
      }

      // Add token to user's token set
      const userTokensKey = `user_push_tokens:${userId}`;
      await redis.client.sAdd(userTokensKey, token);

      // Store token info
      const tokenInfoKey = `push_token_info:${token}`;
      const tokenInfo = {
        userId,
        registeredAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
        deviceInfo,
        isValid: true
      };

      await redis.client.setEx(tokenInfoKey, 86400 * 60, JSON.stringify(tokenInfo)); // 60 days

      // Mark as valid
      await this.markTokenAsValid(token);

      logger.info(`Registered push token for user ${userId}`);

      return {
        success: true,
        token,
        userId,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to register push token:', error);
      throw error;
    }
  }

  // Unregister user push token
  async unregisterPushToken(userId, token) {
    try {
      // Remove from user's token set
      const userTokensKey = `user_push_tokens:${userId}`;
      await redis.client.sRem(userTokensKey, token);

      // Remove token info
      await redis.client.del(`push_token_info:${token}`);
      await redis.client.del(`push_token:valid:${token}`);

      logger.info(`Unregistered push token for user ${userId}`);

      return {
        success: true,
        token,
        userId,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to unregister push token:', error);
      throw error;
    }
  }

  // Analytics tracking methods
  async trackPushSent(token, messageId) {
    try {
      // Track push notification metrics
      logger.info('Push notification sent', { token: token.substring(0, 20) + '...', messageId });
    } catch (error) {
      logger.error('Failed to track push sent:', error);
    }
  }

  async trackPushFailed(token, errorCode) {
    try {
      logger.error('Push notification failed', { token: token.substring(0, 20) + '...', errorCode });
    } catch (error) {
      logger.error('Failed to track push failed:', error);
    }
  }

  async trackTopicNotification(topic, title, messageId) {
    try {
      logger.info('Topic notification sent', { topic, title, messageId });
    } catch (error) {
      logger.error('Failed to track topic notification:', error);
    }
  }

  // Health check
  async healthCheck() {
    try {
      await this.initialize();

      // Test Firebase connection by getting a dummy token info
      // This is a basic connectivity test

      return {
        status: 'healthy',
        service: 'push',
        initialized: this.initialized,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'push',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new PushService();