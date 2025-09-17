const { TaxRules, Countries, States } = require('../models');
const redis = require('../config/redis');
const logger = require('../config/logger');
const Joi = require('joi');

class TaxRulesService {
    constructor() {
        this.validationSchema = this.createValidationSchema();
    }

    // CRUD Operations for Tax Rules

    async createTaxRules(taxRulesData, userId = 'system') {
        try {
            // Validate input data
            const { error, value } = this.validationSchema.validate(taxRulesData);
            if (error) {
                throw new Error(`Validation failed: ${error.details.map(d => d.message).join(', ')}`);
            }

            // Check if rules already exist for this country and year
            const existing = await TaxRules.findByCountryYear(value.country, value.year);
            if (existing) {
                throw new Error(`Tax rules already exist for ${value.country} ${value.year}`);
            }

            // Set metadata
            value.createdBy = userId;
            value.updatedBy = userId;
            value.metadata = {
                ...value.metadata,
                lastUpdated: new Date(),
                dataQuality: value.metadata?.dataQuality || 'draft'
            };

            // Create new tax rules
            const taxRules = new TaxRules(value);
            await taxRules.save();

            // Invalidate cache
            await redis.invalidateTaxRulesCache(value.country, value.year);

            logger.taxRules.update(value.country, value.year, 'create', userId);

            return taxRules;

        } catch (error) {
            logger.error('Failed to create tax rules:', error);
            throw error;
        }
    }

    async getTaxRules(country, year, options = {}) {
        try {
            const cacheKey = `${country.toUpperCase()}_${year}`;

            // Check cache first unless bypassed
            if (!options.bypassCache) {
                const cached = await redis.getTaxRulesCache(country, year);
                if (cached) {
                    logger.taxRules.access(country, year, 'cache_hit', options.userId);
                    return cached;
                }
            }

            // Query database
            const taxRules = await TaxRules.findByCountryYear(country, year);

            if (!taxRules) {
                throw new Error(`Tax rules not found for ${country} ${year}`);
            }

            // Validate rules are still active and valid
            if (!taxRules.isValid()) {
                throw new Error(`Tax rules for ${country} ${year} are no longer valid`);
            }

            // Cache the result
            await redis.cacheTaxRules(country, year, taxRules);

            logger.taxRules.access(country, year, 'database', options.userId);

            return taxRules;

        } catch (error) {
            logger.error('Failed to get tax rules:', error);
            throw error;
        }
    }

    async updateTaxRules(country, year, updates, userId = 'system') {
        try {
            // Find existing rules
            const existingRules = await TaxRules.findByCountryYear(country, year);
            if (!existingRules) {
                throw new Error(`Tax rules not found for ${country} ${year}`);
            }

            // Create version history entry before updating
            await this.createVersionHistory(existingRules, userId);

            // Validate updates
            const mergedData = { ...existingRules.toObject(), ...updates };
            const { error, value } = this.validationSchema.validate(mergedData);
            if (error) {
                throw new Error(`Validation failed: ${error.details.map(d => d.message).join(', ')}`);
            }

            // Update fields
            Object.assign(existingRules, updates);
            existingRules.updatedBy = userId;
            existingRules.metadata.lastUpdated = new Date();

            // Increment version
            const currentVersion = existingRules.version || '1.0.0';
            existingRules.version = this.incrementVersion(currentVersion);

            await existingRules.save();

            // Invalidate cache
            await redis.invalidateTaxRulesCache(country, year);

            logger.taxRules.update(country, year, 'update', userId);

            return existingRules;

        } catch (error) {
            logger.error('Failed to update tax rules:', error);
            throw error;
        }
    }

    async deleteTaxRules(country, year, userId = 'system') {
        try {
            const taxRules = await TaxRules.findByCountryYear(country, year);
            if (!taxRules) {
                throw new Error(`Tax rules not found for ${country} ${year}`);
            }

            // Soft delete - mark as inactive instead of removing
            taxRules.isActive = false;
            taxRules.updatedBy = userId;
            taxRules.metadata.lastUpdated = new Date();

            await taxRules.save();

            // Invalidate cache
            await redis.invalidateTaxRulesCache(country, year);

            logger.taxRules.update(country, year, 'delete', userId);

            return { message: 'Tax rules marked as inactive' };

        } catch (error) {
            logger.error('Failed to delete tax rules:', error);
            throw error;
        }
    }

    // Versioning and History

    async createVersionHistory(taxRules, userId) {
        try {
            // Create a snapshot of current rules before modification
            const snapshot = {
                ...taxRules.toObject(),
                originalId: taxRules._id,
                versionTimestamp: new Date(),
                versionCreatedBy: userId,
                isHistoricalVersion: true
            };

            delete snapshot._id; // Remove ID to create new document

            const historyRules = new TaxRules(snapshot);
            await historyRules.save();

            logger.info('Created version history', {
                country: taxRules.country,
                year: taxRules.year,
                version: taxRules.version
            });

        } catch (error) {
            logger.error('Failed to create version history:', error);
            // Don't throw - this shouldn't block the main operation
        }
    }

    async getTaxRulesVersionHistory(country, year) {
        try {
            return await TaxRules.find({
                country: country.toUpperCase(),
                year: year,
                isHistoricalVersion: true
            }).sort({ versionTimestamp: -1 });

        } catch (error) {
            logger.error('Failed to get version history:', error);
            throw error;
        }
    }

    async restoreTaxRulesVersion(country, year, versionId, userId = 'system') {
        try {
            // Find the historical version
            const historicalVersion = await TaxRules.findById(versionId);
            if (!historicalVersion || !historicalVersion.isHistoricalVersion) {
                throw new Error('Historical version not found');
            }

            // Get current version for backup
            const currentRules = await TaxRules.findByCountryYear(country, year);
            if (currentRules) {
                await this.createVersionHistory(currentRules, userId);
            }

            // Restore historical version as current
            const restoredData = historicalVersion.toObject();
            delete restoredData._id;
            delete restoredData.isHistoricalVersion;
            delete restoredData.versionTimestamp;
            delete restoredData.versionCreatedBy;

            restoredData.updatedBy = userId;
            restoredData.metadata.lastUpdated = new Date();
            restoredData.version = this.incrementVersion(restoredData.version);

            if (currentRules) {
                Object.assign(currentRules, restoredData);
                await currentRules.save();
            } else {
                const newRules = new TaxRules(restoredData);
                await newRules.save();
            }

            // Invalidate cache
            await redis.invalidateTaxRulesCache(country, year);

            logger.taxRules.update(country, year, 'restore', userId);

            return await TaxRules.findByCountryYear(country, year);

        } catch (error) {
            logger.error('Failed to restore tax rules version:', error);
            throw error;
        }
    }

    // Bulk Operations

    async bulkImportTaxRules(rulesArray, source = 'bulk_import', userId = 'system') {
        try {
            const results = {
                success: [],
                errors: [],
                total: rulesArray.length
            };

            for (const rulesData of rulesArray) {
                try {
                    // Set source metadata
                    rulesData.metadata = {
                        ...rulesData.metadata,
                        source: source,
                        dataQuality: 'verified'
                    };

                    const taxRules = await this.createTaxRules(rulesData, userId);
                    results.success.push({
                        country: taxRules.country,
                        year: taxRules.year,
                        id: taxRules._id
                    });

                } catch (error) {
                    results.errors.push({
                        data: rulesData,
                        error: error.message
                    });
                }
            }

            logger.info('Bulk import completed', {
                total: results.total,
                success: results.success.length,
                errors: results.errors.length,
                source,
                userId
            });

            return results;

        } catch (error) {
            logger.error('Bulk import failed:', error);
            throw error;
        }
    }

    async bulkUpdateTaxRules(updates, userId = 'system') {
        try {
            const results = {
                success: [],
                errors: [],
                total: updates.length
            };

            for (const update of updates) {
                try {
                    const { country, year, data } = update;
                    const updatedRules = await this.updateTaxRules(country, year, data, userId);
                    results.success.push({
                        country: updatedRules.country,
                        year: updatedRules.year,
                        id: updatedRules._id
                    });

                } catch (error) {
                    results.errors.push({
                        update: update,
                        error: error.message
                    });
                }
            }

            logger.info('Bulk update completed', {
                total: results.total,
                success: results.success.length,
                errors: results.errors.length,
                userId
            });

            return results;

        } catch (error) {
            logger.error('Bulk update failed:', error);
            throw error;
        }
    }

    // Validation and Consistency Checks

    async validateTaxRules(country, year) {
        try {
            const taxRules = await TaxRules.findByCountryYear(country, year);
            if (!taxRules) {
                throw new Error(`Tax rules not found for ${country} ${year}`);
            }

            const validationResults = {
                isValid: true,
                errors: [],
                warnings: [],
                country: country,
                year: year
            };

            // Validate tax brackets
            if (taxRules.federal && taxRules.federal.taxBrackets) {
                for (const [filingStatus, brackets] of Object.entries(taxRules.federal.taxBrackets)) {
                    this.validateTaxBrackets(brackets, filingStatus, validationResults);
                }
            }

            // Validate deductions
            if (taxRules.federal && taxRules.federal.deductions) {
                this.validateDeductions(taxRules.federal.deductions, validationResults);
            }

            // Validate state/provincial rules
            if (taxRules.statesProvinces) {
                for (const state of taxRules.statesProvinces) {
                    this.validateStateRules(state, validationResults);
                }
            }

            // Validate consistency with country data
            await this.validateCountryConsistency(taxRules, validationResults);

            validationResults.isValid = validationResults.errors.length === 0;

            logger.taxRules.validation(country, year, validationResults.isValid, validationResults.errors);

            return validationResults;

        } catch (error) {
            logger.error('Failed to validate tax rules:', error);
            throw error;
        }
    }

    validateTaxBrackets(brackets, filingStatus, results) {
        if (!Array.isArray(brackets) || brackets.length === 0) {
            results.warnings.push(`No tax brackets defined for ${filingStatus}`);
            return;
        }

        for (let i = 0; i < brackets.length; i++) {
            const bracket = brackets[i];

            // Check rate is valid
            if (bracket.rate < 0 || bracket.rate > 1) {
                results.errors.push(`Invalid tax rate ${bracket.rate} in bracket ${i} for ${filingStatus}`);
            }

            // Check income thresholds
            if (bracket.minIncome < 0) {
                results.errors.push(`Negative minimum income in bracket ${i} for ${filingStatus}`);
            }

            if (bracket.maxIncome !== null && bracket.maxIncome <= bracket.minIncome) {
                results.errors.push(`Invalid income range in bracket ${i} for ${filingStatus}`);
            }

            // Check sequential order
            if (i > 0) {
                const prevBracket = brackets[i - 1];
                if (bracket.minIncome <= (prevBracket.maxIncome || 0)) {
                    results.errors.push(`Overlapping brackets at position ${i} for ${filingStatus}`);
                }
            }
        }
    }

    validateDeductions(deductions, results) {
        for (const deduction of deductions) {
            if (deduction.amount < 0) {
                results.errors.push(`Negative deduction amount for ${deduction.type}`);
            }

            if (!deduction.filingStatus) {
                results.errors.push(`Missing filing status for deduction ${deduction.type}`);
            }
        }
    }

    validateStateRules(state, results) {
        if (!state.code || state.code.length < 2) {
            results.errors.push(`Invalid state code: ${state.code}`);
        }

        if (!state.name) {
            results.errors.push(`Missing state name for code: ${state.code}`);
        }

        // Validate state tax brackets if income tax is enabled
        if (state.hasIncomeTax && state.taxBrackets) {
            for (const [filingStatus, brackets] of Object.entries(state.taxBrackets)) {
                this.validateTaxBrackets(brackets, `${state.code}-${filingStatus}`, results);
            }
        }
    }

    async validateCountryConsistency(taxRules, results) {
        try {
            const country = await Countries.findByCode(taxRules.country);
            if (!country) {
                results.errors.push(`Country ${taxRules.country} not found in countries database`);
                return;
            }

            // Check currency consistency
            if (taxRules.currency !== country.currency.code) {
                results.warnings.push(`Currency mismatch: rules use ${taxRules.currency}, country uses ${country.currency.code}`);
            }

            // Check tax year support
            if (!country.isTaxYearSupported(taxRules.year)) {
                results.warnings.push(`Tax year ${taxRules.year} is not marked as supported for ${taxRules.country}`);
            }

        } catch (error) {
            results.warnings.push(`Could not validate country consistency: ${error.message}`);
        }
    }

    // Query and Search Methods

    async searchTaxRules(filters = {}) {
        try {
            const query = { isActive: true };

            if (filters.country) {
                query.country = filters.country.toUpperCase();
            }

            if (filters.year) {
                query.year = filters.year;
            }

            if (filters.dataQuality) {
                query['metadata.dataQuality'] = filters.dataQuality;
            }

            if (filters.effectiveDate) {
                query.effectiveDate = { $lte: new Date(filters.effectiveDate) };
            }

            const sort = {};
            if (filters.sortBy) {
                sort[filters.sortBy] = filters.sortOrder === 'desc' ? -1 : 1;
            } else {
                sort.country = 1;
                sort.year = -1;
            }

            const limit = Math.min(filters.limit || 50, 100);
            const skip = (filters.page - 1) * limit || 0;

            const results = await TaxRules.find(query)
                .sort(sort)
                .limit(limit)
                .skip(skip);

            const total = await TaxRules.countDocuments(query);

            return {
                results,
                pagination: {
                    page: filters.page || 1,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };

        } catch (error) {
            logger.error('Failed to search tax rules:', error);
            throw error;
        }
    }

    async getAvailableCountries() {
        try {
            const cached = await redis.get('available_countries');
            if (cached) {
                return cached;
            }

            const countries = await TaxRules.distinct('country', { isActive: true });

            // Cache for 1 hour
            await redis.set('available_countries', countries, 3600);

            return countries;

        } catch (error) {
            logger.error('Failed to get available countries:', error);
            throw error;
        }
    }

    async getAvailableYears(country = null) {
        try {
            const cacheKey = `available_years_${country || 'all'}`;
            const cached = await redis.get(cacheKey);
            if (cached) {
                return cached;
            }

            const query = { isActive: true };
            if (country) {
                query.country = country.toUpperCase();
            }

            const years = await TaxRules.distinct('year', query);
            years.sort((a, b) => b - a); // Sort descending

            // Cache for 1 hour
            await redis.set(cacheKey, years, 3600);

            return years;

        } catch (error) {
            logger.error('Failed to get available years:', error);
            throw error;
        }
    }

    // Utility Methods

    incrementVersion(version) {
        const parts = version.split('.');
        const patch = parseInt(parts[2] || 0) + 1;
        return `${parts[0]}.${parts[1]}.${patch}`;
    }

    createValidationSchema() {
        return Joi.object({
            country: Joi.string().length(2).uppercase().required(),
            year: Joi.number().integer().min(2020).max(2030).required(),
            currency: Joi.string().length(3).uppercase().required(),
            version: Joi.string().default('1.0.0'),
            effectiveDate: Joi.date().required(),
            expirationDate: Joi.date().allow(null),
            federal: Joi.object().required(),
            statesProvinces: Joi.array().default([]),
            metadata: Joi.object().default({}),
            isActive: Joi.boolean().default(true)
        });
    }

    async healthCheck() {
        try {
            // Test database connection
            const testQuery = await TaxRules.findOne({ isActive: true });

            // Test cache connection
            const cacheHealthy = redis.isHealthy();

            return {
                status: 'healthy',
                database: 'connected',
                cache: cacheHealthy ? 'connected' : 'disconnected',
                testQuery: !!testQuery
            };

        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }
}

// Create singleton instance
const taxRulesService = new TaxRulesService();

module.exports = taxRulesService;