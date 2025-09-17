const express = require('express');
const router = express.Router();
const taxRulesService = require('../services/taxRulesService');
const logger = require('../config/logger');
const { body, query, param, validationResult } = require('express-validator');

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
 * @route GET /tax-rules/:country/:year
 * @desc Get tax rules for a specific country and year
 * @access Public
 */
router.get('/:country/:year', [
    param('country').isLength({ min: 2, max: 3 }).withMessage('Country code must be 2-3 characters'),
    param('year').isInt({ min: 2020, max: 2030 }).withMessage('Year must be between 2020 and 2030'),
    query('bypassCache').optional().isBoolean().withMessage('BypassCache must be a boolean'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { country, year } = req.params;
        const { bypassCache } = req.query;

        const options = {
            bypassCache: bypassCache === 'true',
            userId: req.user?.id || req.ip
        };

        const taxRules = await taxRulesService.getTaxRules(country, parseInt(year), options);

        res.json({
            success: true,
            data: taxRules
        });

        logger.taxRules.access(country.toUpperCase(), parseInt(year), 'api', options.userId);

    } catch (error) {
        logger.error('Failed to get tax rules in API:', error);

        if (error.message.includes('not found')) {
            res.status(404).json({
                success: false,
                message: error.message
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to get tax rules',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }
});

/**
 * @route GET /tax-rules/:country/:year/brackets
 * @desc Get tax brackets for a specific country, year, and filing status
 * @access Public
 */
router.get('/:country/:year/brackets', [
    param('country').isLength({ min: 2, max: 3 }).withMessage('Country code must be 2-3 characters'),
    param('year').isInt({ min: 2020, max: 2030 }).withMessage('Year must be between 2020 and 2030'),
    query('filingStatus').isIn(['single', 'marriedFilingJointly', 'marriedFilingSeparately', 'headOfHousehold']).withMessage('Invalid filing status'),
    query('state').optional().isLength({ min: 2, max: 5 }).withMessage('State code must be 2-5 characters'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { country, year } = req.params;
        const { filingStatus, state } = req.query;

        const taxRules = await taxRulesService.getTaxRules(country, parseInt(year));

        const brackets = taxRules.getTaxBrackets(filingStatus, state);

        res.json({
            success: true,
            data: {
                country: country.toUpperCase(),
                year: parseInt(year),
                filingStatus,
                state: state || null,
                brackets
            }
        });

        logger.taxRules.access(country.toUpperCase(), parseInt(year), 'brackets', req.ip);

    } catch (error) {
        logger.error('Failed to get tax brackets in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get tax brackets',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route GET /tax-rules/:country/:year/deductions
 * @desc Get deductions for a specific country, year, and filing status
 * @access Public
 */
router.get('/:country/:year/deductions', [
    param('country').isLength({ min: 2, max: 3 }).withMessage('Country code must be 2-3 characters'),
    param('year').isInt({ min: 2020, max: 2030 }).withMessage('Year must be between 2020 and 2030'),
    query('filingStatus').isIn(['single', 'marriedFilingJointly', 'marriedFilingSeparately', 'headOfHousehold', 'all']).withMessage('Invalid filing status'),
    query('state').optional().isLength({ min: 2, max: 5 }).withMessage('State code must be 2-5 characters'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { country, year } = req.params;
        const { filingStatus, state } = req.query;

        const taxRules = await taxRulesService.getTaxRules(country, parseInt(year));

        const deductions = taxRules.getDeductions(filingStatus, state);

        res.json({
            success: true,
            data: {
                country: country.toUpperCase(),
                year: parseInt(year),
                filingStatus,
                state: state || null,
                deductions
            }
        });

        logger.taxRules.access(country.toUpperCase(), parseInt(year), 'deductions', req.ip);

    } catch (error) {
        logger.error('Failed to get deductions in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get deductions',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route GET /tax-rules/:country/:year/validate
 * @desc Validate tax rules for a specific country and year
 * @access Public
 */
router.get('/:country/:year/validate', [
    param('country').isLength({ min: 2, max: 3 }).withMessage('Country code must be 2-3 characters'),
    param('year').isInt({ min: 2020, max: 2030 }).withMessage('Year must be between 2020 and 2030'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { country, year } = req.params;

        const validationResults = await taxRulesService.validateTaxRules(country, parseInt(year));

        res.json({
            success: true,
            data: validationResults
        });

        logger.taxRules.validation(country.toUpperCase(), parseInt(year), validationResults.isValid, validationResults.errors);

    } catch (error) {
        logger.error('Failed to validate tax rules in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to validate tax rules',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route GET /tax-rules/search
 * @desc Search tax rules with filters
 * @access Public
 */
router.get('/search', [
    query('country').optional().isLength({ min: 2, max: 3 }).withMessage('Country code must be 2-3 characters'),
    query('year').optional().isInt({ min: 2020, max: 2030 }).withMessage('Year must be between 2020 and 2030'),
    query('dataQuality').optional().isIn(['draft', 'verified', 'official']).withMessage('Invalid data quality'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be greater than 0'),
    query('sortBy').optional().isIn(['country', 'year', 'effectiveDate', 'lastUpdated']).withMessage('Invalid sort field'),
    query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
    handleValidationErrors
], async (req, res) => {
    try {
        const filters = {
            country: req.query.country,
            year: req.query.year ? parseInt(req.query.year) : undefined,
            dataQuality: req.query.dataQuality,
            effectiveDate: req.query.effectiveDate,
            limit: parseInt(req.query.limit) || 50,
            page: parseInt(req.query.page) || 1,
            sortBy: req.query.sortBy,
            sortOrder: req.query.sortOrder
        };

        const results = await taxRulesService.searchTaxRules(filters);

        res.json({
            success: true,
            data: results
        });

        logger.info('Tax rules search API call', {
            filters,
            resultCount: results.results.length,
            total: results.pagination.total
        });

    } catch (error) {
        logger.error('Failed to search tax rules in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search tax rules',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route GET /tax-rules/countries
 * @desc Get list of countries with available tax rules
 * @access Public
 */
router.get('/countries', async (req, res) => {
    try {
        const countries = await taxRulesService.getAvailableCountries();

        res.json({
            success: true,
            data: {
                countries,
                count: countries.length
            }
        });

        logger.info('Available countries API call', {
            count: countries.length
        });

    } catch (error) {
        logger.error('Failed to get available countries in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get available countries',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route GET /tax-rules/years
 * @desc Get list of available tax years
 * @access Public
 */
router.get('/years', [
    query('country').optional().isLength({ min: 2, max: 3 }).withMessage('Country code must be 2-3 characters'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { country } = req.query;

        const years = await taxRulesService.getAvailableYears(country);

        res.json({
            success: true,
            data: {
                country: country || 'all',
                years,
                count: years.length
            }
        });

        logger.info('Available years API call', {
            country: country || 'all',
            count: years.length
        });

    } catch (error) {
        logger.error('Failed to get available years in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get available years',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route GET /tax-rules/:country/:year/history
 * @desc Get version history for tax rules
 * @access Public
 */
router.get('/:country/:year/history', [
    param('country').isLength({ min: 2, max: 3 }).withMessage('Country code must be 2-3 characters'),
    param('year').isInt({ min: 2020, max: 2030 }).withMessage('Year must be between 2020 and 2030'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { country, year } = req.params;

        const history = await taxRulesService.getTaxRulesVersionHistory(country, parseInt(year));

        res.json({
            success: true,
            data: {
                country: country.toUpperCase(),
                year: parseInt(year),
                history,
                count: history.length
            }
        });

        logger.info('Tax rules history API call', {
            country: country.toUpperCase(),
            year: parseInt(year),
            versionsCount: history.length
        });

    } catch (error) {
        logger.error('Failed to get tax rules history in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get tax rules history',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route GET /tax-rules/:country/:year/summary
 * @desc Get a summary of tax rules for a country and year
 * @access Public
 */
router.get('/:country/:year/summary', [
    param('country').isLength({ min: 2, max: 3 }).withMessage('Country code must be 2-3 characters'),
    param('year').isInt({ min: 2020, max: 2030 }).withMessage('Year must be between 2020 and 2030'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { country, year } = req.params;

        const taxRules = await taxRulesService.getTaxRules(country, parseInt(year));

        // Create a summary of the tax rules
        const summary = {
            country: taxRules.country,
            year: taxRules.year,
            currency: taxRules.currency,
            version: taxRules.version,
            effectiveDate: taxRules.effectiveDate,
            dataQuality: taxRules.metadata.dataQuality,
            lastUpdated: taxRules.metadata.lastUpdated,
            federal: {
                hasTaxBrackets: !!(taxRules.federal?.taxBrackets),
                bracketCount: taxRules.federal?.taxBrackets ? Object.keys(taxRules.federal.taxBrackets).length : 0,
                deductionCount: taxRules.federal?.deductions?.length || 0,
                creditCount: taxRules.federal?.credits?.length || 0,
                socialInsuranceCount: taxRules.federal?.socialInsurance?.length || 0,
                hasAMT: taxRules.federal?.alternativeMinimumTax?.enabled || false
            },
            statesProvinces: {
                count: taxRules.statesProvinces?.length || 0,
                withIncomeTax: taxRules.statesProvinces?.filter(s => s.hasIncomeTax).length || 0,
                codes: taxRules.statesProvinces?.map(s => s.code) || []
            },
            features: {
                federalTax: !!(taxRules.federal?.taxBrackets),
                stateTax: (taxRules.statesProvinces?.length || 0) > 0,
                socialInsurance: (taxRules.federal?.socialInsurance?.length || 0) > 0,
                alternativeMinimumTax: taxRules.federal?.alternativeMinimumTax?.enabled || false
            }
        };

        res.json({
            success: true,
            data: summary
        });

        logger.taxRules.access(country.toUpperCase(), parseInt(year), 'summary', req.ip);

    } catch (error) {
        logger.error('Failed to get tax rules summary in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get tax rules summary',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

module.exports = router;