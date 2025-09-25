/**
 * Edge Security Manager - WAF, DDoS protection, bot detection, and security filtering
 */

export class EdgeSecurity {
  constructor() {
    this.securityRules = this.initializeSecurityRules();
    this.rateLimiters = new Map();
    this.blockedIPs = new Set();
    this.allowedCountries = new Set(['US', 'CA', 'GB', 'DE', 'FR', 'AU', 'JP', 'IN', 'BR', 'MX']);
    this.suspiciousPatterns = this.initializeSuspiciousPatterns();
    this.securityHeaders = this.initializeSecurityHeaders();
  }

  /**
   * Initialize security rules
   */
  initializeSecurityRules() {
    return {
      rateLimit: {
        api: { requests: 100, window: 60 }, // 100 requests per minute for API
        calculator: { requests: 50, window: 60 }, // 50 requests per minute for calculator
        general: { requests: 200, window: 60 }, // 200 requests per minute general
        upload: { requests: 10, window: 60 } // 10 uploads per minute
      },
      maxRequestSize: 10 * 1024 * 1024, // 10MB
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
      blockedUserAgents: [
        /bot/i,
        /crawler/i,
        /spider/i,
        /scraper/i,
        /harvester/i
      ],
      allowedUserAgents: [
        /googlebot/i,
        /bingbot/i,
        /slurp/i,
        /duckduckbot/i
      ]
    };
  }

  /**
   * Initialize suspicious patterns for WAF
   */
  initializeSuspiciousPatterns() {
    return [
      // SQL Injection patterns
      /(union|select|insert|update|delete|drop|create|alter)\s/i,
      /('|(\\'))|(\\")|("|")|(;)|(\|)|(\*)|(%)/i,
      /(script|javascript|vbscript|onload|onerror|onclick)/i,

      // XSS patterns
      /<script[\s\S]*?>[\s\S]*?<\/script>/i,
      /<iframe[\s\S]*?>[\s\S]*?<\/iframe>/i,
      /<object[\s\S]*?>[\s\S]*?<\/object>/i,
      /javascript:/i,
      /data:text\/html/i,

      // Path traversal
      /\.\./i,
      /\/etc\/passwd/i,
      /\/proc\/self\/environ/i,

      // Command injection
      /(\||;|&|`|\$\(|\${)/i,
      /(nc|netcat|wget|curl|chmod|rm|cat|grep)/i,

      // LDAP injection
      /(\*|\)|\(|\||&)/i,

      // XXE patterns
      /(<!ENTITY|<!DOCTYPE|SYSTEM|PUBLIC)/i
    ];
  }

  /**
   * Initialize security headers
   */
  initializeSecurityHeaders() {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' *.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: *.cloudflare.com; connect-src 'self' *.globaltaxcalc.com",
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
    };
  }

  /**
   * Main security check for incoming requests
   */
  async checkRequest(request, context) {
    try {
      // Basic request validation
      const basicCheck = this.performBasicChecks(request, context);
      if (basicCheck.blocked) {
        return basicCheck;
      }

      // Geography-based blocking
      const geoCheck = this.checkGeographicRestrictions(request, context);
      if (geoCheck.blocked) {
        return geoCheck;
      }

      // Bot detection
      const botCheck = this.detectBots(request, context);
      if (botCheck.blocked) {
        return botCheck;
      }

      // WAF checks
      const wafCheck = await this.performWAFChecks(request, context);
      if (wafCheck.blocked) {
        return wafCheck;
      }

      // DDoS protection
      const ddosCheck = await this.checkDDoSPatterns(request, context);
      if (ddosCheck.blocked) {
        return ddosCheck;
      }

      return { blocked: false, passed: true };

    } catch (error) {
      console.error('Security check error:', error);
      // Fail secure - block on error
      return {
        blocked: true,
        reason: 'security-check-error',
        message: 'Security validation failed'
      };
    }
  }

  /**
   * Perform basic security checks
   */
  performBasicChecks(request, context) {
    const url = new URL(request.url);

    // Check HTTP method
    if (!this.securityRules.allowedMethods.includes(request.method)) {
      return {
        blocked: true,
        reason: 'method-not-allowed',
        message: `HTTP method ${request.method} not allowed`
      };
    }

    // Check request size
    const contentLength = parseInt(request.headers.get('Content-Length') || '0');
    if (contentLength > this.securityRules.maxRequestSize) {
      return {
        blocked: true,
        reason: 'request-too-large',
        message: 'Request size exceeds limit'
      };
    }

    // Check for blocked IPs
    if (this.blockedIPs.has(context.clientIP)) {
      return {
        blocked: true,
        reason: 'ip-blocked',
        message: 'IP address is blocked'
      };
    }

    // Check for suspicious paths
    if (this.isSuspiciousPath(url.pathname)) {
      return {
        blocked: true,
        reason: 'suspicious-path',
        message: 'Suspicious path detected'
      };
    }

    return { blocked: false };
  }

  /**
   * Check geographic restrictions
   */
  checkGeographicRestrictions(request, context) {
    const country = context.country;

    // Check if country is in allowed list (if using allowlist)
    // For now, we'll just log and allow all countries
    if (country && !this.allowedCountries.has(country)) {
      // Log but don't block - adjust based on requirements
      console.warn('Request from restricted country:', country);
    }

    // Block requests from high-risk countries for sensitive endpoints
    const url = new URL(request.url);
    const sensitiveEndpoints = ['/api/payment', '/api/upload', '/admin'];
    const highRiskCountries = ['XX', 'T1']; // Anonymous/Tor exit nodes

    if (sensitiveEndpoints.some(endpoint => url.pathname.startsWith(endpoint)) &&
        highRiskCountries.includes(country)) {
      return {
        blocked: true,
        reason: 'geo-restriction',
        message: 'Access not available from this location'
      };
    }

    return { blocked: false };
  }

  /**
   * Bot detection and filtering
   */
  detectBots(request, context) {
    const userAgent = request.headers.get('User-Agent') || '';

    // Check for explicitly blocked user agents
    const isBlockedBot = this.securityRules.blockedUserAgents.some(pattern =>
      pattern.test(userAgent)
    );

    if (isBlockedBot) {
      // Check if it's an allowed bot (search engines)
      const isAllowedBot = this.securityRules.allowedUserAgents.some(pattern =>
        pattern.test(userAgent)
      );

      if (!isAllowedBot) {
        return {
          blocked: true,
          reason: 'bot-blocked',
          message: 'Automated requests not allowed'
        };
      }
    }

    // Check for bot-like behavior patterns
    if (this.detectBotBehavior(request, context)) {
      return {
        blocked: true,
        reason: 'bot-behavior',
        message: 'Suspicious automated behavior detected'
      };
    }

    return { blocked: false };
  }

  /**
   * Detect bot-like behavior patterns
   */
  detectBotBehavior(request, context) {
    const userAgent = request.headers.get('User-Agent') || '';

    // Check for missing or suspicious user agent
    if (!userAgent || userAgent.length < 10) {
      return true;
    }

    // Check for common bot signatures
    const botSignatures = [
      'python-requests',
      'curl/',
      'wget/',
      'libwww-perl',
      'urllib',
      'HTTPClient'
    ];

    if (botSignatures.some(sig => userAgent.includes(sig))) {
      return true;
    }

    // Check for suspicious header combinations
    const acceptHeader = request.headers.get('Accept') || '';
    const acceptLanguage = request.headers.get('Accept-Language') || '';

    if (!acceptHeader || !acceptLanguage) {
      return true;
    }

    return false;
  }

  /**
   * Web Application Firewall checks
   */
  async performWAFChecks(request, context) {
    const url = new URL(request.url);

    // Check URL for suspicious patterns
    if (this.containsSuspiciousPatterns(url.toString())) {
      return {
        blocked: true,
        reason: 'waf-url-pattern',
        message: 'Suspicious URL pattern detected'
      };
    }

    // Check query parameters
    for (const [key, value] of url.searchParams) {
      if (this.containsSuspiciousPatterns(value)) {
        return {
          blocked: true,
          reason: 'waf-query-pattern',
          message: 'Suspicious query parameter detected'
        };
      }
    }

    // Check headers
    for (const [key, value] of request.headers) {
      if (this.containsSuspiciousPatterns(value)) {
        return {
          blocked: true,
          reason: 'waf-header-pattern',
          message: 'Suspicious header value detected'
        };
      }
    }

    // Check request body for POST/PUT requests
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      const bodyCheck = await this.checkRequestBody(request);
      if (bodyCheck.blocked) {
        return bodyCheck;
      }
    }

    return { blocked: false };
  }

  /**
   * Check request body for suspicious patterns
   */
  async checkRequestBody(request) {
    try {
      const contentType = request.headers.get('Content-Type') || '';

      // Only check text-based content types
      if (contentType.includes('application/json') ||
          contentType.includes('application/x-www-form-urlencoded') ||
          contentType.includes('text/')) {

        const body = await request.clone().text();

        if (this.containsSuspiciousPatterns(body)) {
          return {
            blocked: true,
            reason: 'waf-body-pattern',
            message: 'Suspicious request body content detected'
          };
        }
      }

      return { blocked: false };

    } catch (error) {
      console.warn('WAF body check error:', error.message);
      return { blocked: false };
    }
  }

  /**
   * Check if content contains suspicious patterns
   */
  containsSuspiciousPatterns(content) {
    return this.suspiciousPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Check for DDoS attack patterns
   */
  async checkDDoSPatterns(request, context) {
    // Check for common DDoS patterns
    const url = new URL(request.url);

    // Excessive query parameters
    if (url.searchParams.toString().length > 2048) {
      return {
        blocked: true,
        reason: 'ddos-query-length',
        message: 'Excessive query parameters detected'
      };
    }

    // Rapid requests from same IP (handled by rate limiting)
    // Check for resource exhaustion attempts
    if (this.isResourceExhaustionAttempt(request)) {
      return {
        blocked: true,
        reason: 'ddos-resource-exhaustion',
        message: 'Resource exhaustion attempt detected'
      };
    }

    return { blocked: false };
  }

  /**
   * Check for resource exhaustion attempts
   */
  isResourceExhaustionAttempt(request) {
    const url = new URL(request.url);

    // Large computation requests
    const computationEndpoints = ['/api/calculate', '/api/process'];
    if (computationEndpoints.some(endpoint => url.pathname.startsWith(endpoint))) {
      // Check for unusually large input parameters
      const inputSize = url.searchParams.toString().length;
      if (inputSize > 1024) { // 1KB limit for computation inputs
        return true;
      }
    }

    return false;
  }

  /**
   * Rate limiting check
   */
  async checkRateLimit(request, context) {
    const clientIP = context.clientIP;
    const url = new URL(request.url);

    // Determine rate limit category
    const category = this.getRateLimitCategory(url.pathname);
    const limits = this.securityRules.rateLimit[category];

    // Use Durable Object for distributed rate limiting
    if (context.env.RATE_LIMITER) {
      const rateLimiterId = context.env.RATE_LIMITER.idFromName(clientIP);
      const rateLimiter = context.env.RATE_LIMITER.get(rateLimiterId);

      const response = await rateLimiter.fetch(new Request('https://rate-limiter/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: `${clientIP}:${category}`,
          limit: limits.requests,
          window: limits.window
        })
      }));

      const result = await response.json();

      if (result.limited) {
        return {
          limited: true,
          retryAfter: result.retryAfter,
          remaining: 0,
          resetTime: result.resetTime
        };
      }

      return {
        limited: false,
        remaining: result.remaining,
        resetTime: result.resetTime
      };
    }

    // Fallback to local rate limiting (less accurate for distributed systems)
    const key = `${clientIP}:${category}`;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - limits.window;

    if (!this.rateLimiters.has(key)) {
      this.rateLimiters.set(key, []);
    }

    const requests = this.rateLimiters.get(key);

    // Remove old requests outside the window
    const validRequests = requests.filter(timestamp => timestamp > windowStart);

    if (validRequests.length >= limits.requests) {
      return {
        limited: true,
        retryAfter: limits.window,
        remaining: 0,
        resetTime: (validRequests[0] + limits.window) * 1000
      };
    }

    // Add current request
    validRequests.push(now);
    this.rateLimiters.set(key, validRequests);

    return {
      limited: false,
      remaining: limits.requests - validRequests.length,
      resetTime: (now + limits.window) * 1000
    };
  }

  /**
   * Get rate limit category for path
   */
  getRateLimitCategory(pathname) {
    if (pathname.startsWith('/api/')) {
      return 'api';
    }
    if (pathname.startsWith('/calculator')) {
      return 'calculator';
    }
    if (pathname.includes('/upload')) {
      return 'upload';
    }
    return 'general';
  }

  /**
   * Check if path is suspicious
   */
  isSuspiciousPath(pathname) {
    const suspiciousPaths = [
      '/.env',
      '/wp-admin',
      '/phpMyAdmin',
      '/admin.php',
      '/.git',
      '/config.php',
      '/wp-config.php',
      '/etc/passwd',
      '/proc/version'
    ];

    return suspiciousPaths.some(path => pathname.includes(path));
  }

  /**
   * Add security headers to response
   */
  addSecurityHeaders(response, context) {
    Object.entries(this.securityHeaders).forEach(([header, value]) => {
      response.headers.set(header, value);
    });

    // Add additional context-specific headers
    response.headers.set('X-Edge-Security', 'enabled');
    response.headers.set('X-Request-ID', context.requestId);

    // CORS headers for API requests
    const url = new URL(response.url || 'https://globaltaxcalc.com');
    if (url.pathname.startsWith('/api/')) {
      response.headers.set('Access-Control-Allow-Origin', 'https://globaltaxcalc.com');
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      response.headers.set('Access-Control-Max-Age', '86400');
    }
  }

  /**
   * Create blocked response
   */
  createBlockedResponse(reason) {
    const responses = {
      'method-not-allowed': { status: 405, message: 'Method Not Allowed' },
      'request-too-large': { status: 413, message: 'Request Entity Too Large' },
      'ip-blocked': { status: 403, message: 'Access Forbidden' },
      'geo-restriction': { status: 451, message: 'Unavailable For Legal Reasons' },
      'bot-blocked': { status: 403, message: 'Automated Requests Not Allowed' },
      'bot-behavior': { status: 403, message: 'Suspicious Activity Detected' },
      'waf-url-pattern': { status: 400, message: 'Bad Request' },
      'waf-query-pattern': { status: 400, message: 'Bad Request' },
      'waf-header-pattern': { status: 400, message: 'Bad Request' },
      'waf-body-pattern': { status: 400, message: 'Bad Request' },
      'ddos-query-length': { status: 400, message: 'Bad Request' },
      'ddos-resource-exhaustion': { status: 429, message: 'Too Many Requests' },
      'security-check-error': { status: 500, message: 'Internal Server Error' }
    };

    const config = responses[reason] || { status: 403, message: 'Access Denied' };

    const response = new Response(JSON.stringify({
      error: config.message,
      code: reason,
      timestamp: new Date().toISOString()
    }), {
      status: config.status,
      headers: {
        'Content-Type': 'application/json',
        'X-Security-Block-Reason': reason
      }
    });

    // Add basic security headers even to blocked responses
    this.addSecurityHeaders(response, { requestId: crypto.randomUUID() });

    return response;
  }

  /**
   * Create rate limit response
   */
  createRateLimitResponse(rateLimitResult) {
    return new Response(JSON.stringify({
      error: 'Rate limit exceeded',
      retryAfter: rateLimitResult.retryAfter,
      remaining: rateLimitResult.remaining,
      resetTime: rateLimitResult.resetTime
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': rateLimitResult.retryAfter.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
      }
    });
  }

  /**
   * Block IP address
   */
  blockIP(ip, duration = 3600) {
    this.blockedIPs.add(ip);

    // Auto-unblock after duration
    setTimeout(() => {
      this.blockedIPs.delete(ip);
    }, duration * 1000);

    console.log(`Blocked IP ${ip} for ${duration} seconds`);
  }

  /**
   * Get security statistics
   */
  getSecurityStats() {
    return {
      blockedIPs: this.blockedIPs.size,
      rateLimiters: this.rateLimiters.size,
      allowedCountries: this.allowedCountries.size,
      securityRules: Object.keys(this.securityRules).length
    };
  }
}