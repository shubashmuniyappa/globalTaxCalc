const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('redis');
const config = require('../config');

let redisClient;
if (config.REDIS_URL) {
  redisClient = redis.createClient({ url: config.REDIS_URL });
  redisClient.on('error', (err) => console.error('Redis client error:', err));
}

const createRateLimiter = (options) => {
  const limiterConfig = {
    windowMs: options.windowMs,
    max: options.max,
    message: {
      success: false,
      message: options.message || 'Too many requests, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    skipFailedRequests: options.skipFailedRequests || false
  };

  if (redisClient) {
    limiterConfig.store = new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args)
    });
  }

  if (options.keyGenerator) {
    limiterConfig.keyGenerator = options.keyGenerator;
  }

  return rateLimit(limiterConfig);
};

const rateLimiters = {
  // General API rate limiting
  general: createRateLimiter({
    windowMs: config.RATE_LIMIT_WINDOW,
    max: config.RATE_LIMIT_MAX,
    message: 'Too many requests from this IP, please try again later'
  }),

  // Authentication endpoints (more restrictive)
  auth: createRateLimiter({
    windowMs: config.AUTH_RATE_LIMIT_WINDOW,
    max: config.AUTH_RATE_LIMIT_MAX,
    message: 'Too many authentication attempts, please try again later',
    skipSuccessfulRequests: true
  }),

  // Password reset (very restrictive)
  passwordReset: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: 'Too many password reset requests, please try again in an hour',
    keyGenerator: (req) => {
      return req.body.email || req.ip;
    }
  }),

  // Email verification resend
  emailVerification: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3,
    message: 'Too many email verification requests, please try again later',
    keyGenerator: (req) => {
      return req.user?.email || req.ip;
    }
  }),

  // Two-factor authentication
  twoFactor: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: 'Too many two-factor authentication attempts, please try again later',
    keyGenerator: (req) => {
      return req.user?.id || req.ip;
    },
    skipSuccessfulRequests: true
  }),

  // Registration
  registration: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: 'Too many registration attempts, please try again in an hour'
  }),

  // Login attempts (per IP)
  loginByIP: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: 'Too many login attempts from this IP, please try again later',
    skipSuccessfulRequests: true
  }),

  // Login attempts (per email)
  loginByEmail: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: 'Too many login attempts for this email, please try again later',
    keyGenerator: (req) => {
      return req.body.email || req.ip;
    },
    skipSuccessfulRequests: true
  }),

  // Admin endpoints
  admin: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many admin requests, please try again later',
    keyGenerator: (req) => {
      return req.user?.id || req.ip;
    }
  }),

  // User profile updates
  profileUpdate: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: 'Too many profile update requests, please try again later',
    keyGenerator: (req) => {
      return req.user?.id || req.ip;
    }
  }),

  // Guest session creation
  guestSession: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: 'Too many guest session requests, please try again later'
  })
};

// Middleware to apply multiple rate limiters
const applyMultipleRateLimiters = (...limiters) => {
  return (req, res, next) => {
    let index = 0;

    const applyNext = () => {
      if (index >= limiters.length) {
        return next();
      }

      const limiter = limiters[index++];
      limiter(req, res, (err) => {
        if (err) {
          return next(err);
        }
        applyNext();
      });
    };

    applyNext();
  };
};

// Custom rate limiter based on user subscription
const subscriptionBasedRateLimit = (limits) => {
  return (req, res, next) => {
    const user = req.user;
    let maxRequests = limits.guest || 10;

    if (user) {
      const subscriptionStatus = user.subscriptionStatus;
      maxRequests = limits[subscriptionStatus] || limits.free || 50;
    }

    const limiter = createRateLimiter({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: maxRequests,
      message: 'Rate limit exceeded for your subscription tier',
      keyGenerator: (req) => {
        return user ? `user:${user.id}` : `ip:${req.ip}`;
      }
    });

    limiter(req, res, next);
  };
};

module.exports = {
  rateLimiters,
  applyMultipleRateLimiters,
  subscriptionBasedRateLimit,
  createRateLimiter
};