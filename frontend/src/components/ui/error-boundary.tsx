'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from './button';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorFallbackProps {
  error?: Error;
  resetError: () => void;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error to external service
    console.error('Error Boundary caught an error:', error, errorInfo);

    // Call custom error handler
    this.props.onError?.(error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}

// Default error fallback component
function DefaultErrorFallback({ error, resetError }: ErrorFallbackProps) {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-error-100 dark:bg-error-900/20 mb-4">
            <AlertTriangle className="h-6 w-6 text-error-600 dark:text-error-400" />
          </div>

          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Something went wrong
          </h1>

          <p className="text-gray-600 dark:text-gray-400 mb-6">
            We're sorry for the inconvenience. An unexpected error has occurred.
          </p>

          {isDevelopment && error && (
            <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg text-left">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Error Details (Development Only)
              </h3>
              <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-auto">
                {error.message}
              </pre>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={resetError}
              className="flex-1"
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Try Again
            </Button>

            <Button
              variant="outline"
              onClick={() => window.location.href = '/'}
              className="flex-1"
              leftIcon={<Home className="h-4 w-4" />}
            >
              Go Home
            </Button>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
            If this problem persists, please contact our support team.
          </p>
        </div>
      </div>
    </div>
  );
}

// Simple error fallback for smaller components
function SimpleErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <AlertTriangle className="h-8 w-8 text-error-500 mb-3" />
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
        Error Loading Component
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
        Something went wrong while loading this section.
      </p>
      <Button size="sm" onClick={resetError}>
        Retry
      </Button>
    </div>
  );
}

// Inline error fallback for form fields and small components
function InlineErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div className="flex items-center gap-2 p-2 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-md">
      <AlertTriangle className="h-4 w-4 text-error-500 flex-shrink-0" />
      <span className="text-sm text-error-700 dark:text-error-300 flex-1">
        Error loading content
      </span>
      <Button size="sm" variant="ghost" onClick={resetError}>
        Retry
      </Button>
    </div>
  );
}

// Hook for functional components to catch errors
function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return { captureError, resetError };
}

// Higher-order component for error boundaries
function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorFallback?: React.ComponentType<ErrorFallbackProps>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={errorFallback}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

export {
  ErrorBoundary,
  DefaultErrorFallback,
  SimpleErrorFallback,
  InlineErrorFallback,
  useErrorHandler,
  withErrorBoundary,
  type ErrorBoundaryProps,
  type ErrorFallbackProps,
};