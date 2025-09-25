/**
 * Request/Response Transformation Middleware
 * Handles data normalization, format conversion, and legacy compatibility
 */

const _ = require('lodash');
const winston = require('winston');
const { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLFloat, GraphQLList } = require('graphql');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/transformation.log' })
  ]
});

class DataTransformationEngine {
  constructor() {
    this.transformationRules = new Map();
    this.fieldMappings = new Map();
    this.validationSchemas = new Map();
    this.graphqlSchema = this.createGraphQLSchema();

    this.initializeTransformationRules();
  }

  /**
   * Initialize transformation rules for different versions and endpoints
   */
  initializeTransformationRules() {
    // V1 to V2 transformation rules
    this.transformationRules.set('v1-to-v2', {
      request: {
        // Transform snake_case to camelCase
        fieldMapping: {
          'user_id': 'userId',
          'tax_year': 'taxYear',
          'gross_income': 'grossIncome',
          'filing_status': 'filingStatus',
          'created_at': 'createdAt',
          'updated_at': 'updatedAt'
        },
        // Data type conversions
        typeConversions: {
          'tax_amount': 'number',
          'income_amount': 'number',
          'deduction_amount': 'number'
        },
        // Required field transformations
        requiredFields: ['userId', 'taxYear'],
        // Default values for missing fields
        defaults: {
          'currency': 'USD',
          'locale': 'en-US'
        }
      },
      response: {
        fieldMapping: {
          'userId': 'user_id',
          'taxYear': 'tax_year',
          'grossIncome': 'gross_income',
          'filingStatus': 'filing_status',
          'createdAt': 'created_at',
          'updatedAt': 'updated_at'
        },
        // Remove fields for older versions
        excludeFields: ['metadata', 'aiInsights']
      }
    });

    // V2 to V1 transformation rules
    this.transformationRules.set('v2-to-v1', {
      request: {
        fieldMapping: {
          'userId': 'user_id',
          'taxYear': 'tax_year',
          'grossIncome': 'gross_income',
          'filingStatus': 'filing_status',
          'createdAt': 'created_at',
          'updatedAt': 'updated_at'
        },
        // Flatten nested objects for v1 compatibility
        flatten: true,
        // Convert arrays to comma-separated strings
        arrayToString: ['tags', 'categories']
      },
      response: {
        fieldMapping: {
          'user_id': 'userId',
          'tax_year': 'taxYear',
          'gross_income': 'grossIncome',
          'filing_status': 'filingStatus',
          'created_at': 'createdAt',
          'updated_at': 'updatedAt'
        },
        // Add fields required by newer versions
        addFields: {
          'version': '1.0',
          'legacy': true
        }
      }
    });

    // Legacy API compatibility rules
    this.transformationRules.set('legacy-compatibility', {
      request: {
        // Convert XML to JSON
        xmlToJson: true,
        // Handle form-encoded data
        formUrlEncoded: true,
        // Convert date formats
        dateFormats: {
          'date': 'YYYY-MM-DD',
          'datetime': 'YYYY-MM-DDTHH:mm:ssZ'
        }
      },
      response: {
        // Support multiple response formats
        formats: ['json', 'xml', 'csv'],
        // Wrap response in envelope for legacy clients
        envelope: true,
        // Add status codes in response body
        includeStatus: true
      }
    });
  }

  /**
   * Main transformation middleware
   */
  middleware() {
    return (req, res, next) => {
      try {
        // Get API version and transformation rules
        const apiVersion = req.apiVersion?.resolved || '1.0.0';
        const transformationType = this.getTransformationType(req, apiVersion);

        // Transform request data
        if (req.body && Object.keys(req.body).length > 0) {
          req.body = this.transformRequest(req.body, transformationType, req);
        }

        if (req.query && Object.keys(req.query).length > 0) {
          req.query = this.transformRequest(req.query, transformationType, req);
        }

        // Intercept response to transform it
        this.interceptResponse(res, transformationType, req);

        // Add transformation info to request
        req.transformation = {
          type: transformationType,
          apiVersion: apiVersion,
          transformed: true
        };

        next();
      } catch (error) {
        logger.error('Transformation middleware error', error);
        res.status(500).json({
          error: {
            code: 'TRANSFORMATION_ERROR',
            message: 'Error processing request transformation'
          }
        });
      }
    };
  }

  /**
   * Determine transformation type based on request and version
   */
  getTransformationType(req, apiVersion) {
    const majorVersion = apiVersion.split('.')[0];
    const requestFormat = req.get('Content-Type') || '';
    const responseFormat = req.get('Accept') || '';

    // Determine transformation needed
    if (majorVersion === '1' && req.legacyMode) {
      return 'legacy-compatibility';
    } else if (majorVersion === '1') {
      return 'v1-to-v2';
    } else if (majorVersion === '2' && req.legacyMode) {
      return 'v2-to-v1';
    }

    return 'default';
  }

  /**
   * Transform request data
   */
  transformRequest(data, transformationType, req) {
    const rules = this.transformationRules.get(transformationType);
    if (!rules || !rules.request) {
      return data;
    }

    let transformed = _.cloneDeep(data);

    // Apply field mappings
    if (rules.request.fieldMapping) {
      transformed = this.applyFieldMapping(transformed, rules.request.fieldMapping);
    }

    // Apply type conversions
    if (rules.request.typeConversions) {
      transformed = this.applyTypeConversions(transformed, rules.request.typeConversions);
    }

    // Apply defaults
    if (rules.request.defaults) {
      transformed = { ...rules.request.defaults, ...transformed };
    }

    // Flatten nested objects if required
    if (rules.request.flatten) {
      transformed = this.flattenObject(transformed);
    }

    // Convert arrays to strings if required
    if (rules.request.arrayToString) {
      rules.request.arrayToString.forEach(field => {
        if (Array.isArray(transformed[field])) {
          transformed[field] = transformed[field].join(',');
        }
      });
    }

    // Handle XML to JSON conversion
    if (rules.request.xmlToJson && req.get('Content-Type')?.includes('xml')) {
      transformed = this.xmlToJson(transformed);
    }

    // Handle form URL encoded data
    if (rules.request.formUrlEncoded && req.get('Content-Type')?.includes('form-urlencoded')) {
      transformed = this.parseFormData(transformed);
    }

    // Apply date format conversions
    if (rules.request.dateFormats) {
      transformed = this.convertDateFormats(transformed, rules.request.dateFormats);
    }

    // Validate required fields
    if (rules.request.requiredFields) {
      this.validateRequiredFields(transformed, rules.request.requiredFields);
    }

    logger.debug('Request transformed', {
      transformationType,
      original: data,
      transformed
    });

    return transformed;
  }

  /**
   * Intercept and transform response
   */
  interceptResponse(res, transformationType, req) {
    const originalJson = res.json;
    const originalSend = res.send;
    const self = this;

    res.json = function(data) {
      const transformed = self.transformResponse(data, transformationType, req);
      return originalJson.call(this, transformed);
    };

    res.send = function(data) {
      if (typeof data === 'object') {
        const transformed = self.transformResponse(data, transformationType, req);
        return originalSend.call(this, transformed);
      }
      return originalSend.call(this, data);
    };
  }

  /**
   * Transform response data
   */
  transformResponse(data, transformationType, req) {
    const rules = this.transformationRules.get(transformationType);
    if (!rules || !rules.response) {
      return data;
    }

    let transformed = _.cloneDeep(data);

    // Apply field mappings
    if (rules.response.fieldMapping) {
      transformed = this.applyFieldMapping(transformed, rules.response.fieldMapping);
    }

    // Exclude fields for older versions
    if (rules.response.excludeFields) {
      rules.response.excludeFields.forEach(field => {
        delete transformed[field];
      });
    }

    // Add required fields
    if (rules.response.addFields) {
      transformed = { ...transformed, ...rules.response.addFields };
    }

    // Wrap in envelope if required
    if (rules.response.envelope) {
      transformed = {
        status: 'success',
        data: transformed,
        timestamp: new Date().toISOString(),
        version: req.apiVersion?.resolved
      };
    }

    // Include status in response body if required
    if (rules.response.includeStatus) {
      transformed.statusCode = res.statusCode;
      transformed.statusMessage = res.statusMessage;
    }

    // Handle different response formats
    if (rules.response.formats) {
      const acceptHeader = req.get('Accept') || 'application/json';

      if (acceptHeader.includes('xml')) {
        // Convert to XML format
        return this.jsonToXml(transformed);
      } else if (acceptHeader.includes('csv')) {
        // Convert to CSV format
        return this.jsonToCsv(transformed);
      }
    }

    logger.debug('Response transformed', {
      transformationType,
      original: data,
      transformed
    });

    return transformed;
  }

  /**
   * Apply field mapping transformations
   */
  applyFieldMapping(data, mapping) {
    if (Array.isArray(data)) {
      return data.map(item => this.applyFieldMapping(item, mapping));
    }

    if (data && typeof data === 'object') {
      const transformed = {};

      Object.keys(data).forEach(key => {
        const mappedKey = mapping[key] || key;
        const value = data[key];

        if (value && typeof value === 'object' && !Array.isArray(value)) {
          transformed[mappedKey] = this.applyFieldMapping(value, mapping);
        } else {
          transformed[mappedKey] = value;
        }
      });

      return transformed;
    }

    return data;
  }

  /**
   * Apply type conversions
   */
  applyTypeConversions(data, conversions) {
    Object.keys(conversions).forEach(field => {
      if (data[field] !== undefined) {
        const targetType = conversions[field];

        switch (targetType) {
          case 'number':
            data[field] = parseFloat(data[field]) || 0;
            break;
          case 'string':
            data[field] = String(data[field]);
            break;
          case 'boolean':
            data[field] = Boolean(data[field]);
            break;
          case 'array':
            if (!Array.isArray(data[field])) {
              data[field] = [data[field]];
            }
            break;
        }
      }
    });

    return data;
  }

  /**
   * Flatten nested objects
   */
  flattenObject(obj, prefix = '') {
    const flattened = {};

    Object.keys(obj).forEach(key => {
      const value = obj[key];
      const newKey = prefix ? `${prefix}_${key}` : key;

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(flattened, this.flattenObject(value, newKey));
      } else {
        flattened[newKey] = value;
      }
    });

    return flattened;
  }

  /**
   * Convert date formats
   */
  convertDateFormats(data, formats) {
    const moment = require('moment');

    Object.keys(formats).forEach(field => {
      if (data[field]) {
        const targetFormat = formats[field];
        const date = moment(data[field]);

        if (date.isValid()) {
          data[field] = date.format(targetFormat);
        }
      }
    });

    return data;
  }

  /**
   * Validate required fields
   */
  validateRequiredFields(data, requiredFields) {
    const missingFields = requiredFields.filter(field => !data[field]);

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
  }

  /**
   * Convert XML to JSON (simplified implementation)
   */
  xmlToJson(xmlString) {
    // This is a simplified implementation
    // In production, use a proper XML parser like xml2js
    try {
      const xml2js = require('xml2js');
      const parser = new xml2js.Parser();
      let result;

      parser.parseString(xmlString, (err, parsed) => {
        if (err) throw err;
        result = parsed;
      });

      return result;
    } catch (error) {
      logger.error('XML to JSON conversion error', error);
      return xmlString;
    }
  }

  /**
   * Convert JSON to XML
   */
  jsonToXml(data) {
    try {
      const js2xmlparser = require('js2xmlparser');
      return js2xmlparser.parse('response', data);
    } catch (error) {
      logger.error('JSON to XML conversion error', error);
      return JSON.stringify(data);
    }
  }

  /**
   * Convert JSON to CSV
   */
  jsonToCsv(data) {
    try {
      if (Array.isArray(data)) {
        if (data.length === 0) return '';

        const headers = Object.keys(data[0]);
        const csvHeaders = headers.join(',');
        const csvRows = data.map(row =>
          headers.map(header => {
            const value = row[header];
            return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
          }).join(',')
        );

        return [csvHeaders, ...csvRows].join('\n');
      } else {
        // Convert single object to CSV
        const headers = Object.keys(data);
        const values = headers.map(header => {
          const value = data[header];
          return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
        });

        return [headers.join(','), values.join(',')].join('\n');
      }
    } catch (error) {
      logger.error('JSON to CSV conversion error', error);
      return JSON.stringify(data);
    }
  }

  /**
   * Parse form data
   */
  parseFormData(data) {
    const qs = require('qs');

    if (typeof data === 'string') {
      return qs.parse(data);
    }

    return data;
  }

  /**
   * GraphQL endpoint support
   */
  createGraphQLSchema() {
    const TaxCalculationType = new GraphQLObjectType({
      name: 'TaxCalculation',
      fields: {
        id: { type: GraphQLString },
        userId: { type: GraphQLString },
        taxYear: { type: GraphQLString },
        grossIncome: { type: GraphQLFloat },
        taxAmount: { type: GraphQLFloat },
        filingStatus: { type: GraphQLString }
      }
    });

    return new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          taxCalculations: {
            type: new GraphQLList(TaxCalculationType),
            resolve: () => {
              // This would fetch from your data source
              return [];
            }
          }
        }
      })
    });
  }

  /**
   * GraphQL middleware
   */
  graphqlMiddleware() {
    const { graphqlHTTP } = require('express-graphql');

    return graphqlHTTP({
      schema: this.graphqlSchema,
      graphiql: process.env.NODE_ENV === 'development',
      customFormatErrorFn: (error) => {
        logger.error('GraphQL error', error);
        return {
          message: error.message,
          code: error.extensions?.code || 'GRAPHQL_ERROR'
        };
      }
    });
  }

  /**
   * Content negotiation middleware
   */
  contentNegotiation() {
    return (req, res, next) => {
      const acceptHeader = req.get('Accept') || 'application/json';

      // Set response format based on Accept header
      if (acceptHeader.includes('application/xml')) {
        res.format = 'xml';
      } else if (acceptHeader.includes('text/csv')) {
        res.format = 'csv';
      } else if (acceptHeader.includes('application/graphql')) {
        res.format = 'graphql';
      } else {
        res.format = 'json';
      }

      next();
    };
  }

  /**
   * Request normalization middleware
   */
  normalizationMiddleware() {
    return (req, res, next) => {
      // Normalize request data
      if (req.body) {
        req.body = this.normalizeData(req.body);
      }

      if (req.query) {
        req.query = this.normalizeData(req.query);
      }

      next();
    };
  }

  /**
   * Normalize data (trim strings, convert case, etc.)
   */
  normalizeData(data) {
    if (Array.isArray(data)) {
      return data.map(item => this.normalizeData(item));
    }

    if (data && typeof data === 'object') {
      const normalized = {};

      Object.keys(data).forEach(key => {
        const value = data[key];

        if (typeof value === 'string') {
          // Trim whitespace and normalize case
          normalized[key] = value.trim();
        } else if (value && typeof value === 'object') {
          normalized[key] = this.normalizeData(value);
        } else {
          normalized[key] = value;
        }
      });

      return normalized;
    }

    return data;
  }

  /**
   * Add custom transformation rule
   */
  addTransformationRule(name, rule) {
    this.transformationRules.set(name, rule);
    logger.info(`Added transformation rule: ${name}`);
  }

  /**
   * Remove transformation rule
   */
  removeTransformationRule(name) {
    this.transformationRules.delete(name);
    logger.info(`Removed transformation rule: ${name}`);
  }

  /**
   * Get transformation statistics
   */
  getTransformationStats() {
    return {
      totalRules: this.transformationRules.size,
      rules: Array.from(this.transformationRules.keys()),
      fieldMappings: this.fieldMappings.size,
      schemas: this.validationSchemas.size
    };
  }
}

// Create singleton instance
let transformationEngineInstance;

function createTransformationEngine() {
  if (!transformationEngineInstance) {
    transformationEngineInstance = new DataTransformationEngine();
  }
  return transformationEngineInstance;
}

module.exports = {
  DataTransformationEngine,
  createTransformationEngine
};