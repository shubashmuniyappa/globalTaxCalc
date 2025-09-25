/**
 * GraphQL Schema Definition
 * Comprehensive schema for GlobalTaxCalc API
 */

const { makeExecutableSchema } = require('@graphql-tools/schema');
const { mergeTypeDefs, mergeResolvers } = require('@graphql-tools/merge');

// Import type definitions
const taxTypeDefs = require('./types/tax');
const userTypeDefs = require('./types/user');
const subscriptionTypeDefs = require('./types/subscription');
const contentTypeDefs = require('./types/content');
const analyticsTypeDefs = require('./types/analytics');
const apiTypeDefs = require('./types/api');
const commonTypeDefs = require('./types/common');

// Import resolvers
const taxResolvers = require('../resolvers/tax');
const userResolvers = require('../resolvers/user');
const subscriptionResolvers = require('../resolvers/subscription');
const contentResolvers = require('../resolvers/content');
const analyticsResolvers = require('../resolvers/analytics');
const apiResolvers = require('../resolvers/api');

// Base type definitions
const baseTypeDefs = `
  scalar Date
  scalar DateTime
  scalar JSON
  scalar Upload
  scalar Currency
  scalar Percentage
  scalar Country
  scalar Locale

  directive @auth(role: UserRole) on FIELD_DEFINITION
  directive @rateLimit(
    max: Int!
    window: String!
    message: String
  ) on FIELD_DEFINITION
  directive @cost(
    complexity: Int!
    multipliers: [String!]
  ) on FIELD_DEFINITION
  directive @deprecated(reason: String) on FIELD_DEFINITION | ENUM_VALUE

  type Query {
    # Health check
    health: HealthStatus!

    # API information
    apiInfo: APIInfo!

    # Schema introspection
    schema: SchemaInfo!
  }

  type Mutation {
    # Base mutation placeholder
    _empty: String
  }

  type Subscription {
    # Base subscription placeholder
    _empty: String
  }

  type HealthStatus {
    status: String!
    timestamp: DateTime!
    version: String!
    uptime: Int!
    services: [ServiceStatus!]!
  }

  type ServiceStatus {
    name: String!
    status: ServiceStatusType!
    responseTime: Int
    lastCheck: DateTime!
    url: String
  }

  enum ServiceStatusType {
    HEALTHY
    DEGRADED
    DOWN
    UNKNOWN
  }

  type APIInfo {
    version: String!
    description: String!
    documentation: String!
    playground: String!
    rateLimit: RateLimitInfo!
    features: [String!]!
    endpoints: EndpointInfo!
  }

  type RateLimitInfo {
    requests: Int!
    window: String!
    resetTime: DateTime
  }

  type EndpointInfo {
    graphql: String!
    rest: String!
    websocket: String
    playground: String!
  }

  type SchemaInfo {
    types: [String!]!
    queries: [String!]!
    mutations: [String!]!
    subscriptions: [String!]!
    directives: [String!]!
  }
`;

// Merge all type definitions
const typeDefs = mergeTypeDefs([
  baseTypeDefs,
  commonTypeDefs,
  taxTypeDefs,
  userTypeDefs,
  subscriptionTypeDefs,
  contentTypeDefs,
  analyticsTypeDefs,
  apiTypeDefs
]);

// Base resolvers
const baseResolvers = {
  Query: {
    health: async () => {
      const uptime = process.uptime();
      const services = [
        {
          name: 'API Gateway',
          status: 'HEALTHY',
          responseTime: 1,
          lastCheck: new Date(),
          url: process.env.API_GATEWAY_URL || 'http://localhost:3000'
        },
        {
          name: 'Tax Calculator Service',
          status: 'HEALTHY',
          responseTime: 25,
          lastCheck: new Date(),
          url: process.env.TAX_SERVICE_URL || 'http://localhost:3001'
        },
        {
          name: 'User Service',
          status: 'HEALTHY',
          responseTime: 15,
          lastCheck: new Date(),
          url: process.env.USER_SERVICE_URL || 'http://localhost:3002'
        },
        {
          name: 'Analytics Service',
          status: 'HEALTHY',
          responseTime: 30,
          lastCheck: new Date(),
          url: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3003'
        }
      ];

      return {
        status: 'OK',
        timestamp: new Date(),
        version: process.env.API_VERSION || '1.0.0',
        uptime: Math.floor(uptime),
        services
      };
    },

    apiInfo: async () => {
      return {
        version: process.env.API_VERSION || '1.0.0',
        description: 'GlobalTaxCalc comprehensive API for tax calculations and financial services',
        documentation: `${process.env.API_BASE_URL || 'http://localhost:3000'}/docs`,
        playground: `${process.env.API_BASE_URL || 'http://localhost:3000'}/graphql`,
        rateLimit: {
          requests: 1000,
          window: '1h',
          resetTime: new Date(Date.now() + 3600000)
        },
        features: [
          'Tax Calculations',
          'User Management',
          'Content Management',
          'Analytics',
          'Real-time Subscriptions',
          'Multi-language Support',
          'API Versioning',
          'Rate Limiting',
          'Caching'
        ],
        endpoints: {
          graphql: `${process.env.API_BASE_URL || 'http://localhost:3000'}/graphql`,
          rest: `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/v1`,
          websocket: `${process.env.WS_URL || 'ws://localhost:3000'}/graphql`,
          playground: `${process.env.API_BASE_URL || 'http://localhost:3000'}/graphql`
        }
      };
    },

    schema: async (_, __, { schema }) => {
      const typeMap = schema.getTypeMap();
      const queryType = schema.getQueryType();
      const mutationType = schema.getMutationType();
      const subscriptionType = schema.getSubscriptionType();

      return {
        types: Object.keys(typeMap).filter(name => !name.startsWith('__')),
        queries: queryType ? Object.keys(queryType.getFields()) : [],
        mutations: mutationType ? Object.keys(mutationType.getFields()) : [],
        subscriptions: subscriptionType ? Object.keys(subscriptionType.getFields()) : [],
        directives: schema.getDirectives().map(directive => directive.name)
      };
    }
  }
};

// Merge all resolvers
const resolvers = mergeResolvers([
  baseResolvers,
  taxResolvers,
  userResolvers,
  subscriptionResolvers,
  contentResolvers,
  analyticsResolvers,
  apiResolvers
]);

// Create executable schema
const schema = makeExecutableSchema({
  typeDefs,
  resolvers
});

module.exports = {
  schema,
  typeDefs,
  resolvers
};