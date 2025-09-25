import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for Web Speech API integration
 * Provides voice recognition with browser compatibility and error handling
 */
export const useSpeechRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const [language, setLanguage] = useState('en-US');

  const recognitionRef = useRef(null);
  const timeoutRef = useRef(null);
  const silenceTimeoutRef = useRef(null);

  // Supported languages for voice input
  const supportedLanguages = {
    'en-US': 'English (US)',
    'en-GB': 'English (UK)',
    'es-ES': 'Spanish (Spain)',
    'es-MX': 'Spanish (Mexico)',
    'fr-FR': 'French (France)',
    'fr-CA': 'French (Canada)'
  };

  // Check browser support on mount
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      setIsSupported(true);

      // Initialize Speech Recognition
      const recognition = new SpeechRecognition();

      // Configuration
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;
      recognition.lang = language;

      // Event handlers
      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
        console.log('Voice recognition started');
      };

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        let highestConfidence = 0;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          const confidence = result[0].confidence || 0;

          if (result.isFinal) {
            finalTranscript += transcript;
            highestConfidence = Math.max(highestConfidence, confidence);
          } else {
            interimTranscript += transcript;
          }
        }

        setInterimTranscript(interimTranscript);

        if (finalTranscript) {
          setTranscript(prev => prev + finalTranscript);
          setConfidence(highestConfidence);

          // Reset silence timeout on speech
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
          }

          // Set new silence timeout
          silenceTimeoutRef.current = setTimeout(() => {
            if (isListening) {
              stopListening();
            }
          }, 3000); // Stop after 3 seconds of silence
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);

        const errorMessages = {
          'no-speech': 'No speech was detected. Please try again.',
          'audio-capture': 'Audio capture failed. Check your microphone.',
          'not-allowed': 'Microphone access was denied. Please enable microphone permissions.',
          'network': 'Network error occurred. Check your internet connection.',
          'aborted': 'Speech recognition was aborted.',
          'bad-grammar': 'Grammar error in speech recognition.',
          'language-not-supported': `Language ${language} is not supported.`
        };

        setError(errorMessages[event.error] || `Speech recognition error: ${event.error}`);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');

        // Clear timeouts
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
        }

        console.log('Voice recognition ended');
      };

      recognitionRef.current = recognition;
    } else {
      setIsSupported(false);
      setError('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
    };
  }, [language]);

  // Start listening function
  const startListening = useCallback(() => {
    if (!isSupported || !recognitionRef.current || isListening) {
      return;
    }

    try {
      setTranscript('');
      setInterimTranscript('');
      setError(null);
      setConfidence(0);

      // Update language before starting
      recognitionRef.current.lang = language;
      recognitionRef.current.start();

      // Set maximum listening time (30 seconds)
      timeoutRef.current = setTimeout(() => {
        if (isListening) {
          stopListening();
        }
      }, 30000);

    } catch (error) {
      console.error('Error starting speech recognition:', error);
      setError('Failed to start voice recognition. Please try again.');
    }
  }, [isSupported, isListening, language]);

  // Stop listening function
  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  // Reset transcript
  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setConfidence(0);
    setError(null);
  }, []);

  // Change language
  const changeLanguage = useCallback((newLanguage) => {
    if (supportedLanguages[newLanguage]) {
      setLanguage(newLanguage);

      // If currently listening, restart with new language
      if (isListening) {
        stopListening();
        setTimeout(() => startListening(), 100);
      }
    }
  }, [isListening, startListening, stopListening]);

  // Browser compatibility check
  const getBrowserSupport = () => {
    const userAgent = navigator.userAgent;

    if (userAgent.includes('Chrome')) {
      return { supported: true, browser: 'Chrome', version: 'Full support' };
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      return { supported: true, browser: 'Safari', version: 'Partial support' };
    } else if (userAgent.includes('Edge')) {
      return { supported: true, browser: 'Edge', version: 'Full support' };
    } else if (userAgent.includes('Firefox')) {
      return { supported: false, browser: 'Firefox', version: 'Not supported' };
    } else {
      return { supported: false, browser: 'Unknown', version: 'Unknown' };
    }
  };

  // Voice activity detection
  const [isVoiceActive, setIsVoiceActive] = useState(false);

  useEffect(() => {
    if (interimTranscript.trim().length > 0) {
      setIsVoiceActive(true);
    } else {
      setIsVoiceActive(false);
    }
  }, [interimTranscript]);

  return {
    // State
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    error,
    confidence,
    language,
    isVoiceActive,

    // Actions
    startListening,
    stopListening,
    resetTranscript,
    changeLanguage,

    // Utilities
    supportedLanguages,
    getBrowserSupport,

    // Combined transcript for display
    fullTranscript: transcript + interimTranscript
  };
};