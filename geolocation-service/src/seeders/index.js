const database = require('../config/database');
const logger = require('../config/logger');

// Import seeders
const countriesSeeder = require('./countriesSeeder');
const statesSeeder = require('./statesSeeder');
const taxRulesSeeder = require('./taxRulesSeeder');

class MasterSeeder {
    constructor() {
        this.seeders = [
            { name: 'countries', seeder: countriesSeeder, required: true },
            { name: 'states', seeder: statesSeeder, required: true },
            { name: 'taxRules', seeder: taxRulesSeeder, required: true }
        ];
    }

    async seedAll(options = {}) {
        const { force = false, only = null } = options;

        try {
            logger.info('🌱 Starting master seeding process...');

            // Connect to database if not already connected
            if (!database.isConnected()) {
                await database.connect();
            }

            const results = {};
            const seedersToRun = only ?
                this.seeders.filter(s => only.includes(s.name)) :
                this.seeders;

            for (const { name, seeder, required } of seedersToRun) {
                try {
                    logger.info(`📊 Seeding ${name}...`);
                    const startTime = Date.now();

                    const result = await seeder.seed();
                    const duration = Date.now() - startTime;

                    results[name] = {
                        success: true,
                        count: Array.isArray(result) ? result.length : 1,
                        duration: `${duration}ms`
                    };

                    logger.info(`✅ ${name} seeded successfully in ${duration}ms`);

                } catch (error) {
                    logger.error(`❌ Failed to seed ${name}:`, error);

                    results[name] = {
                        success: false,
                        error: error.message
                    };

                    if (required && !force) {
                        throw new Error(`Required seeder '${name}' failed: ${error.message}`);
                    }
                }
            }

            // Summary
            const successful = Object.values(results).filter(r => r.success).length;
            const total = Object.keys(results).length;

            logger.info(`🎉 Seeding completed: ${successful}/${total} successful`);

            // Log detailed results
            Object.entries(results).forEach(([name, result]) => {
                if (result.success) {
                    logger.info(`  ✅ ${name}: ${result.count} records (${result.duration})`);
                } else {
                    logger.error(`  ❌ ${name}: ${result.error}`);
                }
            });

            return results;

        } catch (error) {
            logger.error('💥 Master seeding failed:', error);
            throw error;
        }
    }

    async seedCountries(options = {}) {
        try {
            await this.ensureConnection();
            return await countriesSeeder.seed();
        } catch (error) {
            logger.error('Failed to seed countries:', error);
            throw error;
        }
    }

    async seedStates(options = {}) {
        const { country = null } = options;

        try {
            await this.ensureConnection();

            if (country) {
                return await statesSeeder.seedByCountry(country);
            } else {
                return await statesSeeder.seed();
            }
        } catch (error) {
            logger.error('Failed to seed states:', error);
            throw error;
        }
    }

    async seedTaxRules(options = {}) {
        const { country = null, year = null } = options;

        try {
            await this.ensureConnection();

            if (country) {
                return await taxRulesSeeder.seedByCountry(country);
            } else if (year) {
                return await taxRulesSeeder.seedByYear(year);
            } else {
                return await taxRulesSeeder.seed();
            }
        } catch (error) {
            logger.error('Failed to seed tax rules:', error);
            throw error;
        }
    }

    async clearAll() {
        try {
            logger.info('🗑️  Clearing all seeded data...');

            await this.ensureConnection();

            const { Countries, States, TaxRules } = require('../models');

            await Promise.all([
                Countries.deleteMany({}),
                States.deleteMany({}),
                TaxRules.deleteMany({})
            ]);

            logger.info('✅ All seeded data cleared');

        } catch (error) {
            logger.error('Failed to clear data:', error);
            throw error;
        }
    }

    async ensureConnection() {
        if (!database.isConnected()) {
            await database.connect();
        }
    }

    async getStatus() {
        try {
            await this.ensureConnection();

            const { Countries, States, TaxRules } = require('../models');

            const status = {
                countries: await Countries.countDocuments(),
                states: await States.countDocuments(),
                taxRules: await TaxRules.countDocuments(),
                lastUpdated: new Date().toISOString()
            };

            return status;

        } catch (error) {
            logger.error('Failed to get seeding status:', error);
            throw error;
        }
    }
}

// CLI interface
async function runFromCLI() {
    const args = process.argv.slice(2);
    const masterSeeder = new MasterSeeder();

    try {
        switch (args[0]) {
            case 'all':
                await masterSeeder.seedAll({ force: args.includes('--force') });
                break;

            case 'countries':
                await masterSeeder.seedCountries();
                break;

            case 'states':
                const country = args.find(arg => arg.startsWith('--country='))?.split('=')[1];
                await masterSeeder.seedStates({ country });
                break;

            case 'tax-rules':
                const countryArg = args.find(arg => arg.startsWith('--country='))?.split('=')[1];
                const yearArg = args.find(arg => arg.startsWith('--year='))?.split('=')[1];
                await masterSeeder.seedTaxRules({ country: countryArg, year: yearArg });
                break;

            case 'clear':
                await masterSeeder.clearAll();
                break;

            case 'status':
                const status = await masterSeeder.getStatus();
                console.log('📊 Seeding Status:');
                console.log(`  Countries: ${status.countries}`);
                console.log(`  States: ${status.states}`);
                console.log(`  Tax Rules: ${status.taxRules}`);
                console.log(`  Last Updated: ${status.lastUpdated}`);
                break;

            default:
                console.log('Usage:');
                console.log('  npm run seed all [--force]');
                console.log('  npm run seed countries');
                console.log('  npm run seed states [--country=US]');
                console.log('  npm run seed tax-rules [--country=US] [--year=2024]');
                console.log('  npm run seed clear');
                console.log('  npm run seed status');
                process.exit(1);
        }

        process.exit(0);

    } catch (error) {
        logger.error('CLI seeding failed:', error);
        process.exit(1);
    }
}

// Run from CLI if this file is executed directly
if (require.main === module) {
    runFromCLI();
}

module.exports = new MasterSeeder();