const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const redis = require('../utils/redis');
const clickhouse = require('../utils/clickhouse');
const config = require('../config');
const logger = require('../utils/logger');

class SessionManager {
  constructor() {
    this.activeSessions = new Map();
    this.cleanupInterval = 60000; // 1 minute
    this.startCleanupProcess();
  }

  // Create a new session
  async createSession(sessionData) {
    const sessionId = uuidv4();
    const timestamp = new Date().toISOString();

    const session = {
      session_id: sessionId,
      user_id: sessionData.user_id || null,
      start_time: timestamp,
      end_time: null,
      page_views: 0,
      duration: 0,
      bounce: true,
      conversion: false,
      conversion_value: null,
      traffic_source: sessionData.traffic_source || 'direct',
      campaign: sessionData.campaign || null,
      medium: sessionData.medium || null,
      country: sessionData.country || 'Unknown',
      device_type: sessionData.device_type || 'desktop',
      is_bot: sessionData.is_bot || false,
      created_at: timestamp,
      updated_at: timestamp,
      // Additional tracking fields
      first_page: sessionData.first_page || '',
      last_page: sessionData.first_page || '',
      events_count: 0,
      scroll_depth: 0,
      time_on_page: 0
    };

    // Store in Redis for real-time access
    await redis.setSession(sessionId, session, config.analytics.sessionTimeout);

    // Store in ClickHouse for long-term analytics
    await clickhouse.insert('sessions', [session]);

    // Add to active sessions
    this.activeSessions.set(sessionId, {
      ...session,
      lastActivity: Date.now()
    });

    logger.info(`Created new session: ${sessionId}`);
    return session;
  }

  // Get session by ID
  async getSession(sessionId) {
    // Try memory cache first
    let session = this.activeSessions.get(sessionId);
    if (session) {
      return session;
    }

    // Try Redis
    session = await redis.getSession(sessionId);
    if (session) {
      // Add back to memory cache
      this.activeSessions.set(sessionId, {
        ...session,
        lastActivity: Date.now()
      });
      return session;
    }

    return null;
  }

  // Update session data
  async updateSession(sessionId, updates) {
    const session = await this.getSession(sessionId);
    if (!session) {
      logger.warn(`Attempted to update non-existent session: ${sessionId}`);
      return null;
    }

    const timestamp = new Date().toISOString();
    const updatedSession = {
      ...session,
      ...updates,
      updated_at: timestamp,
      lastActivity: Date.now()
    };

    // Calculate duration
    const startTime = new Date(session.start_time);
    const endTime = new Date();
    updatedSession.duration = Math.floor((endTime - startTime) / 1000);

    // Update Redis
    await redis.setSession(sessionId, updatedSession, config.analytics.sessionTimeout);

    // Update memory cache
    this.activeSessions.set(sessionId, updatedSession);

    return updatedSession;
  }

  // Track page view for session
  async trackPageView(sessionId, pageData) {
    const session = await this.getSession(sessionId);
    if (!session) {
      logger.warn(`Attempted to track page view for non-existent session: ${sessionId}`);
      return;
    }

    const updates = {
      page_views: (session.page_views || 0) + 1,
      last_page: pageData.page_url || '',
      events_count: (session.events_count || 0) + 1,
      bounce: (session.page_views || 0) + 1 <= 1
    };

    // Set first page if not already set
    if (!session.first_page) {
      updates.first_page = pageData.page_url || '';
    }

    return await this.updateSession(sessionId, updates);
  }

  // Track conversion for session
  async trackConversion(sessionId, conversionData) {
    const session = await this.getSession(sessionId);
    if (!session) {
      logger.warn(`Attempted to track conversion for non-existent session: ${sessionId}`);
      return;
    }

    const updates = {
      conversion: true,
      conversion_value: (session.conversion_value || 0) + (conversionData.value || 0),
      events_count: (session.events_count || 0) + 1
    };

    return await this.updateSession(sessionId, updates);
  }

  // Track user interaction
  async trackInteraction(sessionId, interactionData) {
    const session = await this.getSession(sessionId);
    if (!session) {
      return;
    }

    const updates = {
      events_count: (session.events_count || 0) + 1
    };

    // Track scroll depth
    if (interactionData.type === 'scroll' && interactionData.scroll_percentage) {
      updates.scroll_depth = Math.max(
        session.scroll_depth || 0,
        interactionData.scroll_percentage
      );
    }

    return await this.updateSession(sessionId, updates);
  }

  // End session
  async endSession(sessionId, endData = {}) {
    const session = await this.getSession(sessionId);
    if (!session) {
      return;
    }

    const timestamp = new Date().toISOString();
    const updates = {
      end_time: timestamp,
      ...endData
    };

    const finalSession = await this.updateSession(sessionId, updates);

    // Remove from active sessions
    this.activeSessions.delete(sessionId);

    // Update ClickHouse with final session data
    try {
      await clickhouse.command(`
        ALTER TABLE sessions
        UPDATE
          end_time = '${finalSession.end_time}',
          page_views = ${finalSession.page_views},
          duration = ${finalSession.duration},
          bounce = ${finalSession.bounce ? 1 : 0},
          conversion = ${finalSession.conversion ? 1 : 0},
          conversion_value = ${finalSession.conversion_value || 0},
          events_count = ${finalSession.events_count || 0},
          scroll_depth = ${finalSession.scroll_depth || 0},
          updated_at = '${finalSession.updated_at}'
        WHERE session_id = '${sessionId}'
      `);
    } catch (error) {
      logger.error('Error updating session in ClickHouse:', error);
    }

    logger.info(`Ended session: ${sessionId}, duration: ${finalSession.duration}s`);
    return finalSession;
  }

  // Identify user for session
  async identifyUser(sessionId, userId, userProperties = {}) {
    const session = await this.getSession(sessionId);
    if (!session) {
      return;
    }

    // Hash user ID if configured
    const hashedUserId = config.privacy.anonymization.userIdHashing
      ? crypto.createHash('sha256').update(userId + config.server.env).digest('hex')
      : userId;

    const updates = {
      user_id: hashedUserId,
      ...userProperties
    };

    return await this.updateSession(sessionId, updates);
  }

  // Get active sessions count
  getActiveSessionsCount() {
    return this.activeSessions.size;
  }

  // Get sessions by criteria
  async getSessionsByCriteria(criteria = {}) {
    try {
      let query = 'SELECT * FROM sessions WHERE 1=1';
      const params = [];

      if (criteria.start_date) {
        query += ' AND start_time >= ?';
        params.push(criteria.start_date);
      }

      if (criteria.end_date) {
        query += ' AND start_time <= ?';
        params.push(criteria.end_date);
      }

      if (criteria.country) {
        query += ' AND country = ?';
        params.push(criteria.country);
      }

      if (criteria.device_type) {
        query += ' AND device_type = ?';
        params.push(criteria.device_type);
      }

      if (criteria.traffic_source) {
        query += ' AND traffic_source = ?';
        params.push(criteria.traffic_source);
      }

      if (criteria.conversion !== undefined) {
        query += ` AND conversion = ${criteria.conversion ? 1 : 0}`;
      }

      if (criteria.is_bot !== undefined) {
        query += ` AND is_bot = ${criteria.is_bot ? 1 : 0}`;
      }

      query += ' ORDER BY start_time DESC';

      if (criteria.limit) {
        query += ` LIMIT ${criteria.limit}`;
      }

      return await clickhouse.query(query);
    } catch (error) {
      logger.error('Error getting sessions by criteria:', error);
      throw error;
    }
  }

  // Get session analytics
  async getSessionAnalytics(timeRange = '24h') {
    try {
      const timeCondition = this.getTimeCondition(timeRange);

      const analytics = await clickhouse.query(`
        SELECT
          count() as total_sessions,
          uniq(user_id) as unique_users,
          avg(duration) as avg_duration,
          avg(page_views) as avg_page_views,
          countIf(bounce = 1) / count() as bounce_rate,
          countIf(conversion = 1) / count() as conversion_rate,
          sum(conversion_value) as total_conversion_value,
          countIf(is_bot = 0) as human_sessions,
          countIf(is_bot = 1) as bot_sessions
        FROM sessions
        WHERE ${timeCondition}
      `);

      const deviceBreakdown = await clickhouse.query(`
        SELECT
          device_type,
          count() as sessions,
          avg(duration) as avg_duration
        FROM sessions
        WHERE ${timeCondition}
        GROUP BY device_type
        ORDER BY sessions DESC
      `);

      const trafficSources = await clickhouse.query(`
        SELECT
          traffic_source,
          count() as sessions,
          countIf(conversion = 1) as conversions,
          sum(conversion_value) as total_value
        FROM sessions
        WHERE ${timeCondition}
        GROUP BY traffic_source
        ORDER BY sessions DESC
      `);

      return {
        summary: analytics[0] || {},
        deviceBreakdown,
        trafficSources
      };
    } catch (error) {
      logger.error('Error getting session analytics:', error);
      throw error;
    }
  }

  // Cleanup expired sessions
  async cleanupExpiredSessions() {
    const now = Date.now();
    const timeout = config.analytics.sessionTimeout * 1000;

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now - session.lastActivity > timeout) {
        await this.endSession(sessionId, { end_reason: 'timeout' });
      }
    }
  }

  // Start cleanup process
  startCleanupProcess() {
    setInterval(async () => {
      try {
        await this.cleanupExpiredSessions();
      } catch (error) {
        logger.error('Error in session cleanup process:', error);
      }
    }, this.cleanupInterval);
  }

  // Utility function to get time condition for queries
  getTimeCondition(timeRange) {
    const conditions = {
      '1h': 'start_time >= now() - INTERVAL 1 HOUR',
      '24h': 'start_time >= now() - INTERVAL 24 HOUR',
      '7d': 'start_time >= now() - INTERVAL 7 DAY',
      '30d': 'start_time >= now() - INTERVAL 30 DAY',
      '90d': 'start_time >= now() - INTERVAL 90 DAY'
    };

    return conditions[timeRange] || conditions['24h'];
  }

  // GDPR compliance - delete user sessions
  async deleteUserSessions(userId) {
    try {
      // Delete from ClickHouse
      await clickhouse.command(`
        ALTER TABLE sessions
        DELETE
        WHERE user_id = '${userId}'
      `);

      // Delete from Redis
      const pattern = `session:*`;
      const keys = await redis.client.keys(pattern);

      for (const key of keys) {
        const session = await redis.client.get(key);
        if (session) {
          const sessionData = JSON.parse(session);
          if (sessionData.user_id === userId) {
            await redis.client.del(key);
          }
        }
      }

      // Remove from active sessions
      for (const [sessionId, session] of this.activeSessions.entries()) {
        if (session.user_id === userId) {
          this.activeSessions.delete(sessionId);
        }
      }

      logger.info(`Deleted all sessions for user: ${userId}`);
    } catch (error) {
      logger.error('Error deleting user sessions:', error);
      throw error;
    }
  }
}

module.exports = new SessionManager();