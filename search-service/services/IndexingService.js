/**
 * Content Indexing Service
 * Handles indexing of all content types with real-time updates
 */

const { elasticsearchConfig } = require('../config/elasticsearch');
const logger = require('../utils/logger');
const natural = require('natural');
const LanguageDetect = require('languagedetect');
const cheerio = require('cheerio');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const Queue = require('bull');
const Redis = require('ioredis');

class IndexingService {
  constructor() {
    this.client = null;
    this.languageDetector = new LanguageDetect();
    this.stemmer = natural.PorterStemmer;
    this.tokenizer = new natural.WordTokenizer();

    // Initialize Redis and Bull queue for async indexing
    this.redis = new Redis(process.env.REDIS_URL);
    this.indexingQueue = new Queue('content indexing', process.env.REDIS_URL);

    this.setupQueueProcessors();
  }

  async initialize() {
    this.client = elasticsearchConfig.getClient();
  }

  /**
   * Setup queue processors for async indexing
   */
  setupQueueProcessors() {
    // Process tax calculator indexing
    this.indexingQueue.process('index-calculator', 5, async (job) => {
      const { calculatorData } = job.data;
      return await this.indexTaxCalculator(calculatorData);
    });

    // Process content indexing
    this.indexingQueue.process('index-content', 3, async (job) => {
      const { contentData } = job.data;
      return await this.indexContent(contentData);
    });

    // Process FAQ indexing
    this.indexingQueue.process('index-faq', 2, async (job) => {
      const { faqData } = job.data;
      return await this.indexFAQ(faqData);
    });

    // Process bulk indexing
    this.indexingQueue.process('bulk-index', 1, async (job) => {
      const { documents, indexName } = job.data;
      return await this.bulkIndex(documents, indexName);
    });

    // Process file content extraction and indexing
    this.indexingQueue.process('index-file', 2, async (job) => {
      const { fileData } = job.data;
      return await this.indexFileContent(fileData);
    });
  }

  /**
   * Index tax calculator metadata and content
   */
  async indexTaxCalculator(calculatorData) {
    try {
      const processedData = await this.processTaxCalculatorData(calculatorData);

      const response = await this.client.index({
        index: 'tax_calculators',
        id: processedData.id,
        body: processedData,
        refresh: true
      });

      logger.info(`Tax calculator indexed: ${processedData.id}`);
      return response;
    } catch (error) {
      logger.error('Failed to index tax calculator:', error);
      throw error;
    }
  }

  /**
   * Process tax calculator data for indexing
   */
  async processTaxCalculatorData(data) {
    const processed = {
      id: data.id,
      title: data.title,
      description: data.description,
      content: this.extractTextContent(data.content || ''),
      country: data.country,
      type: data.type || 'general',
      tags: data.tags || [],
      difficulty: data.difficulty || 'medium',
      popularity_score: data.popularity_score || 0,
      usage_count: data.usage_count || 0,
      created_at: data.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: data.status || 'active',
      language: this.detectLanguage(data.title + ' ' + data.description),
      metadata: {
        input_fields: data.input_fields || [],
        output_fields: data.output_fields || [],
        calculation_method: data.calculation_method,
        tax_year: data.tax_year,
        applicable_jurisdictions: data.applicable_jurisdictions || []
      }
    };

    // Add computed fields
    processed.searchable_text = this.createSearchableText(processed);
    processed.keywords = this.extractKeywords(processed.searchable_text);

    return processed;
  }

  /**
   * Index blog posts, guides, and articles
   */
  async indexContent(contentData) {
    try {
      const processedData = await this.processContentData(contentData);

      const response = await this.client.index({
        index: 'content',
        id: processedData.id,
        body: processedData,
        refresh: true
      });

      logger.info(`Content indexed: ${processedData.id}`);
      return response;
    } catch (error) {
      logger.error('Failed to index content:', error);
      throw error;
    }
  }

  /**
   * Process content data for indexing
   */
  async processContentData(data) {
    const cleanContent = this.extractTextContent(data.content || '');

    const processed = {
      id: data.id,
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt || this.generateExcerpt(cleanContent),
      content: cleanContent,
      content_type: data.content_type || 'article',
      category: data.category,
      tags: data.tags || [],
      author: {
        id: data.author?.id,
        name: data.author?.name,
        email: data.author?.email
      },
      published_at: data.published_at,
      updated_at: data.updated_at || new Date().toISOString(),
      status: data.status || 'published',
      language: this.detectLanguage(data.title + ' ' + cleanContent),
      reading_time: this.calculateReadingTime(cleanContent),
      view_count: data.view_count || 0,
      share_count: data.share_count || 0,
      like_count: data.like_count || 0,
      seo: {
        meta_title: data.seo?.meta_title || data.title,
        meta_description: data.seo?.meta_description || data.excerpt,
        keywords: data.seo?.keywords || []
      },
      featured_image: {
        url: data.featured_image?.url,
        alt: data.featured_image?.alt
      }
    };

    // Add computed fields
    processed.searchable_text = this.createSearchableText(processed);
    processed.keywords = this.extractKeywords(processed.searchable_text);
    processed.sentiment = this.analyzeSentiment(cleanContent);

    return processed;
  }

  /**
   * Index FAQ entries
   */
  async indexFAQ(faqData) {
    try {
      const processedData = await this.processFAQData(faqData);

      const response = await this.client.index({
        index: 'faqs',
        id: processedData.id,
        body: processedData,
        refresh: true
      });

      logger.info(`FAQ indexed: ${processedData.id}`);
      return response;
    } catch (error) {
      logger.error('Failed to index FAQ:', error);
      throw error;
    }
  }

  /**
   * Process FAQ data for indexing
   */
  async processFAQData(data) {
    const processed = {
      id: data.id,
      question: data.question,
      answer: this.extractTextContent(data.answer || ''),
      category: data.category,
      subcategory: data.subcategory,
      tags: data.tags || [],
      difficulty: data.difficulty || 'beginner',
      helpful_count: data.helpful_count || 0,
      not_helpful_count: data.not_helpful_count || 0,
      view_count: data.view_count || 0,
      created_at: data.created_at || new Date().toISOString(),
      updated_at: data.updated_at || new Date().toISOString(),
      status: data.status || 'active',
      language: this.detectLanguage(data.question + ' ' + data.answer),
      related_topics: data.related_topics || []
    };

    // Add computed fields
    processed.searchable_text = this.createSearchableText(processed);
    processed.keywords = this.extractKeywords(processed.searchable_text);
    processed.question_type = this.classifyQuestion(processed.question);

    return processed;
  }

  /**
   * Bulk index multiple documents
   */
  async bulkIndex(documents, indexName) {
    try {
      const body = [];

      for (const doc of documents) {
        body.push({
          index: {
            _index: indexName,
            _id: doc.id
          }
        });
        body.push(doc);
      }

      const response = await this.client.bulk({
        body,
        refresh: true
      });

      if (response.errors) {
        const errorItems = response.items.filter(item => item.index?.error);
        logger.error('Bulk indexing errors:', errorItems);
      }

      logger.info(`Bulk indexed ${documents.length} documents to ${indexName}`);
      return response;
    } catch (error) {
      logger.error('Bulk indexing failed:', error);
      throw error;
    }
  }

  /**
   * Index file content (PDF, DOC, etc.)
   */
  async indexFileContent(fileData) {
    try {
      const extractedContent = await this.extractFileContent(fileData);
      const processedData = await this.processFileData(fileData, extractedContent);

      const response = await this.client.index({
        index: 'content',
        id: processedData.id,
        body: processedData,
        refresh: true
      });

      logger.info(`File content indexed: ${fileData.filename}`);
      return response;
    } catch (error) {
      logger.error('Failed to index file content:', error);
      throw error;
    }
  }

  /**
   * Extract content from files
   */
  async extractFileContent(fileData) {
    const { buffer, mimetype, filename } = fileData;

    try {
      switch (mimetype) {
        case 'application/pdf':
          const pdfData = await pdfParse(buffer);
          return pdfData.text;

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/msword':
          const docResult = await mammoth.extractRawText({ buffer });
          return docResult.value;

        case 'text/plain':
          return buffer.toString('utf-8');

        case 'text/html':
          const $ = cheerio.load(buffer.toString('utf-8'));
          return $.text();

        default:
          logger.warn(`Unsupported file type: ${mimetype}`);
          return '';
      }
    } catch (error) {
      logger.error(`Failed to extract content from ${filename}:`, error);
      return '';
    }
  }

  /**
   * Process file data for indexing
   */
  async processFileData(fileData, extractedContent) {
    return {
      id: fileData.id || this.generateId(),
      title: fileData.filename,
      content: extractedContent,
      content_type: 'file',
      file_type: fileData.mimetype,
      file_size: fileData.size,
      uploaded_at: new Date().toISOString(),
      language: this.detectLanguage(extractedContent),
      searchable_text: extractedContent,
      keywords: this.extractKeywords(extractedContent),
      reading_time: this.calculateReadingTime(extractedContent)
    };
  }

  /**
   * Update document in index
   */
  async updateDocument(indexName, documentId, updateData) {
    try {
      const response = await this.client.update({
        index: indexName,
        id: documentId,
        body: {
          doc: updateData,
          doc_as_upsert: true
        },
        refresh: true
      });

      logger.info(`Document updated: ${documentId} in ${indexName}`);
      return response;
    } catch (error) {
      logger.error('Failed to update document:', error);
      throw error;
    }
  }

  /**
   * Delete document from index
   */
  async deleteDocument(indexName, documentId) {
    try {
      const response = await this.client.delete({
        index: indexName,
        id: documentId,
        refresh: true
      });

      logger.info(`Document deleted: ${documentId} from ${indexName}`);
      return response;
    } catch (error) {
      logger.error('Failed to delete document:', error);
      throw error;
    }
  }

  /**
   * Queue document for indexing
   */
  async queueForIndexing(type, data, priority = 'normal') {
    const jobOptions = {
      priority: priority === 'high' ? 1 : priority === 'low' ? 10 : 5,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    };

    switch (type) {
      case 'calculator':
        return await this.indexingQueue.add('index-calculator',
          { calculatorData: data }, jobOptions);

      case 'content':
        return await this.indexingQueue.add('index-content',
          { contentData: data }, jobOptions);

      case 'faq':
        return await this.indexingQueue.add('index-faq',
          { faqData: data }, jobOptions);

      case 'file':
        return await this.indexingQueue.add('index-file',
          { fileData: data }, jobOptions);

      case 'bulk':
        return await this.indexingQueue.add('bulk-index',
          { documents: data.documents, indexName: data.indexName }, jobOptions);

      default:
        throw new Error(`Unknown indexing type: ${type}`);
    }
  }

  /**
   * Extract clean text content from HTML
   */
  extractTextContent(html) {
    if (!html) return '';

    const $ = cheerio.load(html);

    // Remove script and style elements
    $('script, style').remove();

    // Get text content
    return $.text()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Generate excerpt from content
   */
  generateExcerpt(content, maxLength = 200) {
    if (!content) return '';

    const cleanContent = content.replace(/\s+/g, ' ').trim();

    if (cleanContent.length <= maxLength) {
      return cleanContent;
    }

    return cleanContent.substring(0, maxLength).replace(/\s+\S*$/, '') + '...';
  }

  /**
   * Calculate reading time in minutes
   */
  calculateReadingTime(content) {
    if (!content) return 0;

    const wordsPerMinute = 200;
    const words = this.tokenizer.tokenize(content);

    return Math.ceil(words.length / wordsPerMinute);
  }

  /**
   * Detect content language
   */
  detectLanguage(text) {
    if (!text || text.length < 20) return 'en';

    try {
      const languages = this.languageDetector.detect(text, 1);
      return languages.length > 0 ? languages[0][0] : 'en';
    } catch (error) {
      return 'en';
    }
  }

  /**
   * Extract keywords from content
   */
  extractKeywords(text, maxKeywords = 10) {
    if (!text) return [];

    try {
      const tokens = this.tokenizer.tokenize(text.toLowerCase());
      const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);

      // Filter out stop words and short words
      const filteredTokens = tokens.filter(token =>
        token.length > 2 && !stopWords.has(token) && /^[a-zA-Z]+$/.test(token)
      );

      // Count frequency
      const frequency = {};
      filteredTokens.forEach(token => {
        const stemmed = this.stemmer.stem(token);
        frequency[stemmed] = (frequency[stemmed] || 0) + 1;
      });

      // Sort by frequency and return top keywords
      return Object.entries(frequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, maxKeywords)
        .map(([word]) => word);
    } catch (error) {
      logger.error('Keyword extraction failed:', error);
      return [];
    }
  }

  /**
   * Create searchable text combining all relevant fields
   */
  createSearchableText(data) {
    const fields = [];

    if (data.title) fields.push(data.title);
    if (data.description) fields.push(data.description);
    if (data.content) fields.push(data.content);
    if (data.excerpt) fields.push(data.excerpt);
    if (data.question) fields.push(data.question);
    if (data.answer) fields.push(data.answer);
    if (data.tags) fields.push(data.tags.join(' '));
    if (data.category) fields.push(data.category);

    return fields.join(' ');
  }

  /**
   * Analyze sentiment of content
   */
  analyzeSentiment(text) {
    try {
      const analyzer = new natural.SentimentAnalyzer('English',
        natural.PorterStemmer, 'afinn');

      const tokens = this.tokenizer.tokenize(text.toLowerCase());
      const score = analyzer.getSentiment(tokens);

      if (score > 0.1) return 'positive';
      if (score < -0.1) return 'negative';
      return 'neutral';
    } catch (error) {
      return 'neutral';
    }
  }

  /**
   * Classify question type
   */
  classifyQuestion(question) {
    const questionWords = {
      'what': 'definition',
      'how': 'procedure',
      'when': 'timing',
      'where': 'location',
      'why': 'explanation',
      'which': 'selection',
      'who': 'person'
    };

    const lowerQuestion = question.toLowerCase();

    for (const [word, type] of Object.entries(questionWords)) {
      if (lowerQuestion.startsWith(word)) {
        return type;
      }
    }

    return 'general';
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Get indexing queue statistics
   */
  async getQueueStats() {
    const stats = await this.indexingQueue.getJobCounts();
    return stats;
  }

  /**
   * Clean up old queue jobs
   */
  async cleanupQueue() {
    await this.indexingQueue.clean(24 * 60 * 60 * 1000, 'completed');
    await this.indexingQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed');
  }
}

module.exports = new IndexingService();