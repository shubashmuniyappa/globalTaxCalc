import { useCallback, useRef, useState } from 'react';
import { voiceService } from '../services/voiceService';

/**
 * Custom hook for voice-driven form filling
 * Handles auto-population of form fields from voice input
 */
export const useVoiceFormFilling = (formRef, initialValues = {}) => {
  const [filledFields, setFilledFields] = useState(new Set());
  const [pendingConfirmations, setPendingConfirmations] = useState([]);
  const [voiceFillingEnabled, setVoiceFillingEnabled] = useState(true);
  const [lastVoiceUpdate, setLastVoiceUpdate] = useState(null);
  const previousValuesRef = useRef({});

  // Field mapping configuration for tax calculator
  const fieldMappings = {
    // Income fields
    income: {
      selectors: ['input[name="income"]', '#income', '.income-field'],
      formatter: (value) => typeof value === 'number' ? value.toString() : value,
      validator: (value) => {
        const num = parseFloat(value);
        return !isNaN(num) && num >= 0 && num <= 10000000;
      },
      confirmationMessage: (value) => `Set annual income to $${parseFloat(value).toLocaleString()}?`
    },

    // Filing status
    filingStatus: {
      selectors: ['select[name="filingStatus"]', '#filingStatus', '.filing-status-field'],
      formatter: (value) => value,
      validator: (value) => ['single', 'married', 'marriedFilingSeparately', 'headOfHousehold'].includes(value),
      confirmationMessage: (value) => {
        const statusLabels = {
          single: 'Single',
          married: 'Married Filing Jointly',
          marriedFilingSeparately: 'Married Filing Separately',
          headOfHousehold: 'Head of Household'
        };
        return `Set filing status to ${statusLabels[value] || value}?`;
      }
    },

    // Dependents
    dependents: {
      selectors: ['input[name="dependents"]', '#dependents', '.dependents-field'],
      formatter: (value) => typeof value === 'number' ? value.toString() : value,
      validator: (value) => {
        const num = parseInt(value);
        return !isNaN(num) && num >= 0 && num <= 20;
      },
      confirmationMessage: (value) => {
        const num = parseInt(value);
        return `Set number of dependents to ${num}?`;
      }
    },

    // Tax year
    taxYear: {
      selectors: ['select[name="taxYear"]', '#taxYear', '.tax-year-field'],
      formatter: (value) => typeof value === 'number' ? value.toString() : value,
      validator: (value) => {
        const num = parseInt(value);
        const currentYear = new Date().getFullYear();
        return !isNaN(num) && num >= 2020 && num <= currentYear;
      },
      confirmationMessage: (value) => `Set tax year to ${value}?`
    },

    // Country
    country: {
      selectors: ['select[name="country"]', '#country', '.country-field'],
      formatter: (value) => value.toUpperCase(),
      validator: (value) => ['US', 'CA', 'UK', 'AU'].includes(value.toUpperCase()),
      confirmationMessage: (value) => {
        const countryNames = {
          US: 'United States',
          CA: 'Canada',
          UK: 'United Kingdom',
          AU: 'Australia'
        };
        return `Set country to ${countryNames[value.toUpperCase()] || value}?`;
      }
    },

    // Additional income sources
    additionalIncome: {
      selectors: ['input[name="additionalIncome"]', '#additionalIncome'],
      formatter: (value) => typeof value === 'number' ? value.toString() : value,
      validator: (value) => {
        const num = parseFloat(value);
        return !isNaN(num) && num >= 0;
      },
      confirmationMessage: (value) => `Add additional income of $${parseFloat(value).toLocaleString()}?`
    },

    // Deductions
    deductions: {
      selectors: ['input[name="deductions"]', '#deductions'],
      formatter: (value) => typeof value === 'number' ? value.toString() : value,
      validator: (value) => {
        const num = parseFloat(value);
        return !isNaN(num) && num >= 0;
      },
      confirmationMessage: (value) => `Set deductions to $${parseFloat(value).toLocaleString()}?`
    }
  };

  /**
   * Find form field by name using various selectors
   */
  const findFormField = useCallback((fieldName) => {
    if (!formRef.current) return null;

    const mapping = fieldMappings[fieldName];
    if (!mapping) return null;

    for (const selector of mapping.selectors) {
      const element = formRef.current.querySelector(selector);
      if (element) return element;
    }

    return null;
  }, []);

  /**
   * Update form field value with validation and visual feedback
   */
  const updateFormField = useCallback((fieldName, value, confidence = 1.0) => {
    const element = findFormField(fieldName);
    const mapping = fieldMappings[fieldName];

    if (!element || !mapping) {
      console.warn(`Form field not found: ${fieldName}`);
      return false;
    }

    // Validate the value
    if (!mapping.validator(value)) {
      console.warn(`Invalid value for ${fieldName}: ${value}`);
      return false;
    }

    // Format the value
    const formattedValue = mapping.formatter(value);

    // Store previous value
    previousValuesRef.current[fieldName] = element.value;

    // Update the field
    if (element.tagName === 'SELECT') {
      // Handle select elements
      const option = Array.from(element.options).find(
        opt => opt.value === formattedValue
      );
      if (option) {
        element.value = formattedValue;
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else {
      // Handle input elements
      element.value = formattedValue;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Add visual feedback
    element.classList.add('voice-filled');
    setTimeout(() => {
      element.classList.remove('voice-filled');
    }, 2000);

    // Track filled field
    setFilledFields(prev => new Set([...prev, fieldName]));

    // Track analytics
    voiceService.trackAnalytics('field_filled', {
      fieldName,
      confidence,
      value: typeof value === 'string' ? value.substring(0, 10) : value
    });

    return true;
  }, [findFormField]);

  /**
   * Process voice data and fill form fields
   */
  const processVoiceData = useCallback(async (voiceData, confidence = 1.0) => {
    if (!voiceFillingEnabled || !voiceData || Object.keys(voiceData).length === 0) {
      return;
    }

    const processedFields = [];
    const confirmations = [];

    // Process each field in the voice data
    for (const [fieldName, value] of Object.entries(voiceData)) {
      const mapping = fieldMappings[fieldName];
      if (!mapping) continue;

      const element = findFormField(fieldName);
      if (!element) continue;

      // Check if we should request confirmation for low confidence
      if (confidence < 0.8) {
        confirmations.push({
          id: Date.now() + Math.random(),
          fieldName,
          value,
          confidence,
          message: mapping.confirmationMessage(value),
          element
        });
      } else {
        // Auto-fill high confidence values
        const success = updateFormField(fieldName, value, confidence);
        if (success) {
          processedFields.push({
            fieldName,
            value: mapping.formatter(value),
            confidence
          });
        }
      }
    }

    // Update state
    if (confirmations.length > 0) {
      setPendingConfirmations(prev => [...prev, ...confirmations]);
    }

    if (processedFields.length > 0) {
      setLastVoiceUpdate({
        timestamp: Date.now(),
        fields: processedFields,
        confidence
      });

      // Track analytics
      voiceService.trackAnalytics('voice_form_fill', {
        fieldsUpdated: processedFields.length,
        averageConfidence: confidence,
        confirmationsNeeded: confirmations.length
      });
    }

  }, [voiceFillingEnabled, findFormField, updateFormField]);

  /**
   * Confirm a pending field update
   */
  const confirmFieldUpdate = useCallback((confirmationId, approved = true) => {
    setPendingConfirmations(prev => {
      const confirmation = prev.find(c => c.id === confirmationId);
      if (!confirmation) return prev;

      if (approved) {
        updateFormField(confirmation.fieldName, confirmation.value, confirmation.confidence);
      }

      return prev.filter(c => c.id !== confirmationId);
    });
  }, [updateFormField]);

  /**
   * Bulk confirm all pending updates
   */
  const confirmAllUpdates = useCallback((approved = true) => {
    pendingConfirmations.forEach(confirmation => {
      if (approved) {
        updateFormField(confirmation.fieldName, confirmation.value, confirmation.confidence);
      }
    });
    setPendingConfirmations([]);
  }, [pendingConfirmations, updateFormField]);

  /**
   * Undo the last voice-filled field
   */
  const undoLastVoiceUpdate = useCallback(() => {
    if (!lastVoiceUpdate) return;

    lastVoiceUpdate.fields.forEach(({ fieldName }) => {
      const element = findFormField(fieldName);
      const previousValue = previousValuesRef.current[fieldName];

      if (element && previousValue !== undefined) {
        element.value = previousValue;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));

        // Remove from filled fields
        setFilledFields(prev => {
          const newSet = new Set(prev);
          newSet.delete(fieldName);
          return newSet;
        });
      }
    });

    setLastVoiceUpdate(null);
    voiceService.trackAnalytics('voice_undo', {
      fieldsUndone: lastVoiceUpdate.fields.length
    });
  }, [lastVoiceUpdate, findFormField]);

  /**
   * Clear all voice-filled fields
   */
  const clearVoiceFields = useCallback(() => {
    filledFields.forEach(fieldName => {
      const element = findFormField(fieldName);
      if (element) {
        element.value = '';
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    setFilledFields(new Set());
    setPendingConfirmations([]);
    setLastVoiceUpdate(null);
    previousValuesRef.current = {};

    voiceService.trackAnalytics('voice_clear_all', {
      fieldsCleared: filledFields.size
    });
  }, [filledFields, findFormField]);

  /**
   * Get form field status
   */
  const getFieldStatus = useCallback((fieldName) => {
    const element = findFormField(fieldName);
    const isFilled = filledFields.has(fieldName);
    const hasPendingConfirmation = pendingConfirmations.some(c => c.fieldName === fieldName);

    return {
      exists: !!element,
      isFilled,
      hasPendingConfirmation,
      value: element?.value || '',
      isVoiceFillable: !!fieldMappings[fieldName]
    };
  }, [filledFields, pendingConfirmations, findFormField]);

  /**
   * Get fillable fields in the form
   */
  const getFillableFields = useCallback(() => {
    return Object.keys(fieldMappings).map(fieldName => ({
      fieldName,
      ...getFieldStatus(fieldName)
    })).filter(field => field.exists);
  }, [getFieldStatus]);

  return {
    // State
    filledFields: Array.from(filledFields),
    pendingConfirmations,
    voiceFillingEnabled,
    lastVoiceUpdate,

    // Actions
    processVoiceData,
    confirmFieldUpdate,
    confirmAllUpdates,
    undoLastVoiceUpdate,
    clearVoiceFields,
    setVoiceFillingEnabled,

    // Utilities
    getFieldStatus,
    getFillableFields,
    updateFormField,

    // Configuration
    fieldMappings: Object.keys(fieldMappings)
  };
};