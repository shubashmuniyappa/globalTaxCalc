/**
 * Advanced Rate Limiting System
 * Handles multiple rate limiting strategies for enterprise API access
 */

const Redis = require('redis');

class RateLimiting {
    constructor() {
        this.redisClient = Redis.createClient({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD
        });

        this.strategies = new Map();
        this.setupDefaultStrategies();

        this.redisClient.on('error', (err) => {
            console.error('Redis error in rate limiter:', err);
        });
    }

    setupDefaultStrategies() {
        // Token bucket strategy
        this.strategies.set('token_bucket', {
            name: 'Token Bucket',
            check: this.checkTokenBucket.bind(this),
            reset: this.resetTokenBucket.bind(this)
        });

        // Fixed window strategy
        this.strategies.set('fixed_window', {
            name: 'Fixed Window',
            check: this.checkFixedWindow.bind(this),
            reset: this.resetFixedWindow.bind(this)
        });

        // Sliding window strategy
        this.strategies.set('sliding_window', {
            name: 'Sliding Window',
            check: this.checkSlidingWindow.bind(this),
            reset: this.resetSlidingWindow.bind(this)
        });

        // Sliding window counter strategy
        this.strategies.set('sliding_window_counter', {
            name: 'Sliding Window Counter',
            check: this.checkSlidingWindowCounter.bind(this),
            reset: this.resetSlidingWindowCounter.bind(this)
        });

        // Concurrent requests strategy
        this.strategies.set('concurrent', {
            name: 'Concurrent Requests',
            check: this.checkConcurrentRequests.bind(this),
            reset: this.resetConcurrentRequests.bind(this)
        });
    }

    /**
     * Main Rate Limiting Interface
     */
    async checkRateLimit(identifier, config) {
        try {
            const strategy = this.strategies.get(config.strategy || 'token_bucket');
            if (!strategy) {
                throw new Error(`Unknown rate limiting strategy: ${config.strategy}`);
            }

            const result = await strategy.check(identifier, config);

            // Add common metadata
            result.identifier = identifier;
            result.strategy = config.strategy;
            result.timestamp = Date.now();

            return result;

        } catch (error) {
            console.error('Rate limit check error:', error);
            // Fail open - allow request if rate limiting fails
            return {
                allowed: true,
                error: error.message,
                remaining: 0,
                resetTime: Date.now() + 3600000 // 1 hour
            };
        }
    }

    async resetRateLimit(identifier, config) {
        try {
            const strategy = this.strategies.get(config.strategy || 'token_bucket');
            if (!strategy) {
                throw new Error(`Unknown rate limiting strategy: ${config.strategy}`);
            }

            return await strategy.reset(identifier, config);

        } catch (error) {
            console.error('Rate limit reset error:', error);
            throw error;
        }
    }

    /**
     * Token Bucket Strategy
     * Allows burst of requests up to bucket capacity, then refills at a steady rate
     */
    async checkTokenBucket(identifier, config) {
        const {
            capacity = 100,        // Maximum tokens in bucket
            refillRate = 10,       // Tokens per second
            tokensRequested = 1    // Tokens for this request
        } = config;

        const key = `rate_limit:token_bucket:${identifier}`;
        const now = Date.now();

        // Lua script for atomic token bucket check
        const luaScript = `
            local key = KEYS[1]
            local capacity = tonumber(ARGV[1])
            local refill_rate = tonumber(ARGV[2])
            local tokens_requested = tonumber(ARGV[3])
            local now = tonumber(ARGV[4])

            local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
            local tokens = tonumber(bucket[1]) or capacity
            local last_refill = tonumber(bucket[2]) or now

            -- Calculate tokens to add based on time elapsed
            local time_elapsed = (now - last_refill) / 1000
            local tokens_to_add = time_elapsed * refill_rate
            tokens = math.min(capacity, tokens + tokens_to_add)

            local allowed = tokens >= tokens_requested

            if allowed then
                tokens = tokens - tokens_requested
            end

            -- Update bucket state
            redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
            redis.call('EXPIRE', key, 3600) -- 1 hour TTL

            local reset_time = now + ((capacity - tokens) / refill_rate) * 1000

            return {
                allowed and 1 or 0,
                math.floor(tokens),
                math.floor(reset_time)
            }
        `;

        const result = await this.redisClient.eval(
            luaScript,
            1,
            key,
            capacity,
            refillRate,
            tokensRequested,
            now
        );

        return {
            allowed: result[0] === 1,
            remaining: result[1],
            resetTime: result[2],
            capacity: capacity,
            refillRate: refillRate
        };
    }

    async resetTokenBucket(identifier, config) {
        const key = `rate_limit:token_bucket:${identifier}`;
        await this.redisClient.del(key);
        return true;
    }

    /**
     * Fixed Window Strategy
     * Fixed time windows with request count limits
     */
    async checkFixedWindow(identifier, config) {
        const {
            windowSize = 3600,     // Window size in seconds (1 hour)
            limit = 1000          // Requests per window
        } = config;

        const now = Math.floor(Date.now() / 1000);
        const windowStart = Math.floor(now / windowSize) * windowSize;
        const key = `rate_limit:fixed_window:${identifier}:${windowStart}`;

        const luaScript = `
            local key = KEYS[1]
            local limit = tonumber(ARGV[1])
            local window_end = tonumber(ARGV[2])

            local current = redis.call('GET', key)
            if current == false then
                current = 0
            else
                current = tonumber(current)
            end

            local allowed = current < limit

            if allowed then
                current = current + 1
                redis.call('SETEX', key, window_end - tonumber(ARGV[3]), current)
            end

            return {
                allowed and 1 or 0,
                limit - current,
                window_end * 1000
            }
        `;

        const windowEnd = windowStart + windowSize;
        const result = await this.redisClient.eval(
            luaScript,
            1,
            key,
            limit,
            windowEnd,
            now
        );

        return {
            allowed: result[0] === 1,
            remaining: Math.max(0, result[1]),
            resetTime: result[2],
            windowStart: windowStart * 1000,
            windowEnd: windowEnd * 1000
        };
    }

    async resetFixedWindow(identifier, config) {
        const windowSize = config.windowSize || 3600;
        const now = Math.floor(Date.now() / 1000);
        const windowStart = Math.floor(now / windowSize) * windowSize;
        const key = `rate_limit:fixed_window:${identifier}:${windowStart}`;

        await this.redisClient.del(key);
        return true;
    }

    /**
     * Sliding Window Strategy
     * Precise sliding window using sorted sets
     */
    async checkSlidingWindow(identifier, config) {
        const {
            windowSize = 3600,     // Window size in seconds
            limit = 1000          // Requests per window
        } = config;

        const key = `rate_limit:sliding_window:${identifier}`;
        const now = Date.now();
        const windowStart = now - (windowSize * 1000);

        const luaScript = `
            local key = KEYS[1]
            local window_start = tonumber(ARGV[1])
            local limit = tonumber(ARGV[2])
            local now = tonumber(ARGV[3])
            local uuid = ARGV[4]

            -- Remove expired entries
            redis.call('ZREMRANGEBYSCORE', key, 0, window_start)

            -- Count current requests in window
            local current_count = redis.call('ZCARD', key)

            local allowed = current_count < limit

            if allowed then
                -- Add current request
                redis.call('ZADD', key, now, uuid)
                current_count = current_count + 1
            end

            -- Set expiration
            redis.call('EXPIRE', key, math.ceil(tonumber(ARGV[5])))

            return {
                allowed and 1 or 0,
                limit - current_count,
                now + (tonumber(ARGV[5]) * 1000)
            }
        `;

        const requestId = `${now}-${Math.random()}`;
        const result = await this.redisClient.eval(
            luaScript,
            1,
            key,
            windowStart,
            limit,
            now,
            requestId,
            windowSize
        );

        return {
            allowed: result[0] === 1,
            remaining: Math.max(0, result[1]),
            resetTime: result[2],
            windowSize: windowSize
        };
    }

    async resetSlidingWindow(identifier, config) {
        const key = `rate_limit:sliding_window:${identifier}`;
        await this.redisClient.del(key);
        return true;
    }

    /**
     * Sliding Window Counter Strategy
     * Approximation using fixed windows for better performance
     */
    async checkSlidingWindowCounter(identifier, config) {
        const {
            windowSize = 3600,     // Window size in seconds
            limit = 1000,         // Requests per window
            subWindows = 10       // Number of sub-windows
        } = config;

        const subWindowSize = windowSize / subWindows;
        const now = Math.floor(Date.now() / 1000);
        const currentWindow = Math.floor(now / subWindowSize);

        const keys = [];
        for (let i = 0; i < subWindows; i++) {
            const windowId = currentWindow - i;
            keys.push(`rate_limit:sliding_counter:${identifier}:${windowId}`);
        }

        const luaScript = `
            local keys = KEYS
            local limit = tonumber(ARGV[1])
            local sub_window_size = tonumber(ARGV[2])
            local now = tonumber(ARGV[3])
            local current_key = keys[1]

            -- Get counts from all sub-windows
            local total_count = 0
            for i = 1, #keys do
                local count = redis.call('GET', keys[i])
                if count then
                    total_count = total_count + tonumber(count)
                end
            end

            local allowed = total_count < limit

            if allowed then
                -- Increment current window
                local current_count = redis.call('GET', current_key)
                if current_count == false then
                    current_count = 0
                else
                    current_count = tonumber(current_count)
                end

                redis.call('SETEX', current_key, sub_window_size * 2, current_count + 1)
                total_count = total_count + 1
            end

            return {
                allowed and 1 or 0,
                limit - total_count,
                (math.floor(now / sub_window_size) + 1) * sub_window_size * 1000
            }
        `;

        const result = await this.redisClient.eval(
            luaScript,
            keys.length,
            ...keys,
            limit,
            subWindowSize,
            now
        );

        return {
            allowed: result[0] === 1,
            remaining: Math.max(0, result[1]),
            resetTime: result[2],
            subWindows: subWindows
        };
    }

    async resetSlidingWindowCounter(identifier, config) {
        const { subWindows = 10 } = config;
        const subWindowSize = (config.windowSize || 3600) / subWindows;
        const now = Math.floor(Date.now() / 1000);
        const currentWindow = Math.floor(now / subWindowSize);

        const keys = [];
        for (let i = 0; i < subWindows; i++) {
            const windowId = currentWindow - i;
            keys.push(`rate_limit:sliding_counter:${identifier}:${windowId}`);
        }

        if (keys.length > 0) {
            await this.redisClient.del(...keys);
        }
        return true;
    }

    /**
     * Concurrent Requests Strategy
     * Limits the number of concurrent requests
     */
    async checkConcurrentRequests(identifier, config) {
        const {
            maxConcurrent = 10,    // Maximum concurrent requests
            timeout = 30000       // Request timeout in milliseconds
        } = config;

        const key = `rate_limit:concurrent:${identifier}`;
        const requestId = `${Date.now()}-${Math.random()}`;
        const now = Date.now();
        const expiredTime = now - timeout;

        const luaScript = `
            local key = KEYS[1]
            local max_concurrent = tonumber(ARGV[1])
            local request_id = ARGV[2]
            local now = tonumber(ARGV[3])
            local expired_time = tonumber(ARGV[4])
            local timeout = tonumber(ARGV[5])

            -- Remove expired requests
            redis.call('ZREMRANGEBYSCORE', key, 0, expired_time)

            -- Count current concurrent requests
            local current_count = redis.call('ZCARD', key)

            local allowed = current_count < max_concurrent

            if allowed then
                -- Add current request
                redis.call('ZADD', key, now, request_id)
                current_count = current_count + 1
            end

            -- Set expiration
            redis.call('EXPIRE', key, math.ceil(timeout / 1000))

            return {
                allowed and 1 or 0,
                max_concurrent - current_count,
                request_id,
                now + timeout
            }
        `;

        const result = await this.redisClient.eval(
            luaScript,
            1,
            key,
            maxConcurrent,
            requestId,
            now,
            expiredTime,
            timeout
        );

        return {
            allowed: result[0] === 1,
            remaining: Math.max(0, result[1]),
            requestId: result[2],
            resetTime: result[3],
            maxConcurrent: maxConcurrent
        };
    }

    async releaseConcurrentRequest(identifier, requestId) {
        const key = `rate_limit:concurrent:${identifier}`;
        await this.redisClient.zrem(key, requestId);
    }

    async resetConcurrentRequests(identifier, config) {
        const key = `rate_limit:concurrent:${identifier}`;
        await this.redisClient.del(key);
        return true;
    }

    /**
     * Multi-tier Rate Limiting
     */
    async checkMultiTierLimits(identifier, configs) {
        const results = [];

        for (const config of configs) {
            const result = await this.checkRateLimit(identifier, config);
            results.push({
                tier: config.tier || 'default',
                ...result
            });

            // If any tier is exceeded, stop checking
            if (!result.allowed) {
                return {
                    allowed: false,
                    results: results,
                    exceededTier: config.tier || 'default'
                };
            }
        }

        return {
            allowed: true,
            results: results
        };
    }

    /**
     * Rate Limit Bypass
     */
    async createBypassToken(identifier, config) {
        const {
            duration = 3600,       // Bypass duration in seconds
            reason = 'manual',     // Bypass reason
            bypassedBy = 'system'  // Who created the bypass
        } = config;

        const bypassId = `bypass_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const key = `rate_limit:bypass:${identifier}`;
        const expireAt = Date.now() + (duration * 1000);

        const bypassData = {
            id: bypassId,
            identifier: identifier,
            reason: reason,
            bypassedBy: bypassedBy,
            createdAt: Date.now(),
            expiresAt: expireAt
        };

        await this.redisClient.setex(key, duration, JSON.stringify(bypassData));

        console.log(`Rate limit bypass created: ${bypassId} for ${identifier}`);
        return bypassData;
    }

    async checkBypass(identifier) {
        const key = `rate_limit:bypass:${identifier}`;
        const bypassData = await this.redisClient.get(key);

        if (bypassData) {
            return JSON.parse(bypassData);
        }

        return null;
    }

    async revokeBypass(identifier) {
        const key = `rate_limit:bypass:${identifier}`;
        await this.redisClient.del(key);
        return true;
    }

    /**
     * Rate Limiting Middleware
     */
    createMiddleware(getConfig) {
        return async (req, res, next) => {
            try {
                // Get rate limiting configuration
                const config = await getConfig(req);
                if (!config) {
                    return next();
                }

                // Generate identifier
                const identifier = this.generateIdentifier(req, config);

                // Check for bypass
                const bypass = await this.checkBypass(identifier);
                if (bypass) {
                    res.set('X-RateLimit-Bypass', bypass.id);
                    return next();
                }

                // Check rate limit
                const result = await this.checkRateLimit(identifier, config);

                // Set rate limit headers
                this.setRateLimitHeaders(res, result);

                if (!result.allowed) {
                    return res.status(429).json({
                        error: 'Rate limit exceeded',
                        message: `Too many requests. Try again after ${new Date(result.resetTime).toISOString()}`,
                        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
                    });
                }

                // Store request info for concurrent request cleanup
                if (config.strategy === 'concurrent' && result.requestId) {
                    req.rateLimitRequestId = result.requestId;
                    req.rateLimitIdentifier = identifier;

                    // Clean up on response end
                    res.on('finish', () => {
                        this.releaseConcurrentRequest(identifier, result.requestId);
                    });
                }

                next();

            } catch (error) {
                console.error('Rate limiting middleware error:', error);
                // Fail open
                next();
            }
        };
    }

    generateIdentifier(req, config) {
        const parts = [];

        if (config.keyBy) {
            if (Array.isArray(config.keyBy)) {
                for (const key of config.keyBy) {
                    parts.push(this.extractKeyValue(req, key));
                }
            } else {
                parts.push(this.extractKeyValue(req, config.keyBy));
            }
        } else {
            // Default to tenant + user
            parts.push(req.tenantId || 'global');
            parts.push(req.user?.id || req.ip);
        }

        return parts.filter(Boolean).join(':');
    }

    extractKeyValue(req, key) {
        switch (key) {
            case 'ip':
                return req.ip;
            case 'user':
                return req.user?.id;
            case 'tenant':
                return req.tenantId;
            case 'apiKey':
                return req.apiKey?.id;
            default:
                return req[key] || req.headers[key];
        }
    }

    setRateLimitHeaders(res, result) {
        res.set('X-RateLimit-Limit', result.capacity || result.limit || 'unknown');
        res.set('X-RateLimit-Remaining', result.remaining.toString());
        res.set('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());
        res.set('X-RateLimit-Strategy', result.strategy || 'unknown');

        if (result.retryAfter) {
            res.set('Retry-After', result.retryAfter.toString());
        }
    }

    /**
     * Analytics and Monitoring
     */
    async getRateLimitStats(identifier, timeframe = '1h') {
        // Implementation would aggregate rate limit data
        console.log(`Getting rate limit stats for ${identifier} (${timeframe})`);
        return {
            identifier: identifier,
            timeframe: timeframe,
            totalRequests: 0,
            blockedRequests: 0,
            blockRate: 0
        };
    }

    async getGlobalRateLimitStats(timeframe = '1h') {
        // Implementation would aggregate global rate limit data
        console.log(`Getting global rate limit stats (${timeframe})`);
        return {
            timeframe: timeframe,
            totalRequests: 0,
            blockedRequests: 0,
            blockRate: 0,
            topBlockedIdentifiers: []
        };
    }
}

module.exports = RateLimiting;