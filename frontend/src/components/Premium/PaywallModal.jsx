import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSubscription } from '../../contexts/SubscriptionContext';
import PricingTiers from './PricingTiers';
import './PaywallModal.css';

const PaywallModal = ({
  isOpen,
  onClose,
  feature,
  title = 'Upgrade Required',
  description = 'This feature requires a premium subscription.',
  showTrial = true,
  previewData = null,
  customCTA = null
}) => {
  const { subscription, plans, createSubscription, loading } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(!!previewData);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleUpgrade = async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    try {
      const plan = plans.find(p => p.id === selectedPlan);
      if (!plan) return;

      await createSubscription(plan.stripePriceId, {
        trialDays: showTrial ? 14 : 0
      });

      onClose();
    } catch (error) {
      console.error('Upgrade failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getFeatureIcon = (feature) => {
    const icons = {
      advanced_calculator: '🧮',
      multi_year_planning: '📅',
      state_comparisons: '🗺️',
      unlimited_exports: '📊',
      business_calculator: '🏢',
      investment_planning: '💰',
      estate_planning: '🏛️',
      api_access: '🔌',
      custom_reports: '📋',
      priority_support: '🚀'
    };
    return icons[feature] || '⭐';
  };

  const getRequiredTiers = (feature) => {
    const featureMap = {
      advanced_calculator: ['pro', 'expert'],
      multi_year_planning: ['pro', 'expert'],
      state_comparisons: ['pro', 'expert'],
      unlimited_exports: ['pro', 'expert'],
      business_calculator: ['expert'],
      investment_planning: ['expert'],
      estate_planning: ['expert'],
      api_access: ['expert'],
      custom_reports: ['expert'],
      priority_support: ['expert']
    };
    return featureMap[feature] || ['pro', 'expert'];
  };

  const modalVariants = {
    hidden: {
      opacity: 0,
      scale: 0.8,
      y: 50
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: 'spring',
        duration: 0.5,
        bounce: 0.3
      }
    },
    exit: {
      opacity: 0,
      scale: 0.8,
      y: 50,
      transition: {
        duration: 0.3
      }
    }
  };

  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="paywall-overlay"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
        >
          <motion.div
            className="paywall-modal"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="paywall-header">
              <div className="feature-icon">
                {getFeatureIcon(feature)}
              </div>
              <h2 className="paywall-title">{title}</h2>
              <button
                className="paywall-close"
                onClick={onClose}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="paywall-content">
              {showPreview && previewData && (
                <div className="preview-section">
                  <div className="preview-header">
                    <h3>Preview</h3>
                    <button
                      className="preview-toggle"
                      onClick={() => setShowPreview(!showPreview)}
                    >
                      {showPreview ? 'Hide Preview' : 'Show Preview'}
                    </button>
                  </div>

                  {showPreview && (
                    <motion.div
                      className="preview-content"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      {previewData}
                      <div className="preview-overlay">
                        <div className="preview-blur" />
                        <div className="preview-cta">
                          <h4>Unlock Full Results</h4>
                          <p>Upgrade to see complete analysis</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              <div className="paywall-description">
                <p>{description}</p>

                {feature && (
                  <div className="feature-requirements">
                    <h4>This feature is available in:</h4>
                    <div className="required-tiers">
                      {getRequiredTiers(feature).map(tier => (
                        <span key={tier} className={`tier-badge tier-${tier}`}>
                          {tier.charAt(0).toUpperCase() + tier.slice(1)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Pricing Options */}
              <div className="pricing-section">
                <h3>Choose Your Plan</h3>
                <PricingTiers
                  plans={plans}
                  selectedPlan={selectedPlan}
                  onPlanSelect={setSelectedPlan}
                  showTrial={showTrial}
                  highlightedPlan="pro"
                  compact={true}
                />
              </div>

              {/* Benefits */}
              <div className="benefits-section">
                <h4>What you'll get:</h4>
                <div className="benefits-grid">
                  <div className="benefit-item">
                    <span className="benefit-icon">✨</span>
                    <span>Instant access to all features</span>
                  </div>
                  <div className="benefit-item">
                    <span className="benefit-icon">🔄</span>
                    <span>Cancel anytime</span>
                  </div>
                  <div className="benefit-item">
                    <span className="benefit-icon">💳</span>
                    <span>Secure payment processing</span>
                  </div>
                  {showTrial && (
                    <div className="benefit-item">
                      <span className="benefit-icon">🎯</span>
                      <span>14-day free trial</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Trust Indicators */}
              <div className="trust-indicators">
                <div className="trust-item">
                  <span className="trust-icon">🔒</span>
                  <span>SSL Encrypted</span>
                </div>
                <div className="trust-item">
                  <span className="trust-icon">💳</span>
                  <span>Stripe Secured</span>
                </div>
                <div className="trust-item">
                  <span className="trust-icon">⭐</span>
                  <span>5,000+ Happy Users</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="paywall-footer">
              <button
                className="btn-secondary"
                onClick={onClose}
                disabled={isProcessing}
              >
                Maybe Later
              </button>

              {customCTA || (
                <button
                  className="btn-primary upgrade-btn"
                  onClick={handleUpgrade}
                  disabled={isProcessing || loading}
                >
                  {isProcessing ? (
                    <>
                      <span className="spinner" />
                      Processing...
                    </>
                  ) : showTrial ? (
                    `Start Free Trial`
                  ) : (
                    `Upgrade Now - ${plans.find(p => p.id === selectedPlan)?.formattedPrice || '$4.99'}/month`
                  )}
                </button>
              )}
            </div>

            {/* Fine Print */}
            <div className="paywall-fine-print">
              {showTrial && (
                <p>
                  Start your 14-day free trial. Cancel anytime before the trial ends to avoid charges.
                </p>
              )}
              <p>
                By upgrading, you agree to our{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer">
                  Privacy Policy
                </a>.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PaywallModal;