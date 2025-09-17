const { Sequelize } = require('sequelize');
const config = require('../config');

class Database {
  constructor() {
    this.sequelize = null;
    this.isConnected = false;
  }

  async connect() {
    if (this.sequelize && this.isConnected) {
      return this.sequelize;
    }

    try {
      let sequelizeConfig;

      if (config.DATABASE_URL) {
        // Production: use DATABASE_URL
        sequelizeConfig = {
          dialect: 'postgres',
          protocol: 'postgres',
          dialectOptions: {
            ssl: config.NODE_ENV === 'production' ? {
              require: true,
              rejectUnauthorized: false
            } : false
          },
          pool: {
            max: 20,
            min: 0,
            acquire: 60000,
            idle: 10000
          },
          logging: config.NODE_ENV === 'development' ? console.log : false,
          define: {
            timestamps: true,
            underscored: true,
            underscoredAll: true
          }
        };

        this.sequelize = new Sequelize(config.DATABASE_URL, sequelizeConfig);
      } else {
        // Development: use individual config
        sequelizeConfig = {
          host: config.DB_HOST,
          port: config.DB_PORT,
          dialect: 'postgres',
          pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
          },
          logging: config.NODE_ENV === 'development' ? console.log : false,
          define: {
            timestamps: true,
            underscored: true,
            underscoredAll: true
          }
        };

        this.sequelize = new Sequelize(
          config.DB_NAME,
          config.DB_USERNAME,
          config.DB_PASSWORD,
          sequelizeConfig
        );
      }

      // Test the connection
      await this.sequelize.authenticate();
      console.log('Database connection established successfully');

      this.isConnected = true;
      return this.sequelize;

    } catch (error) {
      console.error('Unable to connect to database:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.sequelize) {
      await this.sequelize.close();
      this.sequelize = null;
      this.isConnected = false;
      console.log('Database connection closed');
    }
  }

  async sync(options = {}) {
    if (!this.sequelize) {
      throw new Error('Database not connected');
    }

    try {
      await this.sequelize.sync(options);
      console.log('Database synchronized');
    } catch (error) {
      console.error('Database sync failed:', error);
      throw error;
    }
  }

  async migrate() {
    if (!this.sequelize) {
      throw new Error('Database not connected');
    }

    try {
      const { Umzug, SequelizeStorage } = require('umzug');

      const umzug = new Umzug({
        migrations: {
          glob: 'migrations/*.js',
          resolve: ({ name, path, context }) => {
            const migration = require(path);
            return {
              name,
              up: async () => migration.up(context, Sequelize),
              down: async () => migration.down(context, Sequelize)
            };
          }
        },
        context: this.sequelize.getQueryInterface(),
        storage: new SequelizeStorage({ sequelize: this.sequelize }),
        logger: console
      });

      await umzug.up();
      console.log('Database migrations completed');

    } catch (error) {
      console.error('Database migration failed:', error);
      throw error;
    }
  }

  async seed() {
    if (!this.sequelize) {
      throw new Error('Database not connected');
    }

    try {
      const seedFiles = [
        'seeds/001-admin-user.js',
        'seeds/002-test-users.js'
      ];

      for (const seedFile of seedFiles) {
        try {
          const seed = require(`../${seedFile}`);
          await seed.up(this.sequelize.getQueryInterface(), Sequelize);
          console.log(`Seed ${seedFile} executed successfully`);
        } catch (error) {
          console.warn(`Seed ${seedFile} failed:`, error.message);
        }
      }

      console.log('Database seeding completed');

    } catch (error) {
      console.error('Database seeding failed:', error);
      throw error;
    }
  }

  async healthCheck() {
    try {
      if (!this.sequelize) {
        return {
          status: 'unhealthy',
          message: 'Database not connected'
        };
      }

      await this.sequelize.authenticate();

      return {
        status: 'healthy',
        message: 'Database connection is working',
        dialect: this.sequelize.getDialect(),
        version: await this.sequelize.databaseVersion()
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Database connection failed',
        error: error.message
      };
    }
  }

  getSequelize() {
    return this.sequelize;
  }

  isReady() {
    return this.isConnected && this.sequelize !== null;
  }
}

// Export singleton instance
const database = new Database();

module.exports = database;