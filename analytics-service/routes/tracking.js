const express = require('express');
const Joi = require('joi');
const rateLimit = require('express-rate-limit');
const eventTracker = require('../services/eventTracker');
const sessionManager = require('../services/sessionManager');
const abTesting = require('../services/abTesting');
const funnelAnalysis = require('../services/funnelAnalysis');
const privacyService = require('../services/privacyService');
const config = require('../config');
const logger = require('../utils/logger');

const router = express.Router();

// Rate limiting for tracking endpoints
const trackingRateLimit = rateLimit({
  windowMs: config.rateLimit.tracking.windowMs,
  max: config.rateLimit.tracking.max,
  message: 'Too many tracking requests',
  standardHeaders: true,
  legacyHeaders: false
});

// Validation schemas
const eventSchema = Joi.object({
  event_type: Joi.string().required(),
  user_id: Joi.string().optional(),
  page_url: Joi.string().uri().optional(),
  referrer: Joi.string().uri().optional(),
  properties: Joi.object().optional()
});

const conversionSchema = Joi.object({
  conversion_type: Joi.string().required(),
  value: Joi.number().min(0).optional(),
  currency: Joi.string().length(3).default('USD'),
  calculator_type: Joi.string().optional(),
  affiliate_id: Joi.string().optional(),
  campaign_id: Joi.string().optional(),
  properties: Joi.object().optional()
});

const consentSchema = Joi.object({
  user_id: Joi.string().optional(),
  essential: Joi.boolean().default(true),
  analytics: Joi.boolean().default(false),
  marketing: Joi.boolean().default(false),
  personalization: Joi.boolean().default(false),
  method: Joi.string().valid('banner', 'settings', 'api').default('banner'),
  version: Joi.string().default('1.0')
});

// Middleware to check analytics consent
const checkAnalyticsConsent = async (req, res, next) => {
  try {
    const sessionId = req.cookies?.analytics_session;
    if (!sessionId) {
      return res.status(400).json({ error: 'No session found' });
    }

    const hasConsent = await privacyService.hasConsent(sessionId, 'analytics');
    if (!hasConsent) {
      return res.status(403).json({ error: 'Analytics consent required' });
    }

    next();
  } catch (error) {
    logger.error('Error checking analytics consent:', error);
    res.status(500).json({ error: 'Consent check failed' });
  }
};

// POST /track - General event tracking
router.post('/track', trackingRateLimit, async (req, res) => {
  try {
    const { error, value } = eventSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Check consent for non-essential tracking
    if (value.event_type !== 'page_view') {
      const sessionId = req.cookies?.analytics_session;
      if (sessionId) {
        const hasConsent = await privacyService.hasConsent(sessionId, 'analytics');
        if (!hasConsent) {
          return res.status(403).json({ error: 'Analytics consent required' });
        }
      }
    }

    const eventId = await eventTracker.trackPageView(value, req);

    res.json({
      success: true,
      event_id: eventId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error tracking event:', error);
    res.status(500).json({ error: 'Failed to track event' });
  }
});

// POST /track/page-view - Page view tracking
router.post('/track/page-view', trackingRateLimit, async (req, res) => {
  try {
    const eventData = {
      page_url: req.body.page_url || req.headers.referer,
      referrer: req.body.referrer,
      properties: req.body.properties || {}
    };

    const eventId = await eventTracker.trackPageView(eventData, req);

    res.json({
      success: true,
      event_id: eventId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error tracking page view:', error);
    res.status(500).json({ error: 'Failed to track page view' });
  }
});

// POST /track/calculator - Calculator event tracking
router.post('/track/calculator', trackingRateLimit, checkAnalyticsConsent, async (req, res) => {
  try {
    const { type, calculator_type, step, ...eventData } = req.body;

    if (!['start', 'step', 'complete', 'abandon'].includes(type)) {
      return res.status(400).json({ error: 'Invalid calculator event type' });
    }

    const eventType = `calculator_${type}`;
    const properties = {
      calculator_type,
      step,
      ...eventData.properties
    };

    const eventId = await eventTracker.trackCalculatorEvent(eventType, {
      ...eventData,
      properties
    }, req);

    res.json({
      success: true,
      event_id: eventId,
      calculator_type,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error tracking calculator event:', error);
    res.status(500).json({ error: 'Failed to track calculator event' });
  }
});

// POST /track/interaction - User interaction tracking
router.post('/track/interaction', trackingRateLimit, checkAnalyticsConsent, async (req, res) => {
  try {
    const { type, element, ...eventData } = req.body;

    if (!['click', 'scroll', 'form_submit', 'download', 'search'].includes(type)) {
      return res.status(400).json({ error: 'Invalid interaction type' });
    }

    const properties = {
      element,
      ...eventData.properties
    };

    const eventId = await eventTracker.trackInteraction(type, {
      ...eventData,
      properties
    }, req);

    res.json({
      success: true,
      event_id: eventId,
      interaction_type: type,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error tracking interaction:', error);
    res.status(500).json({ error: 'Failed to track interaction' });
  }
});

// POST /track/conversion - Conversion tracking
router.post('/track/conversion', trackingRateLimit, checkAnalyticsConsent, async (req, res) => {
  try {
    const { error, value } = conversionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const eventId = await eventTracker.trackConversion(value, req);

    res.json({
      success: true,
      event_id: eventId,
      conversion_type: value.conversion_type,
      value: value.value || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error tracking conversion:', error);
    res.status(500).json({ error: 'Failed to track conversion' });
  }
});

// POST /track/error - Error tracking
router.post('/track/error', trackingRateLimit, async (req, res) => {
  try {
    const { error_type, message, stack, page_url, ...eventData } = req.body;

    const properties = {
      error_type,
      message,
      stack,
      page_url: page_url || req.headers.referer,
      ...eventData.properties
    };

    const eventId = await eventTracker.trackError({
      ...eventData,
      properties
    }, req);

    res.json({
      success: true,
      event_id: eventId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error tracking error event:', error);
    res.status(500).json({ error: 'Failed to track error' });
  }
});

// POST /track/performance - Performance tracking
router.post('/track/performance', trackingRateLimit, checkAnalyticsConsent, async (req, res) => {
  try {
    const { load_time, dom_ready, page_url, ...eventData } = req.body;

    const properties = {
      load_time,
      dom_ready,
      page_url: page_url || req.headers.referer,
      ...eventData.properties
    };

    const eventId = await eventTracker.trackPerformance({
      ...eventData,
      properties
    }, req);

    res.json({
      success: true,
      event_id: eventId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error tracking performance:', error);
    res.status(500).json({ error: 'Failed to track performance' });
  }
});

// POST /track/funnel - Funnel step tracking
router.post('/track/funnel', trackingRateLimit, checkAnalyticsConsent, async (req, res) => {
  try {
    const { funnel_id, step_name, ...eventData } = req.body;

    if (!funnel_id || !step_name) {
      return res.status(400).json({ error: 'Funnel ID and step name required' });
    }

    const sessionId = req.cookies?.analytics_session;
    if (!sessionId) {
      return res.status(400).json({ error: 'No session found' });
    }

    const success = await funnelAnalysis.trackFunnelEvent(funnel_id, sessionId, step_name, eventData);

    res.json({
      success,
      funnel_id,
      step_name,
      session_id: sessionId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error tracking funnel event:', error);
    res.status(500).json({ error: 'Failed to track funnel event' });
  }
});

// GET /session/progress/:funnel_id - Get funnel progress for current session
router.get('/session/progress/:funnel_id', async (req, res) => {
  try {
    const { funnel_id } = req.params;
    const sessionId = req.cookies?.analytics_session;

    if (!sessionId) {
      return res.status(400).json({ error: 'No session found' });
    }

    const progress = await funnelAnalysis.getFunnelProgress(sessionId, funnel_id);

    res.json({
      funnel_id,
      session_id: sessionId,
      progress: progress || null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting funnel progress:', error);
    res.status(500).json({ error: 'Failed to get funnel progress' });
  }
});

// Privacy and consent endpoints

// POST /consent - Record user consent
router.post('/consent', async (req, res) => {
  try {
    const { error, value } = consentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const sessionId = req.cookies?.analytics_session;
    if (!sessionId) {
      return res.status(400).json({ error: 'No session found' });
    }

    const consentData = {
      ...value,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    };

    const consent = await privacyService.recordConsent(sessionId, consentData);

    // Set consent cookie
    res.cookie('analytics_consent', '1', {
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    res.json({
      success: true,
      consent_id: consent.consent_id,
      session_id: sessionId,
      expires_at: consent.expires_at,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error recording consent:', error);
    res.status(500).json({ error: 'Failed to record consent' });
  }
});

// GET /consent - Get current consent status
router.get('/consent', async (req, res) => {
  try {
    const sessionId = req.cookies?.analytics_session;
    if (!sessionId) {
      return res.status(400).json({ error: 'No session found' });
    }

    const consent = await privacyService.getConsent(sessionId);

    res.json({
      session_id: sessionId,
      consent: consent || null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting consent:', error);
    res.status(500).json({ error: 'Failed to get consent' });
  }
});

// PUT /consent - Update consent preferences
router.put('/consent', async (req, res) => {
  try {
    const sessionId = req.cookies?.analytics_session;
    if (!sessionId) {
      return res.status(400).json({ error: 'No session found' });
    }

    const updates = req.body;
    const consent = await privacyService.updateConsent(sessionId, updates);

    res.json({
      success: true,
      consent_id: consent.consent_id,
      session_id: sessionId,
      updated_consent: consent,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error updating consent:', error);
    res.status(500).json({ error: 'Failed to update consent' });
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'analytics-tracking',
      version: '1.0.0'
    };

    res.json(health);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;