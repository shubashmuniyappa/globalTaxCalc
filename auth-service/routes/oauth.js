const express = require('express');
const router = express.Router();
const oauthController = require('../controllers/oauthController');
const authMiddleware = require('../middleware/auth');
const { body } = require('express-validator');
const { rateLimiters } = require('../middleware/rateLimiting');

// OAuth validation rules
const oauthValidation = {
  googleLogin: [
    body('idToken')
      .notEmpty()
      .withMessage('Google ID token is required'),
    body('deviceInfo')
      .optional()
      .isObject()
      .withMessage('Device info must be an object')
  ],

  appleLogin: [
    body('idToken')
      .notEmpty()
      .withMessage('Apple ID token is required'),
    body('authorizationCode')
      .optional()
      .isString()
      .withMessage('Authorization code must be a string'),
    body('deviceInfo')
      .optional()
      .isObject()
      .withMessage('Device info must be an object'),
    body('user')
      .optional()
      .isObject()
      .withMessage('User data must be an object'),
    body('user.name')
      .optional()
      .isObject()
      .withMessage('User name must be an object'),
    body('user.name.firstName')
      .optional()
      .isString()
      .withMessage('First name must be a string'),
    body('user.name.lastName')
      .optional()
      .isString()
      .withMessage('Last name must be a string')
  ],

  linkProvider: [
    body('provider')
      .isIn(['google', 'apple'])
      .withMessage('Provider must be google or apple'),
    body('idToken')
      .notEmpty()
      .withMessage('ID token is required'),
    body('authorizationCode')
      .optional()
      .isString()
      .withMessage('Authorization code must be a string')
  ]
};

// Public OAuth routes

// Get OAuth configuration
router.get('/config',
  rateLimiters.general,
  oauthController.getConfig
);

// Google OAuth login
router.post('/google/login',
  rateLimiters.auth,
  oauthValidation.googleLogin,
  oauthController.googleLogin
);

// Apple OAuth login
router.post('/apple/login',
  rateLimiters.auth,
  oauthValidation.appleLogin,
  oauthController.appleLogin
);

// Protected OAuth routes (require authentication)

// Get linked OAuth providers
router.get('/providers',
  authMiddleware.authenticateToken,
  rateLimiters.general,
  oauthController.getLinkedProviders
);

// Link OAuth provider to existing account
router.post('/link',
  authMiddleware.authenticateToken,
  rateLimiters.auth,
  oauthValidation.linkProvider,
  oauthController.linkProvider
);

// Unlink OAuth provider
router.delete('/providers/:provider',
  authMiddleware.authenticateToken,
  rateLimiters.auth,
  oauthController.unlinkProvider
);

module.exports = router;