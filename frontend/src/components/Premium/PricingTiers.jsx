import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useSubscription } from '../../contexts/SubscriptionContext';
import './PricingTiers.css';

const PricingTiers = ({
  plans = [],
  selectedPlan = 'pro',
  onPlanSelect,
  showTrial = true,
  highlightedPlan = 'pro',
  compact = false,
  showFeatures = true,
  showUsage = false,
  className = ''
}) => {
  const { subscription, usage } = useSubscription();
  const [billingInterval, setBillingInterval] = useState('month');

  const getPlanIcon = (planId) => {
    const icons = {
      free: '🎯',
      pro: '🚀',
      expert: '💎'
    };
    return icons[planId] || '⭐';
  };

  const getPlanGradient = (planId) => {
    const gradients = {
      free: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      pro: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      expert: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
    };
    return gradients[planId] || gradients.pro;
  };

  const formatFeatures = (features) => {
    if (!features || !Array.isArray(features)) return [];

    return features.map(feature => {
      // Convert string features to objects if needed
      if (typeof feature === 'string') {
        return { text: feature, included: true };
      }
      return feature;
    });
  };

  const getUsageStatus = (planId, feature) => {
    if (!usage || !usage.usage) return null;

    const featureUsage = usage.usage.find(u => u.feature === feature);
    if (!featureUsage) return null;

    const plan = plans.find(p => p.id === planId);
    const limit = plan?.limits?.[feature];

    if (limit === -1) return { text: 'Unlimited', status: 'unlimited' };
    if (limit === 0) return { text: 'Not included', status: 'unavailable' };

    const remaining = limit - featureUsage.totalQuantity;
    const percentage = (featureUsage.totalQuantity / limit) * 100;

    return {
      text: `${featureUsage.totalQuantity}/${limit} used`,
      remaining,
      percentage,
      status: percentage > 90 ? 'warning' : percentage > 75 ? 'caution' : 'good'
    };
  };

  const isCurrentPlan = (planId) => {
    return subscription?.tier === planId;
  };

  const canSelectPlan = (planId) => {
    if (!subscription) return true;
    if (planId === 'free') return false; // Can't "select" free plan
    return subscription.tier !== planId;
  };

  const planVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (index) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: index * 0.1,
        duration: 0.5,
        ease: 'easeOut'
      }
    })
  };

  const featuresVariants = {
    hidden: { opacity: 0, height: 0 },
    visible: {
      opacity: 1,
      height: 'auto',
      transition: {
        duration: 0.3,
        ease: 'easeOut'
      }
    }
  };

  return (
    <div className={`pricing-tiers ${compact ? 'compact' : ''} ${className}`}>
      {!compact && (
        <div className="pricing-header">
          <h2>Choose Your Plan</h2>
          <p>Start with a free account and upgrade when you need more features</p>

          {/* Billing Toggle */}
          <div className="billing-toggle">
            <button
              className={billingInterval === 'month' ? 'active' : ''}
              onClick={() => setBillingInterval('month')}
            >
              Monthly
            </button>
            <button
              className={billingInterval === 'year' ? 'active' : ''}
              onClick={() => setBillingInterval('year')}
            >
              Yearly
              <span className="discount-badge">Save 20%</span>
            </button>
          </div>
        </div>
      )}

      <div className="plans-grid">
        {plans.map((plan, index) => {
          const formattedFeatures = formatFeatures(plan.features);
          const isHighlighted = plan.id === highlightedPlan;
          const isCurrent = isCurrentPlan(plan.id);
          const isSelected = plan.id === selectedPlan;

          return (
            <motion.div
              key={plan.id}
              className={`plan-card ${isHighlighted ? 'highlighted' : ''} ${
                isCurrent ? 'current' : ''
              } ${isSelected ? 'selected' : ''} ${compact ? 'compact' : ''}`}
              variants={planVariants}
              initial="hidden"
              animate="visible"
              custom={index}
              onClick={() => canSelectPlan(plan.id) && onPlanSelect?.(plan.id)}
              style={{
                cursor: canSelectPlan(plan.id) ? 'pointer' : 'default'
              }}
            >
              {isHighlighted && (
                <div className="popular-badge">
                  <span>Most Popular</span>
                </div>
              )}

              {isCurrent && (
                <div className="current-badge">
                  <span>Current Plan</span>
                </div>
              )}

              <div className="plan-header">
                <div
                  className="plan-icon"
                  style={{ background: getPlanGradient(plan.id) }}
                >
                  {getPlanIcon(plan.id)}
                </div>

                <div className="plan-info">
                  <h3 className="plan-name">{plan.name}</h3>
                  <div className="plan-price">
                    {plan.price === 0 ? (
                      <span className="price-free">Free</span>
                    ) : (
                      <>
                        <span className="price-amount">
                          ${billingInterval === 'year' ? (plan.price * 12 * 0.8 / 100).toFixed(2) : (plan.price / 100).toFixed(2)}
                        </span>
                        <span className="price-interval">
                          /{billingInterval === 'year' ? 'year' : 'month'}
                        </span>
                        {billingInterval === 'year' && plan.price > 0 && (
                          <span className="price-savings">
                            Save ${((plan.price * 12 * 0.2) / 100).toFixed(2)}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {showFeatures && (
                <motion.div
                  className="plan-features"
                  variants={featuresVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <ul>
                    {formattedFeatures.map((feature, featureIndex) => (
                      <li
                        key={featureIndex}
                        className={feature.included ? 'included' : 'not-included'}
                      >
                        <span className="feature-icon">
                          {feature.included ? '✓' : '✗'}
                        </span>
                        <span className="feature-text">{feature.text}</span>

                        {showUsage && feature.usageKey && (
                          <div className="usage-status">
                            {(() => {
                              const status = getUsageStatus(plan.id, feature.usageKey);
                              if (!status) return null;

                              return (
                                <span className={`usage-indicator ${status.status}`}>
                                  {status.text}
                                </span>
                              );
                            })()}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}

              <div className="plan-action">
                {isCurrent ? (
                  <button className="btn-current" disabled>
                    Current Plan
                  </button>
                ) : plan.id === 'free' ? (
                  <button className="btn-free" disabled>
                    Always Free
                  </button>
                ) : (
                  <button
                    className={`btn-select ${isSelected ? 'selected' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlanSelect?.(plan.id);
                    }}
                  >
                    {isSelected ? 'Selected' : 'Select Plan'}
                    {showTrial && plan.price > 0 && (
                      <span className="trial-text">14-day free trial</span>
                    )}
                  </button>
                )}
              </div>

              {!compact && plan.limits && (
                <div className="plan-limits">
                  <h4>What's included:</h4>
                  <div className="limits-grid">
                    {Object.entries(plan.limits).map(([key, value]) => {
                      if (key === 'features') return null;

                      const limitDisplay = value === -1 ? 'Unlimited' :
                                         value === 0 ? 'None' :
                                         value.toLocaleString();

                      return (
                        <div key={key} className="limit-item">
                          <span className="limit-label">
                            {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                          </span>
                          <span className="limit-value">{limitDisplay}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {!compact && (
        <div className="pricing-footer">
          <div className="guarantee">
            <span className="guarantee-icon">🔒</span>
            <div className="guarantee-text">
              <strong>30-day money-back guarantee</strong>
              <p>Try risk-free. Cancel anytime.</p>
            </div>
          </div>

          <div className="payment-methods">
            <span>Secure payment by</span>
            <div className="payment-icons">
              <span className="payment-icon">💳</span>
              <span className="payment-text">Stripe</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PricingTiers;