'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';

const inputVariants = cva(
  'flex w-full rounded-lg border bg-white px-3 py-2 text-sm transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-400',
  {
    variants: {
      variant: {
        default: 'border-gray-300 focus-visible:ring-primary-500 focus-visible:border-primary-500 dark:border-gray-600',
        error: 'border-error-300 focus-visible:ring-error-500 focus-visible:border-error-500 dark:border-error-600',
        success: 'border-success-300 focus-visible:ring-success-500 focus-visible:border-success-500 dark:border-success-600',
        warning: 'border-warning-300 focus-visible:ring-warning-500 focus-visible:border-warning-500 dark:border-warning-600',
      },
      size: {
        default: 'h-10 px-3 py-2',
        sm: 'h-8 px-2 py-1 text-xs',
        lg: 'h-12 px-4 py-3 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  error?: string;
  success?: string;
  helperText?: string;
  label?: string;
  required?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      variant,
      size,
      type,
      leftIcon,
      rightIcon,
      error,
      success,
      helperText,
      label,
      required,
      id,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = React.useState(false);
    const inputId = id || React.useId();

    // Determine variant based on validation state
    const finalVariant = error ? 'error' : success ? 'success' : variant;

    const isPassword = type === 'password';
    const inputType = isPassword && showPassword ? 'text' : type;

    const togglePasswordVisibility = () => {
      setShowPassword(!showPassword);
    };

    const inputElement = (
      <div className="relative">
        {leftIcon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <span className="text-gray-500 dark:text-gray-400" aria-hidden="true">
              {leftIcon}
            </span>
          </div>
        )}

        <input
          type={inputType}
          className={cn(
            inputVariants({ variant: finalVariant, size }),
            leftIcon && 'pl-10',
            (rightIcon || isPassword) && 'pr-10',
            className
          )}
          ref={ref}
          id={inputId}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={
            error
              ? `${inputId}-error`
              : success
              ? `${inputId}-success`
              : helperText
              ? `${inputId}-helper`
              : undefined
          }
          {...props}
        />

        {(rightIcon || isPassword || error || success) && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {isPassword ? (
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            ) : error ? (
              <AlertCircle className="h-4 w-4 text-error-500" aria-hidden="true" />
            ) : success ? (
              <CheckCircle className="h-4 w-4 text-success-500" aria-hidden="true" />
            ) : (
              rightIcon && (
                <span className="text-gray-500 dark:text-gray-400" aria-hidden="true">
                  {rightIcon}
                </span>
              )
            )}
          </div>
        )}
      </div>
    );

    if (label) {
      return (
        <div className="space-y-2">
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-900 dark:text-gray-100"
          >
            {label}
            {required && (
              <span className="ml-1 text-error-500" aria-label="required">
                *
              </span>
            )}
          </label>
          {inputElement}
          {error && (
            <p
              id={`${inputId}-error`}
              className="text-sm text-error-600 dark:text-error-400"
              role="alert"
            >
              {error}
            </p>
          )}
          {success && !error && (
            <p
              id={`${inputId}-success`}
              className="text-sm text-success-600 dark:text-success-400"
            >
              {success}
            </p>
          )}
          {helperText && !error && !success && (
            <p
              id={`${inputId}-helper`}
              className="text-sm text-gray-600 dark:text-gray-400"
            >
              {helperText}
            </p>
          )}
        </div>
      );
    }

    return inputElement;
  }
);
Input.displayName = 'Input';

// Currency input component
interface CurrencyInputProps extends Omit<InputProps, 'type' | 'leftIcon'> {
  currency?: string;
  locale?: string;
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ currency = 'USD', locale = 'en-US', className, ...props }, ref) => {
    const formatCurrency = (value: string) => {
      const numericValue = value.replace(/[^0-9.]/g, '');
      if (!numericValue) return '';

      const number = parseFloat(numericValue);
      if (isNaN(number)) return '';

      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(number);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = e.target;
      const numericValue = value.replace(/[^0-9.]/g, '');

      // Create a synthetic event with the numeric value
      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          value: numericValue,
        },
      };

      props.onChange?.(syntheticEvent as React.ChangeEvent<HTMLInputElement>);
    };

    return (
      <Input
        ref={ref}
        type="text"
        className={cn('font-mono', className)}
        leftIcon={<span className="text-sm font-semibold">$</span>}
        onChange={handleChange}
        {...props}
      />
    );
  }
);
CurrencyInput.displayName = 'CurrencyInput';

// Number input component
interface NumberInputProps extends Omit<InputProps, 'type'> {
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ min, max, step = 1, precision = 0, className, ...props }, ref) => {
    const formatNumber = (value: string, precision: number) => {
      const num = parseFloat(value);
      if (isNaN(num)) return '';
      return precision > 0 ? num.toFixed(precision) : num.toString();
    };

    return (
      <Input
        ref={ref}
        type="number"
        min={min}
        max={max}
        step={step}
        className={cn('font-mono', className)}
        {...props}
      />
    );
  }
);
NumberInput.displayName = 'NumberInput';

export { Input, CurrencyInput, NumberInput, inputVariants };