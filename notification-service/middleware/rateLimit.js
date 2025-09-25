const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');
const config = require('../config');

// Create Redis client for rate limiting
const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: config.redis.rateLimitDb || 2
});

// Strict rate limiting for sensitive operations
const rateLimitStrict = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return req.user ? req.user.id : req.ip;
  }
});

// Moderate rate limiting for general API usage
const rateLimitModerate = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user ? req.user.id : req.ip;
  }
});

// Lenient rate limiting for public endpoints
const rateLimitLenient = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user ? req.user.id : req.ip;
  }
});

// Email-specific rate limiting to prevent spam
const emailRateLimit = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit to 50 emails per hour per user
  message: {
    success: false,
    message: 'Email rate limit exceeded. Please try again later.',
    retryAfter: '1 hour'
  },
  keyGenerator: (req) => {
    return `email:${req.user ? req.user.id : req.ip}`;
  },
  skip: (req) => {
    // Skip rate limiting for admin users
    return req.user && req.user.role === 'admin';
  }
});

// Campaign rate limiting
const campaignRateLimit = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
  }),
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5, // Limit to 5 campaigns per day
  message: {
    success: false,
    message: 'Campaign rate limit exceeded. Maximum 5 campaigns per day.',
    retryAfter: '24 hours'
  },
  keyGenerator: (req) => {
    return `campaign:${req.user ? req.user.id : req.ip}`;
  },
  skip: (req) => {
    return req.user && req.user.role === 'admin';
  }
});

module.exports = {
  rateLimitStrict,
  rateLimitModerate,
  rateLimitLenient,
  emailRateLimit,
  campaignRateLimit
};