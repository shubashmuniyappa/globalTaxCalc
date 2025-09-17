module.exports = ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET', 'defaultAdminJwtSecret'),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT', 'defaultApiTokenSalt'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT', 'defaultTransferTokenSalt'),
    },
  },
  flags: {
    nps: env.bool('FLAG_NPS', true),
    promoteEE: env.bool('FLAG_PROMOTE_EE', true),
  },
  url: env('ADMIN_URL', '/admin'),
  serveAdminPanel: env.bool('SERVE_ADMIN', true),
  rateLimit: {
    enabled: env.bool('RATE_LIMIT_ENABLED', true),
    interval: env.int('RATE_LIMIT_INTERVAL', 60000),
    max: env.int('RATE_LIMIT_MAX', 5),
  },
  forgotPassword: {
    emailTemplate: {
      subject: 'Reset password for GlobalTaxCalc CMS',
      text: 'Follow this link to reset your password: <%= url %>',
      html: `
        <h1>Reset your password</h1>
        <p>Follow this link to reset your password for GlobalTaxCalc CMS:</p>
        <a href="<%= url %>">Reset Password</a>
        <p>If you did not request this, please ignore this email.</p>
      `,
    },
  },
  watchIgnoreFiles: [
    '**/config/sync/**',
  ],
});