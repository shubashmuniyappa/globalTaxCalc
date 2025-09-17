const { Pool } = require('pg');

class PostgresConnection {
  constructor() {
    this.pool = null;
  }

  async connect() {
    if (!this.pool) {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      this.pool.on('error', (err) => {
        console.error('Unexpected error on idle client', err);
        process.exit(-1);
      });
    }

    return this.pool;
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async query(text, params) {
    const pool = await this.connect();
    return pool.query(text, params);
  }
}

module.exports = new PostgresConnection();