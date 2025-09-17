const Redis = require('ioredis');
const config = require('../config');
const logger = require('./logger');

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  /**
   * Initialize Redis connection
   */
  connect() {
    if (this.client && this.isConnected) {
      return this.client;
    }

    try {
      this.client = new Redis(config.REDIS_URL, {
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: 3,
        connectTimeout: 10000,
        lazyConnect: true,
        family: 4, // IPv4
        keepAlive: 30000,
        retryDelayOnClusterDown: 300,
        retryDelayOnTimeout: 100,
        maxRetriesPerRequest: null
      });

      // Connection events
      this.client.on('connect', () => {
        logger.info('Redis client connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.client.on('ready', () => {
        logger.info('Redis client ready');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        logger.error('Redis connection error:', {
          error: err.message,
          code: err.code,
          errno: err.errno
        });
        this.isConnected = false;
      });

      this.client.on('close', () => {
        logger.warn('Redis connection closed');
        this.isConnected = false;
      });

      this.client.on('reconnecting', (time) => {
        this.reconnectAttempts++;
        logger.info(`Redis reconnecting... Attempt ${this.reconnectAttempts}, delay: ${time}ms`);

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          logger.error('Max Redis reconnection attempts reached, giving up');
          this.client.disconnect();
        }
      });

      // Connect to Redis
      this.client.connect();

      return this.client;
    } catch (error) {
      logger.error('Failed to create Redis client:', error.message);
      throw error;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
      logger.info('Redis client disconnected');
    }
  }

  /**
   * Check if Redis is connected
   */
  isReady() {
    return this.client && this.isConnected;
  }

  /**
   * Execute Redis command with error handling
   */
  async executeCommand(command, ...args) {
    if (!this.isReady()) {
      throw new Error('Redis client not ready');
    }

    try {
      return await this.client[command](...args);
    } catch (error) {
      logger.error(`Redis ${command} command failed:`, {
        error: error.message,
        args: args
      });
      throw error;
    }
  }

  // Basic Redis operations with error handling

  /**
   * Set a key-value pair
   */
  async set(key, value, ttl = null) {
    const serializedValue = typeof value === 'object' ? JSON.stringify(value) : value.toString();

    if (ttl) {
      return this.executeCommand('setex', key, ttl, serializedValue);
    }
    return this.executeCommand('set', key, serializedValue);
  }

  /**
   * Get a value by key
   */
  async get(key) {
    try {
      const value = await this.executeCommand('get', key);
      if (value === null) return null;

      // Try to parse as JSON, fallback to string
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      logger.warn(`Redis GET failed for key ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Delete a key
   */
  async del(key) {
    return this.executeCommand('del', key);
  }

  /**
   * Check if key exists
   */
  async exists(key) {
    return this.executeCommand('exists', key);
  }

  /**
   * Set expiration for a key
   */
  async expire(key, seconds) {
    return this.executeCommand('expire', key, seconds);
  }

  /**
   * Get time to live for a key
   */
  async ttl(key) {
    return this.executeCommand('ttl', key);
  }

  /**
   * Increment a counter
   */
  async incr(key) {
    return this.executeCommand('incr', key);
  }

  /**
   * Increment a counter by amount
   */
  async incrby(key, amount) {
    return this.executeCommand('incrby', key, amount);
  }

  /**
   * Add to list (left push)
   */
  async lpush(key, ...values) {
    return this.executeCommand('lpush', key, ...values);
  }

  /**
   * Add to list (right push)
   */
  async rpush(key, ...values) {
    return this.executeCommand('rpush', key, ...values);
  }

  /**
   * Get list length
   */
  async llen(key) {
    return this.executeCommand('llen', key);
  }

  /**
   * Get range from list
   */
  async lrange(key, start, stop) {
    return this.executeCommand('lrange', key, start, stop);
  }

  /**
   * Add to set
   */
  async sadd(key, ...members) {
    return this.executeCommand('sadd', key, ...members);
  }

  /**
   * Check if member is in set
   */
  async sismember(key, member) {
    return this.executeCommand('sismember', key, member);
  }

  /**
   * Get all members from set
   */
  async smembers(key) {
    return this.executeCommand('smembers', key);
  }

  /**
   * Hash operations
   */
  async hset(key, field, value) {
    const serializedValue = typeof value === 'object' ? JSON.stringify(value) : value.toString();
    return this.executeCommand('hset', key, field, serializedValue);
  }

  async hget(key, field) {
    try {
      const value = await this.executeCommand('hget', key, field);
      if (value === null) return null;

      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      logger.warn(`Redis HGET failed for key ${key}, field ${field}:`, error.message);
      return null;
    }
  }

  async hgetall(key) {
    try {
      const hash = await this.executeCommand('hgetall', key);
      const parsed = {};

      for (const [field, value] of Object.entries(hash)) {
        try {
          parsed[field] = JSON.parse(value);
        } catch {
          parsed[field] = value;
        }
      }

      return parsed;
    } catch (error) {
      logger.warn(`Redis HGETALL failed for key ${key}:`, error.message);
      return {};
    }
  }

  /**
   * Cache helper methods
   */
  async cacheSet(key, data, ttl = 3600) {
    try {
      await this.set(`cache:${key}`, data, ttl);
      return true;
    } catch (error) {
      logger.error(`Cache set failed for key ${key}:`, error.message);
      return false;
    }
  }

  async cacheGet(key) {
    try {
      return await this.get(`cache:${key}`);
    } catch (error) {
      logger.warn(`Cache get failed for key ${key}:`, error.message);
      return null;
    }
  }

  async cacheDel(key) {
    try {
      return await this.del(`cache:${key}`);
    } catch (error) {
      logger.warn(`Cache delete failed for key ${key}:`, error.message);
      return 0;
    }
  }

  /**
   * Session management
   */
  async setSession(sessionId, sessionData, ttl = 86400) {
    return this.set(`session:${sessionId}`, sessionData, ttl);
  }

  async getSession(sessionId) {
    return this.get(`session:${sessionId}`);
  }

  async deleteSession(sessionId) {
    return this.del(`session:${sessionId}`);
  }

  /**
   * Rate limiting helpers
   */
  async isRateLimited(key, limit, window) {
    const current = await this.get(`rate:${key}`);

    if (!current) {
      await this.set(`rate:${key}`, 1, window);
      return false;
    }

    if (parseInt(current) >= limit) {
      return true;
    }

    await this.incr(`rate:${key}`);
    return false;
  }

  /**
   * Get Redis info
   */
  async getInfo() {
    try {
      return await this.executeCommand('info');
    } catch (error) {
      logger.error('Failed to get Redis info:', error.message);
      return null;
    }
  }

  /**
   * Ping Redis server
   */
  async ping() {
    try {
      return await this.executeCommand('ping');
    } catch (error) {
      logger.error('Redis ping failed:', error.message);
      return null;
    }
  }
}

// Export singleton instance
const redisClient = new RedisClient();
redisClient.connect();

module.exports = redisClient;