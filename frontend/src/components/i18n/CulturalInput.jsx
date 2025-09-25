/**
 * Cultural Input Component
 * Input component with cultural adaptations and validation
 */

import React, { useState, useEffect, forwardRef } from 'react';
import { FormattedMessage } from 'react-intl';
import { ExclamationCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { useCultural, useRTLStyles, useCulturalNumbers } from './CulturalProvider';

const CulturalInput = forwardRef(({
  type = 'text',
  value = '',
  onChange,
  onBlur,
  onFocus,
  placeholder,
  label,
  helpText,
  required = false,
  disabled = false,
  readOnly = false,
  error,
  success,
  className = '',
  inputClassName = '',
  labelClassName = '',
  size = 'medium',
  variant = 'default',
  culturalValidation = true,
  showCulturalHelp = true,
  autoFormat = true,
  currency,
  maxLength,
  minLength,
  min,
  max,
  step,
  pattern,
  autoComplete,
  id,
  name,
  'aria-describedby': ariaDescribedby,
  'aria-invalid': ariaInvalid,
  ...props
}, ref) => {
  const {
    isRTL,
    validateInput,
    getPlaceholder,
    inputPreferences,
    culturalPattern
  } = useCultural();

  const { getClassName } = useRTLStyles();
  const { formatNumber, parseNumber, pattern: numberPattern } = useCulturalNumbers();

  const [internalValue, setInternalValue] = useState(value);
  const [validationErrors, setValidationErrors] = useState([]);
  const [isFocused, setIsFocused] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Update internal value when prop changes
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Get cultural placeholder if none provided
  const effectivePlaceholder = placeholder || getPlaceholder(type);

  // Validate input with cultural rules
  useEffect(() => {
    if (culturalValidation && internalValue && type !== 'password') {
      const validation = validateInput(type, internalValue);
      setValidationErrors(validation.errors);
    } else {
      setValidationErrors([]);
    }
  }, [internalValue, culturalValidation, validateInput, type]);

  // Handle input change
  const handleChange = (e) => {
    let newValue = e.target.value;

    // Auto-format numbers based on cultural preferences
    if (autoFormat && type === 'number' && newValue) {
      try {
        const parsed = parseNumber(newValue);
        if (!isNaN(parsed)) {
          newValue = formatNumber(parsed);
        }
      } catch (error) {
        // Keep original value if formatting fails
      }
    }

    setInternalValue(newValue);
    onChange?.(e);
  };

  // Handle focus
  const handleFocus = (e) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  // Handle blur
  const handleBlur = (e) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  // Get size classes
  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return {
          input: 'px-2 py-1 text-sm',
          label: 'text-xs',
          icon: 'w-4 h-4'
        };
      case 'large':
        return {
          input: 'px-4 py-3 text-base',
          label: 'text-base',
          icon: 'w-6 h-6'
        };
      default:
        return {
          input: 'px-3 py-2 text-sm',
          label: 'text-sm',
          icon: 'w-5 h-5'
        };
    }
  };

  // Get variant classes
  const getVariantClasses = () => {
    switch (variant) {
      case 'outline':
        return 'border-2 bg-transparent';
      case 'filled':
        return 'border-0 bg-gray-100';
      case 'underline':
        return 'border-0 border-b-2 bg-transparent rounded-none';
      default:
        return 'border bg-white';
    }
  };

  const sizeClasses = getSizeClasses();
  const variantClasses = getVariantClasses();

  // Build input classes
  const inputClasses = getClassName(`
    ${sizeClasses.input}
    ${variantClasses}
    w-full rounded-md transition-colors duration-200
    cultural-input
    ${error || validationErrors.length > 0
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
      : success
      ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
      : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
    }
    ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}
    ${readOnly ? 'bg-gray-50' : ''}
    focus:outline-none focus:ring-2 focus:ring-offset-2
    ${inputClassName}
  `);

  // Build label classes
  const labelClasses = getClassName(`
    ${sizeClasses.label}
    block font-medium text-gray-700 mb-1
    ${required ? 'after:content-["*"] after:text-red-500 after:ml-1' : ''}
    ${labelClassName}
  `);

  // Generate unique IDs
  const inputId = id || `cultural-input-${Math.random().toString(36).substr(2, 9)}`;
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-error`;

  // Render cultural help
  const renderCulturalHelp = () => {
    if (!showCulturalHelp || type === 'password') return null;

    const culturalInfo = [];

    // Add format information
    if (type === 'number' && numberPattern) {
      culturalInfo.push(
        <FormattedMessage
          key="number-format"
          id="cultural.input.numberFormat"
          defaultMessage="Number format: decimal '{decimal}', thousands '{thousands}'"
          values={{
            decimal: numberPattern.decimal,
            thousands: numberPattern.thousands
          }}
        />
      );
    }

    if (type === 'phone' && inputPreferences?.phoneFormat) {
      culturalInfo.push(
        <FormattedMessage
          key="phone-format"
          id="cultural.input.phoneFormat"
          defaultMessage="Expected format: {format}"
          values={{ format: inputPreferences.phoneFormat }}
        />
      );
    }

    if (culturalInfo.length === 0) return null;

    return (
      <div className="mt-1 text-xs text-blue-600 flex items-start">
        <InformationCircleIcon className={`${sizeClasses.icon} mr-1 flex-shrink-0 mt-0.5`} />
        <div>
          {culturalInfo.map((info, index) => (
            <div key={index}>{info}</div>
          ))}
        </div>
      </div>
    );
  };

  // Render error messages
  const renderErrors = () => {
    const allErrors = [...(error ? [error] : []), ...validationErrors];
    if (allErrors.length === 0) return null;

    return (
      <div className="mt-1 text-xs text-red-600 flex items-start">
        <ExclamationCircleIcon className={`${sizeClasses.icon} mr-1 flex-shrink-0 mt-0.5`} />
        <div>
          {allErrors.map((errorMsg, index) => (
            <div key={index}>{errorMsg}</div>
          ))}
        </div>
      </div>
    );
  };

  // Render help text
  const renderHelpText = () => {
    if (!helpText) return null;

    return (
      <div className="mt-1 text-xs text-gray-500">
        {helpText}
      </div>
    );
  };

  // Determine input type for cultural adaptations
  const getInputType = () => {
    // Use text type for numbers in cultures with special digits
    if (type === 'number' && numberPattern?.digits && numberPattern.digits !== '0123456789') {
      return 'text';
    }
    return type;
  };

  // Build aria-describedby
  const buildAriaDescribedby = () => {
    const descriptions = [];
    if (helpText) descriptions.push(helpId);
    if (error || validationErrors.length > 0) descriptions.push(errorId);
    if (ariaDescribedby) descriptions.push(ariaDescribedby);
    return descriptions.length > 0 ? descriptions.join(' ') : undefined;
  };

  return (
    <div className={className}>
      {/* Label */}
      {label && (
        <label htmlFor={inputId} className={labelClasses}>
          {label}
        </label>
      )}

      {/* Input Container */}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          name={name}
          type={getInputType()}
          value={internalValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={effectivePlaceholder}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          maxLength={maxLength}
          minLength={minLength}
          min={min}
          max={max}
          step={step}
          pattern={pattern}
          autoComplete={autoComplete}
          className={inputClasses}
          dir={isRTL ? 'rtl' : 'ltr'}
          aria-describedby={buildAriaDescribedby()}
          aria-invalid={ariaInvalid || (error || validationErrors.length > 0) ? 'true' : undefined}
          {...props}
        />

        {/* Success Icon */}
        {success && !error && validationErrors.length === 0 && (
          <div className={getClassName(`absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none`)}>
            <svg className={`${sizeClasses.icon} text-green-500`} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
        )}

        {/* Error Icon */}
        {(error || validationErrors.length > 0) && (
          <div className={getClassName(`absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none`)}>
            <ExclamationCircleIcon className={`${sizeClasses.icon} text-red-500`} />
          </div>
        )}
      </div>

      {/* Help Text */}
      <div id={helpId}>
        {renderHelpText()}
      </div>

      {/* Cultural Help */}
      {renderCulturalHelp()}

      {/* Error Messages */}
      <div id={errorId}>
        {renderErrors()}
      </div>
    </div>
  );
});

CulturalInput.displayName = 'CulturalInput';

export default CulturalInput;