const jwtService = require('../services/jwtService');
const authService = require('../services/authService');
const { User } = require('../models');

const authMiddleware = {
  authenticateToken: async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Access token required'
        });
      }

      const verificationResult = jwtService.verifyAccessToken(token);

      if (!verificationResult.success) {
        if (verificationResult.expired) {
          return res.status(401).json({
            success: false,
            message: 'Token expired',
            code: 'TOKEN_EXPIRED'
          });
        }

        return res.status(401).json({
          success: false,
          message: verificationResult.error || 'Invalid token'
        });
      }

      const payload = verificationResult.payload;

      // Get user from database
      const user = await User.findByPk(payload.id);
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User not found or inactive'
        });
      }

      // Check if session is still valid
      const sessionInfo = await authService.getSessionInfo(payload.sessionId);
      if (!sessionInfo) {
        return res.status(401).json({
          success: false,
          message: 'Invalid session',
          code: 'INVALID_SESSION'
        });
      }

      req.user = user;
      req.session = sessionInfo;
      req.token = payload;
      next();

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Authentication error'
      });
    }
  },

  authenticateOptional: async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        return next();
      }

      const verificationResult = jwtService.verifyAccessToken(token);

      if (verificationResult.success) {
        const payload = verificationResult.payload;
        const user = await User.findByPk(payload.id);

        if (user && user.isActive) {
          const sessionInfo = await authService.getSessionInfo(payload.sessionId);
          if (sessionInfo) {
            req.user = user;
            req.session = sessionInfo;
            req.token = payload;
          }
        }
      }

      next();

    } catch (error) {
      next();
    }
  },

  authenticateGuest: async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Session token required'
        });
      }

      const verificationResult = jwtService.verifyToken(token);

      if (!verificationResult.success) {
        return res.status(401).json({
          success: false,
          message: verificationResult.error || 'Invalid session token'
        });
      }

      const payload = verificationResult.payload;

      if (payload.type === 'guest') {
        const sessionInfo = await authService.getSessionInfo(payload.sessionId);
        if (!sessionInfo) {
          return res.status(401).json({
            success: false,
            message: 'Invalid guest session'
          });
        }

        req.session = sessionInfo;
        req.token = payload;
        req.isGuest = true;
      } else if (payload.type === 'access') {
        const user = await User.findByPk(payload.id);
        if (!user || !user.isActive) {
          return res.status(401).json({
            success: false,
            message: 'User not found or inactive'
          });
        }

        const sessionInfo = await authService.getSessionInfo(payload.sessionId);
        if (!sessionInfo) {
          return res.status(401).json({
            success: false,
            message: 'Invalid session'
          });
        }

        req.user = user;
        req.session = sessionInfo;
        req.token = payload;
        req.isGuest = false;
      } else {
        return res.status(401).json({
          success: false,
          message: 'Invalid token type'
        });
      }

      next();

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Authentication error'
      });
    }
  },

  requireRole: (roles) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const userRole = req.user.role;
      const allowedRoles = Array.isArray(roles) ? roles : [roles];

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      next();
    };
  },

  requireSubscription: (tiers) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const userTier = req.user.subscriptionStatus;
      const allowedTiers = Array.isArray(tiers) ? tiers : [tiers];

      if (!allowedTiers.includes(userTier)) {
        return res.status(403).json({
          success: false,
          message: 'Subscription upgrade required',
          code: 'SUBSCRIPTION_REQUIRED',
          data: {
            currentTier: userTier,
            requiredTiers: allowedTiers
          }
        });
      }

      next();
    };
  },

  requireEmailVerified: (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!req.user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Email verification required',
        code: 'EMAIL_VERIFICATION_REQUIRED'
      });
    }

    next();
  },

  requireTwoFactor: (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!req.user.twoFactorEnabled) {
      return res.status(403).json({
        success: false,
        message: 'Two-factor authentication required',
        code: 'TWO_FACTOR_REQUIRED'
      });
    }

    next();
  }
};

module.exports = authMiddleware;