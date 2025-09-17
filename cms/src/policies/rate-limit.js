module.exports = (policyContext, config, { strapi }) => {
  return async (ctx, next) => {
    const { max = 100, window = 3600000 } = config; // Default: 100 requests per hour
    const key = `rate_limit:${ctx.ip}:${ctx.path}`;

    try {
      // Get current count from cache (you'd typically use Redis in production)
      const current = await strapi.cache?.get(key) || 0;

      if (current >= max) {
        ctx.status = 429;
        ctx.body = {
          error: {
            status: 429,
            name: 'TooManyRequestsError',
            message: 'Rate limit exceeded. Please try again later.',
            details: {
              max,
              window: window / 1000, // Convert to seconds
              resetTime: new Date(Date.now() + window).toISOString()
            }
          }
        };
        return;
      }

      // Increment counter
      await strapi.cache?.set(key, current + 1, { ttl: window / 1000 });

      // Add rate limit headers
      ctx.set('X-RateLimit-Limit', max);
      ctx.set('X-RateLimit-Remaining', Math.max(0, max - current - 1));
      ctx.set('X-RateLimit-Reset', new Date(Date.now() + window).toISOString());

      await next();
    } catch (error) {
      strapi.log.error('Rate limiting error:', error);
      await next(); // Continue on error
    }
  };
};