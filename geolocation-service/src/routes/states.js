const express = require('express');
const router = express.Router();
const { States } = require('../models');
const redis = require('../config/redis');
const logger = require('../config/logger');
const { query, param, validationResult } = require('express-validator');

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
 * @route GET /states/:country
 * @desc Get states/provinces for a country
 * @access Public
 */
router.get('/:country', [
    param('country').isLength({ min: 2, max: 3 }).withMessage('Country code must be 2-3 characters'),
    query('supported').optional().isBoolean().withMessage('Supported must be a boolean'),
    query('hasIncomeTax').optional().isBoolean().withMessage('HasIncomeTax must be a boolean'),
    query('year').optional().isInt({ min: 2020, max: 2030 }).withMessage('Year must be between 2020 and 2030'),
    query('type').optional().isIn(['state', 'province', 'territory', 'district', 'region', 'canton', 'county']).withMessage('Invalid state type'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be greater than 0'),
    handleValidationErrors
], async (req, res) => {
    try {
        const {
            country,
        } = req.params;

        const {
            supported,
            hasIncomeTax,
            year = new Date().getFullYear(),
            type,
            limit = 50,
            page = 1,
            search
        } = req.query;

        // Check cache first
        const cacheKey = `states_${country}_${JSON.stringify(req.query)}`;
        const cached = await redis.get(cacheKey);
        if (cached) {
            return res.json({
                success: true,
                data: cached,
                source: 'cache'
            });
        }

        // Build query
        let query = {
            country: country.toUpperCase(),
            isActive: true
        };

        if (supported !== undefined) {
            query.isSupported = supported === 'true';
        }

        if (type) {
            query.type = type;
        }

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { name: searchRegex },
                { officialName: searchRegex },
                { code: searchRegex },
                { abbreviation: searchRegex }
            ];
        }

        // Execute query with pagination
        const skip = (page - 1) * limit;
        let statesQuery = States.find(query)
            .sort({ name: 1 })
            .limit(parseInt(limit))
            .skip(skip)
            .select('code name officialName type abbreviation geographic economic government isSupported supportLevel supportedTaxYears taxRules');

        const states = await statesQuery;

        // Filter by income tax if requested
        let filteredStates = states;
        if (hasIncomeTax !== undefined) {
            const hasIncomeTaxFilter = hasIncomeTax === 'true';
            filteredStates = states.filter(state => {
                const taxRules = state.getTaxRulesByYear(parseInt(year));
                return taxRules ? (taxRules.hasIncomeTax === hasIncomeTaxFilter) : false;
            });
        }

        const total = await States.countDocuments(query);

        // Enhance states with tax information for the requested year
        const enhancedStates = filteredStates.map(state => {
            const stateObj = state.toObject();
            const taxRules = state.getTaxRulesByYear(parseInt(year));

            stateObj.taxInfo = {
                year: parseInt(year),
                hasIncomeTax: taxRules?.hasIncomeTax || false,
                hasSalesTax: taxRules?.hasSalesTax || false,
                hasPropertyTax: taxRules?.hasPropertyTax || false,
                incomeTaxRate: taxRules?.incomeTaxRate || null,
                salesTaxRate: taxRules?.salesTaxRate || 0,
                propertyTaxRate: taxRules?.propertyTaxRate || 0
            };

            // Add local tax information
            stateObj.localTaxRates = state.getLocalTaxRates();

            return stateObj;
        });

        const result = {
            country: country.toUpperCase(),
            states: enhancedStates,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            },
            filters: {
                year: parseInt(year),
                supported,
                hasIncomeTax,
                type
            }
        };

        // Cache for 2 hours
        await redis.set(cacheKey, result, 7200);

        res.json({
            success: true,
            data: result,
            source: 'database'
        });

        logger.info('States list API call', {
            country: country.toUpperCase(),
            filters: { supported, hasIncomeTax, year, type },
            resultCount: enhancedStates.length,
            total
        });

    } catch (error) {
        logger.error('Failed to get states list in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get states list',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route GET /states/:country/supported
 * @desc Get supported states/provinces for a country
 * @access Public
 */
router.get('/:country/supported', [
    param('country').isLength({ min: 2, max: 3 }).withMessage('Country code must be 2-3 characters'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { country } = req.params;

        const cacheKey = `states_supported_${country.toUpperCase()}`;
        const cached = await redis.get(cacheKey);
        if (cached) {
            return res.json({
                success: true,
                data: cached,
                source: 'cache'
            });
        }

        const states = await States.findSupportedByCountry(country)
            .select('code name type isSupported supportLevel supportedTaxYears');

        const result = {
            country: country.toUpperCase(),
            states,
            count: states.length
        };

        // Cache for 4 hours
        await redis.set(cacheKey, result, 14400);

        res.json({
            success: true,
            data: result,
            source: 'database'
        });

        logger.info('Supported states API call', {
            country: country.toUpperCase(),
            count: states.length
        });

    } catch (error) {
        logger.error('Failed to get supported states in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get supported states',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route GET /states/:country/:code
 * @desc Get detailed state/province information
 * @access Public
 */
router.get('/:country/:code', [
    param('country').isLength({ min: 2, max: 3 }).withMessage('Country code must be 2-3 characters'),
    param('code').isLength({ min: 2, max: 5 }).withMessage('State code must be 2-5 characters'),
    query('year').optional().isInt({ min: 2020, max: 2030 }).withMessage('Year must be between 2020 and 2030'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { country, code } = req.params;
        const year = parseInt(req.query.year) || new Date().getFullYear();

        const state = await States.findByCode(country, code);

        if (!state) {
            return res.status(404).json({
                success: false,
                message: 'State/province not found'
            });
        }

        // Get tax rules for the specified year
        const taxRules = state.getTaxRulesByYear(year);

        // Get local tax rates
        const localTaxRates = state.getLocalTaxRates();

        // Calculate combined tax rates
        const combinedRates = {
            income: state.getCombinedTaxRate(year, 'income'),
            sales: state.getCombinedTaxRate(year, 'sales'),
            property: state.getCombinedTaxRate(year, 'property')
        };

        const result = {
            ...state.toObject(),
            currentYear: year,
            taxRules,
            localTaxRates,
            combinedRates,
            hasIncomeTax: state.hasIncomeTax(year),
            supportedYears: state.getSupportedYears()
        };

        res.json({
            success: true,
            data: result
        });

        logger.info('State details API call', {
            country: country.toUpperCase(),
            state: code.toUpperCase(),
            year,
            found: true
        });

    } catch (error) {
        logger.error('Failed to get state details in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get state details',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route GET /states/:country/:code/tax-rates
 * @desc Get tax rates for a specific state/province
 * @access Public
 */
router.get('/:country/:code/tax-rates', [
    param('country').isLength({ min: 2, max: 3 }).withMessage('Country code must be 2-3 characters'),
    param('code').isLength({ min: 2, max: 5 }).withMessage('State code must be 2-5 characters'),
    query('year').optional().isInt({ min: 2020, max: 2030 }).withMessage('Year must be between 2020 and 2030'),
    query('type').optional().isIn(['income', 'sales', 'property', 'business', 'payroll']).withMessage('Invalid tax type'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { country, code } = req.params;
        const { year = new Date().getFullYear(), type } = req.query;

        const state = await States.findByCode(country, code);

        if (!state) {
            return res.status(404).json({
                success: false,
                message: 'State/province not found'
            });
        }

        const taxRules = state.getTaxRulesByYear(parseInt(year));

        if (!taxRules) {
            return res.status(404).json({
                success: false,
                message: `No tax rules found for ${year}`
            });
        }

        // Get local tax rates
        let localRates = state.getLocalTaxRates();
        if (type) {
            localRates = localRates.filter(rate => rate.taxType === type);
        }

        const result = {
            country: country.toUpperCase(),
            state: code.toUpperCase(),
            year: parseInt(year),
            stateTaxRules: taxRules,
            localTaxRates: localRates,
            combinedRates: {
                income: type === 'income' || !type ? state.getCombinedTaxRate(parseInt(year), 'income') : null,
                sales: type === 'sales' || !type ? state.getCombinedTaxRate(parseInt(year), 'sales') : null,
                property: type === 'property' || !type ? state.getCombinedTaxRate(parseInt(year), 'property') : null
            }
        };

        res.json({
            success: true,
            data: result
        });

        logger.info('State tax rates API call', {
            country: country.toUpperCase(),
            state: code.toUpperCase(),
            year: parseInt(year),
            type: type || 'all'
        });

    } catch (error) {
        logger.error('Failed to get state tax rates in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get state tax rates',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route GET /states/:country/with-income-tax
 * @desc Get states/provinces with income tax for a specific year
 * @access Public
 */
router.get('/:country/with-income-tax', [
    param('country').isLength({ min: 2, max: 3 }).withMessage('Country code must be 2-3 characters'),
    query('year').optional().isInt({ min: 2020, max: 2030 }).withMessage('Year must be between 2020 and 2030'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { country } = req.params;
        const year = parseInt(req.query.year) || new Date().getFullYear();

        const states = await States.findWithIncomeTax(country, year)
            .select('code name type taxRules');

        const result = states.map(state => {
            const taxRules = state.getTaxRulesByYear(year);
            return {
                code: state.code,
                name: state.name,
                type: state.type,
                incomeTaxRate: taxRules?.incomeTaxRate || null,
                hasIncomeTax: taxRules?.hasIncomeTax || false
            };
        });

        res.json({
            success: true,
            data: {
                country: country.toUpperCase(),
                year,
                states: result,
                count: result.length
            }
        });

        logger.info('States with income tax API call', {
            country: country.toUpperCase(),
            year,
            count: result.length
        });

    } catch (error) {
        logger.error('Failed to get states with income tax in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get states with income tax',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route GET /states/:country/search/:query
 * @desc Search states/provinces by name
 * @access Public
 */
router.get('/:country/search/:query', [
    param('country').isLength({ min: 2, max: 3 }).withMessage('Country code must be 2-3 characters'),
    param('query').isLength({ min: 2, max: 50 }).withMessage('Search query must be 2-50 characters'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { country, query } = req.params;

        const states = await States.searchByQuery(country, query)
            .select('code name officialName type abbreviation isSupported supportLevel');

        res.json({
            success: true,
            data: {
                country: country.toUpperCase(),
                query,
                states,
                count: states.length
            }
        });

        logger.info('States search API call', {
            country: country.toUpperCase(),
            query,
            count: states.length
        });

    } catch (error) {
        logger.error('Failed to search states in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search states',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route GET /states/:country/types
 * @desc Get available state/province types for a country
 * @access Public
 */
router.get('/:country/types', [
    param('country').isLength({ min: 2, max: 3 }).withMessage('Country code must be 2-3 characters'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { country } = req.params;

        const types = await States.aggregate([
            { $match: { country: country.toUpperCase(), isActive: true } },
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 },
                    examples: { $push: { code: '$code', name: '$name' } }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const result = types.map(type => ({
            type: type._id,
            count: type.count,
            examples: type.examples.slice(0, 3) // Show first 3 examples
        }));

        res.json({
            success: true,
            data: {
                country: country.toUpperCase(),
                types: result
            }
        });

        logger.info('State types API call', {
            country: country.toUpperCase(),
            typesCount: result.length
        });

    } catch (error) {
        logger.error('Failed to get state types in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get state types',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

module.exports = router;