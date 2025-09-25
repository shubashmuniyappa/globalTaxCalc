const config = require('../config');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');
const { v4: uuidv4 } = require('uuid');
const Redis = require('ioredis');

class PlacementService {
  constructor() {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.cacheDb
    });

    this.adUnits = new Map();
    this.placementRules = new Map();
    this.contextualTargeting = new Map();

    this.init();
  }

  async init() {
    await this.loadAdUnits();
    await this.loadPlacementRules();
    await this.setupContextualTargeting();
  }

  async loadAdUnits() {
    const defaultAdUnits = [
      {
        id: 'header_leaderboard',
        type: config.adPlacements.types.BANNER,
        location: config.adPlacements.locations.HEADER,
        size: config.adPlacements.sizes.banner.leaderboard,
        priority: 1,
        networks: ['adsense', 'medianet', 'direct'],
        fallbacks: ['adsense_backup', 'house_ad'],
        targeting: {
          devices: ['desktop', 'tablet'],
          countries: config.geographic.supportedCountries,
          minScreenWidth: 768
        }
      },
      {
        id: 'sidebar_rectangle',
        type: config.adPlacements.types.BANNER,
        location: config.adPlacements.locations.SIDEBAR,
        size: config.adPlacements.sizes.banner.mediumRectangle,
        priority: 2,
        networks: ['adsense', 'medianet'],
        fallbacks: ['adsense_backup'],
        targeting: {
          devices: ['desktop'],
          countries: config.geographic.supportedCountries,
          minScreenWidth: 1024
        }
      },
      {
        id: 'content_native',
        type: config.adPlacements.types.NATIVE,
        location: config.adPlacements.locations.CONTENT_MIDDLE,
        size: { width: 'responsive', height: 'auto' },
        priority: 3,
        networks: ['adsense', 'direct'],
        fallbacks: ['content_banner'],
        targeting: {
          devices: ['desktop', 'tablet', 'mobile'],
          countries: config.geographic.supportedCountries,
          contextual: true
        }
      },
      {
        id: 'mobile_banner',
        type: config.adPlacements.types.MOBILE_BANNER,
        location: config.adPlacements.locations.MOBILE_STICKY,
        size: config.adPlacements.sizes.mobile.banner,
        priority: 1,
        networks: ['adsense', 'medianet'],
        fallbacks: ['mobile_backup'],
        targeting: {
          devices: ['mobile'],
          countries: config.geographic.supportedCountries,
          maxScreenWidth: 767
        }
      },
      {
        id: 'content_top_banner',
        type: config.adPlacements.types.BANNER,
        location: config.adPlacements.locations.CONTENT_TOP,
        size: config.adPlacements.sizes.banner.mediumRectangle,
        priority: 2,
        networks: ['adsense', 'medianet', 'direct'],
        fallbacks: ['adsense_backup'],
        targeting: {
          devices: ['desktop', 'tablet'],
          countries: config.geographic.supportedCountries,
          calculatorTypes: ['income_tax', 'business_tax']
        }
      },
      {
        id: 'footer_banner',
        type: config.adPlacements.types.BANNER,
        location: config.adPlacements.locations.FOOTER,
        size: config.adPlacements.sizes.banner.leaderboard,
        priority: 4,
        networks: ['adsense', 'direct'],
        fallbacks: ['house_ad'],
        targeting: {
          devices: ['desktop', 'tablet'],
          countries: config.geographic.supportedCountries,
          lazyLoad: true
        }
      }
    ];

    for (const unit of defaultAdUnits) {
      this.adUnits.set(unit.id, unit);
      await this.redis.setex(`ad_unit:${unit.id}`, 3600, JSON.stringify(unit));
    }
  }

  async loadPlacementRules() {
    const rules = [
      {
        id: 'high_value_geo',
        condition: (context) => config.geographic.highValueCountries.includes(context.country),
        action: (adUnit) => {
          adUnit.networks = ['adsense', 'medianet', 'direct'];
          adUnit.priority += 1;
          return adUnit;
        }
      },
      {
        id: 'mobile_optimization',
        condition: (context) => context.device === 'mobile',
        action: (adUnit) => {
          if (adUnit.type === config.adPlacements.types.BANNER) {
            adUnit.size = config.adPlacements.sizes.mobile.banner;
          }
          adUnit.networks = adUnit.networks.filter(n => n !== 'medianet');
          return adUnit;
        }
      },
      {
        id: 'calculator_contextual',
        condition: (context) => context.calculatorType,
        action: (adUnit) => {
          const targeting = config.calculatorTargeting.contexts[context.calculatorType];
          if (targeting) {
            adUnit.contextualKeywords = targeting.keywords;
            adUnit.relevantCategories = targeting.relevantCategories;
          }
          return adUnit;
        }
      },
      {
        id: 'premium_user',
        condition: (context) => context.userType === 'premium',
        action: (adUnit) => {
          // Reduce ad density for premium users
          adUnit.priority -= 2;
          if (adUnit.location === config.adPlacements.locations.CONTENT_MIDDLE) {
            return null; // Hide content ads for premium users
          }
          return adUnit;
        }
      },
      {
        id: 'low_performance_fallback',
        condition: (context, adUnit) => {
          const performance = context.networkPerformance || {};
          return performance[adUnit.networks[0]]?.fillRate < 0.5;
        },
        action: (adUnit) => {
          // Switch to better performing network
          const networks = [...adUnit.networks];
          adUnit.networks = networks.reverse();
          return adUnit;
        }
      }
    ];

    for (const rule of rules) {
      this.placementRules.set(rule.id, rule);
    }
  }

  async setupContextualTargeting() {
    const contexts = config.calculatorTargeting.contexts;

    for (const [calculatorType, targeting] of Object.entries(contexts)) {
      this.contextualTargeting.set(calculatorType, {
        keywords: targeting.keywords,
        adTypes: targeting.adTypes,
        categories: targeting.relevantCategories,
        boost: 1.5 // Revenue boost for contextual matches
      });
    }
  }

  async getAdPlacement(location, context = {}) {
    try {
      // Enrich context with user data
      const enrichedContext = await this.enrichContext(context);

      // Find eligible ad units for this location
      const eligibleUnits = Array.from(this.adUnits.values())
        .filter(unit => unit.location === location)
        .filter(unit => this.isUnitEligible(unit, enrichedContext));

      if (eligibleUnits.length === 0) {
        return this.getFallbackAd(location, enrichedContext);
      }

      // Apply placement rules
      let processedUnits = eligibleUnits.map(unit => {
        let modifiedUnit = { ...unit };

        for (const rule of this.placementRules.values()) {
          if (rule.condition(enrichedContext, modifiedUnit)) {
            const result = rule.action(modifiedUnit);
            if (result === null) {
              return null; // Unit should be hidden
            }
            modifiedUnit = result;
          }
        }

        return modifiedUnit;
      }).filter(unit => unit !== null);

      if (processedUnits.length === 0) {
        return this.getFallbackAd(location, enrichedContext);
      }

      // Select best performing unit
      const selectedUnit = await this.selectOptimalUnit(processedUnits, enrichedContext);

      // Generate ad placement response
      return await this.generateAdPlacement(selectedUnit, enrichedContext);

    } catch (error) {
      console.error('Error getting ad placement:', error);
      return this.getFallbackAd(location, context);
    }
  }

  async enrichContext(context) {
    const enriched = { ...context };

    // Geographic enrichment
    if (context.ip && !context.country) {
      const geo = geoip.lookup(context.ip);
      if (geo) {
        enriched.country = geo.country;
        enriched.region = geo.region;
        enriched.city = geo.city;
        enriched.timezone = geo.timezone;
      }
    }

    // Device enrichment
    if (context.userAgent && !context.device) {
      const parser = new UAParser(context.userAgent);
      const result = parser.getResult();

      enriched.device = this.getDeviceType(result);
      enriched.browser = result.browser.name;
      enriched.os = result.os.name;
      enriched.screenSize = context.screenWidth || 1920;
    }

    // Performance data enrichment
    if (!enriched.networkPerformance) {
      enriched.networkPerformance = await this.getNetworkPerformance(enriched.country);
    }

    // A/B test assignment
    if (!enriched.abTestVariant) {
      enriched.abTestVariant = await this.getABTestVariant(context.userId || context.sessionId);
    }

    // Time-based targeting
    enriched.timestamp = Date.now();
    enriched.hour = new Date().getHours();
    enriched.dayOfWeek = new Date().getDay();

    return enriched;
  }

  getDeviceType(uaResult) {
    if (uaResult.device.type === 'mobile' || uaResult.device.type === 'tablet') {
      return uaResult.device.type;
    }

    // Determine by screen size if available
    const screenWidth = parseInt(uaResult.screenWidth) || 1920;
    if (screenWidth <= 767) return 'mobile';
    if (screenWidth <= 1024) return 'tablet';
    return 'desktop';
  }

  isUnitEligible(unit, context) {
    const targeting = unit.targeting || {};

    // Device targeting
    if (targeting.devices && !targeting.devices.includes(context.device)) {
      return false;
    }

    // Country targeting
    if (targeting.countries && !targeting.countries.includes(context.country)) {
      return false;
    }

    // Screen size targeting
    if (targeting.minScreenWidth && context.screenSize < targeting.minScreenWidth) {
      return false;
    }

    if (targeting.maxScreenWidth && context.screenSize > targeting.maxScreenWidth) {
      return false;
    }

    // Calculator type targeting
    if (targeting.calculatorTypes && context.calculatorType &&
        !targeting.calculatorTypes.includes(context.calculatorType)) {
      return false;
    }

    // User type targeting
    if (targeting.userTypes && context.userType &&
        !targeting.userTypes.includes(context.userType)) {
      return false;
    }

    // Time-based targeting
    if (targeting.hours && !targeting.hours.includes(context.hour)) {
      return false;
    }

    return true;
  }

  async selectOptimalUnit(units, context) {
    // Sort by priority and performance
    const scoredUnits = await Promise.all(units.map(async (unit) => {
      const score = await this.calculateUnitScore(unit, context);
      return { unit, score };
    }));

    scoredUnits.sort((a, b) => b.score - a.score);
    return scoredUnits[0].unit;
  }

  async calculateUnitScore(unit, context) {
    let score = unit.priority || 1;

    // Network performance boost
    const networkPerf = context.networkPerformance || {};
    const primaryNetwork = unit.networks[0];
    const networkData = networkPerf[primaryNetwork];

    if (networkData) {
      score += networkData.fillRate * 10;
      score += networkData.rpm * 2;
    }

    // Geographic boost
    const geoData = config.geographic.geoTargeting[context.country];
    if (geoData) {
      score += geoData.rpm;
    }

    // Contextual relevance boost
    if (context.calculatorType) {
      const contextual = this.contextualTargeting.get(context.calculatorType);
      if (contextual && contextual.adTypes.includes(unit.type)) {
        score *= contextual.boost;
      }
    }

    // A/B test modification
    if (context.abTestVariant && context.abTestVariant.adUnitModifier) {
      score *= context.abTestVariant.adUnitModifier[unit.id] || 1;
    }

    // Time-based adjustments
    if (context.hour >= 9 && context.hour <= 17) {
      score *= 1.2; // Business hours boost
    }

    return score;
  }

  async generateAdPlacement(unit, context) {
    const placementId = uuidv4();

    const placement = {
      id: placementId,
      unitId: unit.id,
      type: unit.type,
      location: unit.location,
      size: unit.size,
      networks: unit.networks,
      fallbacks: unit.fallbacks,
      targeting: {
        country: context.country,
        device: context.device,
        calculatorType: context.calculatorType,
        keywords: unit.contextualKeywords || [],
        categories: unit.relevantCategories || []
      },
      metadata: {
        timestamp: Date.now(),
        sessionId: context.sessionId,
        userId: context.userId,
        abTestVariant: context.abTestVariant?.id,
        userAgent: context.userAgent,
        ip: context.ip // Note: Should be anonymized in production
      },
      loadingConfig: {
        lazyLoad: unit.targeting?.lazyLoad || false,
        timeout: config.performance.adLoadTimeout,
        fallbackEnabled: config.revenueOptimization.fallbackNetworkEnabled
      }
    };

    // Cache placement for tracking
    await this.redis.setex(`placement:${placementId}`, 3600, JSON.stringify(placement));

    return placement;
  }

  async getNetworkPerformance(country) {
    const cacheKey = `network_performance:${country}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // Default performance data - in production, this would come from analytics
    const defaultPerformance = {
      adsense: {
        fillRate: 0.85,
        rpm: config.geographic.geoTargeting[country]?.rpm || 1.5,
        latency: 120
      },
      medianet: {
        fillRate: 0.70,
        rpm: (config.geographic.geoTargeting[country]?.rpm || 1.5) * 0.8,
        latency: 150
      },
      direct: {
        fillRate: 0.60,
        rpm: (config.geographic.geoTargeting[country]?.rpm || 1.5) * 1.2,
        latency: 100
      }
    };

    await this.redis.setex(cacheKey, 1800, JSON.stringify(defaultPerformance));
    return defaultPerformance;
  }

  async getABTestVariant(identifier) {
    if (!identifier) return null;

    const cacheKey = `ab_variant:${identifier}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // Simple hash-based assignment
    const hash = this.simpleHash(identifier);
    const variants = [
      { id: 'control', adUnitModifier: {} },
      { id: 'high_density', adUnitModifier: { sidebar_rectangle: 1.5 } },
      { id: 'native_focus', adUnitModifier: { content_native: 2.0 } }
    ];

    const variant = variants[hash % variants.length];
    await this.redis.setex(cacheKey, 86400, JSON.stringify(variant));

    return variant;
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  async getFallbackAd(location, context) {
    return {
      id: uuidv4(),
      unitId: 'fallback',
      type: 'house_ad',
      location: location,
      size: { width: 300, height: 250 },
      content: {
        title: 'Upgrade to Premium',
        description: 'Get advanced tax calculations with no ads',
        cta: 'Learn More',
        url: '/premium'
      },
      metadata: {
        timestamp: Date.now(),
        fallback: true,
        reason: 'no_eligible_units'
      }
    };
  }

  async updateAdUnit(unitId, updates) {
    const unit = this.adUnits.get(unitId);
    if (!unit) {
      throw new Error(`Ad unit ${unitId} not found`);
    }

    const updatedUnit = { ...unit, ...updates };
    this.adUnits.set(unitId, updatedUnit);

    await this.redis.setex(`ad_unit:${unitId}`, 3600, JSON.stringify(updatedUnit));

    return updatedUnit;
  }

  async getAdUnitPerformance(unitId, timeRange = '24h') {
    // This would integrate with analytics service
    const mockPerformance = {
      impressions: Math.floor(Math.random() * 10000),
      clicks: Math.floor(Math.random() * 100),
      revenue: Math.random() * 500,
      fillRate: 0.8 + Math.random() * 0.2,
      viewability: 0.7 + Math.random() * 0.3,
      ctr: Math.random() * 0.02
    };

    return mockPerformance;
  }

  async healthCheck() {
    try {
      await this.redis.ping();
      return {
        status: 'healthy',
        adUnits: this.adUnits.size,
        placementRules: this.placementRules.size,
        contextualTargeting: this.contextualTargeting.size
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

module.exports = new PlacementService();