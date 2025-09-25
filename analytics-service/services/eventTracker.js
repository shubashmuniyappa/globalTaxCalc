const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const geoip = require('geoip-lite');
const UAParser = require('user-agent-parser');
const clickhouse = require('../utils/clickhouse');
const redis = require('../utils/redis');
const config = require('../config');
const logger = require('../utils/logger');

class EventTracker {
  constructor() {
    this.eventQueue = [];
    this.isProcessing = false;
    this.batchSize = 100;
    this.flushInterval = 5000; // 5 seconds

    // Start the batch processor
    this.startBatchProcessor();
  }

  // Track page view event
  async trackPageView(eventData, req) {
    const enrichedEvent = await this.enrichEvent({
      event_type: 'page_view',
      ...eventData
    }, req);

    await this.addEventToQueue(enrichedEvent);
    return enrichedEvent.event_id;
  }

  // Track calculator events
  async trackCalculatorEvent(type, eventData, req) {
    const validTypes = ['calculator_start', 'calculator_step', 'calculator_complete', 'calculator_abandon'];
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid calculator event type: ${type}`);
    }

    const enrichedEvent = await this.enrichEvent({
      event_type: type,
      ...eventData
    }, req);

    await this.addEventToQueue(enrichedEvent);
    return enrichedEvent.event_id;
  }

  // Track user interaction events
  async trackInteraction(type, eventData, req) {
    const validTypes = ['click', 'scroll', 'form_submit', 'download', 'search'];
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid interaction event type: ${type}`);
    }

    const enrichedEvent = await this.enrichEvent({
      event_type: type,
      ...eventData
    }, req);

    await this.addEventToQueue(enrichedEvent);
    return enrichedEvent.event_id;
  }

  // Track conversion events
  async trackConversion(conversionData, req) {
    const enrichedEvent = await this.enrichEvent({
      event_type: 'conversion',
      ...conversionData
    }, req);

    // Also store in conversions table
    const conversionRecord = {
      conversion_id: enrichedEvent.event_id,
      session_id: enrichedEvent.session_id,
      user_id: enrichedEvent.user_id,
      timestamp: enrichedEvent.timestamp,
      conversion_type: conversionData.conversion_type || 'unknown',
      value: conversionData.value || 0,
      currency: conversionData.currency || 'USD',
      source_page: enrichedEvent.page_url,
      calculator_type: conversionData.calculator_type || null,
      affiliate_id: conversionData.affiliate_id || null,
      campaign_id: conversionData.campaign_id || null,
      properties: JSON.stringify(conversionData.properties || {}),
      created_at: new Date().toISOString()
    };

    await this.addEventToQueue(enrichedEvent);
    await clickhouse.insert('conversions', [conversionRecord]);

    return enrichedEvent.event_id;
  }

  // Track error events
  async trackError(errorData, req) {
    const enrichedEvent = await this.enrichEvent({
      event_type: 'error',
      ...errorData
    }, req);

    await this.addEventToQueue(enrichedEvent);
    logger.warn('Application error tracked:', errorData);
    return enrichedEvent.event_id;
  }

  // Track performance events
  async trackPerformance(performanceData, req) {
    const enrichedEvent = await this.enrichEvent({
      event_type: 'performance',
      ...performanceData
    }, req);

    await this.addEventToQueue(enrichedEvent);
    return enrichedEvent.event_id;
  }

  // Enrich event with additional metadata
  async enrichEvent(eventData, req) {
    const timestamp = new Date().toISOString();
    const eventId = uuidv4();

    // Extract IP address
    const ip = this.getClientIP(req);
    const ipHash = this.hashIP(ip);

    // Parse user agent
    const ua = UAParser(req.headers['user-agent'] || '');

    // Get geolocation
    const geo = geoip.lookup(ip) || {};

    // Get or create session
    const sessionData = await this.getOrCreateSession(req, geo, ua);

    // Check if this is a bot
    const isBot = this.detectBot(req.headers['user-agent'] || '');

    const enrichedEvent = {
      event_id: eventId,
      timestamp,
      event_type: eventData.event_type,
      user_id: eventData.user_id || sessionData.user_id || null,
      session_id: sessionData.session_id,
      page_url: eventData.page_url || req.url || '',
      referrer: eventData.referrer || req.headers.referer || null,
      user_agent: req.headers['user-agent'] || '',
      ip_address: ipHash,
      country: geo.country || 'Unknown',
      region: geo.region || null,
      city: geo.city || null,
      device_type: this.getDeviceType(ua),
      browser: ua.browser?.name || 'Unknown',
      os: ua.os?.name || 'Unknown',
      properties: JSON.stringify(eventData.properties || {}),
      created_at: timestamp
    };

    // Update session with new activity
    await this.updateSessionActivity(sessionData.session_id, eventData.event_type);

    return enrichedEvent;
  }

  // Get or create user session
  async getOrCreateSession(req, geo, ua) {
    let sessionId = req.cookies?.analytics_session;
    let session = null;

    if (sessionId) {
      session = await redis.getSession(sessionId);
    }

    if (!session) {
      sessionId = uuidv4();
      const isBot = this.detectBot(req.headers['user-agent'] || '');

      session = {
        session_id: sessionId,
        user_id: null, // Will be set when user is identified
        start_time: new Date().toISOString(),
        end_time: null,
        page_views: 0,
        duration: 0,
        bounce: true, // Will be updated if user views multiple pages
        conversion: false,
        conversion_value: null,
        traffic_source: this.getTrafficSource(req),
        campaign: req.query.utm_campaign || null,
        medium: req.query.utm_medium || null,
        country: geo.country || 'Unknown',
        device_type: this.getDeviceType(ua),
        is_bot: isBot,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await redis.setSession(sessionId, session);

      // Also store in ClickHouse
      await clickhouse.insert('sessions', [session]);
    }

    return session;
  }

  // Update session activity
  async updateSessionActivity(sessionId, eventType) {
    try {
      const session = await redis.getSession(sessionId);
      if (!session) return;

      const updates = {
        updated_at: new Date().toISOString(),
        end_time: new Date().toISOString()
      };

      if (eventType === 'page_view') {
        updates.page_views = (session.page_views || 0) + 1;
        updates.bounce = updates.page_views <= 1;
      }

      if (eventType === 'conversion') {
        updates.conversion = true;
      }

      // Calculate session duration
      const startTime = new Date(session.start_time);
      const endTime = new Date();
      updates.duration = Math.floor((endTime - startTime) / 1000);

      await redis.updateSession(sessionId, updates);
    } catch (error) {
      logger.error('Error updating session activity:', error);
    }
  }

  // Add event to processing queue
  async addEventToQueue(event) {
    // Apply sampling if configured
    if (Math.random() > config.analytics.sampling.events) {
      return;
    }

    this.eventQueue.push(event);

    // If queue is full, process immediately
    if (this.eventQueue.length >= this.batchSize) {
      await this.processEventQueue();
    }
  }

  // Process event queue in batches
  async processEventQueue() {
    if (this.isProcessing || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const events = this.eventQueue.splice(0, this.batchSize);
      await clickhouse.insert('events', events);
      logger.info(`Processed ${events.length} events`);
    } catch (error) {
      logger.error('Error processing event queue:', error);
      // Re-add events to queue for retry
      this.eventQueue.unshift(...events);
    } finally {
      this.isProcessing = false;
    }
  }

  // Start batch processor
  startBatchProcessor() {
    setInterval(async () => {
      await this.processEventQueue();
    }, this.flushInterval);
  }

  // Utility functions
  getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] ||
           req.headers['x-real-ip'] ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           '127.0.0.1';
  }

  hashIP(ip) {
    if (!config.privacy.anonymization.ipMasking) {
      return ip;
    }

    // Hash IP for privacy
    return crypto.createHash('sha256').update(ip + config.server.env).digest('hex').substring(0, 16);
  }

  getDeviceType(ua) {
    if (ua.device?.type) {
      return ua.device.type;
    }

    const userAgent = ua.string || '';
    if (/mobile|android|iphone|ipad/i.test(userAgent)) {
      return 'mobile';
    }
    if (/tablet|ipad/i.test(userAgent)) {
      return 'tablet';
    }
    return 'desktop';
  }

  detectBot(userAgent) {
    return config.analytics.botPatterns.some(pattern => pattern.test(userAgent));
  }

  getTrafficSource(req) {
    const referrer = req.headers.referer;
    const utm_source = req.query.utm_source;

    if (utm_source) return utm_source;
    if (!referrer) return 'direct';

    try {
      const referrerDomain = new URL(referrer).hostname;
      if (referrerDomain.includes('google')) return 'google';
      if (referrerDomain.includes('facebook')) return 'facebook';
      if (referrerDomain.includes('twitter')) return 'twitter';
      if (referrerDomain.includes('linkedin')) return 'linkedin';
      return 'referral';
    } catch {
      return 'unknown';
    }
  }

  // Flush remaining events (useful for graceful shutdown)
  async flush() {
    await this.processEventQueue();
  }
}

module.exports = new EventTracker();