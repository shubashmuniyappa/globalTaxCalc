const config = require('../config');
const axios = require('axios');
const { GoogleAds } = require('google-ads-api');
const { google } = require('googleapis');
const Redis = require('ioredis');

class AdNetworkService {
  constructor() {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.cacheDb
    });

    this.networks = new Map();
    this.performanceCache = new Map();
    this.init();
  }

  async init() {
    await this.initializeGoogleAdSense();
    await this.initializeMediaNet();
    await this.initializeDirectAdvertisers();
    await this.loadNetworkPerformance();
  }

  async initializeGoogleAdSense() {
    try {
      if (!config.adNetworks.googleAdsense.serviceAccount.clientEmail) {
        console.warn('Google AdSense service account not configured');
        return;
      }

      const auth = new google.auth.JWT(
        config.adNetworks.googleAdsense.serviceAccount.clientEmail,
        null,
        config.adNetworks.googleAdsense.serviceAccount.privateKey,
        ['https://www.googleapis.com/auth/adsense.readonly']
      );

      await auth.authorize();

      const adsenseClient = {
        auth,
        clientId: config.adNetworks.googleAdsense.clientId,
        slotIds: config.adNetworks.googleAdsense.slotIds
      };

      this.networks.set('adsense', {
        name: 'Google AdSense',
        client: adsenseClient,
        status: 'active',
        fillRate: 0.85,
        rpm: 2.5,
        latency: 120,
        priority: 1
      });

      console.log('Google AdSense initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Google AdSense:', error);
      this.networks.set('adsense', {
        name: 'Google AdSense',
        status: 'error',
        error: error.message
      });
    }
  }

  async initializeMediaNet() {
    try {
      if (!config.adNetworks.medianet.siteId) {
        console.warn('Media.net not configured');
        return;
      }

      const medianetClient = {
        siteId: config.adNetworks.medianet.siteId,
        customerId: config.adNetworks.medianet.customerId,
        apiKey: config.adNetworks.medianet.apiKey,
        endpoint: 'https://contextual.media.net/adserver/adrequest'
      };

      this.networks.set('medianet', {
        name: 'Media.net',
        client: medianetClient,
        status: 'active',
        fillRate: 0.70,
        rpm: 2.0,
        latency: 150,
        priority: 2
      });

      console.log('Media.net initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Media.net:', error);
      this.networks.set('medianet', {
        name: 'Media.net',
        status: 'error',
        error: error.message
      });
    }
  }

  async initializeDirectAdvertisers() {
    try {
      if (!config.adNetworks.directAdvertisers.apiEndpoint) {
        console.warn('Direct advertisers not configured');
        return;
      }

      const directClient = {
        endpoint: config.adNetworks.directAdvertisers.apiEndpoint,
        secret: config.adNetworks.directAdvertisers.secret
      };

      this.networks.set('direct', {
        name: 'Direct Advertisers',
        client: directClient,
        status: 'active',
        fillRate: 0.60,
        rpm: 3.0,
        latency: 100,
        priority: 3
      });

      console.log('Direct advertisers initialized successfully');
    } catch (error) {
      console.error('Failed to initialize direct advertisers:', error);
      this.networks.set('direct', {
        name: 'Direct Advertisers',
        status: 'error',
        error: error.message
      });
    }
  }

  async getAdFromNetwork(networkName, placement, context) {
    const network = this.networks.get(networkName);
    if (!network || network.status !== 'active') {
      throw new Error(`Network ${networkName} not available`);
    }

    const startTime = Date.now();

    try {
      let adData;

      switch (networkName) {
        case 'adsense':
          adData = await this.getAdSenseAd(network, placement, context);
          break;
        case 'medianet':
          adData = await this.getMediaNetAd(network, placement, context);
          break;
        case 'direct':
          adData = await this.getDirectAd(network, placement, context);
          break;
        default:
          throw new Error(`Unknown network: ${networkName}`);
      }

      const latency = Date.now() - startTime;

      // Update network performance
      await this.updateNetworkPerformance(networkName, {
        latency,
        success: true,
        timestamp: Date.now()
      });

      return {
        ...adData,
        network: networkName,
        latency
      };

    } catch (error) {
      const latency = Date.now() - startTime;

      await this.updateNetworkPerformance(networkName, {
        latency,
        success: false,
        error: error.message,
        timestamp: Date.now()
      });

      throw error;
    }
  }

  async getAdSenseAd(network, placement, context) {
    const slotId = this.getAdSenseSlotId(placement.type);

    if (!slotId) {
      throw new Error('No AdSense slot configured for placement type');
    }

    // Generate AdSense ad tag
    const adTag = this.generateAdSenseTag({
      clientId: network.client.clientId,
      slotId: slotId,
      size: placement.size,
      targeting: placement.targeting,
      context: context
    });

    return {
      type: 'script_tag',
      content: adTag,
      size: placement.size,
      slotId: slotId,
      refreshable: true,
      viewabilityTracking: true
    };
  }

  getAdSenseSlotId(placementType) {
    const slotIds = this.networks.get('adsense')?.client?.slotIds;
    if (!slotIds) return null;

    switch (placementType) {
      case 'banner':
        return slotIds.banner;
      case 'native':
        return slotIds.native;
      case 'mobile_banner':
        return slotIds.mobile;
      default:
        return slotIds.banner;
    }
  }

  generateAdSenseTag({ clientId, slotId, size, targeting, context }) {
    const adUnitPath = `${clientId}/${slotId}`;

    const script = `
      <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}" crossorigin="anonymous"></script>
      <ins class="adsbygoogle"
           style="display:inline-block;width:${size.width}px;height:${size.height}px"
           data-ad-client="${clientId}"
           data-ad-slot="${slotId}"
           ${targeting.keywords?.length ? `data-ad-test="on"` : ''}
           ${context.country ? `data-ad-region="${context.country}"` : ''}></ins>
      <script>
        (adsbygoogle = window.adsbygoogle || []).push({
          google_ad_client: "${clientId}",
          enable_page_level_ads: true,
          ${targeting.keywords?.length ? `google_ad_channel: "${targeting.keywords.join(',')}"` : ''}
        });
      </script>
    `;

    return script.trim();
  }

  async getMediaNetAd(network, placement, context) {
    const requestData = {
      site_id: network.client.siteId,
      customer_id: network.client.customerId,
      size: `${placement.size.width}x${placement.size.height}`,
      ad_type: placement.type,
      country: context.country,
      device: context.device,
      keywords: placement.targeting.keywords || [],
      categories: placement.targeting.categories || [],
      url: context.url || 'https://globaltaxcalc.com'
    };

    try {
      const response = await axios.post(network.client.endpoint, requestData, {
        headers: {
          'Authorization': `Bearer ${network.client.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: config.performance.adLoadTimeout
      });

      if (response.data && response.data.ad) {
        return {
          type: 'html_content',
          content: response.data.ad.html,
          size: placement.size,
          clickUrl: response.data.ad.click_url,
          impressionUrl: response.data.ad.impression_url,
          refreshable: false
        };
      } else {
        throw new Error('No ad returned from Media.net');
      }

    } catch (error) {
      if (error.response?.status === 204) {
        throw new Error('No fill from Media.net');
      }
      throw new Error(`Media.net request failed: ${error.message}`);
    }
  }

  async getDirectAd(network, placement, context) {
    // Check for direct advertiser campaigns
    const campaigns = await this.getActiveCampaigns(context);

    if (campaigns.length === 0) {
      throw new Error('No active direct campaigns');
    }

    // Select best campaign based on targeting and bid
    const selectedCampaign = this.selectBestCampaign(campaigns, placement, context);

    if (!selectedCampaign) {
      throw new Error('No matching direct campaigns');
    }

    return {
      type: 'html_content',
      content: selectedCampaign.creative.html,
      size: placement.size,
      clickUrl: selectedCampaign.clickUrl,
      impressionUrl: selectedCampaign.impressionUrl,
      campaignId: selectedCampaign.id,
      refreshable: true
    };
  }

  async getActiveCampaigns(context) {
    const cacheKey = `direct_campaigns:${context.country}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // Mock direct campaigns - in production, this would call the direct advertisers API
    const campaigns = [
      {
        id: 'tax_software_001',
        name: 'Premium Tax Software',
        bid: 2.50,
        targeting: {
          countries: ['US', 'CA'],
          calculatorTypes: ['income_tax', 'business_tax'],
          devices: ['desktop', 'tablet']
        },
        creative: {
          html: `
            <div class="direct-ad" style="width:300px;height:250px;border:1px solid #ddd;padding:20px;text-align:center;">
              <img src="https://cdn.globaltaxcalc.com/ads/tax-software-logo.png" alt="Tax Software" style="width:100px;">
              <h3>Professional Tax Software</h3>
              <p>File your taxes with confidence. Get started for free!</p>
              <button style="background:#007cba;color:white;padding:10px 20px;border:none;border-radius:5px;">Try Now</button>
            </div>
          `
        },
        clickUrl: 'https://partner.taxsoftware.com/signup?ref=globaltaxcalc',
        impressionUrl: 'https://track.globaltaxcalc.com/impression/tax_software_001'
      },
      {
        id: 'accounting_service_002',
        name: 'Accounting Services',
        bid: 3.00,
        targeting: {
          countries: ['US', 'CA', 'UK'],
          calculatorTypes: ['business_tax'],
          devices: ['desktop']
        },
        creative: {
          html: `
            <div class="direct-ad" style="width:728px;height:90px;background:#f8f9fa;border:1px solid #e9ecef;display:flex;align-items:center;padding:0 20px;">
              <img src="https://cdn.globaltaxcalc.com/ads/accounting-logo.png" alt="Accounting" style="width:60px;height:60px;">
              <div style="margin-left:15px;">
                <h4 style="margin:0;color:#333;">Professional Accounting Services</h4>
                <p style="margin:5px 0 0 0;color:#666;">Expert tax preparation and business consulting</p>
              </div>
              <button style="background:#28a745;color:white;padding:8px 16px;border:none;border-radius:4px;margin-left:auto;">Get Quote</button>
            </div>
          `
        },
        clickUrl: 'https://partner.accounting.com/quote?ref=globaltaxcalc',
        impressionUrl: 'https://track.globaltaxcalc.com/impression/accounting_service_002'
      }
    ];

    await this.redis.setex(cacheKey, 1800, JSON.stringify(campaigns));
    return campaigns;
  }

  selectBestCampaign(campaigns, placement, context) {
    const eligibleCampaigns = campaigns.filter(campaign => {
      const targeting = campaign.targeting;

      // Country targeting
      if (targeting.countries && !targeting.countries.includes(context.country)) {
        return false;
      }

      // Calculator type targeting
      if (targeting.calculatorTypes && context.calculatorType &&
          !targeting.calculatorTypes.includes(context.calculatorType)) {
        return false;
      }

      // Device targeting
      if (targeting.devices && !targeting.devices.includes(context.device)) {
        return false;
      }

      return true;
    });

    if (eligibleCampaigns.length === 0) {
      return null;
    }

    // Select highest bidding campaign
    return eligibleCampaigns.reduce((best, current) =>
      current.bid > best.bid ? current : best
    );
  }

  async selectBestNetwork(placement, context, excludeNetworks = []) {
    const availableNetworks = Array.from(this.networks.entries())
      .filter(([name, network]) =>
        network.status === 'active' &&
        !excludeNetworks.includes(name)
      );

    if (availableNetworks.length === 0) {
      throw new Error('No available ad networks');
    }

    // Score networks based on performance and targeting
    const scoredNetworks = await Promise.all(
      availableNetworks.map(async ([name, network]) => {
        const score = await this.calculateNetworkScore(name, network, placement, context);
        return { name, network, score };
      })
    );

    // Sort by score (highest first)
    scoredNetworks.sort((a, b) => b.score - a.score);

    return scoredNetworks[0].name;
  }

  async calculateNetworkScore(networkName, network, placement, context) {
    let score = 0;

    // Base score from network priority
    score += (4 - network.priority) * 10;

    // Performance metrics
    const performance = await this.getNetworkPerformance(networkName);
    score += performance.fillRate * 50;
    score += performance.rpm * 10;
    score -= (performance.latency / 1000) * 5; // Penalty for high latency

    // Geographic performance
    const geoPerformance = await this.getGeoPerformance(networkName, context.country);
    score += geoPerformance.multiplier * 20;

    // Contextual relevance
    if (context.calculatorType) {
      const contextualBonus = this.getContextualBonus(networkName, context.calculatorType);
      score += contextualBonus;
    }

    // Time-based adjustments
    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 17) {
      score *= 1.1; // Business hours boost
    }

    return Math.max(0, score);
  }

  getContextualBonus(networkName, calculatorType) {
    const bonuses = {
      adsense: {
        income_tax: 10,
        business_tax: 8,
        sales_tax: 6,
        property_tax: 5
      },
      medianet: {
        income_tax: 8,
        business_tax: 10,
        sales_tax: 8,
        property_tax: 6
      },
      direct: {
        income_tax: 15,
        business_tax: 20,
        sales_tax: 5,
        property_tax: 8
      }
    };

    return bonuses[networkName]?.[calculatorType] || 0;
  }

  async getNetworkPerformance(networkName) {
    const cacheKey = `network_performance:${networkName}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // Default performance data
    const network = this.networks.get(networkName);
    const performance = {
      fillRate: network?.fillRate || 0.5,
      rpm: network?.rpm || 1.0,
      latency: network?.latency || 200,
      ctr: 0.015,
      viewability: 0.75
    };

    await this.redis.setex(cacheKey, 1800, JSON.stringify(performance));
    return performance;
  }

  async getGeoPerformance(networkName, country) {
    const geoData = config.geographic.geoTargeting[country];
    const isHighValue = config.geographic.highValueCountries.includes(country);

    return {
      multiplier: isHighValue ? 1.5 : 1.0,
      rpm: geoData?.rpm || 1.0,
      fillRate: geoData?.fillRate || 0.7
    };
  }

  async updateNetworkPerformance(networkName, metrics) {
    const cacheKey = `network_performance:${networkName}:recent`;
    const recentMetrics = await this.redis.get(cacheKey);

    let updatedMetrics = metrics;
    if (recentMetrics) {
      const parsed = JSON.parse(recentMetrics);
      // Exponential moving average
      updatedMetrics = {
        latency: (parsed.latency * 0.8) + (metrics.latency * 0.2),
        success: metrics.success,
        timestamp: metrics.timestamp
      };
    }

    await this.redis.setex(cacheKey, 3600, JSON.stringify(updatedMetrics));
  }

  async loadNetworkPerformance() {
    // Load historical performance data
    for (const [networkName] of this.networks.entries()) {
      await this.getNetworkPerformance(networkName);
    }
  }

  async getNetworkStatus() {
    const status = {};

    for (const [name, network] of this.networks.entries()) {
      const performance = await this.getNetworkPerformance(name);

      status[name] = {
        name: network.name,
        status: network.status,
        fillRate: performance.fillRate,
        rpm: performance.rpm,
        latency: performance.latency,
        lastUpdate: Date.now()
      };
    }

    return status;
  }

  async healthCheck() {
    const networkCount = this.networks.size;
    const activeNetworks = Array.from(this.networks.values())
      .filter(network => network.status === 'active').length;

    return {
      status: activeNetworks > 0 ? 'healthy' : 'unhealthy',
      totalNetworks: networkCount,
      activeNetworks: activeNetworks,
      networks: await this.getNetworkStatus()
    };
  }
}

module.exports = new AdNetworkService();