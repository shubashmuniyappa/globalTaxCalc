const { Countries } = require('../models');
const logger = require('../config/logger');

class CountriesSeeder {
    constructor() {
        this.countries = [
            {
                code: 'US',
                name: 'United States',
                officialName: 'United States of America',
                alpha2Code: 'US',
                alpha3Code: 'USA',
                currency: {
                    code: 'USD',
                    name: 'US Dollar',
                    symbol: '$',
                    decimals: 2
                },
                taxSystem: {
                    type: 'progressive',
                    federalSystem: true,
                    hasStateTax: true,
                    hasLocalTax: true,
                    taxResidencyRules: 'citizenship_based'
                },
                geographic: {
                    continent: 'North America',
                    region: 'Northern America',
                    subregion: 'Northern America',
                    timeZones: ['UTC-12:00', 'UTC-11:00', 'UTC-10:00', 'UTC-09:00', 'UTC-08:00', 'UTC-07:00', 'UTC-06:00', 'UTC-05:00', 'UTC-04:00']
                },
                economic: {
                    gdpPerCapita: 65279.5,
                    developmentLevel: 'developed',
                    economicComplexity: 'high'
                },
                government: {
                    taxAuthority: 'Internal Revenue Service (IRS)',
                    fiscalYear: { start: '10-01', end: '09-30' },
                    filingDeadline: '04-15'
                },
                isSupported: true,
                supportLevel: 'full',
                supportedTaxYears: [2020, 2021, 2022, 2023, 2024],
                flags: {
                    svg: 'https://flagcdn.com/us.svg',
                    png: 'https://flagcdn.com/w320/us.png'
                }
            },
            {
                code: 'CA',
                name: 'Canada',
                officialName: 'Canada',
                alpha2Code: 'CA',
                alpha3Code: 'CAN',
                currency: {
                    code: 'CAD',
                    name: 'Canadian Dollar',
                    symbol: '$',
                    decimals: 2
                },
                taxSystem: {
                    type: 'progressive',
                    federalSystem: true,
                    hasStateTax: true,
                    hasLocalTax: false,
                    taxResidencyRules: 'residence_based'
                },
                geographic: {
                    continent: 'North America',
                    region: 'Northern America',
                    subregion: 'Northern America',
                    timeZones: ['UTC-08:00', 'UTC-07:00', 'UTC-06:00', 'UTC-05:00', 'UTC-04:00', 'UTC-03:30']
                },
                economic: {
                    gdpPerCapita: 46232.99,
                    developmentLevel: 'developed',
                    economicComplexity: 'high'
                },
                government: {
                    taxAuthority: 'Canada Revenue Agency (CRA)',
                    fiscalYear: { start: '01-01', end: '12-31' },
                    filingDeadline: '04-30'
                },
                isSupported: true,
                supportLevel: 'full',
                supportedTaxYears: [2020, 2021, 2022, 2023, 2024],
                flags: {
                    svg: 'https://flagcdn.com/ca.svg',
                    png: 'https://flagcdn.com/w320/ca.png'
                }
            },
            {
                code: 'GB',
                name: 'United Kingdom',
                officialName: 'United Kingdom of Great Britain and Northern Ireland',
                alpha2Code: 'GB',
                alpha3Code: 'GBR',
                currency: {
                    code: 'GBP',
                    name: 'British Pound Sterling',
                    symbol: '£',
                    decimals: 2
                },
                taxSystem: {
                    type: 'progressive',
                    federalSystem: false,
                    hasStateTax: false,
                    hasLocalTax: true,
                    taxResidencyRules: 'residence_based'
                },
                geographic: {
                    continent: 'Europe',
                    region: 'Northern Europe',
                    subregion: 'Northern Europe',
                    timeZones: ['UTC+00:00']
                },
                economic: {
                    gdpPerCapita: 41059.8,
                    developmentLevel: 'developed',
                    economicComplexity: 'high'
                },
                government: {
                    taxAuthority: 'HM Revenue and Customs (HMRC)',
                    fiscalYear: { start: '04-06', end: '04-05' },
                    filingDeadline: '01-31'
                },
                isSupported: true,
                supportLevel: 'full',
                supportedTaxYears: [2020, 2021, 2022, 2023, 2024],
                flags: {
                    svg: 'https://flagcdn.com/gb.svg',
                    png: 'https://flagcdn.com/w320/gb.png'
                }
            },
            {
                code: 'AU',
                name: 'Australia',
                officialName: 'Commonwealth of Australia',
                alpha2Code: 'AU',
                alpha3Code: 'AUS',
                currency: {
                    code: 'AUD',
                    name: 'Australian Dollar',
                    symbol: '$',
                    decimals: 2
                },
                taxSystem: {
                    type: 'progressive',
                    federalSystem: true,
                    hasStateTax: false,
                    hasLocalTax: true,
                    taxResidencyRules: 'residence_based'
                },
                geographic: {
                    continent: 'Oceania',
                    region: 'Australia and New Zealand',
                    subregion: 'Australia and New Zealand',
                    timeZones: ['UTC+08:00', 'UTC+09:30', 'UTC+10:00', 'UTC+10:30', 'UTC+11:00']
                },
                economic: {
                    gdpPerCapita: 51885.47,
                    developmentLevel: 'developed',
                    economicComplexity: 'high'
                },
                government: {
                    taxAuthority: 'Australian Taxation Office (ATO)',
                    fiscalYear: { start: '07-01', end: '06-30' },
                    filingDeadline: '10-31'
                },
                isSupported: true,
                supportLevel: 'full',
                supportedTaxYears: [2020, 2021, 2022, 2023, 2024],
                flags: {
                    svg: 'https://flagcdn.com/au.svg',
                    png: 'https://flagcdn.com/w320/au.png'
                }
            },
            {
                code: 'DE',
                name: 'Germany',
                officialName: 'Federal Republic of Germany',
                alpha2Code: 'DE',
                alpha3Code: 'DEU',
                currency: {
                    code: 'EUR',
                    name: 'Euro',
                    symbol: '€',
                    decimals: 2
                },
                taxSystem: {
                    type: 'progressive',
                    federalSystem: true,
                    hasStateTax: true,
                    hasLocalTax: true,
                    taxResidencyRules: 'residence_based'
                },
                geographic: {
                    continent: 'Europe',
                    region: 'Western Europe',
                    subregion: 'Western Europe',
                    timeZones: ['UTC+01:00']
                },
                economic: {
                    gdpPerCapita: 45723.64,
                    developmentLevel: 'developed',
                    economicComplexity: 'high'
                },
                government: {
                    taxAuthority: 'Federal Central Tax Office',
                    fiscalYear: { start: '01-01', end: '12-31' },
                    filingDeadline: '07-31'
                },
                isSupported: true,
                supportLevel: 'partial',
                supportedTaxYears: [2021, 2022, 2023, 2024],
                flags: {
                    svg: 'https://flagcdn.com/de.svg',
                    png: 'https://flagcdn.com/w320/de.png'
                }
            },
            {
                code: 'FR',
                name: 'France',
                officialName: 'French Republic',
                alpha2Code: 'FR',
                alpha3Code: 'FRA',
                currency: {
                    code: 'EUR',
                    name: 'Euro',
                    symbol: '€',
                    decimals: 2
                },
                taxSystem: {
                    type: 'progressive',
                    federalSystem: false,
                    hasStateTax: false,
                    hasLocalTax: true,
                    taxResidencyRules: 'residence_based'
                },
                geographic: {
                    continent: 'Europe',
                    region: 'Western Europe',
                    subregion: 'Western Europe',
                    timeZones: ['UTC+01:00']
                },
                economic: {
                    gdpPerCapita: 38625.07,
                    developmentLevel: 'developed',
                    economicComplexity: 'high'
                },
                government: {
                    taxAuthority: 'Direction générale des Finances publiques',
                    fiscalYear: { start: '01-01', end: '12-31' },
                    filingDeadline: '05-31'
                },
                isSupported: true,
                supportLevel: 'partial',
                supportedTaxYears: [2021, 2022, 2023, 2024],
                flags: {
                    svg: 'https://flagcdn.com/fr.svg',
                    png: 'https://flagcdn.com/w320/fr.png'
                }
            }
        ];
    }

    async seed() {
        try {
            logger.info('Starting countries seeding...');

            // Clear existing data
            await Countries.deleteMany({});
            logger.info('Cleared existing countries data');

            // Insert new data
            const insertedCountries = await Countries.insertMany(this.countries);
            logger.info(`Seeded ${insertedCountries.length} countries`);

            // Log summary
            const supportedCount = insertedCountries.filter(c => c.isSupported).length;
            logger.info(`Countries seeded: ${insertedCountries.length} total, ${supportedCount} supported`);

            return insertedCountries;

        } catch (error) {
            logger.error('Failed to seed countries:', error);
            throw error;
        }
    }

    async addCountry(countryData) {
        try {
            const country = new Countries(countryData);
            await country.save();
            logger.info(`Added country: ${countryData.name} (${countryData.code})`);
            return country;
        } catch (error) {
            logger.error(`Failed to add country ${countryData.code}:`, error);
            throw error;
        }
    }

    async updateCountry(code, updateData) {
        try {
            const country = await Countries.findOneAndUpdate(
                { code: code.toUpperCase() },
                updateData,
                { new: true }
            );

            if (country) {
                logger.info(`Updated country: ${country.name} (${country.code})`);
                return country;
            } else {
                throw new Error(`Country with code ${code} not found`);
            }
        } catch (error) {
            logger.error(`Failed to update country ${code}:`, error);
            throw error;
        }
    }
}

module.exports = new CountriesSeeder();