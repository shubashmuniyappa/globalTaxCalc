'use strict';

module.exports = (sequelize, DataTypes) => {
  const OAuthProvider = sequelize.define('OAuthProvider', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    provider: {
      type: DataTypes.ENUM('google', 'apple', 'facebook', 'microsoft'),
      allowNull: false
    },
    providerId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'provider_id'
    },
    providerEmail: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'provider_email'
    },
    providerName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'provider_name'
    },
    providerAvatar: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'provider_avatar'
    },
    accessToken: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'access_token'
    },
    refreshToken: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'refresh_token'
    },
    tokenExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'token_expires_at'
    },
    scope: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    rawProfile: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'raw_profile'
    },
    isPrimary: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      field: 'is_primary'
    },
    linkedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
      field: 'linked_at'
    },
    lastUsedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_used_at'
    }
  }, {
    tableName: 'oauth_providers',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['provider', 'provider_id']
      },
      {
        unique: true,
        fields: ['user_id', 'is_primary'],
        where: {
          is_primary: true
        }
      }
    ]
  });

  // Instance methods
  OAuthProvider.prototype.isTokenExpired = function() {
    return this.tokenExpiresAt && this.tokenExpiresAt < new Date();
  };

  OAuthProvider.prototype.updateLastUsed = async function() {
    this.lastUsedAt = new Date();
    await this.save();
  };

  OAuthProvider.prototype.setPrimary = async function() {
    // First, unset any existing primary provider for this user
    await OAuthProvider.update(
      { isPrimary: false },
      {
        where: {
          userId: this.userId,
          isPrimary: true
        }
      }
    );

    // Set this provider as primary
    this.isPrimary = true;
    await this.save();
  };

  OAuthProvider.prototype.updateTokens = async function(accessToken, refreshToken = null, expiresIn = null) {
    this.accessToken = accessToken;
    if (refreshToken) {
      this.refreshToken = refreshToken;
    }
    if (expiresIn) {
      this.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
    }
    await this.save();
  };

  OAuthProvider.prototype.updateProfile = async function(profile) {
    this.providerEmail = profile.email || this.providerEmail;
    this.providerName = profile.name || profile.displayName || this.providerName;
    this.providerAvatar = profile.avatar || profile.picture || this.providerAvatar;
    this.rawProfile = profile;
    await this.save();
  };

  // Static methods
  OAuthProvider.findByProvider = function(provider, providerId) {
    return this.findOne({
      where: {
        provider,
        providerId
      },
      include: [{
        model: sequelize.models.User,
        as: 'user'
      }]
    });
  };

  OAuthProvider.findUserProviders = function(userId) {
    return this.findAll({
      where: { userId },
      order: [['isPrimary', 'DESC'], ['linkedAt', 'ASC']]
    });
  };

  OAuthProvider.getPrimaryProvider = function(userId) {
    return this.findOne({
      where: {
        userId,
        isPrimary: true
      }
    });
  };

  OAuthProvider.linkProvider = async function(userId, providerData) {
    const existingProvider = await this.findByProvider(
      providerData.provider,
      providerData.providerId
    );

    if (existingProvider) {
      throw new Error('This social account is already linked to another user');
    }

    // Check if this is the user's first OAuth provider
    const userProviders = await this.findUserProviders(userId);
    const isPrimary = userProviders.length === 0;

    return this.create({
      userId,
      ...providerData,
      isPrimary
    });
  };

  OAuthProvider.unlinkProvider = async function(userId, provider) {
    const providerToUnlink = await this.findOne({
      where: {
        userId,
        provider
      }
    });

    if (!providerToUnlink) {
      throw new Error('Provider not found');
    }

    // Check if this is the user's only authentication method
    const user = await sequelize.models.User.findByPk(userId);
    if (!user.passwordHash) {
      const otherProviders = await this.findAll({
        where: {
          userId,
          provider: {
            [sequelize.Sequelize.Op.ne]: provider
          }
        }
      });

      if (otherProviders.length === 0) {
        throw new Error('Cannot unlink the only authentication method. Please set a password first.');
      }
    }

    // If unlinking the primary provider, set another one as primary
    if (providerToUnlink.isPrimary) {
      const otherProvider = await this.findOne({
        where: {
          userId,
          provider: {
            [sequelize.Sequelize.Op.ne]: provider
          }
        },
        order: [['linkedAt', 'ASC']]
      });

      if (otherProvider) {
        await otherProvider.setPrimary();
      }
    }

    await providerToUnlink.destroy();
    return true;
  };

  OAuthProvider.getProviderStats = async function() {
    const providers = await this.findAll({
      attributes: [
        'provider',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['provider']
    });

    return providers.reduce((stats, provider) => {
      stats[provider.provider] = parseInt(provider.dataValues.count);
      return stats;
    }, {});
  };

  // Associations
  OAuthProvider.associate = function(models) {
    OAuthProvider.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
  };

  return OAuthProvider;
};