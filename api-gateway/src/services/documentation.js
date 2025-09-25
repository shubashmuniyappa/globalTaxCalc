/**
 * API Documentation Automation Service
 * Generates OpenAPI specifications, interactive docs, and SDKs
 */

const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const mustache = require('mustache');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/documentation.log' })
  ]
});

class DocumentationGenerator {
  constructor() {
    this.specs = new Map();
    this.templates = new Map();
    this.generatedDocs = new Map();

    this.initializeTemplates();
    this.initializeSwaggerConfig();
  }

  /**
   * Initialize documentation templates
   */
  async initializeTemplates() {
    try {
      // Load SDK templates
      const templatesDir = path.join(__dirname, '../templates');

      // JavaScript SDK template
      this.templates.set('javascript', await this.loadTemplate(templatesDir, 'javascript-sdk.mustache'));

      // Python SDK template
      this.templates.set('python', await this.loadTemplate(templatesDir, 'python-sdk.mustache'));

      // PHP SDK template
      this.templates.set('php', await this.loadTemplate(templatesDir, 'php-sdk.mustache'));

      // cURL examples template
      this.templates.set('curl', await this.loadTemplate(templatesDir, 'curl-examples.mustache'));

      // Postman collection template
      this.templates.set('postman', await this.loadTemplate(templatesDir, 'postman-collection.mustache'));

      logger.info('Documentation templates loaded');
    } catch (error) {
      logger.error('Error loading templates', error);
    }
  }

  /**
   * Load template file
   */
  async loadTemplate(templatesDir, filename) {
    try {
      const templatePath = path.join(templatesDir, filename);
      return await fs.readFile(templatePath, 'utf8');
    } catch (error) {
      logger.warn(`Template ${filename} not found, using default`);
      return this.getDefaultTemplate(filename);
    }
  }

  /**
   * Get default template if file doesn't exist
   */
  getDefaultTemplate(filename) {
    const defaultTemplates = {
      'javascript-sdk.mustache': `
/**
 * GlobalTaxCalc API Client
 * Generated on {{generatedDate}}
 */
class GlobalTaxCalcClient {
  constructor(apiKey, baseUrl = '{{baseUrl}}') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  {{#endpoints}}
  /**
   * {{description}}
   * @param {Object} params - Request parameters
   * @returns {Promise} API response
   */
  async {{methodName}}(params = {}) {
    const response = await fetch(\`\${this.baseUrl}{{path}}\`, {
      method: '{{method}}',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'Accept': 'application/json'
      },
      {{#hasBody}}body: JSON.stringify(params){{/hasBody}}
    });

    if (!response.ok) {
      throw new Error(\`API Error: \${response.status} \${response.statusText}\`);
    }

    return await response.json();
  }

  {{/endpoints}}
}

module.exports = GlobalTaxCalcClient;
      `,
      'python-sdk.mustache': `
"""
GlobalTaxCalc API Client
Generated on {{generatedDate}}
"""

import requests
import json
from typing import Dict, Any, Optional

class GlobalTaxCalcClient:
    def __init__(self, api_key: str, base_url: str = "{{baseUrl}}"):
        self.api_key = api_key
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'X-API-Key': api_key,
            'Accept': 'application/json'
        })

    {{#endpoints}}
    def {{methodName}}(self, **params) -> Dict[str, Any]:
        """
        {{description}}

        Args:
            **params: Request parameters

        Returns:
            Dict[str, Any]: API response

        Raises:
            requests.HTTPError: If the API request fails
        """
        url = f"{self.base_url}{{path}}"

        {{#hasBody}}
        response = self.session.{{method.lower}}(url, json=params)
        {{/hasBody}}
        {{^hasBody}}
        response = self.session.{{method.lower}}(url, params=params)
        {{/hasBody}}

        response.raise_for_status()
        return response.json()

    {{/endpoints}}
      `,
      'php-sdk.mustache': `
<?php
/**
 * GlobalTaxCalc API Client
 * Generated on {{generatedDate}}
 */

class GlobalTaxCalcClient {
    private $apiKey;
    private $baseUrl;
    private $httpClient;

    public function __construct($apiKey, $baseUrl = '{{baseUrl}}') {
        $this->apiKey = $apiKey;
        $this->baseUrl = $baseUrl;
        $this->httpClient = new \\GuzzleHttp\\Client();
    }

    {{#endpoints}}
    /**
     * {{description}}
     * @param array $params Request parameters
     * @return array API response
     * @throws \\Exception
     */
    public function {{methodName}}($params = []) {
        $response = $this->httpClient->request('{{method}}', $this->baseUrl . '{{path}}', [
            'headers' => [
                'Content-Type' => 'application/json',
                'X-API-Key' => $this->apiKey,
                'Accept' => 'application/json'
            ],
            {{#hasBody}}'json' => $params{{/hasBody}}
            {{^hasBody}}'query' => $params{{/hasBody}}
        ]);

        return json_decode($response->getBody(), true);
    }

    {{/endpoints}}
}
      `
    };

    return defaultTemplates[filename] || '';
  }

  /**
   * Initialize Swagger configuration
   */
  initializeSwaggerConfig() {
    this.swaggerConfig = {
      definition: {
        openapi: '3.0.0',
        info: {
          title: 'GlobalTaxCalc API Gateway',
          version: '2.0.0',
          description: 'Enterprise-grade API Gateway for GlobalTaxCalc.com',
          termsOfService: 'https://globaltaxcalc.com/terms',
          contact: {
            name: 'API Support',
            url: 'https://globaltaxcalc.com/support',
            email: 'api-support@globaltaxcalc.com'
          },
          license: {
            name: 'MIT',
            url: 'https://opensource.org/licenses/MIT'
          }
        },
        servers: [
          {
            url: 'https://api.globaltaxcalc.com',
            description: 'Production server'
          },
          {
            url: 'https://staging-api.globaltaxcalc.com',
            description: 'Staging server'
          },
          {
            url: 'http://localhost:3000',
            description: 'Development server'
          }
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
          },
          schemas: this.getCommonSchemas()
        },
        security: [
          { ApiKeyAuth: [] },
          { BearerAuth: [] }
        ]
      },
      apis: ['./src/routes/*.js', './src/middleware/*.js'] // Paths to files containing OpenAPI definitions
    };
  }

  /**
   * Get common schemas for API documentation
   */
  getCommonSchemas() {
    return {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Request validation failed' },
              details: { type: 'array', items: { type: 'object' } }
            }
          }
        }
      },
      TaxCalculation: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
          taxYear: { type: 'integer', minimum: 2000, maximum: 2030 },
          grossIncome: { type: 'number', minimum: 0 },
          deductions: { type: 'number', minimum: 0 },
          taxAmount: { type: 'number', minimum: 0 },
          filingStatus: {
            type: 'string',
            enum: ['single', 'married-joint', 'married-separate', 'head-of-household']
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        },
        required: ['userId', 'taxYear', 'grossIncome', 'filingStatus']
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          firstName: { type: 'string', minLength: 1 },
          lastName: { type: 'string', minLength: 1 },
          tier: {
            type: 'string',
            enum: ['free', 'basic', 'premium', 'enterprise']
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      ApiKey: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          scopes: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['read', 'write', 'calculate', 'export', 'admin']
            }
          },
          tier: {
            type: 'string',
            enum: ['free', 'basic', 'premium', 'enterprise']
          },
          active: { type: 'boolean' },
          expiresAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      PaginationMeta: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 1000 },
          total: { type: 'integer', minimum: 0 },
          totalPages: { type: 'integer', minimum: 0 }
        }
      }
    };
  }

  /**
   * Generate OpenAPI specification
   */
  generateOpenAPISpec(version = 'v2') {
    try {
      const spec = swaggerJSDoc(this.swaggerConfig);

      // Add version-specific information
      spec.info.version = version;
      spec.servers = spec.servers.map(server => ({
        ...server,
        url: server.url.replace('/api/', `/api/${version}/`)
      }));

      this.specs.set(version, spec);

      logger.info(`OpenAPI spec generated for version ${version}`);
      return spec;
    } catch (error) {
      logger.error('Error generating OpenAPI spec', error);
      throw error;
    }
  }

  /**
   * Generate interactive documentation
   */
  generateInteractiveDocs(version = 'v2') {
    const spec = this.specs.get(version) || this.generateOpenAPISpec(version);

    const swaggerOptions = {
      explorer: true,
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: true
      },
      customCss: `
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info hgroup.main h2.title { color: #2c3e50; }
        .swagger-ui .scheme-container { background: #f8f9fa; padding: 20px; }
      `,
      customSiteTitle: 'GlobalTaxCalc API Documentation',
      customfavIcon: '/favicon.ico'
    };

    return {
      serve: swaggerUi.serve,
      setup: swaggerUi.setup(spec, swaggerOptions)
    };
  }

  /**
   * Generate SDK for specific language
   */
  async generateSDK(language, version = 'v2', options = {}) {
    try {
      const spec = this.specs.get(version) || this.generateOpenAPISpec(version);
      const template = this.templates.get(language);

      if (!template) {
        throw new Error(`Template for ${language} not found`);
      }

      const templateData = this.prepareTemplateData(spec, options);
      const generatedCode = mustache.render(template, templateData);

      // Store generated SDK
      const sdkKey = `${language}-${version}`;
      this.generatedDocs.set(sdkKey, {
        language,
        version,
        code: generatedCode,
        generatedAt: new Date().toISOString()
      });

      logger.info(`SDK generated for ${language} v${version}`);
      return generatedCode;
    } catch (error) {
      logger.error(`Error generating ${language} SDK`, error);
      throw error;
    }
  }

  /**
   * Prepare template data from OpenAPI spec
   */
  prepareTemplateData(spec, options = {}) {
    const endpoints = [];

    // Extract endpoints from paths
    Object.entries(spec.paths || {}).forEach(([path, methods]) => {
      Object.entries(methods).forEach(([method, definition]) => {
        if (typeof definition === 'object' && definition.operationId) {
          endpoints.push({
            path,
            method: method.toUpperCase(),
            methodName: this.camelCase(definition.operationId),
            operationId: definition.operationId,
            summary: definition.summary || '',
            description: definition.description || definition.summary || '',
            hasBody: ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()),
            parameters: definition.parameters || [],
            responses: definition.responses || {}
          });
        }
      });
    });

    return {
      baseUrl: options.baseUrl || spec.servers?.[0]?.url || 'https://api.globaltaxcalc.com',
      apiTitle: spec.info?.title || 'GlobalTaxCalc API',
      apiVersion: spec.info?.version || '2.0.0',
      apiDescription: spec.info?.description || '',
      generatedDate: new Date().toISOString(),
      endpoints,
      ...options
    };
  }

  /**
   * Generate Postman collection
   */
  async generatePostmanCollection(version = 'v2') {
    try {
      const spec = this.specs.get(version) || this.generateOpenAPISpec(version);

      const collection = {
        info: {
          name: `${spec.info?.title || 'GlobalTaxCalc API'} ${version}`,
          description: spec.info?.description || '',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
        },
        auth: {
          type: 'apikey',
          apikey: [
            { key: 'key', value: 'X-API-Key', type: 'string' },
            { key: 'value', value: '{{API_KEY}}', type: 'string' },
            { key: 'in', value: 'header', type: 'string' }
          ]
        },
        variable: [
          {
            key: 'baseUrl',
            value: spec.servers?.[0]?.url || 'https://api.globaltaxcalc.com',
            type: 'string'
          },
          {
            key: 'API_KEY',
            value: 'your-api-key-here',
            type: 'string'
          }
        ],
        item: []
      };

      // Convert OpenAPI paths to Postman items
      Object.entries(spec.paths || {}).forEach(([path, methods]) => {
        Object.entries(methods).forEach(([method, definition]) => {
          if (typeof definition === 'object' && definition.operationId) {
            const item = {
              name: definition.summary || definition.operationId,
              request: {
                method: method.toUpperCase(),
                header: [
                  { key: 'Content-Type', value: 'application/json' },
                  { key: 'Accept', value: 'application/json' }
                ],
                url: {
                  raw: `{{baseUrl}}${path}`,
                  host: ['{{baseUrl}}'],
                  path: path.split('/').filter(p => p)
                },
                description: definition.description || definition.summary || ''
              }
            };

            // Add request body for POST/PUT/PATCH
            if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
              item.request.body = {
                mode: 'raw',
                raw: JSON.stringify(this.generateExampleBody(definition), null, 2),
                options: {
                  raw: { language: 'json' }
                }
              };
            }

            collection.item.push(item);
          }
        });
      });

      this.generatedDocs.set(`postman-${version}`, collection);

      logger.info(`Postman collection generated for version ${version}`);
      return collection;
    } catch (error) {
      logger.error('Error generating Postman collection', error);
      throw error;
    }
  }

  /**
   * Generate example request body from schema
   */
  generateExampleBody(definition) {
    const requestBody = definition.requestBody?.content?.['application/json']?.schema;
    if (!requestBody) return {};

    return this.generateExampleFromSchema(requestBody);
  }

  /**
   * Generate example from JSON schema
   */
  generateExampleFromSchema(schema) {
    if (schema.example) return schema.example;

    switch (schema.type) {
      case 'object':
        const obj = {};
        if (schema.properties) {
          Object.entries(schema.properties).forEach(([key, prop]) => {
            obj[key] = this.generateExampleFromSchema(prop);
          });
        }
        return obj;

      case 'array':
        return schema.items ? [this.generateExampleFromSchema(schema.items)] : [];

      case 'string':
        if (schema.format === 'email') return 'user@example.com';
        if (schema.format === 'date-time') return new Date().toISOString();
        if (schema.format === 'uuid') return '123e4567-e89b-12d3-a456-426614174000';
        if (schema.enum) return schema.enum[0];
        return 'string';

      case 'number':
      case 'integer':
        return schema.minimum || 0;

      case 'boolean':
        return true;

      default:
        return null;
    }
  }

  /**
   * Generate code examples
   */
  async generateCodeExamples(endpoint, version = 'v2') {
    const spec = this.specs.get(version) || this.generateOpenAPISpec(version);
    const examples = {};

    // cURL example
    examples.curl = this.generateCurlExample(endpoint, spec);

    // JavaScript example
    examples.javascript = this.generateJavaScriptExample(endpoint, spec);

    // Python example
    examples.python = this.generatePythonExample(endpoint, spec);

    return examples;
  }

  /**
   * Generate cURL example
   */
  generateCurlExample(endpoint, spec) {
    const { path, method, definition } = endpoint;
    const baseUrl = spec.servers?.[0]?.url || 'https://api.globaltaxcalc.com';

    let curl = `curl -X ${method.toUpperCase()} "${baseUrl}${path}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Accept: application/json"`;

    if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      const body = this.generateExampleBody(definition);
      curl += ` \\
  -d '${JSON.stringify(body, null, 2)}'`;
    }

    return curl;
  }

  /**
   * Generate JavaScript example
   */
  generateJavaScriptExample(endpoint, spec) {
    const { path, method, definition } = endpoint;
    const baseUrl = spec.servers?.[0]?.url || 'https://api.globaltaxcalc.com';

    let js = `const response = await fetch('${baseUrl}${path}', {
  method: '${method.toUpperCase()}',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'YOUR_API_KEY',
    'Accept': 'application/json'
  }`;

    if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      const body = this.generateExampleBody(definition);
      js += `,
  body: JSON.stringify(${JSON.stringify(body, null, 2)})`;
    }

    js += `
});

const data = await response.json();
console.log(data);`;

    return js;
  }

  /**
   * Generate Python example
   */
  generatePythonExample(endpoint, spec) {
    const { path, method, definition } = endpoint;
    const baseUrl = spec.servers?.[0]?.url || 'https://api.globaltaxcalc.com';

    let python = `import requests
import json

url = "${baseUrl}${path}"
headers = {
    "Content-Type": "application/json",
    "X-API-Key": "YOUR_API_KEY",
    "Accept": "application/json"
}`;

    if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      const body = this.generateExampleBody(definition);
      python += `
data = ${JSON.stringify(body, null, 2)}

response = requests.${method.toLowerCase()}(url, headers=headers, json=data)`;
    } else {
      python += `

response = requests.${method.toLowerCase()}(url, headers=headers)`;
    }

    python += `
response.raise_for_status()
result = response.json()
print(result)`;

    return python;
  }

  /**
   * Convert string to camelCase
   */
  camelCase(str) {
    return str.replace(/[-_](.)/g, (_, char) => char.toUpperCase())
              .replace(/^(.)/, char => char.toLowerCase());
  }

  /**
   * Save generated documentation to file
   */
  async saveDocumentation(type, version, content, filename) {
    try {
      const outputDir = path.join(__dirname, '../generated-docs', version);
      await fs.mkdir(outputDir, { recursive: true });

      const filePath = path.join(outputDir, filename);
      await fs.writeFile(filePath, content);

      logger.info(`Documentation saved: ${filePath}`);
      return filePath;
    } catch (error) {
      logger.error('Error saving documentation', error);
      throw error;
    }
  }

  /**
   * Get documentation middleware
   */
  getDocumentationMiddleware() {
    return {
      // OpenAPI spec endpoint
      spec: (req, res) => {
        const version = req.params.version || 'v2';
        const spec = this.specs.get(version) || this.generateOpenAPISpec(version);

        res.set('Content-Type', 'application/json');
        res.json(spec);
      },

      // Interactive documentation
      docs: (version = 'v2') => {
        const docs = this.generateInteractiveDocs(version);
        return [docs.serve, docs.setup];
      },

      // SDK download endpoint
      sdk: async (req, res) => {
        try {
          const { language, version = 'v2' } = req.params;
          const sdk = await this.generateSDK(language, version);

          const filename = `globaltaxcalc-${language}-sdk-${version}.${this.getFileExtension(language)}`;

          res.set({
            'Content-Type': 'text/plain',
            'Content-Disposition': `attachment; filename="${filename}"`
          });
          res.send(sdk);
        } catch (error) {
          res.status(400).json({
            error: {
              code: 'SDK_GENERATION_ERROR',
              message: error.message
            }
          });
        }
      },

      // Postman collection endpoint
      postman: async (req, res) => {
        try {
          const version = req.params.version || 'v2';
          const collection = await this.generatePostmanCollection(version);

          res.set({
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="GlobalTaxCalc-API-${version}.postman_collection.json"`
          });
          res.json(collection);
        } catch (error) {
          res.status(500).json({
            error: {
              code: 'COLLECTION_GENERATION_ERROR',
              message: error.message
            }
          });
        }
      }
    };
  }

  /**
   * Get file extension for language
   */
  getFileExtension(language) {
    const extensions = {
      javascript: 'js',
      python: 'py',
      php: 'php',
      java: 'java',
      csharp: 'cs',
      ruby: 'rb',
      go: 'go'
    };

    return extensions[language] || 'txt';
  }

  /**
   * Get documentation statistics
   */
  getDocumentationStats() {
    return {
      totalSpecs: this.specs.size,
      totalGeneratedDocs: this.generatedDocs.size,
      availableLanguages: Array.from(this.templates.keys()),
      availableVersions: Array.from(this.specs.keys())
    };
  }
}

// Create singleton instance
let documentationGeneratorInstance;

function createDocumentationGenerator() {
  if (!documentationGeneratorInstance) {
    documentationGeneratorInstance = new DocumentationGenerator();
  }
  return documentationGeneratorInstance;
}

module.exports = {
  DocumentationGenerator,
  createDocumentationGenerator
};