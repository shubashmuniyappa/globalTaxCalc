class ThreatIntelligenceEngine {
    constructor() {
        this.threatFeeds = new Map();
        this.indicators = new Map();
        this.threatActors = new Map();
        this.campaigns = new Map();
        this.riskScores = new Map();
        this.enrichmentSources = new Map();
        this.alertRules = new Map();
        this.huntingQueries = new Map();
        this.blocklists = new Map();
        this.allowlists = new Map();
        this.initializeThreatFeeds();
        this.initializeEnrichmentSources();
        this.initializeHuntingQueries();
    }

    initializeThreatFeeds() {
        // Commercial threat intelligence feeds
        this.threatFeeds.set('misp', {
            name: 'MISP Threat Intelligence',
            type: 'commercial',
            url: 'https://api.misp.org/feeds',
            format: 'json',
            frequency: 3600000, // 1 hour
            apiKey: process.env.MISP_API_KEY,
            categories: ['malware', 'phishing', 'c2', 'reconnaissance'],
            confidence: 0.8,
            lastUpdate: null,
            status: 'active'
        });

        this.threatFeeds.set('virustotal', {
            name: 'VirusTotal Intelligence',
            type: 'commercial',
            url: 'https://www.virustotal.com/vtapi/v2',
            format: 'json',
            frequency: 1800000, // 30 minutes
            apiKey: process.env.VIRUSTOTAL_API_KEY,
            categories: ['malware', 'malicious_url', 'phishing'],
            confidence: 0.9,
            lastUpdate: null,
            status: 'active'
        });

        this.threatFeeds.set('alienvault', {
            name: 'AlienVault OTX',
            type: 'open_source',
            url: 'https://otx.alienvault.com/api/v1',
            format: 'json',
            frequency: 1800000, // 30 minutes
            apiKey: process.env.OTX_API_KEY,
            categories: ['malware', 'phishing', 'scanning', 'reputation'],
            confidence: 0.7,
            lastUpdate: null,
            status: 'active'
        });

        this.threatFeeds.set('threatcrowd', {
            name: 'ThreatCrowd',
            type: 'open_source',
            url: 'https://threatcrowd.org/searchApi/v2',
            format: 'json',
            frequency: 3600000, // 1 hour
            categories: ['malware', 'passive_dns', 'whois'],
            confidence: 0.6,
            lastUpdate: null,
            status: 'active'
        });

        this.threatFeeds.set('abuse_ch', {
            name: 'Abuse.ch',
            type: 'open_source',
            url: 'https://feodotracker.abuse.ch/downloads',
            format: 'csv',
            frequency: 3600000, // 1 hour
            categories: ['botnet', 'malware', 'c2'],
            confidence: 0.9,
            lastUpdate: null,
            status: 'active'
        });

        this.threatFeeds.set('emergingthreats', {
            name: 'Emerging Threats',
            type: 'commercial',
            url: 'https://rules.emergingthreats.net/open',
            format: 'suricata',
            frequency: 7200000, // 2 hours
            categories: ['malware', 'botnet', 'phishing', 'trojan'],
            confidence: 0.8,
            lastUpdate: null,
            status: 'active'
        });

        this.threatFeeds.set('cyber_crime_tracker', {
            name: 'Cyber Crime Tracker',
            type: 'open_source',
            url: 'http://cybercrime-tracker.net/rss.xml',
            format: 'rss',
            frequency: 3600000, // 1 hour
            categories: ['cybercrime', 'botnet', 'malware'],
            confidence: 0.7,
            lastUpdate: null,
            status: 'active'
        });
    }

    initializeEnrichmentSources() {
        // IP and domain enrichment sources
        this.enrichmentSources.set('ip_geolocation', {
            name: 'MaxMind GeoIP',
            type: 'geolocation',
            url: 'https://geoip.maxmind.com/geoip/v2.1',
            apiKey: process.env.MAXMIND_API_KEY,
            rateLimit: 1000, // requests per hour
            enrich: async (indicator) => {
                if (indicator.type === 'ip') {
                    return await this.getIPGeolocation(indicator.value);
                }
                return null;
            }
        });

        this.enrichmentSources.set('domain_whois', {
            name: 'WHOIS Lookup',
            type: 'domain_info',
            url: 'https://api.whoisjson.com/v1',
            rateLimit: 500, // requests per hour
            enrich: async (indicator) => {
                if (indicator.type === 'domain') {
                    return await this.getDomainWHOIS(indicator.value);
                }
                return null;
            }
        });

        this.enrichmentSources.set('url_analysis', {
            name: 'URLVoid',
            type: 'url_reputation',
            url: 'http://api.urlvoid.com/v1',
            apiKey: process.env.URLVOID_API_KEY,
            rateLimit: 200, // requests per hour
            enrich: async (indicator) => {
                if (indicator.type === 'url') {
                    return await this.analyzeURL(indicator.value);
                }
                return null;
            }
        });

        this.enrichmentSources.set('dns_resolution', {
            name: 'DNS Resolution',
            type: 'dns',
            enrich: async (indicator) => {
                if (indicator.type === 'domain' || indicator.type === 'ip') {
                    return await this.performDNSLookup(indicator.value);
                }
                return null;
            }
        });
    }

    initializeHuntingQueries() {
        // Threat hunting queries for common attack patterns
        this.huntingQueries.set('tax_fraud_patterns', {
            name: 'Tax Fraud Pattern Detection',
            description: 'Detect suspicious tax calculation patterns',
            query: `
                SELECT userId, COUNT(*) as calculation_count, AVG(income) as avg_income
                FROM tax_calculations
                WHERE created_at > NOW() - INTERVAL 24 HOUR
                GROUP BY userId
                HAVING calculation_count > 10 OR avg_income > 1000000
            `,
            frequency: 3600000, // 1 hour
            severity: 'medium'
        });

        this.huntingQueries.set('account_takeover_indicators', {
            name: 'Account Takeover Indicators',
            description: 'Detect indicators of account takeover',
            query: `
                SELECT userId, ip_address, user_agent, location
                FROM login_attempts
                WHERE success = true
                AND created_at > NOW() - INTERVAL 1 HOUR
                AND (location_change = true OR device_change = true)
            `,
            frequency: 900000, // 15 minutes
            severity: 'high'
        });

        this.huntingQueries.set('brute_force_attempts', {
            name: 'Brute Force Attack Detection',
            description: 'Detect brute force login attempts',
            query: `
                SELECT ip_address, COUNT(*) as attempt_count
                FROM login_attempts
                WHERE success = false
                AND created_at > NOW() - INTERVAL 1 HOUR
                GROUP BY ip_address
                HAVING attempt_count > 10
            `,
            frequency: 300000, // 5 minutes
            severity: 'high'
        });

        this.huntingQueries.set('data_exfiltration_patterns', {
            name: 'Data Exfiltration Detection',
            description: 'Detect suspicious data access patterns',
            query: `
                SELECT userId, COUNT(*) as access_count,
                       SUM(data_size) as total_data_size
                FROM data_access_logs
                WHERE created_at > NOW() - INTERVAL 2 HOUR
                GROUP BY userId
                HAVING access_count > 50 OR total_data_size > 100000000
            `,
            frequency: 1800000, // 30 minutes
            severity: 'critical'
        });

        this.huntingQueries.set('malicious_file_uploads', {
            name: 'Malicious File Upload Detection',
            description: 'Detect potentially malicious file uploads',
            query: `
                SELECT file_name, file_hash, file_type, ip_address
                FROM file_uploads
                WHERE created_at > NOW() - INTERVAL 1 HOUR
                AND (file_type IN ('exe', 'bat', 'ps1', 'scr')
                     OR file_size > 50000000)
            `,
            frequency: 600000, // 10 minutes
            severity: 'high'
        });
    }

    async startThreatIntelligence() {
        console.log('Starting Threat Intelligence Engine...');

        // Start feed collection
        this.startFeedCollection();

        // Start threat hunting
        this.startThreatHunting();

        // Start indicator enrichment
        this.startIndicatorEnrichment();

        console.log('Threat Intelligence Engine started successfully');
    }

    startFeedCollection() {
        for (const [feedId, feed] of this.threatFeeds) {
            if (feed.status === 'active') {
                // Immediate collection
                this.collectThreatFeed(feedId);

                // Schedule periodic collection
                setInterval(() => {
                    this.collectThreatFeed(feedId);
                }, feed.frequency);
            }
        }
    }

    async collectThreatFeed(feedId) {
        const feed = this.threatFeeds.get(feedId);
        if (!feed) return;

        try {
            console.log(`Collecting threat feed: ${feed.name}`);

            const threatData = await this.fetchFeedData(feed);
            const indicators = await this.parseFeedData(threatData, feed);

            for (const indicator of indicators) {
                await this.processIndicator(indicator, feedId);
            }

            feed.lastUpdate = new Date().toISOString();
            console.log(`Successfully collected ${indicators.length} indicators from ${feed.name}`);

        } catch (error) {
            console.error(`Error collecting feed ${feed.name}:`, error);
            feed.lastError = error.message;
        }
    }

    async fetchFeedData(feed) {
        const headers = {};
        if (feed.apiKey) {
            headers['Authorization'] = `Bearer ${feed.apiKey}`;
        }

        const response = await fetch(feed.url, {
            method: 'GET',
            headers,
            timeout: 30000
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        switch (feed.format) {
            case 'json':
                return await response.json();
            case 'csv':
                return await response.text();
            case 'xml':
            case 'rss':
                return await response.text();
            default:
                return await response.text();
        }
    }

    async parseFeedData(data, feed) {
        const indicators = [];

        try {
            switch (feed.format) {
                case 'json':
                    indicators.push(...this.parseJSONFeed(data, feed));
                    break;
                case 'csv':
                    indicators.push(...this.parseCSVFeed(data, feed));
                    break;
                case 'rss':
                    indicators.push(...this.parseRSSFeed(data, feed));
                    break;
                case 'suricata':
                    indicators.push(...this.parseSuricataRules(data, feed));
                    break;
                default:
                    console.warn(`Unsupported feed format: ${feed.format}`);
            }
        } catch (error) {
            console.error(`Error parsing feed data for ${feed.name}:`, error);
        }

        return indicators;
    }

    parseJSONFeed(data, feed) {
        const indicators = [];

        // Handle different JSON structures
        const items = data.results || data.data || data.indicators || [data];

        for (const item of items) {
            const indicator = this.extractIndicatorFromJSON(item, feed);
            if (indicator) {
                indicators.push(indicator);
            }
        }

        return indicators;
    }

    extractIndicatorFromJSON(item, feed) {
        const indicator = {
            id: this.generateIndicatorId(),
            source: feed.name,
            sourceId: feed.name.toLowerCase().replace(/\s+/g, '_'),
            confidence: feed.confidence,
            firstSeen: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            tags: [...feed.categories]
        };

        // Extract indicator value and type
        if (item.ip || item.ip_address) {
            indicator.type = 'ip';
            indicator.value = item.ip || item.ip_address;
        } else if (item.domain || item.hostname) {
            indicator.type = 'domain';
            indicator.value = item.domain || item.hostname;
        } else if (item.url) {
            indicator.type = 'url';
            indicator.value = item.url;
        } else if (item.hash || item.md5 || item.sha1 || item.sha256) {
            indicator.type = 'hash';
            indicator.value = item.hash || item.md5 || item.sha1 || item.sha256;
        } else if (item.email) {
            indicator.type = 'email';
            indicator.value = item.email;
        } else {
            return null; // Skip unknown indicator types
        }

        // Extract additional metadata
        indicator.description = item.description || item.comment;
        indicator.malwareFamily = item.malware_family || item.family;
        indicator.threatType = item.threat_type || item.type;
        indicator.severity = item.severity || 'medium';

        // Extract timestamps
        if (item.first_seen) {
            indicator.firstSeen = new Date(item.first_seen).toISOString();
        }
        if (item.last_seen) {
            indicator.lastSeen = new Date(item.last_seen).toISOString();
        }

        return indicator;
    }

    parseCSVFeed(data, feed) {
        const indicators = [];
        const lines = data.split('\n');
        let headers = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith('#')) continue;

            const values = line.split(',').map(v => v.trim().replace(/"/g, ''));

            if (i === 0) {
                headers = values;
                continue;
            }

            const indicator = this.extractIndicatorFromCSV(values, headers, feed);
            if (indicator) {
                indicators.push(indicator);
            }
        }

        return indicators;
    }

    extractIndicatorFromCSV(values, headers, feed) {
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index];
        });

        const indicator = {
            id: this.generateIndicatorId(),
            source: feed.name,
            sourceId: feed.name.toLowerCase().replace(/\s+/g, '_'),
            confidence: feed.confidence,
            firstSeen: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            tags: [...feed.categories]
        };

        // Map CSV columns to indicator fields
        const ipColumn = headers.find(h => h.toLowerCase().includes('ip'));
        const domainColumn = headers.find(h => h.toLowerCase().includes('domain'));
        const urlColumn = headers.find(h => h.toLowerCase().includes('url'));

        if (ipColumn && row[ipColumn]) {
            indicator.type = 'ip';
            indicator.value = row[ipColumn];
        } else if (domainColumn && row[domainColumn]) {
            indicator.type = 'domain';
            indicator.value = row[domainColumn];
        } else if (urlColumn && row[urlColumn]) {
            indicator.type = 'url';
            indicator.value = row[urlColumn];
        } else {
            return null;
        }

        return indicator;
    }

    async processIndicator(indicator, sourceId) {
        try {
            // Check if indicator already exists
            const existingIndicator = this.findExistingIndicator(indicator.value, indicator.type);

            if (existingIndicator) {
                // Update existing indicator
                existingIndicator.lastSeen = new Date().toISOString();
                existingIndicator.sources.add(sourceId);
                existingIndicator.confidence = Math.max(existingIndicator.confidence, indicator.confidence);

                // Merge tags
                indicator.tags.forEach(tag => existingIndicator.tags.add(tag));
            } else {
                // Create new indicator
                indicator.sources = new Set([sourceId]);
                indicator.tags = new Set(indicator.tags);
                this.indicators.set(indicator.id, indicator);

                // Enrich indicator
                await this.enrichIndicator(indicator);

                // Check against blocklists/allowlists
                this.checkIndicatorLists(indicator);

                // Generate alerts if necessary
                await this.checkAlertRules(indicator);
            }

        } catch (error) {
            console.error('Error processing indicator:', error);
        }
    }

    findExistingIndicator(value, type) {
        for (const indicator of this.indicators.values()) {
            if (indicator.value === value && indicator.type === type) {
                return indicator;
            }
        }
        return null;
    }

    async enrichIndicator(indicator) {
        const enrichmentPromises = [];

        for (const [sourceId, source] of this.enrichmentSources) {
            try {
                const enrichmentPromise = source.enrich(indicator)
                    .then(enrichment => {
                        if (enrichment) {
                            indicator.enrichment = indicator.enrichment || {};
                            indicator.enrichment[sourceId] = enrichment;
                        }
                    })
                    .catch(error => {
                        console.error(`Enrichment error for ${sourceId}:`, error);
                    });

                enrichmentPromises.push(enrichmentPromise);
            } catch (error) {
                console.error(`Error setting up enrichment for ${sourceId}:`, error);
            }
        }

        await Promise.all(enrichmentPromises);
    }

    checkIndicatorLists(indicator) {
        // Check against allowlist
        for (const allowlist of this.allowlists.values()) {
            if (this.isIndicatorInList(indicator, allowlist)) {
                indicator.allowlisted = true;
                indicator.allowlistReason = allowlist.name;
                return;
            }
        }

        // Check against blocklists
        for (const blocklist of this.blocklists.values()) {
            if (this.isIndicatorInList(indicator, blocklist)) {
                indicator.blocklisted = true;
                indicator.blocklistReason = blocklist.name;
                return;
            }
        }
    }

    isIndicatorInList(indicator, list) {
        return list.patterns.some(pattern => {
            if (pattern.type === 'exact') {
                return indicator.value === pattern.value;
            } else if (pattern.type === 'regex') {
                return new RegExp(pattern.value).test(indicator.value);
            } else if (pattern.type === 'cidr' && indicator.type === 'ip') {
                return this.isIPInCIDR(indicator.value, pattern.value);
            }
            return false;
        });
    }

    async checkAlertRules(indicator) {
        for (const [ruleId, rule] of this.alertRules) {
            if (await this.evaluateAlertRule(rule, indicator)) {
                await this.generateThreatAlert(rule, indicator);
            }
        }
    }

    async evaluateAlertRule(rule, indicator) {
        try {
            // Evaluate conditions
            for (const condition of rule.conditions) {
                if (!this.evaluateCondition(condition, indicator)) {
                    return false;
                }
            }
            return true;
        } catch (error) {
            console.error('Error evaluating alert rule:', error);
            return false;
        }
    }

    evaluateCondition(condition, indicator) {
        const value = this.getIndicatorProperty(indicator, condition.field);

        switch (condition.operator) {
            case 'equals':
                return value === condition.value;
            case 'contains':
                return value && value.toString().includes(condition.value);
            case 'greater_than':
                return Number(value) > Number(condition.value);
            case 'less_than':
                return Number(value) < Number(condition.value);
            case 'in':
                return condition.value.includes(value);
            case 'regex':
                return new RegExp(condition.value).test(value);
            default:
                return false;
        }
    }

    getIndicatorProperty(indicator, field) {
        const fieldParts = field.split('.');
        let value = indicator;

        for (const part of fieldParts) {
            if (value && typeof value === 'object') {
                value = value[part];
            } else {
                return null;
            }
        }

        return value;
    }

    async generateThreatAlert(rule, indicator) {
        const alertId = this.generateAlertId();
        const alert = {
            id: alertId,
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            indicator: indicator,
            timestamp: new Date().toISOString(),
            status: 'open',
            description: rule.description,
            recommendation: rule.recommendation
        };

        // Store alert
        console.log(`Threat alert generated: ${alertId} - ${rule.name}`);

        // Send notifications
        await this.sendThreatNotification(alert);

        return alert;
    }

    async sendThreatNotification(alert) {
        // Implementation would send notifications via email, Slack, etc.
        console.log(`Threat notification sent for alert: ${alert.id}`);
    }

    startThreatHunting() {
        for (const [queryId, query] of this.huntingQueries) {
            // Immediate execution
            this.executeThreatHunt(queryId);

            // Schedule periodic execution
            setInterval(() => {
                this.executeThreatHunt(queryId);
            }, query.frequency);
        }
    }

    async executeThreatHunt(queryId) {
        const query = this.huntingQueries.get(queryId);
        if (!query) return;

        try {
            console.log(`Executing threat hunt: ${query.name}`);

            // Execute query against database
            const results = await this.executeQuery(query.query);

            if (results.length > 0) {
                console.log(`Threat hunt ${query.name} found ${results.length} suspicious activities`);

                for (const result of results) {
                    await this.processThreatHuntResult(query, result);
                }
            }

        } catch (error) {
            console.error(`Error executing threat hunt ${query.name}:`, error);
        }
    }

    async processThreatHuntResult(query, result) {
        const alertId = this.generateAlertId();
        const alert = {
            id: alertId,
            type: 'threat_hunt',
            queryId: query.name.toLowerCase().replace(/\s+/g, '_'),
            queryName: query.name,
            severity: query.severity,
            data: result,
            timestamp: new Date().toISOString(),
            status: 'open',
            description: query.description
        };

        console.log(`Threat hunting alert: ${alertId} - ${query.name}`);
        await this.sendThreatNotification(alert);
    }

    async checkIPReputation(ipAddress) {
        const indicators = Array.from(this.indicators.values())
            .filter(indicator => indicator.type === 'ip' && indicator.value === ipAddress);

        if (indicators.length === 0) {
            return {
                ip: ipAddress,
                reputation: 'unknown',
                riskScore: 0.5,
                sources: []
            };
        }

        let totalRisk = 0;
        let sourceCount = 0;
        const sources = [];

        for (const indicator of indicators) {
            totalRisk += this.calculateIndicatorRisk(indicator);
            sourceCount += indicator.sources.size;
            sources.push(...Array.from(indicator.sources));
        }

        const riskScore = totalRisk / indicators.length;
        const reputation = this.determineReputation(riskScore);

        return {
            ip: ipAddress,
            reputation,
            riskScore,
            sources: [...new Set(sources)],
            indicators: indicators.length,
            lastSeen: Math.max(...indicators.map(i => new Date(i.lastSeen).getTime()))
        };
    }

    async checkDomainReputation(domain) {
        const indicators = Array.from(this.indicators.values())
            .filter(indicator => indicator.type === 'domain' && indicator.value === domain);

        if (indicators.length === 0) {
            return {
                domain,
                reputation: 'unknown',
                riskScore: 0.5,
                sources: []
            };
        }

        let totalRisk = 0;
        const sources = [];

        for (const indicator of indicators) {
            totalRisk += this.calculateIndicatorRisk(indicator);
            sources.push(...Array.from(indicator.sources));
        }

        const riskScore = totalRisk / indicators.length;
        const reputation = this.determineReputation(riskScore);

        return {
            domain,
            reputation,
            riskScore,
            sources: [...new Set(sources)],
            indicators: indicators.length,
            lastSeen: Math.max(...indicators.map(i => new Date(i.lastSeen).getTime()))
        };
    }

    calculateIndicatorRisk(indicator) {
        let risk = indicator.confidence || 0.5;

        // Adjust based on severity
        const severityMultipliers = {
            'low': 0.3,
            'medium': 0.6,
            'high': 0.8,
            'critical': 1.0
        };
        risk *= severityMultipliers[indicator.severity] || 0.6;

        // Adjust based on age
        const ageInDays = (Date.now() - new Date(indicator.lastSeen).getTime()) / (24 * 60 * 60 * 1000);
        if (ageInDays > 30) {
            risk *= 0.8; // Reduce risk for old indicators
        }

        // Adjust based on source count
        const sourceCount = indicator.sources ? indicator.sources.size : 1;
        risk *= Math.min(1 + (sourceCount - 1) * 0.1, 1.5); // Max 50% increase for multiple sources

        return Math.min(risk, 1.0);
    }

    determineReputation(riskScore) {
        if (riskScore >= 0.8) return 'malicious';
        if (riskScore >= 0.6) return 'suspicious';
        if (riskScore >= 0.4) return 'questionable';
        if (riskScore >= 0.2) return 'clean';
        return 'unknown';
    }

    startIndicatorEnrichment() {
        // Process enrichment queue
        setInterval(async () => {
            await this.processEnrichmentQueue();
        }, 60000); // Every minute
    }

    async processEnrichmentQueue() {
        const unenrichedIndicators = Array.from(this.indicators.values())
            .filter(indicator => !indicator.enrichment || Object.keys(indicator.enrichment).length === 0)
            .slice(0, 10); // Process 10 at a time

        for (const indicator of unenrichedIndicators) {
            await this.enrichIndicator(indicator);
        }
    }

    // Enrichment source implementations
    async getIPGeolocation(ip) {
        try {
            // Mock implementation - would use actual MaxMind API
            return {
                country: 'US',
                city: 'New York',
                latitude: 40.7128,
                longitude: -74.0060,
                isp: 'Example ISP',
                asn: 'AS12345'
            };
        } catch (error) {
            console.error('IP geolocation error:', error);
            return null;
        }
    }

    async getDomainWHOIS(domain) {
        try {
            // Mock implementation - would use actual WHOIS API
            return {
                registrar: 'Example Registrar',
                createdDate: '2020-01-01',
                expiresDate: '2025-01-01',
                nameServers: ['ns1.example.com', 'ns2.example.com'],
                registrant: 'Example Organization'
            };
        } catch (error) {
            console.error('Domain WHOIS error:', error);
            return null;
        }
    }

    async analyzeURL(url) {
        try {
            // Mock implementation - would use actual URL analysis API
            return {
                reputation: 'clean',
                categories: ['business'],
                riskScore: 0.1,
                detections: 0
            };
        } catch (error) {
            console.error('URL analysis error:', error);
            return null;
        }
    }

    async performDNSLookup(value) {
        try {
            // Mock implementation - would perform actual DNS lookup
            return {
                aRecords: ['192.0.2.1'],
                mxRecords: ['mail.example.com'],
                nsRecords: ['ns1.example.com', 'ns2.example.com'],
                txtRecords: ['v=spf1 include:_spf.example.com ~all']
            };
        } catch (error) {
            console.error('DNS lookup error:', error);
            return null;
        }
    }

    // Alert rule management
    addAlertRule(ruleConfig) {
        const ruleId = this.generateRuleId();
        const rule = {
            id: ruleId,
            name: ruleConfig.name,
            description: ruleConfig.description,
            severity: ruleConfig.severity || 'medium',
            conditions: ruleConfig.conditions || [],
            recommendation: ruleConfig.recommendation,
            enabled: ruleConfig.enabled !== false,
            createdAt: new Date().toISOString()
        };

        this.alertRules.set(ruleId, rule);
        return rule;
    }

    // Blocklist/Allowlist management
    addBlocklist(name, patterns) {
        this.blocklists.set(name, {
            name,
            patterns,
            createdAt: new Date().toISOString()
        });
    }

    addAllowlist(name, patterns) {
        this.allowlists.set(name, {
            name,
            patterns,
            createdAt: new Date().toISOString()
        });
    }

    // Utility methods
    generateIndicatorId() {
        return 'indicator_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    generateAlertId() {
        return 'alert_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    generateRuleId() {
        return 'rule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    async executeQuery(query) {
        // Mock implementation - would execute against actual database
        console.log(`Executing query: ${query}`);
        return []; // Mock empty results
    }

    isIPInCIDR(ip, cidr) {
        // Mock implementation - would perform actual CIDR matching
        return false;
    }

    // Analytics and reporting
    getThreatIntelligenceStats() {
        const indicators = Array.from(this.indicators.values());

        const stats = {
            totalIndicators: indicators.length,
            indicatorsByType: {},
            indicatorsBySource: {},
            indicatorsBySeverity: {},
            recentIndicators: indicators
                .filter(i => Date.now() - new Date(i.lastSeen).getTime() < 24 * 60 * 60 * 1000)
                .length,
            threatFeeds: {
                total: this.threatFeeds.size,
                active: Array.from(this.threatFeeds.values()).filter(f => f.status === 'active').length
            }
        };

        // Group indicators by type
        for (const indicator of indicators) {
            stats.indicatorsByType[indicator.type] = (stats.indicatorsByType[indicator.type] || 0) + 1;
            stats.indicatorsBySeverity[indicator.severity] = (stats.indicatorsBySeverity[indicator.severity] || 0) + 1;

            if (indicator.sources) {
                for (const source of indicator.sources) {
                    stats.indicatorsBySource[source] = (stats.indicatorsBySource[source] || 0) + 1;
                }
            }
        }

        return stats;
    }

    getTopThreats(limit = 10) {
        const indicators = Array.from(this.indicators.values())
            .sort((a, b) => this.calculateIndicatorRisk(b) - this.calculateIndicatorRisk(a))
            .slice(0, limit);

        return indicators.map(indicator => ({
            value: indicator.value,
            type: indicator.type,
            riskScore: this.calculateIndicatorRisk(indicator),
            severity: indicator.severity,
            sources: Array.from(indicator.sources || []),
            lastSeen: indicator.lastSeen
        }));
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThreatIntelligenceEngine;
}