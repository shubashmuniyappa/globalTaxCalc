"""
Personalization Engine
Advanced recommendation and personalization models
"""

import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.decomposition import TruncatedSVD
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
import lightgbm as lgb
import pickle
import logging
from typing import Dict, List, Any, Tuple, Optional
from datetime import datetime, timedelta
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ContentRecommendationEngine:
    """Content-based and collaborative filtering recommendation system"""

    def __init__(self):
        self.content_vectorizer = TfidfVectorizer(
            max_features=10000,
            stop_words='english',
            ngram_range=(1, 2)
        )
        self.svd_model = TruncatedSVD(n_components=100)
        self.content_similarity = None
        self.user_item_matrix = None
        self.content_features = None

    def prepare_content_data(self, content_df: pd.DataFrame) -> pd.DataFrame:
        """Prepare content data with features"""
        features_df = content_df.copy()

        # Combine text features
        features_df['combined_text'] = (
            features_df['title'].fillna('') + ' ' +
            features_df['description'].fillna('') + ' ' +
            features_df['tags'].fillna('') + ' ' +
            features_df['category'].fillna('')
        )

        # Content type encoding
        content_type_mapping = {
            'tax_tip': 1, 'calculator': 2, 'guide': 3,
            'video': 4, 'blog': 5, 'tool': 6
        }
        features_df['content_type_encoded'] = features_df['content_type'].map(content_type_mapping)

        # Difficulty level
        difficulty_mapping = {'beginner': 1, 'intermediate': 2, 'advanced': 3}
        features_df['difficulty_encoded'] = features_df['difficulty'].map(difficulty_mapping)

        # Seasonal relevance
        current_month = datetime.now().month
        features_df['seasonal_relevance'] = features_df.apply(
            lambda row: self._calculate_seasonal_relevance(row, current_month), axis=1
        )

        # Popularity score
        features_df['popularity_score'] = (
            features_df['view_count'] * 0.3 +
            features_df['engagement_rate'] * 0.4 +
            features_df['rating'] * 0.3
        )

        return features_df

    def _calculate_seasonal_relevance(self, content_row, current_month):
        """Calculate seasonal relevance score"""
        seasonal_content = {
            'tax_filing': [1, 2, 3, 4],  # Jan-Apr
            'year_end_planning': [10, 11, 12],  # Oct-Dec
            'quarterly_taxes': [3, 6, 9, 12],  # Quarterly
            'retirement_planning': list(range(1, 13)),  # Year-round
        }

        content_tags = content_row.get('tags', '').lower()
        relevance_score = 0.5  # Default

        for tag, months in seasonal_content.items():
            if tag in content_tags and current_month in months:
                relevance_score = 1.0
                break

        return relevance_score

    def fit_content_model(self, content_df: pd.DataFrame, interaction_df: pd.DataFrame):
        """Train content-based recommendation model"""
        logger.info("Training content recommendation model")

        # Prepare content features
        content_features = self.prepare_content_data(content_df)

        # Create content similarity matrix
        text_features = self.content_vectorizer.fit_transform(content_features['combined_text'])
        self.content_similarity = cosine_similarity(text_features)

        # Prepare user-item matrix for collaborative filtering
        self.user_item_matrix = interaction_df.pivot_table(
            index='user_id',
            columns='content_id',
            values='rating',
            fill_value=0
        )

        # Fit SVD for collaborative filtering
        if self.user_item_matrix.shape[1] > 100:
            self.svd_model.fit(self.user_item_matrix.values)

        self.content_features = content_features
        logger.info("Content recommendation model trained successfully")

    def get_content_recommendations(self, user_id: int, content_id: int = None,
                                  user_profile: Dict = None, top_k: int = 10) -> List[Dict]:
        """Get content recommendations for user"""

        if content_id:
            # Content-based recommendations
            recommendations = self._get_content_based_recommendations(content_id, top_k)
        else:
            # Hybrid recommendations
            content_recs = self._get_collaborative_recommendations(user_id, top_k // 2)
            profile_recs = self._get_profile_based_recommendations(user_profile, top_k // 2)
            recommendations = content_recs + profile_recs

        # Apply personalization filters
        if user_profile:
            recommendations = self._apply_personalization_filters(recommendations, user_profile)

        return recommendations[:top_k]

    def _get_content_based_recommendations(self, content_id: int, top_k: int) -> List[Dict]:
        """Get content-based recommendations"""
        if self.content_similarity is None:
            return []

        content_idx = self.content_features[self.content_features['content_id'] == content_id].index[0]
        similarity_scores = self.content_similarity[content_idx]

        # Get top similar content
        similar_indices = np.argsort(similarity_scores)[::-1][1:top_k+1]

        recommendations = []
        for idx in similar_indices:
            content_row = self.content_features.iloc[idx]
            recommendations.append({
                'content_id': content_row['content_id'],
                'title': content_row['title'],
                'score': float(similarity_scores[idx]),
                'reason': 'content_similarity'
            })

        return recommendations

    def _get_collaborative_recommendations(self, user_id: int, top_k: int) -> List[Dict]:
        """Get collaborative filtering recommendations"""
        if user_id not in self.user_item_matrix.index:
            return []

        user_idx = self.user_item_matrix.index.get_loc(user_id)
        user_vector = self.user_item_matrix.values[user_idx:user_idx+1]

        if hasattr(self.svd_model, 'components_'):
            # Transform user vector
            user_reduced = self.svd_model.transform(user_vector)

            # Calculate scores for all items
            item_scores = user_reduced.dot(self.svd_model.components_)

            # Get unrated items
            unrated_items = np.where(user_vector[0] == 0)[0]
            item_scores_filtered = [(idx, item_scores[0][idx]) for idx in unrated_items]
            item_scores_filtered.sort(key=lambda x: x[1], reverse=True)

            recommendations = []
            for item_idx, score in item_scores_filtered[:top_k]:
                content_id = self.user_item_matrix.columns[item_idx]
                content_row = self.content_features[self.content_features['content_id'] == content_id]

                if not content_row.empty:
                    recommendations.append({
                        'content_id': content_id,
                        'title': content_row.iloc[0]['title'],
                        'score': float(score),
                        'reason': 'collaborative_filtering'
                    })

            return recommendations

        return []

    def _get_profile_based_recommendations(self, user_profile: Dict, top_k: int) -> List[Dict]:
        """Get recommendations based on user profile"""
        if not user_profile or self.content_features is None:
            return []

        # Calculate profile-content match scores
        content_scores = []

        for _, content in self.content_features.iterrows():
            score = self._calculate_profile_match_score(user_profile, content)
            content_scores.append((content['content_id'], score, content['title']))

        # Sort by score
        content_scores.sort(key=lambda x: x[1], reverse=True)

        recommendations = []
        for content_id, score, title in content_scores[:top_k]:
            recommendations.append({
                'content_id': content_id,
                'title': title,
                'score': score,
                'reason': 'profile_match'
            })

        return recommendations

    def _calculate_profile_match_score(self, user_profile: Dict, content: pd.Series) -> float:
        """Calculate how well content matches user profile"""
        score = 0.0

        # Income bracket matching
        if user_profile.get('income_bracket') == content.get('target_income_bracket'):
            score += 0.3

        # Filing status matching
        if user_profile.get('filing_status') in str(content.get('applicable_filing_status', '')):
            score += 0.2

        # Complexity matching
        user_experience = user_profile.get('tax_experience_level', 'beginner')
        if user_experience == content.get('difficulty'):
            score += 0.2

        # Seasonal relevance
        score += content.get('seasonal_relevance', 0.5) * 0.1

        # Popularity boost
        score += content.get('popularity_score', 0.5) * 0.2

        return score

    def _apply_personalization_filters(self, recommendations: List[Dict],
                                     user_profile: Dict) -> List[Dict]:
        """Apply personalization filters to recommendations"""

        # Filter by user preferences
        filtered_recs = []
        for rec in recommendations:
            content = self.content_features[
                self.content_features['content_id'] == rec['content_id']
            ]

            if not content.empty:
                content_row = content.iloc[0]

                # Skip if content doesn't match user's complexity preference
                user_level = user_profile.get('tax_experience_level', 'beginner')
                content_level = content_row.get('difficulty', 'beginner')

                if self._is_appropriate_difficulty(user_level, content_level):
                    filtered_recs.append(rec)

        return filtered_recs

    def _is_appropriate_difficulty(self, user_level: str, content_level: str) -> bool:
        """Check if content difficulty is appropriate for user"""
        difficulty_order = {'beginner': 1, 'intermediate': 2, 'advanced': 3}

        user_score = difficulty_order.get(user_level, 1)
        content_score = difficulty_order.get(content_level, 1)

        # Allow content at user level or one level above
        return content_score <= user_score + 1


class PersonalizedTipsEngine:
    """Generate personalized tax tips and advice"""

    def __init__(self):
        self.tip_scorer = RandomForestRegressor(n_estimators=100, random_state=42)
        self.scaler = StandardScaler()
        self.is_fitted = False

    def prepare_tip_features(self, user_data: pd.DataFrame, tips_data: pd.DataFrame) -> pd.DataFrame:
        """Prepare features for tip personalization"""

        # Create user-tip interaction features
        features_list = []

        for _, user in user_data.iterrows():
            for _, tip in tips_data.iterrows():
                feature_row = {
                    'user_id': user['user_id'],
                    'tip_id': tip['tip_id'],

                    # User features
                    'user_income': user.get('income', 0),
                    'user_age': user.get('age', 0),
                    'user_filing_status': user.get('filing_status', ''),
                    'user_state': user.get('state', ''),
                    'user_has_dependents': user.get('has_dependents', 0),
                    'user_is_business_owner': user.get('is_business_owner', 0),
                    'user_tax_experience': user.get('tax_experience_level', 'beginner'),

                    # Tip features
                    'tip_category': tip.get('category', ''),
                    'tip_complexity': tip.get('complexity_level', 'beginner'),
                    'tip_savings_potential': tip.get('avg_savings_amount', 0),
                    'tip_applicability_score': tip.get('general_applicability', 0.5),

                    # Interaction features
                    'income_tip_match': self._calculate_income_tip_match(user, tip),
                    'filing_status_match': self._calculate_filing_status_match(user, tip),
                    'complexity_match': self._calculate_complexity_match(user, tip),
                    'savings_to_income_ratio': tip.get('avg_savings_amount', 0) / max(user.get('income', 1), 1),
                }

                features_list.append(feature_row)

        return pd.DataFrame(features_list)

    def _calculate_income_tip_match(self, user: pd.Series, tip: pd.Series) -> float:
        """Calculate how well tip matches user's income level"""
        user_income = user.get('income', 0)
        tip_income_ranges = tip.get('applicable_income_ranges', '').split(',')

        for income_range in tip_income_ranges:
            if '-' in income_range:
                try:
                    min_income, max_income = map(int, income_range.strip().split('-'))
                    if min_income <= user_income <= max_income:
                        return 1.0
                except:
                    continue

        return 0.0

    def _calculate_filing_status_match(self, user: pd.Series, tip: pd.Series) -> float:
        """Calculate filing status compatibility"""
        user_status = user.get('filing_status', '').lower()
        applicable_statuses = tip.get('applicable_filing_statuses', '').lower()

        if user_status in applicable_statuses or 'all' in applicable_statuses:
            return 1.0

        return 0.0

    def _calculate_complexity_match(self, user: pd.Series, tip: pd.Series) -> float:
        """Calculate complexity level match"""
        complexity_mapping = {'beginner': 1, 'intermediate': 2, 'advanced': 3}

        user_level = complexity_mapping.get(user.get('tax_experience_level', 'beginner'), 1)
        tip_level = complexity_mapping.get(tip.get('complexity_level', 'beginner'), 1)

        # Prefer tips at or slightly above user level
        if tip_level <= user_level + 1:
            return 1.0 - abs(tip_level - user_level) / 3.0

        return 0.0

    def fit(self, user_data: pd.DataFrame, tips_data: pd.DataFrame,
            interaction_data: pd.DataFrame):
        """Train tip personalization model"""
        logger.info("Training personalized tips model")

        # Prepare features
        feature_df = self.prepare_tip_features(user_data, tips_data)

        # Merge with interaction data (ratings/engagement)
        merged_df = feature_df.merge(
            interaction_data[['user_id', 'tip_id', 'rating', 'engagement_score']],
            on=['user_id', 'tip_id'],
            how='left'
        )

        # Create target variable (combination of rating and engagement)
        merged_df['target'] = (
            merged_df['rating'].fillna(3.0) * 0.6 +
            merged_df['engagement_score'].fillna(0.5) * 4.0 * 0.4
        )

        # Prepare features for model
        feature_columns = [
            'user_income', 'user_age', 'user_has_dependents', 'user_is_business_owner',
            'tip_savings_potential', 'tip_applicability_score',
            'income_tip_match', 'filing_status_match', 'complexity_match',
            'savings_to_income_ratio'
        ]

        X = merged_df[feature_columns].fillna(0)
        y = merged_df['target']

        # Scale features
        X_scaled = self.scaler.fit_transform(X)

        # Train model
        self.tip_scorer.fit(X_scaled, y)
        self.is_fitted = True

        logger.info("Personalized tips model trained successfully")

    def get_personalized_tips(self, user_profile: Dict, tips_data: pd.DataFrame,
                            top_k: int = 5) -> List[Dict]:
        """Get personalized tips for user"""
        if not self.is_fitted:
            logger.warning("Model not fitted. Using fallback method.")
            return self._get_fallback_tips(user_profile, tips_data, top_k)

        # Prepare features for all tips
        tip_scores = []

        for _, tip in tips_data.iterrows():
            # Create feature vector
            features = [
                user_profile.get('income', 0),
                user_profile.get('age', 0),
                user_profile.get('has_dependents', 0),
                user_profile.get('is_business_owner', 0),
                tip.get('avg_savings_amount', 0),
                tip.get('general_applicability', 0.5),
                self._calculate_income_tip_match(pd.Series(user_profile), tip),
                self._calculate_filing_status_match(pd.Series(user_profile), tip),
                self._calculate_complexity_match(pd.Series(user_profile), tip),
                tip.get('avg_savings_amount', 0) / max(user_profile.get('income', 1), 1)
            ]

            # Get prediction
            features_scaled = self.scaler.transform([features])
            score = self.tip_scorer.predict(features_scaled)[0]

            tip_scores.append((tip['tip_id'], score, tip))

        # Sort by score and return top tips
        tip_scores.sort(key=lambda x: x[1], reverse=True)

        personalized_tips = []
        for tip_id, score, tip_data in tip_scores[:top_k]:
            personalized_tips.append({
                'tip_id': tip_id,
                'title': tip_data['title'],
                'content': tip_data['content'],
                'category': tip_data['category'],
                'potential_savings': tip_data.get('avg_savings_amount', 0),
                'personalization_score': float(score),
                'reason': self._generate_personalization_reason(user_profile, tip_data)
            })

        return personalized_tips

    def _get_fallback_tips(self, user_profile: Dict, tips_data: pd.DataFrame,
                          top_k: int) -> List[Dict]:
        """Fallback method when model is not fitted"""
        # Simple rule-based personalization
        scored_tips = []

        for _, tip in tips_data.iterrows():
            score = 0.5  # Base score

            # Income-based scoring
            if self._calculate_income_tip_match(pd.Series(user_profile), tip) > 0:
                score += 0.3

            # Filing status match
            if self._calculate_filing_status_match(pd.Series(user_profile), tip) > 0:
                score += 0.2

            # Complexity match
            score += self._calculate_complexity_match(pd.Series(user_profile), tip) * 0.3

            scored_tips.append((tip['tip_id'], score, tip))

        scored_tips.sort(key=lambda x: x[1], reverse=True)

        return [
            {
                'tip_id': tip_id,
                'title': tip_data['title'],
                'content': tip_data['content'],
                'category': tip_data['category'],
                'potential_savings': tip_data.get('avg_savings_amount', 0),
                'personalization_score': float(score),
                'reason': 'Basic profile matching'
            }
            for tip_id, score, tip_data in scored_tips[:top_k]
        ]

    def _generate_personalization_reason(self, user_profile: Dict, tip_data: pd.Series) -> str:
        """Generate explanation for why tip was recommended"""
        reasons = []

        if self._calculate_income_tip_match(pd.Series(user_profile), tip_data) > 0:
            reasons.append("matches your income level")

        if self._calculate_filing_status_match(pd.Series(user_profile), tip_data) > 0:
            reasons.append("relevant to your filing status")

        if user_profile.get('is_business_owner') and 'business' in tip_data.get('category', '').lower():
            reasons.append("tailored for business owners")

        if user_profile.get('has_dependents') and 'dependent' in tip_data.get('content', '').lower():
            reasons.append("helpful for families with dependents")

        if reasons:
            return f"Recommended because it {', '.join(reasons)}"
        else:
            return "Popular tip that may apply to your situation"


class CalculatorSuggestionEngine:
    """Suggest relevant calculators based on user context"""

    def __init__(self):
        self.calculator_metadata = {}
        self.user_calculator_patterns = {}

    def setup_calculator_metadata(self):
        """Setup metadata for all available calculators"""
        self.calculator_metadata = {
            'standard_deduction': {
                'name': 'Standard Deduction Calculator',
                'description': 'Calculate your standard deduction amount',
                'complexity': 'beginner',
                'applicable_users': ['all'],
                'seasonal_relevance': [1, 2, 3, 4],
                'prerequisites': [],
                'estimated_time': 2
            },
            'itemized_deduction': {
                'name': 'Itemized Deduction Calculator',
                'description': 'Compare itemized vs standard deductions',
                'complexity': 'intermediate',
                'applicable_users': ['homeowners', 'high_income', 'charitable_donors'],
                'seasonal_relevance': [1, 2, 3, 4],
                'prerequisites': ['expense_records'],
                'estimated_time': 15
            },
            'tax_withholding': {
                'name': 'Tax Withholding Calculator',
                'description': 'Optimize your tax withholding',
                'complexity': 'intermediate',
                'applicable_users': ['employees', 'multiple_jobs'],
                'seasonal_relevance': list(range(1, 13)),
                'prerequisites': ['recent_paystub'],
                'estimated_time': 10
            },
            'estimated_taxes': {
                'name': 'Quarterly Estimated Tax Calculator',
                'description': 'Calculate quarterly tax payments',
                'complexity': 'intermediate',
                'applicable_users': ['self_employed', 'business_owners', 'freelancers'],
                'seasonal_relevance': [3, 6, 9, 12],
                'prerequisites': ['income_projection'],
                'estimated_time': 20
            },
            'retirement_contribution': {
                'name': 'Retirement Contribution Calculator',
                'description': 'Optimize retirement contributions for tax savings',
                'complexity': 'intermediate',
                'applicable_users': ['employed', 'self_employed'],
                'seasonal_relevance': [10, 11, 12, 1],
                'prerequisites': ['income_info'],
                'estimated_time': 12
            },
            'business_expense': {
                'name': 'Business Expense Deduction Calculator',
                'description': 'Calculate business expense deductions',
                'complexity': 'advanced',
                'applicable_users': ['business_owners', 'self_employed', 'freelancers'],
                'seasonal_relevance': [1, 2, 3, 4],
                'prerequisites': ['business_records'],
                'estimated_time': 25
            },
            'capital_gains': {
                'name': 'Capital Gains Tax Calculator',
                'description': 'Calculate capital gains tax liability',
                'complexity': 'intermediate',
                'applicable_users': ['investors', 'homeowners'],
                'seasonal_relevance': [1, 2, 3, 4],
                'prerequisites': ['investment_records'],
                'estimated_time': 18
            },
            'education_credits': {
                'name': 'Education Credit Calculator',
                'description': 'Calculate education tax credits',
                'complexity': 'intermediate',
                'applicable_users': ['students', 'parents', 'education_expenses'],
                'seasonal_relevance': [1, 2, 3, 4],
                'prerequisites': ['education_expenses'],
                'estimated_time': 10
            }
        }

    def get_calculator_suggestions(self, user_profile: Dict, context: Dict = None,
                                 top_k: int = 3) -> List[Dict]:
        """Get personalized calculator suggestions"""
        if not self.calculator_metadata:
            self.setup_calculator_metadata()

        calculator_scores = []
        current_month = datetime.now().month

        for calc_id, calc_info in self.calculator_metadata.items():
            score = self._calculate_calculator_relevance_score(
                calc_id, calc_info, user_profile, context, current_month
            )

            calculator_scores.append((calc_id, score, calc_info))

        # Sort by relevance score
        calculator_scores.sort(key=lambda x: x[1], reverse=True)

        suggestions = []
        for calc_id, score, calc_info in calculator_scores[:top_k]:
            suggestion = {
                'calculator_id': calc_id,
                'name': calc_info['name'],
                'description': calc_info['description'],
                'relevance_score': float(score),
                'estimated_time_minutes': calc_info['estimated_time'],
                'complexity': calc_info['complexity'],
                'reason': self._generate_suggestion_reason(calc_info, user_profile, context)
            }
            suggestions.append(suggestion)

        return suggestions

    def _calculate_calculator_relevance_score(self, calc_id: str, calc_info: Dict,
                                            user_profile: Dict, context: Dict,
                                            current_month: int) -> float:
        """Calculate relevance score for calculator"""
        score = 0.0

        # Base applicability score
        user_types = self._determine_user_types(user_profile)
        applicable_users = calc_info.get('applicable_users', [])

        if 'all' in applicable_users:
            score += 0.3
        else:
            overlap = len(set(user_types) & set(applicable_users))
            if overlap > 0:
                score += 0.5 * (overlap / len(applicable_users))

        # Seasonal relevance
        seasonal_months = calc_info.get('seasonal_relevance', [])
        if current_month in seasonal_months:
            score += 0.2

        # Complexity match
        user_experience = user_profile.get('tax_experience_level', 'beginner')
        calc_complexity = calc_info.get('complexity', 'beginner')

        complexity_scores = {
            ('beginner', 'beginner'): 0.3,
            ('beginner', 'intermediate'): 0.1,
            ('beginner', 'advanced'): 0.0,
            ('intermediate', 'beginner'): 0.2,
            ('intermediate', 'intermediate'): 0.3,
            ('intermediate', 'advanced'): 0.2,
            ('advanced', 'beginner'): 0.1,
            ('advanced', 'intermediate'): 0.2,
            ('advanced', 'advanced'): 0.3
        }

        score += complexity_scores.get((user_experience, calc_complexity), 0.1)

        # Context-based boosting
        if context:
            score += self._apply_context_boost(calc_id, context)

        # Previous usage patterns
        if calc_id in self.user_calculator_patterns.get(user_profile.get('user_id'), {}):
            # Slight boost for previously used calculators
            score += 0.1

        return min(score, 1.0)  # Cap at 1.0

    def _determine_user_types(self, user_profile: Dict) -> List[str]:
        """Determine user types from profile"""
        user_types = []

        if user_profile.get('is_business_owner'):
            user_types.extend(['business_owners', 'self_employed'])

        if user_profile.get('is_employee'):
            user_types.append('employees')

        if user_profile.get('is_freelancer'):
            user_types.extend(['freelancers', 'self_employed'])

        if user_profile.get('owns_home'):
            user_types.append('homeowners')

        if user_profile.get('has_investments'):
            user_types.append('investors')

        if user_profile.get('has_dependents'):
            user_types.append('parents')

        if user_profile.get('is_student') or user_profile.get('education_expenses', 0) > 0:
            user_types.extend(['students', 'education_expenses'])

        if user_profile.get('charitable_donations', 0) > 0:
            user_types.append('charitable_donors')

        if user_profile.get('income', 0) > 100000:
            user_types.append('high_income')

        if user_profile.get('has_multiple_jobs'):
            user_types.append('multiple_jobs')

        return user_types

    def _apply_context_boost(self, calc_id: str, context: Dict) -> float:
        """Apply context-based score boost"""
        boost = 0.0

        # Current page context
        current_page = context.get('current_page', '')
        if 'deduction' in current_page and 'deduction' in calc_id:
            boost += 0.2
        elif 'retirement' in current_page and 'retirement' in calc_id:
            boost += 0.2
        elif 'business' in current_page and 'business' in calc_id:
            boost += 0.2

        # Recent calculations
        recent_calcs = context.get('recent_calculations', [])
        for recent_calc in recent_calcs:
            if self._are_related_calculators(calc_id, recent_calc):
                boost += 0.1
                break

        # User goals
        user_goals = context.get('user_goals', [])
        goal_calculator_mapping = {
            'maximize_deductions': ['itemized_deduction', 'business_expense'],
            'reduce_withholding': ['tax_withholding'],
            'retirement_planning': ['retirement_contribution'],
            'quarterly_payments': ['estimated_taxes'],
            'investment_optimization': ['capital_gains']
        }

        for goal in user_goals:
            if calc_id in goal_calculator_mapping.get(goal, []):
                boost += 0.15

        return boost

    def _are_related_calculators(self, calc1: str, calc2: str) -> bool:
        """Check if two calculators are related"""
        related_groups = [
            ['standard_deduction', 'itemized_deduction'],
            ['tax_withholding', 'estimated_taxes'],
            ['business_expense', 'estimated_taxes'],
            ['retirement_contribution', 'tax_withholding'],
            ['capital_gains', 'estimated_taxes']
        ]

        for group in related_groups:
            if calc1 in group and calc2 in group:
                return True

        return False

    def _generate_suggestion_reason(self, calc_info: Dict, user_profile: Dict,
                                  context: Dict) -> str:
        """Generate explanation for calculator suggestion"""
        reasons = []

        # User type matching
        user_types = self._determine_user_types(user_profile)
        applicable_users = calc_info.get('applicable_users', [])

        if 'business_owners' in applicable_users and 'business_owners' in user_types:
            reasons.append("relevant for business owners")
        elif 'self_employed' in applicable_users and 'self_employed' in user_types:
            reasons.append("helpful for self-employed individuals")
        elif 'homeowners' in applicable_users and 'homeowners' in user_types:
            reasons.append("useful for homeowners")

        # Seasonal relevance
        current_month = datetime.now().month
        if current_month in calc_info.get('seasonal_relevance', []):
            if current_month in [1, 2, 3, 4]:
                reasons.append("important for tax filing season")
            elif current_month in [3, 6, 9, 12]:
                reasons.append("relevant for quarterly tax planning")

        # Context-based reasons
        if context:
            current_page = context.get('current_page', '')
            if 'deduction' in current_page and 'deduction' in calc_info.get('name', '').lower():
                reasons.append("related to your current deduction research")

        if reasons:
            return f"Suggested because it's {', '.join(reasons)}"
        else:
            return "Popular calculator that may help optimize your taxes"

    def record_calculator_usage(self, user_id: int, calculator_id: str,
                              completion_time: float, satisfaction_rating: int = None):
        """Record calculator usage for future personalization"""
        if user_id not in self.user_calculator_patterns:
            self.user_calculator_patterns[user_id] = {}

        if calculator_id not in self.user_calculator_patterns[user_id]:
            self.user_calculator_patterns[user_id][calculator_id] = {
                'usage_count': 0,
                'total_time': 0,
                'ratings': []
            }

        pattern = self.user_calculator_patterns[user_id][calculator_id]
        pattern['usage_count'] += 1
        pattern['total_time'] += completion_time

        if satisfaction_rating:
            pattern['ratings'].append(satisfaction_rating)


if __name__ == "__main__":
    # Example usage

    # Initialize engines
    content_engine = ContentRecommendationEngine()
    tips_engine = PersonalizedTipsEngine()
    calculator_engine = CalculatorSuggestionEngine()

    # Example user profile
    user_profile = {
        'user_id': 123,
        'income': 75000,
        'age': 35,
        'filing_status': 'married_filing_jointly',
        'state': 'CA',
        'has_dependents': 1,
        'is_business_owner': 0,
        'tax_experience_level': 'intermediate',
        'owns_home': 1,
        'has_investments': 1
    }

    # Get calculator suggestions
    calc_suggestions = calculator_engine.get_calculator_suggestions(user_profile)

    print("Personalized Calculator Suggestions:")
    for suggestion in calc_suggestions:
        print(f"- {suggestion['name']}: {suggestion['reason']}")

    logger.info("Personalization engine demo completed")