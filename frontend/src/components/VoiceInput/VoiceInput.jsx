import React, { useState, useRef, useCallback, useEffect } from 'react';
import VoiceButton from './VoiceButton';
import VoiceLanguageSelector from './VoiceLanguageSelector';
import VoiceFormConfirmation from './VoiceFormConfirmation';
import VoiceCommands from './VoiceCommands';
import VoiceAccessibility from './VoiceAccessibility';
import { useVoiceFormFilling } from '../../hooks/useVoiceFormFilling';
import { voiceService } from '../../services/voiceService';
import './VoiceInput.css';

/**
 * Main Voice Input Component
 * Orchestrates all voice input functionality for the tax calculator
 */
const VoiceInput = ({
  formRef,
  onCalculate,
  onClearForm,
  onShowHelp,
  onShowResults,
  className = '',
  compact = false,
  disabled = false
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [showCommands, setShowCommands] = useState(!compact);
  const [voiceSettings, setVoiceSettings] = useState({
    autoFill: true,
    confirmLowConfidence: true,
    enableShortcuts: true,
    announceChanges: true
  });

  const voiceInputRef = useRef(null);

  // Voice form filling hook
  const {
    filledFields,
    pendingConfirmations,
    voiceFillingEnabled,
    processVoiceData,
    confirmFieldUpdate,
    confirmAllUpdates,
    undoLastVoiceUpdate,
    clearVoiceFields,
    setVoiceFillingEnabled
  } = useVoiceFormFilling(formRef);

  // Handle transcript updates
  const handleTranscript = useCallback((transcript, transcriptConfidence) => {
    setCurrentTranscript(transcript);
    setConfidence(transcriptConfidence);

    // Track analytics
    voiceService.trackAnalytics('transcript_received', {
      language: selectedLanguage,
      confidence: transcriptConfidence,
      length: transcript.length
    });
  }, [selectedLanguage]);

  // Handle processed voice data
  const handleVoiceData = useCallback(async (data, dataConfidence) => {
    if (voiceSettings.autoFill) {
      await processVoiceData(data, dataConfidence);
    }
  }, [processVoiceData, voiceSettings.autoFill]);

  // Handle voice commands
  const handleVoiceCommand = useCallback(async (commandType, parameters, commandConfidence) => {
    try {
      switch (commandType) {
        case 'calculate':
          if (onCalculate) {
            await onCalculate();
          }
          break;

        case 'clearForm':
          if (onClearForm) {
            await onClearForm();
          }
          clearVoiceFields();
          break;

        case 'showResults':
          if (onShowResults) {
            await onShowResults();
          }
          break;

        case 'showHelp':
          if (onShowHelp) {
            await onShowHelp();
          }
          break;

        case 'setIncome':
          if (parameters.value) {
            await processVoiceData({ income: parameters.value }, commandConfidence);
          }
          break;

        case 'setFilingStatus':
          if (parameters.status) {
            await processVoiceData({ filingStatus: parameters.status }, commandConfidence);
          }
          break;

        case 'setDependents':
          if (parameters.value !== undefined) {
            await processVoiceData({ dependents: parameters.value }, commandConfidence);
          }
          break;

        default:
          console.warn(`Unknown voice command: ${commandType}`);
      }

      // Track command usage
      voiceService.trackAnalytics('command_executed', {
        command: commandType,
        confidence: commandConfidence,
        parameters: Object.keys(parameters).length
      });

    } catch (error) {
      console.error('Voice command execution error:', error);
      voiceService.trackAnalytics('command_error', {
        command: commandType,
        error: error.message
      });
    }
  }, [onCalculate, onClearForm, onShowResults, onShowHelp, processVoiceData, clearVoiceFields]);

  // Handle keyboard commands from accessibility component
  const handleKeyboardCommand = useCallback(async (command) => {
    const commandMap = {
      toggleVoice: () => {
        // This would be handled by the VoiceButton component
        voiceInputRef.current?.querySelector('.voice-button')?.click();
      },
      calculate: () => handleVoiceCommand('calculate', {}, 1.0),
      clearForm: () => handleVoiceCommand('clearForm', {}, 1.0),
      showHelp: () => handleVoiceCommand('showHelp', {}, 1.0),
      voiceSettings: () => setShowCommands(true),
      languageSelector: () => {
        // Focus language selector
        voiceInputRef.current?.querySelector('.language-trigger')?.focus();
      },
      showTranscript: () => {
        // Show transcript in modal or expand view
        console.log('Current transcript:', currentTranscript);
      },
      voiceHelp: () => setShowCommands(true),
      cancelVoice: () => {
        setIsVoiceActive(false);
        setCurrentTranscript('');
      }
    };

    const action = commandMap[command];
    if (action) {
      await action();
    }
  }, [handleVoiceCommand, currentTranscript]);

  // Language change handler
  const handleLanguageChange = useCallback((language) => {
    setSelectedLanguage(language);
    voiceService.trackAnalytics('language_changed', {
      from: selectedLanguage,
      to: language
    });
  }, [selectedLanguage]);

  // Voice button handlers
  const handleVoiceStart = useCallback(() => {
    setIsVoiceActive(true);
    setCurrentTranscript('');
    setConfidence(0);
  }, []);

  const handleVoiceStop = useCallback(() => {
    setIsVoiceActive(false);
  }, []);

  // Settings handlers
  const updateVoiceSetting = useCallback((setting, value) => {
    setVoiceSettings(prev => ({
      ...prev,
      [setting]: value
    }));

    // Special handling for auto-fill setting
    if (setting === 'autoFill') {
      setVoiceFillingEnabled(value);
    }
  }, [setVoiceFillingEnabled]);

  // Initialize voice session
  useEffect(() => {
    voiceService.trackAnalytics('session_start', {
      language: selectedLanguage,
      compact,
      settings: voiceSettings
    });

    return () => {
      voiceService.trackAnalytics('session_end', {
        duration: Date.now() - performance.now()
      });
    };
  }, [selectedLanguage, compact, voiceSettings]);

  if (compact) {
    return (
      <div ref={voiceInputRef} className={`voice-input compact ${className}`}>
        <div className="voice-compact-container">
          <VoiceLanguageSelector
            selectedLanguage={selectedLanguage}
            onLanguageChange={handleLanguageChange}
            compact={true}
          />
          <VoiceButton
            onTranscript={handleTranscript}
            onVoiceData={handleVoiceData}
            onCommand={handleVoiceCommand}
            language={selectedLanguage}
            disabled={disabled}
            size="small"
          />
        </div>

        {pendingConfirmations.length > 0 && (
          <VoiceFormConfirmation
            pendingConfirmations={pendingConfirmations}
            onConfirm={confirmFieldUpdate}
            onReject={confirmFieldUpdate}
            onConfirmAll={confirmAllUpdates}
            onRejectAll={confirmAllUpdates}
          />
        )}

        <VoiceAccessibility
          isVoiceActive={isVoiceActive}
          currentTranscript={currentTranscript}
          confidence={confidence}
          language={selectedLanguage}
          onKeyboardCommand={handleKeyboardCommand}
        />
      </div>
    );
  }

  return (
    <div ref={voiceInputRef} className={`voice-input ${className}`} id="voice-input">
      {/* Main Voice Controls */}
      <div className="voice-main-controls">
        <div className="voice-header">
          <h3>🎤 Voice Input</h3>
          <p>Speak naturally to fill out your tax information</p>
        </div>

        <div className="voice-controls-row">
          <VoiceLanguageSelector
            selectedLanguage={selectedLanguage}
            onLanguageChange={handleLanguageChange}
          />

          <VoiceButton
            onTranscript={handleTranscript}
            onVoiceData={handleVoiceData}
            onCommand={handleVoiceCommand}
            language={selectedLanguage}
            disabled={disabled}
            size="large"
          />
        </div>

        {/* Voice Settings */}
        <div className="voice-settings">
          <details className="settings-panel">
            <summary className="settings-toggle">
              <span>⚙️ Voice Settings</span>
            </summary>
            <div className="settings-content">
              <div className="setting-row">
                <label className="setting-label">
                  <input
                    type="checkbox"
                    checked={voiceSettings.autoFill}
                    onChange={(e) => updateVoiceSetting('autoFill', e.target.checked)}
                  />
                  Auto-fill form fields
                </label>
                <span className="setting-help">
                  Automatically populate form fields from voice input
                </span>
              </div>

              <div className="setting-row">
                <label className="setting-label">
                  <input
                    type="checkbox"
                    checked={voiceSettings.confirmLowConfidence}
                    onChange={(e) => updateVoiceSetting('confirmLowConfidence', e.target.checked)}
                  />
                  Confirm low confidence values
                </label>
                <span className="setting-help">
                  Ask for confirmation when speech recognition confidence is low
                </span>
              </div>

              <div className="setting-row">
                <label className="setting-label">
                  <input
                    type="checkbox"
                    checked={voiceSettings.enableShortcuts}
                    onChange={(e) => updateVoiceSetting('enableShortcuts', e.target.checked)}
                  />
                  Enable voice shortcuts
                </label>
                <span className="setting-help">
                  Allow voice commands like "calculate my taxes"
                </span>
              </div>

              <div className="setting-row">
                <label className="setting-label">
                  <input
                    type="checkbox"
                    checked={voiceSettings.announceChanges}
                    onChange={(e) => updateVoiceSetting('announceChanges', e.target.checked)}
                  />
                  Announce changes
                </label>
                <span className="setting-help">
                  Provide audio feedback for form changes (accessibility)
                </span>
              </div>
            </div>
          </details>
        </div>

        {/* Voice Status */}
        {(isVoiceActive || currentTranscript || filledFields.length > 0) && (
          <div className="voice-status">
            <div className="status-header">
              <h4>Voice Status</h4>
              {filledFields.length > 0 && (
                <div className="voice-actions">
                  <button
                    onClick={undoLastVoiceUpdate}
                    className="action-btn undo"
                    title="Undo last voice input"
                  >
                    ↶ Undo
                  </button>
                  <button
                    onClick={clearVoiceFields}
                    className="action-btn clear"
                    title="Clear all voice-filled fields"
                  >
                    🗑️ Clear All
                  </button>
                </div>
              )}
            </div>

            {currentTranscript && (
              <div className="current-transcript">
                <label>Current transcript:</label>
                <div className="transcript-text">"{currentTranscript}"</div>
                <div className="transcript-confidence">
                  Confidence: {Math.round(confidence * 100)}%
                </div>
              </div>
            )}

            {filledFields.length > 0 && (
              <div className="filled-fields">
                <label>Voice-filled fields:</label>
                <div className="fields-list">
                  {filledFields.map((field, index) => (
                    <span key={index} className="field-tag">
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Voice Commands */}
      {showCommands && voiceSettings.enableShortcuts && (
        <VoiceCommands
          onCommand={handleVoiceCommand}
          language={selectedLanguage}
          showShortcuts={true}
          autoExecute={true}
        />
      )}

      {/* Form Confirmations */}
      {pendingConfirmations.length > 0 && (
        <VoiceFormConfirmation
          pendingConfirmations={pendingConfirmations}
          onConfirm={confirmFieldUpdate}
          onReject={confirmFieldUpdate}
          onConfirmAll={confirmAllUpdates}
          onRejectAll={confirmAllUpdates}
        />
      )}

      {/* Accessibility Features */}
      <VoiceAccessibility
        isVoiceActive={isVoiceActive}
        currentTranscript={currentTranscript}
        confidence={confidence}
        language={selectedLanguage}
        onKeyboardCommand={handleKeyboardCommand}
      />

      {/* Voice Input Tips */}
      <div className="voice-tips">
        <details className="tips-panel">
          <summary className="tips-toggle">
            <span>💡 Voice Input Tips</span>
          </summary>
          <div className="tips-content">
            <div className="tip-category">
              <h5>Speaking Tips</h5>
              <ul>
                <li>Speak clearly and at a normal pace</li>
                <li>Use natural language: "I make fifty thousand dollars"</li>
                <li>Be specific: Include context like "per year" or "annually"</li>
                <li>Pause briefly between different pieces of information</li>
              </ul>
            </div>

            <div className="tip-category">
              <h5>Example Phrases</h5>
              <ul>
                <li>"I make seventy-five thousand dollars per year"</li>
                <li>"I'm married filing jointly"</li>
                <li>"I have two dependents"</li>
                <li>"Calculate my taxes for 2023"</li>
              </ul>
            </div>

            <div className="tip-category">
              <h5>Troubleshooting</h5>
              <ul>
                <li>Ensure your microphone is working and not muted</li>
                <li>Speak in a quiet environment when possible</li>
                <li>If recognition is poor, try speaking more slowly</li>
                <li>Use the manual correction if voice input is incorrect</li>
              </ul>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};

export default VoiceInput;