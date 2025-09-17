'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_devices', {
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
      device_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      device_name: {
        type: Sequelize.STRING(255),
        allowNull: true // User-friendly name
      },
      device_type: {
        type: Sequelize.ENUM('desktop', 'mobile', 'tablet', 'tv', 'watch', 'other'),
        allowNull: false
      },
      platform: {
        type: Sequelize.STRING(50),
        allowNull: true // iOS, Android, Windows, macOS, Linux
      },
      browser: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      browser_version: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      os: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      os_version: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      device_fingerprint: {
        type: Sequelize.STRING(255),
        allowNull: true // Unique device fingerprint
      },
      push_token: {
        type: Sequelize.STRING(500),
        allowNull: true // For push notifications
      },
      is_trusted: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      last_login_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      last_ip_address: {
        type: Sequelize.INET,
        allowNull: true
      },
      location_info: {
        type: Sequelize.JSON,
        allowNull: true
      },
      notification_preferences: {
        type: Sequelize.JSON,
        defaultValue: {},
        allowNull: false
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
    await queryInterface.addIndex('user_devices', ['user_id']);
    await queryInterface.addIndex('user_devices', ['device_id']);
    await queryInterface.addIndex('user_devices', ['device_fingerprint']);
    await queryInterface.addIndex('user_devices', ['is_trusted']);
    await queryInterface.addIndex('user_devices', ['is_active']);
    await queryInterface.addIndex('user_devices', ['last_login_at']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('user_devices');
  }
};