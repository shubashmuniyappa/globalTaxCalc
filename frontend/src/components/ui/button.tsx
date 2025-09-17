'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95',
  {
    variants: {
      variant: {
        default: 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm hover:shadow-md',
        destructive: 'bg-error-600 text-white hover:bg-error-700 shadow-sm',
        outline: 'border border-gray-300 bg-white hover:bg-gray-50 hover:text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-gray-100',
        secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600',
        ghost: 'hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100',
        link: 'text-primary-600 underline-offset-4 hover:underline dark:text-primary-400',
        success: 'bg-success-600 text-white hover:bg-success-700 shadow-sm',
        warning: 'bg-warning-600 text-white hover:bg-warning-700 shadow-sm',
        gradient: 'bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 shadow-sm hover:shadow-md',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-12 rounded-lg px-8 text-base',
        xl: 'h-14 rounded-xl px-10 text-lg',
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8',
        'icon-lg': 'h-12 w-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isLoading?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      isLoading = false,
      loadingText,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';
    const isDisabled = disabled || loading || isLoading;

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        {...props}
      >
        {(loading || isLoading) && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        )}
        {!(loading || isLoading) && leftIcon && (
          <span className="mr-2" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        {(loading || isLoading) && loadingText ? loadingText : children}
        {!(loading || isLoading) && rightIcon && (
          <span className="ml-2" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

// Button group component for related actions
interface ButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'default' | 'lg';
  orientation?: 'horizontal' | 'vertical';
  variant?: 'attached' | 'separated';
}

const ButtonGroup = React.forwardRef<HTMLDivElement, ButtonGroupProps>(
  ({ className, size = 'default', orientation = 'horizontal', variant = 'attached', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex',
          orientation === 'vertical' ? 'flex-col' : 'flex-row',
          variant === 'attached'
            ? orientation === 'vertical'
              ? '[&>button:not(:first-child)]:rounded-t-none [&>button:not(:last-child)]:rounded-b-none [&>button:not(:last-child)]:border-b-0'
              : '[&>button:not(:first-child)]:rounded-l-none [&>button:not(:last-child)]:rounded-r-none [&>button:not(:last-child)]:border-r-0'
            : orientation === 'vertical'
            ? 'space-y-2'
            : 'space-x-2',
          className
        )}
        role="group"
        {...props}
      />
    );
  }
);
ButtonGroup.displayName = 'ButtonGroup';

// Icon button component
interface IconButtonProps extends Omit<ButtonProps, 'leftIcon' | 'rightIcon'> {
  icon: React.ReactNode;
  'aria-label': string;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, className, size = 'icon', ...props }, ref) => {
    return (
      <Button ref={ref} className={className} size={size} {...props}>
        {icon}
      </Button>
    );
  }
);
IconButton.displayName = 'IconButton';

export { Button, ButtonGroup, IconButton, buttonVariants };