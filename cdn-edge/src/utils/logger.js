/**
 * Logger - Enhanced logging with different levels and structured output
 */

export class Logger {
  constructor(options = {}) {
    this.level = options.level || 'info';
    this.enableConsole = options.enableConsole !== false;
    this.enableStructured = options.enableStructured !== false;
    this.environment = options.environment || 'production';
    this.service = options.service || 'edge-worker';
    this.version = options.version || '1.0.0';

    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4
    };

    this.colors = {
      error: '\x1b[31m', // Red
      warn: '\x1b[33m',  // Yellow
      info: '\x1b[36m',  // Cyan
      debug: '\x1b[32m', // Green
      trace: '\x1b[35m', // Magenta
      reset: '\x1b[0m'
    };

    this.logBuffer = [];
    this.maxBufferSize = 1000;
    this.flushInterval = 30000; // 30 seconds
    this.lastFlush = Date.now();

    // Start periodic flushing if in production
    if (this.environment === 'production') {
      this.startPeriodicFlush();
    }
  }

  /**
   * Error level logging
   */
  error(message, meta = {}, error = null) {
    this.log('error', message, meta, error);
  }

  /**
   * Warning level logging
   */
  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  /**
   * Info level logging
   */
  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  /**
   * Debug level logging
   */
  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  /**
   * Trace level logging
   */
  trace(message, meta = {}) {
    this.log('trace', message, meta);
  }

  /**
   * Main logging function
   */
  log(level, message, meta = {}, error = null) {
    // Check if this level should be logged
    if (this.levels[level] > this.levels[this.level]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logEntry = this.createLogEntry(level, message, meta, error, timestamp);

    // Console logging
    if (this.enableConsole) {
      this.logToConsole(logEntry);
    }

    // Buffer for batch processing
    if (this.enableStructured) {
      this.addToBuffer(logEntry);
    }

    // Immediate flush for errors
    if (level === 'error') {
      this.flush();
    }
  }

  /**
   * Create structured log entry
   */
  createLogEntry(level, message, meta, error, timestamp) {
    const entry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      service: this.service,
      version: this.version,
      environment: this.environment,
      ...meta
    };

    // Add error details if provided
    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }

    // Add trace ID if available
    if (meta.requestId) {
      entry.traceId = meta.requestId;
    }

    // Add performance metrics if available
    if (meta.duration) {
      entry.duration = meta.duration;
    }

    return entry;
  }

  /**
   * Log to console with formatting
   */
  logToConsole(logEntry) {
    const { timestamp, level, message, service, ...meta } = logEntry;
    const color = this.colors[level.toLowerCase()] || this.colors.info;
    const reset = this.colors.reset;

    if (this.environment === 'development') {
      // Colorized output for development
      console.log(
        `${color}[${timestamp}] ${level} ${service}:${reset} ${message}`,
        Object.keys(meta).length > 0 ? meta : ''
      );
    } else {
      // JSON output for production
      console.log(JSON.stringify(logEntry));
    }
  }

  /**
   * Add log entry to buffer
   */
  addToBuffer(logEntry) {
    this.logBuffer.push(logEntry);

    // Flush if buffer is full
    if (this.logBuffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  /**
   * Performance logging
   */
  performance(operation, duration, meta = {}) {
    this.info(`Performance: ${operation}`, {
      ...meta,
      duration,
      operation,
      type: 'performance'
    });
  }

  /**
   * Request logging
   */
  request(method, url, status, duration, meta = {}) {
    const level = status >= 400 ? 'warn' : 'info';
    this.log(level, `${method} ${url} ${status}`, {
      ...meta,
      method,
      url,
      status,
      duration,
      type: 'request'
    });
  }

  /**
   * Security event logging
   */
  security(event, meta = {}) {
    this.warn(`Security: ${event}`, {
      ...meta,
      event,
      type: 'security'
    });
  }

  /**
   * Cache operation logging
   */
  cache(operation, key, hit = null, meta = {}) {
    this.debug(`Cache: ${operation} ${key}`, {
      ...meta,
      operation,
      key,
      hit,
      type: 'cache'
    });
  }

  /**
   * Analytics event logging
   */
  analytics(event, data = {}) {
    this.info(`Analytics: ${event}`, {
      ...data,
      event,
      type: 'analytics'
    });
  }

  /**
   * Business logic logging
   */
  business(event, data = {}) {
    this.info(`Business: ${event}`, {
      ...data,
      event,
      type: 'business'
    });
  }

  /**
   * Integration logging
   */
  integration(service, operation, success, duration, meta = {}) {
    const level = success ? 'info' : 'error';
    this.log(level, `Integration: ${service} ${operation}`, {
      ...meta,
      service: service,
      operation,
      success,
      duration,
      type: 'integration'
    });
  }

  /**
   * Structured query logging
   */
  query(query, duration, results, meta = {}) {
    this.debug('Database query', {
      ...meta,
      query: this.sanitizeQuery(query),
      duration,
      results,
      type: 'query'
    });
  }

  /**
   * Sanitize query for logging (remove sensitive data)
   */
  sanitizeQuery(query) {
    if (typeof query !== 'string') {
      return query;
    }

    // Remove potential sensitive data
    return query
      .replace(/password\s*=\s*['"]\w+['"]/gi, "password='***'")
      .replace(/token\s*=\s*['"]\w+['"]/gi, "token='***'")
      .replace(/key\s*=\s*['"]\w+['"]/gi, "key='***'");
  }

  /**
   * Create child logger with additional context
   */
  child(meta = {}) {
    const childLogger = new Logger({
      level: this.level,
      enableConsole: this.enableConsole,
      enableStructured: this.enableStructured,
      environment: this.environment,
      service: this.service,
      version: this.version
    });

    // Override log method to include child meta
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = (level, message, childMeta = {}, error = null) => {
      originalLog(level, message, { ...meta, ...childMeta }, error);
    };

    return childLogger;
  }

  /**
   * Flush log buffer
   */
  async flush() {
    if (this.logBuffer.length === 0) {
      return;
    }

    const logs = [...this.logBuffer];
    this.logBuffer = [];
    this.lastFlush = Date.now();

    try {
      // Send to external logging service
      await this.sendToExternalService(logs);
    } catch (error) {
      console.error('Failed to flush logs:', error);
      // Re-add logs to buffer for retry
      this.logBuffer.unshift(...logs);
    }
  }

  /**
   * Send logs to external logging service
   */
  async sendToExternalService(logs) {
    // In production, this would send to services like:
    // - Cloudflare Logpush
    // - Datadog
    // - Splunk
    // - ELK Stack
    // - Custom logging endpoint

    if (this.environment === 'development') {
      // Just log to console in development
      logs.forEach(log => {
        if (log.level === 'ERROR') {
          console.error('DEV LOG:', log);
        }
      });
      return;
    }

    // Mock external service call
    try {
      const response = await fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${globalThis.LOG_API_KEY || 'mock-key'}`
        },
        body: JSON.stringify({
          logs,
          source: 'edge-worker',
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Logging service returned ${response.status}`);
      }

    } catch (error) {
      // If external service fails, we could:
      // 1. Store in KV for later retry
      // 2. Send to alternative service
      // 3. Just log to console as fallback
      console.error('External logging failed:', error.message);
    }
  }

  /**
   * Start periodic flushing
   */
  startPeriodicFlush() {
    setInterval(() => {
      if (Date.now() - this.lastFlush >= this.flushInterval) {
        this.flush();
      }
    }, this.flushInterval);
  }

  /**
   * Create request context logger
   */
  withRequest(request, context = {}) {
    const url = new URL(request.url);
    const requestMeta = {
      requestId: context.requestId || crypto.randomUUID(),
      method: request.method,
      url: url.pathname + url.search,
      userAgent: request.headers.get('User-Agent') || 'unknown',
      clientIP: context.clientIP || 'unknown',
      country: context.country || 'unknown',
      region: context.colo || 'unknown'
    };

    return this.child(requestMeta);
  }

  /**
   * Create performance timer
   */
  timer(operation) {
    const startTime = Date.now();

    return {
      end: (meta = {}) => {
        const duration = Date.now() - startTime;
        this.performance(operation, duration, meta);
        return duration;
      }
    };
  }

  /**
   * Log with automatic error handling
   */
  safely(fn, context = 'operation') {
    try {
      return fn();
    } catch (error) {
      this.error(`Error in ${context}`, { context }, error);
      throw error;
    }
  }

  /**
   * Log async operation with automatic error handling
   */
  async safelyAsync(fn, context = 'async operation') {
    try {
      return await fn();
    } catch (error) {
      this.error(`Error in ${context}`, { context }, error);
      throw error;
    }
  }

  /**
   * Create sampling logger (only log percentage of events)
   */
  sample(percentage = 10) {
    const shouldLog = Math.random() * 100 < percentage;

    if (!shouldLog) {
      // Return a no-op logger
      return {
        error: () => {},
        warn: () => {},
        info: () => {},
        debug: () => {},
        trace: () => {},
        performance: () => {},
        request: () => {},
        security: () => {},
        cache: () => {},
        analytics: () => {},
        business: () => {},
        integration: () => {},
        query: () => {}
      };
    }

    return this;
  }

  /**
   * Get logging statistics
   */
  getStats() {
    return {
      bufferSize: this.logBuffer.length,
      maxBufferSize: this.maxBufferSize,
      lastFlush: this.lastFlush,
      flushInterval: this.flushInterval,
      level: this.level,
      environment: this.environment,
      service: this.service
    };
  }

  /**
   * Set log level
   */
  setLevel(level) {
    if (this.levels.hasOwnProperty(level)) {
      this.level = level;
    } else {
      this.warn(`Invalid log level: ${level}`);
    }
  }

  /**
   * Enable/disable console logging
   */
  setConsoleLogging(enabled) {
    this.enableConsole = enabled;
  }

  /**
   * Enable/disable structured logging
   */
  setStructuredLogging(enabled) {
    this.enableStructured = enabled;
  }

  /**
   * Force flush all pending logs
   */
  async forceFlush() {
    await this.flush();
  }

  /**
   * Get recent logs (for debugging)
   */
  getRecentLogs(count = 100) {
    return this.logBuffer.slice(-count);
  }

  /**
   * Clear log buffer
   */
  clearBuffer() {
    this.logBuffer = [];
  }
}