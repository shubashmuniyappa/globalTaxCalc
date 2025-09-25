const redis = require('redis');
const config = require('../config');
const logger = require('./logger');

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = redis.createClient({
        url: config.redis.url,
        socket: {
          host: config.redis.host,
          port: config.redis.port
        },
        password: config.redis.password,
        database: config.redis.db,
        retry_unfulfilled_commands: true,
        retry_delay_on_cluster_down: 300,
        retry_delay_on_failover: 100,
        max_attempts: 3
      });

      this.client.on('error', (err) => {
        logger.error('Redis client error:', err);
      });

      this.client.on('connect', () => {
        logger.info('Connected to Redis');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        logger.warn('Disconnected from Redis');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
      this.isConnected = false;
      logger.info('Disconnected from Redis');
    }
  }

  // Session management
  async setSession(sessionId, sessionData, ttl = config.analytics.sessionTimeout) {
    try {
      const key = `session:${sessionId}`;
      await this.client.setEx(key, ttl, JSON.stringify(sessionData));
    } catch (error) {
      logger.error('Error setting session in Redis:', error);
      throw error;
    }
  }

  async getSession(sessionId) {
    try {
      const key = `session:${sessionId}`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Error getting session from Redis:', error);
      return null;
    }
  }

  async updateSession(sessionId, updates, ttl = config.analytics.sessionTimeout) {
    try {
      const session = await this.getSession(sessionId);
      if (session) {
        const updatedSession = { ...session, ...updates, lastActivity: new Date().toISOString() };
        await this.setSession(sessionId, updatedSession, ttl);
        return updatedSession;
      }
      return null;
    } catch (error) {
      logger.error('Error updating session in Redis:', error);
      throw error;
    }
  }

  async deleteSession(sessionId) {
    try {
      const key = `session:${sessionId}`;
      await this.client.del(key);
    } catch (error) {
      logger.error('Error deleting session from Redis:', error);
      throw error;
    }
  }

  // A/B Testing experiment assignments
  async setExperimentAssignment(userId, experimentId, variant, ttl = 86400 * 30) { // 30 days
    try {
      const key = `experiment:${experimentId}:${userId}`;
      await this.client.setEx(key, ttl, variant);
    } catch (error) {
      logger.error('Error setting experiment assignment in Redis:', error);
      throw error;
    }
  }

  async getExperimentAssignment(userId, experimentId) {
    try {
      const key = `experiment:${experimentId}:${userId}`;
      return await this.client.get(key);
    } catch (error) {
      logger.error('Error getting experiment assignment from Redis:', error);
      return null;
    }
  }

  // Caching for analytics data
  async setCache(key, data, ttl = 300) { // 5 minutes default
    try {
      const cacheKey = `cache:${key}`;
      await this.client.setEx(cacheKey, ttl, JSON.stringify(data));
    } catch (error) {
      logger.error('Error setting cache in Redis:', error);
      throw error;
    }
  }

  async getCache(key) {
    try {
      const cacheKey = `cache:${key}`;
      const data = await this.client.get(cacheKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Error getting cache from Redis:', error);
      return null;
    }
  }

  async deleteCache(pattern) {
    try {
      const keys = await this.client.keys(`cache:${pattern}`);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      logger.error('Error deleting cache from Redis:', error);
      throw error;
    }
  }

  // Rate limiting
  async checkRateLimit(key, limit, windowMs) {
    try {
      const currentCount = await this.client.incr(`rate_limit:${key}`);
      if (currentCount === 1) {
        await this.client.expire(`rate_limit:${key}`, Math.ceil(windowMs / 1000));
      }
      return {
        count: currentCount,
        remaining: Math.max(0, limit - currentCount),
        resetTime: Date.now() + windowMs
      };
    } catch (error) {
      logger.error('Error checking rate limit in Redis:', error);
      throw error;
    }
  }

  // Real-time counters
  async incrementCounter(key, amount = 1, ttl = 3600) { // 1 hour default
    try {
      const counterKey = `counter:${key}`;
      const newValue = await this.client.incrBy(counterKey, amount);
      await this.client.expire(counterKey, ttl);
      return newValue;
    } catch (error) {
      logger.error('Error incrementing counter in Redis:', error);
      throw error;
    }
  }

  async getCounter(key) {
    try {
      const counterKey = `counter:${key}`;
      const value = await this.client.get(counterKey);
      return value ? parseInt(value) : 0;
    } catch (error) {
      logger.error('Error getting counter from Redis:', error);
      return 0;
    }
  }

  // Health check
  async healthCheck() {
    try {
      await this.client.ping();
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
    }
  }

  // Get Redis info
  async getInfo() {
    try {
      const info = await this.client.info();
      return info;
    } catch (error) {
      logger.error('Error getting Redis info:', error);
      throw error;
    }
  }
}

// Singleton instance
const redisClient = new RedisClient();

module.exports = redisClient;