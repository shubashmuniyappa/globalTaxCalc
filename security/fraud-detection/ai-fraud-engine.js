class AIFraudDetectionEngine {
    constructor() {
        this.models = new Map();
        this.featureExtractors = new Map();
        this.riskScorers = new Map();
        this.behavioralProfiles = new Map();
        this.anomalyDetectors = new Map();
        this.patternRecognizers = new Map();
        this.alerts = new Map();
        this.whitelistedIPs = new Set();
        this.blacklistedIPs = new Set();
        this.initializeModels();
        this.initializeFeatureExtractors();
        this.initializeAnomalyDetectors();
    }

    initializeModels() {
        // Behavioral Analysis Model
        this.models.set('behavioral', {
            name: 'Behavioral Analysis Model',
            type: 'neural_network',
            version: '2.1',
            accuracy: 0.94,
            features: [
                'typing_speed', 'mouse_patterns', 'navigation_flow', 'session_duration',
                'time_between_actions', 'device_characteristics', 'location_patterns'
            ],
            weights: new Map([
                ['typing_speed', 0.15],
                ['mouse_patterns', 0.20],
                ['navigation_flow', 0.18],
                ['session_duration', 0.12],
                ['time_between_actions', 0.14],
                ['device_characteristics', 0.11],
                ['location_patterns', 0.10]
            ]),
            threshold: 0.75,
            lastTrained: new Date('2023-10-01').toISOString()
        });

        // Transaction Anomaly Model
        this.models.set('transaction', {
            name: 'Transaction Anomaly Model',
            type: 'isolation_forest',
            version: '1.8',
            accuracy: 0.91,
            features: [
                'transaction_amount', 'frequency', 'time_of_day', 'device_change',
                'location_change', 'calculation_complexity', 'data_volume'
            ],
            threshold: 0.65,
            lastTrained: new Date('2023-09-15').toISOString()
        });

        // Account Takeover Model
        this.models.set('account_takeover', {
            name: 'Account Takeover Detection',
            type: 'ensemble',
            version: '3.2',
            accuracy: 0.96,
            features: [
                'login_location_deviation', 'device_fingerprint_change', 'behavioral_deviation',
                'password_change_frequency', 'failed_login_attempts', 'session_hijacking_indicators'
            ],
            threshold: 0.80,
            lastTrained: new Date('2023-10-15').toISOString()
        });

        // Calculation Fraud Model
        this.models.set('calculation_fraud', {
            name: 'Tax Calculation Fraud Detection',
            type: 'gradient_boosting',
            version: '2.5',
            accuracy: 0.93,
            features: [
                'income_inconsistency', 'deduction_patterns', 'filing_status_changes',
                'dependent_anomalies', 'document_manipulation', 'calculation_speed'
            ],
            threshold: 0.70,
            lastTrained: new Date('2023-10-10').toISOString()
        });

        // Payment Fraud Model
        this.models.set('payment_fraud', {
            name: 'Payment Fraud Detection',
            type: 'random_forest',
            version: '1.9',
            accuracy: 0.95,
            features: [
                'payment_method_change', 'billing_address_mismatch', 'card_velocity',
                'merchant_risk_score', 'cvv_failures', 'payment_timing'
            ],
            threshold: 0.78,
            lastTrained: new Date('2023-10-05').toISOString()
        });
    }

    initializeFeatureExtractors() {
        // Behavioral Feature Extractor
        this.featureExtractors.set('behavioral', {
            name: 'Behavioral Feature Extractor',
            extract: (sessionData, userHistory) => {
                return {
                    typing_speed: this.calculateTypingSpeed(sessionData.keystrokes),
                    mouse_patterns: this.analyzMousePatterns(sessionData.mouseEvents),
                    navigation_flow: this.analyzeNavigationFlow(sessionData.pageViews),
                    session_duration: sessionData.duration || 0,
                    time_between_actions: this.calculateActionIntervals(sessionData.actions),
                    device_characteristics: this.extractDeviceFingerprint(sessionData.device),
                    location_patterns: this.analyzeLocationPatterns(sessionData.geoData, userHistory)
                };
            }
        });

        // Transaction Feature Extractor
        this.featureExtractors.set('transaction', {
            name: 'Transaction Feature Extractor',
            extract: (transactionData, userHistory) => {
                return {
                    transaction_amount: transactionData.amount || 0,
                    frequency: this.calculateTransactionFrequency(userHistory),
                    time_of_day: new Date(transactionData.timestamp).getHours(),
                    device_change: this.detectDeviceChange(transactionData.device, userHistory),
                    location_change: this.detectLocationChange(transactionData.location, userHistory),
                    calculation_complexity: this.assessCalculationComplexity(transactionData),
                    data_volume: this.calculateDataVolume(transactionData.inputs)
                };
            }
        });

        // Account Security Feature Extractor
        this.featureExtractors.set('account_security', {
            name: 'Account Security Feature Extractor',
            extract: (loginData, userProfile) => {
                return {
                    login_location_deviation: this.calculateLocationDeviation(loginData.location, userProfile),
                    device_fingerprint_change: this.compareDeviceFingerprints(loginData.device, userProfile),
                    behavioral_deviation: this.calculateBehavioralDeviation(loginData, userProfile),
                    password_change_frequency: this.calculatePasswordChangeFrequency(userProfile),
                    failed_login_attempts: loginData.failedAttempts || 0,
                    session_hijacking_indicators: this.detectSessionHijackingIndicators(loginData)
                };
            }
        });
    }

    initializeAnomalyDetectors() {
        // Statistical Anomaly Detector
        this.anomalyDetectors.set('statistical', {
            name: 'Statistical Anomaly Detector',
            type: 'z_score',
            threshold: 3.0,
            detect: (value, historicalData) => {
                const mean = historicalData.reduce((sum, val) => sum + val, 0) / historicalData.length;
                const variance = historicalData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historicalData.length;
                const stdDev = Math.sqrt(variance);
                const zScore = Math.abs((value - mean) / stdDev);

                return {
                    isAnomaly: zScore > this.anomalyDetectors.get('statistical').threshold,
                    score: zScore,
                    confidence: Math.min(zScore / 5.0, 1.0)
                };
            }
        });

        // Isolation Forest Detector
        this.anomalyDetectors.set('isolation_forest', {
            name: 'Isolation Forest Anomaly Detector',
            contamination: 0.1,
            detect: (features) => {
                // Simplified isolation forest implementation
                const anomalyScore = this.calculateIsolationScore(features);
                return {
                    isAnomaly: anomalyScore > 0.6,
                    score: anomalyScore,
                    confidence: anomalyScore
                };
            }
        });

        // Time Series Anomaly Detector
        this.anomalyDetectors.set('time_series', {
            name: 'Time Series Anomaly Detector',
            windowSize: 24,
            detect: (timeSeriesData) => {
                const seasonalDecomposition = this.performSeasonalDecomposition(timeSeriesData);
                const residuals = seasonalDecomposition.residuals;
                const threshold = this.calculateDynamicThreshold(residuals);

                const currentValue = timeSeriesData[timeSeriesData.length - 1];
                const expectedValue = seasonalDecomposition.trend[seasonalDecomposition.trend.length - 1];
                const deviation = Math.abs(currentValue - expectedValue);

                return {
                    isAnomaly: deviation > threshold,
                    score: deviation / threshold,
                    confidence: Math.min(deviation / (threshold * 2), 1.0)
                };
            }
        });
    }

    async analyzeFraudRisk(request) {
        try {
            const riskAssessment = {
                requestId: request.id || this.generateRequestId(),
                timestamp: new Date().toISOString(),
                userId: request.userId,
                sessionId: request.sessionId,
                ipAddress: request.ipAddress,
                userAgent: request.userAgent,
                riskScore: 0,
                riskLevel: 'low',
                flags: [],
                modelScores: {},
                recommendations: [],
                confidence: 0
            };

            // Extract features for each model
            const behavioralFeatures = await this.extractBehavioralFeatures(request);
            const transactionFeatures = await this.extractTransactionFeatures(request);
            const securityFeatures = await this.extractSecurityFeatures(request);

            // Run AI models
            const behavioralScore = await this.runBehavioralAnalysis(behavioralFeatures);
            const transactionScore = await this.runTransactionAnalysis(transactionFeatures);
            const securityScore = await this.runSecurityAnalysis(securityFeatures);
            const patternScore = await this.runPatternRecognition(request);

            // Store individual model scores
            riskAssessment.modelScores = {
                behavioral: behavioralScore,
                transaction: transactionScore,
                security: securityScore,
                pattern: patternScore
            };

            // Calculate composite risk score
            riskAssessment.riskScore = this.calculateCompositeRiskScore({
                behavioral: behavioralScore,
                transaction: transactionScore,
                security: securityScore,
                pattern: patternScore
            });

            // Determine risk level and flags
            riskAssessment.riskLevel = this.determineRiskLevel(riskAssessment.riskScore);
            riskAssessment.flags = this.generateRiskFlags(riskAssessment);
            riskAssessment.confidence = this.calculateConfidence(riskAssessment.modelScores);

            // Generate recommendations
            riskAssessment.recommendations = this.generateSecurityRecommendations(riskAssessment);

            // Update behavioral profile
            await this.updateBehavioralProfile(request.userId, {
                features: behavioralFeatures,
                riskScore: riskAssessment.riskScore,
                timestamp: riskAssessment.timestamp
            });

            // Check for alerts
            await this.checkAlertConditions(riskAssessment);

            return riskAssessment;

        } catch (error) {
            console.error('Fraud analysis error:', error);
            return {
                requestId: request.id,
                error: 'Analysis failed',
                riskScore: 1.0,
                riskLevel: 'high',
                flags: ['analysis_error']
            };
        }
    }

    async extractBehavioralFeatures(request) {
        const userHistory = await this.getUserBehavioralHistory(request.userId);
        const extractor = this.featureExtractors.get('behavioral');
        return extractor.extract(request.sessionData || {}, userHistory);
    }

    async extractTransactionFeatures(request) {
        const userHistory = await this.getUserTransactionHistory(request.userId);
        const extractor = this.featureExtractors.get('transaction');
        return extractor.extract(request.transactionData || {}, userHistory);
    }

    async extractSecurityFeatures(request) {
        const userProfile = await this.getUserSecurityProfile(request.userId);
        const extractor = this.featureExtractors.get('account_security');
        return extractor.extract(request.loginData || {}, userProfile);
    }

    async runBehavioralAnalysis(features) {
        const model = this.models.get('behavioral');
        let score = 0;

        // Calculate weighted score based on behavioral features
        for (const [feature, value] of Object.entries(features)) {
            const weight = model.weights.get(feature) || 0;
            const normalizedValue = this.normalizeFeature(feature, value);
            score += weight * normalizedValue;
        }

        // Apply neural network activation function
        const activatedScore = this.sigmoid(score);

        // Compare against historical behavior
        const deviationScore = await this.calculateBehavioralDeviation(features);

        // Combine scores
        const finalScore = (activatedScore * 0.7) + (deviationScore * 0.3);

        return {
            score: finalScore,
            threshold: model.threshold,
            isAnomalous: finalScore > model.threshold,
            features: features,
            confidence: this.calculateModelConfidence(finalScore, model)
        };
    }

    async runTransactionAnalysis(features) {
        const model = this.models.get('transaction');

        // Isolation Forest implementation for transaction anomalies
        const isolationScore = this.calculateIsolationScore(features);

        // Time-based analysis
        const temporalScore = this.analyzeTemporalPatterns(features);

        // Amount-based analysis
        const amountScore = this.analyzeTransactionAmounts(features);

        // Combine scores
        const finalScore = (isolationScore * 0.4) + (temporalScore * 0.3) + (amountScore * 0.3);

        return {
            score: finalScore,
            threshold: model.threshold,
            isAnomalous: finalScore > model.threshold,
            features: features,
            confidence: this.calculateModelConfidence(finalScore, model)
        };
    }

    async runSecurityAnalysis(features) {
        const model = this.models.get('account_takeover');

        // Ensemble model combining multiple security indicators
        const locationScore = this.analyzeLocationSecurity(features);
        const deviceScore = this.analyzeDeviceSecurity(features);
        const behavioralSecurityScore = this.analyzeBehavioralSecurity(features);

        // Weighted ensemble
        const finalScore = (locationScore * 0.35) + (deviceScore * 0.35) + (behavioralSecurityScore * 0.30);

        return {
            score: finalScore,
            threshold: model.threshold,
            isAnomalous: finalScore > model.threshold,
            features: features,
            confidence: this.calculateModelConfidence(finalScore, model)
        };
    }

    async runPatternRecognition(request) {
        const patterns = {
            velocity: this.detectVelocityPatterns(request),
            sequence: this.detectSequencePatterns(request),
            frequency: this.detectFrequencyPatterns(request),
            similarity: this.detectSimilarityPatterns(request)
        };

        // Combine pattern scores
        const patternScore = Object.values(patterns).reduce((sum, pattern) => sum + pattern.score, 0) / 4;

        return {
            score: patternScore,
            patterns: patterns,
            isAnomalous: patternScore > 0.6,
            confidence: Math.min(patternScore / 0.8, 1.0)
        };
    }

    calculateCompositeRiskScore(modelScores) {
        const weights = {
            behavioral: 0.25,
            transaction: 0.25,
            security: 0.30,
            pattern: 0.20
        };

        let compositeScore = 0;
        let totalWeight = 0;

        for (const [model, scoreData] of Object.entries(modelScores)) {
            if (scoreData && typeof scoreData.score === 'number') {
                const weight = weights[model] || 0;
                compositeScore += scoreData.score * weight;
                totalWeight += weight;
            }
        }

        // Normalize by actual total weight
        return totalWeight > 0 ? Math.min(compositeScore / totalWeight, 1.0) : 0;
    }

    determineRiskLevel(riskScore) {
        if (riskScore >= 0.8) return 'critical';
        if (riskScore >= 0.6) return 'high';
        if (riskScore >= 0.4) return 'medium';
        if (riskScore >= 0.2) return 'low';
        return 'minimal';
    }

    generateRiskFlags(assessment) {
        const flags = [];
        const { modelScores, riskScore } = assessment;

        // Model-specific flags
        if (modelScores.behavioral?.isAnomalous) {
            flags.push('behavioral_anomaly');
        }
        if (modelScores.transaction?.isAnomalous) {
            flags.push('transaction_anomaly');
        }
        if (modelScores.security?.isAnomalous) {
            flags.push('security_risk');
        }
        if (modelScores.pattern?.isAnomalous) {
            flags.push('suspicious_patterns');
        }

        // IP-based flags
        if (this.blacklistedIPs.has(assessment.ipAddress)) {
            flags.push('blacklisted_ip');
        }
        if (this.isHighRiskIP(assessment.ipAddress)) {
            flags.push('high_risk_ip');
        }

        // Device flags
        if (this.detectDeviceManipulation(assessment)) {
            flags.push('device_manipulation');
        }

        // Location flags
        if (this.detectLocationSpoofing(assessment)) {
            flags.push('location_spoofing');
        }

        // Velocity flags
        if (this.detectHighVelocity(assessment)) {
            flags.push('high_velocity');
        }

        return flags;
    }

    generateSecurityRecommendations(assessment) {
        const recommendations = [];
        const { riskScore, riskLevel, flags } = assessment;

        // Risk level based recommendations
        switch (riskLevel) {
            case 'critical':
                recommendations.push({
                    action: 'block_access',
                    priority: 'immediate',
                    description: 'Block access and require manual review'
                });
                recommendations.push({
                    action: 'alert_security_team',
                    priority: 'immediate',
                    description: 'Alert security team for immediate investigation'
                });
                break;

            case 'high':
                recommendations.push({
                    action: 'require_additional_authentication',
                    priority: 'high',
                    description: 'Require step-up authentication (MFA/biometrics)'
                });
                recommendations.push({
                    action: 'limit_session_duration',
                    priority: 'high',
                    description: 'Reduce session timeout to 15 minutes'
                });
                break;

            case 'medium':
                recommendations.push({
                    action: 'increase_monitoring',
                    priority: 'medium',
                    description: 'Increase monitoring frequency for this session'
                });
                recommendations.push({
                    action: 'request_verification',
                    priority: 'medium',
                    description: 'Request verification of sensitive actions'
                });
                break;

            case 'low':
                recommendations.push({
                    action: 'passive_monitoring',
                    priority: 'low',
                    description: 'Continue passive monitoring'
                });
                break;
        }

        // Flag-specific recommendations
        if (flags.includes('behavioral_anomaly')) {
            recommendations.push({
                action: 'behavioral_challenge',
                priority: 'high',
                description: 'Present behavioral challenge (CAPTCHA, security questions)'
            });
        }

        if (flags.includes('blacklisted_ip')) {
            recommendations.push({
                action: 'block_ip',
                priority: 'immediate',
                description: 'Block access from blacklisted IP address'
            });
        }

        if (flags.includes('device_manipulation')) {
            recommendations.push({
                action: 'device_verification',
                priority: 'high',
                description: 'Require device verification or registration'
            });
        }

        return recommendations;
    }

    // Feature calculation methods
    calculateTypingSpeed(keystrokes) {
        if (!keystrokes || keystrokes.length < 2) return 0;

        const intervals = [];
        for (let i = 1; i < keystrokes.length; i++) {
            intervals.push(keystrokes[i].timestamp - keystrokes[i-1].timestamp);
        }

        const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
        return 1000 / avgInterval; // Characters per second
    }

    analyzMousePatterns(mouseEvents) {
        if (!mouseEvents || mouseEvents.length < 10) return 0;

        let totalDistance = 0;
        let totalTime = 0;
        let directionChanges = 0;

        for (let i = 1; i < mouseEvents.length; i++) {
            const prev = mouseEvents[i-1];
            const curr = mouseEvents[i];

            // Calculate distance
            const distance = Math.sqrt(
                Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2)
            );
            totalDistance += distance;

            // Calculate time
            totalTime += curr.timestamp - prev.timestamp;

            // Detect direction changes
            if (i > 1) {
                const prevAngle = Math.atan2(prev.y - mouseEvents[i-2].y, prev.x - mouseEvents[i-2].x);
                const currAngle = Math.atan2(curr.y - prev.y, curr.x - prev.x);
                const angleDiff = Math.abs(currAngle - prevAngle);

                if (angleDiff > Math.PI / 4) { // 45 degree threshold
                    directionChanges++;
                }
            }
        }

        const velocity = totalTime > 0 ? totalDistance / totalTime : 0;
        const smoothness = mouseEvents.length > 0 ? directionChanges / mouseEvents.length : 0;

        return velocity * (1 - smoothness); // Higher score for smooth, consistent movement
    }

    analyzeNavigationFlow(pageViews) {
        if (!pageViews || pageViews.length < 2) return 0;

        const expectedFlows = [
            ['login', 'dashboard', 'calculator'],
            ['dashboard', 'calculator', 'results'],
            ['calculator', 'review', 'submit']
        ];

        let flowScore = 0;
        let sequenceMatches = 0;

        for (let i = 0; i < pageViews.length - 2; i++) {
            const sequence = [
                pageViews[i].page,
                pageViews[i+1].page,
                pageViews[i+2].page
            ];

            for (const expectedFlow of expectedFlows) {
                if (this.arraysEqual(sequence, expectedFlow)) {
                    sequenceMatches++;
                    break;
                }
            }
        }

        flowScore = pageViews.length > 2 ? sequenceMatches / (pageViews.length - 2) : 0;
        return flowScore;
    }

    calculateActionIntervals(actions) {
        if (!actions || actions.length < 2) return 0;

        const intervals = [];
        for (let i = 1; i < actions.length; i++) {
            intervals.push(actions[i].timestamp - actions[i-1].timestamp);
        }

        // Calculate coefficient of variation (consistency measure)
        const mean = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
        const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - mean, 2), 0) / intervals.length;
        const stdDev = Math.sqrt(variance);

        return mean > 0 ? stdDev / mean : 0; // Lower values indicate more consistent timing
    }

    extractDeviceFingerprint(deviceData) {
        if (!deviceData) return {};

        const fingerprint = {
            screen_resolution: deviceData.screen?.width && deviceData.screen?.height
                ? `${deviceData.screen.width}x${deviceData.screen.height}` : 'unknown',
            timezone: deviceData.timezone || 'unknown',
            language: deviceData.language || 'unknown',
            platform: deviceData.platform || 'unknown',
            user_agent_hash: this.hashString(deviceData.userAgent || ''),
            plugins: deviceData.plugins ? deviceData.plugins.length : 0,
            fonts: deviceData.fonts ? deviceData.fonts.length : 0,
            canvas_fingerprint: deviceData.canvas || 'unknown',
            webgl_fingerprint: deviceData.webgl || 'unknown'
        };

        return fingerprint;
    }

    // Anomaly detection implementations
    calculateIsolationScore(features) {
        // Simplified isolation forest score calculation
        const featureArray = Object.values(features).filter(v => typeof v === 'number');
        if (featureArray.length === 0) return 0;

        const randomSplits = 10;
        let totalPathLength = 0;

        for (let i = 0; i < randomSplits; i++) {
            const pathLength = this.isolationPath(featureArray, 0, 8); // max depth 8
            totalPathLength += pathLength;
        }

        const avgPathLength = totalPathLength / randomSplits;
        const expectedPathLength = 2 * (Math.log(featureArray.length - 1) + 0.577215664901532);

        return Math.pow(2, -avgPathLength / expectedPathLength);
    }

    isolationPath(features, currentDepth, maxDepth) {
        if (currentDepth >= maxDepth || features.length <= 1) {
            return currentDepth;
        }

        // Random split
        const featureIndex = Math.floor(Math.random() * features.length);
        const splitValue = Math.random() * (Math.max(...features) - Math.min(...features)) + Math.min(...features);

        const leftFeatures = features.filter(f => f < splitValue);
        const rightFeatures = features.filter(f => f >= splitValue);

        if (leftFeatures.length === 0 || rightFeatures.length === 0) {
            return currentDepth;
        }

        // Randomly choose which branch to follow
        const branch = Math.random() < 0.5 ? leftFeatures : rightFeatures;
        return this.isolationPath(branch, currentDepth + 1, maxDepth);
    }

    performSeasonalDecomposition(timeSeries) {
        // Simplified seasonal decomposition
        const trend = this.calculateMovingAverage(timeSeries, 7);
        const seasonal = this.extractSeasonalComponent(timeSeries, trend);
        const residuals = timeSeries.map((value, index) =>
            value - (trend[index] || 0) - (seasonal[index] || 0)
        );

        return { trend, seasonal, residuals };
    }

    calculateMovingAverage(data, windowSize) {
        const result = [];
        for (let i = 0; i < data.length; i++) {
            const start = Math.max(0, i - Math.floor(windowSize / 2));
            const end = Math.min(data.length, i + Math.floor(windowSize / 2) + 1);
            const window = data.slice(start, end);
            const average = window.reduce((sum, val) => sum + val, 0) / window.length;
            result.push(average);
        }
        return result;
    }

    extractSeasonalComponent(data, trend) {
        // Simplified seasonal extraction (daily pattern)
        const seasonalLength = 24; // 24 hours
        const seasonal = new Array(data.length).fill(0);

        for (let i = 0; i < data.length; i++) {
            const seasonalIndex = i % seasonalLength;
            const detrended = data[i] - (trend[i] || 0);

            // Average values at the same seasonal position
            const sameSeasonValues = [];
            for (let j = seasonalIndex; j < data.length; j += seasonalLength) {
                if (j < data.length && trend[j] !== undefined) {
                    sameSeasonValues.push(data[j] - trend[j]);
                }
            }

            if (sameSeasonValues.length > 0) {
                seasonal[i] = sameSeasonValues.reduce((sum, val) => sum + val, 0) / sameSeasonValues.length;
            }
        }

        return seasonal;
    }

    calculateDynamicThreshold(residuals) {
        const validResiduals = residuals.filter(r => !isNaN(r));
        if (validResiduals.length === 0) return 1;

        const mean = validResiduals.reduce((sum, val) => sum + val, 0) / validResiduals.length;
        const variance = validResiduals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / validResiduals.length;
        const stdDev = Math.sqrt(variance);

        return 2.5 * stdDev; // 2.5 standard deviations
    }

    // Pattern detection methods
    detectVelocityPatterns(request) {
        const actions = request.sessionData?.actions || [];
        if (actions.length < 3) return { score: 0, details: 'insufficient_data' };

        const timeWindows = [60000, 300000, 900000]; // 1min, 5min, 15min
        let maxVelocity = 0;

        for (const window of timeWindows) {
            const recentActions = actions.filter(action =>
                Date.now() - action.timestamp < window
            );
            const velocity = recentActions.length / (window / 60000); // actions per minute
            maxVelocity = Math.max(maxVelocity, velocity);
        }

        const normalVelocity = 5; // 5 actions per minute is normal
        const velocityScore = Math.min(maxVelocity / normalVelocity, 2.0) / 2.0;

        return {
            score: velocityScore,
            maxVelocity,
            details: maxVelocity > normalVelocity * 1.5 ? 'high_velocity' : 'normal_velocity'
        };
    }

    detectSequencePatterns(request) {
        const pageViews = request.sessionData?.pageViews || [];
        if (pageViews.length < 3) return { score: 0, details: 'insufficient_data' };

        // Look for bot-like sequential patterns
        const sequenceScore = this.analyzeSequentialBehavior(pageViews);

        return {
            score: sequenceScore,
            details: sequenceScore > 0.7 ? 'bot_like_sequence' : 'human_like_sequence'
        };
    }

    analyzeSequentialBehavior(pageViews) {
        let perfectSequenceCount = 0;
        let totalSequences = 0;

        // Check for perfectly timed sequences
        for (let i = 1; i < pageViews.length; i++) {
            const timeDiff = pageViews[i].timestamp - pageViews[i-1].timestamp;

            // Look for suspiciously regular timing (exactly X seconds)
            if (timeDiff % 1000 === 0 && timeDiff >= 1000 && timeDiff <= 10000) {
                perfectSequenceCount++;
            }
            totalSequences++;
        }

        return totalSequences > 0 ? perfectSequenceCount / totalSequences : 0;
    }

    // Utility methods
    sigmoid(x) {
        return 1 / (1 + Math.exp(-x));
    }

    normalizeFeature(featureName, value) {
        // Feature-specific normalization
        const normalizers = {
            typing_speed: (v) => Math.min(v / 10, 1), // Normalize typing speed (0-10 cps)
            session_duration: (v) => Math.min(v / 3600000, 1), // Normalize session duration (0-1 hour)
            transaction_amount: (v) => Math.min(v / 100000, 1), // Normalize amount (0-100k)
            time_of_day: (v) => v / 24, // Normalize hour (0-24)
            default: (v) => Math.min(Math.max(v, 0), 1)
        };

        const normalizer = normalizers[featureName] || normalizers.default;
        return normalizer(value);
    }

    calculateModelConfidence(score, model) {
        const distanceFromThreshold = Math.abs(score - model.threshold);
        const maxDistance = Math.max(model.threshold, 1 - model.threshold);
        return Math.min(distanceFromThreshold / maxDistance, 1.0);
    }

    hashString(str) {
        let hash = 0;
        if (str.length === 0) return hash;

        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }

        return hash.toString();
    }

    arraysEqual(a, b) {
        return Array.isArray(a) && Array.isArray(b) &&
               a.length === b.length &&
               a.every((val, index) => val === b[index]);
    }

    generateRequestId() {
        return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Async data retrieval methods (would be implemented with actual data sources)
    async getUserBehavioralHistory(userId) {
        // Mock implementation - would query database
        return {
            avgTypingSpeed: 6.5,
            avgSessionDuration: 1800000,
            commonNavigationPatterns: ['login', 'dashboard', 'calculator'],
            deviceHistory: [],
            locationHistory: []
        };
    }

    async getUserTransactionHistory(userId) {
        // Mock implementation
        return {
            avgTransactionAmount: 0,
            transactionFrequency: 0.1,
            commonDevices: [],
            commonLocations: []
        };
    }

    async getUserSecurityProfile(userId) {
        // Mock implementation
        return {
            commonLocations: [],
            trustedDevices: [],
            passwordChangeHistory: [],
            lastLogin: new Date().toISOString()
        };
    }

    // Additional analysis methods would be implemented here...
    async updateBehavioralProfile(userId, profileData) {
        // Implementation for updating user behavioral profile
        console.log(`Updating behavioral profile for user ${userId}`);
    }

    async checkAlertConditions(assessment) {
        if (assessment.riskLevel === 'critical' || assessment.riskLevel === 'high') {
            const alert = {
                id: this.generateRequestId(),
                userId: assessment.userId,
                riskScore: assessment.riskScore,
                riskLevel: assessment.riskLevel,
                flags: assessment.flags,
                timestamp: new Date().toISOString(),
                status: 'open'
            };

            this.alerts.set(alert.id, alert);
            console.log(`Security alert generated: ${alert.id}`);
        }
    }

    // Additional helper methods for specific analyses would be implemented...
    isHighRiskIP(ipAddress) {
        // Implementation for IP risk assessment
        return false;
    }

    detectDeviceManipulation(assessment) {
        // Implementation for device manipulation detection
        return false;
    }

    detectLocationSpoofing(assessment) {
        // Implementation for location spoofing detection
        return false;
    }

    detectHighVelocity(assessment) {
        // Implementation for velocity detection
        return assessment.modelScores?.pattern?.patterns?.velocity?.score > 0.8;
    }

    calculateBehavioralDeviation(features) {
        // Implementation for behavioral deviation calculation
        return 0;
    }

    analyzeTemporalPatterns(features) {
        // Implementation for temporal pattern analysis
        return 0;
    }

    analyzeTransactionAmounts(features) {
        // Implementation for transaction amount analysis
        return 0;
    }

    analyzeLocationSecurity(features) {
        // Implementation for location security analysis
        return 0;
    }

    analyzeDeviceSecurity(features) {
        // Implementation for device security analysis
        return 0;
    }

    analyzeBehavioralSecurity(features) {
        // Implementation for behavioral security analysis
        return 0;
    }

    detectFrequencyPatterns(request) {
        // Implementation for frequency pattern detection
        return { score: 0, details: 'normal_frequency' };
    }

    detectSimilarityPatterns(request) {
        // Implementation for similarity pattern detection
        return { score: 0, details: 'normal_similarity' };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIFraudDetectionEngine;
}