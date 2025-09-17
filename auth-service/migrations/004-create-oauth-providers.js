'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('oauth_providers', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      provider: {
        type: Sequelize.ENUM('google', 'apple', 'facebook', 'microsoft'),
        allowNull: false
      },
      provider_id: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      provider_email: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      provider_name: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      provider_avatar: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      access_token: {
        type: Sequelize.TEXT,
        allowNull: true // Encrypted
      },
      refresh_token: {
        type: Sequelize.TEXT,
        allowNull: true // Encrypted
      },
      token_expires_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      scope: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      raw_profile: {
        type: Sequelize.JSON,
        allowNull: true // Full provider profile data
      },
      is_primary: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      linked_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false
      },
      last_used_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // Create indexes
    await queryInterface.addIndex('oauth_providers', ['user_id']);
    await queryInterface.addIndex('oauth_providers', ['provider', 'provider_id'], {
      unique: true
    });
    await queryInterface.addIndex('oauth_providers', ['provider_email']);
    await queryInterface.addIndex('oauth_providers', ['is_primary']);

    // Ensure only one primary provider per user
    await queryInterface.addIndex('oauth_providers', ['user_id', 'is_primary'], {
      unique: true,
      where: {
        is_primary: true
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('oauth_providers');
  }
};