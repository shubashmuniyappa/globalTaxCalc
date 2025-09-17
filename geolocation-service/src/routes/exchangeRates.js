const express = require('express');
const router = express.Router();
const exchangeRatesService = require('../services/exchangeRatesService');
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
 * @route GET /exchange-rates/current
 * @desc Get current exchange rates for all currencies
 * @access Public
 */
router.get('/current', [
    query('base').optional().isLength({ min: 3, max: 3 }).withMessage('Base currency must be 3 characters'),
    query('targets').optional().custom((value) => {
        if (value) {
            const currencies = value.split(',');
            return currencies.every(c => c.length === 3);
        }
        return true;
    }).withMessage('Target currencies must be 3 characters each'),
    query('source').optional().isIn(['exchangerate-api', 'fixer', 'openexchangerates']).withMessage('Invalid source'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { base = 'USD', targets, source } = req.query;

        const targetCurrencies = targets ? targets.split(',').map(c => c.toUpperCase()) : null;

        const options = {
            source: source || 'exchangerate-api',
            targetCurrencies
        };

        const rates = await exchangeRatesService.getCurrentRates(base.toUpperCase(), options);

        res.json({
            success: true,
            data: {
                base: base.toUpperCase(),
                timestamp: rates.timestamp,
                source: rates.source,
                rates: rates.rates,
                count: Object.keys(rates.rates).length
            }
        });

        logger.info('Current exchange rates API call', {
            base: base.toUpperCase(),
            targetCount: targetCurrencies?.length || 'all',
            source: rates.source
        });

    } catch (error) {
        logger.error('Failed to get current exchange rates in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get current exchange rates',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route GET /exchange-rates/:from/:to
 * @desc Get exchange rate between two currencies
 * @access Public
 */
router.get('/:from/:to', [
    param('from').isLength({ min: 3, max: 3 }).withMessage('From currency must be 3 characters'),
    param('to').isLength({ min: 3, max: 3 }).withMessage('To currency must be 3 characters'),
    query('amount').optional().isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
    query('date').optional().isISO8601().withMessage('Date must be in ISO 8601 format'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { from, to } = req.params;
        const { amount = 1, date } = req.query;

        const fromCurrency = from.toUpperCase();
        const toCurrency = to.toUpperCase();

        let exchangeData;
        if (date) {
            exchangeData = await exchangeRatesService.getHistoricalRate(fromCurrency, toCurrency, new Date(date));
        } else {
            exchangeData = await exchangeRatesService.convertCurrency(fromCurrency, toCurrency, parseFloat(amount));
        }

        res.json({
            success: true,
            data: {
                from: fromCurrency,
                to: toCurrency,
                rate: exchangeData.rate,
                amount: parseFloat(amount),
                convertedAmount: exchangeData.convertedAmount || (exchangeData.rate * parseFloat(amount)),
                timestamp: exchangeData.timestamp,
                source: exchangeData.source,
                isHistorical: !!date
            }
        });

        logger.info('Currency conversion API call', {
            from: fromCurrency,
            to: toCurrency,
            amount: parseFloat(amount),
            isHistorical: !!date
        });

    } catch (error) {
        logger.error('Failed to convert currency in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to convert currency',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route GET /exchange-rates/:currency/historical
 * @desc Get historical exchange rates for a currency
 * @access Public
 */
router.get('/:currency/historical', [
    param('currency').isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
    query('base').optional().isLength({ min: 3, max: 3 }).withMessage('Base currency must be 3 characters'),
    query('startDate').isISO8601().withMessage('Start date must be in ISO 8601 format'),
    query('endDate').optional().isISO8601().withMessage('End date must be in ISO 8601 format'),
    query('interval').optional().isIn(['daily', 'weekly', 'monthly']).withMessage('Invalid interval'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { currency } = req.params;
        const { base = 'USD', startDate, endDate, interval = 'daily' } = req.query;

        const options = {
            base: base.toUpperCase(),
            startDate: new Date(startDate),
            endDate: endDate ? new Date(endDate) : new Date(),
            interval
        };

        const historicalData = await exchangeRatesService.getHistoricalRates(currency.toUpperCase(), options);

        res.json({
            success: true,
            data: {
                currency: currency.toUpperCase(),
                base: base.toUpperCase(),
                interval,
                startDate: options.startDate,
                endDate: options.endDate,
                rates: historicalData.rates,
                count: historicalData.rates.length,
                statistics: historicalData.statistics
            }
        });

        logger.info('Historical exchange rates API call', {
            currency: currency.toUpperCase(),
            base: base.toUpperCase(),
            interval,
            dateRange: `${startDate} to ${endDate || 'now'}`,
            dataPoints: historicalData.rates.length
        });

    } catch (error) {
        logger.error('Failed to get historical exchange rates in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get historical exchange rates',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route GET /exchange-rates/currencies
 * @desc Get list of supported currencies
 * @access Public
 */
router.get('/currencies', async (req, res) => {
    try {
        const currencies = await exchangeRatesService.getSupportedCurrencies();

        res.json({
            success: true,
            data: {
                currencies,
                count: currencies.length
            }
        });

        logger.info('Supported currencies API call', {
            count: currencies.length
        });

    } catch (error) {
        logger.error('Failed to get supported currencies in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get supported currencies',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route GET /exchange-rates/trends/:currency
 * @desc Get exchange rate trends and analysis
 * @access Public
 */
router.get('/trends/:currency', [
    param('currency').isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
    query('base').optional().isLength({ min: 3, max: 3 }).withMessage('Base currency must be 3 characters'),
    query('period').optional().isIn(['7d', '30d', '90d', '1y']).withMessage('Invalid period'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { currency } = req.params;
        const { base = 'USD', period = '30d' } = req.query;

        const trends = await exchangeRatesService.getCurrencyTrends(
            currency.toUpperCase(),
            base.toUpperCase(),
            period
        );

        res.json({
            success: true,
            data: {
                currency: currency.toUpperCase(),
                base: base.toUpperCase(),
                period,
                trends: {
                    current: trends.current,
                    change: trends.change,
                    changePercent: trends.changePercent,
                    volatility: trends.volatility,
                    trend: trends.trend,
                    support: trends.support,
                    resistance: trends.resistance
                },
                analysis: trends.analysis,
                generatedAt: new Date().toISOString()
            }
        });

        logger.info('Currency trends API call', {
            currency: currency.toUpperCase(),
            base: base.toUpperCase(),
            period,
            trend: trends.trend
        });

    } catch (error) {
        logger.error('Failed to get currency trends in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get currency trends',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route GET /exchange-rates/batch-convert
 * @desc Convert multiple amounts to different currencies
 * @access Public
 */
router.get('/batch-convert', [
    query('amount').isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
    query('from').isLength({ min: 3, max: 3 }).withMessage('From currency must be 3 characters'),
    query('to').custom((value) => {
        if (value) {
            const currencies = value.split(',');
            return currencies.every(c => c.length === 3);
        }
        return false;
    }).withMessage('To currencies must be provided and be 3 characters each'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { amount, from, to } = req.query;

        const fromCurrency = from.toUpperCase();
        const toCurrencies = to.split(',').map(c => c.toUpperCase());

        const conversions = await exchangeRatesService.batchConvert(
            fromCurrency,
            toCurrencies,
            parseFloat(amount)
        );

        res.json({
            success: true,
            data: {
                amount: parseFloat(amount),
                from: fromCurrency,
                conversions,
                timestamp: new Date().toISOString(),
                count: conversions.length
            }
        });

        logger.info('Batch currency conversion API call', {
            amount: parseFloat(amount),
            from: fromCurrency,
            toCurrencies: toCurrencies,
            conversionCount: conversions.length
        });

    } catch (error) {
        logger.error('Failed to perform batch conversion in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to perform batch conversion',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route GET /exchange-rates/status
 * @desc Get exchange rate service status and health
 * @access Public
 */
router.get('/status', async (req, res) => {
    try {
        const status = await exchangeRatesService.getServiceStatus();

        res.json({
            success: true,
            data: {
                status: status.isHealthy ? 'healthy' : 'degraded',
                providers: status.providers,
                lastUpdate: status.lastUpdate,
                nextUpdate: status.nextUpdate,
                cacheStatus: status.cache,
                uptime: status.uptime
            }
        });

    } catch (error) {
        logger.error('Failed to get exchange rates service status in API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get service status',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

module.exports = router;