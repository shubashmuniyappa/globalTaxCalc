/**
 * SEO Layout Component for GlobalTaxCalc.com
 *
 * Comprehensive SEO-optimized layout component that automatically generates
 * meta tags, structured data, and implements Core Web Vitals optimizations.
 */

import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { generatePageMeta } from '../../lib/seo/meta-generator';
import {
  injectStructuredData,
  generateCalculatorSchema,
  generateArticleSchema,
  generateBreadcrumbSchema,
  generateFAQSchema,
  defaultSchemas
} from '../../lib/seo/structured-data';

const SEOLayout = ({
  children,
  // Page metadata
  title,
  description,
  keywords = [],
  canonical,
  noindex = false,
  nofollow = false,

  // Open Graph data
  ogTitle,
  ogDescription,
  ogImage,
  ogType = 'website',

  // Twitter Card data
  twitterTitle,
  twitterDescription,
  twitterImage,
  twitterCard = 'summary_large_image',

  // Article data (for blog posts)
  article,

  // Calculator data
  calculator,

  // FAQ data
  faq,

  // Breadcrumb data
  breadcrumbs = [],

  // Location data
  country,
  state,
  city,

  // Seasonal/temporal data
  taxYear,
  season,

  // Content metadata
  publishedTime,
  modifiedTime,
  author,
  tags = [],
  category,

  // Performance optimization flags
  preloadImages = [],
  preloadFonts = [],
  criticalCSS,

  // Additional schema data
  additionalSchemas = []
}) => {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Generate comprehensive page metadata
  const pageData = {
    title,
    description,
    keywords,
    canonical: canonical || router.asPath,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      image: ogImage,
      type: ogType
    },
    twitter: {
      title: twitterTitle,
      description: twitterDescription,
      image: twitterImage,
      card: twitterCard
    },
    publishedTime,
    modifiedTime,
    author,
    tags,
    category,
    country,
    state,
    city,
    calculator: calculator?.type,
    taxYear,
    season
  };

  const metaData = generatePageMeta(pageData);

  // Generate structured data schemas
  const generateSchemas = () => {
    const schemas = [...defaultSchemas];

    // Add calculator schema
    if (calculator) {
      schemas.push(generateCalculatorSchema({
        name: calculator.name,
        description: calculator.description,
        country: country || 'united-states',
        url: `https://globaltaxcalc.com${router.asPath}`,
        taxYear: taxYear || new Date().getFullYear(),
        features: calculator.features || [],
        lastUpdated: modifiedTime || new Date().toISOString()
      }));
    }

    // Add article schema
    if (article) {
      schemas.push(generateArticleSchema({
        headline: title,
        description: description,
        url: `https://globaltaxcalc.com${router.asPath}`,
        datePublished: publishedTime,
        dateModified: modifiedTime,
        authorName: author,
        image: ogImage,
        keywords: keywords.join(', '),
        category: category
      }));
    }

    // Add breadcrumb schema
    if (breadcrumbs.length > 0) {
      schemas.push(generateBreadcrumbSchema(breadcrumbs));
    }

    // Add FAQ schema
    if (faq && faq.length > 0) {
      schemas.push(generateFAQSchema(faq));
    }

    // Add additional schemas
    schemas.push(...additionalSchemas);

    return schemas;
  };

  // Inject structured data on mount and route changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const schemas = generateSchemas();
      injectStructuredData(schemas);
      setMounted(true);
    }
  }, [router.asPath, title, description]);

  // Generate robots meta content
  const getRobotsContent = () => {
    const directives = [];

    if (noindex) directives.push('noindex');
    else directives.push('index');

    if (nofollow) directives.push('nofollow');
    else directives.push('follow');

    // Add additional SEO directives
    directives.push('max-snippet:-1');
    directives.push('max-image-preview:large');
    directives.push('max-video-preview:-1');

    return directives.join(', ');
  };

  // Generate hreflang links for international content
  const generateHreflangLinks = () => {
    if (!country || !metaData.hreflangTags) return null;

    return metaData.hreflangTags.map((tag, index) => (
      <link
        key={index}
        rel="alternate"
        hrefLang={tag.hreflang}
        href={tag.href}
      />
    ));
  };

  // Generate preload links for performance
  const generatePreloadLinks = () => {
    const preloads = [];

    // Preload critical fonts
    preloadFonts.forEach((font, index) => {
      preloads.push(
        <link
          key={`font-${index}`}
          rel="preload"
          href={font.href}
          as="font"
          type={font.type || 'font/woff2'}
          crossOrigin="anonymous"
        />
      );
    });

    // Preload critical images
    preloadImages.forEach((image, index) => {
      preloads.push(
        <link
          key={`image-${index}`}
          rel="preload"
          href={image.href}
          as="image"
          type={image.type}
        />
      );
    });

    return preloads;
  };

  return (
    <>
      <Head>
        {/* Basic Meta Tags */}
        <title>{metaData.title}</title>
        <meta name="description" content={metaData.metaTags.description} />
        <meta name="keywords" content={metaData.metaTags.keywords} />
        <meta name="author" content={metaData.metaTags.author} />
        <meta name="robots" content={getRobotsContent()} />

        {/* Canonical URL */}
        {metaData.canonicalUrl && (
          <link rel="canonical" href={metaData.canonicalUrl} />
        )}

        {/* Language and Locale */}
        <meta httpEquiv="content-language" content="en-US" />
        <meta name="language" content="English" />

        {/* Open Graph Tags */}
        <meta property="og:title" content={metaData.metaTags['og:title']} />
        <meta property="og:description" content={metaData.metaTags['og:description']} />
        <meta property="og:type" content={metaData.metaTags['og:type']} />
        <meta property="og:url" content={metaData.metaTags['og:url']} />
        <meta property="og:site_name" content={metaData.metaTags['og:site_name']} />
        <meta property="og:locale" content={metaData.metaTags['og:locale']} />
        <meta property="og:image" content={metaData.metaTags['og:image']} />
        <meta property="og:image:width" content={metaData.metaTags['og:image:width']} />
        <meta property="og:image:height" content={metaData.metaTags['og:image:height']} />
        <meta property="og:image:alt" content={metaData.metaTags['og:image:alt']} />

        {/* Twitter Card Tags */}
        <meta name="twitter:card" content={metaData.metaTags['twitter:card']} />
        <meta name="twitter:site" content={metaData.metaTags['twitter:site']} />
        <meta name="twitter:creator" content={metaData.metaTags['twitter:creator']} />
        <meta name="twitter:title" content={metaData.metaTags['twitter:title']} />
        <meta name="twitter:description" content={metaData.metaTags['twitter:description']} />
        <meta name="twitter:image" content={metaData.metaTags['twitter:image']} />

        {/* Article Tags (if applicable) */}
        {publishedTime && (
          <meta property="article:published_time" content={publishedTime} />
        )}
        {modifiedTime && (
          <meta property="article:modified_time" content={modifiedTime} />
        )}
        {author && (
          <meta property="article:author" content={author} />
        )}
        {category && (
          <meta property="article:section" content={category} />
        )}
        {tags.map((tag, index) => (
          <meta key={index} property="article:tag" content={tag} />
        ))}

        {/* Tax-specific Meta Tags */}
        {taxYear && <meta name="tax:year" content={taxYear} />}
        {country && <meta name="tax:country" content={country} />}
        {state && <meta name="tax:state" content={state} />}
        {city && <meta name="tax:city" content={city} />}
        {calculator?.type && <meta name="tax:calculator_type" content={calculator.type} />}

        {/* Mobile and App Tags */}
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="GlobalTaxCalc" />
        <meta name="application-name" content="GlobalTaxCalc" />
        <meta name="theme-color" content="#667eea" />
        <meta name="msapplication-TileColor" content="#667eea" />

        {/* Favicon and Icons */}
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />

        {/* DNS Prefetch for External Resources */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//www.google-analytics.com" />
        <link rel="dns-prefetch" href="//www.googletagmanager.com" />
        <link rel="dns-prefetch" href="//api.globaltaxcalc.com" />

        {/* Preconnect for Critical Third-party Resources */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* Hreflang Links */}
        {generateHreflangLinks()}

        {/* Preload Links for Performance */}
        {generatePreloadLinks()}

        {/* Critical CSS Inline */}
        {criticalCSS && (
          <style dangerouslySetInnerHTML={{ __html: criticalCSS }} />
        )}

        {/* Next.js specific meta tags */}
        <meta name="next-head-count" content="auto" />

        {/* Security Headers */}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="X-Frame-Options" content="DENY" />
        <meta httpEquiv="X-XSS-Protection" content="1; mode=block" />
        <meta httpEquiv="Referrer-Policy" content="strict-origin-when-cross-origin" />

        {/* Performance Hints */}
        <meta httpEquiv="X-DNS-Prefetch-Control" content="on" />

        {/* Schema.org Structured Data will be injected by useEffect */}
      </Head>

      {/* Page Content */}
      <main role="main">
        {children}
      </main>

      {/* Schema.org Structured Data Scripts are injected via JavaScript */}
    </>
  );
};

export default SEOLayout;