/**
 * Advanced Rate Limiting Middleware
 * Implements sophisticated rate limiting with Redis backing for distributed systems
 */

const Redis = require('ioredis');
const { RateLimiterRedis, RateLimiterMemory } = require('rate-limiter-flexible');
const winston = require('winston');

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/rate-limiter.log' })
  ]
});

class AdvancedRateLimiter {
  constructor(redisClient) {
    this.redisClient = redisClient || new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 3
    });

    // User tier configurations
    this.userTiers = {
      free: {
        points: 100,        // Number of requests
        duration: 3600,     // Per hour
        blockDuration: 300  // Block for 5 minutes when exceeded
      },
      basic: {
        points: 500,
        duration: 3600,
        blockDuration: 180
      },
      premium: {
        points: 2000,
        duration: 3600,
        blockDuration: 60
      },
      enterprise: {
        points: 10000,
        duration: 3600,
        blockDuration: 30
      }
    };

    // Endpoint-specific rate limits
    this.endpointLimits = {
      '/api/v1/auth/login': {
        points: 5,
        duration: 900,      // 15 minutes
        blockDuration: 900
      },
      '/api/v1/auth/register': {
        points: 3,
        duration: 3600,
        blockDuration: 3600
      },
      '/api/v1/calculate': {
        points: 50,
        duration: 60,
        blockDuration: 120
      },
      '/api/v1/reports': {
        points: 10,
        duration: 300,
        blockDuration: 600
      },
      '/api/v1/export': {
        points: 5,
        duration: 3600,
        blockDuration: 1800
      }
    };

    // Initialize rate limiters
    this.initializeRateLimiters();

    // IP whitelist and blacklist
    this.ipWhitelist = new Set(process.env.IP_WHITELIST?.split(',') || []);
    this.ipBlacklist = new Set(process.env.IP_BLACKLIST?.split(',') || []);

    // Track rate limit violations
    this.violations = new Map();
  }

  initializeRateLimiters() {
    this.limiters = {};

    // Create user tier limiters
    Object.entries(this.userTiers).forEach(([tier, config]) => {
      this.limiters[`user_${tier}`] = new RateLimiterRedis({
        storeClient: this.redisClient,
        keyPrefix: `rl:user:${tier}`,
        points: config.points,
        duration: config.duration,
        blockDuration: config.blockDuration,
        execEvenly: true // Spread requests evenly
      });
    });

    // Create endpoint-specific limiters
    Object.entries(this.endpointLimits).forEach(([endpoint, config]) => {
      const endpointKey = endpoint.replace(/\//g, '_');
      this.limiters[`endpoint${endpointKey}`] = new RateLimiterRedis({
        storeClient: this.redisClient,
        keyPrefix: `rl:endpoint:${endpointKey}`,
        points: config.points,
        duration: config.duration,
        blockDuration: config.blockDuration
      });
    });

    // Create IP-based limiter
    this.limiters.ip = new RateLimiterRedis({
      storeClient: this.redisClient,
      keyPrefix: 'rl:ip',
      points: 1000,
      duration: 3600,
      blockDuration: 3600
    });

    // Create sliding window limiter for more accurate rate limiting
    this.limiters.slidingWindow = new RateLimiterRedis({
      storeClient: this.redisClient,
      keyPrefix: 'rl:sliding',
      points: 100,
      duration: 60,
      execEvenly: true
    });

    // Create progressive penalty limiter for repeat offenders
    this.limiters.penalty = new RateLimiterRedis({
      storeClient: this.redisClient,
      keyPrefix: 'rl:penalty',
      points: 1,
      duration: 86400, // 24 hours
      blockDuration: 86400
    });
  }

  /**
   * Main rate limiting middleware
   */
  middleware() {
    return async (req, res, next) => {
      try {
        const clientIp = this.getClientIp(req);
        const userId = req.user?.id;
        const userTier = req.user?.tier || 'free';
        const endpoint = req.route?.path || req.path;

        // Check IP whitelist
        if (this.ipWhitelist.has(clientIp)) {
          return next();
        }

        // Check IP blacklist
        if (this.ipBlacklist.has(clientIp)) {
          return this.sendRateLimitResponse(res, 'IP Blocked', 403);
        }

        // Check for repeat offenders
        const penaltyKey = `${clientIp}:violations`;
        const violations = await this.getViolationCount(penaltyKey);
        if (violations > 10) {
          await this.limiters.penalty.consume(penaltyKey);
          return this.sendRateLimitResponse(res, 'Too many violations', 429);
        }

        // Apply multiple rate limiting strategies
        const rateLimitChecks = [];

        // 1. IP-based rate limiting
        rateLimitChecks.push(this.checkIpRateLimit(clientIp));

        // 2. User-based rate limiting (if authenticated)
        if (userId) {
          rateLimitChecks.push(this.checkUserRateLimit(userId, userTier));
        }

        // 3. Endpoint-specific rate limiting
        if (this.endpointLimits[endpoint]) {
          rateLimitChecks.push(this.checkEndpointRateLimit(endpoint, clientIp, userId));
        }

        // 4. Sliding window rate limiting
        rateLimitChecks.push(this.checkSlidingWindowLimit(clientIp));

        // Execute all checks in parallel
        const results = await Promise.allSettled(rateLimitChecks);

        // Check if any rate limit was exceeded
        for (const result of results) {
          if (result.status === 'rejected') {
            const error = result.reason;

            // Track violation
            await this.trackViolation(penaltyKey);

            // Log the rate limit violation
            logger.warn('Rate limit exceeded', {
              ip: clientIp,
              userId,
              endpoint,
              remaining: error.remainingPoints || 0,
              resetTime: new Date(error.msBeforeNext + Date.now())
            });

            return this.sendRateLimitResponse(
              res,
              'Rate limit exceeded',
              429,
              error.remainingPoints,
              error.msBeforeNext
            );
          }
        }

        // Add rate limit headers to successful requests
        const rateLimitInfo = results[0].value;
        if (rateLimitInfo) {
          res.set({
            'X-RateLimit-Limit': rateLimitInfo.totalPoints,
            'X-RateLimit-Remaining': rateLimitInfo.remainingPoints,
            'X-RateLimit-Reset': new Date(Date.now() + rateLimitInfo.msBeforeNext).toISOString()
          });
        }

        next();
      } catch (error) {
        logger.error('Rate limiter error', error);
        // Fail open - allow request if rate limiter fails
        next();
      }
    };
  }

  /**
   * Check IP-based rate limit
   */
  async checkIpRateLimit(ip) {
    return await this.limiters.ip.consume(ip);
  }

  /**
   * Check user-based rate limit
   */
  async checkUserRateLimit(userId, tier) {
    const limiter = this.limiters[`user_${tier}`];
    if (!limiter) {
      throw new Error(`Invalid user tier: ${tier}`);
    }
    return await limiter.consume(userId);
  }

  /**
   * Check endpoint-specific rate limit
   */
  async checkEndpointRateLimit(endpoint, ip, userId) {
    const endpointKey = endpoint.replace(/\//g, '_');
    const limiter = this.limiters[`endpoint${endpointKey}`];
    if (!limiter) {
      return null;
    }
    const key = userId || ip;
    return await limiter.consume(key);
  }

  /**
   * Check sliding window rate limit
   */
  async checkSlidingWindowLimit(ip) {
    return await this.limiters.slidingWindow.consume(ip);
  }

  /**
   * Track rate limit violations
   */
  async trackViolation(key) {
    const currentCount = await this.redisClient.incr(`violations:${key}`);
    await this.redisClient.expire(`violations:${key}`, 86400); // Expire after 24 hours
    return currentCount;
  }

  /**
   * Get violation count
   */
  async getViolationCount(key) {
    const count = await this.redisClient.get(`violations:${key}`);
    return parseInt(count || '0', 10);
  }

  /**
   * Send rate limit response
   */
  sendRateLimitResponse(res, message, statusCode = 429, remaining = 0, resetTime = 0) {
    res.status(statusCode).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message,
        retryAfter: Math.round(resetTime / 1000),
        remaining
      }
    });
  }

  /**
   * Get client IP address
   */
  getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
           req.headers['x-real-ip'] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           req.ip;
  }

  /**
   * Dynamic rate limit adjustment based on system load
   */
  async adjustRateLimits(systemLoad) {
    if (systemLoad > 0.8) {
      // Reduce rate limits by 50% when system is under high load
      Object.values(this.limiters).forEach(limiter => {
        if (limiter.points) {
          limiter.points = Math.floor(limiter.points * 0.5);
        }
      });
      logger.info('Rate limits reduced due to high system load');
    } else if (systemLoad < 0.3) {
      // Restore original rate limits when load is normal
      this.initializeRateLimiters();
      logger.info('Rate limits restored to normal');
    }
  }

  /**
   * Reset rate limit for a specific key
   */
  async resetRateLimit(key, limiterType = 'ip') {
    const limiter = this.limiters[limiterType];
    if (limiter) {
      await limiter.delete(key);
      logger.info(`Rate limit reset for ${key} in ${limiterType}`);
    }
  }

  /**
   * Get current rate limit status for a key
   */
  async getRateLimitStatus(key, limiterType = 'ip') {
    const limiter = this.limiters[limiterType];
    if (limiter) {
      const result = await limiter.get(key);
      return {
        consumedPoints: result?.consumedPoints || 0,
        remainingPoints: result ? limiter.points - result.consumedPoints : limiter.points,
        msBeforeNext: result?.msBeforeNext || 0
      };
    }
    return null;
  }

  /**
   * Add IP to whitelist
   */
  addToWhitelist(ip) {
    this.ipWhitelist.add(ip);
    logger.info(`IP ${ip} added to whitelist`);
  }

  /**
   * Add IP to blacklist
   */
  addToBlacklist(ip) {
    this.ipBlacklist.add(ip);
    logger.info(`IP ${ip} added to blacklist`);
  }

  /**
   * Remove IP from whitelist
   */
  removeFromWhitelist(ip) {
    this.ipWhitelist.delete(ip);
    logger.info(`IP ${ip} removed from whitelist`);
  }

  /**
   * Remove IP from blacklist
   */
  removeFromBlacklist(ip) {
    this.ipBlacklist.delete(ip);
    logger.info(`IP ${ip} removed from blacklist`);
  }

  /**
   * Clean up expired entries (maintenance task)
   */
  async cleanup() {
    try {
      const keys = await this.redisClient.keys('rl:*');
      let cleaned = 0;

      for (const key of keys) {
        const ttl = await this.redisClient.ttl(key);
        if (ttl === -1) {
          // Key exists but has no TTL, set one
          await this.redisClient.expire(key, 3600);
          cleaned++;
        }
      }

      logger.info(`Cleaned up ${cleaned} rate limit entries`);
    } catch (error) {
      logger.error('Error during rate limit cleanup', error);
    }
  }
}

// Create singleton instance
let rateLimiterInstance;

function createRateLimiter(redisClient) {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new AdvancedRateLimiter(redisClient);
  }
  return rateLimiterInstance;
}

module.exports = {
  AdvancedRateLimiter,
  createRateLimiter
};