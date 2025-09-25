const axios = require('axios');
const crypto = require('crypto');

class CDNManager {
  constructor(options = {}) {
    this.config = {
      // Cloudflare configuration
      cloudflare: {
        zoneId: process.env.CLOUDFLARE_ZONE_ID,
        apiToken: process.env.CLOUDFLARE_API_TOKEN,
        email: process.env.CLOUDFLARE_EMAIL,
        apiKey: process.env.CLOUDFLARE_API_KEY,
        baseUrl: 'https://api.cloudflare.com/client/v4'
      },

      // AWS CloudFront configuration
      cloudfront: {
        distributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID,
        region: process.env.AWS_REGION || 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      },

      // Cache headers configuration
      cacheHeaders: {
        static: {
          'Cache-Control': 'public, max-age=31536000, immutable', // 1 year
          'Expires': new Date(Date.now() + 31536000000).toUTCString()
        },
        api: {
          'Cache-Control': 'public, max-age=300, s-maxage=600', // 5min client, 10min CDN
          'Vary': 'Accept-Encoding, Authorization'
        },
        dynamic: {
          'Cache-Control': 'public, max-age=60, s-maxage=300', // 1min client, 5min CDN
          'Vary': 'Accept-Encoding, Cookie'
        },
        private: {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      },

      // File type mappings
      fileTypes: {
        images: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico'],
        scripts: ['.js', '.mjs'],
        styles: ['.css'],
        fonts: ['.woff', '.woff2', '.ttf', '.eot'],
        documents: ['.pdf', '.doc', '.docx', '.txt'],
        media: ['.mp4', '.webm', '.mp3', '.wav']
      },

      ...options
    };

    this.initializeProviders();
  }

  /**
   * Initialize CDN providers
   */
  initializeProviders() {
    // Initialize Cloudflare client
    if (this.config.cloudflare.apiToken || this.config.cloudflare.apiKey) {
      this.cloudflareClient = axios.create({
        baseURL: this.config.cloudflare.baseUrl,
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.cloudflare.apiToken
            ? { 'Authorization': `Bearer ${this.config.cloudflare.apiToken}` }
            : {
                'X-Auth-Email': this.config.cloudflare.email,
                'X-Auth-Key': this.config.cloudflare.apiKey
              }
          )
        }
      });
    }

    // Initialize AWS CloudFront client
    if (this.config.cloudfront.distributionId) {
      this.AWS = require('aws-sdk');
      this.cloudfront = new this.AWS.CloudFront({
        region: this.config.cloudfront.region,
        accessKeyId: this.config.cloudfront.accessKeyId,
        secretAccessKey: this.config.cloudfront.secretAccessKey
      });
    }

    console.log('✅ CDN manager initialized');
  }

  /**
   * Get appropriate cache headers for content type
   */
  getCacheHeaders(contentType, isStatic = false, isPrivate = false) {
    if (isPrivate) {
      return this.config.cacheHeaders.private;
    }

    if (isStatic) {
      return this.config.cacheHeaders.static;
    }

    // Determine cache strategy based on content type
    if (contentType.includes('application/json') || contentType.includes('application/xml')) {
      return this.config.cacheHeaders.api;
    }

    return this.config.cacheHeaders.dynamic;
  }

  /**
   * Set cache headers middleware
   */
  cacheHeadersMiddleware() {
    return (req, res, next) => {
      const url = req.url;
      const isStatic = this.isStaticAsset(url);
      const isPrivate = this.isPrivateContent(req);

      // Set appropriate cache headers
      const headers = this.getCacheHeaders(
        res.get('Content-Type') || 'text/html',
        isStatic,
        isPrivate
      );

      Object.entries(headers).forEach(([key, value]) => {
        res.set(key, value);
      });

      // Add additional performance headers
      res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      });

      // Enable compression hint
      if (!isStatic) {
        res.set('Vary', 'Accept-Encoding');
      }

      next();
    };
  }

  /**
   * Check if URL is for static asset
   */
  isStaticAsset(url) {
    const allStaticExtensions = Object.values(this.config.fileTypes).flat();
    return allStaticExtensions.some(ext => url.endsWith(ext));
  }

  /**
   * Check if content should be private
   */
  isPrivateContent(req) {
    // Check for authentication
    if (req.headers.authorization || req.headers.cookie) {
      return true;
    }

    // Check for private API endpoints
    const privateEndpoints = ['/api/user', '/api/profile', '/api/admin', '/api/dashboard'];
    return privateEndpoints.some(endpoint => req.url.startsWith(endpoint));
  }

  /**
   * Purge cache from Cloudflare
   */
  async purgeCloudflareCache(urls = [], tags = []) {
    if (!this.cloudflareClient || !this.config.cloudflare.zoneId) {
      throw new Error('Cloudflare not configured');
    }

    try {
      const purgeData = {};

      if (urls.length > 0) {
        purgeData.files = urls;
      }

      if (tags.length > 0) {
        purgeData.tags = tags;
      }

      // If no specific URLs or tags, purge everything
      if (urls.length === 0 && tags.length === 0) {
        purgeData.purge_everything = true;
      }

      const response = await this.cloudflareClient.post(
        `/zones/${this.config.cloudflare.zoneId}/purge_cache`,
        purgeData
      );

      console.log('✅ Cloudflare cache purged successfully');
      return response.data;

    } catch (error) {
      console.error('Error purging Cloudflare cache:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Purge cache from CloudFront
   */
  async purgeCloudFrontCache(paths = ['/*']) {
    if (!this.cloudfront || !this.config.cloudfront.distributionId) {
      throw new Error('CloudFront not configured');
    }

    try {
      const invalidationParams = {
        DistributionId: this.config.cloudfront.distributionId,
        InvalidationBatch: {
          CallerReference: `purge-${Date.now()}`,
          Paths: {
            Quantity: paths.length,
            Items: paths
          }
        }
      };

      const result = await this.cloudfront.createInvalidation(invalidationParams).promise();

      console.log('✅ CloudFront cache invalidated successfully');
      return result;

    } catch (error) {
      console.error('Error invalidating CloudFront cache:', error);
      throw error;
    }
  }

  /**
   * Pre-warm CDN cache
   */
  async warmCache(urls, options = {}) {
    const {
      concurrency = 5,
      delay = 100,
      userAgent = 'GlobalTaxCalc-CDN-Warmer/1.0'
    } = options;

    console.log(`Starting CDN cache warming for ${urls.length} URLs...`);

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    // Process URLs in batches
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);

      const promises = batch.map(async (url) => {
        try {
          const response = await axios.get(url, {
            headers: {
              'User-Agent': userAgent,
              'Cache-Control': 'no-cache'
            },
            timeout: 30000,
            validateStatus: (status) => status < 500 // Accept 4xx as success
          });

          results.success++;
          return { url, status: response.status, cached: response.headers['cf-cache-status'] };

        } catch (error) {
          results.failed++;
          results.errors.push({ url, error: error.message });
          return { url, error: error.message };
        }
      });

      await Promise.allSettled(promises);

      // Add delay between batches
      if (i + concurrency < urls.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      console.log(`Warmed batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(urls.length / concurrency)}`);
    }

    console.log(`✅ CDN warming completed: ${results.success} success, ${results.failed} failed`);
    return results;
  }

  /**
   * Get CDN analytics from Cloudflare
   */
  async getCloudflareAnalytics(since = '2023-01-01', until = null) {
    if (!this.cloudflareClient || !this.config.cloudflare.zoneId) {
      throw new Error('Cloudflare not configured');
    }

    const endDate = until || new Date().toISOString().split('T')[0];

    try {
      const response = await this.cloudflareClient.get(
        `/zones/${this.config.cloudflare.zoneId}/analytics/dashboard`,
        {
          params: {
            since,
            until: endDate,
            continuous: true
          }
        }
      );

      return response.data.result;

    } catch (error) {
      console.error('Error fetching Cloudflare analytics:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Configure Cloudflare caching rules
   */
  async configureCloudflareRules() {
    if (!this.cloudflareClient || !this.config.cloudflare.zoneId) {
      throw new Error('Cloudflare not configured');
    }

    const rules = [
      {
        // Cache static assets
        targets: [{
          target: 'url',
          constraint: {
            operator: 'matches',
            value: '.*\\.(jpg|jpeg|png|gif|webp|css|js|woff|woff2|ttf|eot|svg|ico)$'
          }
        }],
        actions: [{
          id: 'cache_level',
          value: 'cache_everything'
        }, {
          id: 'browser_cache_ttl',
          value: 31536000 // 1 year
        }, {
          id: 'edge_cache_ttl',
          value: 31536000 // 1 year
        }]
      },
      {
        // Cache API responses
        targets: [{
          target: 'url',
          constraint: {
            operator: 'matches',
            value: '.*/api/.*'
          }
        }],
        actions: [{
          id: 'cache_level',
          value: 'cache_everything'
        }, {
          id: 'browser_cache_ttl',
          value: 300 // 5 minutes
        }, {
          id: 'edge_cache_ttl',
          value: 600 // 10 minutes
        }]
      }
    ];

    try {
      for (const rule of rules) {
        await this.cloudflareClient.post(
          `/zones/${this.config.cloudflare.zoneId}/pagerules`,
          rule
        );
      }

      console.log('✅ Cloudflare caching rules configured');

    } catch (error) {
      console.error('Error configuring Cloudflare rules:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Generate cache tags for content
   */
  generateCacheTags(contentType, identifier, dependencies = []) {
    const tags = [`type:${contentType}`];

    if (identifier) {
      tags.push(`id:${identifier}`);
    }

    dependencies.forEach(dep => {
      tags.push(`dep:${dep}`);
    });

    return tags;
  }

  /**
   * Set cache tags header
   */
  setCacheTagsHeader(res, tags) {
    if (tags && tags.length > 0) {
      res.set('Cache-Tag', tags.join(','));
    }
  }

  /**
   * Get cache performance metrics
   */
  async getCacheMetrics() {
    const metrics = {
      cloudflare: null,
      cloudfront: null,
      headers: this.config.cacheHeaders
    };

    // Get Cloudflare metrics
    if (this.cloudflareClient) {
      try {
        const analytics = await this.getCloudflareAnalytics();
        metrics.cloudflare = {
          requests: analytics.totals.requests.all,
          bandwidth: analytics.totals.bandwidth.all,
          cached: analytics.totals.requests.cached,
          cacheRatio: analytics.totals.requests.cached / analytics.totals.requests.all * 100
        };
      } catch (error) {
        console.error('Error fetching Cloudflare metrics:', error);
      }
    }

    return metrics;
  }

  /**
   * Optimize images for CDN delivery
   */
  async optimizeImageDelivery(imagePath, options = {}) {
    const {
      quality = 85,
      format = 'webp',
      width,
      height,
      progressive = true
    } = options;

    // Generate optimized image URL with transformation parameters
    const params = new URLSearchParams();

    if (quality !== 85) params.append('quality', quality);
    if (format !== 'auto') params.append('format', format);
    if (width) params.append('width', width);
    if (height) params.append('height', height);
    if (progressive) params.append('progressive', 'true');

    const optimizedUrl = params.toString()
      ? `${imagePath}?${params.toString()}`
      : imagePath;

    return {
      originalUrl: imagePath,
      optimizedUrl,
      transformations: Object.fromEntries(params)
    };
  }
}

module.exports = CDNManager;