const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User, OAuthProvider, AuditLog } = require('../models');
const authService = require('./authService');
const config = require('../config');

class OAuthService {
  constructor() {
    this.googleClient = config.GOOGLE_CLIENT_ID
      ? new OAuth2Client(config.GOOGLE_CLIENT_ID)
      : null;
  }

  async authenticateWithGoogle(idToken, deviceInfo, req) {
    try {
      if (!this.googleClient) {
        throw new Error('Google OAuth not configured');
      }

      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: config.GOOGLE_CLIENT_ID
      });

      const payload = ticket.getPayload();
      const {
        sub: googleId,
        email,
        given_name: firstName,
        family_name: lastName,
        picture: avatarUrl,
        email_verified: emailVerified
      } = payload;

      let user = await User.findOne({ where: { email } });
      let isNewUser = false;

      if (!user) {
        user = await User.create({
          email,
          firstName,
          lastName,
          role: 'user',
          subscriptionStatus: 'free',
          emailVerified: emailVerified || false,
          isActive: true,
          gdprConsent: true, // Assumed from OAuth consent flow
          gdprConsentDate: new Date(),
          avatarUrl
        });
        isNewUser = true;
      } else if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      let oauthProvider = await OAuthProvider.findOne({
        where: {
          userId: user.id,
          provider: 'google',
          providerId: googleId
        }
      });

      if (!oauthProvider) {
        oauthProvider = await OAuthProvider.create({
          userId: user.id,
          provider: 'google',
          providerId: googleId,
          email,
          profile: {
            name: `${firstName} ${lastName}`,
            picture: avatarUrl,
            email_verified: emailVerified
          }
        });
      } else {
        oauthProvider.email = email;
        oauthProvider.profile = {
          name: `${firstName} ${lastName}`,
          picture: avatarUrl,
          email_verified: emailVerified
        };
        oauthProvider.lastUsedAt = new Date();
        await oauthProvider.save();
      }

      if (emailVerified && !user.emailVerified) {
        user.emailVerified = true;
        await user.save();
      }

      const sessionData = await authService.createUserSession(user, req, deviceInfo, false);

      user.lastLoginAt = new Date();
      user.lastLoginIp = req.ip;
      await user.save();

      await AuditLog.logAuthEvent('oauth_login_success', user.id, sessionData.session.id, req, {
        provider: 'google',
        email,
        isNewUser
      });

      return {
        success: true,
        isNewUser,
        user: user.toSafeObject(),
        ...sessionData.tokens,
        session: {
          id: sessionData.session.sessionId,
          expiresAt: sessionData.session.expiresAt
        },
        device: sessionData.device?.getSecurityInfo()
      };

    } catch (error) {
      await AuditLog.logAuthEvent('oauth_login_failed', null, null, req, {
        provider: 'google',
        error: error.message
      });

      throw error;
    }
  }

  async authenticateWithApple(idToken, authorizationCode, deviceInfo, req) {
    try {
      if (!config.APPLE_CLIENT_ID) {
        throw new Error('Apple OAuth not configured');
      }

      const decodedToken = this.decodeAppleIdToken(idToken);

      if (!decodedToken) {
        throw new Error('Invalid Apple ID token');
      }

      const isValidToken = await this.verifyAppleIdToken(idToken);
      if (!isValidToken) {
        throw new Error('Apple ID token verification failed');
      }

      const {
        sub: appleId,
        email,
        email_verified: emailVerified
      } = decodedToken;

      let firstName = '';
      let lastName = '';

      if (req.body.user && req.body.user.name) {
        firstName = req.body.user.name.firstName || '';
        lastName = req.body.user.name.lastName || '';
      }

      let user = await User.findOne({ where: { email } });
      let isNewUser = false;

      if (!user) {
        user = await User.create({
          email,
          firstName,
          lastName,
          role: 'user',
          subscriptionStatus: 'free',
          emailVerified: emailVerified === 'true' || emailVerified === true,
          isActive: true,
          gdprConsent: true,
          gdprConsentDate: new Date()
        });
        isNewUser = true;
      } else if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      let oauthProvider = await OAuthProvider.findOne({
        where: {
          userId: user.id,
          provider: 'apple',
          providerId: appleId
        }
      });

      if (!oauthProvider) {
        oauthProvider = await OAuthProvider.create({
          userId: user.id,
          provider: 'apple',
          providerId: appleId,
          email,
          profile: {
            name: `${firstName} ${lastName}`.trim(),
            email_verified: emailVerified
          }
        });
      } else {
        oauthProvider.email = email;
        oauthProvider.lastUsedAt = new Date();
        await oauthProvider.save();
      }

      if ((emailVerified === 'true' || emailVerified === true) && !user.emailVerified) {
        user.emailVerified = true;
        await user.save();
      }

      const sessionData = await authService.createUserSession(user, req, deviceInfo, false);

      user.lastLoginAt = new Date();
      user.lastLoginIp = req.ip;
      await user.save();

      await AuditLog.logAuthEvent('oauth_login_success', user.id, sessionData.session.id, req, {
        provider: 'apple',
        email,
        isNewUser
      });

      return {
        success: true,
        isNewUser,
        user: user.toSafeObject(),
        ...sessionData.tokens,
        session: {
          id: sessionData.session.sessionId,
          expiresAt: sessionData.session.expiresAt
        },
        device: sessionData.device?.getSecurityInfo()
      };

    } catch (error) {
      await AuditLog.logAuthEvent('oauth_login_failed', null, null, req, {
        provider: 'apple',
        error: error.message
      });

      throw error;
    }
  }

  decodeAppleIdToken(idToken) {
    try {
      const decoded = jwt.decode(idToken, { complete: true });
      return decoded.payload;
    } catch (error) {
      return null;
    }
  }

  async verifyAppleIdToken(idToken) {
    try {
      if (!config.APPLE_PRIVATE_KEY || !config.APPLE_KEY_ID || !config.APPLE_TEAM_ID) {
        console.warn('Apple OAuth configuration incomplete, skipping token verification');
        return true; // In development, skip verification if not configured
      }

      const jwksClient = require('jwks-rsa');
      const client = jwksClient({
        jwksUri: 'https://appleid.apple.com/auth/keys'
      });

      const decoded = jwt.decode(idToken, { complete: true });
      if (!decoded) {
        return false;
      }

      const kid = decoded.header.kid;
      const key = await client.getSigningKey(kid);
      const publicKey = key.getPublicKey();

      jwt.verify(idToken, publicKey, {
        issuer: 'https://appleid.apple.com',
        audience: config.APPLE_CLIENT_ID
      });

      return true;

    } catch (error) {
      console.error('Apple ID token verification failed:', error);
      return false;
    }
  }

  async linkOAuthProvider(userId, provider, providerData, req) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const existingProvider = await OAuthProvider.findOne({
        where: {
          providerId: providerData.providerId,
          provider
        }
      });

      if (existingProvider && existingProvider.userId !== userId) {
        throw new Error('This account is already linked to another user');
      }

      if (existingProvider) {
        throw new Error('This account is already linked');
      }

      const oauthProvider = await OAuthProvider.create({
        userId,
        provider,
        providerId: providerData.providerId,
        email: providerData.email,
        profile: providerData.profile
      });

      await AuditLog.logUserEvent('oauth_provider_linked', userId, req, {
        provider,
        providerId: providerData.providerId
      });

      return {
        success: true,
        provider: oauthProvider.toJSON()
      };

    } catch (error) {
      throw error;
    }
  }

  async unlinkOAuthProvider(userId, provider, req) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.passwordHash) {
        const hasOtherProviders = await OAuthProvider.count({
          where: {
            userId,
            provider: { [require('sequelize').Op.ne]: provider }
          }
        });

        if (hasOtherProviders === 0) {
          throw new Error('Cannot unlink the only authentication method. Please set a password first.');
        }
      }

      const oauthProvider = await OAuthProvider.findOne({
        where: { userId, provider }
      });

      if (!oauthProvider) {
        throw new Error('OAuth provider not found');
      }

      await oauthProvider.destroy();

      await AuditLog.logUserEvent('oauth_provider_unlinked', userId, req, {
        provider,
        providerId: oauthProvider.providerId
      });

      return {
        success: true,
        message: 'OAuth provider unlinked successfully'
      };

    } catch (error) {
      throw error;
    }
  }

  async getUserOAuthProviders(userId) {
    try {
      const providers = await OAuthProvider.findAll({
        where: { userId },
        attributes: ['provider', 'email', 'profile', 'createdAt', 'lastUsedAt']
      });

      return providers.map(provider => ({
        provider: provider.provider,
        email: provider.email,
        profile: provider.profile,
        linkedAt: provider.createdAt,
        lastUsed: provider.lastUsedAt
      }));

    } catch (error) {
      throw error;
    }
  }

  generateAppleClientSecret() {
    try {
      if (!config.APPLE_PRIVATE_KEY || !config.APPLE_KEY_ID || !config.APPLE_TEAM_ID) {
        throw new Error('Apple OAuth configuration incomplete');
      }

      const now = Math.floor(Date.now() / 1000);
      const payload = {
        iss: config.APPLE_TEAM_ID,
        iat: now,
        exp: now + (86400 * 180), // 180 days
        aud: 'https://appleid.apple.com',
        sub: config.APPLE_CLIENT_ID
      };

      const privateKey = config.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n');

      return jwt.sign(payload, privateKey, {
        algorithm: 'ES256',
        header: {
          alg: 'ES256',
          kid: config.APPLE_KEY_ID
        }
      });

    } catch (error) {
      console.error('Failed to generate Apple client secret:', error);
      throw error;
    }
  }

  async revokeAppleToken(refreshToken) {
    try {
      const clientSecret = this.generateAppleClientSecret();

      const response = await fetch('https://appleid.apple.com/auth/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: config.APPLE_CLIENT_ID,
          client_secret: clientSecret,
          token: refreshToken,
          token_type_hint: 'refresh_token'
        })
      });

      return response.ok;

    } catch (error) {
      console.error('Failed to revoke Apple token:', error);
      return false;
    }
  }

  async getOAuthConfig() {
    return {
      google: {
        enabled: !!config.GOOGLE_CLIENT_ID,
        clientId: config.GOOGLE_CLIENT_ID
      },
      apple: {
        enabled: !!config.APPLE_CLIENT_ID,
        clientId: config.APPLE_CLIENT_ID
      }
    };
  }
}

module.exports = new OAuthService();