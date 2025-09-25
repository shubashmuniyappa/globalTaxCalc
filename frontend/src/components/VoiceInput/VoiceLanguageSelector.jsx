import React, { useState } from 'react';
import './VoiceLanguageSelector.css';

/**
 * Voice Language Selector Component
 * Allows users to select their preferred language for voice input
 */
const VoiceLanguageSelector = ({
  selectedLanguage = 'en-US',
  onLanguageChange,
  className = '',
  compact = false
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Supported languages with voice recognition
  const supportedLanguages = [
    {
      code: 'en-US',
      name: 'English (US)',
      flag: '🇺🇸',
      quality: 'excellent',
      commands: [
        'I make fifty thousand dollars',
        'I am married with two kids',
        'Calculate my taxes'
      ]
    },
    {
      code: 'en-GB',
      name: 'English (UK)',
      flag: '🇬🇧',
      quality: 'excellent',
      commands: [
        'I earn fifty thousand pounds',
        'I am married with two children',
        'Calculate my taxes'
      ]
    },
    {
      code: 'es-ES',
      name: 'Spanish (Spain)',
      flag: '🇪🇸',
      quality: 'good',
      commands: [
        'Gano cincuenta mil euros',
        'Estoy casado con dos hijos',
        'Calcular mis impuestos'
      ]
    },
    {
      code: 'es-MX',
      name: 'Spanish (Mexico)',
      flag: '🇲🇽',
      quality: 'good',
      commands: [
        'Gano cincuenta mil pesos',
        'Estoy casado con dos hijos',
        'Calcular mis impuestos'
      ]
    },
    {
      code: 'fr-FR',
      name: 'French (France)',
      flag: '🇫🇷',
      quality: 'good',
      commands: [
        'Je gagne cinquante mille euros',
        'Je suis marié avec deux enfants',
        'Calculer mes impôts'
      ]
    },
    {
      code: 'fr-CA',
      name: 'French (Canada)',
      flag: '🇨🇦',
      quality: 'good',
      commands: [
        'Je gagne cinquante mille dollars',
        'Je suis marié avec deux enfants',
        'Calculer mes impôts'
      ]
    }
  ];

  const currentLanguage = supportedLanguages.find(lang => lang.code === selectedLanguage) || supportedLanguages[0];

  const handleLanguageSelect = (languageCode) => {
    if (onLanguageChange) {
      onLanguageChange(languageCode);
    }
    setIsOpen(false);
  };

  const getQualityColor = (quality) => {
    switch (quality) {
      case 'excellent': return '#22c55e';
      case 'good': return '#f59e0b';
      case 'fair': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getQualityText = (quality) => {
    switch (quality) {
      case 'excellent': return 'Excellent recognition';
      case 'good': return 'Good recognition';
      case 'fair': return 'Fair recognition';
      default: return 'Unknown quality';
    }
  };

  if (compact) {
    return (
      <div className={`voice-language-selector compact ${className}`}>
        <div className="language-dropdown">
          <button
            className="language-trigger compact"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Select voice input language"
            aria-expanded={isOpen}
          >
            <span className="flag">{currentLanguage.flag}</span>
            <span className="code">{currentLanguage.code.split('-')[0].toUpperCase()}</span>
            <svg className={`chevron ${isOpen ? 'open' : ''}`} viewBox="0 0 24 24">
              <path d="M7 10L12 15L17 10H7Z" fill="currentColor"/>
            </svg>
          </button>

          {isOpen && (
            <div className="language-menu compact">
              {supportedLanguages.map((language) => (
                <button
                  key={language.code}
                  className={`language-option compact ${language.code === selectedLanguage ? 'selected' : ''}`}
                  onClick={() => handleLanguageSelect(language.code)}
                >
                  <span className="flag">{language.flag}</span>
                  <span className="name">{language.name}</span>
                  <div
                    className="quality-indicator"
                    style={{ backgroundColor: getQualityColor(language.quality) }}
                    title={getQualityText(language.quality)}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`voice-language-selector ${className}`}>
      <div className="selector-header">
        <h3>Voice Input Language</h3>
        <p>Choose your preferred language for voice recognition</p>
      </div>

      <div className="language-dropdown">
        <button
          className="language-trigger"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Select voice input language"
          aria-expanded={isOpen}
        >
          <div className="current-language">
            <span className="flag">{currentLanguage.flag}</span>
            <div className="language-info">
              <span className="name">{currentLanguage.name}</span>
              <span className="quality" style={{ color: getQualityColor(currentLanguage.quality) }}>
                {getQualityText(currentLanguage.quality)}
              </span>
            </div>
          </div>
          <svg className={`chevron ${isOpen ? 'open' : ''}`} viewBox="0 0 24 24">
            <path d="M7 10L12 15L17 10H7Z" fill="currentColor"/>
          </svg>
        </button>

        {isOpen && (
          <div className="language-menu">
            {supportedLanguages.map((language) => (
              <button
                key={language.code}
                className={`language-option ${language.code === selectedLanguage ? 'selected' : ''}`}
                onClick={() => handleLanguageSelect(language.code)}
              >
                <div className="language-header">
                  <span className="flag">{language.flag}</span>
                  <div className="language-details">
                    <span className="name">{language.name}</span>
                    <div className="quality-info">
                      <div
                        className="quality-indicator"
                        style={{ backgroundColor: getQualityColor(language.quality) }}
                      />
                      <span className="quality-text" style={{ color: getQualityColor(language.quality) }}>
                        {getQualityText(language.quality)}
                      </span>
                    </div>
                  </div>
                  {language.code === selectedLanguage && (
                    <svg className="check-icon" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z" fill="currentColor"/>
                    </svg>
                  )}
                </div>

                <div className="example-commands">
                  <p className="commands-title">Example voice commands:</p>
                  <ul className="commands-list">
                    {language.commands.map((command, index) => (
                      <li key={index} className="command-example">
                        "{command}"
                      </li>
                    ))}
                  </ul>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Language Tips */}
      <div className="language-tips">
        <h4>Voice Recognition Tips</h4>
        <ul>
          <li>Speak clearly and at a normal pace</li>
          <li>Use natural language - no need for specific commands</li>
          <li>Try saying numbers as words: "fifty thousand" instead of "50,000"</li>
          <li>Include context: "I make fifty thousand dollars per year"</li>
        </ul>
      </div>

      {/* Browser Compatibility */}
      <div className="compatibility-info">
        <h4>Browser Compatibility</h4>
        <div className="browser-grid">
          <div className="browser-item supported">
            <span className="browser-icon">🌐</span>
            <span>Chrome</span>
            <span className="status">✅ Full Support</span>
          </div>
          <div className="browser-item supported">
            <span className="browser-icon">🌐</span>
            <span>Edge</span>
            <span className="status">✅ Full Support</span>
          </div>
          <div className="browser-item partial">
            <span className="browser-icon">🌐</span>
            <span>Safari</span>
            <span className="status">⚠️ Partial Support</span>
          </div>
          <div className="browser-item unsupported">
            <span className="browser-icon">🌐</span>
            <span>Firefox</span>
            <span className="status">❌ Not Supported</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceLanguageSelector;