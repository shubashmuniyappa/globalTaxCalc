const { ExchangeRates } = require('../models');
const redis = require('../config/redis');
const logger = require('../config/logger');
const axios = require('axios');
const cron = require('node-cron');

class ExchangeRatesService {
    constructor() {
        this.apiKey = process.env.EXCHANGE_RATES_API_KEY;
        this.providers = {
            'exchangerate-api': 'https://v6.exchangerate-api.com/v6',
            'fixer': 'http://data.fixer.io/api',
            'openexchangerates': 'https://openexchangerates.org/api'
        };
        this.baseCurrency = 'USD';
        this.majorCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'];
        this.updateScheduled = false;
    }

    async initialize() {
        try {
            logger.info('Initializing Exchange Rates service...');

            // Load initial rates if not available
            const ratesCount = await ExchangeRates.countDocuments({ isCurrent: true });
            if (ratesCount === 0) {
                logger.info('No current exchange rates found, fetching initial data...');
                await this.updateAllRates();
            }

            // Schedule automatic updates
            this.scheduleUpdates();

            logger.info('Exchange Rates service initialized successfully');

        } catch (error) {
            logger.error('Failed to initialize Exchange Rates service:', error);
            throw error;
        }
    }

    async getCurrentRate(fromCurrency, toCurrency) {
        try {
            // Normalize currency codes
            fromCurrency = fromCurrency.toUpperCase();
            toCurrency = toCurrency.toUpperCase();

            // Same currency returns 1
            if (fromCurrency === toCurrency) {
                return {
                    rate: 1,
                    fromCurrency,
                    toCurrency,
                    date: new Date(),
                    source: 'same_currency'
                };
            }

            // Check cache first
            const cached = await redis.getExchangeRatesCache();
            if (cached && cached[`${fromCurrency}/${toCurrency}`]) {
                const rateData = cached[`${fromCurrency}/${toCurrency}`];
                return {
                    rate: rateData.rate,
                    fromCurrency,
                    toCurrency,
                    date: new Date(rateData.date),
                    source: 'cache'
                };
            }

            // Query database
            let exchangeRate = await ExchangeRates.findCurrentRate(fromCurrency, toCurrency);

            // Try inverse if direct rate not found
            if (!exchangeRate) {
                exchangeRate = await ExchangeRates.findCurrentRate(toCurrency, fromCurrency);
                if (exchangeRate) {
                    return {
                        rate: exchangeRate.inverseRate,
                        fromCurrency,
                        toCurrency,
                        date: exchangeRate.date,
                        source: 'database_inverse'
                    };
                }
            }

            // Try conversion via USD
            if (!exchangeRate && fromCurrency !== 'USD' && toCurrency !== 'USD') {
                const toUsdRate = await this.getCurrentRate(fromCurrency, 'USD');
                const fromUsdRate = await this.getCurrentRate('USD', toCurrency);

                if (toUsdRate && fromUsdRate) {
                    const rate = toUsdRate.rate * fromUsdRate.rate;
                    return {
                        rate,
                        fromCurrency,
                        toCurrency,
                        date: new Date(),
                        source: 'calculated_via_usd'
                    };
                }
            }

            // If no rate found, try to fetch from external API
            if (!exchangeRate) {
                await this.fetchRateFromAPI(fromCurrency, toCurrency);
                exchangeRate = await ExchangeRates.findCurrentRate(fromCurrency, toCurrency);
            }

            if (!exchangeRate) {
                throw new Error(`Exchange rate not found for ${fromCurrency}/${toCurrency}`);
            }

            return {
                rate: exchangeRate.rate,
                fromCurrency,
                toCurrency,
                date: exchangeRate.date,
                source: 'database'
            };

        } catch (error) {
            logger.error('Failed to get current rate:', error);
            throw error;
        }
    }

    async convertAmount(amount, fromCurrency, toCurrency) {
        try {
            const rateData = await this.getCurrentRate(fromCurrency, toCurrency);
            const convertedAmount = amount * rateData.rate;

            return {
                originalAmount: amount,
                convertedAmount: Math.round(convertedAmount * 100) / 100, // Round to 2 decimal places
                fromCurrency: fromCurrency.toUpperCase(),
                toCurrency: toCurrency.toUpperCase(),
                rate: rateData.rate,
                date: rateData.date,
                source: rateData.source
            };

        } catch (error) {
            logger.error('Failed to convert amount:', error);
            throw error;
        }
    }

    async getHistoricalRate(fromCurrency, toCurrency, date) {
        try {
            fromCurrency = fromCurrency.toUpperCase();
            toCurrency = toCurrency.toUpperCase();

            if (fromCurrency === toCurrency) {
                return { rate: 1, date, source: 'same_currency' };
            }

            const exchangeRate = await ExchangeRates.findRateByDate(fromCurrency, toCurrency, date);

            if (!exchangeRate) {
                // Try to find the closest available date
                const closestRate = await ExchangeRates.findOne({
                    fromCurrency,
                    toCurrency,
                    date: { $lte: date },
                    isActive: true
                }).sort({ date: -1 });

                if (closestRate) {
                    return {
                        rate: closestRate.rate,
                        date: closestRate.date,
                        requestedDate: date,
                        source: 'closest_available'
                    };
                }

                throw new Error(`No historical rate found for ${fromCurrency}/${toCurrency} on ${date}`);
            }

            return {
                rate: exchangeRate.rate,
                date: exchangeRate.date,
                source: 'historical'
            };

        } catch (error) {
            logger.error('Failed to get historical rate:', error);
            throw error;
        }
    }

    async updateAllRates(provider = 'exchangerate-api') {
        try {
            logger.info('Starting exchange rates update...');

            const rates = await this.fetchRatesFromProvider(provider);

            if (!rates || Object.keys(rates).length === 0) {
                throw new Error('No rates received from provider');
            }

            const updateResults = {
                success: 0,
                errors: 0,
                provider,
                timestamp: new Date()
            };

            // Process each rate
            for (const [currencyPair, rate] of Object.entries(rates)) {
                try {
                    const [fromCurrency, toCurrency] = currencyPair.split('/');
                    await this.updateRate(fromCurrency, toCurrency, rate, provider);
                    updateResults.success++;
                } catch (error) {
                    logger.error(`Failed to update rate ${currencyPair}:`, error);
                    updateResults.errors++;
                }
            }

            // Update cache
            await redis.cacheExchangeRates(rates);

            logger.info('Exchange rates update completed', updateResults);

            return updateResults;

        } catch (error) {
            logger.error('Failed to update all rates:', error);
            throw error;
        }
    }

    async updateRate(fromCurrency, toCurrency, rate, source = 'api') {
        try {
            // Mark old rate as not current
            await ExchangeRates.updateMany(
                {
                    fromCurrency: fromCurrency.toUpperCase(),
                    toCurrency: toCurrency.toUpperCase(),
                    isCurrent: true
                },
                { isCurrent: false }
            );

            // Create new rate entry
            const exchangeRate = new ExchangeRates({
                fromCurrency: fromCurrency.toUpperCase(),
                toCurrency: toCurrency.toUpperCase(),
                rate: parseFloat(rate),
                source: {
                    provider: source,
                    lastUpdate: new Date()
                },
                isCurrent: true
            });

            await exchangeRate.save();

            return exchangeRate;

        } catch (error) {
            logger.error('Failed to update rate:', error);
            throw error;
        }
    }

    async fetchRatesFromProvider(provider = 'exchangerate-api') {
        try {
            switch (provider) {
                case 'exchangerate-api':
                    return await this.fetchFromExchangeRateAPI();
                case 'fixer':
                    return await this.fetchFromFixer();
                case 'openexchangerates':
                    return await this.fetchFromOpenExchangeRates();
                default:
                    throw new Error(`Unknown provider: ${provider}`);
            }
        } catch (error) {
            logger.error(`Failed to fetch from ${provider}:`, error);
            throw error;
        }
    }

    async fetchFromExchangeRateAPI() {
        try {
            if (!this.apiKey) {
                throw new Error('Exchange Rate API key not configured');
            }

            const url = `${this.providers['exchangerate-api']}/${this.apiKey}/latest/${this.baseCurrency}`;
            const response = await axios.get(url, { timeout: 10000 });

            if (response.data.result !== 'success') {
                throw new Error(`API error: ${response.data['error-type']}`);
            }

            const rates = {};
            for (const [currency, rate] of Object.entries(response.data.conversion_rates)) {
                if (currency !== this.baseCurrency) {
                    rates[`${this.baseCurrency}/${currency}`] = rate;
                }
            }

            return rates;

        } catch (error) {
            logger.error('Failed to fetch from Exchange Rate API:', error);
            throw error;
        }
    }

    async fetchFromFixer() {
        try {
            if (!this.apiKey) {
                throw new Error('Fixer API key not configured');
            }

            const url = `${this.providers.fixer}/latest?access_key=${this.apiKey}&base=${this.baseCurrency}`;
            const response = await axios.get(url, { timeout: 10000 });

            if (!response.data.success) {
                throw new Error(`Fixer API error: ${response.data.error?.info}`);
            }

            const rates = {};
            for (const [currency, rate] of Object.entries(response.data.rates)) {
                rates[`${this.baseCurrency}/${currency}`] = rate;
            }

            return rates;

        } catch (error) {
            logger.error('Failed to fetch from Fixer:', error);
            throw error;
        }
    }

    async fetchFromOpenExchangeRates() {
        try {
            if (!this.apiKey) {
                throw new Error('Open Exchange Rates API key not configured');
            }

            const url = `${this.providers.openexchangerates}/latest.json?app_id=${this.apiKey}&base=${this.baseCurrency}`;
            const response = await axios.get(url, { timeout: 10000 });

            const rates = {};
            for (const [currency, rate] of Object.entries(response.data.rates)) {
                rates[`${this.baseCurrency}/${currency}`] = rate;
            }

            return rates;

        } catch (error) {
            logger.error('Failed to fetch from Open Exchange Rates:', error);
            throw error;
        }
    }

    async fetchRateFromAPI(fromCurrency, toCurrency) {
        try {
            // Try to get rate from primary provider
            const rates = await this.fetchRatesFromProvider();

            const directRate = rates[`${fromCurrency}/${toCurrency}`];
            if (directRate) {
                await this.updateRate(fromCurrency, toCurrency, directRate);
                return;
            }

            // Try inverse rate
            const inverseRate = rates[`${toCurrency}/${fromCurrency}`];
            if (inverseRate) {
                await this.updateRate(fromCurrency, toCurrency, 1 / inverseRate);
                return;
            }

            // Try via USD
            const fromUsdRate = rates[`USD/${fromCurrency}`];
            const toUsdRate = rates[`USD/${toCurrency}`];

            if (fromUsdRate && toUsdRate) {
                const calculatedRate = toUsdRate / fromUsdRate;
                await this.updateRate(fromCurrency, toCurrency, calculatedRate);
                return;
            }

            throw new Error(`Cannot calculate rate for ${fromCurrency}/${toCurrency}`);

        } catch (error) {
            logger.error('Failed to fetch rate from API:', error);
            throw error;
        }
    }

    async getMajorCurrencyRates() {
        try {
            const cached = await redis.get('major_currency_rates');
            if (cached) {
                return cached;
            }

            const rates = {};

            for (const fromCurrency of this.majorCurrencies) {
                rates[fromCurrency] = {};
                for (const toCurrency of this.majorCurrencies) {
                    if (fromCurrency !== toCurrency) {
                        try {
                            const rateData = await this.getCurrentRate(fromCurrency, toCurrency);
                            rates[fromCurrency][toCurrency] = {
                                rate: rateData.rate,
                                date: rateData.date
                            };
                        } catch (error) {
                            // Skip rates that can't be found
                            logger.warn(`Could not get rate for ${fromCurrency}/${toCurrency}`);
                        }
                    }
                }
            }

            // Cache for 30 minutes
            await redis.set('major_currency_rates', rates, 1800);

            return rates;

        } catch (error) {
            logger.error('Failed to get major currency rates:', error);
            throw error;
        }
    }

    async getCurrencyList() {
        try {
            const cached = await redis.get('currency_list');
            if (cached) {
                return cached;
            }

            const currencies = await ExchangeRates.distinct('fromCurrency', { isCurrent: true });

            const currencyList = currencies.map(code => ({
                code,
                name: this.getCurrencyName(code),
                isMajor: this.majorCurrencies.includes(code)
            })).sort((a, b) => a.code.localeCompare(b.code));

            // Cache for 1 day
            await redis.set('currency_list', currencyList, 86400);

            return currencyList;

        } catch (error) {
            logger.error('Failed to get currency list:', error);
            throw error;
        }
    }

    getCurrencyName(code) {
        const currencyNames = {
            'USD': 'US Dollar',
            'EUR': 'Euro',
            'GBP': 'British Pound',
            'JPY': 'Japanese Yen',
            'CHF': 'Swiss Franc',
            'CAD': 'Canadian Dollar',
            'AUD': 'Australian Dollar',
            'NZD': 'New Zealand Dollar',
            'CNY': 'Chinese Yuan',
            'INR': 'Indian Rupee',
            'BRL': 'Brazilian Real',
            'RUB': 'Russian Ruble',
            'KRW': 'South Korean Won',
            'SGD': 'Singapore Dollar',
            'HKD': 'Hong Kong Dollar',
            'NOK': 'Norwegian Krone',
            'SEK': 'Swedish Krona',
            'DKK': 'Danish Krone',
            'PLN': 'Polish Zloty',
            'CZK': 'Czech Koruna',
            'HUF': 'Hungarian Forint',
            'ILS': 'Israeli Shekel',
            'ZAR': 'South African Rand',
            'MXN': 'Mexican Peso',
            'TRY': 'Turkish Lira',
            'THB': 'Thai Baht',
            'MYR': 'Malaysian Ringgit',
            'PHP': 'Philippine Peso',
            'IDR': 'Indonesian Rupiah',
            'VND': 'Vietnamese Dong'
        };

        return currencyNames[code] || code;
    }

    scheduleUpdates() {
        if (this.updateScheduled) {
            return;
        }

        // Update rates every 6 hours
        const cronExpression = process.env.UPDATE_EXCHANGE_RATES_CRON || '0 */6 * * *';

        cron.schedule(cronExpression, async () => {
            try {
                logger.info('Starting scheduled exchange rates update...');
                await this.updateAllRates();
            } catch (error) {
                logger.error('Scheduled exchange rates update failed:', error);
            }
        });

        this.updateScheduled = true;
        logger.info('Exchange rates update scheduled');
    }

    async getStaleRates(maxAgeHours = 6) {
        try {
            return await ExchangeRates.findStaleRates(maxAgeHours);
        } catch (error) {
            logger.error('Failed to get stale rates:', error);
            throw error;
        }
    }

    async cleanupOldRates(daysToKeep = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            const result = await ExchangeRates.deleteMany({
                date: { $lt: cutoffDate },
                isCurrent: false
            });

            logger.info(`Cleaned up ${result.deletedCount} old exchange rate records`);

            return result;

        } catch (error) {
            logger.error('Failed to cleanup old rates:', error);
            throw error;
        }
    }

    async healthCheck() {
        try {
            // Check if we have current rates
            const currentRatesCount = await ExchangeRates.countDocuments({ isCurrent: true });

            // Check for stale rates
            const staleRates = await this.getStaleRates();

            // Test API connectivity if configured
            let apiStatus = 'not_configured';
            if (this.apiKey) {
                try {
                    await this.fetchRatesFromProvider();
                    apiStatus = 'connected';
                } catch (error) {
                    apiStatus = 'error';
                }
            }

            const health = {
                status: currentRatesCount > 0 ? 'healthy' : 'unhealthy',
                currentRatesCount,
                staleRatesCount: staleRates.length,
                apiStatus,
                lastUpdate: await this.getLastUpdateTime(),
                cacheStatus: redis.isHealthy() ? 'connected' : 'disconnected'
            };

            return health;

        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    async getLastUpdateTime() {
        try {
            const latestRate = await ExchangeRates.findOne({ isCurrent: true })
                .sort({ 'source.lastUpdate': -1 });

            return latestRate ? latestRate.source.lastUpdate : null;

        } catch (error) {
            logger.error('Failed to get last update time:', error);
            return null;
        }
    }
}

// Create singleton instance
const exchangeRatesService = new ExchangeRatesService();

module.exports = exchangeRatesService;