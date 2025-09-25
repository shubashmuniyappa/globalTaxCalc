require('dotenv').config();

const config = {
  // Server configuration
  server: {
    port: process.env.PORT || 3007,
    host: process.env.HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'development'
  },

  // Database configuration
  database: {
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/notification-service',
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10
      }
    }
  },

  // Redis configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: process.env.REDIS_DB || 1
  },

  // SendGrid configuration
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY,
    fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@globaltaxcalc.com',
    fromName: process.env.SENDGRID_FROM_NAME || 'GlobalTaxCalc',
    replyToEmail: process.env.SENDGRID_REPLY_TO || 'support@globaltaxcalc.com',

    // Webhook settings
    webhookUrl: process.env.SENDGRID_WEBHOOK_URL,
    webhookSecret: process.env.SENDGRID_WEBHOOK_SECRET,

    // Template IDs for SendGrid dynamic templates
    templates: {
      welcome: process.env.SENDGRID_TEMPLATE_WELCOME,
      tax_reminder: process.env.SENDGRID_TEMPLATE_TAX_REMINDER,
      premium_upgrade: process.env.SENDGRID_TEMPLATE_PREMIUM,
      newsletter: process.env.SENDGRID_TEMPLATE_NEWSLETTER,
      password_reset: process.env.SENDGRID_TEMPLATE_PASSWORD_RESET,
      account_verification: process.env.SENDGRID_TEMPLATE_VERIFICATION,
      abandoned_calculation: process.env.SENDGRID_TEMPLATE_ABANDONED,
      seasonal_tips: process.env.SENDGRID_TEMPLATE_SEASONAL
    }
  },

  // Firebase Cloud Messaging configuration
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    databaseURL: process.env.FIREBASE_DATABASE_URL,

    // FCM options
    vapidKey: process.env.FIREBASE_VAPID_KEY,
    messagingUrl: process.env.FIREBASE_MESSAGING_URL
  },

  // Notification preferences
  notifications: {
    // Default preferences for new users
    defaultPreferences: {
      email: {
        marketing: false,
        transactional: true,
        tax_reminders: true,
        newsletters: false,
        product_updates: false
      },
      push: {
        enabled: false,
        marketing: false,
        tax_reminders: true,
        breaking_news: false
      },
      frequency: {
        max_marketing_per_week: 2,
        max_reminders_per_month: 4
      }
    },

    // Unsubscribe settings
    unsubscribe: {
      tokenExpiry: 30 * 24 * 60 * 60, // 30 days in seconds
      allowResubscribe: true,
      cooldownPeriod: 24 * 60 * 60, // 24 hours in seconds
      gracePeriod: 7 * 24 * 60 * 60 // 7 days in seconds
    }
  },

  // Campaign settings
  campaigns: {
    maxRecipientsPerBatch: 1000,
    batchDelay: 10000, // 10 seconds between batches
    maxCampaignsPerDay: 5,

    // A/B testing
    abTesting: {
      enabled: true,
      defaultSplitRatio: 0.5,
      minSampleSize: 100,
      maxTestDuration: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
  },

  // Compliance settings
  compliance: {
    canSpam: {
      enabled: true,
      physicalAddress: process.env.COMPANY_PHYSICAL_ADDRESS || '123 Business St, City, State 12345',
      unsubscribeRequired: true,
      identificationRequired: true
    },

    gdpr: {
      enabled: true,
      consentRequired: true,
      dataRetentionDays: 365 * 2, // 2 years
      anonymizeAfterUnsubscribe: true
    }
  },

  // Rate limiting
  rateLimit: {
    email: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 50 // emails per window per user
    },
    push: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // push notifications per window per user
    },
    api: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // API requests per window per IP
    }
  },

  // Queue configuration
  queue: {
    email: {
      name: 'email-queue',
      concurrency: 5,
      maxRetries: 3,
      backoffDelay: 5000
    },
    push: {
      name: 'push-queue',
      concurrency: 10,
      maxRetries: 3,
      backoffDelay: 2000
    },
    campaign: {
      name: 'campaign-queue',
      concurrency: 2,
      maxRetries: 1,
      backoffDelay: 10000
    }
  },

  // Template configuration
  templates: {
    directory: process.env.TEMPLATES_DIR || './templates',
    cacheEnabled: process.env.NODE_ENV === 'production',
    compileOnStartup: process.env.NODE_ENV === 'production',

    // MJML settings
    mjml: {
      keepComments: false,
      beautify: process.env.NODE_ENV !== 'production',
      minify: process.env.NODE_ENV === 'production'
    }
  },

  // Localization
  i18n: {
    defaultLanguage: 'en',
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar', 'hi', 'ru'],
    directory: './locales',
    fallbackLng: 'en'
  },

  // Tax calendar configuration
  taxCalendar: {
    countries: {
      US: {
        deadlines: {
          individual: {
            filing: '04-15',
            extension: '10-15',
            quarterly: ['01-15', '04-15', '06-15', '09-15']
          },
          business: {
            filing: '03-15',
            extension: '09-15',
            quarterly: ['01-15', '04-15', '06-15', '09-15']
          }
        },
        reminderSchedule: {
          beforeDeadline: [30, 14, 7, 3, 1], // days before
          afterDeadline: [1] // days after for missed deadlines
        }
      },
      CA: {
        deadlines: {
          individual: {
            filing: '04-30',
            quarterly: ['03-15', '06-15', '09-15', '12-15']
          }
        }
      },
      GB: {
        deadlines: {
          individual: {
            filing: '01-31',
            selfAssessment: '10-31'
          }
        }
      }
    }
  },

  // Monitoring and logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    file: process.env.LOG_FILE || null
  },

  // External services
  external: {
    analyticsService: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3006',
    userService: process.env.USER_SERVICE_URL || 'http://localhost:3001',
    apiKey: process.env.EXTERNAL_API_KEY
  }
};

module.exports = config;