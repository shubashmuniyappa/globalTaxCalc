import React from 'react';
import './VoiceFormConfirmation.css';

/**
 * Voice Form Confirmation Component
 * Shows pending field updates that need user confirmation
 */
const VoiceFormConfirmation = ({
  pendingConfirmations = [],
  onConfirm,
  onReject,
  onConfirmAll,
  onRejectAll,
  className = ''
}) => {
  if (pendingConfirmations.length === 0) {
    return null;
  }

  const handleConfirm = (confirmationId) => {
    if (onConfirm) {
      onConfirm(confirmationId, true);
    }
  };

  const handleReject = (confirmationId) => {
    if (onReject) {
      onReject(confirmationId, false);
    }
  };

  const handleConfirmAll = () => {
    if (onConfirmAll) {
      onConfirmAll(true);
    }
  };

  const handleRejectAll = () => {
    if (onRejectAll) {
      onRejectAll(false);
    }
  };

  const formatValue = (fieldName, value) => {
    switch (fieldName) {
      case 'income':
      case 'additionalIncome':
      case 'deductions':
        return `$${parseFloat(value).toLocaleString()}`;
      case 'dependents':
        return parseInt(value).toString();
      case 'filingStatus':
        const statusLabels = {
          single: 'Single',
          married: 'Married Filing Jointly',
          marriedFilingSeparately: 'Married Filing Separately',
          headOfHousehold: 'Head of Household'
        };
        return statusLabels[value] || value;
      case 'country':
        const countryNames = {
          US: 'United States',
          CA: 'Canada',
          UK: 'United Kingdom',
          AU: 'Australia'
        };
        return countryNames[value.toUpperCase()] || value;
      default:
        return value.toString();
    }
  };

  const getFieldDisplayName = (fieldName) => {
    const displayNames = {
      income: 'Annual Income',
      filingStatus: 'Filing Status',
      dependents: 'Number of Dependents',
      taxYear: 'Tax Year',
      country: 'Country',
      additionalIncome: 'Additional Income',
      deductions: 'Deductions'
    };
    return displayNames[fieldName] || fieldName;
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return '#22c55e';
    if (confidence >= 0.6) return '#f59e0b';
    return '#ef4444';
  };

  const getConfidenceText = (confidence) => {
    if (confidence >= 0.8) return 'High confidence';
    if (confidence >= 0.6) return 'Medium confidence';
    return 'Low confidence';
  };

  return (
    <div className={`voice-form-confirmation ${className}`}>
      <div className="confirmation-header">
        <div className="header-content">
          <h3>Voice Input Detected</h3>
          <p>Please confirm the following changes to your tax form:</p>
        </div>
        {pendingConfirmations.length > 1 && (
          <div className="bulk-actions">
            <button
              className="bulk-action-btn confirm-all"
              onClick={handleConfirmAll}
              aria-label="Confirm all changes"
            >
              ✓ Confirm All
            </button>
            <button
              className="bulk-action-btn reject-all"
              onClick={handleRejectAll}
              aria-label="Reject all changes"
            >
              ✗ Reject All
            </button>
          </div>
        )}
      </div>

      <div className="confirmations-list">
        {pendingConfirmations.map((confirmation) => (
          <div key={confirmation.id} className="confirmation-item">
            <div className="confirmation-content">
              <div className="field-info">
                <div className="field-header">
                  <span className="field-name">
                    {getFieldDisplayName(confirmation.fieldName)}
                  </span>
                  <div className="confidence-badge">
                    <div
                      className="confidence-indicator"
                      style={{ backgroundColor: getConfidenceColor(confirmation.confidence) }}
                      title={getConfidenceText(confirmation.confidence)}
                    />
                    <span className="confidence-text">
                      {Math.round(confirmation.confidence * 100)}%
                    </span>
                  </div>
                </div>

                <div className="field-value">
                  <span className="value-label">New value:</span>
                  <span className="value-text">
                    {formatValue(confirmation.fieldName, confirmation.value)}
                  </span>
                </div>

                {confirmation.element && confirmation.element.value && (
                  <div className="current-value">
                    <span className="current-label">Current value:</span>
                    <span className="current-text">
                      {formatValue(confirmation.fieldName, confirmation.element.value)}
                    </span>
                  </div>
                )}
              </div>

              <div className="confirmation-actions">
                <button
                  className="action-btn confirm"
                  onClick={() => handleConfirm(confirmation.id)}
                  aria-label={`Confirm ${getFieldDisplayName(confirmation.fieldName)}`}
                  title="Accept this change"
                >
                  <svg viewBox="0 0 24 24" className="action-icon">
                    <path d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z" fill="currentColor"/>
                  </svg>
                  Confirm
                </button>
                <button
                  className="action-btn reject"
                  onClick={() => handleReject(confirmation.id)}
                  aria-label={`Reject ${getFieldDisplayName(confirmation.fieldName)}`}
                  title="Reject this change"
                >
                  <svg viewBox="0 0 24 24" className="action-icon">
                    <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" fill="currentColor"/>
                  </svg>
                  Reject
                </button>
              </div>
            </div>

            {/* Progress indicator for multiple confirmations */}
            {pendingConfirmations.length > 1 && (
              <div className="confirmation-progress">
                <div className="progress-text">
                  {pendingConfirmations.indexOf(confirmation) + 1} of {pendingConfirmations.length}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Help text */}
      <div className="confirmation-help">
        <div className="help-content">
          <svg className="help-icon" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12S6.48 22 12 22 22 17.52 22 12 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="currentColor"/>
          </svg>
          <div className="help-text">
            <p>
              <strong>Low confidence values</strong> require your confirmation to ensure accuracy.
            </p>
            <p>
              You can speak more clearly or use specific phrases like "I make fifty thousand dollars" for better recognition.
            </p>
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts info */}
      <div className="keyboard-shortcuts">
        <p className="shortcuts-title">Keyboard shortcuts:</p>
        <div className="shortcuts-list">
          <span className="shortcut">
            <kbd>Enter</kbd> Confirm first item
          </span>
          <span className="shortcut">
            <kbd>Escape</kbd> Reject all
          </span>
          <span className="shortcut">
            <kbd>Ctrl</kbd> + <kbd>Enter</kbd> Confirm all
          </span>
        </div>
      </div>
    </div>
  );
};

export default VoiceFormConfirmation;