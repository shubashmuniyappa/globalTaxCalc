import React, { useEffect, useRef, useState, useCallback } from 'react';
import './VoiceAccessibility.css';

/**
 * Voice Accessibility Component
 * Provides comprehensive accessibility features for voice input
 */
const VoiceAccessibility = ({
  isVoiceActive = false,
  currentTranscript = '',
  confidence = 0,
  language = 'en-US',
  onKeyboardCommand,
  className = ''
}) => {
  const [announcements, setAnnouncements] = useState([]);
  const [keyboardShortcutsEnabled, setKeyboardShortcutsEnabled] = useState(true);
  const [screenReaderMode, setScreenReaderMode] = useState(false);
  const [highContrastMode, setHighContrastMode] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [focusManagement, setFocusManagement] = useState(true);

  const ariaLiveRef = useRef(null);
  const politeAnnouncerRef = useRef(null);
  const assertiveAnnouncerRef = useRef(null);
  const lastAnnouncementRef = useRef('');

  // Detect user preferences
  useEffect(() => {
    // Check for screen reader
    const hasScreenReader = window.navigator.userAgent.includes('NVDA') ||
                           window.navigator.userAgent.includes('JAWS') ||
                           window.speechSynthesis?.getVoices().length > 0;
    setScreenReaderMode(hasScreenReader);

    // Check for high contrast preference
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
    setHighContrastMode(prefersHighContrast);

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setReducedMotion(prefersReducedMotion);

    // Listen for preference changes
    const contrastQuery = window.matchMedia('(prefers-contrast: high)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleContrastChange = (e) => setHighContrastMode(e.matches);
    const handleMotionChange = (e) => setReducedMotion(e.matches);

    contrastQuery.addEventListener('change', handleContrastChange);
    motionQuery.addEventListener('change', handleMotionChange);

    return () => {
      contrastQuery.removeEventListener('change', handleContrastChange);
      motionQuery.removeEventListener('change', handleMotionChange);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    if (!keyboardShortcutsEnabled) return;

    const handleKeyDown = (event) => {
      // Don't interfere with form inputs
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
      }

      const { ctrlKey, altKey, shiftKey, code, key } = event;

      // Voice control shortcuts
      if (ctrlKey && !altKey && !shiftKey) {
        switch (code) {
          case 'Space':
            event.preventDefault();
            announceToScreenReader('Voice input toggle requested');
            onKeyboardCommand?.('toggleVoice');
            break;
          case 'Enter':
            event.preventDefault();
            announceToScreenReader('Calculate taxes requested');
            onKeyboardCommand?.('calculate');
            break;
          case 'KeyR':
            event.preventDefault();
            announceToScreenReader('Clear form requested');
            onKeyboardCommand?.('clearForm');
            break;
          case 'KeyH':
            event.preventDefault();
            announceToScreenReader('Help requested');
            onKeyboardCommand?.('showHelp');
            break;
        }
      }

      // Alt + shortcuts for accessibility
      if (altKey && !ctrlKey && !shiftKey) {
        switch (code) {
          case 'KeyV':
            event.preventDefault();
            announceToScreenReader('Voice settings opened');
            onKeyboardCommand?.('voiceSettings');
            break;
          case 'KeyL':
            event.preventDefault();
            announceToScreenReader('Language selector opened');
            onKeyboardCommand?.('languageSelector');
            break;
          case 'KeyT':
            event.preventDefault();
            announceToScreenReader('Transcript view opened');
            onKeyboardCommand?.('showTranscript');
            break;
        }
      }

      // F-key shortcuts
      if (!ctrlKey && !altKey && !shiftKey) {
        switch (code) {
          case 'F1':
            event.preventDefault();
            announceToScreenReader('Voice help opened');
            onKeyboardCommand?.('voiceHelp');
            break;
          case 'Escape':
            event.preventDefault();
            announceToScreenReader('Voice input cancelled');
            onKeyboardCommand?.('cancelVoice');
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [keyboardShortcutsEnabled, onKeyboardCommand]);

  // Voice status announcements
  useEffect(() => {
    if (isVoiceActive) {
      announceToScreenReader('Voice input is now listening', 'assertive');
    } else if (currentTranscript) {
      announceToScreenReader('Voice input stopped', 'polite');
    }
  }, [isVoiceActive]);

  // Transcript announcements
  useEffect(() => {
    if (currentTranscript && currentTranscript !== lastAnnouncementRef.current) {
      const confidenceText = confidence > 0.8 ? 'high confidence' :
                            confidence > 0.6 ? 'medium confidence' : 'low confidence';

      announceToScreenReader(
        `Voice input: ${currentTranscript}, ${confidenceText}`,
        'polite'
      );
      lastAnnouncementRef.current = currentTranscript;
    }
  }, [currentTranscript, confidence]);

  // Screen reader announcements
  const announceToScreenReader = useCallback((message, priority = 'polite') => {
    if (!message || message === lastAnnouncementRef.current) return;

    const announcement = {
      id: Date.now(),
      message,
      priority,
      timestamp: new Date().toISOString()
    };

    setAnnouncements(prev => [...prev.slice(-4), announcement]);

    // Use appropriate aria-live region
    const announcer = priority === 'assertive' ? assertiveAnnouncerRef.current : politeAnnouncerRef.current;
    if (announcer) {
      announcer.textContent = message;

      // Clear after announcement
      setTimeout(() => {
        if (announcer.textContent === message) {
          announcer.textContent = '';
        }
      }, 1000);
    }

    // Fallback: use speech synthesis if available
    if (window.speechSynthesis && screenReaderMode) {
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = 1.2;
      utterance.volume = 0.8;
      utterance.lang = language;
      window.speechSynthesis.speak(utterance);
    }
  }, [language, screenReaderMode]);

  // Voice feedback for form interactions
  const announceFormChange = useCallback((fieldName, value, action = 'updated') => {
    const message = `${fieldName} ${action} to ${value}`;
    announceToScreenReader(message, 'polite');
  }, [announceToScreenReader]);

  // Status descriptions for screen readers
  const getVoiceStatusDescription = () => {
    if (isVoiceActive) {
      return `Voice input is active and listening. Current transcript: ${currentTranscript || 'none'}.
              Confidence level: ${Math.round(confidence * 100)} percent.`;
    }
    return 'Voice input is inactive. Press Control plus Space to start listening.';
  };

  const getKeyboardShortcutsDescription = () => {
    return `Keyboard shortcuts available:
            Control plus Space to toggle voice input,
            Control plus Enter to calculate taxes,
            Control plus R to clear form,
            Control plus H for help,
            Alt plus V for voice settings,
            F1 for voice help,
            Escape to cancel voice input.`;
  };

  // Focus management
  useEffect(() => {
    if (!focusManagement) return;

    const handleFocus = (event) => {
      const element = event.target;
      if (element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA') {
        const label = element.labels?.[0]?.textContent ||
                     element.getAttribute('aria-label') ||
                     element.getAttribute('placeholder') ||
                     'form field';
        announceToScreenReader(`Focused on ${label}`, 'polite');
      }
    };

    document.addEventListener('focusin', handleFocus);
    return () => document.removeEventListener('focusin', handleFocus);
  }, [focusManagement, announceToScreenReader]);

  return (
    <div className={`voice-accessibility ${className} ${highContrastMode ? 'high-contrast' : ''} ${reducedMotion ? 'reduced-motion' : ''}`}>
      {/* Screen Reader Announcements */}
      <div
        ref={politeAnnouncerRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        role="status"
      />

      <div
        ref={assertiveAnnouncerRef}
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
        role="alert"
      />

      {/* Voice Status for Screen Readers */}
      <div
        className="sr-only"
        aria-live="polite"
        aria-label="Voice input status"
        role="status"
      >
        {getVoiceStatusDescription()}
      </div>

      {/* Keyboard Navigation Help */}
      <div
        className="sr-only"
        aria-label="Keyboard shortcuts"
        role="region"
      >
        {getKeyboardShortcutsDescription()}
      </div>

      {/* Visual Voice Status Indicator */}
      {isVoiceActive && (
        <div
          className="voice-status-indicator"
          role="status"
          aria-label={`Voice input active. ${currentTranscript ? `Current text: ${currentTranscript}` : 'Listening for speech.'}`}
        >
          <div className="status-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="microphone-icon">
              <path d="M12 14C13.66 14 15 12.66 15 11V5C15 3.34 13.66 2 12 2S9 3.34 9 5V11C9 12.66 10.34 14 12 14Z" fill="currentColor"/>
              <path d="M19 11V13C19 17.42 15.42 21 11 21H13C18.52 21 23 16.52 23 11V9H21V11H19Z" fill="currentColor"/>
              {!reducedMotion && (
                <circle cx="12" cy="12" r="15" className="pulse-ring" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.6"/>
              )}
            </svg>
          </div>
          <div className="status-text">
            <span className="status-label">Voice Input Active</span>
            {currentTranscript && (
              <span className="current-transcript" aria-live="polite">
                {currentTranscript}
              </span>
            )}
            <span className="confidence-indicator" aria-label={`Confidence: ${Math.round(confidence * 100)} percent`}>
              Confidence: {Math.round(confidence * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Panel (toggleable) */}
      <details className="keyboard-shortcuts-panel">
        <summary className="shortcuts-toggle">
          <span className="toggle-icon" aria-hidden="true">⌨️</span>
          Keyboard Shortcuts
        </summary>
        <div className="shortcuts-content">
          <div className="shortcuts-section">
            <h4>Voice Control</h4>
            <dl className="shortcuts-list">
              <div className="shortcut-item">
                <dt><kbd>Ctrl</kbd> + <kbd>Space</kbd></dt>
                <dd>Toggle voice input</dd>
              </div>
              <div className="shortcut-item">
                <dt><kbd>Escape</kbd></dt>
                <dd>Cancel voice input</dd>
              </div>
              <div className="shortcut-item">
                <dt><kbd>Alt</kbd> + <kbd>V</kbd></dt>
                <dd>Voice settings</dd>
              </div>
              <div className="shortcut-item">
                <dt><kbd>Alt</kbd> + <kbd>L</kbd></dt>
                <dd>Language selector</dd>
              </div>
            </dl>
          </div>

          <div className="shortcuts-section">
            <h4>Actions</h4>
            <dl className="shortcuts-list">
              <div className="shortcut-item">
                <dt><kbd>Ctrl</kbd> + <kbd>Enter</kbd></dt>
                <dd>Calculate taxes</dd>
              </div>
              <div className="shortcut-item">
                <dt><kbd>Ctrl</kbd> + <kbd>R</kbd></dt>
                <dd>Clear form</dd>
              </div>
              <div className="shortcut-item">
                <dt><kbd>F1</kbd></dt>
                <dd>Show help</dd>
              </div>
            </dl>
          </div>
        </div>
      </details>

      {/* Accessibility Settings */}
      <details className="accessibility-settings">
        <summary className="settings-toggle">
          <span className="toggle-icon" aria-hidden="true">♿</span>
          Accessibility Settings
        </summary>
        <div className="settings-content">
          <div className="setting-item">
            <label className="setting-label">
              <input
                type="checkbox"
                checked={keyboardShortcutsEnabled}
                onChange={(e) => setKeyboardShortcutsEnabled(e.target.checked)}
                aria-describedby="keyboard-shortcuts-help"
              />
              Enable keyboard shortcuts
            </label>
            <div id="keyboard-shortcuts-help" className="setting-help">
              Allow keyboard shortcuts for voice control and navigation
            </div>
          </div>

          <div className="setting-item">
            <label className="setting-label">
              <input
                type="checkbox"
                checked={focusManagement}
                onChange={(e) => setFocusManagement(e.target.checked)}
                aria-describedby="focus-management-help"
              />
              Enhanced focus announcements
            </label>
            <div id="focus-management-help" className="setting-help">
              Announce form field names when focused
            </div>
          </div>

          <div className="setting-item">
            <label className="setting-label">
              <input
                type="checkbox"
                checked={screenReaderMode}
                onChange={(e) => setScreenReaderMode(e.target.checked)}
                aria-describedby="screen-reader-help"
              />
              Screen reader optimizations
            </label>
            <div id="screen-reader-help" className="setting-help">
              Enable additional announcements for screen readers
            </div>
          </div>
        </div>
      </details>

      {/* Recent Announcements (for debugging) */}
      {process.env.NODE_ENV === 'development' && (
        <details className="debug-announcements">
          <summary>Debug: Recent Announcements</summary>
          <div className="announcements-list">
            {announcements.map((announcement) => (
              <div key={announcement.id} className="announcement-item">
                <span className="announcement-priority">[{announcement.priority}]</span>
                <span className="announcement-message">{announcement.message}</span>
                <span className="announcement-time">
                  {new Date(announcement.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Skip Links */}
      <div className="skip-links">
        <a href="#voice-input" className="skip-link">
          Skip to voice input
        </a>
        <a href="#tax-form" className="skip-link">
          Skip to tax form
        </a>
        <a href="#results" className="skip-link">
          Skip to results
        </a>
      </div>
    </div>
  );
};

export default VoiceAccessibility;