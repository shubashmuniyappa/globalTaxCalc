/**
 * Advanced Search Features Service
 * Implements fuzzy search, synonyms, multi-language support, and machine learning
 */

const natural = require('natural');
const compromise = require('compromise');
const Fuse = require('fuse.js');
const LanguageDetect = require('languagedetect');
const logger = require('../utils/logger');

class AdvancedSearchService {
  constructor() {
    this.languageDetector = new LanguageDetect();

    // Language-specific analyzers and stemmers
    this.stemmers = {
      en: natural.PorterStemmer,
      es: natural.PorterStemmerEs,
      fr: natural.PorterStemmerFr,
      ru: natural.PorterStemmerRu,
      it: natural.PorterStemmerIt,
      pt: natural.PorterStemmerPt,
      no: natural.PorterStemmerNo,
      sv: natural.PorterStemmerSv,
      da: natural.PorterStemmerDa,
      nl: natural.PorterStemmerNl,
      de: natural.PorterStemmerDe
    };

    // Synonym maps for different languages
    this.synonymMaps = this.initializeSynonymMaps();

    // Machine learning models for query understanding
    this.intentClassifier = null;
    this.entityExtractor = null;

    this.initializeMLModels();
  }

  /**
   * Initialize synonym maps for different languages
   */
  initializeSynonymMaps() {
    return {
      en: {
        'tax': ['taxation', 'levy', 'duty', 'assessment', 'charge'],
        'income': ['salary', 'wages', 'earnings', 'pay', 'compensation', 'remuneration'],
        'deduction': ['exemption', 'allowance', 'credit', 'relief', 'writeoff'],
        'calculate': ['compute', 'determine', 'estimate', 'figure out'],
        'federal': ['national', 'country', 'government'],
        'state': ['provincial', 'regional', 'local'],
        'business': ['company', 'corporation', 'enterprise', 'firm'],
        'personal': ['individual', 'private', 'own'],
        'annual': ['yearly', 'per year'],
        'monthly': ['per month'],
        'file': ['submit', 'lodge', 'send'],
        'form': ['document', 'paperwork', 'return'],
        'deadline': ['due date', 'filing date'],
        'refund': ['return', 'rebate', 'get back'],
        'owe': ['pay', 'liable', 'due', 'owing'],
        'bracket': ['tier', 'band', 'range', 'level']
      },
      es: {
        'impuesto': ['tributación', 'gravamen', 'tasa'],
        'ingreso': ['salario', 'sueldo', 'ganancia'],
        'deducción': ['exención', 'descuento', 'rebaja'],
        'calcular': ['computar', 'determinar', 'estimar'],
        'federal': ['nacional', 'del país'],
        'estado': ['provincial', 'regional'],
        'empresa': ['compañía', 'corporación', 'negocio'],
        'personal': ['individual', 'privado'],
        'anual': ['por año', 'cada año'],
        'mensual': ['por mes', 'cada mes']
      },
      fr: {
        'impôt': ['taxation', 'prélèvement', 'taxe'],
        'revenu': ['salaire', 'gains', 'rémunération'],
        'déduction': ['exemption', 'abattement', 'réduction'],
        'calculer': ['computer', 'déterminer', 'estimer'],
        'fédéral': ['national', 'du pays'],
        'entreprise': ['société', 'compagnie', 'firme'],
        'personnel': ['individuel', 'privé'],
        'annuel': ['par an', 'chaque année'],
        'mensuel': ['par mois', 'chaque mois']
      },
      de: {
        'steuer': ['besteuerung', 'abgabe', 'gebühr'],
        'einkommen': ['gehalt', 'lohn', 'verdienst'],
        'abzug': ['freibetrag', 'ermäßigung'],
        'berechnen': ['ausrechnen', 'ermitteln', 'schätzen'],
        'bundesweit': ['national', 'des landes'],
        'unternehmen': ['firma', 'gesellschaft', 'betrieb'],
        'persönlich': ['individuell', 'privat'],
        'jährlich': ['pro jahr', 'jedes jahr'],
        'monatlich': ['pro monat', 'jeden monat']
      }
    };
  }

  /**
   * Initialize machine learning models for query understanding
   */
  async initializeMLModels() {
    try {
      // Initialize intent classification model
      this.intentClassifier = new natural.LogisticRegressionClassifier();

      // Train with sample intents
      this.trainIntentClassifier();

      // Initialize entity extraction patterns
      this.entityPatterns = this.initializeEntityPatterns();

      logger.info('ML models initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize ML models:', error);
    }
  }

  /**
   * Train intent classification model
   */
  trainIntentClassifier() {
    const trainingData = [
      // Tax calculation intents
      { text: 'calculate my income tax', intent: 'tax_calculation' },
      { text: 'how much tax do I owe', intent: 'tax_calculation' },
      { text: 'tax calculator for 2024', intent: 'tax_calculation' },
      { text: 'estimate my tax refund', intent: 'tax_calculation' },

      // Information seeking intents
      { text: 'what are tax deductions', intent: 'information' },
      { text: 'how to file taxes', intent: 'information' },
      { text: 'tax deadline 2024', intent: 'information' },
      { text: 'tax forms explained', intent: 'information' },

      // Comparison intents
      { text: 'tax rates by country', intent: 'comparison' },
      { text: 'compare tax systems', intent: 'comparison' },
      { text: 'best countries for taxes', intent: 'comparison' },

      // Help seeking intents
      { text: 'help with tax filing', intent: 'help' },
      { text: 'tax problems', intent: 'help' },
      { text: 'need tax advice', intent: 'help' },

      // Navigation intents
      { text: 'find tax calculator', intent: 'navigation' },
      { text: 'tax guides', intent: 'navigation' },
      { text: 'tax tools', intent: 'navigation' }
    ];

    trainingData.forEach(({ text, intent }) => {
      const tokens = this.tokenizeQuery(text);
      this.intentClassifier.addDocument(tokens, intent);
    });

    this.intentClassifier.train();
  }

  /**
   * Initialize entity extraction patterns
   */
  initializeEntityPatterns() {
    return {
      amount: /\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
      percentage: /(\d+(?:\.\d+)?)%/g,
      year: /(20\d{2}|19\d{2})/g,
      country: /\b(usa|us|uk|canada|australia|germany|france|japan|singapore|india|china)\b/gi,
      currency: /\b(usd|eur|gbp|cad|aud|jpy|sgd|inr|cny)\b/gi,
      filing_status: /\b(single|married|head of household|widow|widower)\b/gi,
      tax_type: /\b(income tax|sales tax|property tax|capital gains|inheritance tax)\b/gi
    };
  }

  /**
   * Enhanced query processing with NLP
   */
  async processQuery(query, language = 'en') {
    try {
      const processedQuery = {
        original: query,
        language: language,
        cleaned: this.cleanQuery(query),
        normalized: this.normalizeQuery(query, language),
        intent: this.classifyIntent(query),
        entities: this.extractEntities(query),
        synonyms: this.expandSynonyms(query, language),
        stemmed: this.stemQuery(query, language),
        sentiment: this.analyzeSentiment(query),
        complexity: this.assessQueryComplexity(query),
        suggestions: this.generateQuerySuggestions(query, language)
      };

      return processedQuery;
    } catch (error) {
      logger.error('Query processing failed:', error);
      return {
        original: query,
        language: language,
        cleaned: query,
        normalized: query.toLowerCase()
      };
    }
  }

  /**
   * Multi-language query understanding
   */
  async detectQueryLanguage(query) {
    try {
      const languages = this.languageDetector.detect(query, 3);

      if (languages.length > 0) {
        // Return the most likely language with confidence score
        return {
          language: languages[0][0],
          confidence: languages[0][1],
          alternatives: languages.slice(1)
        };
      }

      return { language: 'en', confidence: 0.5, alternatives: [] };
    } catch (error) {
      return { language: 'en', confidence: 0.5, alternatives: [] };
    }
  }

  /**
   * Fuzzy search with advanced matching
   */
  async fuzzySearch(query, documents, options = {}) {
    const {
      threshold = 0.6,
      includeMatches = true,
      includeScore = true,
      maxResults = 50
    } = options;

    try {
      const fuseOptions = {
        includeScore: includeScore,
        includeMatches: includeMatches,
        threshold: 1 - threshold, // Fuse uses distance, we use similarity
        keys: [
          { name: 'title', weight: 0.3 },
          { name: 'description', weight: 0.2 },
          { name: 'content', weight: 0.3 },
          { name: 'tags', weight: 0.2 }
        ],
        ignoreLocation: true,
        ignoreFieldNorm: false,
        fieldNormWeight: 0.5
      };

      const fuse = new Fuse(documents, fuseOptions);
      const results = fuse.search(query, { limit: maxResults });

      return results.map(result => ({
        item: result.item,
        score: 1 - result.score, // Convert distance to similarity
        matches: result.matches || []
      }));

    } catch (error) {
      logger.error('Fuzzy search failed:', error);
      return [];
    }
  }

  /**
   * Intelligent query expansion
   */
  expandSynonyms(query, language = 'en') {
    const synonymMap = this.synonymMaps[language] || this.synonymMaps.en;
    const words = query.toLowerCase().split(/\s+/);
    const expandedTerms = new Set();

    words.forEach(word => {
      expandedTerms.add(word);

      // Find synonyms for the word
      Object.keys(synonymMap).forEach(key => {
        if (key === word || synonymMap[key].includes(word)) {
          expandedTerms.add(key);
          synonymMap[key].forEach(synonym => expandedTerms.add(synonym));
        }
      });
    });

    return Array.from(expandedTerms);
  }

  /**
   * Intent classification
   */
  classifyIntent(query) {
    try {
      if (!this.intentClassifier) {
        return 'unknown';
      }

      const tokens = this.tokenizeQuery(query);
      const classification = this.intentClassifier.classify(tokens);

      return classification || 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Entity extraction from queries
   */
  extractEntities(query) {
    const entities = {};

    Object.keys(this.entityPatterns).forEach(entityType => {
      const pattern = this.entityPatterns[entityType];
      const matches = query.match(pattern);

      if (matches) {
        entities[entityType] = matches.map(match => ({
          value: match,
          normalized: this.normalizeEntity(match, entityType)
        }));
      }
    });

    // Use compromise for advanced entity extraction
    try {
      const doc = compromise(query);

      // Extract people, places, organizations
      const people = doc.people().out('array');
      const places = doc.places().out('array');
      const organizations = doc.organizations().out('array');

      if (people.length) entities.people = people;
      if (places.length) entities.places = places;
      if (organizations.length) entities.organizations = organizations;

    } catch (error) {
      // Fallback to simple extraction
    }

    return entities;
  }

  /**
   * Stem query terms based on language
   */
  stemQuery(query, language = 'en') {
    const stemmer = this.stemmers[language] || this.stemmers.en;
    const tokens = this.tokenizeQuery(query);

    return tokens.map(token => stemmer.stem(token)).join(' ');
  }

  /**
   * Analyze query sentiment
   */
  analyzeSentiment(query) {
    try {
      const analyzer = new natural.SentimentAnalyzer('English',
        natural.PorterStemmer, 'afinn');

      const tokens = this.tokenizeQuery(query);
      const score = analyzer.getSentiment(tokens);

      if (score > 0.1) return { sentiment: 'positive', score };
      if (score < -0.1) return { sentiment: 'negative', score };
      return { sentiment: 'neutral', score };
    } catch (error) {
      return { sentiment: 'neutral', score: 0 };
    }
  }

  /**
   * Assess query complexity
   */
  assessQueryComplexity(query) {
    const tokens = this.tokenizeQuery(query);
    const uniqueTokens = new Set(tokens);

    let complexity = 'simple';

    // Factors that increase complexity
    if (tokens.length > 10) complexity = 'medium';
    if (tokens.length > 20) complexity = 'complex';
    if (uniqueTokens.size / tokens.length < 0.5) complexity = 'complex'; // High repetition
    if (/[()&|!]/.test(query)) complexity = 'complex'; // Boolean operators
    if (/"[^"]*"/.test(query)) complexity = 'medium'; // Quoted phrases

    return complexity;
  }

  /**
   * Generate query suggestions and corrections
   */
  generateQuerySuggestions(query, language = 'en') {
    const suggestions = [];

    // Spelling corrections
    const spellingSuggestions = this.getSpellingSuggestions(query, language);
    suggestions.push(...spellingSuggestions);

    // Query expansion suggestions
    const expansionSuggestions = this.getExpansionSuggestions(query, language);
    suggestions.push(...expansionSuggestions);

    // Refinement suggestions
    const refinementSuggestions = this.getRefinementSuggestions(query);
    suggestions.push(...refinementSuggestions);

    return suggestions.slice(0, 5); // Limit to top 5 suggestions
  }

  /**
   * Get spelling suggestions
   */
  getSpellingSuggestions(query, language = 'en') {
    const suggestions = [];
    const tokens = this.tokenizeQuery(query);

    // Common tax-related word corrections
    const corrections = {
      'calulator': 'calculator',
      'calcuator': 'calculator',
      'calculater': 'calculator',
      'deductoin': 'deduction',
      'deductio': 'deduction',
      'dedcution': 'deduction',
      'refund': 'refund',
      'refun': 'refund',
      'refound': 'refund',
      'incme': 'income',
      'incom': 'income',
      'incoem': 'income'
    };

    let hasCorrection = false;
    const correctedTokens = tokens.map(token => {
      if (corrections[token.toLowerCase()]) {
        hasCorrection = true;
        return corrections[token.toLowerCase()];
      }
      return token;
    });

    if (hasCorrection) {
      suggestions.push({
        type: 'spelling',
        suggestion: correctedTokens.join(' '),
        reason: 'Spelling correction'
      });
    }

    return suggestions;
  }

  /**
   * Get query expansion suggestions
   */
  getExpansionSuggestions(query, language = 'en') {
    const suggestions = [];
    const synonyms = this.expandSynonyms(query, language);

    if (synonyms.length > query.split(' ').length) {
      const expandedQuery = synonyms.slice(0, 8).join(' ');
      suggestions.push({
        type: 'expansion',
        suggestion: expandedQuery,
        reason: 'Include related terms'
      });
    }

    return suggestions;
  }

  /**
   * Get query refinement suggestions
   */
  getRefinementSuggestions(query) {
    const suggestions = [];
    const entities = this.extractEntities(query);

    // Suggest adding year if not present
    if (!entities.year && /tax/.test(query.toLowerCase())) {
      suggestions.push({
        type: 'refinement',
        suggestion: `${query} 2024`,
        reason: 'Specify tax year'
      });
    }

    // Suggest adding country if not present
    if (!entities.country && /tax/.test(query.toLowerCase())) {
      suggestions.push({
        type: 'refinement',
        suggestion: `${query} USA`,
        reason: 'Specify country'
      });
    }

    return suggestions;
  }

  /**
   * Build advanced Elasticsearch query with ML insights
   */
  buildAdvancedQuery(processedQuery, filters = {}) {
    const {
      original,
      normalized,
      intent,
      entities,
      synonyms,
      stemmed,
      language
    } = processedQuery;

    const query = {
      bool: {
        must: [],
        should: [],
        filter: [],
        must_not: []
      }
    };

    // Main query based on intent
    switch (intent) {
      case 'tax_calculation':
        query.bool.must.push({
          bool: {
            should: [
              {
                multi_match: {
                  query: normalized,
                  fields: ['title^3', 'description^2', 'content'],
                  type: 'best_fields',
                  fuzziness: 'AUTO'
                }
              },
              {
                terms: { content_type: ['calculator'] }
              }
            ]
          }
        });
        break;

      case 'information':
        query.bool.must.push({
          multi_match: {
            query: normalized,
            fields: ['title^2', 'content^3', 'description^2'],
            type: 'best_fields',
            fuzziness: 'AUTO'
          }
        });
        query.bool.should.push({
          terms: { content_type: ['article', 'guide', 'faq'] }
        });
        break;

      case 'comparison':
        query.bool.must.push({
          multi_match: {
            query: normalized,
            fields: ['title^2', 'content^2', 'tags^3'],
            type: 'cross_fields'
          }
        });
        break;

      default:
        query.bool.must.push({
          multi_match: {
            query: normalized,
            fields: ['title^2', 'description', 'content', 'tags'],
            type: 'best_fields',
            fuzziness: 'AUTO'
          }
        });
    }

    // Add synonym expansion
    if (synonyms.length > 0) {
      query.bool.should.push({
        terms: {
          searchable_text: synonyms
        }
      });
    }

    // Add entity-based boosts
    if (entities.country) {
      query.bool.should.push({
        terms: {
          country: entities.country.map(e => e.normalized),
          boost: 2.0
        }
      });
    }

    if (entities.year) {
      query.bool.should.push({
        terms: {
          tax_year: entities.year.map(e => e.normalized),
          boost: 1.5
        }
      });
    }

    // Language preference
    if (language && language !== 'en') {
      query.bool.should.push({
        term: {
          language: {
            value: language,
            boost: 1.3
          }
        }
      });
    }

    return query;
  }

  /**
   * Utility functions
   */
  cleanQuery(query) {
    return query
      .replace(/[^\w\s-'"]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  normalizeQuery(query, language = 'en') {
    return this.cleanQuery(query.toLowerCase());
  }

  tokenizeQuery(query) {
    const tokenizer = new natural.WordTokenizer();
    return tokenizer.tokenize(query.toLowerCase()) || [];
  }

  normalizeEntity(entity, type) {
    switch (type) {
      case 'amount':
        return parseFloat(entity.replace(/[$,]/g, ''));
      case 'percentage':
        return parseFloat(entity.replace('%', ''));
      case 'year':
        return parseInt(entity);
      case 'country':
        return entity.toLowerCase();
      default:
        return entity.toLowerCase();
    }
  }
}

module.exports = new AdvancedSearchService();