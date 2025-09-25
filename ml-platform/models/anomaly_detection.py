"""
Anomaly Detection System
Fraud detection, unusual pattern identification, and tax law compliance monitoring
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler, RobustScaler
from sklearn.decomposition import PCA
from sklearn.cluster import DBSCAN
from sklearn.neighbors import LocalOutlierFactor
import lightgbm as lgb
from scipy import stats
import logging
from typing import Dict, List, Any, Tuple, Optional
from datetime import datetime, timedelta
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class FraudDetectionEngine:
    """Advanced fraud detection for tax calculations and user behavior"""

    def __init__(self):
        self.isolation_forest = IsolationForest(
            contamination=0.1,
            random_state=42,
            n_estimators=100
        )
        self.scaler = RobustScaler()
        self.pca = PCA(n_components=0.95)
        self.is_fitted = False
        self.feature_importance = {}
        self.fraud_patterns = {}

    def prepare_fraud_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Prepare comprehensive features for fraud detection"""
        features_df = df.copy()

        # User behavior anomalies
        features_df['login_frequency_anomaly'] = self._detect_frequency_anomaly(
            df, 'daily_logins', window_days=30
        )

        features_df['calculation_speed_anomaly'] = self._detect_speed_anomaly(
            df, 'time_per_calculation'
        )

        features_df['session_duration_anomaly'] = self._detect_duration_anomaly(
            df, 'session_duration'
        )

        # Financial anomalies
        features_df['income_consistency_score'] = self._calculate_income_consistency(df)
        features_df['deduction_ratio_anomaly'] = self._detect_deduction_anomalies(df)
        features_df['tax_liability_anomaly'] = self._detect_tax_liability_anomalies(df)

        # Pattern-based features
        features_df['round_number_frequency'] = self._detect_round_number_patterns(df)
        features_df['sequential_input_pattern'] = self._detect_sequential_patterns(df)
        features_df['copy_paste_indicators'] = self._detect_copy_paste_behavior(df)

        # Temporal anomalies
        features_df['filing_time_anomaly'] = self._detect_filing_time_anomalies(df)
        features_df['data_entry_rhythm'] = self._analyze_data_entry_rhythm(df)

        # Cross-reference anomalies
        features_df['ip_location_mismatch'] = self._detect_location_mismatches(df)
        features_df['device_switching_frequency'] = self._analyze_device_patterns(df)

        # Advanced financial ratios
        features_df['expense_to_income_ratio'] = (
            df['total_expenses'] / np.maximum(df['gross_income'], 1)
        )

        features_df['deduction_diversity_score'] = self._calculate_deduction_diversity(df)
        features_df['tax_bracket_consistency'] = self._check_tax_bracket_consistency(df)

        return features_df

    def _detect_frequency_anomaly(self, df: pd.DataFrame, column: str, window_days: int) -> np.ndarray:
        """Detect unusual frequency patterns"""
        rolling_mean = df[column].rolling(window=window_days, min_periods=1).mean()
        rolling_std = df[column].rolling(window=window_days, min_periods=1).std()

        z_scores = np.abs((df[column] - rolling_mean) / np.maximum(rolling_std, 0.1))
        return (z_scores > 3).astype(int)

    def _detect_speed_anomaly(self, df: pd.DataFrame, column: str) -> np.ndarray:
        """Detect unusually fast or slow calculation speeds"""
        speeds = df[column].fillna(df[column].median())
        q1, q3 = speeds.quantile([0.25, 0.75])
        iqr = q3 - q1

        lower_bound = q1 - 3 * iqr
        upper_bound = q3 + 3 * iqr

        return ((speeds < lower_bound) | (speeds > upper_bound)).astype(int)

    def _detect_duration_anomaly(self, df: pd.DataFrame, column: str) -> np.ndarray:
        """Detect unusual session durations"""
        durations = df[column].fillna(df[column].median())

        # Use log transformation for skewed duration data
        log_durations = np.log1p(durations)
        z_scores = np.abs(stats.zscore(log_durations))

        return (z_scores > 3).astype(int)

    def _calculate_income_consistency(self, df: pd.DataFrame) -> np.ndarray:
        """Calculate income consistency score across multiple entries"""
        consistency_scores = []

        for idx, row in df.iterrows():
            # Check consistency between different income sources
            income_sources = [
                row.get('salary_income', 0),
                row.get('business_income', 0),
                row.get('investment_income', 0),
                row.get('other_income', 0)
            ]

            total_declared = sum(income_sources)
            gross_income = row.get('gross_income', 0)

            if gross_income > 0:
                consistency = abs(total_declared - gross_income) / gross_income
            else:
                consistency = 0

            consistency_scores.append(min(consistency, 1.0))

        return np.array(consistency_scores)

    def _detect_deduction_anomalies(self, df: pd.DataFrame) -> np.ndarray:
        """Detect unusual deduction patterns"""
        deduction_ratios = df['total_deductions'] / np.maximum(df['gross_income'], 1)

        # Calculate expected deduction ratio by income bracket
        income_brackets = pd.cut(df['gross_income'], bins=5, labels=['low', 'med_low', 'med', 'med_high', 'high'])
        expected_ratios = deduction_ratios.groupby(income_brackets).median()

        anomaly_scores = []
        for idx, row in df.iterrows():
            bracket = income_brackets.iloc[idx]
            actual_ratio = deduction_ratios.iloc[idx]
            expected_ratio = expected_ratios[bracket] if pd.notna(bracket) else deduction_ratios.median()

            anomaly_score = abs(actual_ratio - expected_ratio) / max(expected_ratio, 0.01)
            anomaly_scores.append(anomaly_score)

        return (np.array(anomaly_scores) > 2).astype(int)

    def _detect_tax_liability_anomalies(self, df: pd.DataFrame) -> np.ndarray:
        """Detect unusual tax liability calculations"""
        # Calculate expected tax liability based on income and standard patterns
        expected_tax_rates = {
            (0, 10000): 0.10,
            (10000, 40000): 0.12,
            (40000, 85000): 0.22,
            (85000, 163000): 0.24,
            (163000, 207000): 0.32,
            (207000, 518000): 0.35,
            (518000, float('inf')): 0.37
        }

        anomalies = []
        for idx, row in df.iterrows():
            income = row.get('gross_income', 0)
            actual_tax = row.get('tax_liability', 0)

            # Find expected tax rate
            expected_rate = 0.22  # Default
            for (min_inc, max_inc), rate in expected_tax_rates.items():
                if min_inc <= income < max_inc:
                    expected_rate = rate
                    break

            expected_tax = income * expected_rate
            if expected_tax > 0:
                deviation = abs(actual_tax - expected_tax) / expected_tax
                anomalies.append(1 if deviation > 0.5 else 0)
            else:
                anomalies.append(0)

        return np.array(anomalies)

    def _detect_round_number_patterns(self, df: pd.DataFrame) -> np.ndarray:
        """Detect suspicious round number patterns"""
        numeric_columns = ['gross_income', 'total_deductions', 'charitable_donations', 'business_expenses']
        round_scores = []

        for idx, row in df.iterrows():
            round_count = 0
            total_numbers = 0

            for col in numeric_columns:
                if col in row and pd.notna(row[col]) and row[col] > 0:
                    value = row[col]
                    total_numbers += 1

                    # Check if number is suspiciously round
                    if value % 1000 == 0 or value % 500 == 0:
                        round_count += 1
                    elif str(value).endswith('00') and value > 100:
                        round_count += 0.5

            round_ratio = round_count / max(total_numbers, 1)
            round_scores.append(round_ratio)

        return (np.array(round_scores) > 0.7).astype(int)

    def _detect_sequential_patterns(self, df: pd.DataFrame) -> np.ndarray:
        """Detect sequential input patterns that may indicate automated entry"""
        sequential_scores = []

        for idx, row in df.iterrows():
            # Check for sequential patterns in numerical inputs
            numeric_values = [
                row.get('gross_income', 0),
                row.get('total_deductions', 0),
                row.get('charitable_donations', 0),
                row.get('medical_expenses', 0)
            ]

            # Remove zeros and sort
            non_zero_values = sorted([v for v in numeric_values if v > 0])

            if len(non_zero_values) >= 3:
                # Check for arithmetic progression
                differences = [non_zero_values[i+1] - non_zero_values[i]
                             for i in range(len(non_zero_values)-1)]

                # Check if differences are roughly equal (arithmetic sequence)
                if len(set(differences)) <= 2 and max(differences) > 0:
                    sequential_scores.append(1)
                else:
                    sequential_scores.append(0)
            else:
                sequential_scores.append(0)

        return np.array(sequential_scores)

    def _detect_copy_paste_behavior(self, df: pd.DataFrame) -> np.ndarray:
        """Detect potential copy-paste behavior in form filling"""
        copy_paste_indicators = []

        for idx, row in df.iterrows():
            # Look for exact duplicates in related fields
            related_fields = [
                ['business_income', 'business_expenses'],
                ['investment_income', 'investment_expenses'],
                ['rental_income', 'rental_expenses']
            ]

            exact_matches = 0
            total_pairs = 0

            for field_pair in related_fields:
                if all(field in row for field in field_pair):
                    val1, val2 = row[field_pair[0]], row[field_pair[1]]
                    if pd.notna(val1) and pd.notna(val2) and val1 > 0 and val2 > 0:
                        total_pairs += 1
                        if val1 == val2:
                            exact_matches += 1

            if total_pairs > 0:
                match_ratio = exact_matches / total_pairs
                copy_paste_indicators.append(1 if match_ratio > 0.5 else 0)
            else:
                copy_paste_indicators.append(0)

        return np.array(copy_paste_indicators)

    def _detect_filing_time_anomalies(self, df: pd.DataFrame) -> np.ndarray:
        """Detect unusual filing time patterns"""
        if 'filing_timestamp' not in df.columns:
            return np.zeros(len(df))

        filing_times = pd.to_datetime(df['filing_timestamp'])
        anomalies = []

        for timestamp in filing_times:
            hour = timestamp.hour
            day_of_week = timestamp.dayofweek
            month = timestamp.month

            anomaly_score = 0

            # Unusual hours (3 AM - 6 AM)
            if 3 <= hour <= 6:
                anomaly_score += 0.5

            # Weekend filing for simple returns
            if day_of_week >= 5:  # Saturday or Sunday
                anomaly_score += 0.3

            # Filing outside tax season without obvious reason
            if month not in [1, 2, 3, 4, 10, 11, 12]:
                anomaly_score += 0.2

            anomalies.append(1 if anomaly_score > 0.7 else 0)

        return np.array(anomalies)

    def _analyze_data_entry_rhythm(self, df: pd.DataFrame) -> np.ndarray:
        """Analyze data entry rhythm for human vs automated patterns"""
        if 'keystroke_timings' not in df.columns:
            return np.zeros(len(df))

        rhythm_scores = []

        for idx, row in df.iterrows():
            timings = row.get('keystroke_timings', [])
            if len(timings) < 10:
                rhythm_scores.append(0)
                continue

            # Calculate coefficient of variation in keystroke intervals
            intervals = np.diff(timings)
            if len(intervals) > 0:
                cv = np.std(intervals) / np.mean(intervals)
                # Human typing has natural variation, automated has low variation
                rhythm_scores.append(1 if cv < 0.1 else 0)
            else:
                rhythm_scores.append(0)

        return np.array(rhythm_scores)

    def _detect_location_mismatches(self, df: pd.DataFrame) -> np.ndarray:
        """Detect mismatches between declared location and IP location"""
        mismatches = []

        for idx, row in df.iterrows():
            declared_state = row.get('state', '').upper()
            ip_state = row.get('ip_location_state', '').upper()

            if declared_state and ip_state:
                # Simple mismatch detection
                mismatch = 1 if declared_state != ip_state else 0
                mismatches.append(mismatch)
            else:
                mismatches.append(0)

        return np.array(mismatches)

    def _analyze_device_patterns(self, df: pd.DataFrame) -> np.ndarray:
        """Analyze device switching patterns"""
        if 'device_fingerprint' not in df.columns:
            return np.zeros(len(df))

        # Group by user and analyze device switching frequency
        device_switching = []

        for idx, row in df.iterrows():
            user_id = row.get('user_id')
            if user_id:
                user_data = df[df['user_id'] == user_id]
                unique_devices = user_data['device_fingerprint'].nunique()
                total_sessions = len(user_data)

                switching_ratio = unique_devices / max(total_sessions, 1)
                device_switching.append(1 if switching_ratio > 0.5 else 0)
            else:
                device_switching.append(0)

        return np.array(device_switching)

    def _calculate_deduction_diversity(self, df: pd.DataFrame) -> np.ndarray:
        """Calculate diversity score for deduction types"""
        deduction_columns = [
            'charitable_donations', 'medical_expenses', 'business_expenses',
            'education_expenses', 'home_office_deduction'
        ]

        diversity_scores = []

        for idx, row in df.iterrows():
            non_zero_deductions = sum(1 for col in deduction_columns
                                    if col in row and row[col] > 0)
            total_deductions = len(deduction_columns)

            diversity = non_zero_deductions / total_deductions
            diversity_scores.append(diversity)

        return np.array(diversity_scores)

    def _check_tax_bracket_consistency(self, df: pd.DataFrame) -> np.ndarray:
        """Check consistency between reported income and tax bracket behavior"""
        consistency_scores = []

        for idx, row in df.iterrows():
            income = row.get('gross_income', 0)
            deductions = row.get('total_deductions', 0)

            # Higher income taxpayers typically have more complex deductions
            expected_complexity = min(income / 50000, 3)  # Scale 0-3
            actual_complexity = min(deductions / 10000, 3)  # Scale 0-3

            consistency = 1 - abs(expected_complexity - actual_complexity) / 3
            consistency_scores.append(consistency)

        return np.array(consistency_scores)

    def fit(self, df: pd.DataFrame, labels: np.ndarray = None):
        """Train fraud detection model"""
        logger.info("Training fraud detection model")

        # Prepare features
        feature_df = self.prepare_fraud_features(df)

        # Select numerical features for anomaly detection
        numerical_features = feature_df.select_dtypes(include=[np.number]).columns
        X = feature_df[numerical_features].fillna(0)

        # Scale features
        X_scaled = self.scaler.fit_transform(X)

        # Apply PCA for dimensionality reduction
        X_pca = self.pca.fit_transform(X_scaled)

        # Fit isolation forest
        self.isolation_forest.fit(X_pca)

        # Calculate feature importance based on variance
        feature_variance = np.var(X_scaled, axis=0)
        self.feature_importance = dict(zip(numerical_features, feature_variance))

        self.is_fitted = True
        logger.info("Fraud detection model trained successfully")

    def predict_fraud_probability(self, df: pd.DataFrame) -> np.ndarray:
        """Predict fraud probability for new data"""
        if not self.is_fitted:
            raise ValueError("Model must be fitted before prediction")

        # Prepare features
        feature_df = self.prepare_fraud_features(df)

        # Select numerical features
        numerical_features = feature_df.select_dtypes(include=[np.number]).columns
        X = feature_df[numerical_features].fillna(0)

        # Scale and transform
        X_scaled = self.scaler.transform(X)
        X_pca = self.pca.transform(X_scaled)

        # Get anomaly scores
        anomaly_scores = self.isolation_forest.decision_function(X_pca)

        # Convert to probabilities (higher score = more normal)
        fraud_probabilities = 1 / (1 + np.exp(anomaly_scores))

        return fraud_probabilities

    def get_fraud_explanation(self, sample_data: Dict) -> Dict[str, Any]:
        """Generate explanation for fraud detection result"""
        explanation = {
            'fraud_indicators': [],
            'risk_level': 'low',
            'confidence': 0.0
        }

        # Analyze individual indicators
        sample_df = pd.DataFrame([sample_data])
        features = self.prepare_fraud_features(sample_df).iloc[0]

        high_risk_indicators = []
        medium_risk_indicators = []

        # Check each feature
        if features.get('login_frequency_anomaly', 0) == 1:
            high_risk_indicators.append("Unusual login frequency pattern")

        if features.get('calculation_speed_anomaly', 0) == 1:
            medium_risk_indicators.append("Unusually fast or slow calculation speed")

        if features.get('round_number_frequency', 0) == 1:
            high_risk_indicators.append("Suspicious round number patterns")

        if features.get('sequential_input_pattern', 0) == 1:
            high_risk_indicators.append("Sequential input patterns suggesting automation")

        if features.get('ip_location_mismatch', 0) == 1:
            medium_risk_indicators.append("Location mismatch between declared and actual")

        if features.get('deduction_ratio_anomaly', 0) == 1:
            high_risk_indicators.append("Unusual deduction-to-income ratio")

        # Determine risk level
        if len(high_risk_indicators) >= 2:
            explanation['risk_level'] = 'high'
            explanation['confidence'] = 0.8
        elif len(high_risk_indicators) >= 1 or len(medium_risk_indicators) >= 3:
            explanation['risk_level'] = 'medium'
            explanation['confidence'] = 0.6
        else:
            explanation['risk_level'] = 'low'
            explanation['confidence'] = 0.3

        explanation['fraud_indicators'] = high_risk_indicators + medium_risk_indicators

        return explanation


class UnusualPatternDetector:
    """Detect unusual patterns in tax calculations and user behavior"""

    def __init__(self):
        self.dbscan = DBSCAN(eps=0.5, min_samples=5)
        self.lof = LocalOutlierFactor(n_neighbors=20, contamination=0.1)
        self.pattern_models = {}

    def detect_calculation_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Detect unusual patterns in tax calculations"""
        patterns = {
            'income_clusters': self._analyze_income_clusters(df),
            'deduction_patterns': self._analyze_deduction_patterns(df),
            'temporal_patterns': self._analyze_temporal_patterns(df),
            'geographic_patterns': self._analyze_geographic_patterns(df)
        }

        return patterns

    def _analyze_income_clusters(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze income distribution clusters"""
        income_data = df[['gross_income', 'total_deductions']].dropna()

        if len(income_data) < 10:
            return {'clusters': 0, 'outliers': []}

        # Apply DBSCAN clustering
        clusters = self.dbscan.fit_predict(income_data)
        n_clusters = len(set(clusters)) - (1 if -1 in clusters else 0)
        outliers = income_data[clusters == -1].index.tolist()

        return {
            'clusters': n_clusters,
            'outliers': outliers,
            'cluster_labels': clusters.tolist()
        }

    def _analyze_deduction_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze deduction patterns"""
        deduction_columns = [
            'charitable_donations', 'medical_expenses', 'business_expenses',
            'education_expenses', 'home_office_deduction'
        ]

        available_columns = [col for col in deduction_columns if col in df.columns]
        deduction_data = df[available_columns].fillna(0)

        if len(deduction_data) < 5:
            return {'patterns': 'insufficient_data'}

        # Calculate correlation matrix
        correlation_matrix = deduction_data.corr()

        # Find unusual correlations
        unusual_correlations = []
        for i in range(len(correlation_matrix.columns)):
            for j in range(i+1, len(correlation_matrix.columns)):
                corr_value = correlation_matrix.iloc[i, j]
                if abs(corr_value) > 0.8:  # High correlation
                    unusual_correlations.append({
                        'variables': [correlation_matrix.columns[i], correlation_matrix.columns[j]],
                        'correlation': float(corr_value)
                    })

        return {
            'unusual_correlations': unusual_correlations,
            'correlation_matrix': correlation_matrix.to_dict()
        }

    def _analyze_temporal_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze temporal patterns in filings"""
        if 'filing_timestamp' not in df.columns:
            return {'patterns': 'no_timestamp_data'}

        df['filing_hour'] = pd.to_datetime(df['filing_timestamp']).dt.hour
        df['filing_day'] = pd.to_datetime(df['filing_timestamp']).dt.dayofweek
        df['filing_month'] = pd.to_datetime(df['filing_timestamp']).dt.month

        hourly_distribution = df['filing_hour'].value_counts().to_dict()
        daily_distribution = df['filing_day'].value_counts().to_dict()
        monthly_distribution = df['filing_month'].value_counts().to_dict()

        # Detect unusual temporal patterns
        unusual_hours = [hour for hour, count in hourly_distribution.items()
                        if hour in [0, 1, 2, 3, 4, 5] and count > len(df) * 0.1]

        return {
            'hourly_distribution': hourly_distribution,
            'daily_distribution': daily_distribution,
            'monthly_distribution': monthly_distribution,
            'unusual_hours': unusual_hours
        }

    def _analyze_geographic_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze geographic patterns"""
        if 'state' not in df.columns:
            return {'patterns': 'no_geographic_data'}

        state_distribution = df['state'].value_counts().to_dict()

        # Calculate average income by state
        state_income_avg = df.groupby('state')['gross_income'].mean().to_dict()

        # Detect unusual state patterns
        total_filings = len(df)
        unusual_states = [state for state, count in state_distribution.items()
                         if count / total_filings > 0.5]  # More than 50% from one state

        return {
            'state_distribution': state_distribution,
            'state_income_averages': state_income_avg,
            'unusual_concentrations': unusual_states
        }


class TaxLawComplianceMonitor:
    """Monitor for tax law compliance and detect potential violations"""

    def __init__(self):
        self.compliance_rules = self._setup_compliance_rules()
        self.violation_history = {}

    def _setup_compliance_rules(self) -> Dict[str, Dict]:
        """Setup compliance rules based on tax law"""
        return {
            'irs_limits_2024': {
                'standard_deduction_single': 14600,
                'standard_deduction_married': 29200,
                '401k_contribution_limit': 23000,
                'ira_contribution_limit': 7000,
                'hsa_contribution_limit_individual': 4300,
                'hsa_contribution_limit_family': 8550,
                'charitable_deduction_limit_agi_pct': 60,
                'business_meal_deduction_pct': 50
            },
            'income_thresholds': {
                'eitc_max_income_no_children': 17640,
                'eitc_max_income_one_child': 46560,
                'eitc_max_income_two_children': 52918,
                'eitc_max_income_three_plus_children': 56838,
                'additional_medicare_tax_threshold': 200000,
                'net_investment_income_tax_threshold': 200000
            },
            'business_rules': {
                'home_office_exclusive_use': True,
                'business_expense_ordinary_necessary': True,
                'depreciation_useful_life_minimum': 1
            }
        }

    def check_compliance(self, tax_data: Dict) -> Dict[str, Any]:
        """Check tax data for compliance violations"""
        violations = []
        warnings = []

        # Check IRS limits
        irs_violations = self._check_irs_limits(tax_data)
        violations.extend(irs_violations)

        # Check income thresholds
        threshold_warnings = self._check_income_thresholds(tax_data)
        warnings.extend(threshold_warnings)

        # Check business rules
        business_violations = self._check_business_rules(tax_data)
        violations.extend(business_violations)

        # Check mathematical consistency
        math_violations = self._check_mathematical_consistency(tax_data)
        violations.extend(math_violations)

        compliance_score = self._calculate_compliance_score(violations, warnings)

        return {
            'compliance_score': compliance_score,
            'violations': violations,
            'warnings': warnings,
            'risk_level': self._determine_risk_level(compliance_score, violations)
        }

    def _check_irs_limits(self, tax_data: Dict) -> List[Dict]:
        """Check against IRS contribution and deduction limits"""
        violations = []
        limits = self.compliance_rules['irs_limits_2024']

        # Check 401k contributions
        if tax_data.get('401k_contribution', 0) > limits['401k_contribution_limit']:
            violations.append({
                'type': 'irs_limit_exceeded',
                'rule': '401k_contribution_limit',
                'limit': limits['401k_contribution_limit'],
                'actual': tax_data.get('401k_contribution', 0),
                'severity': 'high'
            })

        # Check IRA contributions
        if tax_data.get('ira_contribution', 0) > limits['ira_contribution_limit']:
            violations.append({
                'type': 'irs_limit_exceeded',
                'rule': 'ira_contribution_limit',
                'limit': limits['ira_contribution_limit'],
                'actual': tax_data.get('ira_contribution', 0),
                'severity': 'high'
            })

        # Check charitable deduction limit
        agi = tax_data.get('adjusted_gross_income', 0)
        charitable_limit = agi * (limits['charitable_deduction_limit_agi_pct'] / 100)
        if tax_data.get('charitable_donations', 0) > charitable_limit:
            violations.append({
                'type': 'deduction_limit_exceeded',
                'rule': 'charitable_deduction_limit',
                'limit': charitable_limit,
                'actual': tax_data.get('charitable_donations', 0),
                'severity': 'medium'
            })

        return violations

    def _check_income_thresholds(self, tax_data: Dict) -> List[Dict]:
        """Check income-based thresholds and eligibility"""
        warnings = []
        thresholds = self.compliance_rules['income_thresholds']

        income = tax_data.get('adjusted_gross_income', 0)
        dependents = tax_data.get('number_of_dependents', 0)

        # Check EITC eligibility
        if tax_data.get('earned_income_credit', 0) > 0:
            if dependents == 0 and income > thresholds['eitc_max_income_no_children']:
                warnings.append({
                    'type': 'eitc_income_too_high',
                    'threshold': thresholds['eitc_max_income_no_children'],
                    'actual_income': income,
                    'severity': 'medium'
                })

        # Check additional Medicare tax threshold
        if income > thresholds['additional_medicare_tax_threshold']:
            if not tax_data.get('additional_medicare_tax_paid', False):
                warnings.append({
                    'type': 'additional_medicare_tax_required',
                    'threshold': thresholds['additional_medicare_tax_threshold'],
                    'actual_income': income,
                    'severity': 'high'
                })

        return warnings

    def _check_business_rules(self, tax_data: Dict) -> List[Dict]:
        """Check business-related compliance rules"""
        violations = []

        # Check home office deduction
        if tax_data.get('home_office_deduction', 0) > 0:
            if not tax_data.get('home_office_exclusive_use', False):
                violations.append({
                    'type': 'home_office_exclusive_use_required',
                    'rule': 'home_office_exclusive_use',
                    'severity': 'high'
                })

        # Check business meal deduction percentage
        business_meals = tax_data.get('business_meal_expenses', 0)
        business_meal_deduction = tax_data.get('business_meal_deduction', 0)

        if business_meals > 0:
            max_deduction = business_meals * 0.5  # 50% limit
            if business_meal_deduction > max_deduction:
                violations.append({
                    'type': 'business_meal_deduction_percentage_exceeded',
                    'rule': 'business_meal_deduction_pct',
                    'limit': max_deduction,
                    'actual': business_meal_deduction,
                    'severity': 'medium'
                })

        return violations

    def _check_mathematical_consistency(self, tax_data: Dict) -> List[Dict]:
        """Check for mathematical consistency in tax calculations"""
        violations = []

        # Check that total income equals sum of income sources
        income_sources = [
            tax_data.get('salary_income', 0),
            tax_data.get('business_income', 0),
            tax_data.get('investment_income', 0),
            tax_data.get('other_income', 0)
        ]

        calculated_total = sum(income_sources)
        reported_total = tax_data.get('gross_income', 0)

        if abs(calculated_total - reported_total) > 1:  # Allow $1 rounding difference
            violations.append({
                'type': 'income_calculation_mismatch',
                'calculated': calculated_total,
                'reported': reported_total,
                'difference': abs(calculated_total - reported_total),
                'severity': 'high'
            })

        # Check AGI calculation
        gross_income = tax_data.get('gross_income', 0)
        adjustments = tax_data.get('adjustments_to_income', 0)
        reported_agi = tax_data.get('adjusted_gross_income', 0)
        calculated_agi = gross_income - adjustments

        if abs(calculated_agi - reported_agi) > 1:
            violations.append({
                'type': 'agi_calculation_mismatch',
                'calculated': calculated_agi,
                'reported': reported_agi,
                'difference': abs(calculated_agi - reported_agi),
                'severity': 'high'
            })

        return violations

    def _calculate_compliance_score(self, violations: List[Dict], warnings: List[Dict]) -> float:
        """Calculate overall compliance score"""
        base_score = 100.0

        # Deduct points for violations
        for violation in violations:
            if violation['severity'] == 'high':
                base_score -= 20
            elif violation['severity'] == 'medium':
                base_score -= 10
            else:
                base_score -= 5

        # Deduct points for warnings
        for warning in warnings:
            if warning['severity'] == 'high':
                base_score -= 10
            elif warning['severity'] == 'medium':
                base_score -= 5
            else:
                base_score -= 2

        return max(base_score, 0.0)

    def _determine_risk_level(self, compliance_score: float, violations: List[Dict]) -> str:
        """Determine overall risk level"""
        high_severity_violations = len([v for v in violations if v['severity'] == 'high'])

        if compliance_score < 60 or high_severity_violations >= 2:
            return 'high'
        elif compliance_score < 80 or high_severity_violations >= 1:
            return 'medium'
        else:
            return 'low'


if __name__ == "__main__":
    # Example usage
    fraud_detector = FraudDetectionEngine()
    pattern_detector = UnusualPatternDetector()
    compliance_monitor = TaxLawComplianceMonitor()

    # Example tax data for compliance check
    sample_tax_data = {
        'gross_income': 75000,
        'adjusted_gross_income': 70000,
        'salary_income': 75000,
        'business_income': 0,
        'investment_income': 0,
        'other_income': 0,
        'adjustments_to_income': 5000,
        '401k_contribution': 22000,
        'ira_contribution': 6000,
        'charitable_donations': 8000,
        'number_of_dependents': 1
    }

    # Check compliance
    compliance_result = compliance_monitor.check_compliance(sample_tax_data)
    print("Compliance Result:")
    print(f"Score: {compliance_result['compliance_score']}")
    print(f"Risk Level: {compliance_result['risk_level']}")
    print(f"Violations: {len(compliance_result['violations'])}")
    print(f"Warnings: {len(compliance_result['warnings'])}")

    logger.info("Anomaly detection system demo completed")