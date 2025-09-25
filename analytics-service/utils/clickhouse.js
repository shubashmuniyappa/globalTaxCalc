const { createClient } = require('@clickhouse/client');
const config = require('../config');
const logger = require('./logger');

class ClickHouseClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = createClient({
        host: config.clickhouse.url,
        username: config.clickhouse.username,
        password: config.clickhouse.password,
        database: config.clickhouse.database,
        request_timeout: 30000,
        max_open_connections: 10,
        compression: {
          response: true,
          request: false
        }
      });

      // Test connection
      await this.client.ping();
      this.isConnected = true;
      logger.info('Connected to ClickHouse successfully');
    } catch (error) {
      logger.error('Failed to connect to ClickHouse:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      logger.info('Disconnected from ClickHouse');
    }
  }

  async query(queryText, format = 'JSONEachRow') {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const result = await this.client.query({
        query: queryText,
        format
      });
      return await result.json();
    } catch (error) {
      logger.error('ClickHouse query error:', error);
      throw error;
    }
  }

  async insert(table, data) {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      await this.client.insert({
        table,
        values: data,
        format: 'JSONEachRow'
      });
    } catch (error) {
      logger.error(`ClickHouse insert error for table ${table}:`, error);
      throw error;
    }
  }

  async command(queryText) {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      await this.client.command({
        query: queryText
      });
    } catch (error) {
      logger.error('ClickHouse command error:', error);
      throw error;
    }
  }

  // Batch operations for better performance
  async batchInsert(table, dataArray, batchSize = 1000) {
    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      return;
    }

    const batches = [];
    for (let i = 0; i < dataArray.length; i += batchSize) {
      batches.push(dataArray.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      await this.insert(table, batch);
    }

    logger.info(`Batch inserted ${dataArray.length} records into ${table}`);
  }

  // Health check
  async healthCheck() {
    try {
      await this.client.ping();
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
    }
  }

  // Get database statistics
  async getStats() {
    try {
      const tables = ['events', 'sessions', 'conversions', 'experiments'];
      const stats = {};

      for (const table of tables) {
        try {
          const result = await this.query(`SELECT count() as count FROM ${table}`);
          stats[table] = result[0]?.count || 0;
        } catch (error) {
          stats[table] = 'error';
        }
      }

      return stats;
    } catch (error) {
      logger.error('Error getting ClickHouse stats:', error);
      throw error;
    }
  }
}

// Singleton instance
const clickhouseClient = new ClickHouseClient();

module.exports = clickhouseClient;