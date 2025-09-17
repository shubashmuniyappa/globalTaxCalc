const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const session = require('express-session');
const MongoStore = require('connect-mongo');

// Import configurations
const database = require('./config/database');
const redis = require('./config/redis');
const logger = require('./config/logger');

// Import routes
const apiRoutes = require('./routes');

// Import services for initialization
const geoipService = require('./services/geoipService');
const exchangeRatesService = require('./services/exchangeRatesService');

class GeolocationApp {
    constructor() {
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupMiddleware() {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "https:"],
                }
            }
        }));

        // CORS configuration
        this.app.use(cors({
            origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
        }));

        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: process.env.RATE_LIMIT_MAX || 1000, // Limit each IP to 1000 requests per windowMs
            message: {
                success: false,
                message: 'Too many requests from this IP, please try again later.',
                retryAfter: '15 minutes'
            },
            standardHeaders: true,
            legacyHeaders: false
        });
        this.app.use('/api/', limiter);

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Compression
        this.app.use(compression());

        // Logging
        if (process.env.NODE_ENV !== 'test') {
            this.app.use(morgan('combined', {
                stream: {
                    write: (message) => logger.info(message.trim())
                }
            }));
        }

        // Session configuration
        this.app.use(session({
            secret: process.env.SESSION_SECRET || 'geolocation-service-secret',
            resave: false,
            saveUninitialized: false,
            store: MongoStore.create({
                mongoUrl: process.env.MONGODB_URI,
                touchAfter: 24 * 3600 // lazy session update
            }),
            cookie: {
                secure: process.env.NODE_ENV === 'production',
                httpOnly: true,
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            }
        }));

        // Add request ID and timestamp
        this.app.use((req, res, next) => {
            req.id = Math.random().toString(36).substr(2, 9);
            req.timestamp = new Date().toISOString();

            // Add CORS headers for preflight requests
            if (req.method === 'OPTIONS') {
                res.header('Access-Control-Allow-Origin', req.headers.origin);
                res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
                res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
                res.sendStatus(200);
            } else {
                next();
            }
        });
    }

    setupRoutes() {
        // Mount API routes
        this.app.use('/api', apiRoutes);

        // Root endpoint
        this.app.get('/', (req, res) => {
            res.json({
                success: true,
                service: 'Geolocation & Tax Rules Service',
                version: process.env.npm_package_version || '1.0.0',
                status: 'running',
                timestamp: new Date().toISOString(),
                documentation: '/api'
            });
        });

        // Handle 404
        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                message: 'Endpoint not found',
                path: req.originalUrl,
                method: req.method,
                timestamp: new Date().toISOString()
            });
        });
    }

    setupErrorHandling() {
        // Global error handler
        this.app.use((error, req, res, next) => {
            const status = error.status || error.statusCode || 500;
            const message = error.message || 'Internal server error';

            logger.error('Global error handler:', {
                error: error.message,
                stack: error.stack,
                url: req.url,
                method: req.method,
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });

            res.status(status).json({
                success: false,
                message: process.env.NODE_ENV === 'development' ? message : 'Internal server error',
                error: process.env.NODE_ENV === 'development' ? {
                    message: error.message,
                    stack: error.stack
                } : undefined,
                timestamp: new Date().toISOString(),
                requestId: req.id
            });
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception:', error);
            process.exit(1);
        });
    }

    async initialize() {
        try {
            logger.info('Initializing Geolocation & Tax Rules Service...');

            // Connect to MongoDB
            await database.connect();
            logger.info('✓ MongoDB connected');

            // Connect to Redis
            await redis.connect();
            logger.info('✓ Redis connected');

            // Initialize GeoIP service
            await geoipService.initialize();
            logger.info('✓ GeoIP service initialized');

            // Initialize Exchange Rates service
            await exchangeRatesService.initialize();
            logger.info('✓ Exchange Rates service initialized');

            logger.info('🚀 All services initialized successfully');

        } catch (error) {
            logger.error('Failed to initialize services:', error);
            throw error;
        }
    }

    async start(port = process.env.PORT || 3001) {
        try {
            await this.initialize();

            const server = this.app.listen(port, () => {
                logger.info(`🌍 Geolocation & Tax Rules Service running on port ${port}`);
                logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
                logger.info(`🔗 API Documentation: http://localhost:${port}/api`);
            });

            // Graceful shutdown
            const gracefulShutdown = async (signal) => {
                logger.info(`${signal} received. Shutting down gracefully...`);

                server.close(async () => {
                    try {
                        await database.disconnect();
                        await redis.disconnect();
                        logger.info('✓ All connections closed');
                        process.exit(0);
                    } catch (error) {
                        logger.error('Error during shutdown:', error);
                        process.exit(1);
                    }
                });
            };

            process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
            process.on('SIGINT', () => gracefulShutdown('SIGINT'));

            return server;

        } catch (error) {
            logger.error('Failed to start server:', error);
            throw error;
        }
    }

    getApp() {
        return this.app;
    }
}

module.exports = GeolocationApp;