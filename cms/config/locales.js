module.exports = {
  locales: [
    {
      code: 'en',
      name: 'English',
      isDefault: true,
      fallback: null,
      flag: '🇺🇸',
      nativeName: 'English',
      direction: 'ltr'
    },
    {
      code: 'es',
      name: 'Spanish',
      isDefault: false,
      fallback: 'en',
      flag: '🇪🇸',
      nativeName: 'Español',
      direction: 'ltr'
    },
    {
      code: 'fr',
      name: 'French',
      isDefault: false,
      fallback: 'en',
      flag: '🇫🇷',
      nativeName: 'Français',
      direction: 'ltr'
    },
    {
      code: 'de',
      name: 'German',
      isDefault: false,
      fallback: 'en',
      flag: '🇩🇪',
      nativeName: 'Deutsch',
      direction: 'ltr'
    },
    {
      code: 'it',
      name: 'Italian',
      isDefault: false,
      fallback: 'en',
      flag: '🇮🇹',
      nativeName: 'Italiano',
      direction: 'ltr'
    },
    {
      code: 'pt',
      name: 'Portuguese',
      isDefault: false,
      fallback: 'en',
      flag: '🇵🇹',
      nativeName: 'Português',
      direction: 'ltr'
    },
    {
      code: 'zh-Hans',
      name: 'Chinese Simplified',
      isDefault: false,
      fallback: 'en',
      flag: '🇨🇳',
      nativeName: '简体中文',
      direction: 'ltr'
    },
    {
      code: 'ja',
      name: 'Japanese',
      isDefault: false,
      fallback: 'en',
      flag: '🇯🇵',
      nativeName: '日本語',
      direction: 'ltr'
    },
    {
      code: 'ko',
      name: 'Korean',
      isDefault: false,
      fallback: 'en',
      flag: '🇰🇷',
      nativeName: '한국어',
      direction: 'ltr'
    },
    {
      code: 'ar',
      name: 'Arabic',
      isDefault: false,
      fallback: 'en',
      flag: '🇸🇦',
      nativeName: 'العربية',
      direction: 'rtl'
    },
    {
      code: 'hi',
      name: 'Hindi',
      isDefault: false,
      fallback: 'en',
      flag: '🇮🇳',
      nativeName: 'हिन्दी',
      direction: 'ltr'
    },
    {
      code: 'ru',
      name: 'Russian',
      isDefault: false,
      fallback: 'en',
      flag: '🇷🇺',
      nativeName: 'Русский',
      direction: 'ltr'
    }
  ],

  // Default locale configuration
  defaultLocale: 'en',

  // Locale detection settings
  detection: {
    enabled: true,
    order: ['cookie', 'header', 'querystring'],
    caches: ['cookie'],
    cookieName: 'strapi_locale',
    cookieOptions: {
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    }
  },

  // Translation settings
  translation: {
    enabled: true,
    autoTranslate: false, // Set to true to enable auto-translation
    translationService: 'google', // 'google', 'deepl', 'azure'
    apiKey: process.env.TRANSLATION_API_KEY
  },

  // Content synchronization
  sync: {
    enabled: true,
    strategy: 'manual', // 'auto' or 'manual'
    fields: ['seo', 'slug'] // Fields to sync across locales
  },

  // URL structure for different locales
  urlStructure: {
    strategy: 'prefix', // 'prefix', 'domain', 'query'
    defaultInUrl: false, // Include default locale in URL
    prefixes: {
      en: '', // No prefix for default locale
      es: 'es',
      fr: 'fr',
      de: 'de',
      it: 'it',
      pt: 'pt',
      'zh-Hans': 'zh',
      ja: 'ja',
      ko: 'ko',
      ar: 'ar',
      hi: 'hi',
      ru: 'ru'
    }
  }
};