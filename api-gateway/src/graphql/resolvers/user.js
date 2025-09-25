/**
 * User Management Resolvers
 * Handles all user-related GraphQL operations
 */

const userResolvers = {
  Query: {
    // User queries
    user: async (_, { id }, { dataSources, user }) => {
      return await dataSources.userAPI.getUser(id);
    },

    users: async (_, { input }, { dataSources, user }) => {
      return await dataSources.userAPI.getUsers(input);
    },

    me: async (_, __, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.userAPI.getUser(user.id);
    },

    // Profile and preferences
    userProfile: async (_, { userId }, { dataSources, user }) => {
      return await dataSources.userAPI.getUserProfile(userId || user.id);
    },

    userPreferences: async (_, __, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.userAPI.getUserPreferences(user.id);
    },

    // Authentication
    authMethods: async (_, { userId }, { dataSources, user }) => {
      return await dataSources.userAPI.getAuthMethods(userId || user.id);
    },

    // Sessions and devices
    userSessions: async (_, __, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.userAPI.getUserSessions(user.id);
    },

    userDevices: async (_, __, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.userAPI.getUserDevices(user.id);
    },

    // API keys and integrations
    apiKeys: async (_, __, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.userAPI.getApiKeys(user.id);
    },

    integrations: async (_, __, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.userAPI.getIntegrations(user.id);
    },

    // Billing and subscriptions
    userBilling: async (_, __, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.billingAPI.getUserBilling(user.id);
    },

    // Analytics and activity
    userAnalytics: async (_, { input }, { dataSources, user }) => {
      return await dataSources.analyticsAPI.getUserAnalytics(user.id, input);
    },

    userActivity: async (_, { input }, { dataSources, user }) => {
      return await dataSources.userAPI.getUserActivity(user.id, input);
    },

    // Admin queries
    userStats: async (_, { input }, { dataSources, user }) => {
      return await dataSources.analyticsAPI.getUserStats(input);
    },

    adminUsers: async (_, { input }, { dataSources, user }) => {
      return await dataSources.userAPI.getAdminUsers(input);
    }
  },

  Mutation: {
    // Authentication
    register: async (_, { input }, { dataSources }) => {
      return await dataSources.userAPI.register(input);
    },

    login: async (_, { input }, { dataSources }) => {
      return await dataSources.userAPI.login(input);
    },

    logout: async (_, __, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.userAPI.logout(user.id);
    },

    refreshToken: async (_, { refreshToken }, { dataSources }) => {
      return await dataSources.userAPI.refreshToken(refreshToken);
    },

    // Profile management
    updateProfile: async (_, { input }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.userAPI.updateProfile(user.id, input);
    },

    updatePreferences: async (_, { input }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.userAPI.updatePreferences(user.id, input);
    },

    uploadAvatar: async (_, { file }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.userAPI.uploadAvatar(user.id, file);
    },

    // Password and security
    changePassword: async (_, { input }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.userAPI.changePassword(user.id, input);
    },

    resetPassword: async (_, { input }, { dataSources }) => {
      return await dataSources.userAPI.resetPassword(input);
    },

    // Two-factor authentication
    enableTwoFactor: async (_, { input }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.userAPI.enableTwoFactor(user.id, input);
    },

    disableTwoFactor: async (_, { input }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.userAPI.disableTwoFactor(user.id, input);
    },

    verifyTwoFactor: async (_, { input }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.userAPI.verifyTwoFactor(user.id, input);
    },

    // API key management
    createApiKey: async (_, { input }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.userAPI.createApiKey(user.id, input);
    },

    updateApiKey: async (_, { id, input }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.userAPI.updateApiKey(user.id, id, input);
    },

    deleteApiKey: async (_, { id }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.userAPI.deleteApiKey(user.id, id);
    },

    // Session management
    terminateSession: async (_, { sessionId }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.userAPI.terminateSession(user.id, sessionId);
    },

    terminateAllSessions: async (_, __, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.userAPI.terminateAllSessions(user.id);
    },

    // Device management
    registerDevice: async (_, { input }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.userAPI.registerDevice(user.id, input);
    },

    removeDevice: async (_, { deviceId }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.userAPI.removeDevice(user.id, deviceId);
    },

    // Data management
    exportUserData: async (_, { input }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.userAPI.exportUserData(user.id, input);
    },

    deleteUserData: async (_, { input }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.userAPI.deleteUserData(user.id, input);
    },

    // Account management
    deleteAccount: async (_, { input }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.userAPI.deleteAccount(user.id, input);
    },

    // Admin mutations
    createUser: async (_, { input }, { dataSources, user }) => {
      return await dataSources.userAPI.createUser(input, user);
    },

    updateUser: async (_, { id, input }, { dataSources, user }) => {
      return await dataSources.userAPI.updateUser(id, input, user);
    },

    deleteUser: async (_, { id }, { dataSources, user }) => {
      return await dataSources.userAPI.deleteUser(id, user);
    },

    banUser: async (_, { input }, { dataSources, user }) => {
      return await dataSources.userAPI.banUser(input, user);
    },

    unbanUser: async (_, { userId }, { dataSources, user }) => {
      return await dataSources.userAPI.unbanUser(userId, user);
    }
  },

  Subscription: {
    // User activity updates
    userActivityUpdate: {
      subscribe: async (_, { userId }, { pubsub, user }) => {
        return pubsub.asyncIterator([`USER_ACTIVITY_${userId || user.id}`]);
      }
    },

    // Security alerts
    securityAlert: {
      subscribe: async (_, __, { pubsub, user }) => {
        if (!user) throw new Error('Not authenticated');
        return pubsub.asyncIterator([`SECURITY_ALERT_${user.id}`]);
      }
    },

    // Session updates
    sessionUpdate: {
      subscribe: async (_, __, { pubsub, user }) => {
        if (!user) throw new Error('Not authenticated');
        return pubsub.asyncIterator([`SESSION_UPDATE_${user.id}`]);
      }
    }
  },

  // Type resolvers
  User: {
    profile: async (parent, _, { dataSources }) => {
      return await dataSources.userAPI.getUserProfile(parent.id);
    },

    preferences: async (parent, _, { dataSources }) => {
      return await dataSources.userAPI.getUserPreferences(parent.id);
    },

    subscription: async (parent, _, { dataSources }) => {
      return await dataSources.billingAPI.getUserSubscription(parent.id);
    },

    analytics: async (parent, args, { dataSources }) => {
      return await dataSources.analyticsAPI.getUserAnalytics(parent.id, args.input);
    },

    billing: async (parent, _, { dataSources }) => {
      return await dataSources.billingAPI.getUserBilling(parent.id);
    }
  },

  UserProfile: {
    user: async (parent, _, { dataSources }) => {
      return await dataSources.userAPI.getUser(parent.userId);
    }
  },

  UserSession: {
    user: async (parent, _, { dataSources }) => {
      return await dataSources.userAPI.getUser(parent.userId);
    },

    device: async (parent, _, { dataSources }) => {
      return await dataSources.userAPI.getUserDevice(parent.deviceId);
    }
  },

  ApiKey: {
    user: async (parent, _, { dataSources }) => {
      return await dataSources.userAPI.getUser(parent.userId);
    },

    usage: async (parent, _, { dataSources }) => {
      return await dataSources.analyticsAPI.getApiKeyUsage(parent.id);
    }
  }
};

module.exports = userResolvers;