const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const validationRules = require('../middleware/validation');
const { rateLimiters, applyMultipleRateLimiters } = require('../middleware/rateLimiting');

// Public authentication routes

// Register new user
router.post('/register',
  applyMultipleRateLimiters(rateLimiters.general, rateLimiters.registration),
  validationRules.register,
  authController.register
);

// Login user
router.post('/login',
  applyMultipleRateLimiters(rateLimiters.loginByIP, rateLimiters.loginByEmail),
  validationRules.login,
  authController.login
);

// Two-factor authentication login
router.post('/login/2fa',
  applyMultipleRateLimiters(rateLimiters.auth, rateLimiters.twoFactor),
  validationRules.loginWithTwoFactor,
  authController.loginWithTwoFactor
);

// Create guest session
router.post('/guest',
  rateLimiters.guestSession,
  validationRules.createGuestSession,
  authController.createGuestSession
);

// Refresh access token
router.post('/refresh',
  rateLimiters.auth,
  authController.refreshToken
);

// Password reset request
router.post('/password/reset',
  rateLimiters.passwordReset,
  validationRules.requestPasswordReset,
  authController.requestPasswordReset
);

// Password reset with token
router.post('/password/reset/confirm',
  rateLimiters.auth,
  validationRules.resetPassword,
  authController.resetPassword
);

// Email verification
router.get('/verify/:token',
  rateLimiters.general,
  validationRules.verifyEmail,
  authController.verifyEmail
);

// Protected authentication routes (require authentication)

// Logout current session
router.post('/logout',
  authMiddleware.authenticateToken,
  authController.logout
);

// Logout from all sessions
router.post('/logout/all',
  authMiddleware.authenticateToken,
  authController.logoutAll
);

// Get current user profile
router.get('/profile',
  authMiddleware.authenticateToken,
  authController.getProfile
);

// Get current session information
router.get('/session',
  authMiddleware.authenticateGuest,
  authController.getSessionInfo
);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Auth service is healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

module.exports = router;