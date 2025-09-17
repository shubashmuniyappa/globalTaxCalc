const authService = require('../services/authService');
const { validationResult } = require('express-validator');

class AuthController {
  async register(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const result = await authService.register(req.body, req);

      res.status(201).json({
        success: true,
        message: result.emailVerificationRequired
          ? 'Registration successful. Please check your email to verify your account.'
          : 'Registration successful.',
        data: {
          user: result.user,
          emailVerificationRequired: result.emailVerificationRequired
        }
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async login(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const result = await authService.login(req.body, req);

      if (!result.success && result.twoFactorRequired) {
        return res.status(200).json({
          success: false,
          twoFactorRequired: true,
          twoFactorToken: result.twoFactorToken,
          message: result.message
        });
      }

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
          tokenType: result.tokenType,
          session: result.session,
          device: result.device
        }
      });

    } catch (error) {
      res.status(401).json({
        success: false,
        message: error.message
      });
    }
  }

  async loginWithTwoFactor(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const result = await authService.loginWithTwoFactor(req.body, req);

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });

      res.json({
        success: true,
        message: 'Two-factor authentication successful',
        data: {
          user: result.user,
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
          tokenType: result.tokenType,
          session: result.session,
          device: result.device
        }
      });

    } catch (error) {
      res.status(401).json({
        success: false,
        message: error.message
      });
    }
  }

  async logout(req, res) {
    try {
      const sessionId = req.session?.id;
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'No active session found'
        });
      }

      await authService.logout(sessionId, req);

      res.clearCookie('refreshToken');
      res.json({
        success: true,
        message: 'Logout successful'
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async logoutAll(req, res) {
    try {
      const userId = req.user?.id;
      const currentSessionId = req.session?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const result = await authService.logoutAll(userId, currentSessionId, req);

      res.clearCookie('refreshToken');
      res.json({
        success: true,
        message: 'Logged out from all devices successfully',
        data: {
          revokedSessions: result.revokedSessions
        }
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async refreshToken(req, res) {
    try {
      const refreshToken = req.cookies.refreshToken;
      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token not provided'
        });
      }

      const result = await authService.refreshToken(refreshToken, req);

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
          tokenType: result.tokenType
        }
      });

    } catch (error) {
      res.status(401).json({
        success: false,
        message: error.message
      });
    }
  }

  async createGuestSession(req, res) {
    try {
      const result = await authService.createGuestSession(req, req.body.deviceInfo);

      res.json({
        success: true,
        message: 'Guest session created',
        data: {
          sessionId: result.sessionId,
          token: result.token,
          expiresAt: result.expiresAt
        }
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async requestPasswordReset(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const result = await authService.requestPasswordReset(req.body.email, req);

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

  async resetPassword(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { token, password } = req.body;
      const result = await authService.resetPassword(token, password, req);

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

  async verifyEmail(req, res) {
    try {
      const { token } = req.params;
      const result = await authService.verifyEmail(token, req);

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

  async getProfile(req, res) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      res.json({
        success: true,
        data: {
          user: user.toSafeObject()
        }
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async getSessionInfo(req, res) {
    try {
      const sessionId = req.session?.id;
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'No active session found'
        });
      }

      const sessionInfo = await authService.getSessionInfo(sessionId);
      if (!sessionInfo) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      res.json({
        success: true,
        data: sessionInfo
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new AuthController();