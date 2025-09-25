/**
 * Local SEO Provider Component
 *
 * Provides location-aware SEO optimization and content management
 * for geographic targeting across countries, states, and cities.
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  LocalSEOGenerator,
  LocationDetector,
  COUNTRIES
} from '../../lib/seo/local-seo';

// Location Context
const LocationContext = createContext();

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};

// Location Provider Component
export const LocationProvider = ({ children, initialLocation = null }) => {
  const router = useRouter();
  const [location, setLocation] = useState(initialLocation);
  const [detectedLocation, setDetectedLocation] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [locationPreference, setLocationPreference] = useState(null);

  // Parse location from URL
  useEffect(() => {
    const pathSegments = router.asPath.split('/').filter(Boolean);

    if (pathSegments.length > 0) {
      const country = pathSegments[0];
      const state = pathSegments[1];
      const city = pathSegments[2];

      // Validate country exists in our configuration
      if (COUNTRIES[country]) {
        const newLocation = { country };

        // Validate state/province
        if (state && COUNTRIES[country].states?.[state]) {
          newLocation.state = state;

          // Validate city
          if (city && COUNTRIES[country].states[state].cities?.includes(city)) {
            newLocation.city = city;
          }
        } else if (state && COUNTRIES[country].provinces?.[state]) {
          newLocation.province = state;
        }

        setLocation(newLocation);
      }
    }
  }, [router.asPath]);

  // Detect user location on initial load
  useEffect(() => {
    const detectLocation = async () => {
      setIsDetecting(true);
      try {
        // Check for stored preference first
        const preference = LocationDetector.getUserPreferredLocation();
        if (preference) {
          setLocationPreference(preference);
        }

        // Detect current location
        const detected = await LocationDetector.detectUserLocation();
        setDetectedLocation(detected);
      } catch (error) {
        console.warn('Location detection failed:', error);
      } finally {
        setIsDetecting(false);
      }
    };

    detectLocation();
  }, []);

  // Update location preference
  const updateLocationPreference = (newLocation) => {
    setLocationPreference(newLocation);
    LocationDetector.setUserPreferredLocation(newLocation);

    // Optionally redirect to the preferred location
    if (newLocation && newLocation !== location) {
      const path = router.pathname.replace('[country]', newLocation.country)
        .replace('[state]', newLocation.state || '')
        .replace('[city]', newLocation.city || '');

      router.push(path);
    }
  };

  // Get current effective location (URL > preference > detected > default)
  const getEffectiveLocation = () => {
    return location || locationPreference || detectedLocation || { country: 'united-states' };
  };

  const value = {
    location: getEffectiveLocation(),
    urlLocation: location,
    detectedLocation,
    locationPreference,
    isDetecting,
    updateLocationPreference,
    countries: COUNTRIES
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};

// Location Selector Component
export const LocationSelector = ({
  onLocationChange,
  showDetectedLocation = true,
  className = '',
  variant = 'dropdown' // 'dropdown', 'cards', 'list'
}) => {
  const { location, detectedLocation, updateLocationPreference, countries } = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const handleLocationSelect = (newLocation) => {
    updateLocationPreference(newLocation);
    if (onLocationChange) {
      onLocationChange(newLocation);
    }
    setIsOpen(false);
  };

  if (variant === 'dropdown') {
    return (
      <div className={`location-selector ${className}`}>
        <button
          className="location-selector-trigger"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <span className="location-flag">
            {location.country === 'united-states' ? '🇺🇸' :
             location.country === 'canada' ? '🇨🇦' :
             location.country === 'united-kingdom' ? '🇬🇧' :
             location.country === 'australia' ? '🇦🇺' : '🌍'}
          </span>
          <span className="location-name">
            {countries[location.country]?.name || 'Select Location'}
          </span>
          <span className="location-arrow">▼</span>
        </button>

        {isOpen && (
          <div className="location-dropdown">
            {showDetectedLocation && detectedLocation && detectedLocation !== location && (
              <div className="location-section">
                <div className="location-section-title">Detected Location</div>
                <button
                  className="location-option detected"
                  onClick={() => handleLocationSelect(detectedLocation)}
                >
                  <span className="location-flag">
                    {detectedLocation.country === 'united-states' ? '🇺🇸' :
                     detectedLocation.country === 'canada' ? '🇨🇦' :
                     detectedLocation.country === 'united-kingdom' ? '🇬🇧' :
                     detectedLocation.country === 'australia' ? '🇦🇺' : '🌍'}
                  </span>
                  <span className="location-text">
                    {countries[detectedLocation.country]?.name}
                    {detectedLocation.state && countries[detectedLocation.country]?.states?.[detectedLocation.state] &&
                      `, ${countries[detectedLocation.country].states[detectedLocation.state].name}`
                    }
                  </span>
                  <span className="location-badge">Auto-detected</span>
                </button>
              </div>
            )}

            <div className="location-section">
              <div className="location-section-title">All Locations</div>
              {Object.entries(countries).map(([countryCode, countryData]) => (
                <div key={countryCode} className="country-group">
                  <button
                    className={`location-option ${location.country === countryCode ? 'selected' : ''}`}
                    onClick={() => handleLocationSelect({ country: countryCode })}
                  >
                    <span className="location-flag">
                      {countryCode === 'united-states' ? '🇺🇸' :
                       countryCode === 'canada' ? '🇨🇦' :
                       countryCode === 'united-kingdom' ? '🇬🇧' :
                       countryCode === 'australia' ? '🇦🇺' : '🌍'}
                    </span>
                    <span className="location-text">{countryData.name}</span>
                  </button>

                  {/* Show states/provinces if country is selected */}
                  {location.country === countryCode && (countryData.states || countryData.provinces) && (
                    <div className="states-list">
                      {Object.entries(countryData.states || countryData.provinces).map(([stateCode, stateData]) => (
                        <button
                          key={stateCode}
                          className={`location-option state ${(location.state || location.province) === stateCode ? 'selected' : ''}`}
                          onClick={() => handleLocationSelect({
                            country: countryCode,
                            [countryData.states ? 'state' : 'province']: stateCode
                          })}
                        >
                          <span className="location-text">{stateData.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Card variant for more prominent display
  if (variant === 'cards') {
    return (
      <div className={`location-cards ${className}`}>
        <h3 className="location-cards-title">Choose Your Location</h3>
        <div className="location-cards-grid">
          {Object.entries(countries).map(([countryCode, countryData]) => (
            <button
              key={countryCode}
              className={`location-card ${location.country === countryCode ? 'selected' : ''}`}
              onClick={() => handleLocationSelect({ country: countryCode })}
            >
              <div className="location-card-flag">
                {countryCode === 'united-states' ? '🇺🇸' :
                 countryCode === 'canada' ? '🇨🇦' :
                 countryCode === 'united-kingdom' ? '🇬🇧' :
                 countryCode === 'australia' ? '🇦🇺' : '🌍'}
              </div>
              <div className="location-card-content">
                <h4 className="location-card-name">{countryData.name}</h4>
                <p className="location-card-currency">Currency: {countryData.currency}</p>
                <p className="location-card-tax-year">Tax Year End: {countryData.taxYearEnd}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return null;
};

// Local SEO Head Component
export const LocalSEOHead = ({
  calculatorType,
  customMeta = {},
  children
}) => {
  const { location } = useLocation();
  const router = useRouter();

  // Generate local SEO meta data
  const localMeta = LocalSEOGenerator.generateLocalMeta(
    calculatorType,
    location,
    customMeta
  );

  // Generate structured data
  const localBusinessSchema = LocalSEOGenerator.generateLocalBusinessSchema(location);
  const calculatorSchema = LocalSEOGenerator.generateLocalCalculatorSchema(
    calculatorType,
    location
  );

  // Generate hreflang tags for available locations
  const availableLocations = [];
  Object.keys(COUNTRIES).forEach(country => {
    availableLocations.push({ country });

    const countryConfig = COUNTRIES[country];
    if (countryConfig.states) {
      Object.keys(countryConfig.states).forEach(state => {
        availableLocations.push({ country, state });
      });
    }
  });

  const hreflangTags = LocalSEOGenerator.generateHreflangTags(
    router.pathname,
    availableLocations
  );

  if (!localMeta) return <>{children}</>;

  return (
    <Head>
      {/* Basic Meta Tags */}
      <title>{localMeta.title}</title>
      <meta name="description" content={localMeta.description} />
      <meta name="keywords" content={localMeta.keywords.join(', ')} />
      <link rel="canonical" href={`https://globaltaxcalc.com${localMeta.canonical}`} />

      {/* Geographic Meta Tags */}
      <meta name="geo.region" content={location.country.toUpperCase()} />
      {location.state && (
        <meta name="geo.placename" content={COUNTRIES[location.country]?.states?.[location.state]?.name} />
      )}

      {/* Language and Locale */}
      <meta httpEquiv="content-language" content={COUNTRIES[location.country]?.language || 'en-US'} />

      {/* Open Graph Tags */}
      <meta property="og:title" content={localMeta.openGraph.title} />
      <meta property="og:description" content={localMeta.openGraph.description} />
      <meta property="og:type" content={localMeta.openGraph.type} />
      <meta property="og:locale" content={localMeta.openGraph.locale} />
      <meta property="og:site_name" content={localMeta.openGraph.site_name} />
      <meta property="og:url" content={`https://globaltaxcalc.com${localMeta.canonical}`} />

      {/* Twitter Card Tags */}
      <meta name="twitter:card" content={localMeta.twitter.card} />
      <meta name="twitter:title" content={localMeta.twitter.title} />
      <meta name="twitter:description" content={localMeta.twitter.description} />

      {/* Hreflang Tags */}
      {hreflangTags.map((tag, index) => (
        <link
          key={index}
          rel={tag.rel}
          hreflang={tag.hreflang}
          href={tag.href}
        />
      ))}

      {/* Structured Data */}
      {localBusinessSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(localBusinessSchema)
          }}
        />
      )}

      {calculatorSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(calculatorSchema)
          }}
        />
      )}

      {children}
    </Head>
  );
};

// Location Banner Component
export const LocationBanner = ({
  showChangeLocation = true,
  className = ''
}) => {
  const { location, detectedLocation, locationPreference } = useLocation();
  const [isVisible, setIsVisible] = useState(false);

  // Show banner if detected location differs from current location
  useEffect(() => {
    if (detectedLocation &&
        detectedLocation.country !== location.country &&
        !locationPreference) {
      setIsVisible(true);
    }
  }, [detectedLocation, location, locationPreference]);

  if (!isVisible || !detectedLocation) return null;

  const detectedLocationName = COUNTRIES[detectedLocation.country]?.name;

  return (
    <div className={`location-banner ${className}`}>
      <div className="location-banner-content">
        <div className="location-banner-text">
          <span className="location-banner-icon">📍</span>
          <span>
            It looks like you're in {detectedLocationName}.
            Would you like to see tax information for your location?
          </span>
        </div>

        {showChangeLocation && (
          <div className="location-banner-actions">
            <LocationSelector
              variant="dropdown"
              className="location-banner-selector"
            />
            <button
              className="location-banner-dismiss"
              onClick={() => setIsVisible(false)}
              aria-label="Dismiss location banner"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default {
  LocationProvider,
  LocationSelector,
  LocalSEOHead,
  LocationBanner,
  useLocation
};