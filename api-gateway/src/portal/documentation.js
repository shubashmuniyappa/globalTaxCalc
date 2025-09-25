/**
 * Developer Portal Documentation System
 * Generates and serves interactive API documentation
 */

const express = require('express');
const path = require('path');
const { buildSchema, getIntrospectionQuery, introspectionFromSchema } = require('graphql');
const { versionManager } = require('../middleware/versioning');

class DocumentationPortal {
  constructor() {
    this.router = express.Router();
    this.setupRoutes();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.documentationCache = new Map();
  }

  setupRoutes() {
    // Main developer portal
    this.router.get('/', this.renderPortalHome.bind(this));

    // API documentation by version
    this.router.get('/docs/:version?', this.renderAPIDocs.bind(this));

    // Interactive GraphQL playground
    this.router.get('/playground/:version?', this.renderGraphQLPlayground.bind(this));

    // OpenAPI/Swagger documentation
    this.router.get('/openapi/:version?', this.generateOpenAPI.bind(this));

    // Code examples
    this.router.get('/examples/:language?', this.renderCodeExamples.bind(this));

    // SDKs and downloads
    this.router.get('/sdks', this.renderSDKs.bind(this));

    // Getting started guide
    this.router.get('/getting-started', this.renderGettingStarted.bind(this));

    // Authentication guide
    this.router.get('/authentication', this.renderAuthGuide.bind(this));

    // Rate limiting information
    this.router.get('/rate-limits', this.renderRateLimits.bind(this));

    // Webhooks documentation
    this.router.get('/webhooks', this.renderWebhooks.bind(this));

    // Changelog
    this.router.get('/changelog', this.renderChangelog.bind(this));

    // API status and health
    this.router.get('/status', this.renderAPIStatus.bind(this));

    // Search documentation
    this.router.get('/search', this.searchDocumentation.bind(this));

    // API testing console
    this.router.get('/console', this.renderTestConsole.bind(this));

    // Developer tools
    this.router.get('/tools', this.renderDeveloperTools.bind(this));
  }

  // Render portal home page
  async renderPortalHome(req, res) {
    const portalData = {
      title: 'GlobalTaxCalc Developer Portal',
      versions: versionManager.getAllVersions(),
      features: [
        'GraphQL API with real-time subscriptions',
        'RESTful endpoints for legacy compatibility',
        'Comprehensive tax calculation engine',
        'Multi-currency support',
        'AI-powered tax optimization',
        'Enterprise-grade security',
        'Developer-friendly SDKs',
        'Extensive documentation'
      ],
      quickStart: {
        steps: [
          'Sign up for a developer account',
          'Generate your API key',
          'Make your first API call',
          'Explore the documentation'
        ]
      },
      endpoints: {
        graphql: `${req.protocol}://${req.get('host')}/graphql`,
        rest: `${req.protocol}://${req.get('host')}/api/v2`,
        websocket: `ws://${req.get('host')}/graphql`
      }
    };

    res.json(portalData);
  }

  // Render API documentation
  async renderAPIDocs(req, res) {
    const version = req.params.version || versionManager.defaultVersion;
    const cacheKey = `docs-${version}`;

    // Check cache first
    if (this.documentationCache.has(cacheKey)) {
      const cached = this.documentationCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return res.json(cached.data);
      }
    }

    try {
      const versionInfo = versionManager.getVersionInfo(version);
      if (!versionInfo) {
        return res.status(404).json({ error: 'Version not found' });
      }

      const documentation = {
        version,
        info: versionInfo,
        sections: {
          overview: this.generateOverviewDocs(version),
          authentication: this.generateAuthDocs(version),
          graphql: this.generateGraphQLDocs(version),
          rest: this.generateRESTDocs(version),
          examples: this.generateExampleDocs(version),
          errors: this.generateErrorDocs(version),
          rateLimits: this.generateRateLimitDocs(version),
          webhooks: this.generateWebhookDocs(version)
        }
      };

      // Cache the documentation
      this.documentationCache.set(cacheKey, {
        data: documentation,
        timestamp: Date.now()
      });

      res.json(documentation);
    } catch (error) {
      console.error('Error generating documentation:', error);
      res.status(500).json({ error: 'Failed to generate documentation' });
    }
  }

  // Generate overview documentation
  generateOverviewDocs(version) {
    return {
      title: 'API Overview',
      description: 'GlobalTaxCalc provides a comprehensive API for tax calculations, user management, and financial services.',
      baseUrl: process.env.API_BASE_URL || 'https://api.globaltaxcalc.com',
      features: [
        'Real-time tax calculations for multiple countries',
        'User authentication and profile management',
        'Subscription and billing management',
        'Content management for educational resources',
        'Analytics and reporting',
        'API management and developer tools'
      ],
      architecture: {
        type: 'GraphQL with REST fallback',
        realTime: 'WebSocket subscriptions',
        versioning: 'Header-based and URL-based',
        authentication: 'JWT tokens and API keys'
      }
    };
  }

  // Generate authentication documentation
  generateAuthDocs(version) {
    return {
      title: 'Authentication',
      methods: [
        {
          name: 'API Key',
          description: 'Use X-API-Key header for server-to-server authentication',
          example: {
            header: 'X-API-Key: gtc_your_api_key_here'
          },
          rateLimits: {
            basic: '1,000 requests/hour',
            professional: '5,000 requests/hour',
            enterprise: '10,000 requests/hour'
          }
        },
        {
          name: 'JWT Bearer Token',
          description: 'Use Authorization header with Bearer token for user authentication',
          example: {
            header: 'Authorization: Bearer your_jwt_token_here'
          },
          rateLimits: {
            default: '1,000 requests/hour per user'
          }
        }
      ],
      gettingStarted: {
        steps: [
          'Register for a developer account',
          'Create an application in the developer portal',
          'Generate your API key',
          'Include the API key in your requests'
        ]
      },
      security: {
        encryption: 'All API calls must use HTTPS',
        keyRotation: 'API keys can be rotated without downtime',
        permissions: 'Granular permission system available'
      }
    };
  }

  // Generate GraphQL documentation
  generateGraphQLDocs(version) {
    return {
      title: 'GraphQL API',
      endpoint: '/graphql',
      features: [
        'Single endpoint for all operations',
        'Real-time subscriptions',
        'Introspection support',
        'Flexible query structure',
        'Type safety'
      ],
      operations: {
        queries: [
          'calculateTax - Calculate taxes for given income',
          'user - Get user information',
          'subscriptionPlans - List available subscription plans',
          'articles - Get educational content'
        ],
        mutations: [
          'saveTaxCalculation - Save calculation results',
          'updateProfile - Update user profile',
          'subscribe - Create subscription',
          'createApiKey - Generate new API key'
        ],
        subscriptions: [
          'taxCalculationUpdated - Real-time calculation updates',
          'userActivityUpdate - User activity notifications',
          'billingEvent - Billing notifications'
        ]
      },
      playground: '/portal/playground',
      introspection: '/graphql?query=' + encodeURIComponent(getIntrospectionQuery())
    };
  }

  // Generate REST documentation
  generateRESTDocs(version) {
    return {
      title: 'REST API (Legacy)',
      baseUrl: `/api/v${version.split('.')[0]}`,
      note: 'REST API is maintained for backward compatibility. New features are GraphQL-only.',
      endpoints: [
        {
          method: 'POST',
          path: '/tax/calculate',
          description: 'Calculate taxes',
          parameters: ['income', 'country', 'filingStatus'],
          response: 'TaxCalculation object'
        },
        {
          method: 'GET',
          path: '/user/profile',
          description: 'Get user profile',
          authentication: 'Required',
          response: 'User object'
        },
        {
          method: 'GET',
          path: '/subscription/plans',
          description: 'List subscription plans',
          response: 'Array of SubscriptionPlan objects'
        }
      ]
    };
  }

  // Generate code examples
  generateExampleDocs(version) {
    return {
      title: 'Code Examples',
      languages: {
        javascript: {
          name: 'JavaScript/Node.js',
          examples: [
            {
              title: 'Calculate Tax (GraphQL)',
              code: `
const query = \`
  query CalculateTax($input: TaxCalculationInput!) {
    calculateTax(input: $input) {
      totalTax
      effectiveRate
      breakdown {
        federalTax
        stateTax
        localTax
      }
    }
  }
\`;

const variables = {
  input: {
    income: 75000,
    country: "US",
    state: "CA",
    filingStatus: "SINGLE"
  }
};

const response = await fetch('/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your_api_key_here'
  },
  body: JSON.stringify({ query, variables })
});

const result = await response.json();
console.log(result.data.calculateTax);
              `
            }
          ]
        },
        python: {
          name: 'Python',
          examples: [
            {
              title: 'Calculate Tax (GraphQL)',
              code: `
import requests

query = """
query CalculateTax($input: TaxCalculationInput!) {
  calculateTax(input: $input) {
    totalTax
    effectiveRate
    breakdown {
      federalTax
      stateTax
      localTax
    }
  }
}
"""

variables = {
    "input": {
        "income": 75000,
        "country": "US",
        "state": "CA",
        "filingStatus": "SINGLE"
    }
}

response = requests.post(
    'https://api.globaltaxcalc.com/graphql',
    json={'query': query, 'variables': variables},
    headers={'X-API-Key': 'your_api_key_here'}
)

result = response.json()
print(result['data']['calculateTax'])
              `
            }
          ]
        },
        curl: {
          name: 'cURL',
          examples: [
            {
              title: 'Calculate Tax (GraphQL)',
              code: `
curl -X POST https://api.globaltaxcalc.com/graphql \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your_api_key_here" \\
  -d '{
    "query": "query CalculateTax($input: TaxCalculationInput!) { calculateTax(input: $input) { totalTax effectiveRate breakdown { federalTax stateTax localTax } } }",
    "variables": {
      "input": {
        "income": 75000,
        "country": "US",
        "state": "CA",
        "filingStatus": "SINGLE"
      }
    }
  }'
              `
            }
          ]
        }
      }
    };
  }

  // Generate error documentation
  generateErrorDocs(version) {
    return {
      title: 'Error Handling',
      format: 'GraphQL errors follow the GraphQL specification',
      httpCodes: {
        200: 'Success (even with GraphQL errors)',
        400: 'Bad Request (invalid query syntax)',
        401: 'Unauthorized (invalid or missing authentication)',
        403: 'Forbidden (insufficient permissions)',
        429: 'Too Many Requests (rate limit exceeded)',
        500: 'Internal Server Error'
      },
      graphqlErrors: [
        {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required',
          example: { errors: [{ message: 'Authentication required', extensions: { code: 'UNAUTHENTICATED' } }] }
        },
        {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
          example: { errors: [{ message: 'Insufficient permissions', extensions: { code: 'FORBIDDEN' } }] }
        },
        {
          code: 'BAD_USER_INPUT',
          message: 'Invalid input provided',
          example: { errors: [{ message: 'Invalid country code', extensions: { code: 'BAD_USER_INPUT' } }] }
        }
      ]
    };
  }

  // Generate rate limit documentation
  generateRateLimitDocs(version) {
    return {
      title: 'Rate Limits',
      description: 'API calls are rate limited to ensure fair usage and system stability',
      limits: {
        apiKey: {
          basic: '1,000 requests per hour',
          professional: '5,000 requests per hour',
          enterprise: '10,000 requests per hour'
        },
        jwt: '1,000 requests per hour per user',
        anonymous: '50 requests per hour per IP'
      },
      headers: {
        'X-RateLimit-Limit': 'Request limit per window',
        'X-RateLimit-Remaining': 'Requests remaining in current window',
        'X-RateLimit-Reset': 'Time when the rate limit resets',
        'Retry-After': 'Seconds to wait before retrying (when rate limited)'
      },
      upgrade: 'Contact sales for higher rate limits'
    };
  }

  // Generate webhook documentation
  generateWebhookDocs(version) {
    return {
      title: 'Webhooks',
      description: 'Receive real-time notifications about events in your account',
      events: [
        {
          name: 'calculation.completed',
          description: 'Fired when a tax calculation is completed',
          payload: { calculationId: 'string', userId: 'string', result: 'object' }
        },
        {
          name: 'subscription.updated',
          description: 'Fired when a subscription is modified',
          payload: { subscriptionId: 'string', userId: 'string', changes: 'object' }
        },
        {
          name: 'payment.succeeded',
          description: 'Fired when a payment is processed successfully',
          payload: { paymentId: 'string', amount: 'number', currency: 'string' }
        }
      ],
      security: {
        signature: 'All webhooks are signed with HMAC-SHA256',
        header: 'X-Webhook-Signature',
        verification: 'Verify the signature to ensure authenticity'
      },
      retries: 'Failed webhooks are retried with exponential backoff'
    };
  }

  // Render GraphQL Playground
  async renderGraphQLPlayground(req, res) {
    const version = req.params.version || versionManager.defaultVersion;

    const playgroundHTML = `
<!DOCTYPE html>
<html>
<head>
  <title>GraphQL Playground - GlobalTaxCalc API v${version}</title>
  <link rel="stylesheet" href="//cdn.jsdelivr.net/npm/graphql-playground-react/build/static/css/index.css" />
</head>
<body>
  <div id="root">
    <style>
      body { margin: 0; }
      #root { height: 100vh; }
    </style>
  </div>
  <script src="//cdn.jsdelivr.net/npm/graphql-playground-react/build/static/js/middleware.js"></script>
  <script>
    window.GraphQLPlayground.init(document.getElementById('root'), {
      endpoint: '/graphql',
      settings: {
        'general.betaUpdates': false,
        'editor.theme': 'dark',
        'editor.reuseHeaders': true,
        'tracing.hideTracingResponse': true,
        'editor.fontSize': 14,
        'editor.fontFamily': '"Source Code Pro", "Consolas", "Inconsolata", "Droid Sans Mono", "Monaco", monospace',
        'request.credentials': 'include',
      },
      headers: {
        'API-Version': '${version}'
      },
      tabs: [{
        endpoint: '/graphql',
        query: \`# Welcome to GlobalTaxCalc GraphQL API v${version}
#
# This is an interactive GraphQL playground where you can:
# - Explore the API schema (click "DOCS" on the right)
# - Write and test queries
# - View real-time results
#
# Example query:
query GetAPIInfo {
  apiInfo {
    version
    description
    features
    endpoints {
      graphql
      rest
    }
  }
}

# Don't forget to add your API key in the headers:
# {
#   "X-API-Key": "your_api_key_here"
# }\`,
      }]
    })
  </script>
</body>
</html>`;

    res.send(playgroundHTML);
  }

  // Generate OpenAPI specification
  async generateOpenAPI(req, res) {
    const version = req.params.version || versionManager.defaultVersion;

    const openApiSpec = {
      openapi: '3.0.0',
      info: {
        title: 'GlobalTaxCalc API',
        version: version,
        description: 'Comprehensive tax calculation and financial services API',
        contact: {
          name: 'API Support',
          email: 'api@globaltaxcalc.com',
          url: 'https://docs.globaltaxcalc.com'
        },
        license: {
          name: 'Commercial',
          url: 'https://globaltaxcalc.com/license'
        }
      },
      servers: [
        {
          url: `${req.protocol}://${req.get('host')}/api/v${version.split('.')[0]}`,
          description: `Production server v${version}`
        }
      ],
      security: [
        { ApiKeyAuth: [] },
        { BearerAuth: [] }
      ],
      components: {
        securitySchemes: {
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key'
          },
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      },
      paths: this.generateOpenAPIPaths(version)
    };

    res.json(openApiSpec);
  }

  generateOpenAPIPaths(version) {
    return {
      '/tax/calculate': {
        post: {
          summary: 'Calculate taxes',
          tags: ['Tax Calculation'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    income: { type: 'number', example: 75000 },
                    country: { type: 'string', example: 'US' },
                    state: { type: 'string', example: 'CA' },
                    filingStatus: { type: 'string', enum: ['SINGLE', 'MARRIED_JOINTLY', 'MARRIED_SEPARATELY', 'HEAD_OF_HOUSEHOLD'] }
                  },
                  required: ['income', 'country', 'filingStatus']
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Tax calculation result',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      totalTax: { type: 'number' },
                      effectiveRate: { type: 'number' },
                      breakdown: {
                        type: 'object',
                        properties: {
                          federalTax: { type: 'number' },
                          stateTax: { type: 'number' },
                          localTax: { type: 'number' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    };
  }

  // Render code examples
  async renderCodeExamples(req, res) {
    const language = req.params.language || 'javascript';
    const examples = this.generateExampleDocs().languages;

    if (!examples[language]) {
      return res.status(404).json({ error: 'Language not found' });
    }

    res.json(examples[language]);
  }

  // Render SDKs page
  async renderSDKs(req, res) {
    const sdks = {
      title: 'Official SDKs',
      description: 'Official software development kits for popular programming languages',
      available: [
        {
          language: 'JavaScript/Node.js',
          status: 'available',
          version: '2.1.0',
          npm: '@globaltaxcalc/sdk-js',
          github: 'https://github.com/globaltaxcalc/sdk-js',
          docs: '/portal/sdks/javascript'
        },
        {
          language: 'Python',
          status: 'available',
          version: '2.1.0',
          pypi: 'globaltaxcalc-sdk',
          github: 'https://github.com/globaltaxcalc/sdk-python',
          docs: '/portal/sdks/python'
        },
        {
          language: 'Java',
          status: 'beta',
          version: '2.0.0-beta.1',
          maven: 'com.globaltaxcalc:sdk-java',
          github: 'https://github.com/globaltaxcalc/sdk-java',
          docs: '/portal/sdks/java'
        },
        {
          language: 'C#/.NET',
          status: 'coming soon',
          version: null,
          nuget: null,
          github: null,
          docs: null
        }
      ],
      community: [
        {
          language: 'Ruby',
          author: 'Community',
          github: 'https://github.com/community/globaltaxcalc-ruby',
          status: 'unofficial'
        }
      ]
    };

    res.json(sdks);
  }

  // Other render methods would be implemented similarly...
  async renderGettingStarted(req, res) {
    res.json({ title: 'Getting Started Guide', content: 'Implementation pending' });
  }

  async renderAuthGuide(req, res) {
    res.json({ title: 'Authentication Guide', content: 'Implementation pending' });
  }

  async renderRateLimits(req, res) {
    res.json(this.generateRateLimitDocs());
  }

  async renderWebhooks(req, res) {
    res.json(this.generateWebhookDocs());
  }

  async renderChangelog(req, res) {
    const changelog = versionManager.getAllVersions().map(version => ({
      version: version.version,
      releaseDate: version.releaseDate,
      status: version.status,
      changelog: version.changelog,
      breaking: version.breaking
    }));

    res.json({ title: 'API Changelog', versions: changelog });
  }

  async renderAPIStatus(req, res) {
    res.json({
      status: 'operational',
      version: versionManager.defaultVersion,
      uptime: process.uptime(),
      services: {
        api: 'operational',
        database: 'operational',
        cache: 'operational'
      }
    });
  }

  async searchDocumentation(req, res) {
    const query = req.query.q;
    if (!query) {
      return res.json({ results: [] });
    }

    // Implementation would search through documentation
    res.json({
      query,
      results: [
        { title: 'Calculate Tax', type: 'endpoint', url: '/portal/docs#calculate-tax' },
        { title: 'Authentication', type: 'guide', url: '/portal/authentication' }
      ]
    });
  }

  async renderTestConsole(req, res) {
    res.json({ title: 'API Test Console', content: 'Interactive console implementation pending' });
  }

  async renderDeveloperTools(req, res) {
    res.json({
      title: 'Developer Tools',
      tools: [
        { name: 'Postman Collection', url: '/portal/tools/postman' },
        { name: 'Insomnia Collection', url: '/portal/tools/insomnia' },
        { name: 'OpenAPI Spec', url: '/portal/openapi' },
        { name: 'GraphQL Schema', url: '/graphql?sdl' }
      ]
    });
  }

  getRouter() {
    return this.router;
  }
}

module.exports = DocumentationPortal;