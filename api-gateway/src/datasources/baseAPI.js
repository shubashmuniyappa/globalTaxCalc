/**
 * Base API Data Source
 * Common functionality for all data sources
 */

const { RESTDataSource } = require('apollo-datasource-rest');
const { AuthenticationError, ForbiddenError, UserInputError } = require('apollo-server-express');

class BaseAPI extends RESTDataSource {
  constructor() {
    super();
    this.baseURL = process.env.API_BASE_URL || 'http://localhost:3000/api/v1';
  }

  willSendRequest(request) {
    // Add authentication headers
    if (this.context.user) {
      request.headers.set('Authorization', `Bearer ${this.context.user.token}`);
    }

    // Add API version header
    request.headers.set('API-Version', process.env.API_VERSION || '1.0.0');

    // Add request ID for tracing
    request.headers.set('X-Request-ID', this.generateRequestId());

    // Add user agent
    request.headers.set('User-Agent', 'GlobalTaxCalc-API-Gateway/1.0.0');
  }

  generateRequestId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async handleResponse(response) {
    if (response.ok) {
      return this.parseBody(response);
    }

    const error = await this.parseBody(response);

    switch (response.status) {
      case 401:
        throw new AuthenticationError(error.message || 'Authentication required');
      case 403:
        throw new ForbiddenError(error.message || 'Access denied');
      case 400:
        throw new UserInputError(error.message || 'Invalid input', {
          validationErrors: error.validationErrors
        });
      case 404:
        throw new Error('Resource not found');
      case 429:
        throw new Error('Rate limit exceeded');
      case 500:
        throw new Error('Internal server error');
      default:
        throw new Error(error.message || 'Unknown error occurred');
    }
  }

  // Helper methods for common operations
  buildQueryString(params) {
    const filtered = Object.fromEntries(
      Object.entries(params || {}).filter(([_, value]) => value !== undefined && value !== null)
    );
    return new URLSearchParams(filtered).toString();
  }

  paginate(items, { page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    const paginatedItems = items.slice(offset, offset + limit);

    return {
      items: paginatedItems,
      pagination: {
        page,
        limit,
        total: items.length,
        totalPages: Math.ceil(items.length / limit),
        hasNext: offset + limit < items.length,
        hasPrev: page > 1
      }
    };
  }

  // Cache helpers
  getCacheKey(type, id, params = {}) {
    const paramString = Object.keys(params).length
      ? `-${JSON.stringify(params)}`
      : '';
    return `${type}-${id}${paramString}`;
  }

  // Error logging
  logError(error, context = {}) {
    console.error('DataSource Error:', {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    });
  }

  // Validation helpers
  validateRequired(data, fields) {
    const missing = fields.filter(field => !data[field]);
    if (missing.length > 0) {
      throw new UserInputError(`Missing required fields: ${missing.join(', ')}`);
    }
  }

  validateEnum(value, allowedValues, fieldName) {
    if (!allowedValues.includes(value)) {
      throw new UserInputError(
        `Invalid ${fieldName}. Must be one of: ${allowedValues.join(', ')}`
      );
    }
  }

  // Transform helpers
  transformDates(obj) {
    const transformed = { ...obj };
    Object.keys(transformed).forEach(key => {
      if (transformed[key] && typeof transformed[key] === 'string') {
        // Check if it's an ISO date string
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(transformed[key])) {
          transformed[key] = new Date(transformed[key]);
        }
      }
    });
    return transformed;
  }

  // Retry mechanism for failed requests
  async withRetry(operation, maxRetries = 3, delay = 1000) {
    let lastError;

    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (i < maxRetries && this.isRetryableError(error)) {
          await this.sleep(delay * Math.pow(2, i)); // Exponential backoff
          continue;
        }

        break;
      }
    }

    throw lastError;
  }

  isRetryableError(error) {
    // Only retry on network errors or 5xx status codes
    return error.extensions?.response?.status >= 500 ||
           error.message.includes('network') ||
           error.message.includes('timeout');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Mock data helpers for development
  generateMockId() {
    return `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  createMockResponse(data, meta = {}) {
    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: this.generateRequestId(),
        ...meta
      }
    };
  }
}

module.exports = BaseAPI;