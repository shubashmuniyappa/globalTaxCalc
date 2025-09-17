module.exports = ({ env }) => ({
  // Internationalization plugin
  i18n: {
    enabled: true,
    config: {
      locales: [
        'en', // English (default)
        'es', // Spanish
        'fr', // French
        'de', // German
        'it', // Italian
        'pt', // Portuguese
        'zh-Hans', // Chinese Simplified
        'ja', // Japanese
        'ko', // Korean
        'ar', // Arabic
        'hi', // Hindi
        'ru', // Russian
      ],
      defaultLocale: 'en',
      cookieName: 'strapi_i18n',
    },
  },

  // Documentation plugin
  documentation: {
    enabled: true,
    config: {
      restrictedAccess: false,
      password: env('DOCS_PASSWORD'),
      componentSchemas: {},
      info: {
        version: '1.0.0',
        title: 'GlobalTaxCalc CMS API',
        description: 'Content Management API for GlobalTaxCalc.com',
        termsOfService: 'https://globaltaxcalc.com/terms',
        contact: {
          name: 'GlobalTaxCalc API Support',
          email: 'api@globaltaxcalc.com',
          url: 'https://globaltaxcalc.com/support'
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT'
        }
      },
      'x-strapi-config': {
        plugins: ['users-permissions', 'upload', 'i18n']
      },
      servers: [
        {
          url: 'http://localhost:1337/api',
          description: 'Development server'
        },
        {
          url: 'https://cms.globaltaxcalc.com/api',
          description: 'Production server'
        }
      ]
    }
  },

  // Upload plugin with Cloudinary
  upload: {
    enabled: true,
    config: {
      provider: 'cloudinary',
      providerOptions: {
        cloud_name: env('CLOUDINARY_NAME'),
        api_key: env('CLOUDINARY_KEY'),
        api_secret: env('CLOUDINARY_SECRET'),
      },
      actionOptions: {
        upload: {
          folder: 'globaltaxcalc',
          resource_type: 'auto',
          allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'pdf', 'mp4', 'mov'],
        },
        uploadStream: {
          folder: 'globaltaxcalc',
          resource_type: 'auto',
        },
        delete: {},
      },
    },
  },

  // Email plugin
  email: {
    enabled: true,
    config: {
      provider: 'sendgrid',
      providerOptions: {
        apiKey: env('SENDGRID_API_KEY'),
      },
      settings: {
        defaultFrom: 'noreply@globaltaxcalc.com',
        defaultReplyTo: 'support@globaltaxcalc.com',
        testAddress: 'test@globaltaxcalc.com',
      },
    },
  },

  // Users & Permissions plugin
  'users-permissions': {
    enabled: true,
    config: {
      jwt: {
        expiresIn: '7d',
      },
      ratelimit: {
        enabled: true,
        interval: 60000,
        max: 10,
      },
      register: {
        allowedFields: ['username', 'email', 'firstName', 'lastName', 'role'],
      },
    },
  },

  // SEO plugin
  seo: {
    enabled: true,
    config: {
      contentTypes: [
        {
          uid: 'api::blog-post.blog-post',
          component: 'shared.seo',
          populate: {
            metaTitle: true,
            metaDescription: true,
            metaImage: {
              populate: true,
            },
            metaSocial: {
              populate: true,
            },
            keywords: true,
            metaRobots: true,
            structuredData: true,
            metaViewport: true,
            canonicalURL: true,
          },
        },
        {
          uid: 'api::tax-guide.tax-guide',
          component: 'shared.seo',
          populate: {
            metaTitle: true,
            metaDescription: true,
            metaImage: {
              populate: true,
            },
            structuredData: true,
            canonicalURL: true,
          },
        },
        {
          uid: 'api::country-page.country-page',
          component: 'shared.seo',
          populate: {
            metaTitle: true,
            metaDescription: true,
            metaImage: {
              populate: true,
            },
            structuredData: true,
            canonicalURL: true,
          },
        },
      ],
    },
  },
});