const Redis = require('ioredis');

class RedisConnection {
  constructor() {
    this.client = null;
  }

  connect() {
    if (!this.client) {
      this.client = new Redis(process.env.REDIS_URL, {
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: null,
      });

      this.client.on('error', (err) => {
        console.error('Redis connection error:', err);
      });

      this.client.on('connect', () => {
        console.log('Connected to Redis');
      });
    }

    return this.client;
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }

  async set(key, value, ttl = null) {
    const client = this.connect();
    if (ttl) {
      return client.setex(key, ttl, JSON.stringify(value));
    }
    return client.set(key, JSON.stringify(value));
  }

  async get(key) {
    const client = this.connect();
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  }

  async del(key) {
    const client = this.connect();
    return client.del(key);
  }

  async exists(key) {
    const client = this.connect();
    return client.exists(key);
  }
}

module.exports = new RedisConnection();