'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true
        }
      },
      email_verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      email_verification_token: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      email_verification_expires: {
        type: Sequelize.DATE,
        allowNull: true
      },
      password_hash: {
        type: Sequelize.STRING(255),
        allowNull: true // Can be null for OAuth-only users
      },
      first_name: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      last_name: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      avatar_url: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      phone_number: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      phone_verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      date_of_birth: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      timezone: {
        type: Sequelize.STRING(50),
        defaultValue: 'UTC',
        allowNull: false
      },
      locale: {
        type: Sequelize.STRING(10),
        defaultValue: 'en-US',
        allowNull: false
      },
      provider: {
        type: Sequelize.ENUM('email', 'google', 'apple'),
        defaultValue: 'email',
        allowNull: false
      },
      provider_id: {
        type: Sequelize.STRING(255),
        allowNull: true // External provider ID
      },
      role: {
        type: Sequelize.ENUM('guest', 'user', 'premium', 'admin'),
        defaultValue: 'user',
        allowNull: false
      },
      subscription_status: {
        type: Sequelize.ENUM('none', 'trial', 'active', 'cancelled', 'expired'),
        defaultValue: 'none',
        allowNull: false
      },
      subscription_plan: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      subscription_expires_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      trial_ends_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      password_reset_token: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      password_reset_expires: {
        type: Sequelize.DATE,
        allowNull: true
      },
      failed_login_attempts: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
      },
      account_locked_until: {
        type: Sequelize.DATE,
        allowNull: true
      },
      two_factor_enabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      two_factor_secret: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      backup_codes: {
        type: Sequelize.JSON,
        allowNull: true
      },
      preferences: {
        type: Sequelize.JSON,
        defaultValue: {},
        allowNull: false
      },
      last_login_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      last_login_ip: {
        type: Sequelize.INET,
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      deactivated_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      gdpr_consent: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      gdpr_consent_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      marketing_consent: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      data_export_requested_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      deletion_requested_at: {
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

    // Create indexes for performance
    await queryInterface.addIndex('users', ['email']);
    await queryInterface.addIndex('users', ['provider', 'provider_id']);
    await queryInterface.addIndex('users', ['subscription_status']);
    await queryInterface.addIndex('users', ['role']);
    await queryInterface.addIndex('users', ['is_active']);
    await queryInterface.addIndex('users', ['email_verification_token']);
    await queryInterface.addIndex('users', ['password_reset_token']);
    await queryInterface.addIndex('users', ['created_at']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('users');
  }
};