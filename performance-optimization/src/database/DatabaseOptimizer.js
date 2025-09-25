const { Pool } = require('pg');
const crypto = require('crypto');

class DatabaseOptimizer {
  constructor(options = {}) {
    this.config = {
      // Primary database configuration
      primary: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'globaltaxcalc',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,

        // Connection pool settings
        min: parseInt(process.env.DB_POOL_MIN) || 5,
        max: parseInt(process.env.DB_POOL_MAX) || 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        statement_timeout: 30000,
        query_timeout: 30000,

        // Performance optimizations
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        application_name: 'GlobalTaxCalc-Primary'
      },

      // Read replica configuration
      replica: {
        host: process.env.DB_REPLICA_HOST || process.env.DB_HOST || 'localhost',
        port: process.env.DB_REPLICA_PORT || process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'globaltaxcalc',
        user: process.env.DB_REPLICA_USER || process.env.DB_USER || 'postgres',
        password: process.env.DB_REPLICA_PASSWORD || process.env.DB_PASSWORD,

        // Replica pool settings (usually larger for read queries)
        min: parseInt(process.env.DB_REPLICA_POOL_MIN) || 8,
        max: parseInt(process.env.DB_REPLICA_POOL_MAX) || 30,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        statement_timeout: 60000,
        query_timeout: 60000,

        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        application_name: 'GlobalTaxCalc-Replica'
      },

      // Query optimization settings
      queryOptimization: {
        enablePreparedStatements: true,
        enableQueryPlan: process.env.NODE_ENV === 'development',
        slowQueryThreshold: 1000, // Log queries taking > 1 second
        enableQueryCache: true,
        cacheSize: 1000,
        cacheTTL: 300 // 5 minutes
      },

      // Sharding configuration
      sharding: {
        enabled: process.env.ENABLE_SHARDING === 'true',
        strategy: 'hash', // hash, range, directory
        shardKey: 'user_id',
        shards: []
      },

      ...options
    };

    this.pools = {};
    this.queryCache = new Map();
    this.preparedStatements = new Map();
    this.metrics = this.initializeMetrics();

    this.initializePools();
    this.setupQueryOptimization();
  }

  /**
   * Initialize database connection pools
   */
  initializePools() {
    // Primary database pool
    this.pools.primary = new Pool(this.config.primary);
    this.pools.primary.on('error', (err) => {
      console.error('Primary database pool error:', err);
      this.metrics.connectionErrors.primary++;
    });

    // Replica database pool
    if (this.config.replica.host !== this.config.primary.host) {
      this.pools.replica = new Pool(this.config.replica);
      this.pools.replica.on('error', (err) => {
        console.error('Replica database pool error:', err);
        this.metrics.connectionErrors.replica++;
      });
    } else {
      // Use primary as replica if no separate replica configured
      this.pools.replica = this.pools.primary;
    }

    // Setup pool monitoring
    setInterval(() => {
      this.updatePoolMetrics();
    }, 30000); // Every 30 seconds

    console.log('✅ Database connection pools initialized');
  }

  /**
   * Setup query optimization features
   */
  setupQueryOptimization() {
    // Clear query cache periodically
    if (this.config.queryOptimization.enableQueryCache) {
      setInterval(() => {
        this.clearExpiredCacheEntries();
      }, 60000); // Every minute
    }

    // Log slow queries
    if (this.config.queryOptimization.slowQueryThreshold) {
      this.enableSlowQueryLogging();
    }

    console.log('✅ Query optimization features enabled');
  }

  /**
   * Execute read query with automatic routing to replica
   */
  async executeReadQuery(sql, params = [], options = {}) {
    const {
      useCache = this.config.queryOptimization.enableQueryCache,
      cacheTTL = this.config.queryOptimization.cacheTTL,
      forceReplica = true,
      timeout = 30000
    } = options;

    const startTime = Date.now();
    const queryHash = this.generateQueryHash(sql, params);

    try {
      // Check query cache first
      if (useCache && this.queryCache.has(queryHash)) {
        const cached = this.queryCache.get(queryHash);
        if (Date.now() - cached.timestamp < cacheTTL * 1000) {
          this.metrics.cacheHits++;
          return cached.result;
        } else {
          this.queryCache.delete(queryHash);
        }
      }

      // Choose appropriate pool
      const pool = forceReplica ? this.pools.replica : this.pools.primary;

      // Execute query with timeout
      const result = await Promise.race([
        pool.query(sql, params),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Query timeout')), timeout)
        )
      ]);

      const executionTime = Date.now() - startTime;

      // Update metrics
      this.updateQueryMetrics('read', executionTime, true);

      // Cache result if enabled
      if (useCache && result.rows) {
        this.queryCache.set(queryHash, {
          result: result.rows,
          timestamp: Date.now()
        });

        // Limit cache size
        if (this.queryCache.size > this.config.queryOptimization.cacheSize) {
          const firstKey = this.queryCache.keys().next().value;
          this.queryCache.delete(firstKey);
        }
      }

      // Log slow queries
      if (executionTime > this.config.queryOptimization.slowQueryThreshold) {
        this.logSlowQuery(sql, params, executionTime);
      }

      return result.rows;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateQueryMetrics('read', executionTime, false);
      console.error('Read query error:', error);
      throw error;
    }
  }

  /**
   * Execute write query with automatic routing to primary
   */
  async executeWriteQuery(sql, params = [], options = {}) {
    const {
      returnResult = false,
      timeout = 30000,
      invalidateCache = true
    } = options;

    const startTime = Date.now();

    try {
      // Always use primary for writes
      const result = await Promise.race([
        this.pools.primary.query(sql, params),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Query timeout')), timeout)
        )
      ]);

      const executionTime = Date.now() - startTime;

      // Update metrics
      this.updateQueryMetrics('write', executionTime, true);

      // Invalidate related cache entries
      if (invalidateCache) {
        this.invalidateQueryCache(sql);
      }

      // Log slow queries
      if (executionTime > this.config.queryOptimization.slowQueryThreshold) {
        this.logSlowQuery(sql, params, executionTime);
      }

      return returnResult ? result.rows : result.rowCount;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateQueryMetrics('write', executionTime, false);
      console.error('Write query error:', error);
      throw error;
    }
  }

  /**
   * Execute transaction with automatic retry logic
   */
  async executeTransaction(queries, options = {}) {
    const {
      retryAttempts = 3,
      retryDelay = 1000,
      isolationLevel = 'READ_COMMITTED'
    } = options;

    let lastError;

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      const client = await this.pools.primary.connect();

      try {
        await client.query('BEGIN');

        if (isolationLevel !== 'READ_COMMITTED') {
          await client.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
        }

        const results = [];

        for (const { sql, params = [] } of queries) {
          const result = await client.query(sql, params);
          results.push(result.rows);
        }

        await client.query('COMMIT');

        this.metrics.transactionSuccess++;
        return results;

      } catch (error) {
        await client.query('ROLLBACK');
        lastError = error;

        this.metrics.transactionErrors++;

        // Check if error is retryable
        if (this.isRetryableError(error) && attempt < retryAttempts) {
          console.warn(`Transaction attempt ${attempt} failed, retrying...`, error.message);
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
          continue;
        }

        throw error;

      } finally {
        client.release();
      }
    }

    throw lastError;
  }

  /**
   * Execute batch insert with optimal performance
   */
  async executeBatchInsert(table, columns, values, options = {}) {
    const {
      batchSize = 1000,
      onConflict = null,
      returning = false
    } = options;

    if (values.length === 0) return [];

    const results = [];

    for (let i = 0; i < values.length; i += batchSize) {
      const batch = values.slice(i, i + batchSize);

      // Build parameterized query
      const placeholders = batch.map((_, rowIndex) => {
        const rowPlaceholders = columns.map((_, colIndex) => {
          return `$${rowIndex * columns.length + colIndex + 1}`;
        });
        return `(${rowPlaceholders.join(', ')})`;
      }).join(', ');

      const flatValues = batch.flat();

      let sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}`;

      if (onConflict) {
        sql += ` ${onConflict}`;
      }

      if (returning) {
        sql += ` RETURNING *`;
      }

      const result = await this.executeWriteQuery(sql, flatValues, { returnResult: returning });
      results.push(...(Array.isArray(result) ? result : [result]));
    }

    return results;
  }

  /**
   * Get database performance metrics
   */
  async getPerformanceMetrics() {
    try {
      // Get connection pool stats
      const poolStats = {
        primary: {
          totalCount: this.pools.primary.totalCount,
          idleCount: this.pools.primary.idleCount,
          waitingCount: this.pools.primary.waitingCount
        },
        replica: this.pools.replica !== this.pools.primary ? {
          totalCount: this.pools.replica.totalCount,
          idleCount: this.pools.replica.idleCount,
          waitingCount: this.pools.replica.waitingCount
        } : null
      };

      // Get database statistics
      const dbStats = await this.getDatabaseStatistics();

      // Get query cache stats
      const cacheStats = {
        size: this.queryCache.size,
        maxSize: this.config.queryOptimization.cacheSize,
        hitRatio: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100 || 0
      };

      return {
        pools: poolStats,
        database: dbStats,
        cache: cacheStats,
        queries: this.metrics,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error getting performance metrics:', error);
      return null;
    }
  }

  /**
   * Get database statistics from system tables
   */
  async getDatabaseStatistics() {
    const queries = {
      // Database size and connection info
      dbInfo: `
        SELECT
          pg_database_size(current_database()) as database_size,
          (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) as active_connections,
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
      `,

      // Table sizes and stats
      tableStats: `
        SELECT
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          seq_scan as sequential_scans,
          idx_scan as index_scans
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 10
      `,

      // Index usage
      indexStats: `
        SELECT
          schemaname,
          tablename,
          indexname,
          idx_scan as scans,
          idx_tup_read as tuples_read,
          idx_tup_fetch as tuples_fetched
        FROM pg_stat_user_indexes
        WHERE idx_scan > 0
        ORDER BY idx_scan DESC
        LIMIT 10
      `,

      // Long running queries
      longQueries: `
        SELECT
          pid,
          now() - pg_stat_activity.query_start AS duration,
          query
        FROM pg_stat_activity
        WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes'
        AND state = 'active'
      `
    };

    const results = {};

    for (const [key, sql] of Object.entries(queries)) {
      try {
        results[key] = await this.executeReadQuery(sql);
      } catch (error) {
        console.error(`Error executing ${key} query:`, error);
        results[key] = [];
      }
    }

    return results;
  }

  /**
   * Optimize database indexes
   */
  async optimizeIndexes() {
    const optimizations = [];

    try {
      // Find missing indexes
      const missingIndexes = await this.findMissingIndexes();
      optimizations.push(...missingIndexes);

      // Find unused indexes
      const unusedIndexes = await this.findUnusedIndexes();
      optimizations.push(...unusedIndexes);

      // Update table statistics
      await this.updateTableStatistics();
      optimizations.push({ type: 'statistics', message: 'Table statistics updated' });

      console.log(`✅ Database optimization completed: ${optimizations.length} recommendations`);
      return optimizations;

    } catch (error) {
      console.error('Error optimizing indexes:', error);
      throw error;
    }
  }

  /**
   * Find potentially missing indexes
   */
  async findMissingIndexes() {
    const sql = `
      SELECT
        schemaname,
        tablename,
        seq_scan,
        seq_tup_read,
        idx_scan,
        seq_tup_read / seq_scan as avg_seq_read
      FROM pg_stat_user_tables
      WHERE seq_scan > 1000
      AND seq_tup_read / seq_scan > 10000
      ORDER BY seq_tup_read DESC
    `;

    const results = await this.executeReadQuery(sql);

    return results.map(row => ({
      type: 'missing_index',
      table: `${row.schemaname}.${row.tablename}`,
      recommendation: `Consider adding index - high sequential scan ratio`,
      metrics: {
        sequentialScans: row.seq_scan,
        avgRowsPerScan: row.avg_seq_read
      }
    }));
  }

  /**
   * Find unused indexes
   */
  async findUnusedIndexes() {
    const sql = `
      SELECT
        schemaname,
        tablename,
        indexname,
        idx_scan
      FROM pg_stat_user_indexes
      WHERE idx_scan = 0
      AND schemaname = 'public'
    `;

    const results = await this.executeReadQuery(sql);

    return results.map(row => ({
      type: 'unused_index',
      table: `${row.schemaname}.${row.tablename}`,
      index: row.indexname,
      recommendation: 'Consider dropping unused index',
      metrics: {
        scans: row.idx_scan
      }
    }));
  }

  /**
   * Update table statistics for query planner
   */
  async updateTableStatistics() {
    const sql = `
      SELECT schemaname, tablename
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
    `;

    const tables = await this.executeReadQuery(sql);

    for (const table of tables) {
      try {
        await this.executeWriteQuery(
          `ANALYZE ${table.schemaname}.${table.tablename}`,
          []
        );
      } catch (error) {
        console.error(`Error analyzing table ${table.tablename}:`, error);
      }
    }
  }

  /**
   * Generate query hash for caching
   */
  generateQueryHash(sql, params) {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    const paramString = JSON.stringify(params);
    return crypto.createHash('md5').update(normalizedSql + paramString).digest('hex');
  }

  /**
   * Initialize metrics tracking
   */
  initializeMetrics() {
    return {
      queries: {
        read: { count: 0, totalTime: 0, errors: 0 },
        write: { count: 0, totalTime: 0, errors: 0 }
      },
      cacheHits: 0,
      cacheMisses: 0,
      transactionSuccess: 0,
      transactionErrors: 0,
      connectionErrors: { primary: 0, replica: 0 },
      slowQueries: 0
    };
  }

  /**
   * Update query metrics
   */
  updateQueryMetrics(type, executionTime, success) {
    if (success) {
      this.metrics.queries[type].count++;
      this.metrics.queries[type].totalTime += executionTime;
    } else {
      this.metrics.queries[type].errors++;
    }
  }

  /**
   * Update pool metrics
   */
  updatePoolMetrics() {
    // Pool metrics are automatically updated by pg Pool
    // This method can be extended for custom metrics
  }

  /**
   * Log slow query
   */
  logSlowQuery(sql, params, executionTime) {
    this.metrics.slowQueries++;
    console.warn(`Slow query detected (${executionTime}ms):`, {
      sql: sql.substring(0, 200),
      params: params.length,
      executionTime
    });
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCacheEntries() {
    const now = Date.now();
    const ttl = this.config.queryOptimization.cacheTTL * 1000;

    for (const [key, entry] of this.queryCache.entries()) {
      if (now - entry.timestamp > ttl) {
        this.queryCache.delete(key);
      }
    }
  }

  /**
   * Invalidate query cache based on table changes
   */
  invalidateQueryCache(sql) {
    // Extract table names from SQL
    const tablePattern = /(FROM|JOIN|UPDATE|INSERT INTO|DELETE FROM)\s+(\w+)/gi;
    const matches = sql.matchAll(tablePattern);
    const tables = new Set();

    for (const match of matches) {
      tables.add(match[2].toLowerCase());
    }

    // Remove cache entries that might be affected
    for (const [key, entry] of this.queryCache.entries()) {
      const shouldInvalidate = Array.from(tables).some(table =>
        key.includes(table)
      );

      if (shouldInvalidate) {
        this.queryCache.delete(key);
      }
    }
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    const retryableErrors = [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'serialization_failure',
      'deadlock_detected'
    ];

    return retryableErrors.some(retryableError =>
      error.message.includes(retryableError) || error.code === retryableError
    );
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('Shutting down database optimizer...');

    try {
      await this.pools.primary.end();
      if (this.pools.replica !== this.pools.primary) {
        await this.pools.replica.end();
      }

      console.log('✅ Database optimizer shutdown complete');
    } catch (error) {
      console.error('Error during database shutdown:', error);
    }
  }
}

module.exports = DatabaseOptimizer;