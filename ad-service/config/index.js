require('dotenv').config();

const config = {
  server: {
    port: process.env.PORT || 3006,
    host: process.env.HOST || 'localhost',
    env: process.env.NODE_ENV || 'development',
    corsOrigins: process.env.CORS_ORIGINS ?
      process.env.CORS_ORIGINS.split(',') :
      ['http://localhost:3000', 'https://globaltaxcalc.com'],
    logLevel: process.env.LOG_LEVEL || 'info'
  },

  database: {
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/globaltaxcalc_ads',
      name: process.env.DB_NAME || 'globaltaxcalc_ads',
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferMaxEntries: 0
      }
    }
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB) || 0,
    cacheDb: parseInt(process.env.REDIS_CACHE_DB) || 1,
    sessionDb: parseInt(process.env.REDIS_SESSION_DB) || 2,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET || 'your_jwt_secret_key',
    apiKey: process.env.API_KEY || 'your_api_key',
    adminSecret: process.env.ADMIN_SECRET || 'your_admin_secret',
    tokenExpiry: '24h'
  },

  adNetworks: {
    googleAdsense: {
      clientId: process.env.GOOGLE_ADSENSE_CLIENT_ID,
      slotIds: {
        banner: process.env.GOOGLE_ADSENSE_SLOT_ID_BANNER,
        native: process.env.GOOGLE_ADSENSE_SLOT_ID_NATIVE,
        mobile: process.env.GOOGLE_ADSENSE_SLOT_ID_MOBILE
      },
      apiKey: process.env.GOOGLE_ADSENSE_API_KEY,
      serviceAccount: {
        clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
        privateKey: process.env.GOOGLE_PRIVATE_KEY ?
          process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : null
      }
    },
    medianet: {
      siteId: process.env.MEDIANET_SITE_ID,
      customerId: process.env.MEDIANET_CUSTOMER_ID,
      apiKey: process.env.MEDIANET_API_KEY
    },
    directAdvertisers: {
      apiEndpoint: process.env.DIRECT_ADVERTISERS_API_ENDPOINT,
      secret: process.env.DIRECT_ADVERTISERS_SECRET
    }
  },

  adPlacements: {
    types: {
      BANNER: 'banner',
      NATIVE: 'native',
      INTERSTITIAL: 'interstitial',
      VIDEO: 'video',
      MOBILE_BANNER: 'mobile_banner'
    },
    sizes: {
      banner: {
        leaderboard: { width: 728, height: 90 },
        mediumRectangle: { width: 300, height: 250 },
        skyscraper: { width: 160, height: 600 },
        wideSkyscraper: { width: 300, height: 600 }
      },
      mobile: {
        banner: { width: 320, height: 50 },
        largeBanner: { width: 320, height: 100 },
        mediumRectangle: { width: 300, height: 250 }
      }
    },
    locations: {
      HEADER: 'header',
      SIDEBAR: 'sidebar',
      CONTENT_TOP: 'content_top',
      CONTENT_MIDDLE: 'content_middle',
      CONTENT_BOTTOM: 'content_bottom',
      FOOTER: 'footer',
      MOBILE_STICKY: 'mobile_sticky'
    }
  },

  performance: {
    minViewabilityThreshold: parseFloat(process.env.MIN_VIEWABILITY_THRESHOLD) || 0.5,
    minCtrThreshold: parseFloat(process.env.MIN_CTR_THRESHOLD) || 0.01,
    minRpmThreshold: parseFloat(process.env.MIN_RPM_THRESHOLD) || 1.0,
    checkInterval: parseInt(process.env.PERFORMANCE_CHECK_INTERVAL) || 300000,
    coreWebVitalsMonitoring: process.env.CORE_WEB_VITALS_MONITORING === 'true',
    pageSpeedThreshold: parseInt(process.env.PAGE_SPEED_THRESHOLD) || 3000,
    adLoadTimeout: parseInt(process.env.AD_LOAD_TIMEOUT) || 5000,
    lazyLoadingEnabled: process.env.LAZY_LOADING_ENABLED !== 'false'
  },

  abTesting: {
    sampleSize: parseInt(process.env.AB_TEST_SAMPLE_SIZE) || 1000,
    confidenceLevel: parseFloat(process.env.AB_TEST_CONFIDENCE_LEVEL) || 0.95,
    minConversionRate: parseFloat(process.env.AB_TEST_MIN_CONVERSION_RATE) || 0.01,
    testDuration: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    maxActiveTests: 5
  },

  revenueOptimization: {
    enabled: process.env.REVENUE_OPTIMIZATION_ENABLED !== 'false',
    autoNetworkSwitching: process.env.AUTO_NETWORK_SWITCHING !== 'false',
    fallbackNetworkEnabled: process.env.FALLBACK_NETWORK_ENABLED !== 'false',
    optimizationInterval: 60 * 60 * 1000, // 1 hour
    performanceWindow: 24 * 60 * 60 * 1000, // 24 hours
    minDataPoints: 100
  },

  geographic: {
    supportedCountries: process.env.SUPPORTED_COUNTRIES ?
      process.env.SUPPORTED_COUNTRIES.split(',') :
      ['US', 'CA', 'UK', 'AU', 'DE', 'FR', 'JP', 'IN'],
    highValueCountries: process.env.HIGH_VALUE_COUNTRIES ?
      process.env.HIGH_VALUE_COUNTRIES.split(',') :
      ['US', 'CA', 'UK', 'AU', 'DE'],
    defaultCountry: process.env.DEFAULT_COUNTRY || 'US',
    geoTargeting: {
      US: { rpm: 2.5, fillRate: 0.85 },
      CA: { rpm: 2.0, fillRate: 0.80 },
      UK: { rpm: 2.2, fillRate: 0.82 },
      AU: { rpm: 2.1, fillRate: 0.81 },
      DE: { rpm: 1.8, fillRate: 0.78 },
      FR: { rpm: 1.6, fillRate: 0.75 },
      JP: { rpm: 1.4, fillRate: 0.72 },
      IN: { rpm: 0.8, fillRate: 0.70 }
    }
  },

  contentFiltering: {
    adultContentFilter: process.env.ADULT_CONTENT_FILTER !== 'false',
    competitorBlocking: process.env.COMPETITOR_BLOCKING !== 'false',
    brandSafetyEnabled: process.env.BRAND_SAFETY_ENABLED !== 'false',
    minQualityScore: parseInt(process.env.MIN_QUALITY_SCORE) || 7,
    blockedCategories: [
      'adult',
      'gambling',
      'weapons',
      'illegal_drugs',
      'tobacco',
      'alcohol_abuse'
    ],
    blockedDomains: [
      'competitor1.com',
      'competitor2.com',
      'spamsite.com'
    ],
    allowedCategories: [
      'finance',
      'business',
      'technology',
      'education',
      'professional_services'
    ]
  },

  calculatorTargeting: {
    contexts: {
      income_tax: {
        keywords: ['income', 'salary', 'wages', 'tax_brackets'],
        adTypes: ['banner', 'native'],
        relevantCategories: ['finance', 'accounting', 'tax_software']
      },
      sales_tax: {
        keywords: ['sales', 'purchase', 'retail', 'ecommerce'],
        adTypes: ['banner', 'native'],
        relevantCategories: ['retail', 'ecommerce', 'business']
      },
      property_tax: {
        keywords: ['property', 'real_estate', 'homeowner'],
        adTypes: ['banner', 'native'],
        relevantCategories: ['real_estate', 'insurance', 'legal']
      },
      business_tax: {
        keywords: ['business', 'corporate', 'llc', 'partnership'],
        adTypes: ['banner', 'native'],
        relevantCategories: ['business', 'accounting', 'legal']
      }
    }
  },

  analytics: {
    enabled: process.env.ANALYTICS_ENABLED !== 'false',
    detailedLogging: process.env.DETAILED_LOGGING === 'true',
    metricsRetentionDays: parseInt(process.env.METRICS_RETENTION_DAYS) || 90,
    batchSize: 100,
    flushInterval: 5000,
    trackingEvents: [
      'ad_impression',
      'ad_click',
      'ad_viewable',
      'ad_error',
      'revenue_event'
    ]
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
    strictMax: parseInt(process.env.RATE_LIMIT_STRICT_MAX) || 100,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/ad-service.log',
    maxSize: '20m',
    maxFiles: '14d',
    format: 'json'
  }
};

module.exports = config;