/**
 * Setup Elasticsearch Indices with Proper Mappings and Settings
 */

const { elasticsearchConfig, INDEX_CONFIGS } = require('../config/elasticsearch');
const logger = require('../utils/logger');

class IndexManager {
  constructor() {
    this.client = null;
  }

  async initialize() {
    this.client = await elasticsearchConfig.initialize();
  }

  /**
   * Create all indices with their mappings and settings
   */
  async setupAllIndices() {
    try {
      logger.info('Starting index setup...');

      for (const [indexName, config] of Object.entries(INDEX_CONFIGS)) {
        await this.createIndex(indexName, config);
      }

      await this.setupIndexTemplates();
      await this.setupIndexAliases();

      logger.info('All indices setup completed successfully');
    } catch (error) {
      logger.error('Failed to setup indices:', error);
      throw error;
    }
  }

  /**
   * Create a single index
   */
  async createIndex(indexName, config) {
    try {
      const exists = await this.client.indices.exists({ index: indexName });

      if (exists) {
        logger.info(`Index ${indexName} already exists, skipping...`);
        return;
      }

      await this.client.indices.create({
        index: indexName,
        body: config
      });

      logger.info(`Index ${indexName} created successfully`);
    } catch (error) {
      logger.error(`Failed to create index ${indexName}:`, error);
      throw error;
    }
  }

  /**
   * Delete an index
   */
  async deleteIndex(indexName) {
    try {
      const exists = await this.client.indices.exists({ index: indexName });

      if (!exists) {
        logger.info(`Index ${indexName} does not exist, skipping deletion...`);
        return;
      }

      await this.client.indices.delete({ index: indexName });
      logger.info(`Index ${indexName} deleted successfully`);
    } catch (error) {
      logger.error(`Failed to delete index ${indexName}:`, error);
      throw error;
    }
  }

  /**
   * Recreate an index (delete and create)
   */
  async recreateIndex(indexName) {
    try {
      await this.deleteIndex(indexName);
      await this.createIndex(indexName, INDEX_CONFIGS[indexName]);
      logger.info(`Index ${indexName} recreated successfully`);
    } catch (error) {
      logger.error(`Failed to recreate index ${indexName}:`, error);
      throw error;
    }
  }

  /**
   * Setup index templates for automatic index creation
   */
  async setupIndexTemplates() {
    const templates = {
      // Template for time-based analytics indices
      'analytics-template': {
        index_patterns: ['search_analytics_*'],
        template: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            refresh_interval: '30s',
            'index.lifecycle.name': 'analytics-policy',
            'index.lifecycle.rollover_alias': 'search_analytics'
          },
          mappings: INDEX_CONFIGS.search_analytics.mappings
        }
      },

      // Template for content indices
      'content-template': {
        index_patterns: ['content_*'],
        template: {
          settings: {
            number_of_shards: 2,
            number_of_replicas: 1,
            refresh_interval: '1s'
          },
          mappings: INDEX_CONFIGS.content.mappings
        }
      }
    };

    for (const [templateName, template] of Object.entries(templates)) {
      try {
        await this.client.indices.putIndexTemplate({
          name: templateName,
          body: template
        });
        logger.info(`Index template ${templateName} created successfully`);
      } catch (error) {
        logger.error(`Failed to create index template ${templateName}:`, error);
      }
    }
  }

  /**
   * Setup index aliases for easier management
   */
  async setupIndexAliases() {
    const aliases = [
      {
        actions: [
          { add: { index: 'tax_calculators', alias: 'calculators' } },
          { add: { index: 'tax_calculators', alias: 'search_all' } }
        ]
      },
      {
        actions: [
          { add: { index: 'content', alias: 'articles' } },
          { add: { index: 'content', alias: 'search_all' } }
        ]
      },
      {
        actions: [
          { add: { index: 'faqs', alias: 'help' } },
          { add: { index: 'faqs', alias: 'search_all' } }
        ]
      },
      {
        actions: [
          { add: { index: 'search_analytics', alias: 'analytics_current' } }
        ]
      }
    ];

    for (const aliasConfig of aliases) {
      try {
        await this.client.indices.updateAliases({ body: aliasConfig });
        logger.info('Index aliases updated successfully');
      } catch (error) {
        logger.error('Failed to update index aliases:', error);
      }
    }
  }

  /**
   * Setup Index Lifecycle Management policies
   */
  async setupILMPolicies() {
    const policies = {
      'analytics-policy': {
        policy: {
          phases: {
            hot: {
              actions: {
                rollover: {
                  max_size: '5GB',
                  max_age: '7d'
                },
                set_priority: {
                  priority: 100
                }
              }
            },
            warm: {
              min_age: '7d',
              actions: {
                set_priority: {
                  priority: 50
                },
                allocate: {
                  number_of_replicas: 0
                }
              }
            },
            cold: {
              min_age: '30d',
              actions: {
                set_priority: {
                  priority: 0
                },
                allocate: {
                  number_of_replicas: 0
                }
              }
            },
            delete: {
              min_age: '90d',
              actions: {
                delete: {}
              }
            }
          }
        }
      }
    };

    for (const [policyName, policy] of Object.entries(policies)) {
      try {
        await this.client.ilm.putLifecycle({
          policy: policyName,
          body: policy
        });
        logger.info(`ILM policy ${policyName} created successfully`);
      } catch (error) {
        logger.error(`Failed to create ILM policy ${policyName}:`, error);
      }
    }
  }

  /**
   * Get index statistics
   */
  async getIndexStats() {
    try {
      const stats = await this.client.indices.stats({
        index: Object.keys(INDEX_CONFIGS).join(',')
      });
      return stats;
    } catch (error) {
      logger.error('Failed to get index stats:', error);
      throw error;
    }
  }

  /**
   * Optimize indices
   */
  async optimizeIndices() {
    try {
      logger.info('Starting index optimization...');

      for (const indexName of Object.keys(INDEX_CONFIGS)) {
        try {
          await this.client.indices.forcemerge({
            index: indexName,
            max_num_segments: 1,
            wait_for_completion: false
          });
          logger.info(`Index ${indexName} optimization started`);
        } catch (error) {
          logger.error(`Failed to optimize index ${indexName}:`, error);
        }
      }

      logger.info('Index optimization completed');
    } catch (error) {
      logger.error('Index optimization failed:', error);
      throw error;
    }
  }

  /**
   * Backup indices
   */
  async backupIndices() {
    try {
      const repositoryName = 'backup-repository';
      const snapshotName = `backup-${Date.now()}`;

      // Create repository if it doesn't exist
      try {
        await this.client.snapshot.createRepository({
          repository: repositoryName,
          body: {
            type: 'fs',
            settings: {
              location: '/usr/share/elasticsearch/backups'
            }
          }
        });
      } catch (error) {
        // Repository might already exist
      }

      // Create snapshot
      await this.client.snapshot.create({
        repository: repositoryName,
        snapshot: snapshotName,
        body: {
          indices: Object.keys(INDEX_CONFIGS).join(','),
          ignore_unavailable: true,
          include_global_state: false
        }
      });

      logger.info(`Backup snapshot ${snapshotName} created successfully`);
      return snapshotName;
    } catch (error) {
      logger.error('Backup failed:', error);
      throw error;
    }
  }

  /**
   * Health check for all indices
   */
  async healthCheck() {
    try {
      const health = await this.client.cluster.health({
        index: Object.keys(INDEX_CONFIGS).join(','),
        level: 'indices'
      });

      const indexHealth = {};
      for (const [indexName, indexInfo] of Object.entries(health.indices || {})) {
        indexHealth[indexName] = {
          status: indexInfo.status,
          shards: indexInfo.number_of_shards,
          replicas: indexInfo.number_of_replicas,
          documents: indexInfo.number_of_docs || 0
        };
      }

      return {
        cluster_status: health.status,
        indices: indexHealth
      };
    } catch (error) {
      logger.error('Health check failed:', error);
      throw error;
    }
  }
}

// CLI execution
if (require.main === module) {
  const action = process.argv[2] || 'setup';
  const indexName = process.argv[3];

  const manager = new IndexManager();

  (async () => {
    try {
      await manager.initialize();

      switch (action) {
        case 'setup':
          await manager.setupAllIndices();
          await manager.setupILMPolicies();
          break;

        case 'create':
          if (!indexName) {
            console.error('Index name required for create action');
            process.exit(1);
          }
          await manager.createIndex(indexName, INDEX_CONFIGS[indexName]);
          break;

        case 'delete':
          if (!indexName) {
            console.error('Index name required for delete action');
            process.exit(1);
          }
          await manager.deleteIndex(indexName);
          break;

        case 'recreate':
          if (!indexName) {
            console.error('Index name required for recreate action');
            process.exit(1);
          }
          await manager.recreateIndex(indexName);
          break;

        case 'stats':
          const stats = await manager.getIndexStats();
          console.log(JSON.stringify(stats, null, 2));
          break;

        case 'health':
          const health = await manager.healthCheck();
          console.log(JSON.stringify(health, null, 2));
          break;

        case 'optimize':
          await manager.optimizeIndices();
          break;

        case 'backup':
          const snapshot = await manager.backupIndices();
          console.log(`Backup created: ${snapshot}`);
          break;

        default:
          console.error('Unknown action. Available actions: setup, create, delete, recreate, stats, health, optimize, backup');
          process.exit(1);
      }

      await elasticsearchConfig.close();
      process.exit(0);
    } catch (error) {
      console.error('Script failed:', error);
      process.exit(1);
    }
  })();
}

module.exports = IndexManager;