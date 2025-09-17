const oauthService = require('../services/oauthService');
const { validationResult } = require('express-validator');

class OAuthController {
  async googleLogin(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { idToken, deviceInfo } = req.body;
      const result = await oauthService.authenticateWithGoogle(idToken, deviceInfo, req);

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });

      res.json({
        success: true,
        message: result.isNewUser ? 'Account created and logged in successfully' : 'Login successful',
        data: {
          user: result.user,
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
          tokenType: result.tokenType,
          session: result.session,
          device: result.device,
          isNewUser: result.isNewUser
        }
      });

    } catch (error) {
      res.status(401).json({
        success: false,
        message: error.message
      });
    }
  }

  async appleLogin(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { idToken, authorizationCode, deviceInfo } = req.body;
      const result = await oauthService.authenticateWithApple(idToken, authorizationCode, deviceInfo, req);

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });

      res.json({
        success: true,
        message: result.isNewUser ? 'Account created and logged in successfully' : 'Login successful',
        data: {
          user: result.user,
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
          tokenType: result.tokenType,
          session: result.session,
          device: result.device,
          isNewUser: result.isNewUser
        }
      });

    } catch (error) {
      res.status(401).json({
        success: false,
        message: error.message
      });
    }
  }

  async linkProvider(req, res) {
    try {
      const user = req.user;
      const { provider, idToken, authorizationCode } = req.body;

      if (!['google', 'apple'].includes(provider)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid OAuth provider'
        });
      }

      let providerData;

      if (provider === 'google') {
        if (!idToken) {
          return res.status(400).json({
            success: false,
            message: 'Google ID token is required'
          });
        }

        try {
          const ticket = await oauthService.googleClient.verifyIdToken({
            idToken,
            audience: require('../config').GOOGLE_CLIENT_ID
          });

          const payload = ticket.getPayload();
          providerData = {
            providerId: payload.sub,
            email: payload.email,
            profile: {
              name: `${payload.given_name} ${payload.family_name}`,
              picture: payload.picture,
              email_verified: payload.email_verified
            }
          };
        } catch (error) {
          return res.status(400).json({
            success: false,
            message: 'Invalid Google ID token'
          });
        }

      } else if (provider === 'apple') {
        if (!idToken) {
          return res.status(400).json({
            success: false,
            message: 'Apple ID token is required'
          });
        }

        const decodedToken = oauthService.decodeAppleIdToken(idToken);
        if (!decodedToken) {
          return res.status(400).json({
            success: false,
            message: 'Invalid Apple ID token'
          });
        }

        const isValidToken = await oauthService.verifyAppleIdToken(idToken);
        if (!isValidToken) {
          return res.status(400).json({
            success: false,
            message: 'Apple ID token verification failed'
          });
        }

        providerData = {
          providerId: decodedToken.sub,
          email: decodedToken.email,
          profile: {
            email_verified: decodedToken.email_verified
          }
        };
      }

      const result = await oauthService.linkOAuthProvider(user.id, provider, providerData, req);

      res.json({
        success: true,
        message: `${provider} account linked successfully`,
        data: result
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async unlinkProvider(req, res) {
    try {
      const user = req.user;
      const { provider } = req.params;

      if (!['google', 'apple'].includes(provider)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid OAuth provider'
        });
      }

      const result = await oauthService.unlinkOAuthProvider(user.id, provider, req);

      res.json({
        success: true,
        message: result.message
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async getLinkedProviders(req, res) {
    try {
      const user = req.user;
      const providers = await oauthService.getUserOAuthProviders(user.id);

      res.json({
        success: true,
        data: {
          providers
        }
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async getConfig(req, res) {
    try {
      const config = await oauthService.getOAuthConfig();

      res.json({
        success: true,
        data: config
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new OAuthController();