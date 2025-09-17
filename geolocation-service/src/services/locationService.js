const geoipService = require('./geoipService');
const redis = require('../config/redis');
const logger = require('../config/logger');
const { Countries, States } = require('../models');

class LocationService {
    constructor() {
        this.defaultAccuracy = 'medium';
        this.sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
    }

    async detectUserLocation(req, options = {}) {
        try {
            const ip = this.extractIPAddress(req);
            const userAgent = req.get('User-Agent');
            const sessionId = this.generateSessionId(req);

            logger.info('Detecting user location', { ip, userAgent, sessionId });

            // Check for manual override first
            const manualOverride = await this.getManualOverride(sessionId);
            if (manualOverride && !options.forceDetection) {
                logger.info('Using manual location override', { sessionId, location: manualOverride });
                return this.enhanceLocationWithTaxInfo(manualOverride);
            }

            // Check session cache
            const sessionLocation = await this.getSessionLocation(sessionId);
            if (sessionLocation && !options.forceDetection) {
                logger.info('Using cached session location', { sessionId });
                return sessionLocation;
            }

            // Perform GeoIP lookup
            const geoLocation = await geoipService.lookupLocation(ip);

            // Enhance with user preferences
            const enhancedLocation = await this.enhanceWithUserPreferences(geoLocation, sessionId);

            // Cache session location
            await this.cacheSessionLocation(sessionId, enhancedLocation);

            // Update location history
            await this.updateLocationHistory(sessionId, enhancedLocation);

            logger.info('Location detection completed', {
                sessionId,
                country: enhancedLocation.country.code,
                accuracy: enhancedLocation.accuracyAssessment
            });

            return enhancedLocation;

        } catch (error) {
            logger.error('Location detection failed:', error);
            return this.getFallbackLocation();
        }
    }

    async setManualLocation(sessionId, locationData, options = {}) {
        try {
            // Validate location data
            const validatedLocation = await this.validateLocationData(locationData);

            // Enhance with tax information
            const enhancedLocation = await this.enhanceLocationWithTaxInfo(validatedLocation);

            // Set manual override flag
            enhancedLocation.isManualOverride = true;
            enhancedLocation.overrideTimestamp = new Date().toISOString();
            enhancedLocation.overrideReason = options.reason || 'user_selection';

            // Cache manual override
            await this.cacheManualOverride(sessionId, enhancedLocation, options.ttl);

            // Update session location
            await this.cacheSessionLocation(sessionId, enhancedLocation);

            // Update location history
            await this.updateLocationHistory(sessionId, enhancedLocation);

            logger.info('Manual location set', {
                sessionId,
                country: enhancedLocation.country.code,
                region: enhancedLocation.region.code,
                reason: enhancedLocation.overrideReason
            });

            return enhancedLocation;

        } catch (error) {
            logger.error('Failed to set manual location:', error);
            throw error;
        }
    }

    async clearManualOverride(sessionId) {
        try {
            await redis.del(`manual_override:${sessionId}`);

            // Re-detect location automatically
            const detectedLocation = await this.detectUserLocation({ sessionId }, { forceDetection: true });

            logger.info('Manual override cleared', { sessionId });
            return detectedLocation;

        } catch (error) {
            logger.error('Failed to clear manual override:', error);
            throw error;
        }
    }

    async getLocationHistory(sessionId, limit = 10) {
        try {
            const historyKey = `location_history:${sessionId}`;
            const history = await redis.get(historyKey) || [];

            return history.slice(0, limit);

        } catch (error) {
            logger.error('Failed to get location history:', error);
            return [];
        }
    }

    async compareLocations(locationA, locationB) {
        try {
            const comparison = {
                sameCountry: locationA.country.code === locationB.country.code,
                sameRegion: locationA.country.code === locationB.country.code &&
                           locationA.region.code === locationB.region.code,
                sameCity: locationA.country.code === locationB.country.code &&
                         locationA.region.code === locationB.region.code &&
                         locationA.city.name === locationB.city.name,
                taxImplications: await this.compareTaxImplications(locationA, locationB),
                distance: this.calculateDistance(locationA, locationB)
            };

            return comparison;

        } catch (error) {
            logger.error('Failed to compare locations:', error);
            throw error;
        }
    }

    async getMultiLocationComparison(locations) {
        try {
            const results = [];

            for (let i = 0; i < locations.length; i++) {
                const location = locations[i];
                const enhancedLocation = await this.enhanceLocationWithTaxInfo(location);

                // Get tax summary for this location
                const taxSummary = await this.getTaxSummary(enhancedLocation);

                results.push({
                    location: enhancedLocation,
                    taxSummary,
                    index: i
                });
            }

            // Add comparisons between locations
            for (let i = 0; i < results.length; i++) {
                results[i].comparisons = [];
                for (let j = 0; j < results.length; j++) {
                    if (i !== j) {
                        const comparison = await this.compareLocations(
                            results[i].location,
                            results[j].location
                        );
                        results[i].comparisons.push({
                            withLocation: j,
                            comparison
                        });
                    }
                }
            }

            return results;

        } catch (error) {
            logger.error('Failed to get multi-location comparison:', error);
            throw error;
        }
    }

    async validateLocationData(locationData) {
        const errors = [];

        // Validate country
        if (!locationData.country || !locationData.country.code) {
            errors.push('Country code is required');
        } else {
            const country = await Countries.findByCode(locationData.country.code);
            if (!country) {
                errors.push('Invalid country code');
            }
        }

        // Validate region/state if provided
        if (locationData.region && locationData.region.code) {
            const state = await States.findByCode(locationData.country.code, locationData.region.code);
            if (!state) {
                errors.push('Invalid region/state code');
            }
        }

        if (errors.length > 0) {
            throw new Error(`Location validation failed: ${errors.join(', ')}`);
        }

        return locationData;
    }

    async enhanceLocationWithTaxInfo(location) {
        try {
            const enhanced = { ...location };

            // Get country information
            const country = await Countries.findByCode(location.country.code);
            if (country) {
                enhanced.country.name = country.name;
                enhanced.country.currency = country.currency;
                enhanced.country.taxSystem = country.taxSystem;
                enhanced.country.isSupported = country.isSupported;
                enhanced.country.supportLevel = country.supportLevel;
            }

            // Get state/region information if available
            if (location.region && location.region.code) {
                const state = await States.findByCode(location.country.code, location.region.code);
                if (state) {
                    enhanced.region.name = state.name;
                    enhanced.region.type = state.type;
                    enhanced.region.hasIncomeTax = state.hasIncomeTax?.(new Date().getFullYear());
                    enhanced.region.isSupported = state.isSupported;
                }
            }

            // Add tax jurisdiction summary
            enhanced.taxJurisdiction = {
                country: location.country.code,
                region: location.region?.code || null,
                hasCountrySupport: enhanced.country?.isSupported || false,
                hasRegionSupport: enhanced.region?.isSupported || false,
                supportLevel: enhanced.country?.supportLevel || 'none',
                availableYears: enhanced.country?.supportedTaxYears || []
            };

            return enhanced;

        } catch (error) {
            logger.error('Failed to enhance location with tax info:', error);
            return location;
        }
    }

    async enhanceWithUserPreferences(location, sessionId) {
        try {
            // Get user preferences from cache or database
            const preferences = await this.getUserPreferences(sessionId);

            if (!preferences) {
                return location;
            }

            const enhanced = { ...location };

            // Apply preferences
            if (preferences.preferredCurrency) {
                enhanced.preferredCurrency = preferences.preferredCurrency;
            }

            if (preferences.taxYear) {
                enhanced.preferredTaxYear = preferences.taxYear;
            }

            if (preferences.filingStatus) {
                enhanced.preferredFilingStatus = preferences.filingStatus;
            }

            return enhanced;

        } catch (error) {
            logger.error('Failed to enhance with user preferences:', error);
            return location;
        }
    }

    async getTaxSummary(location) {
        try {
            const summary = {
                country: location.country.code,
                region: location.region?.code || null,
                isSupported: location.taxJurisdiction?.hasCountrySupport || false,
                taxSystem: location.country?.taxSystem || null,
                features: {
                    hasIncomeTax: true,
                    hasStateTax: location.region?.hasIncomeTax || false,
                    hasSalesTax: true,
                    hasVAT: location.country?.taxSystem?.features?.hasVAT || false
                },
                availableYears: location.country?.supportedTaxYears || [],
                currency: location.country?.currency?.code || null
            };

            return summary;

        } catch (error) {
            logger.error('Failed to get tax summary:', error);
            return null;
        }
    }

    async compareTaxImplications(locationA, locationB) {
        try {
            const taxA = await this.getTaxSummary(locationA);
            const taxB = await this.getTaxSummary(locationB);

            return {
                differentCountries: taxA.country !== taxB.country,
                differentRegions: taxA.region !== taxB.region,
                differentTaxSystems: taxA.taxSystem?.type !== taxB.taxSystem?.type,
                differentCurrencies: taxA.currency !== taxB.currency,
                supportDifferences: {
                    locationA: taxA.isSupported,
                    locationB: taxB.isSupported
                },
                featureDifferences: {
                    stateTax: taxA.features.hasStateTax !== taxB.features.hasStateTax,
                    vat: taxA.features.hasVAT !== taxB.features.hasVAT
                }
            };

        } catch (error) {
            logger.error('Failed to compare tax implications:', error);
            return null;
        }
    }

    calculateDistance(locationA, locationB) {
        try {
            const latA = locationA.location?.latitude;
            const lonA = locationA.location?.longitude;
            const latB = locationB.location?.latitude;
            const lonB = locationB.location?.longitude;

            if (!latA || !lonA || !latB || !lonB) {
                return null;
            }

            // Haversine formula
            const R = 6371; // Earth's radius in kilometers
            const dLat = this.toRadians(latB - latA);
            const dLon = this.toRadians(lonB - lonA);

            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                     Math.cos(this.toRadians(latA)) * Math.cos(this.toRadians(latB)) *
                     Math.sin(dLon / 2) * Math.sin(dLon / 2);

            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distance = R * c;

            return Math.round(distance * 100) / 100; // Round to 2 decimal places

        } catch (error) {
            logger.error('Failed to calculate distance:', error);
            return null;
        }
    }

    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    extractIPAddress(req) {
        // Try various headers for real IP (considering proxies/load balancers)
        const forwardedFor = req.get('X-Forwarded-For');
        if (forwardedFor) {
            return forwardedFor.split(',')[0].trim();
        }

        return req.get('X-Real-IP') ||
               req.get('X-Client-IP') ||
               req.connection.remoteAddress ||
               req.socket.remoteAddress ||
               req.ip ||
               '127.0.0.1';
    }

    generateSessionId(req) {
        // Use existing session ID if available, otherwise create one
        return req.sessionID ||
               req.get('X-Session-ID') ||
               `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async getManualOverride(sessionId) {
        try {
            return await redis.get(`manual_override:${sessionId}`);
        } catch (error) {
            logger.error('Failed to get manual override:', error);
            return null;
        }
    }

    async cacheManualOverride(sessionId, location, ttl = null) {
        try {
            const cacheTtl = ttl || this.sessionTimeout / 1000;
            await redis.set(`manual_override:${sessionId}`, location, cacheTtl);
        } catch (error) {
            logger.error('Failed to cache manual override:', error);
        }
    }

    async getSessionLocation(sessionId) {
        try {
            return await redis.get(`session_location:${sessionId}`);
        } catch (error) {
            logger.error('Failed to get session location:', error);
            return null;
        }
    }

    async cacheSessionLocation(sessionId, location) {
        try {
            const ttl = this.sessionTimeout / 1000;
            await redis.set(`session_location:${sessionId}`, location, ttl);
        } catch (error) {
            logger.error('Failed to cache session location:', error);
        }
    }

    async updateLocationHistory(sessionId, location) {
        try {
            const historyKey = `location_history:${sessionId}`;
            let history = await redis.get(historyKey) || [];

            // Add new location to history
            const historyEntry = {
                ...location,
                timestamp: new Date().toISOString()
            };

            history.unshift(historyEntry);

            // Keep only last 20 entries
            history = history.slice(0, 20);

            // Cache for 7 days
            await redis.set(historyKey, history, 7 * 24 * 3600);

        } catch (error) {
            logger.error('Failed to update location history:', error);
        }
    }

    async getUserPreferences(sessionId) {
        try {
            return await redis.get(`user_preferences:${sessionId}`);
        } catch (error) {
            logger.error('Failed to get user preferences:', error);
            return null;
        }
    }

    getFallbackLocation() {
        return {
            ip: 'unknown',
            country: {
                code: 'US',
                name: 'United States'
            },
            region: {
                code: null,
                name: null
            },
            city: {
                name: null
            },
            location: {
                latitude: null,
                longitude: null
            },
            source: 'fallback',
            accuracy: 'low',
            accuracyAssessment: 'low',
            isFallback: true,
            timestamp: new Date().toISOString()
        };
    }

    async healthCheck() {
        try {
            const geoipHealth = await geoipService.healthCheck();

            return {
                status: 'healthy',
                geoipService: geoipHealth,
                cacheConnected: redis.isHealthy(),
                sessionTimeout: this.sessionTimeout
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
const locationService = new LocationService();

module.exports = locationService;