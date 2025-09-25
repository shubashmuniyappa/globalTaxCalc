/**
 * Apollo Server Configuration
 * GraphQL server setup with comprehensive features
 */

const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const { ApolloServerPluginDrainHttpServer } = require('@apollo/server/plugin/drainHttpServer');
const { ApolloServerPluginLandingPageLocalDefault } = require('@apollo/server/plugin/landingPage/default');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { WebSocketServer } = require('ws');
const { useServer } = require('graphql-ws/lib/use/ws');
const { PubSub } = require('graphql-subscriptions');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');

// Import schema and resolvers
const { schema } = require('./schema');

// Import data sources
const TaxAPI = require('../datasources/taxAPI');
const UserAPI = require('../datasources/userAPI');
const BillingAPI = require('../datasources/billingAPI');
const ContentAPI = require('../datasources/contentAPI');
const AnalyticsAPI = require('../datasources/analyticsAPI');
const APIAPI = require('../datasources/apiAPI');

// Import monitoring and monetization
const { analytics, trackRequest, trackErrors } = require('../monitoring/analytics');
const { monetization, usageTrackingMiddleware } = require('../monetization/pricing');

// Initialize PubSub for subscriptions
const pubsub = new PubSub();

// Authentication function
const getUser = async (req) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return null;

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    return decoded;
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
};

// Context function
const createContext = async ({ req, res }) => {
  const user = await getUser(req);

  return {
    user,
    dataSources: {
      taxAPI: new TaxAPI(),
      userAPI: new UserAPI(),
      billingAPI: new BillingAPI(),
      contentAPI: new ContentAPI(),
      analyticsAPI: new AnalyticsAPI(),
      apiAPI: new APIAPI()
    },
    pubsub,
    req,
    res
  };
};

// Rate limiting configuration
const createRateLimiter = () => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Use API key if available, otherwise fall back to IP
      const apiKey = req.headers['x-api-key'];
      return apiKey || req.ip;
    },
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health' || req.path === '/graphql' && req.body?.query?.includes('health');
    }
  });
};

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://globaltaxcalc.com',
    'https://api.globaltaxcalc.com'
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

// Helmet security configuration
const helmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "wss:", "ws:"]
    }
  },
  crossOriginEmbedderPolicy: false
};

// Create Apollo Server with comprehensive configuration
const createApolloServer = async (httpServer) => {
  // WebSocket server for subscriptions
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql'
  });

  // GraphQL WebSocket server
  const serverCleanup = useServer(
    {
      schema,
      context: async (ctx) => {
        // Extract user from WebSocket connection
        const token = ctx.connectionParams?.authorization?.replace('Bearer ', '');
        let user = null;

        if (token) {
          try {
            user = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
          } catch (error) {
            console.error('WebSocket authentication error:', error);
          }
        }

        return {
          user,
          dataSources: {
            taxAPI: new TaxAPI(),
            userAPI: new UserAPI(),
            billingAPI: new BillingAPI(),
            contentAPI: new ContentAPI(),
            analyticsAPI: new AnalyticsAPI(),
            apiAPI: new APIAPI()
          },
          pubsub
        };
      }
    },
    wsServer
  );

  // Apollo Server configuration
  const server = new ApolloServer({
    schema,
    csrfPrevention: true,
    cache: 'bounded',
    plugins: [
      // Proper shutdown for the HTTP server
      ApolloServerPluginDrainHttpServer({ httpServer }),

      // Proper shutdown for the WebSocket server
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            }
          };
        }
      },

      // Custom plugin for logging and metrics
      {
        async requestDidStart() {
          return {
            async didResolveOperation(requestContext) {
              const { request, operationName } = requestContext;
              console.log(`GraphQL Operation: ${operationName || 'Anonymous'}`);

              // Track API usage for analytics
              if (requestContext.context.user) {
                // This would integrate with your analytics system
                // await trackAPIUsage(requestContext.context.user.id, operationName);
              }
            },

            async didEncounterErrors(requestContext) {
              const { errors } = requestContext;
              console.error('GraphQL Errors:', errors);

              // Log errors for monitoring
              errors.forEach(error => {
                console.error(`GraphQL Error: ${error.message}`, {
                  locations: error.locations,
                  path: error.path,
                  extensions: error.extensions
                });
              });
            }
          };
        }
      },

      // Development landing page
      process.env.NODE_ENV === 'development'
        ? ApolloServerPluginLandingPageLocalDefault({ embed: true })
        : undefined
    ].filter(Boolean),

    // Custom formatError for better error handling
    formatError: (err) => {
      // Log the error for debugging
      console.error('GraphQL Error Details:', {
        message: err.message,
        locations: err.locations,
        path: err.path,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });

      // Return appropriate error based on environment
      if (process.env.NODE_ENV === 'production') {
        // Don't expose internal errors in production
        if (err.message.includes('Database') || err.message.includes('Internal')) {
          return new Error('Internal server error');
        }
      }

      return err;
    },

    // Introspection and playground settings
    introspection: process.env.NODE_ENV !== 'production',
    playground: process.env.NODE_ENV !== 'production'
  });

  return server;
};

// Middleware setup function
const setupMiddleware = (app) => {
  // Security middleware
  app.use(helmet(helmetOptions));

  // CORS middleware
  app.use(cors(corsOptions));

  // Analytics and monitoring middleware
  app.use(trackRequest());
  app.use(trackErrors());

  // Usage tracking for monetization
  app.use(usageTrackingMiddleware());

  // Rate limiting
  app.use('/graphql', createRateLimiter());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      version: process.env.API_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // API documentation redirect
  app.get('/docs', (req, res) => {
    res.redirect('/graphql');
  });

  // API version endpoint
  app.get('/version', (req, res) => {
    res.json({
      version: process.env.API_VERSION || '1.0.0',
      name: 'GlobalTaxCalc API',
      description: 'Comprehensive tax calculation and financial services API',
      graphql: '/graphql',
      playground: process.env.NODE_ENV !== 'production' ? '/graphql' : null
    });
  });

  // Analytics dashboard endpoint
  app.get('/analytics/dashboard', (req, res) => {
    const dashboardData = analytics.generateDashboardData();
    res.json(dashboardData);
  });

  // Pricing tiers endpoint
  app.get('/pricing', (req, res) => {
    const pricing = monetization.getPricingTiers();
    res.json(pricing);
  });

  // Usage analytics endpoint
  app.get('/analytics/usage', (req, res) => {
    const usageAnalytics = monetization.getUsageAnalytics(req.query.timeRange);
    res.json(usageAnalytics);
  });
};

// Start server function
const startServer = async (app, httpServer, port = 4000) => {
  try {
    // Setup middleware
    setupMiddleware(app);

    // Create Apollo Server
    const server = await createApolloServer(httpServer);

    // Start the server
    await server.start();

    // Apply the Apollo GraphQL middleware
    app.use(
      '/graphql',
      expressMiddleware(server, {
        context: createContext
      })
    );

    console.log(`🚀 GraphQL server ready at http://localhost:${port}/graphql`);
    console.log(`🚀 GraphQL playground available at http://localhost:${port}/graphql`);
    console.log(`🚀 WebSocket server ready at ws://localhost:${port}/graphql`);
    console.log(`🔍 Health check available at http://localhost:${port}/health`);

    return server;
  } catch (error) {
    console.error('Failed to start Apollo Server:', error);
    process.exit(1);
  }
};

module.exports = {
  createApolloServer,
  setupMiddleware,
  startServer,
  createContext,
  createRateLimiter,
  corsOptions,
  helmetOptions
};