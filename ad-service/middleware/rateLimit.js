const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');
const config = require('../config');

// Create Redis client for rate limiting
const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: config.redis.sessionDb
});

// Strict rate limiting for sensitive operations
const rateLimitStrict = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
  }),
  windowMs: config.rateLimit.windowMs, // 15 minutes default
  max: config.rateLimit.strictMax, // 100 requests per window
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.floor(config.rateLimit.windowMs / 1000 / 60) + ' minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Rate limit exceeded for ad service operations',
      retryAfter: Math.floor(config.rateLimit.windowMs / 1000)
    });
  }
});

// Moderate rate limiting for general API usage
const rateLimitModerate = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
  }),
  windowMs: config.rateLimit.windowMs,
  max: Math.floor(config.rateLimit.maxRequests / 2), // 500 requests per window
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.floor(config.rateLimit.windowMs / 1000 / 60) + ' minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
  }
});

// Lenient rate limiting for public endpoints
const rateLimitLenient = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
  }),
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests, // 1000 requests per window
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.floor(config.rateLimit.windowMs / 1000 / 60) + ' minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
  }
});

// Ad impression rate limiting to prevent spam
const impressionRateLimit = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 impressions per minute per IP/user
  message: {
    success: false,
    message: 'Impression rate limit exceeded',
    retryAfter: '1 minute'
  },
  keyGenerator: (req) => {
    return `impression:${req.user ? req.user.id : req.ip}`;
  },
  skip: (req) => {
    // Skip rate limiting for trusted networks
    const trustedIPs = ['127.0.0.1', '::1'];
    return trustedIPs.includes(req.ip);
  }
});

module.exports = {
  rateLimitStrict,
  rateLimitModerate,
  rateLimitLenient,
  impressionRateLimit
};