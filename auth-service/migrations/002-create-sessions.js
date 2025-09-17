'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sessions', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      session_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: true, // Can be null for guest sessions
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      session_type: {
        type: Sequelize.ENUM('guest', 'authenticated'),
        defaultValue: 'guest',
        allowNull: false
      },
      device_info: {
        type: Sequelize.JSON,
        allowNull: true // Browser, OS, device details
      },
      ip_address: {
        type: Sequelize.INET,
        allowNull: false
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      location_info: {
        type: Sequelize.JSON,
        allowNull: true // Country, city, timezone
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      refresh_token_hash: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      refresh_token_expires_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      csrf_token: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      last_activity_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false
      },
      login_method: {
        type: Sequelize.ENUM('password', 'google', 'apple', 'guest'),
        allowNull: true
      },
      session_data: {
        type: Sequelize.JSON,
        defaultValue: {},
        allowNull: false // Store temporary data like cart, preferences
      },
      revoked_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      revoked_reason: {
        type: Sequelize.STRING(100),
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

    // Create indexes for performance
    await queryInterface.addIndex('sessions', ['session_id']);
    await queryInterface.addIndex('sessions', ['user_id']);
    await queryInterface.addIndex('sessions', ['session_type']);
    await queryInterface.addIndex('sessions', ['expires_at']);
    await queryInterface.addIndex('sessions', ['is_active']);
    await queryInterface.addIndex('sessions', ['ip_address']);
    await queryInterface.addIndex('sessions', ['last_activity_at']);
    await queryInterface.addIndex('sessions', ['refresh_token_hash']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('sessions');
  }
};