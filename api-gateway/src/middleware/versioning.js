/**
 * API Versioning and Routing Middleware
 * Supports URL-based, header-based, and query parameter versioning
 */

const express = require('express');
const semver = require('semver');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/versioning.log' })
  ]
});

class APIVersionManager {
  constructor() {
    this.versions = new Map();
    this.deprecatedVersions = new Map();
    this.defaultVersion = '1.0.0';
    this.supportedVersions = ['1.0.0', '1.1.0', '2.0.0'];
    this.router = express.Router();

    // Version compatibility matrix
    this.compatibilityMatrix = {
      '1.0.0': {
        compatible: ['1.0.0', '1.1.0'],
        deprecated: false,
        sunsetDate: null
      },
      '1.1.0': {
        compatible: ['1.1.0', '2.0.0'],
        deprecated: false,
        sunsetDate: null
      },
      '2.0.0': {
        compatible: ['2.0.0'],
        deprecated: false,
        sunsetDate: null
      }
    };

    this.initializeVersionRoutes();
  }

  /**
   * Initialize version-specific routes
   */
  initializeVersionRoutes() {
    // Version-specific route handlers
    this.versions.set('1.0.0', {
      prefix: '/api/v1',
      handler: this.createV1Handler(),
      features: ['basic-calculations', 'user-auth', 'reports'],
      deprecated: false
    });

    this.versions.set('1.1.0', {
      prefix: '/api/v1.1',
      handler: this.createV1_1Handler(),
      features: ['basic-calculations', 'user-auth', 'reports', 'advanced-calculations', 'bulk-processing'],
      deprecated: false
    });

    this.versions.set('2.0.0', {
      prefix: '/api/v2',
      handler: this.createV2Handler(),
      features: ['all-features', 'graphql', 'real-time', 'ai-insights'],
      deprecated: false
    });
  }

  /**
   * Main versioning middleware
   */
  middleware() {
    return (req, res, next) => {
      try {
        const versionInfo = this.extractVersion(req);
        const resolvedVersion = this.resolveVersion(versionInfo.version);

        if (!resolvedVersion) {
          return res.status(400).json({
            error: {
              code: 'UNSUPPORTED_VERSION',
              message: `API version ${versionInfo.version} is not supported`,
              supportedVersions: this.supportedVersions
            }
          });
        }

        // Attach version info to request
        req.apiVersion = {
          requested: versionInfo.version,
          resolved: resolvedVersion,
          source: versionInfo.source,
          isDeprecated: this.isVersionDeprecated(resolvedVersion),
          sunsetDate: this.getSunsetDate(resolvedVersion)
        };

        // Add version headers to response
        res.set({
          'API-Version': resolvedVersion,
          'API-Version-Requested': versionInfo.version,
          'API-Supported-Versions': this.supportedVersions.join(', ')
        });

        // Add deprecation warnings if needed
        if (req.apiVersion.isDeprecated) {
          res.set({
            'Warning': '299 - "This API version is deprecated"',
            'Sunset': req.apiVersion.sunsetDate || 'TBD'
          });

          logger.warn('Deprecated API version used', {
            version: resolvedVersion,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            endpoint: req.path
          });
        }

        // Log version usage for analytics
        this.logVersionUsage(req);

        next();
      } catch (error) {
        logger.error('Versioning middleware error', error);
        res.status(500).json({
          error: {
            code: 'VERSION_PROCESSING_ERROR',
            message: 'Error processing API version'
          }
        });
      }
    };
  }

  /**
   * Extract version from request
   */
  extractVersion(req) {
    let version = null;
    let source = 'default';

    // 1. Check URL path first (/api/v1/, /api/v2/)
    const urlVersionMatch = req.path.match(/^\/api\/v(\d+(?:\.\d+)*)/);
    if (urlVersionMatch) {
      version = urlVersionMatch[1];
      source = 'url';
    }

    // 2. Check Accept header (Accept: application/vnd.globaltaxcalc.v2+json)
    if (!version) {
      const acceptHeader = req.get('Accept');
      if (acceptHeader) {
        const headerVersionMatch = acceptHeader.match(/vnd\.globaltaxcalc\.v(\d+(?:\.\d+)*)/);
        if (headerVersionMatch) {
          version = headerVersionMatch[1];
          source = 'header';
        }
      }
    }

    // 3. Check custom version header
    if (!version) {
      const versionHeader = req.get('X-API-Version') || req.get('API-Version');
      if (versionHeader) {
        version = versionHeader;
        source = 'header';
      }
    }

    // 4. Check query parameter
    if (!version && req.query.version) {
      version = req.query.version;
      source = 'query';
    }

    // 5. Use default version
    if (!version) {
      version = this.defaultVersion;
      source = 'default';
    }

    return { version, source };
  }

  /**
   * Resolve version using semantic versioning
   */
  resolveVersion(requestedVersion) {
    // If exact version exists, return it
    if (this.supportedVersions.includes(requestedVersion)) {
      return requestedVersion;
    }

    // Try to find compatible version using semver
    const compatibleVersions = this.supportedVersions.filter(version => {
      return semver.satisfies(version, `^${requestedVersion}`);
    });

    if (compatibleVersions.length > 0) {
      // Return the latest compatible version
      return compatibleVersions.sort(semver.rcompare)[0];
    }

    // Check for major version compatibility
    const majorVersion = requestedVersion.split('.')[0];
    const majorCompatible = this.supportedVersions.filter(version => {
      return version.startsWith(`${majorVersion}.`);
    });

    if (majorCompatible.length > 0) {
      return majorCompatible.sort(semver.rcompare)[0];
    }

    return null;
  }

  /**
   * Route handler for version redirection
   */
  versionRouter() {
    const router = express.Router();

    // Handle versioned routes
    this.versions.forEach((versionConfig, version) => {
      router.use(versionConfig.prefix, (req, res, next) => {
        req.apiVersion = {
          ...req.apiVersion,
          resolved: version,
          handler: versionConfig.handler
        };
        next();
      });
    });

    // Handle unversioned routes (default to latest)
    router.use('/api', (req, res, next) => {
      if (!req.path.match(/^\/v\d+/)) {
        // Redirect to default version
        const defaultVersionConfig = this.versions.get(this.defaultVersion);
        req.apiVersion = {
          ...req.apiVersion,
          resolved: this.defaultVersion,
          handler: defaultVersionConfig.handler
        };
      }
      next();
    });

    return router;
  }

  /**
   * Create v1 API handler
   */
  createV1Handler() {
    const router = express.Router();

    // v1 specific middleware
    router.use((req, res, next) => {
      req.legacyMode = true;
      next();
    });

    return router;
  }

  /**
   * Create v1.1 API handler
   */
  createV1_1Handler() {
    const router = express.Router();

    // v1.1 specific middleware
    router.use((req, res, next) => {
      req.enhancedFeatures = true;
      next();
    });

    return router;
  }

  /**
   * Create v2 API handler
   */
  createV2Handler() {
    const router = express.Router();

    // v2 specific middleware
    router.use((req, res, next) => {
      req.modernApi = true;
      req.graphqlSupport = true;
      next();
    });

    return router;
  }

  /**
   * Check if version is deprecated
   */
  isVersionDeprecated(version) {
    return this.compatibilityMatrix[version]?.deprecated || false;
  }

  /**
   * Get sunset date for version
   */
  getSunsetDate(version) {
    return this.compatibilityMatrix[version]?.sunsetDate;
  }

  /**
   * Deprecate a version
   */
  deprecateVersion(version, sunsetDate = null) {
    if (this.compatibilityMatrix[version]) {
      this.compatibilityMatrix[version].deprecated = true;
      this.compatibilityMatrix[version].sunsetDate = sunsetDate;

      logger.info(`API version ${version} deprecated`, {
        sunsetDate: sunsetDate
      });
    }
  }

  /**
   * Remove deprecated version
   */
  removeVersion(version) {
    this.versions.delete(version);
    delete this.compatibilityMatrix[version];
    this.supportedVersions = this.supportedVersions.filter(v => v !== version);

    logger.info(`API version ${version} removed`);
  }

  /**
   * Log version usage for analytics
   */
  logVersionUsage(req) {
    const usage = {
      timestamp: new Date().toISOString(),
      version: req.apiVersion.resolved,
      requestedVersion: req.apiVersion.requested,
      source: req.apiVersion.source,
      endpoint: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id
    };

    // Store in Redis for real-time analytics
    if (global.redisClient) {
      global.redisClient.lpush('api:version:usage', JSON.stringify(usage));
      global.redisClient.ltrim('api:version:usage', 0, 9999); // Keep last 10k entries
    }

    logger.info('API version usage', usage);
  }

  /**
   * Get version usage statistics
   */
  async getVersionStats() {
    if (!global.redisClient) {
      return { error: 'Redis not available' };
    }

    try {
      const usageData = await global.redisClient.lrange('api:version:usage', 0, -1);
      const stats = {
        totalRequests: usageData.length,
        versionBreakdown: {},
        sourceBreakdown: {},
        deprecatedUsage: 0
      };

      usageData.forEach(entry => {
        const data = JSON.parse(entry);

        // Version breakdown
        stats.versionBreakdown[data.version] =
          (stats.versionBreakdown[data.version] || 0) + 1;

        // Source breakdown
        stats.sourceBreakdown[data.source] =
          (stats.sourceBreakdown[data.source] || 0) + 1;

        // Deprecated usage
        if (this.isVersionDeprecated(data.version)) {
          stats.deprecatedUsage++;
        }
      });

      return stats;
    } catch (error) {
      logger.error('Error getting version stats', error);
      return { error: error.message };
    }
  }

  /**
   * Middleware for backward compatibility
   */
  backwardCompatibilityMiddleware() {
    return (req, res, next) => {
      const version = req.apiVersion?.resolved;

      if (!version) {
        return next();
      }

      // Apply version-specific transformations
      switch (version) {
        case '1.0.0':
          this.applyV1Compatibility(req, res);
          break;
        case '1.1.0':
          this.applyV1_1Compatibility(req, res);
          break;
        case '2.0.0':
          this.applyV2Features(req, res);
          break;
      }

      next();
    };
  }

  /**
   * Apply v1 compatibility transformations
   */
  applyV1Compatibility(req, res) {
    // Transform modern request format to v1 format
    const originalJson = res.json;
    res.json = function(data) {
      // Convert new field names to old ones for v1 compatibility
      if (data && typeof data === 'object') {
        data = this.transformResponseForV1(data);
      }
      return originalJson.call(this, data);
    }.bind(this);
  }

  /**
   * Apply v1.1 compatibility transformations
   */
  applyV1_1Compatibility(req, res) {
    // Add enhanced features for v1.1
    req.bulkProcessing = true;
    req.advancedCalculations = true;
  }

  /**
   * Apply v2 features
   */
  applyV2Features(req, res) {
    // Enable all modern features
    req.realTimeUpdates = true;
    req.aiInsights = true;
    req.graphqlSupport = true;
  }

  /**
   * Transform response data for v1 compatibility
   */
  transformResponseForV1(data) {
    if (Array.isArray(data)) {
      return data.map(item => this.transformResponseForV1(item));
    }

    if (data && typeof data === 'object') {
      const transformed = {};

      Object.keys(data).forEach(key => {
        // Map new field names to old ones
        const mappedKey = this.getV1FieldMapping(key);
        transformed[mappedKey] = this.transformResponseForV1(data[key]);
      });

      return transformed;
    }

    return data;
  }

  /**
   * Get field mapping for v1 compatibility
   */
  getV1FieldMapping(fieldName) {
    const fieldMappings = {
      'userId': 'user_id',
      'createdAt': 'created_at',
      'updatedAt': 'updated_at',
      'taxAmount': 'tax_amount',
      'grossIncome': 'gross_income',
      'netIncome': 'net_income'
    };

    return fieldMappings[fieldName] || fieldName;
  }

  /**
   * Get API information
   */
  getApiInfo() {
    return {
      currentVersion: this.defaultVersion,
      supportedVersions: this.supportedVersions,
      deprecatedVersions: Object.entries(this.compatibilityMatrix)
        .filter(([, config]) => config.deprecated)
        .map(([version, config]) => ({
          version,
          sunsetDate: config.sunsetDate
        })),
      versioningMethods: [
        'URL path (/api/v1/, /api/v2/)',
        'Accept header (application/vnd.globaltaxcalc.v2+json)',
        'X-API-Version header',
        'Query parameter (?version=2.0)'
      ]
    };
  }
}

// Create singleton instance
let versionManagerInstance;

function createVersionManager() {
  if (!versionManagerInstance) {
    versionManagerInstance = new APIVersionManager();
  }
  return versionManagerInstance;
}

module.exports = {
  APIVersionManager,
  createVersionManager
};