const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const config = require('./config');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'GlobalTaxCalc API Gateway',
      version: '1.0.0',
      description: 'Enterprise tax calculation platform API gateway and routing service',
      contact: {
        name: 'GlobalTaxCalc Team',
        email: 'api@globaltaxcalc.com',
        url: 'https://globaltaxcalc.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      },
      termsOfService: 'https://globaltaxcalc.com/terms'
    },
    servers: [
      {
        url: config.NODE_ENV === 'production'
          ? 'https://api.globaltaxcalc.com'
          : `http://localhost:${config.PORT}`,
        description: config.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for user authentication'
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for server-to-server communication'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['error', 'fail'],
              description: 'Error status'
            },
            message: {
              type: 'string',
              description: 'Error message'
            },
            code: {
              type: 'string',
              description: 'Error code'
            },
            requestId: {
              type: 'string',
              format: 'uuid',
              description: 'Unique request identifier'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Error timestamp'
            }
          },
          required: ['status', 'message', 'requestId', 'timestamp']
        },
        ValidationError: {
          type: 'object',
          allOf: [
            { $ref: '#/components/schemas/Error' },
            {
              type: 'object',
              properties: {
                details: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      field: {
                        type: 'string',
                        description: 'Field name with validation error'
                      },
                      message: {
                        type: 'string',
                        description: 'Validation error message'
                      },
                      value: {
                        description: 'Invalid value submitted'
                      }
                    }
                  }
                }
              }
            }
          ]
        },
        HealthCheck: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['healthy', 'unhealthy', 'degraded'],
              description: 'Service health status'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Health check timestamp'
            },
            service: {
              type: 'string',
              description: 'Service name'
            },
            version: {
              type: 'string',
              description: 'Service version'
            },
            uptime: {
              type: 'number',
              description: 'Service uptime in seconds'
            },
            environment: {
              type: 'string',
              enum: ['development', 'staging', 'production'],
              description: 'Environment'
            }
          },
          required: ['status', 'timestamp', 'service']
        },
        DetailedHealthCheck: {
          type: 'object',
          allOf: [
            { $ref: '#/components/schemas/HealthCheck' },
            {
              type: 'object',
              properties: {
                checks: {
                  type: 'object',
                  properties: {
                    redis: {
                      type: 'object',
                      properties: {
                        status: {
                          type: 'string',
                          enum: ['healthy', 'unhealthy']
                        },
                        responseTime: {
                          type: 'number',
                          description: 'Response time in milliseconds'
                        }
                      }
                    },
                    services: {
                      type: 'object',
                      properties: {
                        status: {
                          type: 'string',
                          enum: ['healthy', 'degraded', 'unhealthy']
                        },
                        total: {
                          type: 'number',
                          description: 'Total number of services'
                        },
                        healthy: {
                          type: 'number',
                          description: 'Number of healthy services'
                        },
                        unhealthy: {
                          type: 'number',
                          description: 'Number of unhealthy services'
                        }
                      }
                    }
                  }
                }
              }
            }
          ]
        },
        ApiInfo: {
          type: 'object',
          properties: {
            service: {
              type: 'string',
              description: 'Service name'
            },
            version: {
              type: 'string',
              description: 'API version'
            },
            environment: {
              type: 'string',
              description: 'Environment name'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Response timestamp'
            },
            uptime: {
              type: 'number',
              description: 'Service uptime in seconds'
            },
            services: {
              type: 'object',
              description: 'Registered microservices'
            }
          }
        }
      },
      responses: {
        '400': {
          description: 'Bad Request - Invalid input data',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ValidationError' }
            }
          }
        },
        '401': {
          description: 'Unauthorized - Authentication required',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        '403': {
          description: 'Forbidden - Insufficient permissions',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        '404': {
          description: 'Not Found - Resource does not exist',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        '429': {
          description: 'Too Many Requests - Rate limit exceeded',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          },
          headers: {
            'Retry-After': {
              schema: {
                type: 'integer'
              },
              description: 'Seconds to wait before retrying'
            }
          }
        },
        '500': {
          description: 'Internal Server Error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        '503': {
          description: 'Service Unavailable - Downstream service error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        }
      },
      parameters: {
        RequestId: {
          name: 'X-Request-ID',
          in: 'header',
          description: 'Unique request identifier',
          schema: {
            type: 'string',
            format: 'uuid'
          }
        },
        ClientVersion: {
          name: 'X-Client-Version',
          in: 'header',
          description: 'Client application version',
          schema: {
            type: 'string'
          }
        },
        Page: {
          name: 'page',
          in: 'query',
          description: 'Page number for pagination',
          schema: {
            type: 'integer',
            minimum: 1,
            default: 1
          }
        },
        Limit: {
          name: 'limit',
          in: 'query',
          description: 'Number of items per page',
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 20
          }
        }
      }
    },
    tags: [
      {
        name: 'Health',
        description: 'Health check and monitoring endpoints'
      },
      {
        name: 'Authentication',
        description: 'User authentication and authorization'
      },
      {
        name: 'Tax Calculation',
        description: 'Tax calculation services'
      },
      {
        name: 'Geolocation',
        description: 'Location-based tax services'
      },
      {
        name: 'AI Services',
        description: 'AI-powered tax optimization'
      },
      {
        name: 'Content',
        description: 'Content management and documentation'
      },
      {
        name: 'Analytics',
        description: 'Usage analytics and reporting'
      },
      {
        name: 'Notifications',
        description: 'Email and SMS notifications'
      },
      {
        name: 'File Management',
        description: 'File upload and processing'
      },
      {
        name: 'Reports',
        description: 'PDF and Excel report generation'
      }
    ],
    paths: {
      '/': {
        get: {
          summary: 'API Gateway Info',
          description: 'Get API gateway information and status',
          tags: ['Health'],
          responses: {
            '200': {
              description: 'API Gateway information',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      version: { type: 'string' },
                      documentation: { type: 'string' },
                      health: { type: 'string' },
                      status: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/health': {
        get: {
          summary: 'Basic Health Check',
          description: 'Get basic health status of the API Gateway',
          tags: ['Health'],
          responses: {
            '200': {
              description: 'Service is healthy',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/HealthCheck' }
                }
              }
            },
            '503': {
              description: 'Service is unhealthy',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/HealthCheck' }
                }
              }
            }
          }
        }
      },
      '/health/detailed': {
        get: {
          summary: 'Detailed Health Check',
          description: 'Get detailed health status including dependencies',
          tags: ['Health'],
          responses: {
            '200': {
              description: 'Detailed health information',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/DetailedHealthCheck' }
                }
              }
            },
            '503': {
              description: 'Service or dependencies are unhealthy',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/DetailedHealthCheck' }
                }
              }
            }
          }
        }
      },
      '/health/services': {
        get: {
          summary: 'Service Health Status',
          description: 'Get health status of all registered microservices',
          tags: ['Health'],
          responses: {
            '200': {
              description: 'Service health information',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string' },
                      timestamp: { type: 'string', format: 'date-time' },
                      summary: {
                        type: 'object',
                        properties: {
                          total: { type: 'number' },
                          healthy: { type: 'number' },
                          unhealthy: { type: 'number' },
                          healthPercentage: { type: 'number' }
                        }
                      },
                      services: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/v1/info': {
        get: {
          summary: 'API Information',
          description: 'Get comprehensive API information and service registry',
          tags: ['Health'],
          responses: {
            '200': {
              description: 'API information',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiInfo' }
                }
              }
            }
          }
        }
      }
    }
  },
  apis: ['./routes/*.js', './server.js'], // Paths to files containing OpenAPI definitions
};

const specs = swaggerJsdoc(options);

const swaggerOptions = {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info .title { color: #2c3e50; }
    .swagger-ui .scheme-container { background: #f8f9fa; padding: 15px; border-radius: 4px; }
  `,
  customSiteTitle: 'GlobalTaxCalc API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    defaultModelRendering: 'model',
    docExpansion: 'list',
    supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
    tryItOutEnabled: true,
    requestInterceptor: (req) => {
      req.headers['X-Client-Version'] = '1.0.0';
      return req;
    }
  }
};

module.exports = (app) => {
  // Serve Swagger documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerOptions));

  // Serve OpenAPI JSON spec
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });

  console.log('Swagger documentation available at /api-docs');
};