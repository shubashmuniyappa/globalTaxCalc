const express = require('express');
const router = express.Router();

// Import route modules
const locationRoutes = require('./location');
const countriesRoutes = require('./countries');
const statesRoutes = require('./states');
const taxRulesRoutes = require('./taxRules');
const exchangeRatesRoutes = require('./exchangeRates');

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        success: true,
        service: 'Geolocation & Tax Rules Service',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
    });
});

// API info endpoint
router.get('/', (req, res) => {
    res.json({
        success: true,
        service: 'Geolocation & Tax Rules Service',
        version: process.env.npm_package_version || '1.0.0',
        endpoints: {
            location: '/api/location',
            countries: '/api/countries',
            states: '/api/states',
            taxRules: '/api/tax-rules',
            exchangeRates: '/api/exchange-rates'
        },
        documentation: {
            swagger: '/api/docs',
            postman: '/api/postman'
        }
    });
});

// Mount route modules
router.use('/location', locationRoutes);
router.use('/countries', countriesRoutes);
router.use('/states', statesRoutes);
router.use('/tax-rules', taxRulesRoutes);
router.use('/exchange-rates', exchangeRatesRoutes);

module.exports = router;