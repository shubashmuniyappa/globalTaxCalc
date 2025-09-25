/**
 * Location Detection API Endpoint
 *
 * Detects user location for geographic SEO targeting and
 * automatic location-based content serving.
 */

import { COUNTRIES } from '../../../lib/seo/local-seo';

// IP geolocation service configurations
const GEOLOCATION_SERVICES = {
  cloudflare: {
    enabled: true,
    headers: ['CF-IPCountry', 'CF-IPCity', 'CF-Region']
  },
  maxmind: {
    enabled: false, // Requires API key
    endpoint: 'https://geoip.maxmind.com/geoip/v2.1/city'
  },
  ipapi: {
    enabled: false, // Requires API key
    endpoint: 'https://ipapi.co'
  }
};

// Fallback IP geolocation using public service
async function detectLocationFromIP(ip, req) {
  try {
    // Try Cloudflare headers first (if available)
    if (req.headers['cf-ipcountry']) {
      const country = req.headers['cf-ipcountry'].toLowerCase();
      const region = req.headers['cf-region'];
      const city = req.headers['cf-ipcity'];

      return {
        country: mapCountryCode(country),
        state: region ? region.toLowerCase().replace(/\s+/g, '-') : null,
        city: city ? city.toLowerCase().replace(/\s+/g, '-') : null,
        source: 'cloudflare'
      };
    }

    // Fallback to free IP geolocation service
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,countryCode`);
    const data = await response.json();

    if (data.status === 'success') {
      return {
        country: mapCountryCode(data.countryCode.toLowerCase()),
        state: data.regionName ? data.regionName.toLowerCase().replace(/\s+/g, '-') : null,
        city: data.city ? data.city.toLowerCase().replace(/\s+/g, '-') : null,
        source: 'ip-api'
      };
    }

    return null;
  } catch (error) {
    console.warn('IP geolocation failed:', error);
    return null;
  }
}

// Map country codes to our supported countries
function mapCountryCode(countryCode) {
  const countryMap = {
    'us': 'united-states',
    'usa': 'united-states',
    'ca': 'canada',
    'can': 'canada',
    'gb': 'united-kingdom',
    'uk': 'united-kingdom',
    'au': 'australia',
    'aus': 'australia'
  };

  const mapped = countryMap[countryCode.toLowerCase()];
  return COUNTRIES[mapped] ? mapped : 'united-states'; // Default fallback
}

// Validate and normalize detected location
function normalizeLocation(location) {
  if (!location || !location.country) {
    return { country: 'united-states' };
  }

  const countryConfig = COUNTRIES[location.country];
  if (!countryConfig) {
    return { country: 'united-states' };
  }

  const normalized = { country: location.country };

  // Validate state/province
  if (location.state && countryConfig.states) {
    if (countryConfig.states[location.state]) {
      normalized.state = location.state;

      // Validate city
      if (location.city && countryConfig.states[location.state].cities) {
        if (countryConfig.states[location.state].cities.includes(location.city)) {
          normalized.city = location.city;
        }
      }
    }
  } else if (location.province && countryConfig.provinces) {
    if (countryConfig.provinces[location.province]) {
      normalized.province = location.province;
    }
  }

  return normalized;
}

// Get user's IP address
function getClientIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.headers['x-real-ip'] ||
    req.headers['x-client-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    '127.0.0.1'
  );
}

// Detect location from timezone
function detectLocationFromTimezone(timezone) {
  if (!timezone) return null;

  const timezoneMap = {
    'America/New_York': { country: 'united-states', state: 'new-york' },
    'America/Chicago': { country: 'united-states', state: 'illinois' },
    'America/Denver': { country: 'united-states', state: 'colorado' },
    'America/Los_Angeles': { country: 'united-states', state: 'california' },
    'America/Phoenix': { country: 'united-states', state: 'arizona' },
    'America/Toronto': { country: 'canada', province: 'ontario' },
    'America/Vancouver': { country: 'canada', province: 'british-columbia' },
    'Europe/London': { country: 'united-kingdom' },
    'Australia/Sydney': { country: 'australia', state: 'new-south-wales' },
    'Australia/Melbourne': { country: 'australia', state: 'victoria' }
  };

  return timezoneMap[timezone] || null;
}

// Main API handler
export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const ip = getClientIP(req);
    const timezone = req.query.timezone;
    const userAgent = req.headers['user-agent'] || '';

    // Try multiple detection methods
    const detectionMethods = [
      detectLocationFromIP(ip, req),
      Promise.resolve(detectLocationFromTimezone(timezone))
    ];

    const results = await Promise.allSettled(detectionMethods);

    // Find the first successful result
    let detectedLocation = null;
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        detectedLocation = result.value;
        break;
      }
    }

    // Normalize and validate the location
    const normalizedLocation = normalizeLocation(detectedLocation);

    // Add confidence score based on detection method
    let confidence = 0.5; // Default confidence
    if (detectedLocation?.source === 'cloudflare') {
      confidence = 0.9;
    } else if (detectedLocation?.source === 'ip-api') {
      confidence = 0.7;
    } else if (detectedLocation?.source === 'timezone') {
      confidence = 0.6;
    }

    // Get country configuration for additional info
    const countryConfig = COUNTRIES[normalizedLocation.country];

    const response = {
      success: true,
      location: normalizedLocation,
      confidence,
      countryInfo: countryConfig ? {
        name: countryConfig.name,
        currency: countryConfig.currency,
        taxYearEnd: countryConfig.taxYearEnd,
        language: countryConfig.language,
        timeZone: countryConfig.timeZone
      } : null,
      metadata: {
        detectionMethod: detectedLocation?.source || 'fallback',
        timestamp: new Date().toISOString(),
        ip: ip.replace(/\d+$/, 'XXX'), // Partially mask IP for privacy
        timezone: timezone
      }
    };

    // Set appropriate cache headers
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600'); // Cache for 1 hour
    res.setHeader('Vary', 'CF-IPCountry, X-Forwarded-For');

    return res.status(200).json(response);

  } catch (error) {
    console.error('Location detection error:', error);

    // Return fallback location on error
    return res.status(200).json({
      success: false,
      location: { country: 'united-states' },
      confidence: 0.1,
      countryInfo: COUNTRIES['united-states'],
      error: 'Detection failed, using fallback location',
      metadata: {
        detectionMethod: 'fallback',
        timestamp: new Date().toISOString()
      }
    });
  }
}

// Optional: Export location validation utility
export function validateLocation(location) {
  return normalizeLocation(location);
}

// Optional: Export country mapping utility
export function getCountryFromCode(countryCode) {
  return mapCountryCode(countryCode);
}