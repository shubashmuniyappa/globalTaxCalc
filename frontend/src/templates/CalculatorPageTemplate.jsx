/**
 * SEO-Optimized Calculator Page Template
 *
 * Template for all tax calculator pages with comprehensive SEO optimization,
 * structured data, and performance optimizations.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import SEOLayout from '../components/SEO/SEOLayout';
import { generateCalculatorMeta } from '../lib/seo/meta-generator';

// Dynamic imports for better performance
const Calculator = dynamic(() => import('../components/Calculator'), {
  loading: () => <div className="calculator-skeleton">Loading calculator...</div>,
  ssr: false
});

const RelatedCalculators = dynamic(() => import('../components/RelatedCalculators'), {
  loading: () => <div>Loading related tools...</div>
});

const FAQSection = dynamic(() => import('../components/FAQSection'), {
  loading: () => <div>Loading FAQ...</div>
});

const CalculatorPageTemplate = ({
  // Calculator configuration
  calculatorConfig,

  // Location data
  country = 'united-states',
  state = null,
  city = null,

  // Content data
  pageContent,
  faqData = [],
  relatedCalculators = [],

  // SEO data
  customTitle,
  customDescription,
  customKeywords = [],

  // Schema data
  structuredData = {},

  // Performance data
  criticalCSS,
  preloadImages = []
}) => {
  const router = useRouter();
  const [calculatorData, setCalculatorData] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState([]);

  // Extract calculator information
  const {
    name,
    type,
    description,
    features = [],
    lastUpdated,
    taxYear = new Date().getFullYear()
  } = calculatorConfig;

  // Generate location-aware title and description
  const generateLocationAwareContent = () => {
    const locationText = city ? `${city}, ${state}` :
                        state ? state :
                        country === 'united-states' ? 'United States' : country;

    const baseTitle = customTitle || `${name} - ${locationText}`;
    const fullTitle = `${baseTitle} | Free Tax Calculator ${taxYear}`;

    const baseDescription = customDescription ||
      `Calculate your ${locationText.toLowerCase()} taxes with our free ${name.toLowerCase()}. ` +
      `Updated for ${taxYear} tax year. Get accurate results instantly with government-verified calculations.`;

    return { title: fullTitle, description: baseDescription, locationText };
  };

  // Generate comprehensive keywords
  const generateKeywords = (locationText) => {
    const baseKeywords = [
      `${name.toLowerCase()}`,
      `${type} calculator`,
      `${locationText.toLowerCase()} tax calculator`,
      `free ${type} calculator`,
      `online ${type} calculator`,
      `${taxYear} tax calculator`,
      'tax estimation',
      'tax planning'
    ];

    // Add state-specific keywords
    if (state) {
      baseKeywords.push(
        `${state.toLowerCase()} tax`,
        `${state.toLowerCase()} income tax`,
        `${state.toLowerCase()} tax rates`,
        `${state.toLowerCase()} tax brackets`
      );
    }

    // Add city-specific keywords
    if (city) {
      baseKeywords.push(
        `${city.toLowerCase()} tax calculator`,
        `${city.toLowerCase()} tax rates`,
        `${city.toLowerCase()} ${state.toLowerCase()} tax`
      );
    }

    // Add calculator-specific keywords
    if (type === 'income-tax') {
      baseKeywords.push(
        'income tax calculator',
        'federal tax calculator',
        'tax liability calculator',
        'gross to net calculator'
      );
    } else if (type === 'paycheck') {
      baseKeywords.push(
        'paycheck calculator',
        'salary calculator',
        'take home pay calculator',
        'withholding calculator'
      );
    } else if (type === 'tax-refund') {
      baseKeywords.push(
        'tax refund calculator',
        'refund estimator',
        'tax return calculator',
        'refund amount calculator'
      );
    }

    return [...baseKeywords, ...customKeywords];
  };

  // Generate breadcrumbs
  useEffect(() => {
    const crumbs = [
      { name: 'Home', url: '/' },
      { name: 'Calculators', url: '/calculators' }
    ];

    if (country && country !== 'united-states') {
      crumbs.push({
        name: country.charAt(0).toUpperCase() + country.slice(1).replace('-', ' '),
        url: `/${country}`
      });
    }

    if (state) {
      crumbs.push({
        name: state.charAt(0).toUpperCase() + state.slice(1).replace('-', ' '),
        url: `/${country}/${state}`
      });
    }

    if (city) {
      crumbs.push({
        name: city.charAt(0).toUpperCase() + city.slice(1).replace('-', ' '),
        url: `/${country}/${state}/${city}`
      });
    }

    crumbs.push({ name: name, url: router.asPath });

    setBreadcrumbs(crumbs);
  }, [country, state, city, name, router.asPath]);

  // Generate page content
  const { title, description, locationText } = generateLocationAwareContent();
  const keywords = generateKeywords(locationText);

  // Generate calculator-specific FAQ
  const generateCalculatorFAQ = () => {
    const baseFAQ = [
      {
        question: `How accurate is the ${name}?`,
        answer: `Our ${name.toLowerCase()} uses the latest ${taxYear} tax tables and rates from official government sources. The calculations are accurate for estimation purposes, but we recommend consulting a tax professional for complex situations.`
      },
      {
        question: `Is the ${name} free to use?`,
        answer: `Yes, our ${name.toLowerCase()} is completely free to use. You can perform unlimited calculations without any registration or fees.`
      },
      {
        question: `What information do I need to use this calculator?`,
        answer: `You'll need your income information, filing status, and details about deductions and credits. The calculator will guide you through each step.`
      },
      {
        question: `Is my information secure?`,
        answer: `Yes, we take your privacy seriously. All calculations are performed locally in your browser, and we don't store any of your personal financial information.`
      }
    ];

    return [...baseFAQ, ...faqData];
  };

  // Handle calculator interactions
  const handleCalculationComplete = (results) => {
    setCalculatorData(results);

    // Track calculator usage for analytics
    if (typeof gtag !== 'undefined') {
      gtag('event', 'calculator_used', {
        event_category: 'Calculator',
        event_label: `${name} - ${locationText}`,
        calculator_type: type,
        location: locationText
      });
    }
  };

  // Generate schema data for calculator
  const calculatorSchema = {
    name,
    description,
    country,
    url: `https://globaltaxcalc.com${router.asPath}`,
    taxYear,
    features,
    lastUpdated: lastUpdated || new Date().toISOString()
  };

  // Performance optimization: preload related calculator images
  const relatedCalculatorImages = relatedCalculators.map(calc => ({
    href: `/images/calculators/${calc.slug}-thumb.webp`,
    type: 'image/webp'
  }));

  return (
    <SEOLayout
      title={title}
      description={description}
      keywords={keywords}
      canonical={router.asPath}
      calculator={calculatorSchema}
      breadcrumbs={breadcrumbs}
      faq={generateCalculatorFAQ()}
      country={country}
      state={state}
      city={city}
      taxYear={taxYear}
      ogImage={`https://globaltaxcalc.com/images/calculators/${type}-${country}${state ? `-${state}` : ''}-og.png`}
      twitterImage={`https://globaltaxcalc.com/images/calculators/${type}-${country}${state ? `-${state}` : ''}-twitter.png`}
      criticalCSS={criticalCSS}
      preloadImages={[...preloadImages, ...relatedCalculatorImages]}
    >
      {/* Page Header */}
      <div className="calculator-page-header">
        <div className="container">
          {/* Breadcrumb Navigation */}
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <ol className="breadcrumb-list">
              {breadcrumbs.map((crumb, index) => (
                <li key={index} className="breadcrumb-item">
                  {index < breadcrumbs.length - 1 ? (
                    <a href={crumb.url} className="breadcrumb-link">
                      {crumb.name}
                    </a>
                  ) : (
                    <span className="breadcrumb-current" aria-current="page">
                      {crumb.name}
                    </span>
                  )}
                  {index < breadcrumbs.length - 1 && (
                    <span className="breadcrumb-separator" aria-hidden="true">›</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>

          {/* Page Title and Description */}
          <div className="calculator-hero">
            <h1 className="calculator-title">{name}</h1>
            <p className="calculator-subtitle">
              {description} Updated for {taxYear} tax year.
            </p>

            {/* Location Badge */}
            {(state || city) && (
              <div className="location-badge">
                <span className="location-icon">📍</span>
                <span className="location-text">{locationText}</span>
              </div>
            )}

            {/* Calculator Features */}
            {features.length > 0 && (
              <div className="calculator-features">
                <h2 className="features-title">Calculator Features:</h2>
                <ul className="features-list">
                  {features.map((feature, index) => (
                    <li key={index} className="feature-item">
                      <span className="feature-icon">✓</span>
                      <span className="feature-text">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Calculator Section */}
      <section className="calculator-section">
        <div className="container">
          <div className="calculator-container">
            <Calculator
              config={calculatorConfig}
              country={country}
              state={state}
              city={city}
              onCalculationComplete={handleCalculationComplete}
              isCalculating={isCalculating}
              setIsCalculating={setIsCalculating}
            />
          </div>
        </div>
      </section>

      {/* Results Section */}
      {calculatorData && (
        <section className="results-section">
          <div className="container">
            <div className="results-container">
              <h2 className="results-title">Your Tax Calculation Results</h2>
              <div className="results-content">
                {/* Results will be rendered by Calculator component */}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Educational Content */}
      {pageContent && (
        <section className="educational-content">
          <div className="container">
            <div className="content-wrapper">
              <h2 className="content-title">Understanding Your {locationText} Taxes</h2>
              <div
                className="content-body"
                dangerouslySetInnerHTML={{ __html: pageContent }}
              />
            </div>
          </div>
        </section>
      )}

      {/* FAQ Section */}
      <section className="faq-section">
        <div className="container">
          <FAQSection
            faqs={generateCalculatorFAQ()}
            title={`Frequently Asked Questions About ${name}`}
          />
        </div>
      </section>

      {/* Related Calculators */}
      {relatedCalculators.length > 0 && (
        <section className="related-calculators">
          <div className="container">
            <RelatedCalculators
              calculators={relatedCalculators}
              currentCalculator={type}
              country={country}
              state={state}
            />
          </div>
        </section>
      )}

      {/* Trust Signals */}
      <section className="trust-signals">
        <div className="container">
          <div className="trust-content">
            <h2 className="trust-title">Why Choose Our {name}?</h2>
            <div className="trust-features">
              <div className="trust-feature">
                <div className="trust-icon">🔒</div>
                <h3>Secure & Private</h3>
                <p>Your data stays in your browser. We don't store personal information.</p>
              </div>
              <div className="trust-feature">
                <div className="trust-icon">✅</div>
                <h3>Government Verified</h3>
                <p>Calculations based on official {taxYear} tax tables and rates.</p>
              </div>
              <div className="trust-feature">
                <div className="trust-icon">🆓</div>
                <h3>Always Free</h3>
                <p>No hidden fees, no registration required. Completely free to use.</p>
              </div>
              <div className="trust-feature">
                <div className="trust-icon">📱</div>
                <h3>Mobile Friendly</h3>
                <p>Works perfectly on all devices - desktop, tablet, and mobile.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Last Updated Information */}
      <section className="update-info">
        <div className="container">
          <div className="update-content">
            <p className="update-text">
              This calculator was last updated on {new Date(lastUpdated || Date.now()).toLocaleDateString()}
              for the {taxYear} tax year. Tax laws and rates are subject to change.
            </p>
          </div>
        </div>
      </section>
    </SEOLayout>
  );
};

export default CalculatorPageTemplate;