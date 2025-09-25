/**
 * Search API Routes
 * Comprehensive search endpoints with validation and rate limiting
 */

const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const SearchService = require('../services/SearchService');
const logger = require('../utils/logger');

const router = express.Router();

// Rate limiting for search endpoints
const searchRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: parseInt(process.env.SEARCH_RATE_LIMIT) || 100,
  message: {
    error: 'Too many search requests',
    message: 'Please slow down your search requests'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const autocompleteRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200, // Higher limit for autocomplete
  message: {
    error: 'Too many autocomplete requests',
    message: 'Please slow down your typing'
  }
});

/**
 * Main search endpoint
 * POST /api/v1/search
 */
router.post('/search',
  searchRateLimit,
  [
    body('query')
      .optional()
      .isString()
      .isLength({ min: 1, max: 500 })
      .withMessage('Query must be between 1 and 500 characters'),
    body('filters')
      .optional()
      .isObject()
      .withMessage('Filters must be an object'),
    body('filters.content_type')
      .optional()
      .custom(value => {
        const validTypes = ['calculator', 'article', 'guide', 'faq', 'all'];
        if (Array.isArray(value)) {
          return value.every(type => validTypes.includes(type));
        }
        return validTypes.includes(value);
      })
      .withMessage('Invalid content type'),
    body('sort')
      .optional()
      .isIn(['relevance', 'newest', 'oldest', 'popular', 'title', 'helpful'])
      .withMessage('Invalid sort option'),
    body('page')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Page must be between 1 and 1000'),
    body('size')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Size must be between 1 and 100'),
    body('highlight')
      .optional()
      .isBoolean()
      .withMessage('Highlight must be a boolean'),
    body('facets')
      .optional()
      .isBoolean()
      .withMessage('Facets must be a boolean'),
    body('fuzzy')
      .optional()
      .isBoolean()
      .withMessage('Fuzzy must be a boolean')
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
        query,
        filters = {},
        sort = 'relevance',
        page = 1,
        size = 20,
        highlight = true,
        facets = true,
        fuzzy = true
      } = req.body;

      // Add user context
      const user = req.user ? {
        id: req.user.id,
        language: req.user.language || 'en',
        country: req.user.country,
        interests: req.user.interests || []
      } : null;

      const context = {
        ip: req.ip,
        user_agent: req.get('User-Agent'),
        session_id: req.sessionID,
        page,
        size
      };

      const startTime = Date.now();
      const results = await SearchService.search({
        query,
        filters,
        sort,
        page,
        size,
        highlight,
        facets,
        fuzzy,
        user,
        context
      });

      const responseTime = Date.now() - startTime;

      res.json({
        success: true,
        data: results,
        meta: {
          query,
          page,
          size,
          total: results.total,
          pages: Math.ceil(results.total / size),
          response_time: responseTime
        }
      });

    } catch (error) {
      logger.error('Search endpoint error:', error);
      res.status(500).json({
        success: false,
        error: 'Search failed',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
);

/**
 * Autocomplete endpoint
 * GET /api/v1/search/autocomplete
 */
router.get('/autocomplete',
  autocompleteRateLimit,
  [
    query('q')
      .notEmpty()
      .isLength({ min: 1, max: 100 })
      .withMessage('Query must be between 1 and 100 characters'),
    query('type')
      .optional()
      .isIn(['all', 'calculator', 'article', 'guide', 'faq'])
      .withMessage('Invalid type'),
    query('size')
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage('Size must be between 1 and 20')
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
        q: query,
        type = 'all',
        size = 10
      } = req.query;

      const user = req.user ? {
        id: req.user.id,
        language: req.user.language || 'en',
        country: req.user.country
      } : null;

      const suggestions = await SearchService.autocomplete(query, {
        size: parseInt(size),
        type,
        user
      });

      res.json({
        success: true,
        data: suggestions,
        meta: {
          query,
          type,
          count: suggestions.length
        }
      });

    } catch (error) {
      logger.error('Autocomplete endpoint error:', error);
      res.status(500).json({
        success: false,
        error: 'Autocomplete failed',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
);

/**
 * Search suggestions endpoint
 * GET /api/v1/search/suggestions
 */
router.get('/suggestions',
  searchRateLimit,
  [
    query('q')
      .notEmpty()
      .isLength({ min: 1, max: 100 })
      .withMessage('Query must be between 1 and 100 characters'),
    query('size')
      .optional()
      .isInt({ min: 1, max: 10 })
      .withMessage('Size must be between 1 and 10')
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
        q: query,
        size = 5
      } = req.query;

      const suggestions = await SearchService.searchSuggestions(query, {
        size: parseInt(size)
      });

      res.json({
        success: true,
        data: suggestions,
        meta: {
          query,
          count: suggestions.length
        }
      });

    } catch (error) {
      logger.error('Suggestions endpoint error:', error);
      res.status(500).json({
        success: false,
        error: 'Suggestions failed',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
);

/**
 * Similar content endpoint
 * GET /api/v1/search/similar/:id
 */
router.get('/similar/:id',
  searchRateLimit,
  [
    param('id')
      .notEmpty()
      .withMessage('Document ID is required'),
    query('index')
      .optional()
      .isIn(['tax_calculators', 'content', 'faqs', 'search_all'])
      .withMessage('Invalid index'),
    query('size')
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage('Size must be between 1 and 20')
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

      const { id } = req.params;
      const {
        index = 'search_all',
        size = 5
      } = req.query;

      const similar = await SearchService.findSimilar(id, index, {
        size: parseInt(size)
      });

      res.json({
        success: true,
        data: similar,
        meta: {
          document_id: id,
          index,
          count: similar.length
        }
      });

    } catch (error) {
      logger.error('Similar content endpoint error:', error);
      res.status(500).json({
        success: false,
        error: 'Similar content search failed',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
);

/**
 * Advanced search endpoint
 * POST /api/v1/search/advanced
 */
router.post('/advanced',
  searchRateLimit,
  [
    body('must')
      .optional()
      .isArray()
      .withMessage('Must clauses should be an array'),
    body('should')
      .optional()
      .isArray()
      .withMessage('Should clauses should be an array'),
    body('must_not')
      .optional()
      .isArray()
      .withMessage('Must not clauses should be an array'),
    body('filters')
      .optional()
      .isObject()
      .withMessage('Filters must be an object'),
    body('sort')
      .optional()
      .isIn(['relevance', 'newest', 'oldest', 'popular', 'title', 'helpful'])
      .withMessage('Invalid sort option'),
    body('page')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Page must be between 1 and 1000'),
    body('size')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Size must be between 1 and 100')
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

      const results = await SearchService.advancedSearch(req.body);

      res.json({
        success: true,
        data: results,
        meta: {
          advanced_query: true,
          total: results.total,
          page: req.body.page || 1,
          size: req.body.size || 20
        }
      });

    } catch (error) {
      logger.error('Advanced search endpoint error:', error);
      res.status(500).json({
        success: false,
        error: 'Advanced search failed',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
);

/**
 * Geographic search endpoint
 * POST /api/v1/search/geo
 */
router.post('/geo',
  searchRateLimit,
  [
    body('query')
      .optional()
      .isString()
      .isLength({ min: 1, max: 500 })
      .withMessage('Query must be between 1 and 500 characters'),
    body('lat')
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage('Latitude must be between -90 and 90'),
    body('lon')
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage('Longitude must be between -180 and 180')
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

      const { query, ...options } = req.body;
      const ip = req.ip;

      const results = await SearchService.geoSearch(ip, query, options);

      res.json({
        success: true,
        data: results,
        meta: {
          query,
          geo_enhanced: true,
          ip_country: results.detected_country
        }
      });

    } catch (error) {
      logger.error('Geographic search endpoint error:', error);
      res.status(500).json({
        success: false,
        error: 'Geographic search failed',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
);

/**
 * Search analytics tracking endpoint
 * POST /api/v1/search/track
 */
router.post('/track',
  [
    body('event_type')
      .isIn(['click', 'view', 'download', 'conversion'])
      .withMessage('Invalid event type'),
    body('query')
      .optional()
      .isString()
      .withMessage('Query must be a string'),
    body('document_id')
      .optional()
      .isString()
      .withMessage('Document ID must be a string'),
    body('position')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Position must be a positive integer')
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

      // Track the event (implementation would go here)
      logger.info('Search event tracked:', req.body);

      res.json({
        success: true,
        message: 'Event tracked successfully'
      });

    } catch (error) {
      logger.error('Search tracking endpoint error:', error);
      res.status(500).json({
        success: false,
        error: 'Event tracking failed'
      });
    }
  }
);

/**
 * Health check endpoint
 * GET /api/v1/search/health
 */
router.get('/health', async (req, res) => {
  try {
    const health = await SearchService.client.cluster.health();

    res.json({
      success: true,
      status: 'healthy',
      elasticsearch: {
        status: health.status,
        number_of_nodes: health.number_of_nodes,
        active_shards: health.active_shards
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: 'Elasticsearch connection failed'
    });
  }
});

module.exports = router;