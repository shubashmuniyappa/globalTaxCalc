const redis = require('redis');
const logger = require('./logger');

class RedisManager {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.retryAttempts = 0;
        this.maxRetryAttempts = 5;
    }

    async connect() {
        try {
            // Redis connection configuration
            const redisConfig = {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                db: process.env.REDIS_DB || 3,
                retryDelayOnFailover: 100,
                enableReadyCheck: true,
                maxRetriesPerRequest: 3
            };

            // Add password if provided
            if (process.env.REDIS_PASSWORD) {
                redisConfig.password = process.env.REDIS_PASSWORD;
            }

            // Create Redis client
            this.client = redis.createClient(redisConfig);

            // Error handling
            this.client.on('error', (error) => {
                logger.error('Redis connection error:', error);
                this.isConnected = false;
            });

            this.client.on('connect', () => {
                logger.info('Redis client connected');
            });

            this.client.on('ready', () => {
                logger.info('Redis client ready');
                this.isConnected = true;
                this.retryAttempts = 0;
            });

            this.client.on('end', () => {
                logger.warn('Redis connection ended');
                this.isConnected = false;
            });

            this.client.on('reconnecting', () => {
                this.retryAttempts++;
                logger.info(`Redis reconnecting (attempt ${this.retryAttempts})`);

                if (this.retryAttempts >= this.maxRetryAttempts) {
                    logger.error('Max Redis retry attempts reached');
                    this.client.disconnect();
                }
            });

            // Connect to Redis
            await this.client.connect();

            logger.info('Redis connection established');
            return this.client;

        } catch (error) {
            logger.error('Redis connection failed:', error);
            throw error;
        }
    }

    async disconnect() {
        try {
            if (this.client && this.isConnected) {
                await this.client.disconnect();
                this.isConnected = false;
                logger.info('Redis connection closed');
            }
        } catch (error) {
            logger.error('Error closing Redis connection:', error);
            throw error;
        }
    }

    async healthCheck() {
        try {
            if (!this.isConnected || !this.client) {
                throw new Error('Redis not connected');
            }

            const start = Date.now();
            await this.client.ping();
            const responseTime = Date.now() - start;

            return {
                status: 'healthy',
                connected: this.isConnected,
                responseTime: `${responseTime}ms`,
                server: await this.client.info('server')
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                connected: false,
                error: error.message
            };
        }
    }

    getClient() {
        return this.client;
    }

    isHealthy() {
        return this.isConnected && this.client && this.client.isReady;
    }

    // Cache operations with TTL
    async set(key, value, ttl = 3600) {
        try {
            if (!this.isHealthy()) {
                logger.warn('Redis not available for SET operation');
                return false;
            }

            const serializedValue = JSON.stringify(value);
            await this.client.setEx(key, ttl, serializedValue);

            logger.debug(`Cache SET: ${key} (TTL: ${ttl}s)`);
            return true;
        } catch (error) {
            logger.error('Redis SET error:', error);
            return false;
        }
    }

    async get(key) {
        try {
            if (!this.isHealthy()) {
                logger.warn('Redis not available for GET operation');
                return null;
            }

            const value = await this.client.get(key);

            if (value) {
                logger.debug(`Cache HIT: ${key}`);
                return JSON.parse(value);
            } else {
                logger.debug(`Cache MISS: ${key}`);
                return null;
            }
        } catch (error) {
            logger.error('Redis GET error:', error);
            return null;
        }
    }

    async del(key) {
        try {
            if (!this.isHealthy()) {
                logger.warn('Redis not available for DEL operation');
                return false;
            }

            const result = await this.client.del(key);
            logger.debug(`Cache DEL: ${key}`);
            return result > 0;
        } catch (error) {
            logger.error('Redis DEL error:', error);
            return false;
        }
    }

    async exists(key) {
        try {
            if (!this.isHealthy()) {
                return false;
            }

            const exists = await this.client.exists(key);
            return exists === 1;
        } catch (error) {
            logger.error('Redis EXISTS error:', error);
            return false;
        }
    }

    async flushByPattern(pattern) {
        try {
            if (!this.isHealthy()) {
                logger.warn('Redis not available for pattern flush');
                return false;
            }

            const keys = await this.client.keys(pattern);
            if (keys.length > 0) {
                await this.client.del(keys);
                logger.info(`Flushed ${keys.length} keys matching pattern: ${pattern}`);
            }
            return true;
        } catch (error) {
            logger.error('Redis pattern flush error:', error);
            return false;
        }
    }

    // Specialized cache methods for different data types
    async cacheLocation(ip, locationData, ttl = null) {
        const key = `location:${ip}`;
        const cacheTtl = ttl || parseInt(process.env.CACHE_TTL_LOCATION) || 3600;
        return await this.set(key, locationData, cacheTtl);
    }

    async getLocationCache(ip) {
        const key = `location:${ip}`;
        return await this.get(key);
    }

    async cacheTaxRules(country, year, rules, ttl = null) {
        const key = `tax_rules:${country}:${year}`;
        const cacheTtl = ttl || parseInt(process.env.CACHE_TTL_TAX_RULES) || 86400;
        return await this.set(key, rules, cacheTtl);
    }

    async getTaxRulesCache(country, year) {
        const key = `tax_rules:${country}:${year}`;
        return await this.get(key);
    }

    async cacheExchangeRates(rates, ttl = null) {
        const key = 'exchange_rates:current';
        const cacheTtl = ttl || parseInt(process.env.CACHE_TTL_EXCHANGE_RATES) || 3600;
        return await this.set(key, rates, cacheTtl);
    }

    async getExchangeRatesCache() {
        const key = 'exchange_rates:current';
        return await this.get(key);
    }

    async cacheCountries(countries, ttl = null) {
        const key = 'countries:all';
        const cacheTtl = ttl || parseInt(process.env.CACHE_TTL_COUNTRIES) || 604800;
        return await this.set(key, countries, cacheTtl);
    }

    async getCountriesCache() {
        const key = 'countries:all';
        return await this.get(key);
    }

    // Cache invalidation methods
    async invalidateLocationCache(ip = null) {
        if (ip) {
            return await this.del(`location:${ip}`);
        } else {
            return await this.flushByPattern('location:*');
        }
    }

    async invalidateTaxRulesCache(country = null, year = null) {
        if (country && year) {
            return await this.del(`tax_rules:${country}:${year}`);
        } else if (country) {
            return await this.flushByPattern(`tax_rules:${country}:*`);
        } else {
            return await this.flushByPattern('tax_rules:*');
        }
    }

    async invalidateExchangeRatesCache() {
        return await this.del('exchange_rates:current');
    }

    async invalidateCountriesCache() {
        return await this.del('countries:all');
    }
}

// Create singleton instance
const redisManager = new RedisManager();

module.exports = {
    connect: () => redisManager.connect(),
    disconnect: () => redisManager.disconnect(),
    healthCheck: () => redisManager.healthCheck(),
    getClient: () => redisManager.getClient(),
    isHealthy: () => redisManager.isHealthy(),

    // Cache operations
    set: (key, value, ttl) => redisManager.set(key, value, ttl),
    get: (key) => redisManager.get(key),
    del: (key) => redisManager.del(key),
    exists: (key) => redisManager.exists(key),
    flushByPattern: (pattern) => redisManager.flushByPattern(pattern),

    // Specialized cache methods
    cacheLocation: (ip, data, ttl) => redisManager.cacheLocation(ip, data, ttl),
    getLocationCache: (ip) => redisManager.getLocationCache(ip),
    cacheTaxRules: (country, year, rules, ttl) => redisManager.cacheTaxRules(country, year, rules, ttl),
    getTaxRulesCache: (country, year) => redisManager.getTaxRulesCache(country, year),
    cacheExchangeRates: (rates, ttl) => redisManager.cacheExchangeRates(rates, ttl),
    getExchangeRatesCache: () => redisManager.getExchangeRatesCache(),
    cacheCountries: (countries, ttl) => redisManager.cacheCountries(countries, ttl),
    getCountriesCache: () => redisManager.getCountriesCache(),

    // Cache invalidation
    invalidateLocationCache: (ip) => redisManager.invalidateLocationCache(ip),
    invalidateTaxRulesCache: (country, year) => redisManager.invalidateTaxRulesCache(country, year),
    invalidateExchangeRatesCache: () => redisManager.invalidateExchangeRatesCache(),
    invalidateCountriesCache: () => redisManager.invalidateCountriesCache()
};