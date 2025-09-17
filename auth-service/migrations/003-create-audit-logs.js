'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('audit_logs', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: true, // Can be null for guest actions
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      session_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'sessions',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      action: {
        type: Sequelize.STRING(100),
        allowNull: false // login, logout, register, password_reset, etc.
      },
      category: {
        type: Sequelize.ENUM('auth', 'user', 'security', 'admin', 'system'),
        allowNull: false
      },
      severity: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'critical'),
        defaultValue: 'low',
        allowNull: false
      },
      ip_address: {
        type: Sequelize.INET,
        allowNull: false
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      endpoint: {
        type: Sequelize.STRING(255),
        allowNull: true // API endpoint that was called
      },
      method: {
        type: Sequelize.STRING(10),
        allowNull: true // HTTP method
      },
      status_code: {
        type: Sequelize.INTEGER,
        allowNull: true // HTTP status code
      },
      details: {
        type: Sequelize.JSON,
        allowNull: true // Additional context data
      },
      old_values: {
        type: Sequelize.JSON,
        allowNull: true // For update operations
      },
      new_values: {
        type: Sequelize.JSON,
        allowNull: true // For update operations
      },
      request_id: {
        type: Sequelize.STRING(100),
        allowNull: true // Request tracking ID
      },
      geo_location: {
        type: Sequelize.JSON,
        allowNull: true // Country, city, lat/lon
      },
      risk_score: {
        type: Sequelize.INTEGER,
        allowNull: true // Security risk assessment score
      },
      flagged: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      flagged_reason: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      reviewed_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      reviewed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // Create indexes for performance and queries
    await queryInterface.addIndex('audit_logs', ['user_id']);
    await queryInterface.addIndex('audit_logs', ['session_id']);
    await queryInterface.addIndex('audit_logs', ['action']);
    await queryInterface.addIndex('audit_logs', ['category']);
    await queryInterface.addIndex('audit_logs', ['severity']);
    await queryInterface.addIndex('audit_logs', ['ip_address']);
    await queryInterface.addIndex('audit_logs', ['created_at']);
    await queryInterface.addIndex('audit_logs', ['flagged']);
    await queryInterface.addIndex('audit_logs', ['risk_score']);
    await queryInterface.addIndex('audit_logs', ['request_id']);

    // Composite indexes for common queries
    await queryInterface.addIndex('audit_logs', ['user_id', 'created_at']);
    await queryInterface.addIndex('audit_logs', ['action', 'created_at']);
    await queryInterface.addIndex('audit_logs', ['category', 'severity']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('audit_logs');
  }
};