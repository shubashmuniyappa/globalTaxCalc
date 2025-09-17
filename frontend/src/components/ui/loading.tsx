'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

// Spinner component
const spinnerVariants = cva('animate-spin', {
  variants: {
    size: {
      sm: 'h-4 w-4',
      default: 'h-6 w-6',
      lg: 'h-8 w-8',
      xl: 'h-12 w-12',
    },
    variant: {
      default: 'text-primary-600',
      secondary: 'text-gray-500',
      white: 'text-white',
    },
  },
  defaultVariants: {
    size: 'default',
    variant: 'default',
  },
});

interface SpinnerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof spinnerVariants> {
  'aria-label'?: string;
}

const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  ({ className, size, variant, 'aria-label': ariaLabel = 'Loading', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('inline-flex items-center justify-center', className)}
        role="status"
        aria-label={ariaLabel}
        {...props}
      >
        <Loader2 className={cn(spinnerVariants({ size, variant }))} />
        <span className="sr-only">{ariaLabel}</span>
      </div>
    );
  }
);
Spinner.displayName = 'Spinner';

// Loading overlay component
interface LoadingOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  isLoading?: boolean;
  loadingText?: string;
  size?: VariantProps<typeof spinnerVariants>['size'];
  backdrop?: boolean;
}

const LoadingOverlay = React.forwardRef<HTMLDivElement, LoadingOverlayProps>(
  (
    {
      className,
      isLoading = true,
      loadingText = 'Loading...',
      size = 'lg',
      backdrop = true,
      children,
      ...props
    },
    ref
  ) => {
    if (!isLoading) {
      return <>{children}</>;
    }

    return (
      <div ref={ref} className={cn('relative', className)} {...props}>
        {children}
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center',
            backdrop && 'bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm'
          )}
        >
          <div className="flex flex-col items-center space-y-3">
            <Spinner size={size} />
            {loadingText && (
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {loadingText}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }
);
LoadingOverlay.displayName = 'LoadingOverlay';

// Skeleton loading component
interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  count?: number;
  height?: string | number;
  width?: string | number;
  circle?: boolean;
  rounded?: boolean;
}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, count = 1, height, width, circle = false, rounded = true, ...props }, ref) => {
    const skeletonElements = Array.from({ length: count }, (_, index) => (
      <div
        key={index}
        className={cn(
          'animate-pulse bg-gray-200 dark:bg-gray-700',
          circle ? 'rounded-full' : rounded ? 'rounded' : '',
          className
        )}
        style={{
          height: height || (circle ? width : '1rem'),
          width: width || '100%',
        }}
        {...props}
      />
    ));

    if (count === 1) {
      return skeletonElements[0];
    }

    return (
      <div ref={ref} className="space-y-2">
        {skeletonElements}
      </div>
    );
  }
);
Skeleton.displayName = 'Skeleton';

// Progress bar component
interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error';
  showValue?: boolean;
  animated?: boolean;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  (
    {
      className,
      value = 0,
      max = 100,
      size = 'default',
      variant = 'default',
      showValue = false,
      animated = false,
      ...props
    },
    ref
  ) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    const sizeClasses = {
      sm: 'h-1',
      default: 'h-2',
      lg: 'h-3',
    };

    const variantClasses = {
      default: 'bg-primary-600',
      success: 'bg-success-600',
      warning: 'bg-warning-600',
      error: 'bg-error-600',
    };

    return (
      <div className="w-full">
        <div
          ref={ref}
          className={cn(
            'w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700',
            sizeClasses[size],
            className
          )}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          {...props}
        >
          <div
            className={cn(
              'h-full transition-all duration-300 ease-out',
              variantClasses[variant],
              animated && 'bg-gradient-to-r from-transparent via-white/20 to-transparent'
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {showValue && (
          <div className="mt-1 flex justify-between text-xs text-gray-600 dark:text-gray-400">
            <span>{Math.round(percentage)}%</span>
            <span>
              {value} / {max}
            </span>
          </div>
        )}
      </div>
    );
  }
);
Progress.displayName = 'Progress';

// Dots loading animation
interface DotsProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'secondary' | 'white';
}

const Dots = React.forwardRef<HTMLDivElement, DotsProps>(
  ({ className, size = 'default', variant = 'default', ...props }, ref) => {
    const sizeClasses = {
      sm: 'h-1 w-1',
      default: 'h-2 w-2',
      lg: 'h-3 w-3',
    };

    const variantClasses = {
      default: 'bg-primary-600',
      secondary: 'bg-gray-500',
      white: 'bg-white',
    };

    return (
      <div
        ref={ref}
        className={cn('flex items-center space-x-1', className)}
        {...props}
      >
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className={cn(
              'animate-pulse rounded-full',
              sizeClasses[size],
              variantClasses[variant]
            )}
            style={{
              animationDelay: `${index * 0.15}s`,
              animationDuration: '0.6s',
            }}
          />
        ))}
      </div>
    );
  }
);
Dots.displayName = 'Dots';

// Pulse loading component
interface PulseProps extends React.HTMLAttributes<HTMLDivElement> {
  duration?: string;
}

const Pulse = React.forwardRef<HTMLDivElement, PulseProps>(
  ({ className, duration = '2s', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('animate-pulse', className)}
        style={{ animationDuration: duration }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Pulse.displayName = 'Pulse';

export { Spinner, LoadingOverlay, Skeleton, Progress, Dots, Pulse, spinnerVariants };