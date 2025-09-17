const nodemailer = require('nodemailer');
const config = require('../config');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter
   */
  initializeTransporter() {
    try {
      if (config.SENDGRID_API_KEY) {
        // Use SendGrid
        this.transporter = nodemailer.createTransporter({
          service: 'SendGrid',
          auth: {
            user: 'apikey',
            pass: config.SENDGRID_API_KEY
          }
        });
        this.isConfigured = true;
        console.log('Email service configured with SendGrid');

      } else if (config.SMTP_HOST) {
        // Use custom SMTP
        this.transporter = nodemailer.createTransporter({
          host: config.SMTP_HOST,
          port: config.SMTP_PORT,
          secure: config.SMTP_SECURE,
          auth: {
            user: config.SMTP_USER,
            pass: config.SMTP_PASS
          }
        });
        this.isConfigured = true;
        console.log('Email service configured with SMTP');

      } else if (config.NODE_ENV === 'development') {
        // Use Ethereal for development
        this.createTestAccount();
      } else {
        console.warn('Email service not configured - emails will not be sent');
      }

    } catch (error) {
      console.error('Failed to initialize email service:', error);
    }
  }

  /**
   * Create test account for development
   */
  async createTestAccount() {
    try {
      const testAccount = await nodemailer.createTestAccount();

      this.transporter = nodemailer.createTransporter({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });

      this.isConfigured = true;
      console.log('Email service configured with Ethereal (development)');
      console.log('Test credentials:', testAccount.user, testAccount.pass);

    } catch (error) {
      console.error('Failed to create test email account:', error);
    }
  }

  /**
   * Send email
   */
  async sendEmail(mailOptions) {
    if (!this.isConfigured) {
      console.warn('Email service not configured - cannot send email');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const info = await this.transporter.sendMail({
        from: config.EMAIL_FROM,
        ...mailOptions
      });

      // Log preview URL for development
      if (config.NODE_ENV === 'development') {
        console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
      }

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: config.NODE_ENV === 'development' ? nodemailer.getTestMessageUrl(info) : null
      };

    } catch (error) {
      console.error('Failed to send email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send email verification
   */
  async sendEmailVerification(email, token) {
    const verificationUrl = `${config.EMAIL_VERIFICATION_URL}?token=${token}`;

    const mailOptions = {
      to: email,
      subject: 'Verify your email address - GlobalTaxCalc',
      html: this.getEmailVerificationTemplate(verificationUrl),
      text: `Please verify your email address by clicking this link: ${verificationUrl}`
    };

    return this.sendEmail(mailOptions);
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(email, token) {
    const resetUrl = `${config.PASSWORD_RESET_URL}?token=${token}`;

    const mailOptions = {
      to: email,
      subject: 'Reset your password - GlobalTaxCalc',
      html: this.getPasswordResetTemplate(resetUrl),
      text: `Reset your password by clicking this link: ${resetUrl}`
    };

    return this.sendEmail(mailOptions);
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(email, firstName) {
    const mailOptions = {
      to: email,
      subject: 'Welcome to GlobalTaxCalc!',
      html: this.getWelcomeTemplate(firstName),
      text: `Welcome to GlobalTaxCalc, ${firstName}! We're excited to help you with your tax calculations.`
    };

    return this.sendEmail(mailOptions);
  }

  /**
   * Send security alert email
   */
  async sendSecurityAlert(email, alertType, details = {}) {
    const subject = this.getSecurityAlertSubject(alertType);

    const mailOptions = {
      to: email,
      subject: `Security Alert: ${subject} - GlobalTaxCalc`,
      html: this.getSecurityAlertTemplate(alertType, details),
      text: this.getSecurityAlertText(alertType, details)
    };

    return this.sendEmail(mailOptions);
  }

  /**
   * Send two-factor authentication setup email
   */
  async sendTwoFactorSetupEmail(email, firstName) {
    const mailOptions = {
      to: email,
      subject: 'Two-Factor Authentication Enabled - GlobalTaxCalc',
      html: this.getTwoFactorSetupTemplate(firstName),
      text: 'Two-factor authentication has been successfully enabled on your GlobalTaxCalc account.'
    };

    return this.sendEmail(mailOptions);
  }

  /**
   * Email templates
   */
  getEmailVerificationTemplate(verificationUrl) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Verify your email - GlobalTaxCalc</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { background: #f3f4f6; padding: 20px; font-size: 14px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>GlobalTaxCalc</h1>
          </div>
          <div class="content">
            <h2>Verify your email address</h2>
            <p>Thank you for signing up for GlobalTaxCalc! To complete your registration, please verify your email address by clicking the button below.</p>
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p><a href="${verificationUrl}">${verificationUrl}</a></p>
            <p>This link will expire in 24 hours for security reasons.</p>
            <p>If you didn't create an account with GlobalTaxCalc, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} GlobalTaxCalc. All rights reserved.</p>
            <p>If you have any questions, contact us at support@globaltaxcalc.com</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getPasswordResetTemplate(resetUrl) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Reset your password - GlobalTaxCalc</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .button { display: inline-block; padding: 12px 24px; background: #dc2626; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { background: #f3f4f6; padding: 20px; font-size: 14px; color: #6b7280; }
          .warning { background: #fef3cd; border: 1px solid #fbbf24; padding: 15px; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>GlobalTaxCalc</h1>
          </div>
          <div class="content">
            <h2>Reset your password</h2>
            <p>We received a request to reset your password for your GlobalTaxCalc account.</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            <div class="warning">
              <strong>Important:</strong> This link will expire in 10 minutes for security reasons. If you don't reset your password within this time, you'll need to request a new reset link.
            </div>
            <p>If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} GlobalTaxCalc. All rights reserved.</p>
            <p>If you have any questions, contact us at support@globaltaxcalc.com</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getWelcomeTemplate(firstName) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Welcome to GlobalTaxCalc!</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: #059669; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .button { display: inline-block; padding: 12px 24px; background: #059669; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { background: #f3f4f6; padding: 20px; font-size: 14px; color: #6b7280; }
          .feature { margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to GlobalTaxCalc!</h1>
          </div>
          <div class="content">
            <h2>Hi ${firstName},</h2>
            <p>Welcome to GlobalTaxCalc! We're thrilled to have you join our community of smart tax calculators.</p>
            <h3>What you can do with GlobalTaxCalc:</h3>
            <div class="feature">✓ Calculate taxes for multiple countries</div>
            <div class="feature">✓ Generate detailed tax reports</div>
            <div class="feature">✓ Save and track your calculation history</div>
            <div class="feature">✓ Get AI-powered tax optimization suggestions</div>
            <a href="${config.FRONTEND_URL}/dashboard" class="button">Get Started</a>
            <p>If you have any questions or need help getting started, our support team is here to help!</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} GlobalTaxCalc. All rights reserved.</p>
            <p>Questions? Contact us at support@globaltaxcalc.com</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getSecurityAlertTemplate(alertType, details) {
    const alerts = {
      new_login: {
        title: 'New login to your account',
        message: `We detected a new login to your GlobalTaxCalc account from ${details.location || 'an unknown location'}.`,
        details: [
          `Device: ${details.device || 'Unknown'}`,
          `IP Address: ${details.ipAddress || 'Unknown'}`,
          `Time: ${details.time || new Date().toLocaleString()}`
        ]
      },
      password_changed: {
        title: 'Password changed',
        message: 'Your GlobalTaxCalc account password was successfully changed.',
        details: [
          `Time: ${details.time || new Date().toLocaleString()}`,
          `IP Address: ${details.ipAddress || 'Unknown'}`
        ]
      },
      suspicious_activity: {
        title: 'Suspicious activity detected',
        message: 'We detected unusual activity on your GlobalTaxCalc account.',
        details: [
          `Activity: ${details.activity || 'Unknown'}`,
          `Time: ${details.time || new Date().toLocaleString()}`,
          `IP Address: ${details.ipAddress || 'Unknown'}`
        ]
      }
    };

    const alert = alerts[alertType] || alerts.suspicious_activity;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Security Alert - GlobalTaxCalc</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .alert { background: #fee2e2; border: 1px solid #dc2626; padding: 15px; border-radius: 6px; margin: 20px 0; }
          .details { background: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0; }
          .footer { background: #f3f4f6; padding: 20px; font-size: 14px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔒 Security Alert</h1>
          </div>
          <div class="content">
            <h2>${alert.title}</h2>
            <div class="alert">
              <p>${alert.message}</p>
            </div>
            <div class="details">
              <h3>Details:</h3>
              ${alert.details.map(detail => `<p>• ${detail}</p>`).join('')}
            </div>
            <p>If this was you, no further action is needed. If you don't recognize this activity, please secure your account immediately:</p>
            <ul>
              <li>Change your password</li>
              <li>Enable two-factor authentication</li>
              <li>Review your account activity</li>
              <li>Contact our support team</li>
            </ul>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} GlobalTaxCalc. All rights reserved.</p>
            <p>Security concerns? Contact us immediately at security@globaltaxcalc.com</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getTwoFactorSetupTemplate(firstName) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Two-Factor Authentication Enabled - GlobalTaxCalc</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: #059669; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .success { background: #d1fae5; border: 1px solid #059669; padding: 15px; border-radius: 6px; margin: 20px 0; }
          .footer { background: #f3f4f6; padding: 20px; font-size: 14px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Security Enhanced</h1>
          </div>
          <div class="content">
            <h2>Hi ${firstName},</h2>
            <div class="success">
              <p><strong>Great news!</strong> Two-factor authentication has been successfully enabled on your GlobalTaxCalc account.</p>
            </div>
            <p>Your account is now more secure. You'll need both your password and your authenticator app to sign in.</p>
            <h3>What this means:</h3>
            <ul>
              <li>Enhanced security for your account</li>
              <li>Protection against unauthorized access</li>
              <li>You'll need your authenticator app for future logins</li>
            </ul>
            <p>Keep your backup codes in a safe place - you'll need them if you lose access to your authenticator app.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} GlobalTaxCalc. All rights reserved.</p>
            <p>Questions about security? Contact us at security@globaltaxcalc.com</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getSecurityAlertSubject(alertType) {
    const subjects = {
      new_login: 'New login detected',
      password_changed: 'Password changed',
      suspicious_activity: 'Suspicious activity detected'
    };

    return subjects[alertType] || 'Security alert';
  }

  getSecurityAlertText(alertType, details) {
    const alerts = {
      new_login: `New login detected on your GlobalTaxCalc account from ${details.location || 'unknown location'} at ${details.time || new Date().toLocaleString()}.`,
      password_changed: `Your GlobalTaxCalc password was changed at ${details.time || new Date().toLocaleString()}.`,
      suspicious_activity: `Suspicious activity detected on your GlobalTaxCalc account: ${details.activity || 'Unknown activity'}.`
    };

    return alerts[alertType] || 'Security alert for your GlobalTaxCalc account.';
  }

  /**
   * Test email configuration
   */
  async testConfiguration() {
    if (!this.isConfigured) {
      return { success: false, error: 'Email service not configured' };
    }

    try {
      await this.transporter.verify();
      return { success: true, message: 'Email configuration is valid' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();