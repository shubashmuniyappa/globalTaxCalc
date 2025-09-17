'use strict';

const crypto = require('crypto');

module.exports = (sequelize, DataTypes) => {
  const UserDevice = sequelize.define('UserDevice', {
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
    deviceId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      field: 'device_id'
    },
    deviceName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'device_name'
    },
    deviceType: {
      type: DataTypes.ENUM('desktop', 'mobile', 'tablet', 'tv', 'watch', 'other'),
      allowNull: false,
      field: 'device_type'
    },
    platform: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    browser: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    browserVersion: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'browser_version'
    },
    os: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    osVersion: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'os_version'
    },
    deviceFingerprint: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'device_fingerprint'
    },
    pushToken: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'push_token'
    },
    isTrusted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      field: 'is_trusted'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      field: 'is_active'
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_login_at'
    },
    lastIpAddress: {
      type: DataTypes.INET,
      allowNull: true,
      field: 'last_ip_address'
    },
    locationInfo: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'location_info'
    },
    notificationPreferences: {
      type: DataTypes.JSON,
      defaultValue: {},
      allowNull: false,
      field: 'notification_preferences'
    }
  }, {
    tableName: 'user_devices',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  // Instance methods
  UserDevice.prototype.updateLastLogin = async function(ipAddress, locationInfo = null) {
    this.lastLoginAt = new Date();
    this.lastIpAddress = ipAddress;
    if (locationInfo) {
      this.locationInfo = locationInfo;
    }
    await this.save();
  };

  UserDevice.prototype.setTrusted = async function(trusted = true) {
    this.isTrusted = trusted;
    await this.save();
  };

  UserDevice.prototype.updatePushToken = async function(token) {
    this.pushToken = token;
    await this.save();
  };

  UserDevice.prototype.updateNotificationPreferences = async function(preferences) {
    this.notificationPreferences = {
      ...this.notificationPreferences,
      ...preferences
    };
    await this.save();
  };

  UserDevice.prototype.deactivate = async function() {
    this.isActive = false;
    await this.save();
  };

  UserDevice.prototype.generateDeviceName = function() {
    let name = '';

    if (this.browser && this.os) {
      name = `${this.browser} on ${this.os}`;
    } else if (this.platform) {
      name = this.platform;
    } else {
      name = `${this.deviceType} device`;
    }

    // Add location if available
    if (this.locationInfo && this.locationInfo.city) {
      name += ` from ${this.locationInfo.city}`;
    }

    return name;
  };

  UserDevice.prototype.getSecurityInfo = function() {
    return {
      deviceId: this.deviceId,
      deviceName: this.deviceName || this.generateDeviceName(),
      deviceType: this.deviceType,
      platform: this.platform,
      browser: this.browser,
      os: this.os,
      isTrusted: this.isTrusted,
      lastLoginAt: this.lastLoginAt,
      lastIpAddress: this.lastIpAddress,
      locationInfo: this.locationInfo,
      createdAt: this.createdAt
    };
  };

  // Static methods
  UserDevice.generateDeviceId = function(userAgent, ipAddress) {
    const data = `${userAgent}:${ipAddress}:${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  };

  UserDevice.generateFingerprint = function(deviceInfo) {
    const fingerprintData = [
      deviceInfo.userAgent,
      deviceInfo.screen?.width,
      deviceInfo.screen?.height,
      deviceInfo.timezone,
      deviceInfo.language
    ].filter(Boolean).join('|');

    return crypto.createHash('md5').update(fingerprintData).digest('hex');
  };

  UserDevice.parseUserAgent = function(userAgent) {
    // Simple user agent parsing - in production, use a library like ua-parser-js
    const result = {
      browser: null,
      browserVersion: null,
      os: null,
      osVersion: null,
      deviceType: 'desktop',
      platform: null
    };

    if (!userAgent) return result;

    // Mobile detection
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
      result.deviceType = /iPad/.test(userAgent) ? 'tablet' : 'mobile';
    }

    // Browser detection
    if (/Chrome/.test(userAgent)) {
      result.browser = 'Chrome';
      const match = userAgent.match(/Chrome\/(\d+)/);
      if (match) result.browserVersion = match[1];
    } else if (/Firefox/.test(userAgent)) {
      result.browser = 'Firefox';
      const match = userAgent.match(/Firefox\/(\d+)/);
      if (match) result.browserVersion = match[1];
    } else if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent)) {
      result.browser = 'Safari';
      const match = userAgent.match(/Safari\/(\d+)/);
      if (match) result.browserVersion = match[1];
    } else if (/Edge/.test(userAgent)) {
      result.browser = 'Edge';
      const match = userAgent.match(/Edge\/(\d+)/);
      if (match) result.browserVersion = match[1];
    }

    // OS detection
    if (/Windows/.test(userAgent)) {
      result.os = 'Windows';
      result.platform = 'windows';
    } else if (/Mac OS X/.test(userAgent)) {
      result.os = 'macOS';
      result.platform = 'macos';
    } else if (/Linux/.test(userAgent)) {
      result.os = 'Linux';
      result.platform = 'linux';
    } else if (/Android/.test(userAgent)) {
      result.os = 'Android';
      result.platform = 'android';
    } else if (/iPhone|iPad/.test(userAgent)) {
      result.os = 'iOS';
      result.platform = 'ios';
    }

    return result;
  };

  UserDevice.registerDevice = async function(userId, deviceInfo, ipAddress) {
    const deviceId = this.generateDeviceId(deviceInfo.userAgent, ipAddress);

    // Check if device already exists
    let device = await this.findOne({
      where: { deviceId }
    });

    if (device) {
      // Update existing device
      await device.updateLastLogin(ipAddress, deviceInfo.locationInfo);
      return device;
    }

    // Parse user agent
    const parsedUA = this.parseUserAgent(deviceInfo.userAgent);

    // Create new device
    device = await this.create({
      userId,
      deviceId,
      deviceType: parsedUA.deviceType,
      platform: parsedUA.platform,
      browser: parsedUA.browser,
      browserVersion: parsedUA.browserVersion,
      os: parsedUA.os,
      osVersion: parsedUA.osVersion,
      deviceFingerprint: this.generateFingerprint(deviceInfo),
      lastLoginAt: new Date(),
      lastIpAddress: ipAddress,
      locationInfo: deviceInfo.locationInfo,
      notificationPreferences: {
        email: true,
        push: true,
        sms: false
      }
    });

    // Auto-generate device name
    if (!device.deviceName) {
      device.deviceName = device.generateDeviceName();
      await device.save();
    }

    return device;
  };

  UserDevice.getUserDevices = function(userId, activeOnly = true) {
    const where = { userId };
    if (activeOnly) {
      where.isActive = true;
    }

    return this.findAll({
      where,
      order: [['lastLoginAt', 'DESC']],
      attributes: {
        exclude: ['pushToken', 'deviceFingerprint']
      }
    });
  };

  UserDevice.getTrustedDevices = function(userId) {
    return this.findAll({
      where: {
        userId,
        isTrusted: true,
        isActive: true
      },
      order: [['lastLoginAt', 'DESC']]
    });
  };

  UserDevice.revokeDevice = async function(userId, deviceId) {
    const device = await this.findOne({
      where: {
        userId,
        deviceId
      }
    });

    if (!device) {
      throw new Error('Device not found');
    }

    await device.deactivate();
    return device;
  };

  UserDevice.cleanupOldDevices = async function(daysInactive = 90) {
    const cutoffDate = new Date(Date.now() - daysInactive * 24 * 60 * 60 * 1000);

    const oldDevices = await this.findAll({
      where: {
        lastLoginAt: {
          [sequelize.Sequelize.Op.lt]: cutoffDate
        },
        isActive: true
      }
    });

    for (const device of oldDevices) {
      await device.deactivate();
    }

    return oldDevices.length;
  };

  // Associations
  UserDevice.associate = function(models) {
    UserDevice.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
  };

  return UserDevice;
};