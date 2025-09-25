/**
 * GlobalTaxCalc CDN & Edge Computing Main Entry Point
 * Handles routing, caching, security, and edge processing
 */

import { Router } from 'itty-router';
import { CDNManager } from './core/cdn-manager';
import { EdgeCache } from './core/edge-cache';
import { EdgeSecurity } from './core/edge-security';
import { EdgeAnalytics } from './core/edge-analytics';
import { EdgePersonalization } from './core/edge-personalization';
import { EdgeOptimization } from './core/edge-optimization';
import { ErrorHandler } from './utils/error-handler';
import { Logger } from './utils/logger';

// Initialize router and core services
const router = Router();
const cdnManager = new CDNManager();
const edgeCache = new EdgeCache();
const edgeSecurity = new EdgeSecurity();
const edgeAnalytics = new EdgeAnalytics();
const edgePersonalization = new EdgePersonalization();
const edgeOptimization = new EdgeOptimization();
const errorHandler = new ErrorHandler();
const logger = new Logger();

/**
 * Main request handler
 */
async function handleRequest(request, env, ctx) {
  const startTime = Date.now();

  try {
    // Extract request information
    const url = new URL(request.url);
    const method = request.method;
    const userAgent = request.headers.get('User-Agent') || '';
    const clientIP = request.headers.get('CF-Connecting-IP') || '';
    const country = request.cf?.country || 'XX';
    const colo = request.cf?.colo || 'unknown';

    // Initialize request context
    const requestContext = {
      url,
      method,
      userAgent,
      clientIP,
      country,
      colo,
      startTime,
      requestId: crypto.randomUUID(),
      env,
      ctx
    };

    // Log request
    logger.info('Incoming request', {
      method,
      url: url.toString(),
      country,
      colo,
      userAgent: userAgent.substring(0, 100)
    });

    // Security checks first
    const securityCheck = await edgeSecurity.checkRequest(request, requestContext);
    if (securityCheck.blocked) {
      return edgeSecurity.createBlockedResponse(securityCheck.reason);
    }

    // Rate limiting
    const rateLimitCheck = await edgeSecurity.checkRateLimit(request, requestContext);
    if (rateLimitCheck.limited) {
      return edgeSecurity.createRateLimitResponse(rateLimitCheck);
    }

    // Check cache first
    const cachedResponse = await edgeCache.get(request, requestContext);
    if (cachedResponse) {
      // Add cache hit headers
      const response = new Response(cachedResponse.body, cachedResponse);
      response.headers.set('X-Cache', 'HIT');
      response.headers.set('X-Cache-Region', colo);

      // Track analytics for cached response
      ctx.waitUntil(edgeAnalytics.trackRequest(request, response, requestContext, true));

      return response;
    }

    // Route the request
    const response = await router.handle(request, env, ctx, requestContext);

    // Post-process response
    const processedResponse = await processResponse(response, request, requestContext);

    // Cache the response if appropriate
    if (shouldCache(request, processedResponse)) {
      ctx.waitUntil(edgeCache.put(request, processedResponse, requestContext));
    }

    // Track analytics
    ctx.waitUntil(edgeAnalytics.trackRequest(request, processedResponse, requestContext, false));

    return processedResponse;

  } catch (error) {
    logger.error('Request handling error', { error: error.message, stack: error.stack });
    return errorHandler.createErrorResponse(error, request);
  }
}

/**
 * Process response with optimizations and headers
 */
async function processResponse(response, request, context) {
  if (!response) {
    return errorHandler.createNotFoundResponse();
  }

  // Clone response for modification
  const newResponse = new Response(response.body, response);

  // Add security headers
  edgeSecurity.addSecurityHeaders(newResponse, context);

  // Add performance headers
  const processingTime = Date.now() - context.startTime;
  newResponse.headers.set('X-Processing-Time', `${processingTime}ms`);
  newResponse.headers.set('X-Edge-Region', context.colo);
  newResponse.headers.set('X-Request-ID', context.requestId);

  // Optimize response if needed
  if (shouldOptimize(request, newResponse)) {
    return await edgeOptimization.optimizeResponse(newResponse, request, context);
  }

  return newResponse;
}

/**
 * Check if response should be cached
 */
function shouldCache(request, response) {
  const url = new URL(request.url);
  const method = request.method;
  const status = response.status;

  // Don't cache non-GET requests
  if (method !== 'GET') return false;

  // Don't cache error responses
  if (status >= 400) return false;

  // Cache static assets
  if (url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    return true;
  }

  // Cache API responses with cache headers
  if (response.headers.get('Cache-Control')) {
    return true;
  }

  // Cache HTML pages
  if (response.headers.get('Content-Type')?.includes('text/html')) {
    return true;
  }

  return false;
}

/**
 * Check if response should be optimized
 */
function shouldOptimize(request, response) {
  const contentType = response.headers.get('Content-Type') || '';

  // Optimize HTML, CSS, JS
  if (contentType.includes('text/html') ||
      contentType.includes('text/css') ||
      contentType.includes('application/javascript')) {
    return true;
  }

  // Optimize images
  if (contentType.includes('image/')) {
    return true;
  }

  return false;
}

// Route definitions
router.get('/', async (request, env, ctx, context) => {
  return await cdnManager.serveHomePage(request, context);
});

router.get('/api/*', async (request, env, ctx, context) => {
  return await cdnManager.proxyAPIRequest(request, context);
});

router.get('/assets/*', async (request, env, ctx, context) => {
  return await cdnManager.serveStaticAsset(request, context);
});

router.get('/calculator/*', async (request, env, ctx, context) => {
  return await edgePersonalization.servePersonalizedCalculator(request, context);
});

router.get('/health', async (request, env, ctx, context) => {
  return new Response(JSON.stringify({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    region: context.colo,
    version: '1.0.0'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
});

router.get('/edge-info', async (request, env, ctx, context) => {
  return new Response(JSON.stringify({
    country: context.country,
    region: context.colo,
    timestamp: new Date().toISOString(),
    cf: request.cf
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
});

// Handle all other routes
router.all('*', async (request, env, ctx, context) => {
  return await cdnManager.handleFallback(request, context);
});

// Export handlers
export default {
  fetch: handleRequest
};

// Export Durable Object classes
export { RateLimiter } from './durable-objects/rate-limiter';
export { AnalyticsAggregator } from './durable-objects/analytics-aggregator';