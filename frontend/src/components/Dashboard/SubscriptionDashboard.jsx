import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSubscription } from '../../contexts/SubscriptionContext';
import PricingTiers from '../Premium/PricingTiers';
import UsageChart from './UsageChart';
import InvoiceHistory from './InvoiceHistory';
import './SubscriptionDashboard.css';

const SubscriptionDashboard = () => {
  const {
    subscription,
    usage,
    plans,
    invoices,
    updateSubscription,
    cancelSubscription,
    reactivateSubscription,
    createPortalSession,
    loading,
    error
  } = useSubscription();

  const [activeTab, setActiveTab] = useState('overview');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    // Set initial tab based on subscription status
    if (!subscription || subscription.tier === 'free') {
      setActiveTab('plans');
    }
  }, [subscription]);

  const handleUpgrade = async (newPlanId) => {
    setActionLoading(true);
    try {
      const plan = plans.find(p => p.id === newPlanId);
      if (plan) {
        await updateSubscription(plan.stripePriceId);
        setShowUpgradeModal(false);
      }
    } catch (error) {
      console.error('Upgrade failed:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    try {
      await cancelSubscription(false); // Cancel at period end
      setShowCancelModal(false);
    } catch (error) {
      console.error('Cancellation failed:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    setActionLoading(true);
    try {
      await reactivateSubscription();
    } catch (error) {
      console.error('Reactivation failed:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      const portalUrl = await createPortalSession();
      window.open(portalUrl, '_blank');
    } catch (error) {
      console.error('Failed to open billing portal:', error);
    }
  };

  const getSubscriptionStatus = () => {
    if (!subscription) return 'free';
    return subscription.status;
  };

  const getStatusColor = (status) => {
    const colors = {
      free: '#6b7280',
      active: '#10b981',
      trialing: '#3b82f6',
      past_due: '#f59e0b',
      canceled: '#ef4444',
      incomplete: '#8b5cf6'
    };
    return colors[status] || '#6b7280';
  };

  const getStatusText = (status) => {
    const texts = {
      free: 'Free Plan',
      active: 'Active',
      trialing: 'Free Trial',
      past_due: 'Payment Overdue',
      canceled: 'Canceled',
      incomplete: 'Setup Required'
    };
    return texts[status] || status;
  };

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(new Date(date));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount / 100);
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'usage', label: 'Usage', icon: '📈' },
    { id: 'billing', label: 'Billing', icon: '💳' },
    { id: 'plans', label: 'Plans', icon: '🎯' }
  ];

  const status = getSubscriptionStatus();

  return (
    <div className="subscription-dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <h1>Subscription Management</h1>
          <p>Manage your subscription, usage, and billing</p>
        </div>

        <div className="subscription-status">
          <div className="status-indicator">
            <span
              className="status-dot"
              style={{ backgroundColor: getStatusColor(status) }}
            />
            <span className="status-text">{getStatusText(status)}</span>
          </div>

          {subscription && subscription.tier !== 'free' && (
            <div className="subscription-info">
              <span className="tier-name">{subscription.tier.toUpperCase()}</span>
              {subscription.amount && (
                <span className="tier-price">
                  {formatCurrency(subscription.amount)}/{subscription.interval}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="dashboard-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="dashboard-content">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              className="tab-content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <OverviewTab
                subscription={subscription}
                usage={usage}
                onUpgrade={() => setShowUpgradeModal(true)}
                onCancel={() => setShowCancelModal(true)}
                onReactivate={handleReactivate}
                onManageBilling={handleManageBilling}
                actionLoading={actionLoading}
                formatDate={formatDate}
                formatCurrency={formatCurrency}
              />
            </motion.div>
          )}

          {activeTab === 'usage' && (
            <motion.div
              key="usage"
              className="tab-content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <UsageTab usage={usage} subscription={subscription} />
            </motion.div>
          )}

          {activeTab === 'billing' && (
            <motion.div
              key="billing"
              className="tab-content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <BillingTab
                subscription={subscription}
                invoices={invoices}
                onManageBilling={handleManageBilling}
                formatDate={formatDate}
                formatCurrency={formatCurrency}
              />
            </motion.div>
          )}

          {activeTab === 'plans' && (
            <motion.div
              key="plans"
              className="tab-content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <PlansTab
                plans={plans}
                currentTier={subscription?.tier || 'free'}
                onUpgrade={handleUpgrade}
                actionLoading={actionLoading}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Upgrade Modal */}
      <AnimatePresence>
        {showUpgradeModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowUpgradeModal(false)}
          >
            <motion.div
              className="modal-content"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Upgrade Your Plan</h3>
                <button
                  className="modal-close"
                  onClick={() => setShowUpgradeModal(false)}
                >
                  ×
                </button>
              </div>
              <PricingTiers
                plans={plans}
                onPlanSelect={handleUpgrade}
                showTrial={false}
                compact={true}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel Modal */}
      <AnimatePresence>
        {showCancelModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCancelModal(false)}
          >
            <motion.div
              className="modal-content cancel-modal"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Cancel Subscription</h3>
                <button
                  className="modal-close"
                  onClick={() => setShowCancelModal(false)}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <p>
                  Are you sure you want to cancel your subscription? Your access will
                  continue until {subscription?.currentPeriodEnd && formatDate(subscription.currentPeriodEnd)}.
                </p>
                <div className="cancel-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => setShowCancelModal(false)}
                    disabled={actionLoading}
                  >
                    Keep Subscription
                  </button>
                  <button
                    className="btn-danger"
                    onClick={handleCancel}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Canceling...' : 'Yes, Cancel'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{error}</span>
        </div>
      )}
    </div>
  );
};

// Overview Tab Component
const OverviewTab = ({
  subscription,
  usage,
  onUpgrade,
  onCancel,
  onReactivate,
  onManageBilling,
  actionLoading,
  formatDate,
  formatCurrency
}) => {
  const getUpcomingPayment = () => {
    if (!subscription || subscription.tier === 'free') return null;
    if (subscription.status === 'canceled') return null;

    return {
      date: subscription.currentPeriodEnd,
      amount: subscription.amount
    };
  };

  const upcomingPayment = getUpcomingPayment();

  return (
    <div className="overview-tab">
      <div className="overview-grid">
        {/* Current Plan Card */}
        <div className="overview-card plan-card">
          <h3>Current Plan</h3>
          <div className="plan-details">
            <div className="plan-name">
              {subscription?.tier ? subscription.tier.toUpperCase() : 'FREE'}
            </div>
            {subscription && subscription.tier !== 'free' && (
              <div className="plan-price">
                {formatCurrency(subscription.amount)}/{subscription.interval}
              </div>
            )}
          </div>

          <div className="plan-actions">
            {!subscription || subscription.tier === 'free' ? (
              <button className="btn-primary" onClick={onUpgrade}>
                Upgrade Plan
              </button>
            ) : subscription.willCancelAtPeriodEnd ? (
              <button
                className="btn-success"
                onClick={onReactivate}
                disabled={actionLoading}
              >
                {actionLoading ? 'Reactivating...' : 'Reactivate Subscription'}
              </button>
            ) : (
              <div className="plan-button-group">
                <button className="btn-primary" onClick={onUpgrade}>
                  Change Plan
                </button>
                <button
                  className="btn-secondary"
                  onClick={onCancel}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Usage Summary Card */}
        <div className="overview-card usage-card">
          <h3>Usage This Month</h3>
          <div className="usage-summary">
            {usage?.usage?.map(item => (
              <div key={item.feature} className="usage-item">
                <span className="usage-label">
                  {item.feature.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </span>
                <span className="usage-value">{item.totalQuantity}</span>
              </div>
            )) || (
              <div className="no-usage">No usage data available</div>
            )}
          </div>
        </div>

        {/* Payment Info Card */}
        <div className="overview-card payment-card">
          <h3>Payment Information</h3>
          <div className="payment-info">
            {upcomingPayment ? (
              <>
                <div className="payment-item">
                  <span className="payment-label">Next Payment</span>
                  <span className="payment-value">
                    {formatDate(upcomingPayment.date)}
                  </span>
                </div>
                <div className="payment-item">
                  <span className="payment-label">Amount</span>
                  <span className="payment-value">
                    {formatCurrency(upcomingPayment.amount)}
                  </span>
                </div>
              </>
            ) : (
              <div className="no-payment">No upcoming payments</div>
            )}
          </div>

          {subscription && subscription.tier !== 'free' && (
            <button className="btn-outline" onClick={onManageBilling}>
              Manage Billing
            </button>
          )}
        </div>

        {/* Account Status Card */}
        <div className="overview-card status-card">
          <h3>Account Status</h3>
          <div className="status-details">
            {subscription?.isTrialing && (
              <div className="status-item trial">
                <span className="status-icon">🎯</span>
                <div>
                  <div className="status-title">Free Trial Active</div>
                  <div className="status-subtitle">
                    Ends {formatDate(subscription.trialEnd)}
                  </div>
                </div>
              </div>
            )}

            {subscription?.willCancelAtPeriodEnd && (
              <div className="status-item canceling">
                <span className="status-icon">⚠️</span>
                <div>
                  <div className="status-title">Subscription Ending</div>
                  <div className="status-subtitle">
                    Access until {formatDate(subscription.currentPeriodEnd)}
                  </div>
                </div>
              </div>
            )}

            {subscription?.status === 'past_due' && (
              <div className="status-item overdue">
                <span className="status-icon">🚨</span>
                <div>
                  <div className="status-title">Payment Overdue</div>
                  <div className="status-subtitle">
                    Please update your payment method
                  </div>
                </div>
              </div>
            )}

            {(!subscription || subscription.tier === 'free') && (
              <div className="status-item free">
                <span className="status-icon">✨</span>
                <div>
                  <div className="status-title">Free Plan Active</div>
                  <div className="status-subtitle">
                    Upgrade to unlock more features
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Usage Tab Component
const UsageTab = ({ usage, subscription }) => {
  return (
    <div className="usage-tab">
      <div className="usage-header">
        <h3>Usage Statistics</h3>
        <p>Track your monthly usage across all features</p>
      </div>

      {usage?.usage?.length > 0 ? (
        <>
          <UsageChart usage={usage} />
          <div className="usage-details">
            <h4>Feature Usage Details</h4>
            <div className="usage-grid">
              {usage.usage.map(item => (
                <div key={item.feature} className="usage-detail-card">
                  <h5>{item.feature.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</h5>
                  <div className="usage-stats">
                    <div className="stat">
                      <span className="stat-label">Total Usage</span>
                      <span className="stat-value">{item.totalQuantity}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">First Used</span>
                      <span className="stat-value">
                        {new Date(item.firstUsed).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Last Used</span>
                      <span className="stat-value">
                        {new Date(item.lastUsed).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="no-usage-data">
          <span className="no-usage-icon">📈</span>
          <h4>No Usage Data</h4>
          <p>Start using GlobalTaxCalc features to see your usage statistics here.</p>
        </div>
      )}
    </div>
  );
};

// Billing Tab Component
const BillingTab = ({ subscription, invoices, onManageBilling, formatDate, formatCurrency }) => {
  return (
    <div className="billing-tab">
      <div className="billing-header">
        <h3>Billing & Invoices</h3>
        <button className="btn-primary" onClick={onManageBilling}>
          Manage Billing
        </button>
      </div>

      <InvoiceHistory
        invoices={invoices}
        formatDate={formatDate}
        formatCurrency={formatCurrency}
      />
    </div>
  );
};

// Plans Tab Component
const PlansTab = ({ plans, currentTier, onUpgrade, actionLoading }) => {
  return (
    <div className="plans-tab">
      <PricingTiers
        plans={plans}
        selectedPlan={currentTier}
        onPlanSelect={onUpgrade}
        showTrial={false}
        showUsage={true}
        showFeatures={true}
      />

      {actionLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <p>Processing your request...</p>
        </div>
      )}
    </div>
  );
};

export default SubscriptionDashboard;