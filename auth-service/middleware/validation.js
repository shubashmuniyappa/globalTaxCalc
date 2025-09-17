const { body, param, query } = require('express-validator');

const validationRules = {
  register: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    body('firstName')
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('First name is required and must be less than 50 characters'),
    body('lastName')
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Last name is required and must be less than 50 characters'),
    body('gdprConsent')
      .isBoolean()
      .withMessage('GDPR consent must be a boolean'),
    body('marketingConsent')
      .optional()
      .isBoolean()
      .withMessage('Marketing consent must be a boolean')
  ],

  login: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
    body('rememberMe')
      .optional()
      .isBoolean()
      .withMessage('Remember me must be a boolean'),
    body('deviceInfo')
      .optional()
      .isObject()
      .withMessage('Device info must be an object'),
    body('deviceInfo.deviceType')
      .optional()
      .isIn(['mobile', 'tablet', 'desktop'])
      .withMessage('Device type must be mobile, tablet, or desktop'),
    body('deviceInfo.browserName')
      .optional()
      .isLength({ max: 50 })
      .withMessage('Browser name must be less than 50 characters'),
    body('deviceInfo.os')
      .optional()
      .isLength({ max: 50 })
      .withMessage('OS must be less than 50 characters')
  ],

  loginWithTwoFactor: [
    body('twoFactorToken')
      .notEmpty()
      .withMessage('Two-factor token is required'),
    body('code')
      .isLength({ min: 6, max: 6 })
      .isNumeric()
      .withMessage('Two-factor code must be 6 digits'),
    body('rememberMe')
      .optional()
      .isBoolean()
      .withMessage('Remember me must be a boolean'),
    body('deviceInfo')
      .optional()
      .isObject()
      .withMessage('Device info must be an object')
  ],

  requestPasswordReset: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required')
  ],

  resetPassword: [
    body('token')
      .notEmpty()
      .withMessage('Reset token is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
  ],

  verifyEmail: [
    param('token')
      .notEmpty()
      .withMessage('Verification token is required')
  ],

  updateProfile: [
    body('firstName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('First name must be between 1 and 50 characters'),
    body('lastName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Last name must be between 1 and 50 characters'),
    body('marketingConsent')
      .optional()
      .isBoolean()
      .withMessage('Marketing consent must be a boolean')
  ],

  changePassword: [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
  ],

  setupTwoFactor: [
    body('secret')
      .notEmpty()
      .withMessage('Two-factor secret is required'),
    body('code')
      .isLength({ min: 6, max: 6 })
      .isNumeric()
      .withMessage('Verification code must be 6 digits')
  ],

  verifyTwoFactor: [
    body('code')
      .isLength({ min: 6, max: 6 })
      .isNumeric()
      .withMessage('Two-factor code must be 6 digits')
  ],

  createGuestSession: [
    body('deviceInfo')
      .optional()
      .isObject()
      .withMessage('Device info must be an object'),
    body('deviceInfo.deviceType')
      .optional()
      .isIn(['mobile', 'tablet', 'desktop'])
      .withMessage('Device type must be mobile, tablet, or desktop'),
    body('deviceInfo.browserName')
      .optional()
      .isLength({ max: 50 })
      .withMessage('Browser name must be less than 50 characters'),
    body('deviceInfo.os')
      .optional()
      .isLength({ max: 50 })
      .withMessage('OS must be less than 50 characters')
  ],

  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('sortBy')
      .optional()
      .isIn(['createdAt', 'updatedAt', 'email', 'firstName', 'lastName', 'lastLoginAt'])
      .withMessage('Invalid sort field'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be asc or desc')
  ],

  userSearch: [
    query('search')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('Search term must be between 1 and 100 characters'),
    query('role')
      .optional()
      .isIn(['user', 'premium', 'admin'])
      .withMessage('Invalid role filter'),
    query('subscriptionStatus')
      .optional()
      .isIn(['free', 'premium', 'enterprise'])
      .withMessage('Invalid subscription status filter'),
    query('emailVerified')
      .optional()
      .isBoolean()
      .withMessage('Email verified filter must be a boolean'),
    query('isActive')
      .optional()
      .isBoolean()
      .withMessage('Active filter must be a boolean')
  ]
};

module.exports = validationRules;