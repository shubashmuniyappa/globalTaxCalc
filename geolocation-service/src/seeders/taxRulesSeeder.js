const { TaxRules } = require('../models');
const logger = require('../config/logger');

class TaxRulesSeeder {
    constructor() {
        this.taxRules = [
            // US Federal Tax Rules 2024
            {
                country: 'US',
                year: 2024,
                version: '1.0.0',
                currency: 'USD',
                effectiveDate: new Date('2024-01-01'),
                metadata: {
                    dataQuality: 'official',
                    source: 'IRS Publication 15',
                    lastUpdated: new Date(),
                    verifiedBy: 'tax_expert',
                    notes: 'Official IRS tax brackets for 2024 tax year'
                },
                federal: {
                    taxBrackets: {
                        single: [
                            { min: 0, max: 11000, rate: 10.0 },
                            { min: 11000, max: 44725, rate: 12.0 },
                            { min: 44725, max: 95375, rate: 22.0 },
                            { min: 95375, max: 182050, rate: 24.0 },
                            { min: 182050, max: 231250, rate: 32.0 },
                            { min: 231250, max: 578125, rate: 35.0 },
                            { min: 578125, max: null, rate: 37.0 }
                        ],
                        marriedFilingJointly: [
                            { min: 0, max: 22000, rate: 10.0 },
                            { min: 22000, max: 89450, rate: 12.0 },
                            { min: 89450, max: 190750, rate: 22.0 },
                            { min: 190750, max: 364200, rate: 24.0 },
                            { min: 364200, max: 462500, rate: 32.0 },
                            { min: 462500, max: 693750, rate: 35.0 },
                            { min: 693750, max: null, rate: 37.0 }
                        ],
                        marriedFilingSeparately: [
                            { min: 0, max: 11000, rate: 10.0 },
                            { min: 11000, max: 44725, rate: 12.0 },
                            { min: 44725, max: 95375, rate: 22.0 },
                            { min: 95375, max: 182050, rate: 24.0 },
                            { min: 182050, max: 231250, rate: 32.0 },
                            { min: 231250, max: 346875, rate: 35.0 },
                            { min: 346875, max: null, rate: 37.0 }
                        ],
                        headOfHousehold: [
                            { min: 0, max: 15700, rate: 10.0 },
                            { min: 15700, max: 59850, rate: 12.0 },
                            { min: 59850, max: 95350, rate: 22.0 },
                            { min: 95350, max: 182050, rate: 24.0 },
                            { min: 182050, max: 231250, rate: 32.0 },
                            { min: 231250, max: 578100, rate: 35.0 },
                            { min: 578100, max: null, rate: 37.0 }
                        ]
                    },
                    deductions: [
                        {
                            name: 'Standard Deduction',
                            type: 'standard',
                            amounts: {
                                single: 14600,
                                marriedFilingJointly: 29200,
                                marriedFilingSeparately: 14600,
                                headOfHousehold: 21900
                            },
                            description: 'Standard deduction amount for 2024'
                        }
                    ],
                    credits: [
                        {
                            name: 'Child Tax Credit',
                            type: 'nonrefundable',
                            amount: 2000,
                            phaseOut: {
                                single: 200000,
                                marriedFilingJointly: 400000
                            },
                            description: 'Per qualifying child under 17'
                        },
                        {
                            name: 'Earned Income Tax Credit',
                            type: 'refundable',
                            amount: 7830, // maximum for 3+ children
                            incomeLimit: {
                                single: 56838,
                                marriedFilingJointly: 62838
                            },
                            description: 'Maximum EITC for 2024'
                        }
                    ],
                    socialInsurance: [
                        {
                            name: 'Social Security',
                            rate: 6.2,
                            cap: 160200,
                            type: 'payroll'
                        },
                        {
                            name: 'Medicare',
                            rate: 1.45,
                            cap: null,
                            type: 'payroll'
                        },
                        {
                            name: 'Additional Medicare Tax',
                            rate: 0.9,
                            threshold: {
                                single: 200000,
                                marriedFilingJointly: 250000,
                                marriedFilingSeparately: 125000
                            },
                            type: 'payroll'
                        }
                    ],
                    alternativeMinimumTax: {
                        enabled: true,
                        exemption: {
                            single: 85700,
                            marriedFilingJointly: 133300,
                            marriedFilingSeparately: 66650
                        },
                        rates: [
                            { min: 0, max: 220700, rate: 26.0 },
                            { min: 220700, max: null, rate: 28.0 }
                        ]
                    }
                }
            },
            // Canada Federal Tax Rules 2024
            {
                country: 'CA',
                year: 2024,
                version: '1.0.0',
                currency: 'CAD',
                effectiveDate: new Date('2024-01-01'),
                metadata: {
                    dataQuality: 'official',
                    source: 'Canada Revenue Agency',
                    lastUpdated: new Date(),
                    verifiedBy: 'tax_expert',
                    notes: 'Federal tax brackets for 2024 tax year'
                },
                federal: {
                    taxBrackets: {
                        all: [
                            { min: 0, max: 55867, rate: 15.0 },
                            { min: 55867, max: 111733, rate: 20.5 },
                            { min: 111733, max: 173205, rate: 26.0 },
                            { min: 173205, max: 246752, rate: 29.0 },
                            { min: 246752, max: null, rate: 33.0 }
                        ]
                    },
                    deductions: [
                        {
                            name: 'Basic Personal Amount',
                            type: 'standard',
                            amounts: {
                                all: 15705
                            },
                            description: 'Basic personal amount for 2024'
                        }
                    ],
                    credits: [
                        {
                            name: 'Canada Child Benefit',
                            type: 'refundable',
                            amount: 7787, // maximum annual per child under 6
                            phaseOut: {
                                familyIncome: 34863
                            },
                            description: 'Maximum CCB for children under 6'
                        },
                        {
                            name: 'GST/HST Credit',
                            type: 'refundable',
                            amount: 467, // maximum quarterly for single adult
                            incomeLimit: {
                                single: 43561,
                                marriedOrCommonLaw: 43561
                            },
                            description: 'Quarterly GST/HST credit'
                        }
                    ],
                    socialInsurance: [
                        {
                            name: 'Canada Pension Plan',
                            rate: 5.95,
                            cap: 68500,
                            type: 'payroll'
                        },
                        {
                            name: 'Employment Insurance',
                            rate: 2.7,
                            cap: 67300,
                            type: 'payroll'
                        }
                    ]
                }
            },
            // UK Tax Rules 2024-25
            {
                country: 'GB',
                year: 2024,
                version: '1.0.0',
                currency: 'GBP',
                effectiveDate: new Date('2024-04-06'),
                metadata: {
                    dataQuality: 'official',
                    source: 'HM Revenue and Customs',
                    lastUpdated: new Date(),
                    verifiedBy: 'tax_expert',
                    notes: 'UK tax rates for 2024-25 tax year'
                },
                federal: {
                    taxBrackets: {
                        all: [
                            { min: 0, max: 12570, rate: 0.0 }, // Personal allowance
                            { min: 12570, max: 50270, rate: 20.0 }, // Basic rate
                            { min: 50270, max: 125140, rate: 40.0 }, // Higher rate
                            { min: 125140, max: null, rate: 45.0 } // Additional rate
                        ]
                    },
                    deductions: [
                        {
                            name: 'Personal Allowance',
                            type: 'standard',
                            amounts: {
                                all: 12570
                            },
                            description: 'Tax-free personal allowance for 2024-25'
                        }
                    ],
                    credits: [
                        {
                            name: 'Child Benefit',
                            type: 'benefit',
                            amount: 1331.20, // annual for first child
                            phaseOut: {
                                individual: 50000
                            },
                            description: 'Annual child benefit for first child'
                        }
                    ],
                    socialInsurance: [
                        {
                            name: 'National Insurance',
                            rate: 10.0, // Class 1 employee rate (reduced from 12% in 2024)
                            cap: null,
                            threshold: 12570,
                            type: 'payroll'
                        }
                    ]
                }
            },
            // Australia Tax Rules 2024-25
            {
                country: 'AU',
                year: 2024,
                version: '1.0.0',
                currency: 'AUD',
                effectiveDate: new Date('2024-07-01'),
                metadata: {
                    dataQuality: 'official',
                    source: 'Australian Taxation Office',
                    lastUpdated: new Date(),
                    verifiedBy: 'tax_expert',
                    notes: 'Australian tax brackets for 2024-25 financial year'
                },
                federal: {
                    taxBrackets: {
                        all: [
                            { min: 0, max: 18200, rate: 0.0 },
                            { min: 18200, max: 45000, rate: 19.0 },
                            { min: 45000, max: 120000, rate: 32.5 },
                            { min: 120000, max: 180000, rate: 37.0 },
                            { min: 180000, max: null, rate: 45.0 }
                        ]
                    },
                    deductions: [
                        {
                            name: 'Tax-free Threshold',
                            type: 'standard',
                            amounts: {
                                all: 18200
                            },
                            description: 'Tax-free threshold for 2024-25'
                        }
                    ],
                    credits: [
                        {
                            name: 'Low Income Tax Offset',
                            type: 'nonrefundable',
                            amount: 700,
                            phaseOut: {
                                individual: 37500
                            },
                            description: 'Maximum LITO for 2024-25'
                        }
                    ],
                    socialInsurance: [
                        {
                            name: 'Medicare Levy',
                            rate: 2.0,
                            threshold: 29207,
                            type: 'levy'
                        },
                        {
                            name: 'Superannuation Guarantee',
                            rate: 11.5,
                            cap: null,
                            type: 'employer_contribution'
                        }
                    ]
                }
            }
        ];
    }

    async seed() {
        try {
            logger.info('Starting tax rules seeding...');

            // Clear existing data
            await TaxRules.deleteMany({});
            logger.info('Cleared existing tax rules data');

            // Insert new data
            const insertedRules = await TaxRules.insertMany(this.taxRules);
            logger.info(`Seeded ${insertedRules.length} tax rule sets`);

            // Log summary by country and year
            const byCountryYear = insertedRules.reduce((acc, rule) => {
                const key = `${rule.country}-${rule.year}`;
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {});

            Object.entries(byCountryYear).forEach(([countryYear, count]) => {
                logger.info(`${countryYear}: ${count} tax rule set(s)`);
            });

            return insertedRules;

        } catch (error) {
            logger.error('Failed to seed tax rules:', error);
            throw error;
        }
    }

    async addTaxRules(taxRulesData) {
        try {
            const taxRules = new TaxRules(taxRulesData);
            await taxRules.save();
            logger.info(`Added tax rules: ${taxRulesData.country} ${taxRulesData.year} v${taxRulesData.version}`);
            return taxRules;
        } catch (error) {
            logger.error(`Failed to add tax rules for ${taxRulesData.country} ${taxRulesData.year}:`, error);
            throw error;
        }
    }

    async updateTaxRules(country, year, updateData) {
        try {
            const taxRules = await TaxRules.findOneAndUpdate(
                { country: country.toUpperCase(), year: parseInt(year) },
                updateData,
                { new: true }
            );

            if (taxRules) {
                logger.info(`Updated tax rules: ${taxRules.country} ${taxRules.year} v${taxRules.version}`);
                return taxRules;
            } else {
                throw new Error(`Tax rules for ${country} ${year} not found`);
            }
        } catch (error) {
            logger.error(`Failed to update tax rules for ${country} ${year}:`, error);
            throw error;
        }
    }

    async seedByCountry(countryCode) {
        try {
            const countryRules = this.taxRules.filter(r => r.country === countryCode.toUpperCase());

            if (countryRules.length === 0) {
                logger.warn(`No tax rules data available for country: ${countryCode}`);
                return [];
            }

            // Clear existing data for this country
            await TaxRules.deleteMany({ country: countryCode.toUpperCase() });

            // Insert new data
            const insertedRules = await TaxRules.insertMany(countryRules);
            logger.info(`Seeded ${insertedRules.length} tax rule sets for ${countryCode}`);

            return insertedRules;

        } catch (error) {
            logger.error(`Failed to seed tax rules for country ${countryCode}:`, error);
            throw error;
        }
    }

    async seedByYear(year) {
        try {
            const yearRules = this.taxRules.filter(r => r.year === parseInt(year));

            if (yearRules.length === 0) {
                logger.warn(`No tax rules data available for year: ${year}`);
                return [];
            }

            // Clear existing data for this year
            await TaxRules.deleteMany({ year: parseInt(year) });

            // Insert new data
            const insertedRules = await TaxRules.insertMany(yearRules);
            logger.info(`Seeded ${insertedRules.length} tax rule sets for ${year}`);

            return insertedRules;

        } catch (error) {
            logger.error(`Failed to seed tax rules for year ${year}:`, error);
            throw error;
        }
    }
}

module.exports = new TaxRulesSeeder();