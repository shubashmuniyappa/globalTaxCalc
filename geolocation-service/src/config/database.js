const mongoose = require('mongoose');
const logger = require('./logger');

class DatabaseManager {
    constructor() {
        this.connection = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            // MongoDB connection options
            const options = {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                maxPoolSize: 10, // Maximum number of connections in the pool
                serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
                socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
                bufferMaxEntries: 0, // Disable mongoose buffering
                bufferCommands: false, // Disable mongoose buffering
                maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
                retryWrites: true,
                w: 'majority'
            };

            // Connect to MongoDB
            await mongoose.connect(process.env.MONGODB_URI, options);

            this.connection = mongoose.connection;
            this.isConnected = true;

            // Connection event handlers
            this.connection.on('connected', () => {
                logger.info('MongoDB connected successfully');
            });

            this.connection.on('error', (error) => {
                logger.error('MongoDB connection error:', error);
                this.isConnected = false;
            });

            this.connection.on('disconnected', () => {
                logger.warn('MongoDB disconnected');
                this.isConnected = false;
            });

            // Graceful shutdown
            process.on('SIGINT', async () => {
                await this.disconnect();
                process.exit(0);
            });

            logger.info('Database connection established');
            return this.connection;

        } catch (error) {
            logger.error('Database connection failed:', error);
            throw error;
        }
    }

    async disconnect() {
        try {
            if (this.connection) {
                await mongoose.connection.close();
                this.isConnected = false;
                logger.info('Database connection closed');
            }
        } catch (error) {
            logger.error('Error closing database connection:', error);
            throw error;
        }
    }

    async healthCheck() {
        try {
            if (!this.isConnected) {
                throw new Error('Database not connected');
            }

            // Ping the database
            await mongoose.connection.db.admin().ping();

            return {
                status: 'healthy',
                connected: this.isConnected,
                readyState: mongoose.connection.readyState,
                host: mongoose.connection.host,
                name: mongoose.connection.name,
                collections: Object.keys(mongoose.connection.collections).length
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                connected: false,
                error: error.message
            };
        }
    }

    getConnection() {
        return this.connection;
    }

    isHealthy() {
        return this.isConnected && mongoose.connection.readyState === 1;
    }
}

// Create singleton instance
const databaseManager = new DatabaseManager();

module.exports = {
    connect: () => databaseManager.connect(),
    disconnect: () => databaseManager.disconnect(),
    healthCheck: () => databaseManager.healthCheck(),
    getConnection: () => databaseManager.getConnection(),
    isHealthy: () => databaseManager.isHealthy(),
    mongoose
};