import React, { useState, useEffect } from 'react';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { voiceService } from '../../services/voiceService';
import './VoiceButton.css';

/**
 * Voice Input Button Component
 * Main interface for voice recognition with visual feedback
 */
const VoiceButton = ({
  onTranscript,
  onVoiceData,
  onCommand,
  language = 'en-US',
  disabled = false,
  className = '',
  size = 'medium'
}) => {
  const {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    error,
    confidence,
    startListening,
    stopListening,
    resetTranscript,
    changeLanguage,
    fullTranscript,
    getBrowserSupport
  } = useSpeechRecognition();

  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessedTranscript, setLastProcessedTranscript] = useState('');
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);

  // Update language when prop changes
  useEffect(() => {
    changeLanguage(language);
  }, [language, changeLanguage]);

  // Process transcript when it changes
  useEffect(() => {
    const processTranscript = async () => {
      if (transcript && transcript !== lastProcessedTranscript && transcript.trim().length > 0) {
        setIsProcessing(true);
        setLastProcessedTranscript(transcript);

        try {
          // Send transcript to parent component
          if (onTranscript) {
            onTranscript(transcript, confidence);
          }

          // Process with AI service
          const result = await voiceService.processNaturalLanguage(
            transcript,
            language,
            confidence
          );

          // Send processed data to parent
          if (onVoiceData && result.success) {
            onVoiceData(result.data, result.confidence);
          }

          // Handle voice commands
          if (onCommand && result.commands.length > 0) {
            result.commands.forEach(command => {
              onCommand(command.type, command.parameters, command.confidence);
            });
          }

          // Track analytics
          voiceService.trackAnalytics('transcription_complete', {
            language,
            confidence,
            dataExtracted: Object.keys(result.data).length,
            commandsFound: result.commands.length
          });

        } catch (error) {
          console.error('Voice processing error:', error);
          voiceService.trackAnalytics('processing_error', {
            error: error.message,
            language
          });
        } finally {
          setIsProcessing(false);
        }
      }
    };

    processTranscript();
  }, [transcript, language, confidence, onTranscript, onVoiceData, onCommand, lastProcessedTranscript]);

  // Voice level animation effect
  useEffect(() => {
    if (isListening && interimTranscript.length > 0) {
      // Simulate voice level based on transcript length and activity
      const level = Math.min(interimTranscript.length * 2, 100);
      setVoiceLevel(level);
    } else {
      setVoiceLevel(0);
    }
  }, [isListening, interimTranscript]);

  // Handle voice button click
  const handleVoiceClick = () => {
    if (!isSupported) {
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      // Start new session
      resetTranscript();
      setLastProcessedTranscript('');
      voiceService.trackAnalytics('session_start', { language });
      startListening();
    }
  };

  // Handle microphone access error
  useEffect(() => {
    if (error && error.includes('not-allowed')) {
      // Show help for microphone permissions
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 5000);
    }
  }, [error]);

  // Get button states and styling
  const getButtonState = () => {
    if (!isSupported) return 'unsupported';
    if (disabled) return 'disabled';
    if (isProcessing) return 'processing';
    if (isListening) return 'listening';
    if (error) return 'error';
    return 'ready';
  };

  const buttonState = getButtonState();
  const browserSupport = getBrowserSupport();

  // Voice level bars for visual feedback
  const renderVoiceLevelBars = () => {
    if (!isListening) return null;

    const bars = Array.from({ length: 5 }, (_, i) => {
      const isActive = voiceLevel > (i * 20);
      return (
        <div
          key={i}
          className={`voice-level-bar ${isActive ? 'active' : ''}`}
          style={{
            animationDelay: `${i * 0.1}s`,
            height: isActive ? `${Math.min(voiceLevel / 5, 20)}px` : '2px'
          }}
        />
      );
    });

    return <div className="voice-level-indicator">{bars}</div>;
  };

  // Render unsupported browser message
  if (!isSupported) {
    return (
      <div className={`voice-button-container unsupported ${className}`}>
        <button
          className={`voice-button ${size} unsupported`}
          disabled
          title={`Voice input not supported in ${browserSupport.browser}`}
        >
          <svg className="voice-icon" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 14C13.66 14 15 12.66 15 11V5C15 3.34 13.66 2 12 2S9 3.34 9 5V11C9 12.66 10.34 14 12 14Z"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M19 11V13C19 17.42 15.42 21 11 21H10V23H14V21H13C18.52 21 23 16.52 23 11V9H21V11H19Z"
              stroke="currentColor"
              strokeWidth="2"
            />
            <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2"/>
          </svg>
          <span className="voice-text">Voice Not Supported</span>
        </button>
        <div className="browser-support-info">
          <p>Voice input requires Chrome, Edge, or Safari</p>
          <p>Current: {browserSupport.browser} - {browserSupport.version}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`voice-button-container ${buttonState} ${className}`}>
      <button
        className={`voice-button ${size} ${buttonState}`}
        onClick={handleVoiceClick}
        disabled={disabled || !isSupported}
        aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
        title={isListening ? 'Click to stop listening' : 'Click to start voice input'}
      >
        {/* Microphone Icon */}
        <svg className="voice-icon" viewBox="0 0 24 24" fill="none">
          {isListening ? (
            <>
              <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.1" />
              <path
                d="M12 14C13.66 14 15 12.66 15 11V5C15 3.34 13.66 2 12 2S9 3.34 9 5V11C9 12.66 10.34 14 12 14Z"
                fill="currentColor"
              />
              <path
                d="M19 11V13C19 17.42 15.42 21 11 21H13C18.52 21 23 16.52 23 11V9H21V11H19Z"
                fill="currentColor"
              />
            </>
          ) : (
            <>
              <path
                d="M12 14C13.66 14 15 12.66 15 11V5C15 3.34 13.66 2 12 2S9 3.34 9 5V11C9 12.66 10.34 14 12 14Z"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
              />
              <path
                d="M19 11V13C19 17.42 15.42 21 11 21H13C18.52 21 23 16.52 23 11V9H21V11H19Z"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
              />
            </>
          )}
        </svg>

        {/* Button Text */}
        <span className="voice-text">
          {buttonState === 'listening' && 'Listening...'}
          {buttonState === 'processing' && 'Processing...'}
          {buttonState === 'ready' && 'Tap to speak'}
          {buttonState === 'error' && 'Try again'}
          {buttonState === 'disabled' && 'Voice disabled'}
        </span>

        {/* Loading Spinner */}
        {(isListening || isProcessing) && (
          <div className="voice-spinner">
            <div className="spinner"></div>
          </div>
        )}
      </button>

      {/* Voice Level Indicator */}
      {renderVoiceLevelBars()}

      {/* Confidence Indicator */}
      {confidence > 0 && !isListening && (
        <div className="confidence-indicator">
          <div
            className="confidence-bar"
            style={{ width: `${confidence * 100}%` }}
            title={`Confidence: ${Math.round(confidence * 100)}%`}
          />
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="voice-error">
          <span className="error-icon">⚠️</span>
          <span className="error-text">{error}</span>
        </div>
      )}

      {/* Tooltip for Permissions */}
      {showTooltip && (
        <div className="voice-tooltip">
          <p>Please allow microphone access to use voice input.</p>
          <p>Look for the microphone icon in your browser's address bar.</p>
        </div>
      )}

      {/* Transcript Display */}
      {(fullTranscript || isListening) && (
        <div className="transcript-display">
          <div className="transcript-text">
            {transcript && <span className="final-transcript">{transcript}</span>}
            {interimTranscript && (
              <span className="interim-transcript">{interimTranscript}</span>
            )}
            {isListening && !fullTranscript && (
              <span className="listening-prompt">Start speaking...</span>
            )}
          </div>
        </div>
      )}

      {/* Processing Indicator */}
      {isProcessing && (
        <div className="processing-indicator">
          <div className="processing-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span>Processing your speech...</span>
        </div>
      )}
    </div>
  );
};

export default VoiceButton;