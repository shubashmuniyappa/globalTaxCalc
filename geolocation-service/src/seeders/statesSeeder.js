const { States } = require('../models');
const logger = require('../config/logger');

class StatesSeeder {
    constructor() {
        this.states = [
            // US States (sample)
            {
                code: 'CA',
                name: 'California',
                officialName: 'State of California',
                country: 'US',
                type: 'state',
                abbreviation: 'CA',
                geographic: {
                    capital: 'Sacramento',
                    region: 'Pacific',
                    coordinates: { latitude: 36.7783, longitude: -119.4179 },
                    area: 423967,
                    timeZone: 'America/Los_Angeles'
                },
                economic: {
                    gdp: 3.6,
                    population: 39538223,
                    majorIndustries: ['technology', 'entertainment', 'agriculture', 'aerospace']
                },
                government: {
                    governor: 'Gavin Newsom',
                    legislature: 'bicameral',
                    taxDepartment: 'California Franchise Tax Board'
                },
                isSupported: true,
                supportLevel: 'full',
                supportedTaxYears: [2020, 2021, 2022, 2023, 2024],
                taxRules: [
                    {
                        year: 2024,
                        hasIncomeTax: true,
                        hasSalesTax: true,
                        hasPropertyTax: true,
                        incomeTaxRate: { min: 1.0, max: 13.3 },
                        salesTaxRate: 7.25,
                        propertyTaxRate: 0.75,
                        effectiveDate: new Date('2024-01-01'),
                        notes: 'Progressive income tax with additional 1% mental health tax on income over $1M'
                    }
                ],
                localTaxRates: [
                    {
                        jurisdiction: 'Los Angeles County',
                        taxType: 'sales',
                        rate: 2.25,
                        description: 'County sales tax'
                    },
                    {
                        jurisdiction: 'San Francisco',
                        taxType: 'payroll',
                        rate: 0.38,
                        description: 'Payroll expense tax'
                    }
                ]
            },
            {
                code: 'NY',
                name: 'New York',
                officialName: 'State of New York',
                country: 'US',
                type: 'state',
                abbreviation: 'NY',
                geographic: {
                    capital: 'Albany',
                    region: 'Northeast',
                    coordinates: { latitude: 40.7589, longitude: -73.9851 },
                    area: 141297,
                    timeZone: 'America/New_York'
                },
                economic: {
                    gdp: 2.0,
                    population: 20201249,
                    majorIndustries: ['finance', 'real estate', 'technology', 'media']
                },
                government: {
                    governor: 'Kathy Hochul',
                    legislature: 'bicameral',
                    taxDepartment: 'New York State Department of Taxation and Finance'
                },
                isSupported: true,
                supportLevel: 'full',
                supportedTaxYears: [2020, 2021, 2022, 2023, 2024],
                taxRules: [
                    {
                        year: 2024,
                        hasIncomeTax: true,
                        hasSalesTax: true,
                        hasPropertyTax: true,
                        incomeTaxRate: { min: 4.0, max: 10.9 },
                        salesTaxRate: 4.0,
                        propertyTaxRate: 1.69,
                        effectiveDate: new Date('2024-01-01'),
                        notes: 'Additional NYC tax for residents'
                    }
                ],
                localTaxRates: [
                    {
                        jurisdiction: 'New York City',
                        taxType: 'income',
                        rate: 3.88,
                        description: 'NYC resident income tax'
                    },
                    {
                        jurisdiction: 'New York City',
                        taxType: 'sales',
                        rate: 4.5,
                        description: 'NYC sales tax'
                    }
                ]
            },
            {
                code: 'TX',
                name: 'Texas',
                officialName: 'State of Texas',
                country: 'US',
                type: 'state',
                abbreviation: 'TX',
                geographic: {
                    capital: 'Austin',
                    region: 'South',
                    coordinates: { latitude: 31.9686, longitude: -99.9018 },
                    area: 695662,
                    timeZone: 'America/Chicago'
                },
                economic: {
                    gdp: 2.4,
                    population: 30029572,
                    majorIndustries: ['energy', 'technology', 'aerospace', 'agriculture']
                },
                government: {
                    governor: 'Greg Abbott',
                    legislature: 'bicameral',
                    taxDepartment: 'Texas Comptroller of Public Accounts'
                },
                isSupported: true,
                supportLevel: 'full',
                supportedTaxYears: [2020, 2021, 2022, 2023, 2024],
                taxRules: [
                    {
                        year: 2024,
                        hasIncomeTax: false,
                        hasSalesTax: true,
                        hasPropertyTax: true,
                        incomeTaxRate: null,
                        salesTaxRate: 6.25,
                        propertyTaxRate: 1.80,
                        effectiveDate: new Date('2024-01-01'),
                        notes: 'No state income tax'
                    }
                ],
                localTaxRates: [
                    {
                        jurisdiction: 'Harris County',
                        taxType: 'sales',
                        rate: 2.0,
                        description: 'County and local sales tax'
                    }
                ]
            },
            // Canadian Provinces (sample)
            {
                code: 'ON',
                name: 'Ontario',
                officialName: 'Province of Ontario',
                country: 'CA',
                type: 'province',
                abbreviation: 'ON',
                geographic: {
                    capital: 'Toronto',
                    region: 'Central Canada',
                    coordinates: { latitude: 51.2538, longitude: -85.3232 },
                    area: 1076395,
                    timeZone: 'America/Toronto'
                },
                economic: {
                    gdp: 857.0,
                    population: 15007816,
                    majorIndustries: ['manufacturing', 'finance', 'technology', 'mining']
                },
                government: {
                    premier: 'Doug Ford',
                    legislature: 'unicameral',
                    taxDepartment: 'Ontario Ministry of Finance'
                },
                isSupported: true,
                supportLevel: 'full',
                supportedTaxYears: [2020, 2021, 2022, 2023, 2024],
                taxRules: [
                    {
                        year: 2024,
                        hasIncomeTax: true,
                        hasSalesTax: true,
                        hasPropertyTax: true,
                        incomeTaxRate: { min: 5.05, max: 13.16 },
                        salesTaxRate: 13.0, // HST
                        propertyTaxRate: 1.26,
                        effectiveDate: new Date('2024-01-01'),
                        notes: 'HST (Harmonized Sales Tax) combines federal GST and provincial PST'
                    }
                ],
                localTaxRates: [
                    {
                        jurisdiction: 'Toronto',
                        taxType: 'property',
                        rate: 0.67,
                        description: 'City of Toronto property tax'
                    }
                ]
            },
            {
                code: 'BC',
                name: 'British Columbia',
                officialName: 'Province of British Columbia',
                country: 'CA',
                type: 'province',
                abbreviation: 'BC',
                geographic: {
                    capital: 'Victoria',
                    region: 'Western Canada',
                    coordinates: { latitude: 53.7267, longitude: -127.6476 },
                    area: 944735,
                    timeZone: 'America/Vancouver'
                },
                economic: {
                    gdp: 295.0,
                    population: 5249635,
                    majorIndustries: ['forestry', 'mining', 'technology', 'tourism']
                },
                government: {
                    premier: 'David Eby',
                    legislature: 'unicameral',
                    taxDepartment: 'BC Ministry of Finance'
                },
                isSupported: true,
                supportLevel: 'full',
                supportedTaxYears: [2020, 2021, 2022, 2023, 2024],
                taxRules: [
                    {
                        year: 2024,
                        hasIncomeTax: true,
                        hasSalesTax: true,
                        hasPropertyTax: true,
                        incomeTaxRate: { min: 5.06, max: 20.5 },
                        salesTaxRate: 12.0, // GST + PST
                        propertyTaxRate: 0.59,
                        effectiveDate: new Date('2024-01-01'),
                        notes: 'Separate GST (5%) and PST (7%)'
                    }
                ],
                localTaxRates: [
                    {
                        jurisdiction: 'Vancouver',
                        taxType: 'property',
                        rate: 0.73,
                        description: 'City of Vancouver property tax'
                    },
                    {
                        jurisdiction: 'Metro Vancouver',
                        taxType: 'transit',
                        rate: 0.5,
                        description: 'TransLink property tax'
                    }
                ]
            }
        ];
    }

    async seed() {
        try {
            logger.info('Starting states/provinces seeding...');

            // Clear existing data
            await States.deleteMany({});
            logger.info('Cleared existing states/provinces data');

            // Insert new data
            const insertedStates = await States.insertMany(this.states);
            logger.info(`Seeded ${insertedStates.length} states/provinces`);

            // Log summary by country
            const byCountry = insertedStates.reduce((acc, state) => {
                acc[state.country] = (acc[state.country] || 0) + 1;
                return acc;
            }, {});

            Object.entries(byCountry).forEach(([country, count]) => {
                logger.info(`${country}: ${count} states/provinces`);
            });

            return insertedStates;

        } catch (error) {
            logger.error('Failed to seed states/provinces:', error);
            throw error;
        }
    }

    async addState(stateData) {
        try {
            const state = new States(stateData);
            await state.save();
            logger.info(`Added state/province: ${stateData.name} (${stateData.code}) in ${stateData.country}`);
            return state;
        } catch (error) {
            logger.error(`Failed to add state ${stateData.code}:`, error);
            throw error;
        }
    }

    async updateState(country, code, updateData) {
        try {
            const state = await States.findOneAndUpdate(
                { country: country.toUpperCase(), code: code.toUpperCase() },
                updateData,
                { new: true }
            );

            if (state) {
                logger.info(`Updated state/province: ${state.name} (${state.code}) in ${state.country}`);
                return state;
            } else {
                throw new Error(`State with code ${code} in ${country} not found`);
            }
        } catch (error) {
            logger.error(`Failed to update state ${code} in ${country}:`, error);
            throw error;
        }
    }

    async seedByCountry(countryCode) {
        try {
            const countryStates = this.states.filter(s => s.country === countryCode.toUpperCase());

            if (countryStates.length === 0) {
                logger.warn(`No states/provinces data available for country: ${countryCode}`);
                return [];
            }

            // Clear existing data for this country
            await States.deleteMany({ country: countryCode.toUpperCase() });

            // Insert new data
            const insertedStates = await States.insertMany(countryStates);
            logger.info(`Seeded ${insertedStates.length} states/provinces for ${countryCode}`);

            return insertedStates;

        } catch (error) {
            logger.error(`Failed to seed states for country ${countryCode}:`, error);
            throw error;
        }
    }
}

module.exports = new StatesSeeder();