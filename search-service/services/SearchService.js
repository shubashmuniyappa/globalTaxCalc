/**
 * Advanced Search Service
 * Implements full-text search, faceted search, autocomplete, and personalization
 */

const { elasticsearchConfig } = require('../config/elasticsearch');
const logger = require('../utils/logger');
const Redis = require('ioredis');
const natural = require('natural');
const geoip = require('geoip-lite');

class SearchService {
  constructor() {
    this.client = null;
    this.redis = new Redis(process.env.REDIS_URL);
    this.stemmer = natural.PorterStemmer;
    this.tokenizer = new natural.WordTokenizer();

    // Cache settings
    this.cacheTimeout = parseInt(process.env.CACHE_TTL) || 3600;
    this.maxSearchResults = parseInt(process.env.MAX_SEARCH_SIZE) || 100;
    this.defaultSearchSize = parseInt(process.env.DEFAULT_SEARCH_SIZE) || 20;
  }

  async initialize() {
    this.client = elasticsearchConfig.getClient();
  }

  /**
   * Main search function with comprehensive features
   */
  async search(params) {
    const {
      query,
      filters = {},
      sort = 'relevance',
      page = 1,
      size = this.defaultSearchSize,
      highlight = true,
      facets = true,
      fuzzy = true,
      user = null,
      context = {}
    } = params;

    try {
      // Build search query
      const searchQuery = this.buildSearchQuery({
        query,
        filters,
        sort,
        fuzzy,
        user,
        context
      });

      // Add pagination
      const from = (page - 1) * Math.min(size, this.maxSearchResults);
      searchQuery.from = from;
      searchQuery.size = Math.min(size, this.maxSearchResults);

      // Add highlighting
      if (highlight) {
        searchQuery.highlight = this.buildHighlightConfig();
      }

      // Add aggregations for facets
      if (facets) {
        searchQuery.aggs = this.buildFacetAggregations(filters);
      }

      // Execute search
      const startTime = Date.now();
      const response = await this.client.search({
        index: 'search_all',
        body: searchQuery
      });

      const searchTime = Date.now() - startTime;

      // Process results
      const results = this.processSearchResults(response, {
        query,
        highlight,
        facets,
        searchTime,
        user
      });

      // Track search analytics
      await this.trackSearchAnalytics({
        query,
        filters,
        results: results.hits,
        totalHits: results.total,
        searchTime,
        user,
        context
      });

      return results;

    } catch (error) {
      logger.error('Search failed:', error);
      throw error;
    }
  }

  /**
   * Build comprehensive search query
   */
  buildSearchQuery({ query, filters, sort, fuzzy, user, context }) {
    const searchQuery = {
      query: {
        bool: {
          must: [],
          should: [],
          filter: [],
          must_not: []
        }
      }
    };

    // Main query
    if (query && query.trim()) {
      const mainQuery = this.buildMainQuery(query, fuzzy);
      searchQuery.query.bool.must.push(mainQuery);

      // Add boosting for personalization
      if (user) {
        const personalizedBoosts = this.buildPersonalizedBoosts(user, context);
        searchQuery.query.bool.should.push(...personalizedBoosts);
      }
    } else {
      // Match all for empty queries
      searchQuery.query.bool.must.push({ match_all: {} });
    }

    // Apply filters
    const filterQueries = this.buildFilterQueries(filters);
    searchQuery.query.bool.filter.push(...filterQueries);

    // Add sorting
    searchQuery.sort = this.buildSortConfig(sort, query);

    // Add function score for popularity and recency
    if (query && query.trim()) {
      searchQuery.query = {
        function_score: {
          query: searchQuery.query,
          functions: [
            {
              filter: { exists: { field: 'popularity_score' } },
              field_value_factor: {
                field: 'popularity_score',
                factor: 1.2,
                modifier: 'log1p',
                missing: 0
              }
            },
            {
              filter: { exists: { field: 'updated_at' } },
              exp: {
                updated_at: {
                  origin: 'now',
                  scale: '30d',
                  decay: 0.5
                }
              }
            }
          ],
          score_mode: 'multiply',
          boost_mode: 'multiply'
        }
      };
    }

    return searchQuery;
  }

  /**
   * Build main query with fuzzy matching and synonyms
   */
  buildMainQuery(query, fuzzy = true) {
    const cleanQuery = this.cleanQuery(query);

    return {
      bool: {
        should: [
          // Exact phrase match (highest priority)
          {
            multi_match: {
              query: cleanQuery,
              type: 'phrase',
              fields: [
                'title^3',
                'question^3',
                'content^1'
              ],
              boost: 10
            }
          },
          // Best fields match
          {
            multi_match: {
              query: cleanQuery,
              type: 'best_fields',
              fields: [
                'title^2',
                'title.autocomplete^1.5',
                'question^2',
                'question.autocomplete^1.5',
                'description^1.5',
                'content^1',
                'excerpt^1.2',
                'answer^1',
                'tags^1.8',
                'category^1.5'
              ],
              fuzziness: fuzzy ? 'AUTO' : '0',
              prefix_length: 2,
              boost: 5
            }
          },
          // Cross fields match
          {
            multi_match: {
              query: cleanQuery,
              type: 'cross_fields',
              fields: [
                'title',
                'description',
                'content',
                'tags'
              ],
              operator: 'and',
              boost: 2
            }
          },
          // Wildcard match for partial terms
          {
            query_string: {
              query: `*${cleanQuery}*`,
              fields: [
                'title^2',
                'content^1'
              ],
              boost: 1
            }
          }
        ],
        minimum_should_match: 1
      }
    };
  }

  /**
   * Build filter queries from parameters
   */
  buildFilterQueries(filters) {
    const filterQueries = [];

    // Content type filter
    if (filters.content_type) {
      filterQueries.push({
        terms: { content_type: Array.isArray(filters.content_type) ? filters.content_type : [filters.content_type] }
      });
    }

    // Category filter
    if (filters.category) {
      filterQueries.push({
        terms: { category: Array.isArray(filters.category) ? filters.category : [filters.category] }
      });
    }

    // Country filter
    if (filters.country) {
      filterQueries.push({
        terms: { country: Array.isArray(filters.country) ? filters.country : [filters.country] }
      });
    }

    // Language filter
    if (filters.language) {
      filterQueries.push({
        terms: { language: Array.isArray(filters.language) ? filters.language : [filters.language] }
      });
    }

    // Tags filter
    if (filters.tags) {
      const tags = Array.isArray(filters.tags) ? filters.tags : [filters.tags];
      filterQueries.push({
        terms: { tags: tags }
      });
    }

    // Difficulty filter
    if (filters.difficulty) {
      filterQueries.push({
        terms: { difficulty: Array.isArray(filters.difficulty) ? filters.difficulty : [filters.difficulty] }
      });
    }

    // Date range filters
    if (filters.date_from || filters.date_to) {
      const dateRange = {};
      if (filters.date_from) dateRange.gte = filters.date_from;
      if (filters.date_to) dateRange.lte = filters.date_to;

      filterQueries.push({
        range: { updated_at: dateRange }
      });
    }

    // Status filter (default to active)
    if (!filters.include_inactive) {
      filterQueries.push({
        term: { status: 'active' }
      });
    }

    return filterQueries;
  }

  /**
   * Build personalized boost queries
   */
  buildPersonalizedBoosts(user, context) {
    const boosts = [];

    // User's preferred language
    if (user.language) {
      boosts.push({
        term: {
          language: {
            value: user.language,
            boost: 1.5
          }
        }
      });
    }

    // User's country/region
    if (user.country) {
      boosts.push({
        term: {
          country: {
            value: user.country,
            boost: 2.0
          }
        }
      });
    }

    // User's interests/tags
    if (user.interests && user.interests.length > 0) {
      boosts.push({
        terms: {
          tags: {
            value: user.interests,
            boost: 1.3
          }
        }
      });
    }

    // Recently viewed content types
    if (context.recent_content_types) {
      boosts.push({
        terms: {
          content_type: {
            value: context.recent_content_types,
            boost: 1.2
          }
        }
      });
    }

    return boosts;
  }

  /**
   * Build sort configuration
   */
  buildSortConfig(sort, query) {
    const sortConfigs = {
      relevance: query ? ['_score'] : [{ updated_at: { order: 'desc' } }],
      newest: [{ updated_at: { order: 'desc' } }, '_score'],
      oldest: [{ updated_at: { order: 'asc' } }, '_score'],
      popular: [
        { popularity_score: { order: 'desc', missing: 0 } },
        { usage_count: { order: 'desc', missing: 0 } },
        '_score'
      ],
      title: [{ 'title.keyword': { order: 'asc' } }, '_score'],
      helpful: [
        { helpful_count: { order: 'desc', missing: 0 } },
        '_score'
      ]
    };

    return sortConfigs[sort] || sortConfigs.relevance;
  }

  /**
   * Build highlight configuration
   */
  buildHighlightConfig() {
    return {
      pre_tags: ['<mark>'],
      post_tags: ['</mark>'],
      fields: {
        title: {
          fragment_size: 100,
          number_of_fragments: 1
        },
        description: {
          fragment_size: 150,
          number_of_fragments: 2
        },
        content: {
          fragment_size: 200,
          number_of_fragments: 3
        },
        question: {
          fragment_size: 100,
          number_of_fragments: 1
        },
        answer: {
          fragment_size: 200,
          number_of_fragments: 2
        }
      }
    };
  }

  /**
   * Build facet aggregations
   */
  buildFacetAggregations(currentFilters) {
    return {
      content_types: {
        terms: {
          field: 'content_type',
          size: 20
        }
      },
      categories: {
        terms: {
          field: 'category',
          size: 50
        }
      },
      countries: {
        terms: {
          field: 'country',
          size: 30
        }
      },
      languages: {
        terms: {
          field: 'language',
          size: 20
        }
      },
      tags: {
        terms: {
          field: 'tags',
          size: 100
        }
      },
      difficulty: {
        terms: {
          field: 'difficulty',
          size: 10
        }
      },
      date_histogram: {
        date_histogram: {
          field: 'updated_at',
          calendar_interval: 'month',
          format: 'yyyy-MM'
        }
      }
    };
  }

  /**
   * Process search results
   */
  processSearchResults(response, options) {
    const { query, highlight, facets, searchTime, user } = options;

    const results = {
      hits: response.hits.hits.map(hit => this.processSearchHit(hit, highlight)),
      total: response.hits.total.value,
      max_score: response.hits.max_score,
      search_time: searchTime,
      query: query
    };

    // Add facets if requested
    if (facets && response.aggregations) {
      results.facets = this.processFacets(response.aggregations);
    }

    // Add suggestions if no results
    if (results.total === 0 && query) {
      results.suggestions = this.generateSuggestions(query);
    }

    return results;
  }

  /**
   * Process individual search hit
   */
  processSearchHit(hit, includeHighlight = true) {
    const result = {
      id: hit._id,
      score: hit._score,
      index: hit._index,
      source: hit._source
    };

    // Add highlights
    if (includeHighlight && hit.highlight) {
      result.highlight = hit.highlight;
    }

    // Add computed fields
    result.url = this.generateResultURL(result);
    result.snippet = this.generateSnippet(result, hit.highlight);

    return result;
  }

  /**
   * Process facet aggregations
   */
  processFacets(aggregations) {
    const facets = {};

    Object.keys(aggregations).forEach(facetName => {
      const agg = aggregations[facetName];

      if (agg.buckets) {
        facets[facetName] = agg.buckets.map(bucket => ({
          value: bucket.key,
          count: bucket.doc_count,
          label: this.getFacetLabel(facetName, bucket.key)
        }));
      }
    });

    return facets;
  }

  /**
   * Autocomplete search
   */
  async autocomplete(query, options = {}) {
    const {
      size = 10,
      type = 'all',
      user = null
    } = options;

    try {
      const cacheKey = `autocomplete:${query}:${type}:${size}`;
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      const searchQuery = {
        size,
        query: {
          bool: {
            should: [
              {
                match: {
                  'title.autocomplete': {
                    query: query,
                    boost: 3
                  }
                }
              },
              {
                match: {
                  'question.autocomplete': {
                    query: query,
                    boost: 3
                  }
                }
              },
              {
                prefix: {
                  'title.keyword': {
                    value: query,
                    boost: 2
                  }
                }
              },
              {
                wildcard: {
                  'tags': {
                    value: `*${query}*`,
                    boost: 1.5
                  }
                }
              }
            ]
          }
        },
        _source: ['title', 'question', 'content_type', 'category', 'url']
      };

      // Add type filter if specified
      if (type !== 'all') {
        searchQuery.query.bool.filter = [
          { term: { content_type: type } }
        ];
      }

      const response = await this.client.search({
        index: 'search_all',
        body: searchQuery
      });

      const suggestions = response.hits.hits.map(hit => ({
        text: hit._source.title || hit._source.question,
        type: hit._source.content_type,
        category: hit._source.category,
        url: this.generateResultURL(hit._source)
      }));

      // Cache results
      await this.redis.setex(cacheKey, 300, JSON.stringify(suggestions));

      return suggestions;

    } catch (error) {
      logger.error('Autocomplete search failed:', error);
      throw error;
    }
  }

  /**
   * Search suggestions for no results
   */
  async searchSuggestions(query, options = {}) {
    const { size = 5 } = options;

    try {
      const response = await this.client.search({
        index: 'search_all',
        body: {
          size: 0,
          suggest: {
            text_suggest: {
              text: query,
              term: {
                field: 'title',
                size: size,
                suggest_mode: 'popular'
              }
            },
            phrase_suggest: {
              text: query,
              phrase: {
                field: 'title',
                size: size,
                direct_generator: [{
                  field: 'title',
                  suggest_mode: 'popular'
                }]
              }
            }
          }
        }
      });

      const suggestions = new Set();

      // Process term suggestions
      if (response.suggest.text_suggest) {
        response.suggest.text_suggest.forEach(suggest => {
          suggest.options.forEach(option => {
            suggestions.add(option.text);
          });
        });
      }

      // Process phrase suggestions
      if (response.suggest.phrase_suggest) {
        response.suggest.phrase_suggest.forEach(suggest => {
          suggest.options.forEach(option => {
            suggestions.add(option.text);
          });
        });
      }

      return Array.from(suggestions).slice(0, size);

    } catch (error) {
      logger.error('Search suggestions failed:', error);
      return [];
    }
  }

  /**
   * Similar documents search
   */
  async findSimilar(documentId, indexName = 'search_all', options = {}) {
    const { size = 5, minTermFreq = 2, maxQueryTerms = 25 } = options;

    try {
      const response = await this.client.search({
        index: indexName,
        body: {
          size,
          query: {
            more_like_this: {
              fields: ['title', 'content', 'description', 'tags'],
              like: [
                {
                  _index: indexName,
                  _id: documentId
                }
              ],
              min_term_freq: minTermFreq,
              max_query_terms: maxQueryTerms,
              min_doc_freq: 1
            }
          }
        }
      });

      return response.hits.hits.map(hit => this.processSearchHit(hit, false));

    } catch (error) {
      logger.error('Similar documents search failed:', error);
      throw error;
    }
  }

  /**
   * Advanced search with complex queries
   */
  async advancedSearch(params) {
    const {
      must = [],
      should = [],
      must_not = [],
      filters = {},
      sort = 'relevance',
      page = 1,
      size = 20
    } = params;

    try {
      const searchQuery = {
        from: (page - 1) * size,
        size,
        query: {
          bool: {
            must: must,
            should: should,
            must_not: must_not,
            filter: this.buildFilterQueries(filters)
          }
        },
        sort: this.buildSortConfig(sort)
      };

      const response = await this.client.search({
        index: 'search_all',
        body: searchQuery
      });

      return this.processSearchResults(response, {
        query: 'advanced',
        highlight: true,
        facets: true,
        searchTime: 0
      });

    } catch (error) {
      logger.error('Advanced search failed:', error);
      throw error;
    }
  }

  /**
   * Geographic search based on user location
   */
  async geoSearch(ip, query, options = {}) {
    const geo = geoip.lookup(ip);
    const country = geo ? geo.country.toLowerCase() : null;

    if (!country) {
      return await this.search({ query, ...options });
    }

    // Boost results for user's country
    const geoOptions = {
      ...options,
      filters: {
        ...options.filters
      },
      context: {
        ...options.context,
        user_country: country
      }
    };

    return await this.search({ query, ...geoOptions });
  }

  /**
   * Track search analytics
   */
  async trackSearchAnalytics(data) {
    try {
      const analyticsData = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        query: data.query,
        normalized_query: this.normalizeQuery(data.query),
        user_id: data.user?.id,
        session_id: data.context?.session_id,
        ip_address: data.context?.ip,
        user_agent: data.context?.user_agent,
        timestamp: new Date().toISOString(),
        response_time: data.searchTime,
        total_hits: data.totalHits,
        filters_used: data.filters,
        page: data.context?.page || 1,
        size: data.context?.size || this.defaultSearchSize,
        language: data.user?.language || 'en',
        country: data.user?.country,
        device_type: this.detectDeviceType(data.context?.user_agent),
        conversion: false,
        abandoned: false
      };

      await this.client.index({
        index: 'search_analytics',
        body: analyticsData
      });

    } catch (error) {
      logger.error('Failed to track search analytics:', error);
    }
  }

  /**
   * Helper functions
   */
  cleanQuery(query) {
    return query
      .replace(/[^\w\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  normalizeQuery(query) {
    return this.cleanQuery(query.toLowerCase());
  }

  generateResultURL(source) {
    const baseURL = process.env.FRONTEND_URL || 'https://globaltaxcalc.com';

    switch (source.content_type) {
      case 'calculator':
        return `${baseURL}/calculators/${source.country}/${source.id}`;
      case 'article':
      case 'guide':
        return `${baseURL}/blog/${source.slug || source.id}`;
      case 'faq':
        return `${baseURL}/help/faq#${source.id}`;
      default:
        return `${baseURL}/search?id=${source.id}`;
    }
  }

  generateSnippet(result, highlight) {
    if (highlight) {
      // Use highlighted content if available
      const highlightFields = ['content', 'description', 'answer', 'excerpt'];
      for (const field of highlightFields) {
        if (highlight[field] && highlight[field].length > 0) {
          return highlight[field][0];
        }
      }
    }

    // Fallback to source content
    const source = result.source;
    const content = source.excerpt || source.description || source.content || source.answer;

    if (content && content.length > 200) {
      return content.substring(0, 200) + '...';
    }

    return content || '';
  }

  getFacetLabel(facetName, value) {
    const labels = {
      content_type: {
        'calculator': 'Tax Calculators',
        'article': 'Articles',
        'guide': 'Guides',
        'faq': 'FAQs'
      },
      difficulty: {
        'beginner': 'Beginner',
        'intermediate': 'Intermediate',
        'advanced': 'Advanced'
      }
    };

    return labels[facetName]?.[value] || value;
  }

  generateSuggestions(query) {
    // This would typically call searchSuggestions
    return [];
  }

  detectDeviceType(userAgent) {
    if (!userAgent) return 'unknown';

    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
      return 'mobile';
    }
    if (/Tablet/.test(userAgent)) {
      return 'tablet';
    }
    return 'desktop';
  }
}

module.exports = new SearchService();