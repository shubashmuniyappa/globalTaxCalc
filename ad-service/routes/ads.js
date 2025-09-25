const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');

// Import services
const placementService = require('../services/placementService');
const adNetworkService = require('../services/adNetworkService');
const abTestService = require('../services/abTestService');
const revenueOptimizationService = require('../services/revenueOptimizationService');
const loadingOptimizationService = require('../services/loadingOptimizationService');
const analyticsService = require('../services/analyticsService');
const contentFilteringService = require('../services/contentFilteringService');

// Import middleware
const { authenticateToken, validateApiKey, optionalAuth } = require('../middleware/auth');
const { rateLimitStrict, rateLimitModerate, rateLimitLenient } = require('../middleware/rateLimit');

// GET /ads/placement/{location} - Get ad for placement
router.get('/placement/:location',
  optionalAuth, // Allow both authenticated and anonymous access
  rateLimitLenient,
  [
    param('location').isIn([
      'header', 'sidebar', 'content_top', 'content_middle',
      'content_bottom', 'footer', 'mobile_sticky'
    ]).withMessage('Invalid placement location'),
    query('country').optional().isAlpha({ length: 2 }).withMessage('Country must be 2-letter code'),
    query('device').optional().isIn(['desktop', 'tablet', 'mobile']).withMessage('Invalid device type'),
    query('calculatorType').optional().isString(),
    query('abTestId').optional().isUUID()
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

      const { location } = req.params;
      const context = {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        country: req.query.country,
        device: req.query.device,
        calculatorType: req.query.calculatorType,
        userId: req.user?.id,
        sessionId: req.sessionID || req.get('X-Session-ID'),
        abTestId: req.query.abTestId,
        screenWidth: parseInt(req.query.screenWidth) || 1920,
        url: req.get('Referer')
      };

      // Get ad placement
      const placement = await placementService.getAdPlacement(location, context);

      if (!placement) {
        return res.status(404).json({
          success: false,
          message: 'No ad placement available for this location'
        });
      }

      // Get optimized ad code
      const optimizedCode = await loadingOptimizationService.getOptimizedAdCode(placement, context);

      // Apply content filtering
      const filterResult = await contentFilteringService.filterAd({
        id: placement.id,
        advertiser: placement.networks[0],
        categories: placement.targeting.categories,
        content: optimizedCode.adCode
      }, context);

      if (!filterResult.allowed) {
        return res.status(204).json({
          success: true,
          message: 'Ad blocked by content filters',
          reasons: filterResult.reasons
        });
      }

      // Track impression
      await analyticsService.trackImpression(
        placement.id,
        placement.networks[0],
        context
      );

      res.json({
        success: true,
        placement: {
          id: placement.id,
          location: placement.location,
          size: placement.size,
          code: optimizedCode.adCode,
          monitoringCode: optimizedCode.monitoringCode,
          loadingStrategy: optimizedCode.strategy,
          loadingConfig: optimizedCode.loadingConfig
        },
        metadata: {
          network: placement.networks[0],
          qualityScore: filterResult.score,
          abTestVariant: context.abTestVariant?.id
        }
      });

    } catch (error) {
      console.error('Error getting ad placement:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get ad placement',
        error: error.message
      });
    }
  }
);

// POST /ads/impression - Track ad impression
router.post('/impression',
  rateLimitModerate,
  [
    body('placementId').notEmpty().withMessage('Placement ID is required'),
    body('networkName').notEmpty().withMessage('Network name is required'),
    body('viewabilityScore').optional().isFloat({ min: 0, max: 1 }),
    body('country').optional().isAlpha({ length: 2 }),
    body('device').optional().isIn(['desktop', 'tablet', 'mobile'])
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

      const context = {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        country: req.body.country,
        device: req.body.device,
        calculatorType: req.body.calculatorType,
        userId: req.user?.id,
        sessionId: req.body.sessionId,
        viewabilityScore: req.body.viewabilityScore,
        adSize: req.body.adSize,
        position: req.body.position
      };

      const impressionId = await analyticsService.trackImpression(
        req.body.placementId,
        req.body.networkName,
        context
      );

      res.json({
        success: true,
        impressionId: impressionId,
        message: 'Impression tracked successfully'
      });

    } catch (error) {
      console.error('Error tracking impression:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to track impression',
        error: error.message
      });
    }
  }
);

// POST /ads/click - Track ad click
router.post('/click',
  rateLimitModerate,
  [
    body('placementId').notEmpty().withMessage('Placement ID is required'),
    body('networkName').notEmpty().withMessage('Network name is required'),
    body('targetUrl').optional().isURL().withMessage('Invalid target URL'),
    body('clickX').optional().isInt({ min: 0 }),
    body('clickY').optional().isInt({ min: 0 })
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

      const context = {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        country: req.body.country,
        device: req.body.device,
        calculatorType: req.body.calculatorType,
        userId: req.user?.id,
        sessionId: req.body.sessionId,
        clickX: req.body.clickX,
        clickY: req.body.clickY,
        targetUrl: req.body.targetUrl,
        dwellTime: req.body.dwellTime
      };

      const clickId = await analyticsService.trackClick(
        req.body.placementId,
        req.body.networkName,
        context
      );

      res.json({
        success: true,
        clickId: clickId,
        message: 'Click tracked successfully'
      });

    } catch (error) {
      console.error('Error tracking click:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to track click',
        error: error.message
      });
    }
  }
);

// POST /ads/viewability - Track viewability
router.post('/viewability',
  rateLimitModerate,
  [
    body('placementId').notEmpty().withMessage('Placement ID is required'),
    body('networkName').notEmpty().withMessage('Network name is required'),
    body('viewabilityData').isObject().withMessage('Viewability data is required'),
    body('viewabilityData.score').isFloat({ min: 0, max: 1 }).withMessage('Invalid viewability score'),
    body('viewabilityData.timeInView').optional().isInt({ min: 0 }),
    body('viewabilityData.percentageVisible').optional().isFloat({ min: 0, max: 100 })
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

      const context = {
        country: req.body.country,
        device: req.body.device
      };

      const viewabilityId = await analyticsService.trackViewability(
        req.body.placementId,
        req.body.networkName,
        req.body.viewabilityData,
        context
      );

      res.json({
        success: true,
        viewabilityId: viewabilityId,
        message: 'Viewability tracked successfully'
      });

    } catch (error) {
      console.error('Error tracking viewability:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to track viewability',
        error: error.message
      });
    }
  }
);

// POST /ads/revenue - Track revenue
router.post('/revenue',
  authenticateToken,
  rateLimitStrict,
  [
    body('placementId').notEmpty().withMessage('Placement ID is required'),
    body('networkName').notEmpty().withMessage('Network name is required'),
    body('revenue').isFloat({ min: 0 }).withMessage('Revenue must be a positive number'),
    body('paymentModel').optional().isIn(['cpm', 'cpc', 'cpa'])
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

      const context = {
        country: req.body.country,
        device: req.body.device,
        calculatorType: req.body.calculatorType,
        sessionId: req.body.sessionId,
        userId: req.user.id,
        conversionType: req.body.conversionType,
        paymentModel: req.body.paymentModel
      };

      const revenueId = await analyticsService.trackRevenue(
        req.body.placementId,
        req.body.networkName,
        req.body.revenue,
        context
      );

      // Also track for revenue optimization
      await revenueOptimizationService.trackRevenue(
        req.body.placementId,
        req.body.networkName,
        req.body.revenue,
        1, // impressions
        context
      );

      res.json({
        success: true,
        revenueId: revenueId,
        message: 'Revenue tracked successfully'
      });

    } catch (error) {
      console.error('Error tracking revenue:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to track revenue',
        error: error.message
      });
    }
  }
);

// GET /ads/performance - Performance analytics
router.get('/performance',
  authenticateToken,
  rateLimitModerate,
  [
    query('timeRange').optional().isIn(['1h', '24h', '7d', '30d']).withMessage('Invalid time range'),
    query('networkName').optional().isString(),
    query('country').optional().isAlpha({ length: 2 }),
    query('device').optional().isIn(['desktop', 'tablet', 'mobile'])
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

      const timeRange = req.query.timeRange || '24h';
      const filters = {
        networkName: req.query.networkName,
        country: req.query.country,
        device: req.query.device
      };

      const report = await analyticsService.getAnalyticsReport(timeRange, filters);

      res.json({
        success: true,
        data: report
      });

    } catch (error) {
      console.error('Error getting performance analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get performance analytics',
        error: error.message
      });
    }
  }
);

// GET /ads/revenue-report - Revenue optimization report
router.get('/revenue-report',
  authenticateToken,
  rateLimitModerate,
  [
    query('timeRange').optional().isIn(['1h', '24h', '7d', '30d']),
    query('country').optional().isAlpha({ length: 2 })
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

      const timeRange = req.query.timeRange || '24h';
      const country = req.query.country;

      const report = await revenueOptimizationService.getRevenueReport(timeRange, country);

      res.json({
        success: true,
        data: report
      });

    } catch (error) {
      console.error('Error getting revenue report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get revenue report',
        error: error.message
      });
    }
  }
);

// GET /ads/loading-performance - Loading performance report
router.get('/loading-performance',
  authenticateToken,
  rateLimitModerate,
  [
    query('timeRange').optional().isIn(['1h', '24h', '7d', '30d'])
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

      const timeRange = req.query.timeRange || '24h';
      const report = await loadingOptimizationService.getLoadingPerformanceReport(timeRange);

      res.json({
        success: true,
        data: report
      });

    } catch (error) {
      console.error('Error getting loading performance report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get loading performance report',
        error: error.message
      });
    }
  }
);

// PUT /ads/config - Update ad configuration
router.put('/config',
  authenticateToken,
  rateLimitStrict,
  [
    body('unitId').notEmpty().withMessage('Unit ID is required'),
    body('updates').isObject().withMessage('Updates object is required')
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

      // Check if user has admin privileges
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const updatedUnit = await placementService.updateAdUnit(req.body.unitId, req.body.updates);

      res.json({
        success: true,
        data: updatedUnit,
        message: 'Ad configuration updated successfully'
      });

    } catch (error) {
      console.error('Error updating ad configuration:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update ad configuration',
        error: error.message
      });
    }
  }
);

// A/B Testing Endpoints

// POST /ads/ab-test - Create A/B test
router.post('/ab-test',
  authenticateToken,
  rateLimitStrict,
  [
    body('name').notEmpty().withMessage('Test name is required'),
    body('description').optional().isString(),
    body('type').isIn(['placement', 'density', 'format', 'design']).withMessage('Invalid test type'),
    body('variants').isArray({ min: 2, max: 2 }).withMessage('Exactly 2 variants required'),
    body('trafficAllocation').optional().isFloat({ min: 0.1, max: 1.0 }),
    body('targetMetric').optional().isIn(['revenue', 'ctr', 'viewability'])
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

      const testConfig = {
        ...req.body,
        createdBy: req.user.id
      };

      const test = await abTestService.createTest(testConfig);

      res.json({
        success: true,
        data: test,
        message: 'A/B test created successfully'
      });

    } catch (error) {
      console.error('Error creating A/B test:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create A/B test',
        error: error.message
      });
    }
  }
);

// GET /ads/ab-test/{testId}/results - Get A/B test results
router.get('/ab-test/:testId/results',
  authenticateToken,
  rateLimitModerate,
  [
    param('testId').isUUID().withMessage('Invalid test ID')
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

      const results = await abTestService.getTestResults(req.params.testId);

      res.json({
        success: true,
        data: results
      });

    } catch (error) {
      console.error('Error getting A/B test results:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get A/B test results',
        error: error.message
      });
    }
  }
);

// POST /ads/ab-test/{testId}/end - End A/B test
router.post('/ab-test/:testId/end',
  authenticateToken,
  rateLimitStrict,
  [
    param('testId').isUUID().withMessage('Invalid test ID'),
    body('reason').optional().isString()
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

      const finalAnalysis = await abTestService.endTest(
        req.params.testId,
        req.body.reason || 'manual'
      );

      res.json({
        success: true,
        data: finalAnalysis,
        message: 'A/B test ended successfully'
      });

    } catch (error) {
      console.error('Error ending A/B test:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to end A/B test',
        error: error.message
      });
    }
  }
);

// Content Filtering Endpoints

// GET /ads/filtering-report - Content filtering report
router.get('/filtering-report',
  authenticateToken,
  rateLimitModerate,
  [
    query('timeRange').optional().isIn(['24h', '7d', '30d'])
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

      const timeRange = req.query.timeRange || '7d';
      const report = await contentFilteringService.getFilteringReport(timeRange);

      res.json({
        success: true,
        data: report
      });

    } catch (error) {
      console.error('Error getting filtering report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get filtering report',
        error: error.message
      });
    }
  }
);

// POST /ads/feedback - Submit user feedback
router.post('/feedback',
  rateLimitModerate,
  [
    body('advertiser').notEmpty().withMessage('Advertiser is required'),
    body('type').isIn(['positive', 'negative']).withMessage('Invalid feedback type'),
    body('comment').optional().isString()
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

      await contentFilteringService.updateUserFeedback(req.body.advertiser, {
        type: req.body.type,
        comment: req.body.comment,
        userId: req.user?.id,
        timestamp: Date.now()
      });

      res.json({
        success: true,
        message: 'Feedback submitted successfully'
      });

    } catch (error) {
      console.error('Error submitting feedback:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit feedback',
        error: error.message
      });
    }
  }
);

// Network Status Endpoints

// GET /ads/networks/status - Get network status
router.get('/networks/status',
  authenticateToken,
  rateLimitModerate,
  async (req, res) => {
    try {
      const status = await adNetworkService.getNetworkStatus();

      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      console.error('Error getting network status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get network status',
        error: error.message
      });
    }
  }
);

// Monitoring Endpoints

// POST /ads/core-web-vitals - Track Core Web Vitals
router.post('/core-web-vitals',
  rateLimitModerate,
  [
    body('placementId').notEmpty().withMessage('Placement ID is required'),
    body('cls').optional().isFloat({ min: 0 }),
    body('lcp').optional().isFloat({ min: 0 }),
    body('fid').optional().isFloat({ min: 0 })
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

      const context = {
        device: req.body.device,
        country: req.body.country
      };

      await loadingOptimizationService.trackCoreWebVitals(
        req.body.placementId,
        {
          cls: req.body.cls,
          lcp: req.body.lcp,
          fid: req.body.fid
        },
        context
      );

      res.json({
        success: true,
        message: 'Core Web Vitals tracked successfully'
      });

    } catch (error) {
      console.error('Error tracking Core Web Vitals:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to track Core Web Vitals',
        error: error.message
      });
    }
  }
);

// POST /ads/performance-data - Track loading performance
router.post('/performance-data',
  rateLimitModerate,
  [
    body('placementId').notEmpty().withMessage('Placement ID is required'),
    body('loadTime').isFloat({ min: 0 }).withMessage('Invalid load time'),
    body('strategy').notEmpty().withMessage('Strategy is required')
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

      const context = {
        device: req.body.device,
        country: req.body.country,
        connectionSpeed: req.body.connectionSpeed
      };

      await loadingOptimizationService.trackLoadingPerformance(
        req.body.placementId,
        req.body.loadTime,
        req.body.strategy,
        context
      );

      res.json({
        success: true,
        message: 'Performance data tracked successfully'
      });

    } catch (error) {
      console.error('Error tracking performance data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to track performance data',
        error: error.message
      });
    }
  }
);

// Health check endpoint
router.get('/health',
  rateLimitLenient,
  async (req, res) => {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          placement: await placementService.healthCheck(),
          networks: await adNetworkService.healthCheck(),
          abTesting: await abTestService.healthCheck(),
          revenueOptimization: await revenueOptimizationService.healthCheck(),
          loadingOptimization: await loadingOptimizationService.healthCheck(),
          analytics: await analyticsService.healthCheck(),
          contentFiltering: await contentFilteringService.healthCheck()
        }
      };

      // Check if any critical services are unhealthy
      const unhealthyServices = Object.entries(health.services)
        .filter(([name, service]) => service.status !== 'healthy')
        .map(([name]) => name);

      if (unhealthyServices.length > 0) {
        health.status = 'degraded';
        health.unhealthyServices = unhealthyServices;
      }

      const statusCode = health.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(health);

    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  }
);

module.exports = router;