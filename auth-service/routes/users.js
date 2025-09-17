const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');
const validationRules = require('../middleware/validation');
const { rateLimiters } = require('../middleware/rateLimiting');

// User profile management routes

// Update user profile
router.patch('/profile',
  authMiddleware.authenticateToken,
  rateLimiters.profileUpdate,
  validationRules.updateProfile,
  userController.updateProfile
);

// Change password
router.post('/password/change',
  authMiddleware.authenticateToken,
  rateLimiters.auth,
  validationRules.changePassword,
  userController.changePassword
);

// Delete user account
router.delete('/account',
  authMiddleware.authenticateToken,
  rateLimiters.auth,
  userController.deleteAccount
);

// Download user data (GDPR compliance)
router.get('/data/export',
  authMiddleware.authenticateToken,
  rateLimiters.general,
  userController.exportUserData
);

// Two-factor authentication routes

// Setup two-factor authentication
router.post('/2fa/setup',
  authMiddleware.authenticateToken,
  authMiddleware.requireEmailVerified,
  rateLimiters.twoFactor,
  userController.setupTwoFactor
);

// Confirm two-factor authentication setup
router.post('/2fa/confirm',
  authMiddleware.authenticateToken,
  rateLimiters.twoFactor,
  validationRules.setupTwoFactor,
  userController.confirmTwoFactor
);

// Disable two-factor authentication
router.post('/2fa/disable',
  authMiddleware.authenticateToken,
  rateLimiters.twoFactor,
  validationRules.verifyTwoFactor,
  userController.disableTwoFactor
);

// Generate backup codes for 2FA
router.post('/2fa/backup-codes',
  authMiddleware.authenticateToken,
  authMiddleware.requireTwoFactor,
  rateLimiters.twoFactor,
  userController.generateBackupCodes
);

// Session management routes

// Get user sessions
router.get('/sessions',
  authMiddleware.authenticateToken,
  rateLimiters.general,
  userController.getUserSessions
);

// Revoke specific session
router.delete('/sessions/:sessionId',
  authMiddleware.authenticateToken,
  rateLimiters.auth,
  userController.revokeSession
);

// Device management routes

// Get user devices
router.get('/devices',
  authMiddleware.authenticateToken,
  rateLimiters.general,
  userController.getUserDevices
);

// Trust a device
router.post('/devices/:deviceId/trust',
  authMiddleware.authenticateToken,
  rateLimiters.auth,
  userController.trustDevice
);

// Untrust a device
router.delete('/devices/:deviceId/trust',
  authMiddleware.authenticateToken,
  rateLimiters.auth,
  userController.untrustDevice
);

// Remove a device
router.delete('/devices/:deviceId',
  authMiddleware.authenticateToken,
  rateLimiters.auth,
  userController.removeDevice
);

// Email management routes

// Resend email verification
router.post('/email/verify/resend',
  authMiddleware.authenticateToken,
  rateLimiters.emailVerification,
  userController.resendEmailVerification
);

// Change email address
router.post('/email/change',
  authMiddleware.authenticateToken,
  rateLimiters.auth,
  validationRules.requestPasswordReset, // Reuse email validation
  userController.changeEmail
);

// Confirm email change
router.post('/email/change/confirm',
  authMiddleware.authenticateToken,
  rateLimiters.auth,
  validationRules.verifyEmail,
  userController.confirmEmailChange
);

// Subscription and billing routes

// Get subscription status
router.get('/subscription',
  authMiddleware.authenticateToken,
  rateLimiters.general,
  userController.getSubscriptionStatus
);

// Update subscription (placeholder for payment integration)
router.post('/subscription/upgrade',
  authMiddleware.authenticateToken,
  authMiddleware.requireEmailVerified,
  rateLimiters.auth,
  userController.upgradeSubscription
);

// Cancel subscription
router.post('/subscription/cancel',
  authMiddleware.authenticateToken,
  rateLimiters.auth,
  userController.cancelSubscription
);

// Admin routes (require admin role)

// Get all users (admin only)
router.get('/admin/users',
  authMiddleware.authenticateToken,
  authMiddleware.requireRole('admin'),
  rateLimiters.admin,
  validationRules.pagination,
  validationRules.userSearch,
  userController.getAllUsers
);

// Get user by ID (admin only)
router.get('/admin/users/:userId',
  authMiddleware.authenticateToken,
  authMiddleware.requireRole('admin'),
  rateLimiters.admin,
  userController.getUserById
);

// Update user (admin only)
router.patch('/admin/users/:userId',
  authMiddleware.authenticateToken,
  authMiddleware.requireRole('admin'),
  rateLimiters.admin,
  userController.adminUpdateUser
);

// Activate/deactivate user (admin only)
router.post('/admin/users/:userId/toggle-status',
  authMiddleware.authenticateToken,
  authMiddleware.requireRole('admin'),
  rateLimiters.admin,
  userController.toggleUserStatus
);

// Get user audit logs (admin only)
router.get('/admin/users/:userId/audit-logs',
  authMiddleware.authenticateToken,
  authMiddleware.requireRole('admin'),
  rateLimiters.admin,
  validationRules.pagination,
  userController.getUserAuditLogs
);

// Get security events (admin only)
router.get('/admin/security-events',
  authMiddleware.authenticateToken,
  authMiddleware.requireRole('admin'),
  rateLimiters.admin,
  validationRules.pagination,
  userController.getSecurityEvents
);

module.exports = router;