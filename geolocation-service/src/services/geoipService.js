const maxmind = require('maxmind');
const geoip = require('geoip-lite');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { promisify } = require('util');
const logger = require('../config/logger');
const redis = require('../config/redis');

class GeoIPService {
    constructor() {
        this.cityReader = null;
        this.countryReader = null;
        this.asnReader = null;
        this.databasePath = process.env.GEOIP_DATABASE_PATH || './data/geoip';
        this.isInitialized = false;
        this.fallbackEnabled = true;
    }

    async initialize() {
        try {
            logger.info('Initializing GeoIP service...');

            // Ensure database directory exists
            if (!fs.existsSync(this.databasePath)) {
                fs.mkdirSync(this.databasePath, { recursive: true });
            }

            // Initialize MaxMind databases
            await this.initializeMaxMindDatabases();

            // Verify fallback geoip-lite is ready
            this.initializeFallback();

            this.isInitialized = true;
            logger.info('GeoIP service initialized successfully');

            // Schedule database updates if enabled
            if (process.env.UPDATE_GEOIP_DATABASE === 'true') {
                this.scheduleUpdates();
            }

        } catch (error) {
            logger.error('Failed to initialize GeoIP service:', error);
            throw error;
        }
    }

    async initializeMaxMindDatabases() {
        const databases = [
            { name: 'city', filename: 'GeoLite2-City.mmdb' },
            { name: 'country', filename: 'GeoLite2-Country.mmdb' },
            { name: 'asn', filename: 'GeoLite2-ASN.mmdb' }
        ];

        for (const db of databases) {
            const dbPath = path.join(this.databasePath, db.filename);

            try {
                if (fs.existsSync(dbPath)) {
                    const reader = await maxmind.open(dbPath);
                    this[`${db.name}Reader`] = reader;
                    logger.info(`Loaded MaxMind ${db.name} database`);
                } else {
                    logger.warn(`MaxMind ${db.name} database not found at ${dbPath}`);
                    if (process.env.MAXMIND_LICENSE_KEY) {
                        await this.downloadDatabase(db.name, db.filename);
                        const reader = await maxmind.open(dbPath);
                        this[`${db.name}Reader`] = reader;
                    }
                }
            } catch (error) {
                logger.error(`Failed to load MaxMind ${db.name} database:`, error);
            }
        }
    }

    initializeFallback() {
        try {
            // Test geoip-lite
            const testLookup = geoip.lookup('8.8.8.8');
            if (testLookup) {
                logger.info('Fallback geoip-lite service ready');
            } else {
                logger.warn('Fallback geoip-lite service may not be working properly');
            }
        } catch (error) {
            logger.error('Failed to initialize fallback geoip service:', error);
            this.fallbackEnabled = false;
        }
    }

    async downloadDatabase(type, filename) {
        if (!process.env.MAXMIND_LICENSE_KEY) {
            throw new Error('MaxMind license key not provided');
        }

        const url = `https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-${type.charAt(0).toUpperCase() + type.slice(1)}&license_key=${process.env.MAXMIND_LICENSE_KEY}&suffix=tar.gz`;
        const dbPath = path.join(this.databasePath, filename);

        logger.info(`Downloading MaxMind ${type} database...`);

        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(dbPath);
            https.get(url, (response) => {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    logger.info(`Downloaded MaxMind ${type} database`);
                    resolve();
                });
            }).on('error', (error) => {
                fs.unlink(dbPath, () => {}); // Delete partial file
                reject(error);
            });
        });
    }

    async lookupLocation(ip) {
        try {
            // Input validation
            if (!ip || !this.isValidIP(ip)) {
                throw new Error('Invalid IP address');
            }

            // Check cache first
            const cached = await redis.getLocationCache(ip);
            if (cached) {
                logger.geoip.cache('GET', ip, true);
                return cached;
            }

            logger.geoip.cache('GET', ip, false);

            // Detect if IP is from VPN/proxy
            const vpnDetection = await this.detectVPNProxy(ip);

            // Try MaxMind first (most accurate)
            let location = await this.lookupMaxMind(ip);

            // Fallback to geoip-lite if MaxMind fails
            if (!location && this.fallbackEnabled) {
                location = this.lookupFallback(ip);
            }

            if (!location) {
                throw new Error('Location not found for IP');
            }

            // Enhance location data
            const enhancedLocation = await this.enhanceLocationData(location, ip, vpnDetection);

            // Cache the result
            await redis.cacheLocation(ip, enhancedLocation);

            logger.geoip.detection(ip, enhancedLocation, 'maxmind');
            return enhancedLocation;

        } catch (error) {
            logger.geoip.error(ip, error, 'lookup');
            throw error;
        }
    }

    async lookupMaxMind(ip) {
        try {
            let cityData = null;
            let countryData = null;
            let asnData = null;

            // Get city data (includes country)
            if (this.cityReader) {
                cityData = this.cityReader.get(ip);
            }

            // Get country data if city lookup failed
            if (!cityData && this.countryReader) {
                countryData = this.countryReader.get(ip);
            }

            // Get ASN data
            if (this.asnReader) {
                asnData = this.asnReader.get(ip);
            }

            // Use city data if available, otherwise country data
            const geoData = cityData || countryData;

            if (!geoData) {
                return null;
            }

            return {
                ip,
                country: {
                    code: geoData.country?.iso_code || null,
                    name: geoData.country?.names?.en || null,
                    confidence: geoData.country?.confidence || null
                },
                region: {
                    code: geoData.subdivisions?.[0]?.iso_code || null,
                    name: geoData.subdivisions?.[0]?.names?.en || null,
                    confidence: geoData.subdivisions?.[0]?.confidence || null
                },
                city: {
                    name: geoData.city?.names?.en || null,
                    confidence: geoData.city?.confidence || null
                },
                location: {
                    latitude: geoData.location?.latitude || null,
                    longitude: geoData.location?.longitude || null,
                    accuracyRadius: geoData.location?.accuracy_radius || null,
                    timeZone: geoData.location?.time_zone || null
                },
                postal: {
                    code: geoData.postal?.code || null,
                    confidence: geoData.postal?.confidence || null
                },
                asn: asnData ? {
                    number: asnData.autonomous_system_number,
                    organization: asnData.autonomous_system_organization
                } : null,
                source: 'maxmind',
                accuracy: this.calculateAccuracy(geoData),
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            logger.error('MaxMind lookup failed:', error);
            return null;
        }
    }

    lookupFallback(ip) {
        try {
            const geo = geoip.lookup(ip);

            if (!geo) {
                return null;
            }

            return {
                ip,
                country: {
                    code: geo.country || null,
                    name: this.getCountryName(geo.country) || null,
                    confidence: null
                },
                region: {
                    code: geo.region || null,
                    name: geo.region || null,
                    confidence: null
                },
                city: {
                    name: geo.city || null,
                    confidence: null
                },
                location: {
                    latitude: geo.ll?.[0] || null,
                    longitude: geo.ll?.[1] || null,
                    accuracyRadius: null,
                    timeZone: geo.timezone || null
                },
                postal: {
                    code: null,
                    confidence: null
                },
                asn: null,
                source: 'geoip-lite',
                accuracy: 'medium',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            logger.error('Fallback lookup failed:', error);
            return null;
        }
    }

    async detectVPNProxy(ip) {
        try {
            // Basic VPN/Proxy detection heuristics
            const detection = {
                isVPN: false,
                isProxy: false,
                isTor: false,
                isDataCenter: false,
                confidence: 0,
                provider: null
            };

            // ASN-based detection
            if (this.asnReader) {
                const asnData = this.asnReader.get(ip);
                if (asnData) {
                    const org = asnData.autonomous_system_organization?.toLowerCase() || '';

                    // Common VPN/proxy providers
                    const vpnKeywords = ['vpn', 'proxy', 'cloudflare', 'amazon', 'google', 'microsoft', 'digitalocean'];
                    const hasVpnKeyword = vpnKeywords.some(keyword => org.includes(keyword));

                    if (hasVpnKeyword) {
                        detection.isVPN = true;
                        detection.isDataCenter = true;
                        detection.confidence = 0.7;
                        detection.provider = asnData.autonomous_system_organization;
                    }
                }
            }

            // Additional checks could include:
            // - Blacklist databases
            // - Behavioral analysis
            // - Third-party VPN detection APIs

            return detection;

        } catch (error) {
            logger.error('VPN/Proxy detection failed:', error);
            return {
                isVPN: false,
                isProxy: false,
                isTor: false,
                isDataCenter: false,
                confidence: 0,
                provider: null
            };
        }
    }

    async enhanceLocationData(location, ip, vpnDetection) {
        try {
            const enhanced = { ...location };

            // Add VPN/Proxy detection results
            enhanced.vpnDetection = vpnDetection;

            // Add accuracy assessment
            enhanced.accuracyAssessment = this.assessAccuracy(location, vpnDetection);

            // Add tax jurisdiction information
            enhanced.taxJurisdiction = await this.getTaxJurisdiction(location.country.code, location.region.code);

            // Add additional metadata
            enhanced.metadata = {
                lookupTime: new Date().toISOString(),
                ipVersion: this.getIPVersion(ip),
                isPrivate: this.isPrivateIP(ip),
                isReserved: this.isReservedIP(ip)
            };

            return enhanced;

        } catch (error) {
            logger.error('Failed to enhance location data:', error);
            return location;
        }
    }

    async getTaxJurisdiction(countryCode, regionCode) {
        try {
            if (!countryCode) return null;

            // This would integrate with your Countries and States models
            const jurisdiction = {
                country: countryCode,
                region: regionCode,
                hasIncomeTax: true, // Would be looked up from database
                hasSalesTax: true,
                taxSystem: 'progressive', // Would be looked up from database
                supportedYears: [2024, 2025] // Would be looked up from database
            };

            return jurisdiction;

        } catch (error) {
            logger.error('Failed to get tax jurisdiction:', error);
            return null;
        }
    }

    calculateAccuracy(geoData) {
        let score = 0;

        // Base score
        if (geoData.country) score += 20;
        if (geoData.subdivisions?.[0]) score += 20;
        if (geoData.city) score += 20;
        if (geoData.location?.latitude && geoData.location?.longitude) score += 20;

        // Confidence scores
        if (geoData.country?.confidence) score += Math.min(geoData.country.confidence / 10, 10);
        if (geoData.subdivisions?.[0]?.confidence) score += Math.min(geoData.subdivisions[0].confidence / 10, 5);
        if (geoData.city?.confidence) score += Math.min(geoData.city.confidence / 10, 5);

        // Accuracy radius (lower is better)
        if (geoData.location?.accuracy_radius) {
            const radiusScore = Math.max(0, 10 - (geoData.location.accuracy_radius / 100));
            score += radiusScore;
        }

        return Math.min(100, Math.round(score));
    }

    assessAccuracy(location, vpnDetection) {
        let assessment = 'high';

        // Reduce accuracy for VPN/Proxy
        if (vpnDetection.isVPN || vpnDetection.isProxy) {
            assessment = 'low';
        } else if (vpnDetection.isDataCenter) {
            assessment = 'medium';
        }

        // Consider location completeness
        if (!location.city.name || !location.region.code) {
            assessment = assessment === 'high' ? 'medium' : 'low';
        }

        return assessment;
    }

    isValidIP(ip) {
        const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        return ipv4Regex.test(ip) || ipv6Regex.test(ip);
    }

    getIPVersion(ip) {
        return ip.includes(':') ? 6 : 4;
    }

    isPrivateIP(ip) {
        const privateRanges = [
            /^10\./,
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
            /^192\.168\./,
            /^127\./,
            /^169\.254\./,
            /^::1$/,
            /^fc00::/,
            /^fe80::/
        ];

        return privateRanges.some(range => range.test(ip));
    }

    isReservedIP(ip) {
        const reservedRanges = [
            /^0\./,
            /^224\./,
            /^225\./,
            /^226\./,
            /^227\./,
            /^228\./,
            /^229\./,
            /^230\./,
            /^231\./,
            /^232\./,
            /^233\./,
            /^234\./,
            /^235\./,
            /^236\./,
            /^237\./,
            /^238\./,
            /^239\./,
            /^255\.255\.255\.255$/
        ];

        return reservedRanges.some(range => range.test(ip));
    }

    getCountryName(code) {
        const countryNames = {
            'US': 'United States',
            'CA': 'Canada',
            'GB': 'United Kingdom',
            'AU': 'Australia',
            'DE': 'Germany',
            'FR': 'France',
            'JP': 'Japan',
            'CN': 'China',
            'IN': 'India',
            'BR': 'Brazil'
            // Add more as needed
        };

        return countryNames[code] || code;
    }

    scheduleUpdates() {
        const cron = require('node-cron');

        // Update databases weekly (Sunday at 2 AM)
        cron.schedule('0 2 * * 0', async () => {
            try {
                logger.info('Starting scheduled GeoIP database update...');
                await this.updateDatabases();
                logger.info('Scheduled GeoIP database update completed');
            } catch (error) {
                logger.error('Scheduled GeoIP database update failed:', error);
            }
        });
    }

    async updateDatabases() {
        if (!process.env.MAXMIND_LICENSE_KEY) {
            logger.warn('Cannot update databases: MaxMind license key not provided');
            return;
        }

        const databases = ['city', 'country', 'asn'];

        for (const db of databases) {
            try {
                await this.downloadDatabase(db, `GeoLite2-${db.charAt(0).toUpperCase() + db.slice(1)}.mmdb`);
                logger.info(`Updated ${db} database`);
            } catch (error) {
                logger.error(`Failed to update ${db} database:`, error);
            }
        }

        // Reinitialize readers with new databases
        await this.initializeMaxMindDatabases();
    }

    async healthCheck() {
        try {
            const health = {
                status: 'healthy',
                initialized: this.isInitialized,
                databases: {
                    city: !!this.cityReader,
                    country: !!this.countryReader,
                    asn: !!this.asnReader
                },
                fallback: this.fallbackEnabled
            };

            // Test with a known IP
            const testIP = '8.8.8.8';
            const testResult = await this.lookupLocation(testIP);

            health.testLookup = {
                ip: testIP,
                success: !!testResult,
                country: testResult?.country?.code || null
            };

            return health;

        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                initialized: this.isInitialized
            };
        }
    }
}

// Create singleton instance
const geoipService = new GeoIPService();

module.exports = geoipService;