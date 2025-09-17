const express = require('express');
const router = express.Router();
const { Countries } = require('../models');
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
 * @route GET /countries
 * @desc Get list of all supported countries
 * @access Public
 */
router.get('/', [
    query('supported').optional().isBoolean().withMessage('Supported must be a boolean'),
    query('continent').optional().isLength({ max: 20 }).withMessage('Continent name too long'),
    query('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency code must be 3 characters'),
    query('taxSystem').optional().isIn(['progressive', 'flat', 'regressive', 'mixed']).withMessage('Invalid tax system type'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be greater than 0'),
    handleValidationErrors
], async (req, res) => {
    try {
        const {
            supported,
            continent,
            currency,
            taxSystem,
            limit = 50,
            page = 1,
            search
        } = req.query;

        // Check cache first
        const cacheKey = `countries_${JSON.stringify(req.query)}`;
        const cached = await redis.get(cacheKey);
        if (cached) {
            return res.json({
                success: true,
                data: cached,
                source: 'cache'
            });
        }

        // Build query
        let query = { isActive: true };

        if (supported !== undefined) {
            query.isSupported = supported === 'true';
        }

        if (continent) {
            query['geographic.continent'] = new RegExp(continent, 'i');
        }

        if (currency) {
            query['currency.code'] = currency.toUpperCase();
        }

        if (taxSystem) {
            query['taxSystem.type'] = taxSystem;
        }

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { name: searchRegex },
                { officialName: searchRegex },
                { alpha2Code: searchRegex },
                { alpha3Code: searchRegex }
            ];
        }

        // Execute query with pagination
        const skip = (page - 1) * limit;
        const countries = await Countries.find(query)
            .sort({ name: 1 })
            .limit(parseInt(limit))
            .skip(skip)
            .select('code name alpha2Code alpha3Code currency taxSystem geographic isSupported supportLevel supportedTaxYears flags');

        const total = await Countries.countDocuments(query);

        const result = {
            countries,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        };

        // Cache for 1 hour
        await redis.set(cacheKey, result, 3600);

        res.json({
            success: true,
            data: result,
            source: 'database'
        });

        logger.info('Countries list API call', {
            filters: { supported, continent, currency, taxSystem },
            resultCount: countries.length,
            total
        });

    } catch (error) {
        logger.error('Failed to get countries list in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get countries list',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route GET /countries/supported
 * @desc Get list of supported countries only
 * @access Public
 */
router.get('/supported', async (req, res) => {
    try {
        const cached = await redis.getCountriesCache();
        if (cached) {
            return res.json({
                success: true,
                data: cached,
                source: 'cache'
            });
        }

        const countries = await Countries.findSupported()
            .select('code name alpha2Code currency taxSystem supportLevel supportedTaxYears flags');

        await redis.cacheCountries(countries);

        res.json({
            success: true,
            data: countries,
            source: 'database'
        });

        logger.info('Supported countries API call', {
            count: countries.length
        });

    } catch (error) {
        logger.error('Failed to get supported countries in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get supported countries',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route GET /countries/:code
 * @desc Get detailed country information
 * @access Public
 */
router.get('/:code', [
    param('code').isLength({ min: 2, max: 3 }).withMessage('Country code must be 2-3 characters'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { code } = req.params;

        const country = await Countries.findByCode(code);

        if (!country) {
            return res.status(404).json({
                success: false,
                message: 'Country not found'
            });
        }

        res.json({
            success: true,
            data: country
        });

        logger.info('Country details API call', {
            code: code.toUpperCase(),
            found: true
        });

    } catch (error) {
        logger.error('Failed to get country details in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get country details',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route GET /countries/:code/tax-system
 * @desc Get country's tax system information
 * @access Public
 */
router.get('/:code/tax-system', [
    param('code').isLength({ min: 2, max: 3 }).withMessage('Country code must be 2-3 characters'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { code } = req.params;

        const country = await Countries.findByCode(code);

        if (!country) {
            return res.status(404).json({
                success: false,
                message: 'Country not found'
            });
        }

        const taxSystemInfo = {
            country: {
                code: country.code,
                name: country.name
            },
            taxSystem: country.getTaxSystemInfo(),
            currency: country.getCurrencyInfo(),
            supportedYears: country.getSupportedYears(),
            isSupported: country.isSupported,
            supportLevel: country.supportLevel,
            government: {
                taxAuthority: country.government?.taxAuthority || null,
                fiscalYear: country.government?.fiscalYear || null
            }
        };

        res.json({
            success: true,
            data: taxSystemInfo
        });

        logger.info('Country tax system API call', {
            code: code.toUpperCase(),
            isSupported: country.isSupported
        });

    } catch (error) {
        logger.error('Failed to get country tax system in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get country tax system',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route GET /countries/continent/:continent
 * @desc Get countries by continent
 * @access Public
 */
router.get('/continent/:continent', [
    param('continent').isLength({ min: 2, max: 20 }).withMessage('Continent name invalid'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { continent } = req.params;

        const countries = await Countries.findByContinent(continent)
            .select('code name alpha2Code currency taxSystem isSupported supportLevel flags');

        res.json({
            success: true,
            data: {
                continent,
                countries,
                count: countries.length
            }
        });

        logger.info('Countries by continent API call', {
            continent,
            count: countries.length
        });

    } catch (error) {
        logger.error('Failed to get countries by continent in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get countries by continent',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route GET /countries/currency/:currency
 * @desc Get countries by currency
 * @access Public
 */
router.get('/currency/:currency', [
    param('currency').isLength({ min: 3, max: 3 }).withMessage('Currency code must be 3 characters'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { currency } = req.params;

        const countries = await Countries.findByCurrency(currency)
            .select('code name alpha2Code currency taxSystem isSupported supportLevel flags');

        res.json({
            success: true,
            data: {
                currency: currency.toUpperCase(),
                countries,
                count: countries.length
            }
        });

        logger.info('Countries by currency API call', {
            currency: currency.toUpperCase(),
            count: countries.length
        });

    } catch (error) {
        logger.error('Failed to get countries by currency in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get countries by currency',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route GET /countries/search/:query
 * @desc Search countries by name
 * @access Public
 */
router.get('/search/:query', [
    param('query').isLength({ min: 2, max: 50 }).withMessage('Search query must be 2-50 characters'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { query } = req.params;

        const countries = await Countries.searchByName(query)
            .select('code name officialName alpha2Code currency taxSystem isSupported supportLevel flags');

        res.json({
            success: true,
            data: {
                query,
                countries,
                count: countries.length
            }
        });

        logger.info('Countries search API call', {
            query,
            count: countries.length
        });

    } catch (error) {
        logger.error('Failed to search countries in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search countries',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route GET /countries/tax-systems/types
 * @desc Get available tax system types
 * @access Public
 */
router.get('/tax-systems/types', async (req, res) => {
    try {
        const taxSystemTypes = [
            {
                type: 'progressive',
                description: 'Tax rate increases with income',
                examples: ['US', 'CA', 'UK', 'AU', 'DE']
            },
            {
                type: 'flat',
                description: 'Single tax rate for all income levels',
                examples: ['RU', 'EE', 'LV']
            },
            {
                type: 'regressive',
                description: 'Tax rate decreases with income',
                examples: []
            },
            {
                type: 'mixed',
                description: 'Combination of different tax types',
                examples: ['CH', 'SG']
            }
        ];

        res.json({
            success: true,
            data: taxSystemTypes
        });

    } catch (error) {
        logger.error('Failed to get tax system types in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get tax system types',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route GET /countries/currencies/list
 * @desc Get list of all currencies used by countries
 * @access Public
 */
router.get('/currencies/list', async (req, res) => {
    try {
        const cacheKey = 'currencies_list';
        const cached = await redis.get(cacheKey);
        if (cached) {
            return res.json({
                success: true,
                data: cached,
                source: 'cache'
            });
        }

        const currencies = await Countries.aggregate([
            { $match: { isActive: true } },
            {
                $group: {
                    _id: '$currency.code',
                    name: { $first: '$currency.name' },
                    symbol: { $first: '$currency.symbol' },
                    decimals: { $first: '$currency.decimals' },
                    countries: { $push: { code: '$code', name: '$name' } }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const result = currencies.map(curr => ({
            code: curr._id,
            name: curr.name,
            symbol: curr.symbol,
            decimals: curr.decimals,
            countries: curr.countries,
            countryCount: curr.countries.length
        }));

        // Cache for 4 hours
        await redis.set(cacheKey, result, 14400);

        res.json({
            success: true,
            data: result,
            source: 'database'
        });

        logger.info('Currencies list API call', {
            count: result.length
        });

    } catch (error) {
        logger.error('Failed to get currencies list in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get currencies list',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

module.exports = router;