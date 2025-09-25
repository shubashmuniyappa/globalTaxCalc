/**
 * Voice Service for GlobalTaxCalc.com
 * Handles natural language processing, AI integration, and voice analytics
 */

class VoiceService {
  constructor() {
    this.apiBaseUrl = process.env.REACT_APP_API_URL || 'https://api.globaltaxcalc.com';
    this.aiServiceUrl = `${this.apiBaseUrl}/api/voice`;
    this.analytics = {
      sessions: 0,
      successfulTranscriptions: 0,
      failedTranscriptions: 0,
      averageConfidence: 0,
      commonCommands: new Map(),
      languageUsage: new Map()
    };
  }

  /**
   * Process natural language text and extract structured tax data
   * @param {string} text - Transcribed speech text
   * @param {string} language - Language code (e.g., 'en-US')
   * @param {number} confidence - Speech recognition confidence
   * @returns {Promise<Object>} Structured tax data
   */
  async processNaturalLanguage(text, language = 'en-US', confidence = 1.0) {
    try {
      this.trackAnalytics('transcription_attempt', { language, confidence });

      const response = await fetch(`${this.aiServiceUrl}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          text: text.toLowerCase().trim(),
          language,
          confidence,
          context: 'tax_calculator',
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`AI service error: ${response.status}`);
      }

      const result = await response.json();

      this.trackAnalytics('transcription_success', {
        extractedFields: Object.keys(result.data || {}).length,
        confidence: result.confidence
      });

      return this.formatAIResponse(result);

    } catch (error) {
      console.error('Natural language processing error:', error);
      this.trackAnalytics('transcription_error', { error: error.message });

      // Fallback to local processing
      return this.fallbackProcessing(text, language);
    }
  }

  /**
   * Fallback local processing for basic voice commands
   * @param {string} text - Input text
   * @param {string} language - Language code
   * @returns {Object} Processed data
   */
  fallbackProcessing(text, language) {
    const result = {
      success: true,
      confidence: 0.7,
      data: {},
      commands: [],
      suggestions: []
    };

    const lowerText = text.toLowerCase();

    // Income patterns
    const incomePatterns = {
      'en-US': [
        /(?:i make|i earn|my income is|my salary is)\s*(?:about\s*)?[$]?(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:dollars?|per year|annually)?/i,
        /(?:annual income|yearly income|gross income)\s*(?:is\s*)?[$]?(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
        /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:dollars?|per year|annually)/i
      ],
      'es-ES': [
        /(?:gano|mi ingreso es|mi salario es)\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:euros?|al año|anualmente)?/i,
        /(?:ingreso anual|ingreso bruto)\s*(?:es\s*)?(\d+(?:,\d{3})*(?:\.\d{2})?)/i
      ],
      'fr-FR': [
        /(?:je gagne|mon revenu est|mon salaire est)\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:euros?|par an|annuellement)?/i,
        /(?:revenu annuel|revenu brut)\s*(?:est\s*)?(\d+(?:,\d{3})*(?:\.\d{2})?)/i
      ]
    };

    // Filing status patterns
    const filingStatusPatterns = {
      'en-US': {
        single: /(?:i am|i'm)\s*(?:single|unmarried|not married)/i,
        married: /(?:i am|i'm)\s*(?:married|wed)/i,
        marriedFilingSeparately: /(?:married filing separately|married but filing separately)/i,
        headOfHousehold: /(?:head of household|head of family)/i
      }
    };

    // Dependents patterns
    const dependentsPatterns = {
      'en-US': [
        /(?:i have|with)\s*(\d+)\s*(?:kids?|children|dependents)/i,
        /(\d+)\s*(?:kids?|children|dependents)/i
      ]
    };

    // Extract income
    const currentPatterns = incomePatterns[language] || incomePatterns['en-US'];
    for (const pattern of currentPatterns) {
      const match = lowerText.match(pattern);
      if (match) {
        const income = parseFloat(match[1].replace(/,/g, ''));
        if (income > 0) {
          result.data.income = income;
          break;
        }
      }
    }

    // Extract filing status
    const statusPatterns = filingStatusPatterns[language] || filingStatusPatterns['en-US'];
    Object.entries(statusPatterns).forEach(([status, pattern]) => {
      if (pattern.test(lowerText)) {
        result.data.filingStatus = status;
      }
    });

    // Extract dependents
    const depPatterns = dependentsPatterns[language] || dependentsPatterns['en-US'];
    for (const pattern of depPatterns) {
      const match = lowerText.match(pattern);
      if (match) {
        const dependents = parseInt(match[1]);
        if (dependents >= 0) {
          result.data.dependents = dependents;
          break;
        }
      }
    }

    // Check for commands
    result.commands = this.extractCommands(lowerText, language);

    return result;
  }

  /**
   * Extract voice commands from text
   * @param {string} text - Input text
   * @param {string} language - Language code
   * @returns {Array} Extracted commands
   */
  extractCommands(text, language) {
    const commands = [];

    const commandPatterns = {
      'en-US': {
        calculate: /(?:calculate|compute|figure out)\s*(?:my\s*)?(?:taxes?|tax return)/i,
        clear: /(?:clear|reset|start over)\s*(?:all\s*)?(?:fields?|form|data)?/i,
        help: /(?:help|what can you do|how does this work)/i,
        results: /(?:show|display|view)\s*(?:my\s*)?(?:results?|calculation|tax)/i,
        country: /(?:change|set|select)\s*(?:country|location)\s*(?:to\s*)?(\w+)?/i,
        year: /(?:tax year|year)\s*(\d{4})/i
      },
      'es-ES': {
        calculate: /(?:calcular|computar)\s*(?:mis\s*)?(?:impuestos?)/i,
        clear: /(?:limpiar|borrar|empezar de nuevo)/i,
        help: /(?:ayuda|qué puedes hacer)/i,
        results: /(?:mostrar|ver)\s*(?:mis\s*)?(?:resultados?|cálculo)/i
      },
      'fr-FR': {
        calculate: /(?:calculer|compter)\s*(?:mes\s*)?(?:impôts?|taxes?)/i,
        clear: /(?:effacer|nettoyer|recommencer)/i,
        help: /(?:aide|que peux-tu faire)/i,
        results: /(?:montrer|afficher)\s*(?:mes\s*)?(?:résultats?|calcul)/i
      }
    };

    const patterns = commandPatterns[language] || commandPatterns['en-US'];

    Object.entries(patterns).forEach(([command, pattern]) => {
      const match = text.match(pattern);
      if (match) {
        commands.push({
          type: command,
          confidence: 0.9,
          parameters: match[1] ? { value: match[1] } : {}
        });
      }
    });

    return commands;
  }

  /**
   * Format AI service response
   * @param {Object} response - Raw AI response
   * @returns {Object} Formatted response
   */
  formatAIResponse(response) {
    return {
      success: true,
      confidence: response.confidence || 0.8,
      data: this.validateExtractedData(response.data || {}),
      commands: response.commands || [],
      suggestions: response.suggestions || [],
      ambiguities: response.ambiguities || [],
      processingTime: response.processingTime || 0
    };
  }

  /**
   * Validate and sanitize extracted data
   * @param {Object} data - Extracted data
   * @returns {Object} Validated data
   */
  validateExtractedData(data) {
    const validated = {};

    // Validate income
    if (data.income !== undefined) {
      const income = parseFloat(data.income);
      if (!isNaN(income) && income >= 0 && income <= 10000000) {
        validated.income = income;
      }
    }

    // Validate filing status
    const validFilingStatuses = ['single', 'married', 'marriedFilingSeparately', 'headOfHousehold'];
    if (data.filingStatus && validFilingStatuses.includes(data.filingStatus)) {
      validated.filingStatus = data.filingStatus;
    }

    // Validate dependents
    if (data.dependents !== undefined) {
      const dependents = parseInt(data.dependents);
      if (!isNaN(dependents) && dependents >= 0 && dependents <= 20) {
        validated.dependents = dependents;
      }
    }

    // Validate country
    const validCountries = ['US', 'CA', 'UK', 'AU'];
    if (data.country && validCountries.includes(data.country.toUpperCase())) {
      validated.country = data.country.toUpperCase();
    }

    // Validate tax year
    if (data.taxYear !== undefined) {
      const year = parseInt(data.taxYear);
      const currentYear = new Date().getFullYear();
      if (!isNaN(year) && year >= 2020 && year <= currentYear) {
        validated.taxYear = year;
      }
    }

    return validated;
  }

  /**
   * Get authentication token for API calls
   * @returns {string} Auth token
   */
  getAuthToken() {
    return localStorage.getItem('authToken') || '';
  }

  /**
   * Track voice analytics
   * @param {string} event - Event type
   * @param {Object} data - Event data
   */
  trackAnalytics(event, data = {}) {
    try {
      // Update local analytics
      switch (event) {
        case 'session_start':
          this.analytics.sessions++;
          break;
        case 'transcription_success':
          this.analytics.successfulTranscriptions++;
          this.updateAverageConfidence(data.confidence);
          break;
        case 'transcription_error':
          this.analytics.failedTranscriptions++;
          break;
        case 'command_used':
          const count = this.analytics.commonCommands.get(data.command) || 0;
          this.analytics.commonCommands.set(data.command, count + 1);
          break;
        case 'language_used':
          const langCount = this.analytics.languageUsage.get(data.language) || 0;
          this.analytics.languageUsage.set(data.language, langCount + 1);
          break;
      }

      // Send to analytics service (async)
      this.sendAnalytics(event, data).catch(console.error);

    } catch (error) {
      console.error('Analytics tracking error:', error);
    }
  }

  /**
   * Send analytics to service
   * @param {string} event - Event type
   * @param {Object} data - Event data
   */
  async sendAnalytics(event, data) {
    try {
      await fetch(`${this.apiBaseUrl}/api/analytics/voice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          event,
          data,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          sessionId: this.getSessionId()
        })
      });
    } catch (error) {
      // Silently fail analytics
      console.debug('Analytics send failed:', error);
    }
  }

  /**
   * Update average confidence score
   * @param {number} newConfidence - New confidence score
   */
  updateAverageConfidence(newConfidence) {
    const total = this.analytics.successfulTranscriptions;
    const current = this.analytics.averageConfidence;
    this.analytics.averageConfidence = ((current * (total - 1)) + newConfidence) / total;
  }

  /**
   * Get or create session ID
   * @returns {string} Session ID
   */
  getSessionId() {
    let sessionId = sessionStorage.getItem('voiceSessionId');
    if (!sessionId) {
      sessionId = 'voice_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('voiceSessionId', sessionId);
    }
    return sessionId;
  }

  /**
   * Get voice analytics summary
   * @returns {Object} Analytics data
   */
  getAnalytics() {
    return {
      ...this.analytics,
      commonCommands: Object.fromEntries(this.analytics.commonCommands),
      languageUsage: Object.fromEntries(this.analytics.languageUsage),
      successRate: this.analytics.successfulTranscriptions /
                   (this.analytics.successfulTranscriptions + this.analytics.failedTranscriptions) || 0
    };
  }

  /**
   * Voice command shortcuts mapping
   */
  getVoiceShortcuts(language = 'en-US') {
    const shortcuts = {
      'en-US': {
        'calculate my taxes': { action: 'calculate', description: 'Start tax calculation' },
        'i make X dollars': { action: 'setIncome', description: 'Set annual income' },
        'i am married': { action: 'setFilingStatus', params: { status: 'married' } },
        'i am single': { action: 'setFilingStatus', params: { status: 'single' } },
        'i have X kids': { action: 'setDependents', description: 'Set number of dependents' },
        'clear all fields': { action: 'clearForm', description: 'Reset all form fields' },
        'show my results': { action: 'showResults', description: 'Display calculation results' },
        'help': { action: 'showHelp', description: 'Show voice commands help' }
      },
      'es-ES': {
        'calcular mis impuestos': { action: 'calculate', description: 'Calcular impuestos' },
        'gano X euros': { action: 'setIncome', description: 'Establecer ingreso anual' },
        'estoy casado': { action: 'setFilingStatus', params: { status: 'married' } },
        'estoy soltero': { action: 'setFilingStatus', params: { status: 'single' } },
        'tengo X hijos': { action: 'setDependents', description: 'Establecer dependientes' },
        'limpiar todo': { action: 'clearForm', description: 'Resetear formulario' },
        'mostrar resultados': { action: 'showResults', description: 'Mostrar resultados' }
      },
      'fr-FR': {
        'calculer mes impôts': { action: 'calculate', description: 'Calculer les impôts' },
        'je gagne X euros': { action: 'setIncome', description: 'Définir le revenu annuel' },
        'je suis marié': { action: 'setFilingStatus', params: { status: 'married' } },
        'je suis célibataire': { action: 'setFilingStatus', params: { status: 'single' } },
        'j\'ai X enfants': { action: 'setDependents', description: 'Définir les personnes à charge' },
        'effacer tout': { action: 'clearForm', description: 'Réinitialiser le formulaire' },
        'montrer les résultats': { action: 'showResults', description: 'Afficher les résultats' }
      }
    };

    return shortcuts[language] || shortcuts['en-US'];
  }
}

// Export singleton instance
export const voiceService = new VoiceService();