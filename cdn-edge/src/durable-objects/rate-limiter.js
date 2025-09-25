/**
 * Rate Limiter Durable Object
 * Distributed rate limiting across edge locations
 */

export class RateLimiter {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.limiters = new Map();
  }

  async fetch(request) {
    try {
      const url = new URL(request.url);

      if (url.pathname === '/check' && request.method === 'POST') {
        return await this.checkRateLimit(request);
      }

      if (url.pathname === '/reset' && request.method === 'POST') {
        return await this.resetRateLimit(request);
      }

      if (url.pathname === '/stats' && request.method === 'GET') {
        return await this.getStats();
      }

      return new Response('Not Found', { status: 404 });

    } catch (error) {
      console.error('Rate limiter error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  async checkRateLimit(request) {
    const { key, limit, window } = await request.json();

    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - window;

    // Get existing limiter data
    let limiterData = await this.state.storage.get(key);

    if (!limiterData) {
      limiterData = {
        requests: [],
        totalRequests: 0,
        firstRequest: now,
        lastRequest: now
      };
    }

    // Remove old requests outside the window
    limiterData.requests = limiterData.requests.filter(timestamp => timestamp > windowStart);

    // Check if limit is exceeded
    if (limiterData.requests.length >= limit) {
      const oldestRequest = Math.min(...limiterData.requests);
      const retryAfter = oldestRequest + window - now;

      return new Response(JSON.stringify({
        limited: true,
        remaining: 0,
        retryAfter: Math.max(retryAfter, 1),
        resetTime: (oldestRequest + window) * 1000,
        totalRequests: limiterData.totalRequests
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Add current request
    limiterData.requests.push(now);
    limiterData.totalRequests++;
    limiterData.lastRequest = now;

    // Store updated data
    await this.state.storage.put(key, limiterData);

    return new Response(JSON.stringify({
      limited: false,
      remaining: limit - limiterData.requests.length,
      retryAfter: 0,
      resetTime: (now + window) * 1000,
      totalRequests: limiterData.totalRequests
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async resetRateLimit(request) {
    const { key } = await request.json();

    await this.state.storage.delete(key);

    return new Response(JSON.stringify({
      success: true,
      message: `Rate limit reset for key: ${key}`
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async getStats() {
    const keys = await this.state.storage.list();
    const stats = {
      totalKeys: keys.size,
      activeKeys: 0,
      totalRequests: 0,
      keyStats: []
    };

    for (const [key, data] of keys) {
      if (data.requests && data.requests.length > 0) {
        stats.activeKeys++;
      }

      stats.totalRequests += data.totalRequests || 0;

      stats.keyStats.push({
        key: key,
        currentRequests: data.requests ? data.requests.length : 0,
        totalRequests: data.totalRequests || 0,
        firstRequest: data.firstRequest,
        lastRequest: data.lastRequest
      });
    }

    // Sort by most active
    stats.keyStats.sort((a, b) => b.currentRequests - a.currentRequests);
    stats.keyStats = stats.keyStats.slice(0, 100); // Limit to top 100

    return new Response(JSON.stringify(stats), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async alarm() {
    // Cleanup old data periodically
    const keys = await this.state.storage.list();
    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - (24 * 60 * 60); // 24 hours ago

    let deletedKeys = 0;

    for (const [key, data] of keys) {
      // Delete keys with no recent activity
      if (data.lastRequest && data.lastRequest < cutoff) {
        await this.state.storage.delete(key);
        deletedKeys++;
      }
    }

    console.log(`Rate limiter cleanup: deleted ${deletedKeys} old keys`);

    // Schedule next cleanup in 1 hour
    await this.state.storage.setAlarm(Date.now() + 60 * 60 * 1000);
  }
}