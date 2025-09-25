/**
 * Error Handler - Centralized error handling and reporting
 */

export class ErrorHandler {
  constructor() {
    this.errorTemplates = this.initializeErrorTemplates();
    this.errorCounts = new Map();
  }

  /**
   * Initialize error page templates
   */
  initializeErrorTemplates() {
    return {
      400: {
        title: 'Bad Request',
        message: 'The request could not be understood by the server.',
        suggestion: 'Please check your request and try again.',
        showDetails: false
      },
      401: {
        title: 'Unauthorized',
        message: 'Authentication is required to access this resource.',
        suggestion: 'Please log in and try again.',
        showDetails: false
      },
      403: {
        title: 'Access Forbidden',
        message: 'You do not have permission to access this resource.',
        suggestion: 'Please contact support if you believe this is an error.',
        showDetails: false
      },
      404: {
        title: 'Page Not Found',
        message: 'The requested page could not be found.',
        suggestion: 'Please check the URL or return to the homepage.',
        showDetails: false
      },
      429: {
        title: 'Too Many Requests',
        message: 'Too many requests have been made in a short period.',
        suggestion: 'Please wait a moment before trying again.',
        showDetails: true
      },
      500: {
        title: 'Internal Server Error',
        message: 'An unexpected error occurred on the server.',
        suggestion: 'Please try again later or contact support if the problem persists.',
        showDetails: false
      },
      502: {
        title: 'Bad Gateway',
        message: 'The server received an invalid response from an upstream server.',
        suggestion: 'Please try again in a few moments.',
        showDetails: false
      },
      503: {
        title: 'Service Unavailable',
        message: 'The service is temporarily unavailable.',
        suggestion: 'Please try again later.',
        showDetails: false
      },
      504: {
        title: 'Gateway Timeout',
        message: 'The server did not receive a timely response from an upstream server.',
        suggestion: 'Please try again in a few moments.',
        showDetails: false
      }
    };
  }

  /**
   * Create error response based on error type
   */
  createErrorResponse(error, request = null) {
    const errorInfo = this.analyzeError(error);
    const template = this.errorTemplates[errorInfo.status] || this.errorTemplates[500];

    // Track error for analytics
    this.trackError(errorInfo, request);

    // Determine response format based on request
    const acceptHeader = request?.headers?.get('Accept') || '';
    const isAPIRequest = request?.url?.includes('/api/') || acceptHeader.includes('application/json');

    if (isAPIRequest) {
      return this.createJSONErrorResponse(errorInfo, template);
    } else {
      return this.createHTMLErrorResponse(errorInfo, template, request);
    }
  }

  /**
   * Create specific error responses
   */
  createNotFoundResponse() {
    return this.createErrorResponse(new Error('Not Found'), null);
  }

  createRateLimitResponse(retryAfter = 60) {
    const error = new Error('Rate limit exceeded');
    error.status = 429;
    error.retryAfter = retryAfter;
    return this.createErrorResponse(error, null);
  }

  createMaintenanceResponse() {
    const error = new Error('Service temporarily unavailable for maintenance');
    error.status = 503;
    return this.createErrorResponse(error, null);
  }

  /**
   * Analyze error to extract relevant information
   */
  analyzeError(error) {
    const errorInfo = {
      status: error.status || 500,
      name: error.name || 'Error',
      message: error.message || 'An unexpected error occurred',
      stack: error.stack,
      timestamp: new Date().toISOString(),
      id: this.generateErrorId(),
      retryAfter: error.retryAfter,
      details: error.details || {}
    };

    // Extract additional context from common error types
    if (error.name === 'TypeError') {
      errorInfo.category = 'type_error';
    } else if (error.name === 'ReferenceError') {
      errorInfo.category = 'reference_error';
    } else if (error.name === 'SyntaxError') {
      errorInfo.category = 'syntax_error';
    } else if (error.message?.includes('timeout')) {
      errorInfo.category = 'timeout';
      errorInfo.status = 504;
    } else if (error.message?.includes('network')) {
      errorInfo.category = 'network';
      errorInfo.status = 502;
    } else {
      errorInfo.category = 'unknown';
    }

    return errorInfo;
  }

  /**
   * Create JSON error response for API requests
   */
  createJSONErrorResponse(errorInfo, template) {
    const responseBody = {
      error: {
        status: errorInfo.status,
        code: errorInfo.name.toLowerCase().replace(/error$/, ''),
        message: template.message,
        details: errorInfo.details,
        timestamp: errorInfo.timestamp,
        id: errorInfo.id
      }
    };

    // Add retry information for rate limiting
    if (errorInfo.retryAfter) {
      responseBody.error.retryAfter = errorInfo.retryAfter;
    }

    // Add stack trace in development
    if (this.isDevelopment() && template.showDetails) {
      responseBody.error.stack = errorInfo.stack;
      responseBody.error.originalMessage = errorInfo.message;
    }

    const headers = {
      'Content-Type': 'application/json',
      'X-Error-ID': errorInfo.id,
      'X-Error-Category': errorInfo.category
    };

    if (errorInfo.retryAfter) {
      headers['Retry-After'] = errorInfo.retryAfter.toString();
    }

    return new Response(JSON.stringify(responseBody), {
      status: errorInfo.status,
      headers
    });
  }

  /**
   * Create HTML error response for browser requests
   */
  createHTMLErrorResponse(errorInfo, template, request) {
    const html = this.generateErrorHTML(errorInfo, template, request);

    const headers = {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Error-ID': errorInfo.id,
      'X-Error-Category': errorInfo.category
    };

    if (errorInfo.retryAfter) {
      headers['Retry-After'] = errorInfo.retryAfter.toString();
    }

    return new Response(html, {
      status: errorInfo.status,
      headers
    });
  }

  /**
   * Generate HTML error page
   */
  generateErrorHTML(errorInfo, template, request) {
    const isDev = this.isDevelopment();
    const requestInfo = request ? {
      url: request.url,
      method: request.method,
      userAgent: request.headers?.get('User-Agent') || 'Unknown'
    } : null;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${errorInfo.status} - ${template.title}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #333;
            line-height: 1.6;
        }

        .error-container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
            padding: 3rem;
            max-width: 600px;
            width: 90%;
            margin: 2rem;
            text-align: center;
        }

        .error-code {
            font-size: 6rem;
            font-weight: 800;
            color: #e74c3c;
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
        }

        .error-title {
            font-size: 2.5rem;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 1rem;
        }

        .error-message {
            font-size: 1.2rem;
            color: #7f8c8d;
            margin-bottom: 2rem;
        }

        .error-suggestion {
            font-size: 1rem;
            color: #95a5a6;
            margin-bottom: 2rem;
            padding: 1rem;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #3498db;
        }

        .action-buttons {
            display: flex;
            gap: 1rem;
            justify-content: center;
            flex-wrap: wrap;
        }

        .btn {
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 500;
            transition: transform 0.2s, box-shadow 0.2s;
            border: none;
            cursor: pointer;
            font-size: 1rem;
        }

        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .btn-primary {
            background: #3498db;
            color: white;
        }

        .btn-secondary {
            background: #95a5a6;
            color: white;
        }

        .error-details {
            margin-top: 2rem;
            padding: 1rem;
            background: #f8f9fa;
            border-radius: 8px;
            text-align: left;
            font-family: 'Courier New', monospace;
            font-size: 0.875rem;
            color: #666;
            max-height: 200px;
            overflow-y: auto;
        }

        .error-id {
            margin-top: 2rem;
            padding: 0.5rem;
            background: #ecf0f1;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 0.75rem;
            color: #7f8c8d;
        }

        @media (max-width: 768px) {
            .error-container {
                padding: 2rem;
                margin: 1rem;
            }

            .error-code {
                font-size: 4rem;
            }

            .error-title {
                font-size: 2rem;
            }

            .action-buttons {
                flex-direction: column;
            }
        }

        .retry-info {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 1rem;
            margin: 1rem 0;
            color: #856404;
        }

        .loading-animation {
            display: none;
        }

        .loading-animation.show {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 2px solid #f3f3f3;
            border-top: 2px solid #3498db;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-left: 0.5rem;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-code">${errorInfo.status}</div>
        <h1 class="error-title">${template.title}</h1>
        <p class="error-message">${template.message}</p>
        <div class="error-suggestion">${template.suggestion}</div>

        ${errorInfo.retryAfter ? `
        <div class="retry-info">
            <strong>Rate Limited:</strong> Please wait ${errorInfo.retryAfter} seconds before trying again.
        </div>
        ` : ''}

        <div class="action-buttons">
            <button class="btn btn-primary" onclick="goHome()">
                Go Home
            </button>
            <button class="btn btn-secondary" onclick="goBack()">
                Go Back
            </button>
            <button class="btn btn-secondary" onclick="retry()">
                Try Again
                <span class="loading-animation" id="retryLoader"></span>
            </button>
        </div>

        ${isDev && template.showDetails ? `
        <div class="error-details">
            <strong>Debug Information:</strong><br>
            Error ID: ${errorInfo.id}<br>
            Category: ${errorInfo.category}<br>
            Timestamp: ${errorInfo.timestamp}<br>
            ${requestInfo ? `
            URL: ${requestInfo.url}<br>
            Method: ${requestInfo.method}<br>
            User Agent: ${requestInfo.userAgent}<br>
            ` : ''}
            ${errorInfo.stack ? `
            <br><strong>Stack Trace:</strong><br>
            <pre>${errorInfo.stack}</pre>
            ` : ''}
        </div>
        ` : ''}

        <div class="error-id">
            Error ID: ${errorInfo.id}
        </div>
    </div>

    <script>
        function goHome() {
            window.location.href = '/';
        }

        function goBack() {
            if (window.history.length > 1) {
                window.history.back();
            } else {
                goHome();
            }
        }

        function retry() {
            const loader = document.getElementById('retryLoader');
            loader.classList.add('show');

            setTimeout(() => {
                window.location.reload();
            }, 1000);
        }

        // Auto-retry for certain error types
        ${errorInfo.retryAfter ? `
        let retryCountdown = ${errorInfo.retryAfter};
        const countdownInterval = setInterval(() => {
            retryCountdown--;
            if (retryCountdown <= 0) {
                clearInterval(countdownInterval);
                window.location.reload();
            }
        }, 1000);
        ` : ''}

        // Report error to analytics
        if (navigator.sendBeacon && typeof gtag !== 'undefined') {
            gtag('event', 'exception', {
                'description': '${errorInfo.status} - ${template.title}',
                'fatal': false,
                'error_id': '${errorInfo.id}'
            });
        }
    </script>
</body>
</html>`;
  }

  /**
   * Track error for analytics and monitoring
   */
  trackError(errorInfo, request) {
    // Increment error count
    const errorKey = `${errorInfo.status}_${errorInfo.category}`;
    const currentCount = this.errorCounts.get(errorKey) || 0;
    this.errorCounts.set(errorKey, currentCount + 1);

    // Log error details
    console.error('Edge Error:', {
      id: errorInfo.id,
      status: errorInfo.status,
      category: errorInfo.category,
      message: errorInfo.message,
      url: request?.url,
      userAgent: request?.headers?.get('User-Agent'),
      timestamp: errorInfo.timestamp
    });

    // In production, you might send this to an external error tracking service
    if (this.shouldReportError(errorInfo)) {
      this.reportToExternalService(errorInfo, request);
    }
  }

  /**
   * Determine if error should be reported to external service
   */
  shouldReportError(errorInfo) {
    // Don't report client errors (4xx) unless they're unusual
    if (errorInfo.status >= 400 && errorInfo.status < 500) {
      return ['401', '403', '429'].includes(errorInfo.status.toString());
    }

    // Always report server errors (5xx)
    return errorInfo.status >= 500;
  }

  /**
   * Report error to external monitoring service
   */
  async reportToExternalService(errorInfo, request) {
    try {
      // This would integrate with services like Sentry, DataDog, etc.
      const errorReport = {
        error_id: errorInfo.id,
        status: errorInfo.status,
        category: errorInfo.category,
        message: errorInfo.message,
        timestamp: errorInfo.timestamp,
        url: request?.url,
        user_agent: request?.headers?.get('User-Agent'),
        stack: errorInfo.stack
      };

      // Mock external service call
      console.log('Would report to external service:', errorReport);

    } catch (reportError) {
      console.error('Failed to report error to external service:', reportError);
    }
  }

  /**
   * Generate unique error ID
   */
  generateErrorId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `err_${timestamp}_${random}`;
  }

  /**
   * Check if running in development mode
   */
  isDevelopment() {
    // In production, you'd check environment variables
    return globalThis.ENVIRONMENT === 'development';
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const stats = {
      totalErrors: 0,
      errorsByType: {},
      errorsByStatus: {},
      topErrors: []
    };

    for (const [errorKey, count] of this.errorCounts.entries()) {
      const [status, category] = errorKey.split('_');

      stats.totalErrors += count;

      if (!stats.errorsByStatus[status]) {
        stats.errorsByStatus[status] = 0;
      }
      stats.errorsByStatus[status] += count;

      if (!stats.errorsByType[category]) {
        stats.errorsByType[category] = 0;
      }
      stats.errorsByType[category] += count;

      stats.topErrors.push({ errorKey, count });
    }

    // Sort top errors by count
    stats.topErrors.sort((a, b) => b.count - a.count);
    stats.topErrors = stats.topErrors.slice(0, 10);

    return stats;
  }

  /**
   * Reset error statistics
   */
  resetStats() {
    this.errorCounts.clear();
  }
}