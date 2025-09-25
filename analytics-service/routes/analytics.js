const express = require('express');
const Joi = require('joi');
const rateLimit = require('express-rate-limit');
const dashboardService = require('../services/dashboardService');
const funnelAnalysis = require('../services/funnelAnalysis');
const sessionManager = require('../services/sessionManager');
const abTesting = require('../services/abTesting');
const privacyService = require('../services/privacyService');
const clickhouse = require('../utils/clickhouse');
const redis = require('../utils/redis');
const config = require('../config');
const logger = require('../utils/logger');

const router = express.Router();

// Rate limiting for API endpoints
const apiRateLimit = rateLimit({
  windowMs: config.rateLimit.api.windowMs,
  max: config.rateLimit.api.max,
  message: 'Too many API requests',
  standardHeaders: true,
  legacyHeaders: false
});

// Validation schemas
const timeRangeSchema = Joi.string().valid('1h', '24h', '7d', '30d', '90d').default('24h');
const dateRangeSchema = Joi.object({
  start_date: Joi.date().iso().required(),
  end_date: Joi.date().iso().min(Joi.ref('start_date')).required()
});

// Simple API key authentication
const authenticate = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  if (!apiKey || apiKey !== config.external?.api_key) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  next();
};

// Dashboard endpoints

// GET /analytics/dashboard - Real-time dashboard
router.get('/dashboard', apiRateLimit, authenticate, async (req, res) => {
  try {
    const dashboard = await dashboardService.getRealTimeDashboard();

    res.json({
      success: true,
      data: dashboard,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting real-time dashboard:', error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

// GET /analytics/dashboard/historical - Historical dashboard
router.get('/dashboard/historical', apiRateLimit, authenticate, async (req, res) => {
  try {
    const { error, value } = timeRangeSchema.validate(req.query.time_range);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const dashboard = await dashboardService.getHistoricalDashboard(value);

    res.json({
      success: true,
      time_range: value,
      data: dashboard,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting historical dashboard:', error);
    res.status(500).json({ error: 'Failed to get historical dashboard data' });
  }
});

// GET /analytics/dashboard/ab-testing - A/B testing dashboard
router.get('/dashboard/ab-testing', apiRateLimit, authenticate, async (req, res) => {
  try {
    const dashboard = await dashboardService.getABTestingDashboard();

    res.json({
      success: true,
      data: dashboard,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting A/B testing dashboard:', error);
    res.status(500).json({ error: 'Failed to get A/B testing dashboard data' });
  }
});

// Funnel analysis endpoints

// GET /analytics/funnel/:funnel_id - Analyze specific funnel
router.get('/funnel/:funnel_id', apiRateLimit, authenticate, async (req, res) => {
  try {
    const { funnel_id } = req.params;
    const options = {
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      segment_by: req.query.segment_by,
      cohort_period: req.query.cohort_period
    };

    const analysis = await funnelAnalysis.analyzeFunnel(funnel_id, options);

    res.json({
      success: true,
      funnel_id,
      data: analysis,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error analyzing funnel:', error);
    res.status(500).json({ error: 'Failed to analyze funnel' });
  }
});

// POST /analytics/funnel - Create new funnel
router.post('/funnel', apiRateLimit, authenticate, async (req, res) => {
  try {
    const funnelConfig = req.body;
    const funnel = await funnelAnalysis.createFunnel(funnelConfig);

    res.json({
      success: true,
      data: funnel,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error creating funnel:', error);
    res.status(500).json({ error: 'Failed to create funnel' });
  }
});

// Session analytics endpoints

// GET /analytics/sessions - Session analytics
router.get('/sessions', apiRateLimit, authenticate, async (req, res) => {
  try {
    const { error, value } = timeRangeSchema.validate(req.query.time_range);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const analytics = await sessionManager.getSessionAnalytics(value);

    res.json({
      success: true,
      time_range: value,
      data: analytics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting session analytics:', error);
    res.status(500).json({ error: 'Failed to get session analytics' });
  }
});

// GET /analytics/sessions/criteria - Get sessions by criteria
router.get('/sessions/criteria', apiRateLimit, authenticate, async (req, res) => {
  try {
    const criteria = {
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      country: req.query.country,
      device_type: req.query.device_type,
      traffic_source: req.query.traffic_source,
      conversion: req.query.conversion === 'true' ? true : req.query.conversion === 'false' ? false : undefined,
      is_bot: req.query.is_bot === 'true' ? true : req.query.is_bot === 'false' ? false : undefined,
      limit: parseInt(req.query.limit) || 100
    };

    const sessions = await sessionManager.getSessionsByCriteria(criteria);

    res.json({
      success: true,
      criteria,
      data: sessions,
      count: sessions.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting sessions by criteria:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

// A/B Testing endpoints

// GET /ab-test/:experiment_id - Get experiment assignment
router.get('/ab-test/:experiment_id', apiRateLimit, async (req, res) => {
  try {
    const { experiment_id } = req.params;
    const userId = req.query.user_id || req.headers['x-user-id'];
    const sessionId = req.cookies?.analytics_session || req.headers['x-session-id'];

    if (!userId && !sessionId) {
      return res.status(400).json({ error: 'User ID or session ID required' });
    }

    const userProperties = {
      country: req.query.country,
      device_type: req.query.device_type,
      traffic_source: req.query.traffic_source,
      user_id: userId
    };

    const assignment = await abTesting.assignVariant(experiment_id, userId || sessionId, sessionId, userProperties);

    res.json({
      success: true,
      experiment_id,
      assignment: assignment || null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting A/B test assignment:', error);
    res.status(500).json({ error: 'Failed to get experiment assignment' });
  }
});

// POST /ab-test/:experiment_id/conversion - Track A/B test conversion
router.post('/ab-test/:experiment_id/conversion', apiRateLimit, async (req, res) => {
  try {
    const { experiment_id } = req.params;
    const userId = req.body.user_id || req.headers['x-user-id'];
    const conversionData = {
      value: req.body.value || 0,
      properties: req.body.properties || {}
    };

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const success = await abTesting.trackConversion(experiment_id, userId, conversionData);

    res.json({
      success,
      experiment_id,
      user_id: userId,
      conversion_tracked: success,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error tracking A/B test conversion:', error);
    res.status(500).json({ error: 'Failed to track conversion' });
  }
});

// GET /ab-test/:experiment_id/results - Get experiment results
router.get('/ab-test/:experiment_id/results', apiRateLimit, authenticate, async (req, res) => {
  try {
    const { experiment_id } = req.params;
    const results = await abTesting.getExperimentResults(experiment_id);

    res.json({
      success: true,
      experiment_id,
      data: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting experiment results:', error);
    res.status(500).json({ error: 'Failed to get experiment results' });
  }
});

// POST /ab-test - Create new experiment
router.post('/ab-test', apiRateLimit, authenticate, async (req, res) => {
  try {
    const experimentConfig = req.body;
    const experiment = await abTesting.createExperiment(experimentConfig);

    res.json({
      success: true,
      data: experiment,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error creating experiment:', error);
    res.status(500).json({ error: 'Failed to create experiment' });
  }
});

// PUT /ab-test/:experiment_id/start - Start experiment
router.put('/ab-test/:experiment_id/start', apiRateLimit, authenticate, async (req, res) => {
  try {
    const { experiment_id } = req.params;
    const experiment = await abTesting.startExperiment(experiment_id);

    res.json({
      success: true,
      experiment_id,
      data: experiment,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error starting experiment:', error);
    res.status(500).json({ error: 'Failed to start experiment' });
  }
});

// PUT /ab-test/:experiment_id/end - End experiment
router.put('/ab-test/:experiment_id/end', apiRateLimit, authenticate, async (req, res) => {
  try {
    const { experiment_id } = req.params;
    const experiment = await abTesting.endExperiment(experiment_id);

    res.json({
      success: true,
      experiment_id,
      data: experiment,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error ending experiment:', error);
    res.status(500).json({ error: 'Failed to end experiment' });
  }
});

// Privacy endpoints

// POST /privacy/delete - Request data deletion
router.post('/privacy/delete', apiRateLimit, async (req, res) => {
  try {
    const deletionRequest = {
      user_id: req.body.user_id,
      email: req.body.email,
      session_ids: req.body.session_ids,
      reason: req.body.reason || 'user_request',
      verification_token: req.body.verification_token
    };

    if (!deletionRequest.user_id && (!deletionRequest.session_ids || deletionRequest.session_ids.length === 0)) {
      return res.status(400).json({ error: 'User ID or session IDs required' });
    }

    const result = await privacyService.requestDataDeletion(deletionRequest);

    res.json({
      success: true,
      data: result,
      message: deletionRequest.email ? 'Verification email sent' : 'Deletion request created',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error requesting data deletion:', error);
    res.status(500).json({ error: 'Failed to request data deletion' });
  }
});

// POST /privacy/verify-deletion - Verify deletion request
router.post('/privacy/verify-deletion', apiRateLimit, async (req, res) => {
  try {
    const { verification_token } = req.body;

    if (!verification_token) {
      return res.status(400).json({ error: 'Verification token required' });
    }

    const result = await privacyService.verifyDeletion(verification_token);

    res.json({
      success: true,
      data: result,
      message: 'Deletion request verified and queued for processing',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error verifying deletion:', error);
    res.status(500).json({ error: 'Failed to verify deletion request' });
  }
});

// GET /privacy/deletion-status/:request_id - Get deletion status
router.get('/privacy/deletion-status/:request_id', apiRateLimit, async (req, res) => {
  try {
    const { request_id } = req.params;
    const status = await privacyService.getDeletionStatus(request_id);

    if (!status) {
      return res.status(404).json({ error: 'Deletion request not found' });
    }

    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting deletion status:', error);
    res.status(500).json({ error: 'Failed to get deletion status' });
  }
});

// POST /privacy/export - Export user data
router.post('/privacy/export', apiRateLimit, async (req, res) => {
  try {
    const exportRequest = {
      user_id: req.body.user_id,
      session_ids: req.body.session_ids,
      email: req.body.email
    };

    if (!exportRequest.user_id && (!exportRequest.session_ids || exportRequest.session_ids.length === 0)) {
      return res.status(400).json({ error: 'User ID or session IDs required' });
    }

    const exportData = await privacyService.exportUserData(exportRequest);

    res.json({
      success: true,
      data: exportData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error exporting user data:', error);
    res.status(500).json({ error: 'Failed to export user data' });
  }
});

// POST /privacy/anonymize - Anonymize user data
router.post('/privacy/anonymize', apiRateLimit, authenticate, async (req, res) => {
  try {
    const anonymizationRequest = {
      user_id: req.body.user_id,
      session_ids: req.body.session_ids
    };

    if (!anonymizationRequest.user_id && (!anonymizationRequest.session_ids || anonymizationRequest.session_ids.length === 0)) {
      return res.status(400).json({ error: 'User ID or session IDs required' });
    }

    const result = await privacyService.anonymizeUserData(anonymizationRequest);

    res.json({
      success: true,
      data: result,
      message: 'User data anonymized successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error anonymizing user data:', error);
    res.status(500).json({ error: 'Failed to anonymize user data' });
  }
});

// GET /privacy/policy-data - Get privacy policy data
router.get('/privacy/policy-data', async (req, res) => {
  try {
    const policyData = privacyService.generatePrivacyPolicyData();

    res.json({
      success: true,
      data: policyData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting privacy policy data:', error);
    res.status(500).json({ error: 'Failed to get privacy policy data' });
  }
});

// GET /privacy/compliance-status - Get compliance status
router.get('/privacy/compliance-status', apiRateLimit, authenticate, async (req, res) => {
  try {
    const status = await privacyService.getComplianceStatus();

    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting compliance status:', error);
    res.status(500).json({ error: 'Failed to get compliance status' });
  }
});

// Custom query endpoint (admin only)
router.post('/query', apiRateLimit, authenticate, async (req, res) => {
  try {
    const { query, format = 'JSONEachRow' } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Basic security: only allow SELECT queries
    if (!query.trim().toLowerCase().startsWith('select')) {
      return res.status(403).json({ error: 'Only SELECT queries are allowed' });
    }

    const results = await clickhouse.query(query, format);

    res.json({
      success: true,
      data: results,
      query,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error executing custom query:', error);
    res.status(500).json({ error: 'Query execution failed' });
  }
});

// Health check
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'analytics-api',
      version: '1.0.0',
      dependencies: {
        clickhouse: await clickhouse.healthCheck(),
        redis: await redis.healthCheck()
      }
    };

    const allHealthy = Object.values(health.dependencies).every(dep => dep.status === 'healthy');

    if (!allHealthy) {
      health.status = 'degraded';
    }

    res.status(allHealthy ? 200 : 503).json(health);
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