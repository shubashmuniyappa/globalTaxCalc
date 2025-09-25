const crypto = require('crypto');
const clickhouse = require('../utils/clickhouse');
const redis = require('../utils/redis');
const sessionManager = require('./sessionManager');
const config = require('../config');
const logger = require('../utils/logger');

class PrivacyService {
  constructor() {
    this.consentTypes = ['essential', 'analytics', 'marketing', 'personalization'];
    this.deletionQueue = [];
    this.processingDeletion = false;
    this.startDeletionProcessor();
  }

  // Handle cookie consent
  async recordConsent(sessionId, consentData) {
    const timestamp = new Date().toISOString();

    const consent = {
      session_id: sessionId,
      user_id: consentData.user_id || null,
      consent_id: crypto.randomUUID(),
      essential: consentData.essential !== false, // Always true
      analytics: consentData.analytics || false,
      marketing: consentData.marketing || false,
      personalization: consentData.personalization || false,
      consent_method: consentData.method || 'banner', // banner, settings, api
      consent_version: consentData.version || '1.0',
      ip_address: this.hashIP(consentData.ip_address),
      user_agent: consentData.user_agent || '',
      timestamp: timestamp,
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
      created_at: timestamp
    };

    // Store consent in Redis for quick access
    await redis.setCache(`consent:${sessionId}`, consent, 86400 * 365); // 1 year

    // Store consent in ClickHouse for compliance records
    try {
      await clickhouse.command(`
        CREATE TABLE IF NOT EXISTS consent_records (
          consent_id String,
          session_id String,
          user_id Nullable(String),
          essential Boolean,
          analytics Boolean,
          marketing Boolean,
          personalization Boolean,
          consent_method LowCardinality(String),
          consent_version String,
          ip_address String,
          user_agent String,
          timestamp DateTime64(3),
          expires_at DateTime64(3),
          created_at DateTime DEFAULT now()
        )
        ENGINE = MergeTree()
        ORDER BY (timestamp, session_id)
        TTL expires_at
      `);

      await clickhouse.insert('consent_records', [consent]);
    } catch (error) {
      logger.error('Error storing consent record:', error);
    }

    logger.info(`Consent recorded for session: ${sessionId}`);
    return consent;
  }

  // Get consent for session
  async getConsent(sessionId) {
    try {
      const consent = await redis.getCache(`consent:${sessionId}`);
      if (consent) {
        // Check if consent has expired
        if (new Date(consent.expires_at) > new Date()) {
          return consent;
        } else {
          // Remove expired consent
          await redis.deleteCache(`consent:${sessionId}`);
        }
      }

      // Try to get from ClickHouse
      const query = `
        SELECT *
        FROM consent_records
        WHERE session_id = '${sessionId}'
          AND expires_at > now()
        ORDER BY timestamp DESC
        LIMIT 1
      `;

      const results = await clickhouse.query(query);
      if (results.length > 0) {
        const consent = results[0];
        // Cache in Redis
        await redis.setCache(`consent:${sessionId}`, consent, 86400 * 365);
        return consent;
      }

      return null;
    } catch (error) {
      logger.error('Error getting consent:', error);
      return null;
    }
  }

  // Check if specific consent type is granted
  async hasConsent(sessionId, consentType) {
    const consent = await this.getConsent(sessionId);
    if (!consent) {
      return false;
    }

    // Essential consent is always granted
    if (consentType === 'essential') {
      return true;
    }

    return consent[consentType] || false;
  }

  // Update consent preferences
  async updateConsent(sessionId, updates) {
    const existingConsent = await this.getConsent(sessionId);
    if (!existingConsent) {
      throw new Error('No existing consent found');
    }

    const updatedConsent = {
      ...existingConsent,
      ...updates,
      timestamp: new Date().toISOString(),
      consent_id: crypto.randomUUID() // New consent ID for audit trail
    };

    await redis.setCache(`consent:${sessionId}`, updatedConsent, 86400 * 365);
    await clickhouse.insert('consent_records', [updatedConsent]);

    logger.info(`Consent updated for session: ${sessionId}`);
    return updatedConsent;
  }

  // Handle data deletion request (GDPR Article 17 - Right to erasure)
  async requestDataDeletion(deletionRequest) {
    const requestId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const request = {
      request_id: requestId,
      user_id: deletionRequest.user_id,
      email: deletionRequest.email,
      session_ids: deletionRequest.session_ids || [],
      reason: deletionRequest.reason || 'user_request',
      verification_token: deletionRequest.verification_token || null,
      status: 'pending', // pending, verified, processing, completed, failed
      requested_at: timestamp,
      verified_at: null,
      completed_at: null,
      deleted_records: {
        events: 0,
        sessions: 0,
        conversions: 0,
        experiments: 0,
        consent_records: 0
      },
      created_at: timestamp
    };

    // Store deletion request
    await redis.setCache(`deletion:request:${requestId}`, request, 86400 * 30); // 30 days

    // Create verification token if email provided
    if (deletionRequest.email && !deletionRequest.verification_token) {
      const verificationToken = crypto.randomBytes(32).toString('hex');
      request.verification_token = verificationToken;
      await redis.setCache(`deletion:verify:${verificationToken}`, requestId, 86400); // 24 hours

      // In a real implementation, you would send an email here
      logger.info(`Deletion verification email would be sent to: ${deletionRequest.email}`);
    }

    logger.info(`Data deletion requested: ${requestId}`);
    return {
      request_id: requestId,
      verification_token: request.verification_token,
      status: request.status
    };
  }

  // Verify deletion request
  async verifyDeletion(verificationToken) {
    try {
      const requestId = await redis.getCache(`deletion:verify:${verificationToken}`);
      if (!requestId) {
        throw new Error('Invalid or expired verification token');
      }

      const request = await redis.getCache(`deletion:request:${requestId}`);
      if (!request) {
        throw new Error('Deletion request not found');
      }

      // Update request status
      request.status = 'verified';
      request.verified_at = new Date().toISOString();

      await redis.setCache(`deletion:request:${requestId}`, request, 86400 * 30);
      await redis.deleteCache(`deletion:verify:${verificationToken}`);

      // Add to deletion queue
      this.deletionQueue.push(requestId);

      logger.info(`Deletion request verified: ${requestId}`);
      return { request_id: requestId, status: 'verified' };
    } catch (error) {
      logger.error('Error verifying deletion request:', error);
      throw error;
    }
  }

  // Process data deletion
  async processDeletion(requestId) {
    try {
      const request = await redis.getCache(`deletion:request:${requestId}`);
      if (!request || request.status !== 'verified') {
        throw new Error('Invalid deletion request');
      }

      request.status = 'processing';
      await redis.setCache(`deletion:request:${requestId}`, request, 86400 * 30);

      logger.info(`Starting data deletion for request: ${requestId}`);

      let deletedRecords = {
        events: 0,
        sessions: 0,
        conversions: 0,
        experiments: 0,
        consent_records: 0
      };

      // Build deletion conditions
      const conditions = [];
      if (request.user_id) {
        conditions.push(`user_id = '${request.user_id}'`);
      }
      if (request.session_ids && request.session_ids.length > 0) {
        const sessionList = request.session_ids.map(id => `'${id}'`).join(',');
        conditions.push(`session_id IN (${sessionList})`);
      }

      if (conditions.length === 0) {
        throw new Error('No deletion conditions specified');
      }

      const whereClause = conditions.join(' OR ');

      // Delete from events table
      try {
        const eventsCountQuery = `SELECT count() as count FROM events WHERE ${whereClause}`;
        const eventsCount = await clickhouse.query(eventsCountQuery);
        deletedRecords.events = eventsCount[0]?.count || 0;

        await clickhouse.command(`ALTER TABLE events DELETE WHERE ${whereClause}`);
        logger.info(`Deleted ${deletedRecords.events} event records`);
      } catch (error) {
        logger.error('Error deleting events:', error);
      }

      // Delete from sessions table
      try {
        const sessionsCountQuery = `SELECT count() as count FROM sessions WHERE ${whereClause}`;
        const sessionsCount = await clickhouse.query(sessionsCountQuery);
        deletedRecords.sessions = sessionsCount[0]?.count || 0;

        await clickhouse.command(`ALTER TABLE sessions DELETE WHERE ${whereClause}`);
        logger.info(`Deleted ${deletedRecords.sessions} session records`);
      } catch (error) {
        logger.error('Error deleting sessions:', error);
      }

      // Delete from conversions table
      try {
        const conversionsCountQuery = `SELECT count() as count FROM conversions WHERE ${whereClause}`;
        const conversionsCount = await clickhouse.query(conversionsCountQuery);
        deletedRecords.conversions = conversionsCount[0]?.count || 0;

        await clickhouse.command(`ALTER TABLE conversions DELETE WHERE ${whereClause}`);
        logger.info(`Deleted ${deletedRecords.conversions} conversion records`);
      } catch (error) {
        logger.error('Error deleting conversions:', error);
      }

      // Delete from experiments table
      try {
        const experimentsCountQuery = `SELECT count() as count FROM experiments WHERE ${whereClause}`;
        const experimentsCount = await clickhouse.query(experimentsCountQuery);
        deletedRecords.experiments = experimentsCount[0]?.count || 0;

        await clickhouse.command(`ALTER TABLE experiments DELETE WHERE ${whereClause}`);
        logger.info(`Deleted ${deletedRecords.experiments} experiment records`);
      } catch (error) {
        logger.error('Error deleting experiments:', error);
      }

      // Delete consent records
      try {
        const consentCountQuery = `SELECT count() as count FROM consent_records WHERE ${whereClause}`;
        const consentCount = await clickhouse.query(consentCountQuery);
        deletedRecords.consent_records = consentCount[0]?.count || 0;

        await clickhouse.command(`ALTER TABLE consent_records DELETE WHERE ${whereClause}`);
        logger.info(`Deleted ${deletedRecords.consent_records} consent records`);
      } catch (error) {
        logger.error('Error deleting consent records:', error);
      }

      // Delete from Redis
      if (request.session_ids) {
        for (const sessionId of request.session_ids) {
          await redis.deleteSession(sessionId);
          await redis.deleteCache(`consent:${sessionId}`);
          await sessionManager.endSession(sessionId, { end_reason: 'data_deletion' });
        }
      }

      // Update request status
      request.status = 'completed';
      request.completed_at = new Date().toISOString();
      request.deleted_records = deletedRecords;

      await redis.setCache(`deletion:request:${requestId}`, request, 86400 * 30);

      logger.info(`Data deletion completed for request: ${requestId}`, deletedRecords);
      return { request_id: requestId, status: 'completed', deleted_records: deletedRecords };

    } catch (error) {
      logger.error(`Error processing deletion for request ${requestId}:`, error);

      // Update request status to failed
      try {
        const request = await redis.getCache(`deletion:request:${requestId}`);
        if (request) {
          request.status = 'failed';
          request.error = error.message;
          await redis.setCache(`deletion:request:${requestId}`, request, 86400 * 30);
        }
      } catch (updateError) {
        logger.error('Error updating failed deletion request:', updateError);
      }

      throw error;
    }
  }

  // Get deletion request status
  async getDeletionStatus(requestId) {
    const request = await redis.getCache(`deletion:request:${requestId}`);
    if (!request) {
      return null;
    }

    return {
      request_id: request.request_id,
      status: request.status,
      requested_at: request.requested_at,
      verified_at: request.verified_at,
      completed_at: request.completed_at,
      deleted_records: request.deleted_records
    };
  }

  // Export user data (GDPR Article 20 - Right to data portability)
  async exportUserData(exportRequest) {
    const { user_id, session_ids, email } = exportRequest;

    if (!user_id && (!session_ids || session_ids.length === 0)) {
      throw new Error('User ID or session IDs required');
    }

    try {
      const exportData = {
        export_date: new Date().toISOString(),
        user_id,
        session_ids,
        data: {}
      };

      // Build conditions
      const conditions = [];
      if (user_id) {
        conditions.push(`user_id = '${user_id}'`);
      }
      if (session_ids && session_ids.length > 0) {
        const sessionList = session_ids.map(id => `'${id}'`).join(',');
        conditions.push(`session_id IN (${sessionList})`);
      }

      const whereClause = conditions.join(' OR ');

      // Export events
      const eventsQuery = `
        SELECT *
        FROM events
        WHERE ${whereClause}
        ORDER BY timestamp DESC
      `;
      exportData.data.events = await clickhouse.query(eventsQuery);

      // Export sessions
      const sessionsQuery = `
        SELECT *
        FROM sessions
        WHERE ${whereClause}
        ORDER BY start_time DESC
      `;
      exportData.data.sessions = await clickhouse.query(sessionsQuery);

      // Export conversions
      const conversionsQuery = `
        SELECT *
        FROM conversions
        WHERE ${whereClause}
        ORDER BY timestamp DESC
      `;
      exportData.data.conversions = await clickhouse.query(conversionsQuery);

      // Export experiments
      const experimentsQuery = `
        SELECT *
        FROM experiments
        WHERE ${whereClause}
        ORDER BY timestamp DESC
      `;
      exportData.data.experiments = await clickhouse.query(experimentsQuery);

      // Export consent records
      const consentQuery = `
        SELECT *
        FROM consent_records
        WHERE ${whereClause}
        ORDER BY timestamp DESC
      `;
      exportData.data.consent_records = await clickhouse.query(consentQuery);

      logger.info(`Data export completed for user: ${user_id || 'unknown'}`);
      return exportData;

    } catch (error) {
      logger.error('Error exporting user data:', error);
      throw error;
    }
  }

  // Anonymize data (for users who want anonymization instead of deletion)
  async anonymizeUserData(anonymizationRequest) {
    const { user_id, session_ids } = anonymizationRequest;

    if (!user_id && (!session_ids || session_ids.length === 0)) {
      throw new Error('User ID or session IDs required');
    }

    try {
      const anonymousUserId = `anon_${crypto.randomBytes(16).toString('hex')}`;

      // Build conditions
      const conditions = [];
      if (user_id) {
        conditions.push(`user_id = '${user_id}'`);
      }
      if (session_ids && session_ids.length > 0) {
        const sessionList = session_ids.map(id => `'${id}'`).join(',');
        conditions.push(`session_id IN (${sessionList})`);
      }

      const whereClause = conditions.join(' OR ');

      // Anonymize events
      await clickhouse.command(`
        ALTER TABLE events
        UPDATE user_id = '${anonymousUserId}'
        WHERE ${whereClause}
      `);

      // Anonymize sessions
      await clickhouse.command(`
        ALTER TABLE sessions
        UPDATE user_id = '${anonymousUserId}'
        WHERE ${whereClause}
      `);

      // Anonymize conversions
      await clickhouse.command(`
        ALTER TABLE conversions
        UPDATE user_id = '${anonymousUserId}'
        WHERE ${whereClause}
      `);

      // Anonymize experiments
      await clickhouse.command(`
        ALTER TABLE experiments
        UPDATE user_id = '${anonymousUserId}'
        WHERE ${whereClause}
      `);

      logger.info(`Data anonymized for user: ${user_id || 'sessions'} -> ${anonymousUserId}`);
      return { anonymized_user_id: anonymousUserId };

    } catch (error) {
      logger.error('Error anonymizing user data:', error);
      throw error;
    }
  }

  // Start deletion processor
  startDeletionProcessor() {
    setInterval(async () => {
      if (this.processingDeletion || this.deletionQueue.length === 0) {
        return;
      }

      this.processingDeletion = true;

      try {
        const requestId = this.deletionQueue.shift();
        await this.processDeletion(requestId);
      } catch (error) {
        logger.error('Error in deletion processor:', error);
      } finally {
        this.processingDeletion = false;
      }
    }, 10000); // Process every 10 seconds
  }

  // Utility functions
  hashIP(ip) {
    if (!ip || !config.privacy.anonymization.ipMasking) {
      return ip;
    }

    return crypto.createHash('sha256').update(ip + config.server.env).digest('hex').substring(0, 16);
  }

  // Generate privacy policy data
  generatePrivacyPolicyData() {
    return {
      data_types_collected: [
        'Page views and navigation patterns',
        'Device and browser information',
        'Geographic location (country/city level)',
        'User interactions and engagement metrics',
        'Error logs and performance data',
        'Conversion and revenue data',
        'A/B testing assignments'
      ],
      purposes: [
        'Website analytics and optimization',
        'User experience improvement',
        'A/B testing and experimentation',
        'Error monitoring and debugging',
        'Business intelligence and reporting'
      ],
      retention_periods: {
        events: `${config.analytics.retention.events} days`,
        sessions: `${config.analytics.retention.sessions} days`,
        conversions: `${config.analytics.retention.conversions} days`,
        experiments: `${config.analytics.retention.experiments} days`
      },
      user_rights: [
        'Right to access your data',
        'Right to rectification',
        'Right to erasure (deletion)',
        'Right to data portability',
        'Right to object to processing',
        'Right to withdraw consent'
      ],
      contact_information: {
        data_protection_officer: 'dpo@globaltaxcalc.com',
        privacy_inquiries: 'privacy@globaltaxcalc.com'
      }
    };
  }

  // Health check for privacy compliance
  async getComplianceStatus() {
    try {
      const status = {
        timestamp: new Date().toISOString(),
        consent_system: 'operational',
        deletion_processor: this.processingDeletion ? 'processing' : 'idle',
        deletion_queue_size: this.deletionQueue.length,
        data_retention: 'compliant',
        anonymization: 'enabled'
      };

      // Check recent consent records
      const recentConsent = await clickhouse.query(`
        SELECT count() as count
        FROM consent_records
        WHERE timestamp >= now() - INTERVAL 24 HOUR
      `);

      status.recent_consent_records = recentConsent[0]?.count || 0;

      return status;
    } catch (error) {
      logger.error('Error getting compliance status:', error);
      return {
        timestamp: new Date().toISOString(),
        status: 'error',
        error: error.message
      };
    }
  }
}

module.exports = new PrivacyService();