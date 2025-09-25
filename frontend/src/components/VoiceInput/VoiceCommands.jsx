import React, { useState, useEffect, useCallback } from 'react';
import { voiceService } from '../../services/voiceService';
import './VoiceCommands.css';

/**
 * Voice Commands Component
 * Handles voice command shortcuts and provides visual feedback
 */
const VoiceCommands = ({
  onCommand,
  language = 'en-US',
  className = '',
  showShortcuts = true,
  autoExecute = true
}) => {
  const [availableCommands, setAvailableCommands] = useState([]);
  const [recentCommands, setRecentCommands] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [commandFeedback, setCommandFeedback] = useState(null);

  // Load voice shortcuts for current language
  useEffect(() => {
    const shortcuts = voiceService.getVoiceShortcuts(language);
    const commandList = Object.entries(shortcuts).map(([phrase, config]) => ({
      phrase,
      ...config,
      id: phrase.replace(/\s+/g, '_').toLowerCase()
    }));
    setAvailableCommands(commandList);
  }, [language]);

  // Handle voice command execution
  const executeCommand = useCallback(async (commandType, parameters = {}, confidence = 1.0) => {
    const command = availableCommands.find(cmd => cmd.action === commandType);

    if (!command) {
      console.warn(`Unknown voice command: ${commandType}`);
      return;
    }

    // Show feedback
    setCommandFeedback({
      command: commandType,
      phrase: command.phrase || commandType,
      confidence,
      timestamp: Date.now()
    });

    // Add to recent commands
    setRecentCommands(prev => [
      {
        id: Date.now(),
        type: commandType,
        phrase: command.phrase || commandType,
        confidence,
        timestamp: Date.now(),
        parameters
      },
      ...prev.slice(0, 4) // Keep last 5 commands
    ]);

    // Track analytics
    voiceService.trackAnalytics('command_used', {
      command: commandType,
      confidence,
      language,
      autoExecuted: autoExecute
    });

    // Execute command if auto-execute is enabled
    if (autoExecute && onCommand) {
      try {
        await onCommand(commandType, parameters, confidence);
      } catch (error) {
        console.error('Command execution error:', error);
        setCommandFeedback(prev => ({
          ...prev,
          error: error.message
        }));
      }
    }

    // Clear feedback after 3 seconds
    setTimeout(() => {
      setCommandFeedback(null);
    }, 3000);

  }, [availableCommands, autoExecute, onCommand, language]);

  // Handle manual command trigger
  const triggerCommand = useCallback(async (commandType, parameters = {}) => {
    await executeCommand(commandType, parameters, 1.0);
  }, [executeCommand]);

  // Get command category
  const getCommandCategory = (action) => {
    const categories = {
      calculate: 'Calculation',
      setIncome: 'Data Entry',
      setFilingStatus: 'Data Entry',
      setDependents: 'Data Entry',
      clearForm: 'Form Control',
      showResults: 'Navigation',
      showHelp: 'Help'
    };
    return categories[action] || 'Other';
  };

  // Get command icon
  const getCommandIcon = (action) => {
    const icons = {
      calculate: '🧮',
      setIncome: '💰',
      setFilingStatus: '👤',
      setDependents: '👨‍👩‍👧‍👦',
      clearForm: '🗑️',
      showResults: '📊',
      showHelp: '❓'
    };
    return icons[action] || '🎤';
  };

  // Group commands by category
  const groupedCommands = availableCommands.reduce((groups, command) => {
    const category = getCommandCategory(command.action);
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(command);
    return groups;
  }, {});

  if (!showShortcuts && !commandFeedback && recentCommands.length === 0) {
    return null;
  }

  return (
    <div className={`voice-commands ${className}`}>
      {/* Command Feedback */}
      {commandFeedback && (
        <div className={`command-feedback ${commandFeedback.error ? 'error' : 'success'}`}>
          <div className="feedback-content">
            <div className="feedback-icon">
              {commandFeedback.error ? '❌' : '✅'}
            </div>
            <div className="feedback-text">
              <div className="feedback-phrase">
                "{commandFeedback.phrase}"
              </div>
              {commandFeedback.error ? (
                <div className="feedback-error">
                  Error: {commandFeedback.error}
                </div>
              ) : (
                <div className="feedback-success">
                  Command executed ({Math.round(commandFeedback.confidence * 100)}% confidence)
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recent Commands */}
      {recentCommands.length > 0 && (
        <div className="recent-commands">
          <h4>Recent Voice Commands</h4>
          <div className="recent-commands-list">
            {recentCommands.map((command) => (
              <div key={command.id} className="recent-command-item">
                <div className="command-icon">
                  {getCommandIcon(command.type)}
                </div>
                <div className="command-details">
                  <div className="command-phrase">"{command.phrase}"</div>
                  <div className="command-meta">
                    {Math.round(command.confidence * 100)}% • {
                      new Date(command.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    }
                  </div>
                </div>
                <button
                  className="repeat-command-btn"
                  onClick={() => triggerCommand(command.type, command.parameters)}
                  title="Repeat this command"
                  aria-label={`Repeat command: ${command.phrase}`}
                >
                  ↻
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Commands */}
      {showShortcuts && (
        <div className="voice-shortcuts">
          <div className="shortcuts-header">
            <h4>Voice Commands</h4>
            <p>Try saying these phrases:</p>
          </div>

          <div className="commands-grid">
            {Object.entries(groupedCommands).map(([category, commands]) => (
              <div key={category} className="command-category">
                <h5 className="category-title">{category}</h5>
                <div className="category-commands">
                  {commands.map((command) => (
                    <div
                      key={command.id}
                      className="command-item"
                      onClick={() => triggerCommand(command.action, command.params || {})}
                      role="button"
                      tabIndex={0}
                      title={command.description || `Execute: ${command.phrase}`}
                      aria-label={`Voice command: ${command.phrase}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          triggerCommand(command.action, command.params || {});
                        }
                      }}
                    >
                      <div className="command-header">
                        <span className="command-icon">
                          {getCommandIcon(command.action)}
                        </span>
                        <span className="command-name">
                          {command.phrase}
                        </span>
                      </div>
                      {command.description && (
                        <div className="command-description">
                          {command.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Command Tips */}
          <div className="command-tips">
            <h5>💡 Voice Command Tips</h5>
            <div className="tips-list">
              <div className="tip-item">
                <strong>Be specific:</strong> Say "I make fifty thousand dollars" instead of just "fifty thousand"
              </div>
              <div className="tip-item">
                <strong>Natural language:</strong> Use everyday phrases like "I'm married with two kids"
              </div>
              <div className="tip-item">
                <strong>Clear speech:</strong> Speak clearly and at a normal pace for better recognition
              </div>
              <div className="tip-item">
                <strong>Multiple commands:</strong> You can combine commands: "I make 75000 and I'm single"
              </div>
            </div>
          </div>

          {/* Language-specific examples */}
          <div className="language-examples">
            <h5>Examples in {language === 'en-US' ? 'English' : language}</h5>
            <div className="examples-list">
              {availableCommands.slice(0, 3).map((command, index) => (
                <div key={index} className="example-item">
                  <div className="example-phrase">"{command.phrase}"</div>
                  <div className="example-result">
                    → {command.description || `Executes ${command.action}`}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Keyboard shortcuts */}
          <div className="keyboard-alternatives">
            <h5>⌨️ Keyboard Alternatives</h5>
            <div className="keyboard-shortcuts-list">
              <div className="keyboard-shortcut">
                <kbd>Ctrl</kbd> + <kbd>Space</kbd> → Start voice input
              </div>
              <div className="keyboard-shortcut">
                <kbd>Ctrl</kbd> + <kbd>Enter</kbd> → Calculate taxes
              </div>
              <div className="keyboard-shortcut">
                <kbd>Ctrl</kbd> + <kbd>R</kbd> → Clear form
              </div>
              <div className="keyboard-shortcut">
                <kbd>F1</kbd> → Show help
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Voice Status Indicator */}
      {isListening && (
        <div className="voice-status">
          <div className="status-indicator">
            <div className="pulse-ring"></div>
            <div className="pulse-ring delay-1"></div>
            <div className="pulse-ring delay-2"></div>
            <span className="status-text">Listening for commands...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceCommands;