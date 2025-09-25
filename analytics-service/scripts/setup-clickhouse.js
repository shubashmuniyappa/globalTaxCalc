const { createClient } = require('@clickhouse/client');
const config = require('../config');
const logger = require('../utils/logger');

async function setupClickHouse() {
  const client = createClient({
    host: config.clickhouse.url,
    username: config.clickhouse.username,
    password: config.clickhouse.password,
    database: config.clickhouse.database
  });

  try {
    logger.info('Setting up ClickHouse database and tables...');

    // Create database if not exists
    await client.command({
      query: `CREATE DATABASE IF NOT EXISTS ${config.clickhouse.database}`
    });

    // Create events table
    await client.command({
      query: `
        CREATE TABLE IF NOT EXISTS events (
          event_id String,
          timestamp DateTime64(3),
          event_type LowCardinality(String),
          user_id Nullable(String),
          session_id String,
          page_url String,
          referrer Nullable(String),
          user_agent String,
          ip_address IPv4,
          country LowCardinality(String),
          region Nullable(String),
          city Nullable(String),
          device_type LowCardinality(String),
          browser LowCardinality(String),
          os LowCardinality(String),
          properties String, -- JSON string
          created_at DateTime DEFAULT now()
        )
        ENGINE = MergeTree()
        PARTITION BY toYYYYMM(timestamp)
        ORDER BY (event_type, timestamp, session_id)
        TTL timestamp + INTERVAL 2 YEAR
        SETTINGS index_granularity = 8192
      `
    });

    // Create sessions table
    await client.command({
      query: `
        CREATE TABLE IF NOT EXISTS sessions (
          session_id String,
          user_id Nullable(String),
          start_time DateTime64(3),
          end_time Nullable(DateTime64(3)),
          page_views UInt32 DEFAULT 0,
          duration UInt32 DEFAULT 0,
          bounce Boolean DEFAULT false,
          conversion Boolean DEFAULT false,
          conversion_value Nullable(Float64),
          traffic_source LowCardinality(String),
          campaign Nullable(String),
          medium Nullable(String),
          country LowCardinality(String),
          device_type LowCardinality(String),
          is_bot Boolean DEFAULT false,
          created_at DateTime DEFAULT now(),
          updated_at DateTime DEFAULT now()
        )
        ENGINE = MergeTree()
        PARTITION BY toYYYYMM(start_time)
        ORDER BY (start_time, session_id)
        TTL start_time + INTERVAL 2 YEAR
        SETTINGS index_granularity = 8192
      `
    });

    // Create conversions table
    await client.command({
      query: `
        CREATE TABLE IF NOT EXISTS conversions (
          conversion_id String,
          session_id String,
          user_id Nullable(String),
          timestamp DateTime64(3),
          conversion_type LowCardinality(String),
          value Float64 DEFAULT 0,
          currency LowCardinality(String) DEFAULT 'USD',
          source_page String,
          calculator_type Nullable(String),
          affiliate_id Nullable(String),
          campaign_id Nullable(String),
          properties String, -- JSON string
          created_at DateTime DEFAULT now()
        )
        ENGINE = MergeTree()
        PARTITION BY toYYYYMM(timestamp)
        ORDER BY (conversion_type, timestamp, session_id)
        TTL timestamp + INTERVAL 5 YEAR
        SETTINGS index_granularity = 8192
      `
    });

    // Create experiments table for A/B testing
    await client.command({
      query: `
        CREATE TABLE IF NOT EXISTS experiments (
          experiment_id String,
          user_id Nullable(String),
          session_id String,
          variant LowCardinality(String),
          timestamp DateTime64(3),
          converted Boolean DEFAULT false,
          conversion_value Nullable(Float64),
          properties String, -- JSON string
          created_at DateTime DEFAULT now()
        )
        ENGINE = MergeTree()
        PARTITION BY toYYYYMM(timestamp)
        ORDER BY (experiment_id, timestamp, session_id)
        TTL timestamp + INTERVAL 1 YEAR
        SETTINGS index_granularity = 8192
      `
    });

    // Create page_views materialized view
    await client.command({
      query: `
        CREATE MATERIALIZED VIEW IF NOT EXISTS page_views_mv TO page_views_agg AS
        SELECT
          toStartOfHour(timestamp) as hour,
          page_url,
          count() as views,
          uniq(session_id) as unique_sessions,
          uniq(user_id) as unique_users
        FROM events
        WHERE event_type = 'page_view'
        GROUP BY hour, page_url
      `
    });

    // Create aggregated table for page views
    await client.command({
      query: `
        CREATE TABLE IF NOT EXISTS page_views_agg (
          hour DateTime,
          page_url String,
          views UInt64,
          unique_sessions UInt64,
          unique_users UInt64
        )
        ENGINE = SummingMergeTree()
        ORDER BY (hour, page_url)
        TTL hour + INTERVAL 1 YEAR
      `
    });

    // Create conversion funnel materialized view
    await client.command({
      query: `
        CREATE MATERIALIZED VIEW IF NOT EXISTS conversion_funnel_mv TO conversion_funnel_agg AS
        SELECT
          toStartOfDay(timestamp) as date,
          conversion_type,
          count() as conversions,
          sum(value) as total_value,
          uniq(session_id) as unique_sessions
        FROM conversions
        GROUP BY date, conversion_type
      `
    });

    // Create aggregated table for conversion funnel
    await client.command({
      query: `
        CREATE TABLE IF NOT EXISTS conversion_funnel_agg (
          date Date,
          conversion_type String,
          conversions UInt64,
          total_value Float64,
          unique_sessions UInt64
        )
        ENGINE = SummingMergeTree()
        ORDER BY (date, conversion_type)
        TTL date + INTERVAL 2 YEAR
      `
    });

    // Create real-time dashboard view
    await client.command({
      query: `
        CREATE VIEW IF NOT EXISTS realtime_dashboard AS
        SELECT
          count() as total_events,
          uniq(session_id) as active_sessions,
          uniq(user_id) as active_users,
          countIf(event_type = 'page_view') as page_views,
          countIf(event_type = 'calculator_start') as calculator_starts,
          countIf(event_type = 'calculator_complete') as calculator_completes
        FROM events
        WHERE timestamp >= now() - INTERVAL 1 HOUR
      `
    });

    // Create indexes for better performance
    await client.command({
      query: `ALTER TABLE events ADD INDEX IF NOT EXISTS idx_user_id user_id TYPE bloom_filter GRANULARITY 1`
    });

    await client.command({
      query: `ALTER TABLE events ADD INDEX IF NOT EXISTS idx_session_id session_id TYPE bloom_filter GRANULARITY 1`
    });

    await client.command({
      query: `ALTER TABLE sessions ADD INDEX IF NOT EXISTS idx_user_id user_id TYPE bloom_filter GRANULARITY 1`
    });

    logger.info('ClickHouse setup completed successfully');

    // Test the connection
    const result = await client.query({
      query: 'SELECT version()',
      format: 'JSONEachRow'
    });

    const version = await result.json();
    logger.info(`Connected to ClickHouse version: ${version[0]['version()']}`);

  } catch (error) {
    logger.error('Error setting up ClickHouse:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Run setup if called directly
if (require.main === module) {
  setupClickHouse()
    .then(() => {
      logger.info('ClickHouse setup script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('ClickHouse setup failed:', error);
      process.exit(1);
    });
}

module.exports = setupClickHouse;