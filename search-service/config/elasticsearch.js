/**
 * Elasticsearch Configuration and Client Setup
 * Configures cluster connection, index settings, and client options
 */

const { Client } = require('@elastic/elasticsearch');
const logger = require('../utils/logger');

class ElasticsearchConfig {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000;
  }

  /**
   * Initialize Elasticsearch client
   */
  async initialize() {
    try {
      const config = {
        node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
        maxRetries: 5,
        requestTimeout: 60000,
        sniffOnStart: true,
        sniffInterval: 300000,
        sniffOnConnectionFault: true,
        resurrectStrategy: 'ping',
        log: process.env.NODE_ENV === 'development' ? 'info' : 'error'
      };

      // Add authentication if provided
      if (process.env.ELASTICSEARCH_USERNAME && process.env.ELASTICSEARCH_PASSWORD) {
        config.auth = {
          username: process.env.ELASTICSEARCH_USERNAME,
          password: process.env.ELASTICSEARCH_PASSWORD
        };
      }

      // Add API key if provided
      if (process.env.ELASTICSEARCH_API_KEY) {
        config.auth = {
          apiKey: process.env.ELASTICSEARCH_API_KEY
        };
      }

      // SSL configuration
      if (process.env.ELASTICSEARCH_SSL === 'true') {
        config.tls = {
          rejectUnauthorized: false
        };
      }

      this.client = new Client(config);

      // Test connection
      await this.testConnection();

      logger.info('Elasticsearch client initialized successfully');
      return this.client;
    } catch (error) {
      logger.error('Failed to initialize Elasticsearch client:', error);
      throw error;
    }
  }

  /**
   * Test Elasticsearch connection
   */
  async testConnection() {
    try {
      const response = await this.client.ping();
      this.isConnected = true;
      this.connectionRetries = 0;
      logger.info('Elasticsearch connection established');
      return response;
    } catch (error) {
      this.isConnected = false;
      this.connectionRetries++;
      logger.error(`Elasticsearch connection failed (attempt ${this.connectionRetries}):`, error);

      if (this.connectionRetries < this.maxRetries) {
        logger.info(`Retrying connection in ${this.retryDelay}ms...`);
        setTimeout(() => this.testConnection(), this.retryDelay);
      } else {
        throw new Error('Max connection retries exceeded');
      }
    }
  }

  /**
   * Get Elasticsearch client
   */
  getClient() {
    if (!this.client) {
      throw new Error('Elasticsearch client not initialized');
    }
    return this.client;
  }

  /**
   * Check if client is connected
   */
  isClientConnected() {
    return this.isConnected;
  }

  /**
   * Get cluster health
   */
  async getClusterHealth() {
    try {
      const health = await this.client.cluster.health();
      return health;
    } catch (error) {
      logger.error('Failed to get cluster health:', error);
      throw error;
    }
  }

  /**
   * Get cluster stats
   */
  async getClusterStats() {
    try {
      const stats = await this.client.cluster.stats();
      return stats;
    } catch (error) {
      logger.error('Failed to get cluster stats:', error);
      throw error;
    }
  }

  /**
   * Get node info
   */
  async getNodeInfo() {
    try {
      const nodes = await this.client.nodes.info();
      return nodes;
    } catch (error) {
      logger.error('Failed to get node info:', error);
      throw error;
    }
  }

  /**
   * Close connection
   */
  async close() {
    try {
      if (this.client) {
        await this.client.close();
        this.isConnected = false;
        logger.info('Elasticsearch connection closed');
      }
    } catch (error) {
      logger.error('Error closing Elasticsearch connection:', error);
    }
  }
}

// Index configuration templates
const INDEX_CONFIGS = {
  // Tax calculators index
  tax_calculators: {
    settings: {
      number_of_shards: 2,
      number_of_replicas: 1,
      refresh_interval: '1s',
      analysis: {
        analyzer: {
          tax_analyzer: {
            type: 'custom',
            tokenizer: 'standard',
            filter: [
              'lowercase',
              'stop',
              'tax_synonym',
              'tax_stemmer'
            ]
          },
          autocomplete_analyzer: {
            type: 'custom',
            tokenizer: 'keyword',
            filter: [
              'lowercase',
              'autocomplete_filter'
            ]
          },
          search_analyzer: {
            type: 'custom',
            tokenizer: 'standard',
            filter: [
              'lowercase',
              'stop'
            ]
          }
        },
        filter: {
          tax_synonym: {
            type: 'synonym',
            synonyms: [
              'tax,taxation,levy',
              'income,salary,wages,earnings',
              'deduction,exemption,allowance',
              'rate,percentage,percent',
              'calculator,compute,calculate',
              'federal,national,country',
              'state,provincial,regional'
            ]
          },
          tax_stemmer: {
            type: 'stemmer',
            language: 'english'
          },
          autocomplete_filter: {
            type: 'edge_ngram',
            min_gram: 1,
            max_gram: 20
          }
        }
      }
    },
    mappings: {
      properties: {
        id: { type: 'keyword' },
        title: {
          type: 'text',
          analyzer: 'tax_analyzer',
          fields: {
            keyword: { type: 'keyword' },
            autocomplete: {
              type: 'text',
              analyzer: 'autocomplete_analyzer',
              search_analyzer: 'search_analyzer'
            }
          }
        },
        description: {
          type: 'text',
          analyzer: 'tax_analyzer'
        },
        content: {
          type: 'text',
          analyzer: 'tax_analyzer'
        },
        country: { type: 'keyword' },
        type: { type: 'keyword' },
        tags: { type: 'keyword' },
        difficulty: { type: 'keyword' },
        popularity_score: { type: 'float' },
        usage_count: { type: 'long' },
        created_at: { type: 'date' },
        updated_at: { type: 'date' },
        status: { type: 'keyword' },
        language: { type: 'keyword' },
        metadata: { type: 'object' }
      }
    }
  },

  // Blog posts and guides
  content: {
    settings: {
      number_of_shards: 3,
      number_of_replicas: 1,
      refresh_interval: '1s',
      analysis: {
        analyzer: {
          content_analyzer: {
            type: 'custom',
            tokenizer: 'standard',
            filter: [
              'lowercase',
              'stop',
              'content_synonym',
              'stemmer'
            ]
          },
          title_analyzer: {
            type: 'custom',
            tokenizer: 'standard',
            filter: [
              'lowercase',
              'title_boost'
            ]
          }
        },
        filter: {
          content_synonym: {
            type: 'synonym',
            synonyms: [
              'guide,tutorial,howto,help',
              'article,post,blog,content',
              'tip,advice,suggestion,recommendation',
              'example,sample,demo,illustration'
            ]
          },
          title_boost: {
            type: 'multiplexer',
            filters: ['lowercase']
          }
        }
      }
    },
    mappings: {
      properties: {
        id: { type: 'keyword' },
        title: {
          type: 'text',
          analyzer: 'title_analyzer',
          boost: 2.0,
          fields: {
            keyword: { type: 'keyword' },
            autocomplete: {
              type: 'text',
              analyzer: 'autocomplete_analyzer',
              search_analyzer: 'search_analyzer'
            }
          }
        },
        slug: { type: 'keyword' },
        excerpt: {
          type: 'text',
          analyzer: 'content_analyzer'
        },
        content: {
          type: 'text',
          analyzer: 'content_analyzer'
        },
        content_type: { type: 'keyword' },
        category: { type: 'keyword' },
        tags: { type: 'keyword' },
        author: {
          type: 'object',
          properties: {
            id: { type: 'keyword' },
            name: { type: 'text' },
            email: { type: 'keyword' }
          }
        },
        published_at: { type: 'date' },
        updated_at: { type: 'date' },
        status: { type: 'keyword' },
        language: { type: 'keyword' },
        reading_time: { type: 'integer' },
        view_count: { type: 'long' },
        share_count: { type: 'long' },
        like_count: { type: 'long' },
        seo: {
          type: 'object',
          properties: {
            meta_title: { type: 'text' },
            meta_description: { type: 'text' },
            keywords: { type: 'keyword' }
          }
        },
        featured_image: {
          type: 'object',
          properties: {
            url: { type: 'keyword' },
            alt: { type: 'text' }
          }
        }
      }
    }
  },

  // FAQs and help content
  faqs: {
    settings: {
      number_of_shards: 1,
      number_of_replicas: 1,
      refresh_interval: '1s',
      analysis: {
        analyzer: {
          faq_analyzer: {
            type: 'custom',
            tokenizer: 'standard',
            filter: [
              'lowercase',
              'stop',
              'faq_synonym',
              'stemmer'
            ]
          },
          question_analyzer: {
            type: 'custom',
            tokenizer: 'standard',
            filter: [
              'lowercase',
              'question_words'
            ]
          }
        },
        filter: {
          faq_synonym: {
            type: 'synonym',
            synonyms: [
              'faq,question,ask,help',
              'how,what,when,where,why,which',
              'problem,issue,trouble,difficulty',
              'solve,fix,resolve,answer'
            ]
          },
          question_words: {
            type: 'stop',
            stopwords: ['a', 'an', 'the', 'is', 'are', 'was', 'were']
          }
        }
      }
    },
    mappings: {
      properties: {
        id: { type: 'keyword' },
        question: {
          type: 'text',
          analyzer: 'question_analyzer',
          boost: 2.5,
          fields: {
            keyword: { type: 'keyword' },
            autocomplete: {
              type: 'text',
              analyzer: 'autocomplete_analyzer',
              search_analyzer: 'search_analyzer'
            }
          }
        },
        answer: {
          type: 'text',
          analyzer: 'faq_analyzer'
        },
        category: { type: 'keyword' },
        subcategory: { type: 'keyword' },
        tags: { type: 'keyword' },
        difficulty: { type: 'keyword' },
        helpful_count: { type: 'long' },
        not_helpful_count: { type: 'long' },
        view_count: { type: 'long' },
        created_at: { type: 'date' },
        updated_at: { type: 'date' },
        status: { type: 'keyword' },
        language: { type: 'keyword' },
        related_topics: { type: 'keyword' }
      }
    }
  },

  // Search analytics
  search_analytics: {
    settings: {
      number_of_shards: 2,
      number_of_replicas: 0,
      refresh_interval: '30s'
    },
    mappings: {
      properties: {
        id: { type: 'keyword' },
        query: {
          type: 'text',
          fields: {
            keyword: { type: 'keyword' }
          }
        },
        normalized_query: { type: 'keyword' },
        user_id: { type: 'keyword' },
        session_id: { type: 'keyword' },
        ip_address: { type: 'ip' },
        user_agent: { type: 'text' },
        timestamp: { type: 'date' },
        response_time: { type: 'float' },
        total_hits: { type: 'long' },
        clicked_results: {
          type: 'nested',
          properties: {
            document_id: { type: 'keyword' },
            position: { type: 'integer' },
            clicked_at: { type: 'date' }
          }
        },
        filters_used: { type: 'object' },
        page: { type: 'integer' },
        size: { type: 'integer' },
        sort_by: { type: 'keyword' },
        language: { type: 'keyword' },
        country: { type: 'keyword' },
        device_type: { type: 'keyword' },
        conversion: { type: 'boolean' },
        abandoned: { type: 'boolean' }
      }
    }
  }
};

// Create singleton instance
const elasticsearchConfig = new ElasticsearchConfig();

module.exports = {
  elasticsearchConfig,
  INDEX_CONFIGS
};