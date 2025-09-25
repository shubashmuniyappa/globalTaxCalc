const Sentry = require('@sentry/node');
const { ProfilingIntegration } = require('@sentry/profiling-node');
const config = require('../config');

class SentryManager {
  constructor() {
    this.isInitialized = false;
    this.errorCategories = {
      'ValidationError': 'validation',
      'AuthenticationError': 'authentication',
      'AuthorizationError': 'authorization',
      'DatabaseError': 'database',
      'NetworkError': 'network',
      'TimeoutError': 'timeout',
      'RateLimitError': 'rate_limit',
      'BusinessLogicError': 'business_logic',
      'ExternalServiceError': 'external_service',
      'ConfigurationError': 'configuration'
    };
  }

  initialize() {
    if (!config.sentry.enabled) {
      console.log('Sentry is disabled in configuration');
      return;
    }

    if (!config.sentry.dsn) {
      console.warn('Sentry DSN not provided, skipping initialization');
      return;
    }

    try {
      Sentry.init({
        dsn: config.sentry.dsn,
        environment: config.sentry.environment,
        release: config.sentry.release,
        sampleRate: config.sentry.sampleRate,
        tracesSampleRate: config.sentry.tracesSampleRate,
        debug: config.server.env === 'development',

        integrations: [
          new Sentry.Integrations.Http({ breadcrumbs: true, tracing: true }),
          new Sentry.Integrations.Express({ app: null }),
          new Sentry.Integrations.OnUncaughtException(),
          new Sentry.Integrations.OnUnhandledRejection(),
          new ProfilingIntegration(),
        ],

        beforeSend: (event, hint) => {
          return this.enrichEvent(event, hint);
        },

        beforeBreadcrumb: (breadcrumb) => {
          return this.filterBreadcrumb(breadcrumb);
        },

        initialScope: {
          tags: {
            service: config.service.name,
            version: config.service.version,
            environment: config.service.environment,
            host: require('os').hostname()
          },
          context: {
            runtime: {
              name: 'node',
              version: process.version
            }
          }
        }
      });

      this.isInitialized = true;
      console.log('Sentry initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Sentry:', error);
    }
  }

  enrichEvent(event, hint) {
    if (!event) return event;

    const error = hint?.originalException;

    if (error) {
      event.tags = {
        ...event.tags,
        errorCategory: this.categorizeError(error),
        errorType: error.constructor.name,
        hasStack: !!error.stack
      };

      if (error.statusCode) {
        event.tags.statusCode = error.statusCode;
      }

      if (error.isOperational !== undefined) {
        event.tags.operational = error.isOperational;
      }

      event.contexts = {
        ...event.contexts,
        business: {
          feature: this.extractFeatureFromError(error),
          operation: this.extractOperationFromError(error),
          userId: this.extractUserIdFromError(error)
        }
      };
    }

    event.extra = {
      ...event.extra,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    };

    return event;
  }

  filterBreadcrumb(breadcrumb) {
    if (breadcrumb.category === 'http' && breadcrumb.data?.url?.includes('/health')) {
      return null;
    }

    if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
      return null;
    }

    return breadcrumb;
  }

  categorizeError(error) {
    if (!error) return 'unknown';

    const errorName = error.constructor.name;

    if (this.errorCategories[errorName]) {
      return this.errorCategories[errorName];
    }

    const message = error.message?.toLowerCase() || '';

    if (message.includes('timeout')) return 'timeout';
    if (message.includes('network') || message.includes('connection')) return 'network';
    if (message.includes('database') || message.includes('sql')) return 'database';
    if (message.includes('auth')) return 'authentication';
    if (message.includes('permission') || message.includes('forbidden')) return 'authorization';
    if (message.includes('validation') || message.includes('invalid')) return 'validation';
    if (message.includes('rate limit') || message.includes('too many')) return 'rate_limit';
    if (message.includes('external') || message.includes('api')) return 'external_service';
    if (message.includes('config')) return 'configuration';

    if (error.statusCode >= 400 && error.statusCode < 500) return 'client_error';
    if (error.statusCode >= 500) return 'server_error';

    return 'unknown';
  }

  extractFeatureFromError(error) {
    const stack = error.stack || '';

    if (stack.includes('calculation')) return 'tax_calculation';
    if (stack.includes('comparison')) return 'tax_comparison';
    if (stack.includes('report')) return 'report_generation';
    if (stack.includes('user')) return 'user_management';
    if (stack.includes('auth')) return 'authentication';
    if (stack.includes('payment')) return 'payment_processing';

    return 'unknown';
  }

  extractOperationFromError(error) {
    const stack = error.stack || '';
    const message = error.message || '';

    if (stack.includes('POST') || message.includes('create')) return 'create';
    if (stack.includes('GET') || message.includes('read') || message.includes('fetch')) return 'read';
    if (stack.includes('PUT') || stack.includes('PATCH') || message.includes('update')) return 'update';
    if (stack.includes('DELETE') || message.includes('delete')) return 'delete';

    return 'unknown';
  }

  extractUserIdFromError(error) {
    if (error.userId) return error.userId;
    if (error.context?.userId) return error.context.userId;
    if (error.req?.user?.id) return error.req.user.id;

    return null;
  }

  captureError(error, context = {}) {
    if (!this.isInitialized) {
      console.error('Sentry not initialized, logging error:', error);
      return null;
    }

    return Sentry.withScope((scope) => {
      if (context.user) {
        scope.setUser(context.user);
      }

      if (context.tags) {
        Object.entries(context.tags).forEach(([key, value]) => {
          scope.setTag(key, value);
        });
      }

      if (context.extra) {
        Object.entries(context.extra).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }

      if (context.level) {
        scope.setLevel(context.level);
      }

      if (context.fingerprint) {
        scope.setFingerprint(context.fingerprint);
      }

      return Sentry.captureException(error);
    });
  }

  captureMessage(message, level = 'info', context = {}) {
    if (!this.isInitialized) {
      console.log('Sentry not initialized, logging message:', message);
      return null;
    }

    return Sentry.withScope((scope) => {
      if (context.user) {
        scope.setUser(context.user);
      }

      if (context.tags) {
        Object.entries(context.tags).forEach(([key, value]) => {
          scope.setTag(key, value);
        });
      }

      if (context.extra) {
        Object.entries(context.extra).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }

      scope.setLevel(level);

      return Sentry.captureMessage(message);
    });
  }

  addBreadcrumb(breadcrumb) {
    if (!this.isInitialized) return;

    Sentry.addBreadcrumb(breadcrumb);
  }

  setUser(user) {
    if (!this.isInitialized) return;

    Sentry.setUser(user);
  }

  setTag(key, value) {
    if (!this.isInitialized) return;

    Sentry.setTag(key, value);
  }

  setExtra(key, value) {
    if (!this.isInitialized) return;

    Sentry.setExtra(key, value);
  }

  createExpressMiddleware() {
    if (!this.isInitialized) {
      return [(req, res, next) => next()];
    }

    return [
      Sentry.Handlers.requestHandler({
        user: ['id', 'email', 'username'],
        request: ['method', 'url', 'query_string', 'headers'],
        transaction: 'methodPath'
      }),

      Sentry.Handlers.tracingHandler(),

      (req, res, next) => {
        req.sentryTransaction = Sentry.getCurrentHub().getScope()?.getTransaction();

        this.addBreadcrumb({
          message: `${req.method} ${req.path}`,
          category: 'http',
          data: {
            method: req.method,
            path: req.path,
            query: req.query,
            ip: req.ip,
            userAgent: req.get('User-Agent')
          }
        });

        next();
      }
    ];
  }

  createExpressErrorHandler() {
    if (!this.isInitialized) {
      return (error, req, res, next) => next(error);
    }

    return Sentry.Handlers.errorHandler({
      shouldHandleError: (error) => {
        return error.status !== 404;
      }
    });
  }

  startTransaction(name, operation = 'unknown') {
    if (!this.isInitialized) return null;

    return Sentry.startTransaction({
      name,
      op: operation,
      tags: {
        service: config.service.name
      }
    });
  }

  async captureBusinessEvent(eventName, data = {}) {
    if (!this.isInitialized) return null;

    return this.captureMessage(`Business Event: ${eventName}`, 'info', {
      tags: {
        eventType: 'business',
        eventName
      },
      extra: {
        businessData: data,
        timestamp: new Date().toISOString()
      }
    });
  }

  async capturePerformanceMetric(operation, duration, metadata = {}) {
    if (!this.isInitialized) return null;

    const level = duration > 5000 ? 'warning' : 'info';

    return this.captureMessage(`Performance: ${operation}`, level, {
      tags: {
        eventType: 'performance',
        operation,
        slow: duration > 1000
      },
      extra: {
        duration,
        metadata,
        timestamp: new Date().toISOString()
      }
    });
  }

  configureScope(callback) {
    if (!this.isInitialized) return;

    Sentry.configureScope(callback);
  }

  flush(timeout = 5000) {
    if (!this.isInitialized) return Promise.resolve(true);

    return Sentry.flush(timeout);
  }

  close(timeout = 5000) {
    if (!this.isInitialized) return Promise.resolve(true);

    return Sentry.close(timeout);
  }

  getClient() {
    if (!this.isInitialized) return null;

    return Sentry.getCurrentHub().getClient();
  }

  isEnabled() {
    return this.isInitialized && config.sentry.enabled;
  }
}

const sentryManager = new SentryManager();

module.exports = {
  sentryManager,
  SentryManager,
  Sentry
};