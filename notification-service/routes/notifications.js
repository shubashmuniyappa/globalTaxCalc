const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');
const pushService = require('../services/pushService');
const templateService = require('../services/templateService');
const schedulerService = require('../services/schedulerService');
const campaignService = require('../services/campaignService');
const complianceService = require('../services/complianceService');
const { authenticateToken, validateApiKey } = require('../middleware/auth');
const { rateLimitStrict, rateLimitModerate } = require('../middleware/rateLimit');
const { body, param, query, validationResult } = require('express-validator');

// Send immediate notification
router.post('/send',
  authenticateToken,
  rateLimitStrict,
  [
    body('type').isIn(['email', 'push', 'both']).withMessage('Type must be email, push, or both'),
    body('recipients').isArray({ min: 1 }).withMessage('Recipients must be a non-empty array'),
    body('template').optional().isString(),
    body('subject').if(body('type').isIn(['email', 'both'])).notEmpty().withMessage('Subject required for email notifications'),
    body('content').optional().isString(),
    body('data').optional().isObject(),
    body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']),
    body('scheduledAt').optional().isISO8601(),
    body('campaign').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const {
        type,
        recipients,
        template,
        subject,
        content,
        data = {},
        priority = 'normal',
        scheduledAt,
        campaign
      } = req.body;

      const results = {
        email: null,
        push: null,
        scheduled: false
      };

      // Check if this should be scheduled
      if (scheduledAt && new Date(scheduledAt) > new Date()) {
        const scheduleResult = await schedulerService.scheduleNotification({
          type,
          recipients,
          template,
          subject,
          content,
          data,
          priority,
          scheduledAt,
          campaign
        });

        results.scheduled = true;
        results.scheduleId = scheduleResult.id;

        return res.json({
          success: true,
          message: 'Notification scheduled successfully',
          data: results
        });
      }

      // Process immediate notifications
      if (type === 'email' || type === 'both') {
        // Compliance check for email notifications
        const complianceResult = await complianceService.checkEmailCompliance({
          recipients,
          type: campaign ? 'marketing' : 'transactional'
        });

        if (!complianceResult.canSend) {
          return res.status(400).json({
            success: false,
            message: 'Email compliance check failed',
            details: complianceResult.reasons
          });
        }

        // Filter compliant recipients
        const compliantRecipients = recipients.filter(email =>
          complianceResult.compliantEmails.includes(email)
        );

        if (template) {
          // Use template
          const templateResult = await templateService.renderTemplate(template, data);
          results.email = await emailService.sendTemplateEmail({
            to: compliantRecipients,
            templateId: template,
            dynamicTemplateData: data,
            subject,
            priority,
            campaign
          });
        } else {
          // Use direct content
          results.email = await emailService.sendEmail({
            to: compliantRecipients,
            subject,
            text: content,
            html: content,
            priority,
            campaign
          });
        }
      }

      if (type === 'push' || type === 'both') {
        // Send push notifications
        const pushPromises = recipients.map(async (recipient) => {
          return await pushService.sendPushNotification({
            userId: recipient,
            title: subject,
            body: content || data.message,
            data: data,
            priority
          });
        });

        results.push = await Promise.allSettled(pushPromises);
      }

      res.json({
        success: true,
        message: 'Notifications sent successfully',
        data: results
      });

    } catch (error) {
      console.error('Error sending notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send notification',
        error: error.message
      });
    }
  }
);

// Schedule notification
router.post('/schedule',
  authenticateToken,
  rateLimitModerate,
  [
    body('type').isIn(['email', 'push', 'both']).withMessage('Type must be email, push, or both'),
    body('recipients').isArray({ min: 1 }).withMessage('Recipients must be a non-empty array'),
    body('scheduledAt').isISO8601().withMessage('scheduledAt must be a valid ISO date'),
    body('template').optional().isString(),
    body('subject').if(body('type').isIn(['email', 'both'])).notEmpty().withMessage('Subject required for email notifications'),
    body('content').optional().isString(),
    body('data').optional().isObject(),
    body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']),
    body('campaign').optional().isString(),
    body('recurring').optional().isObject()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const scheduledDate = new Date(req.body.scheduledAt);
      if (scheduledDate <= new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Scheduled time must be in the future'
        });
      }

      const scheduleResult = await schedulerService.scheduleNotification(req.body);

      res.json({
        success: true,
        message: 'Notification scheduled successfully',
        data: {
          scheduleId: scheduleResult.id,
          scheduledAt: scheduledDate,
          status: 'scheduled'
        }
      });

    } catch (error) {
      console.error('Error scheduling notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to schedule notification',
        error: error.message
      });
    }
  }
);

// Get notification preferences for a user
router.get('/preferences/:userId',
  authenticateToken,
  [
    param('userId').notEmpty().withMessage('User ID is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { userId } = req.params;
      const preferences = await complianceService.getUserPreferences(userId);

      res.json({
        success: true,
        data: preferences
      });

    } catch (error) {
      console.error('Error fetching preferences:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch preferences',
        error: error.message
      });
    }
  }
);

// Update notification preferences for a user
router.put('/preferences/:userId',
  authenticateToken,
  rateLimitModerate,
  [
    param('userId').notEmpty().withMessage('User ID is required'),
    body('email').optional().isObject(),
    body('push').optional().isObject(),
    body('timezone').optional().isString(),
    body('language').optional().isString(),
    body('frequency').optional().isObject()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { userId } = req.params;
      const preferences = req.body;

      const result = await complianceService.updateUserPreferences(userId, preferences);

      res.json({
        success: true,
        message: 'Preferences updated successfully',
        data: result
      });

    } catch (error) {
      console.error('Error updating preferences:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update preferences',
        error: error.message
      });
    }
  }
);

// Unsubscribe user from notifications
router.post('/unsubscribe',
  rateLimitModerate,
  [
    body('token').optional().isString(),
    body('email').optional().isEmail(),
    body('userId').optional().isString(),
    body('type').optional().isIn(['all', 'marketing', 'transactional']),
    body('source').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { token, email, userId, type = 'all', source } = req.body;

      if (!token && !email && !userId) {
        return res.status(400).json({
          success: false,
          message: 'Token, email, or userId is required'
        });
      }

      const result = await complianceService.processUnsubscribe({
        token,
        email,
        userId,
        type,
        source
      });

      res.json({
        success: true,
        message: 'Unsubscribe processed successfully',
        data: result
      });

    } catch (error) {
      console.error('Error processing unsubscribe:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process unsubscribe',
        error: error.message
      });
    }
  }
);

// Get notification status/history
router.get('/status/:notificationId',
  authenticateToken,
  [
    param('notificationId').notEmpty().withMessage('Notification ID is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { notificationId } = req.params;

      // This would typically query your notification tracking database
      // For now, returning a mock response structure
      const status = {
        id: notificationId,
        status: 'delivered', // pending, sent, delivered, failed, bounced
        type: 'email',
        sentAt: new Date(),
        deliveredAt: new Date(),
        recipients: [],
        opens: 0,
        clicks: 0,
        bounces: 0,
        complaints: 0
      };

      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      console.error('Error fetching notification status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch notification status',
        error: error.message
      });
    }
  }
);

// Send campaign
router.post('/campaign',
  authenticateToken,
  rateLimitStrict,
  [
    body('name').notEmpty().withMessage('Campaign name is required'),
    body('type').isIn(['email', 'push']).withMessage('Campaign type must be email or push'),
    body('template').notEmpty().withMessage('Template is required'),
    body('subject').if(body('type').equals('email')).notEmpty().withMessage('Subject required for email campaigns'),
    body('audience').isObject().withMessage('Audience configuration is required'),
    body('scheduledAt').optional().isISO8601(),
    body('abTest').optional().isObject()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const campaign = await campaignService.createCampaign(req.body);

      if (req.body.scheduledAt && new Date(req.body.scheduledAt) > new Date()) {
        // Schedule campaign
        await schedulerService.scheduleCampaign(campaign.id, req.body.scheduledAt);

        res.json({
          success: true,
          message: 'Campaign scheduled successfully',
          data: {
            campaignId: campaign.id,
            status: 'scheduled',
            scheduledAt: req.body.scheduledAt
          }
        });
      } else {
        // Send immediately
        const result = await campaignService.sendCampaign(campaign.id);

        res.json({
          success: true,
          message: 'Campaign sent successfully',
          data: {
            campaignId: campaign.id,
            status: 'sent',
            ...result
          }
        });
      }

    } catch (error) {
      console.error('Error sending campaign:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send campaign',
        error: error.message
      });
    }
  }
);

// Get available templates
router.get('/templates',
  authenticateToken,
  [
    query('type').optional().isIn(['email', 'push']),
    query('category').optional().isString()
  ],
  async (req, res) => {
    try {
      const { type, category } = req.query;
      const templates = await templateService.getAvailableTemplates({ type, category });

      res.json({
        success: true,
        data: templates
      });

    } catch (error) {
      console.error('Error fetching templates:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch templates',
        error: error.message
      });
    }
  }
);

// Preview template
router.post('/templates/:templateId/preview',
  authenticateToken,
  [
    param('templateId').notEmpty().withMessage('Template ID is required'),
    body('data').optional().isObject()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { templateId } = req.params;
      const { data = {} } = req.body;

      const preview = await templateService.previewTemplate(templateId, data);

      res.json({
        success: true,
        data: preview
      });

    } catch (error) {
      console.error('Error previewing template:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to preview template',
        error: error.message
      });
    }
  }
);

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        email: await emailService.checkHealth(),
        push: await pushService.checkHealth(),
        templates: await templateService.checkHealth(),
        scheduler: await schedulerService.checkHealth()
      }
    };

    res.json(health);

  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

module.exports = router;