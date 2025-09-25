const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Internationalization configuration
  i18n: {
    // Supported locales
    locales: [
      'en',    // English (default)
      'es',    // Spanish
      'fr',    // French
      'de',    // German
      'ja',    // Japanese
      'zh',    // Chinese (Simplified)
      'pt',    // Portuguese
      'it',    // Italian
      'ar',    // Arabic (RTL)
      'he',    // Hebrew (RTL)
      'ru',    // Russian
      'ko',    // Korean
      'hi',    // Hindi
      'nl',    // Dutch
      'sv',    // Swedish
      'no',    // Norwegian
      'da',    // Danish
      'pl',    // Polish
      'tr',    // Turkish
      'th'     // Thai
    ],

    // Default locale
    defaultLocale: 'en',

    // Locale detection configuration
    localeDetection: true,

    // Domain-based routing for different regions
    domains: [
      {
        domain: 'globaltaxcalc.com',
        defaultLocale: 'en',
        locales: ['en']
      },
      {
        domain: 'globaltaxcalc.es',
        defaultLocale: 'es',
        locales: ['es']
      },
      {
        domain: 'globaltaxcalc.fr',
        defaultLocale: 'fr',
        locales: ['fr']
      },
      {
        domain: 'globaltaxcalc.de',
        defaultLocale: 'de',
        locales: ['de']
      },
      {
        domain: 'globaltaxcalc.jp',
        defaultLocale: 'ja',
        locales: ['ja']
      }
    ]
  },

  experimental: {
    appDir: false, // Keep Pages Router for better i18n support
    // Enable SWC for faster builds with i18n
    swcTraceProfiling: true,
  },

  // Enable strict mode for better development experience
  reactStrictMode: true,

  // Optimize images with i18n support
  images: {
    domains: ['localhost', 'globaltaxcalc.com', 'images.globaltaxcalc.com', 'cdn.globaltaxcalc.com'],
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1 year
  },

  // Environment variables for i18n
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
    NEXT_PUBLIC_SUPPORTED_LOCALES: 'en,es,fr,de,ja,zh,pt,it,ar,he,ru,ko,hi,nl,sv,no,da,pl,tr,th',
    NEXT_PUBLIC_DEFAULT_LOCALE: 'en',
    NEXT_PUBLIC_FALLBACK_LOCALE: 'en',
  },

  // Redirects
  async redirects() {
    return [
      {
        source: '/calculate',
        destination: '/calculator',
        permanent: true,
      },
    ];
  },

  // Headers for security and performance
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },

  // Webpack configuration for i18n
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Add custom webpack configurations if needed
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };

      // Optimize bundle splitting for locales
      config.optimization.splitChunks.cacheGroups = {
        ...config.optimization.splitChunks.cacheGroups,
        intl: {
          name: 'intl',
          chunks: 'all',
          test: /[\\/]node_modules[\\/](@formatjs|react-intl)[\\/]/,
          priority: 30,
          reuseExistingChunk: true
        },
        locales: {
          name: 'locales',
          chunks: 'all',
          test: /[\\/]locales[\\/]/,
          priority: 25,
          reuseExistingChunk: true
        }
      };
    }

    // Add support for importing translation files
    config.module.rules.push({
      test: /\.json$/,
      type: 'json'
    });

    return config;
  },

  // Compiler options
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Output configuration
  output: 'standalone',

  // Disable x-powered-by header
  poweredByHeader: false,
};

module.exports = withBundleAnalyzer(withPWA(nextConfig));