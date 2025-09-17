const express = require('express');
const router = express.Router();
const locationService = require('../services/locationService');
const logger = require('../config/logger');
const { body, query, validationResult } = require('express-validator');

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
        });
    }
    next();
};

/**
 * @route GET /location
 * @desc Get user location from IP address
 * @access Public
 */
router.get('/', async (req, res) => {
    try {
        const options = {
            forceDetection: req.query.force === 'true',
            includeHistory: req.query.history === 'true'
        };

        const location = await locationService.detectUserLocation(req, options);

        // Include location history if requested
        let history = null;
        if (options.includeHistory) {
            const sessionId = locationService.generateSessionId(req);
            history = await locationService.getLocationHistory(sessionId, 5);
        }

        res.json({
            success: true,
            data: {
                location,
                history,
                detectionMethod: location.source,
                accuracy: location.accuracyAssessment,
                isManualOverride: location.isManualOverride || false
            }
        });

        logger.info('Location detection API call', {
            ip: locationService.extractIPAddress(req),
            country: location.country.code,
            accuracy: location.accuracyAssessment,
            userAgent: req.get('User-Agent')
        });

    } catch (error) {
        logger.error('Location detection failed in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to detect location',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route POST /location/manual
 * @desc Set manual location override
 * @access Public
 */
router.post('/manual', [
    body('country').isLength({ min: 2, max: 3 }).withMessage('Country code must be 2-3 characters'),
    body('region').optional().isLength({ max: 10 }).withMessage('Region code too long'),
    body('city').optional().isLength({ max: 100 }).withMessage('City name too long'),
    body('reason').optional().isLength({ max: 200 }).withMessage('Reason too long'),
    body('ttl').optional().isInt({ min: 300, max: 86400 }).withMessage('TTL must be between 300 and 86400 seconds'),
    handleValidationErrors
], async (req, res) => {
    try {
        const sessionId = locationService.generateSessionId(req);
        const { country, region, city, reason, ttl } = req.body;

        const locationData = {
            country: { code: country.toUpperCase() },
            region: region ? { code: region.toUpperCase() } : { code: null },
            city: city ? { name: city } : { name: null },
            location: { latitude: null, longitude: null },
            source: 'manual_override'
        };

        const options = {
            reason: reason || 'user_selection',
            ttl: ttl
        };

        const enhancedLocation = await locationService.setManualLocation(sessionId, locationData, options);

        res.json({
            success: true,
            data: {
                location: enhancedLocation,
                message: 'Manual location set successfully'
            }
        });

        logger.info('Manual location set via API', {
            sessionId,
            country: enhancedLocation.country.code,
            region: enhancedLocation.region?.code,
            reason: enhancedLocation.overrideReason
        });

    } catch (error) {
        logger.error('Failed to set manual location in API:', error);
        res.status(400).json({
            success: false,
            message: 'Failed to set manual location',
            error: error.message
        });
    }
});

/**
 * @route DELETE /location/manual
 * @desc Clear manual location override
 * @access Public
 */
router.delete('/manual', async (req, res) => {
    try {
        const sessionId = locationService.generateSessionId(req);

        const detectedLocation = await locationService.clearManualOverride(sessionId);

        res.json({
            success: true,
            data: {
                location: detectedLocation,
                message: 'Manual override cleared, location re-detected'
            }
        });

        logger.info('Manual location override cleared via API', {
            sessionId,
            newCountry: detectedLocation.country.code
        });

    } catch (error) {
        logger.error('Failed to clear manual override in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to clear manual override',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route GET /location/history
 * @desc Get location history for session
 * @access Public
 */
router.get('/history', [
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    handleValidationErrors
], async (req, res) => {
    try {
        const sessionId = locationService.generateSessionId(req);
        const limit = parseInt(req.query.limit) || 10;

        const history = await locationService.getLocationHistory(sessionId, limit);

        res.json({
            success: true,
            data: {
                history,
                sessionId,
                count: history.length
            }
        });

    } catch (error) {
        logger.error('Failed to get location history in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get location history',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route POST /location/compare
 * @desc Compare multiple locations
 * @access Public
 */
router.post('/compare', [
    body('locations').isArray({ min: 2, max: 5 }).withMessage('Must provide 2-5 locations to compare'),
    body('locations.*.country').isLength({ min: 2, max: 3 }).withMessage('Each location must have a valid country code'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { locations } = req.body;

        // Normalize location data
        const normalizedLocations = locations.map(loc => ({
            country: { code: loc.country.toUpperCase() },
            region: loc.region ? { code: loc.region.toUpperCase() } : { code: null },
            city: loc.city ? { name: loc.city } : { name: null },
            location: { latitude: null, longitude: null },
            source: 'comparison_input'
        }));

        const comparison = await locationService.getMultiLocationComparison(normalizedLocations);

        res.json({
            success: true,
            data: {
                comparison,
                inputCount: locations.length,
                generatedAt: new Date().toISOString()
            }
        });

        logger.info('Multi-location comparison via API', {
            locationCount: locations.length,
            countries: locations.map(l => l.country)
        });

    } catch (error) {
        logger.error('Failed to compare locations in API:', error);
        res.status(400).json({
            success: false,
            message: 'Failed to compare locations',
            error: error.message
        });
    }
});

/**
 * @route GET /location/ip/:ip
 * @desc Get location for specific IP address
 * @access Public
 */
router.get('/ip/:ip', async (req, res) => {
    try {
        const { ip } = req.params;

        // Basic IP validation
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

        if (!ipRegex.test(ip)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid IP address format'
            });
        }

        // Create a mock request object with the specified IP
        const mockReq = {
            connection: { remoteAddress: ip },
            get: () => 'API-Request',
            sessionID: `ip_lookup_${Date.now()}`
        };

        const location = await locationService.detectUserLocation(mockReq, { forceDetection: true });

        res.json({
            success: true,
            data: {
                ip,
                location,
                detectionMethod: location.source,
                accuracy: location.accuracyAssessment
            }
        });

        logger.info('IP-specific location lookup via API', {
            requestedIp: ip,
            country: location.country.code,
            accuracy: location.accuracyAssessment
        });

    } catch (error) {
        logger.error('Failed to lookup IP location in API:', error);
        res.status(400).json({
            success: false,
            message: 'Failed to lookup IP location',
            error: error.message
        });
    }
});

/**
 * @route GET /location/validate
 * @desc Validate location data
 * @access Public
 */
router.get('/validate', [
    query('country').isLength({ min: 2, max: 3 }).withMessage('Country code must be 2-3 characters'),
    query('region').optional().isLength({ max: 10 }).withMessage('Region code too long'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { country, region } = req.query;

        const locationData = {
            country: { code: country.toUpperCase() },
            region: region ? { code: region.toUpperCase() } : { code: null }
        };

        const validatedLocation = await locationService.validateLocationData(locationData);
        const enhancedLocation = await locationService.enhanceLocationWithTaxInfo(validatedLocation);

        res.json({
            success: true,
            data: {
                isValid: true,
                location: enhancedLocation,
                taxJurisdiction: enhancedLocation.taxJurisdiction
            }
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Location validation failed',
            error: error.message,
            data: {
                isValid: false
            }
        });
    }
});

module.exports = router;