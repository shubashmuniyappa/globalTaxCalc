import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSubscription } from '../../contexts/SubscriptionContext';
import './InvoiceHistory.css';

const InvoiceHistory = () => {
  const { subscription, fetchInvoices } = useSubscription();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, paid, pending, failed
  const [sortBy, setSortBy] = useState('date'); // date, amount, status
  const [sortOrder, setSortOrder] = useState('desc'); // desc, asc
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  useEffect(() => {
    const loadInvoices = async () => {
      if (!subscription) return;

      try {
        setLoading(true);
        const invoiceData = await fetchInvoices();
        setInvoices(invoiceData || []);
      } catch (error) {
        console.error('Failed to load invoices:', error);
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    };

    loadInvoices();
  }, [subscription, fetchInvoices]);

  const getStatusIcon = (status) => {
    const icons = {
      paid: '✅',
      pending: '⏳',
      failed: '❌',
      draft: '📝',
      voided: '🚫'
    };
    return icons[status] || '📄';
  };

  const getStatusColor = (status) => {
    const colors = {
      paid: 'success',
      pending: 'warning',
      failed: 'error',
      draft: 'neutral',
      voided: 'neutral'
    };
    return colors[status] || 'neutral';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount / 100);
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getFilteredAndSortedInvoices = () => {
    let filtered = invoices;

    // Apply filter
    if (filter !== 'all') {
      filtered = filtered.filter(invoice => invoice.status === filter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal, bVal;

      switch (sortBy) {
        case 'amount':
          aVal = a.amount_paid;
          bVal = b.amount_paid;
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'date':
        default:
          aVal = a.created;
          bVal = b.created;
          break;
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filtered;
  };

  const handleDownloadInvoice = async (invoiceId) => {
    try {
      // This would make an API call to get the invoice PDF
      const response = await fetch(`/api/invoices/${invoiceId}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${invoiceId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to download invoice:', error);
    }
  };

  const getInvoiceDetails = (invoice) => {
    return {
      number: invoice.number || `INV-${invoice.id.slice(-8)}`,
      description: invoice.description || 'Subscription payment',
      period: invoice.period_start && invoice.period_end
        ? `${formatDate(invoice.period_start)} - ${formatDate(invoice.period_end)}`
        : 'One-time payment',
      subtotal: invoice.subtotal || invoice.amount_due,
      tax: invoice.tax || 0,
      total: invoice.total || invoice.amount_due,
      paymentMethod: invoice.payment_intent?.charges?.data?.[0]?.payment_method_details?.card?.brand || 'Card'
    };
  };

  const filteredInvoices = getFilteredAndSortedInvoices();

  if (loading) {
    return (
      <div className="invoice-history">
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading invoice history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="invoice-history">
      <div className="invoice-header">
        <div className="header-content">
          <h3>Invoice History</h3>
          <p>View and download your billing history</p>
        </div>

        <div className="invoice-controls">
          <div className="filter-group">
            <label>Filter by status:</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Invoices</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="sort-group">
            <label>Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-select"
            >
              <option value="date">Date</option>
              <option value="amount">Amount</option>
              <option value="status">Status</option>
            </select>
            <button
              className={`sort-order ${sortOrder}`}
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {filteredInvoices.length === 0 ? (
        <div className="no-invoices">
          <div className="no-invoices-icon">📄</div>
          <h4>No Invoices Found</h4>
          <p>
            {filter === 'all'
              ? "You don't have any invoices yet."
              : `No ${filter} invoices found.`}
          </p>
        </div>
      ) : (
        <div className="invoices-container">
          <div className="invoices-list">
            {filteredInvoices.map((invoice, index) => {
              const details = getInvoiceDetails(invoice);

              return (
                <motion.div
                  key={invoice.id}
                  className={`invoice-item ${getStatusColor(invoice.status)}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => setSelectedInvoice(invoice)}
                >
                  <div className="invoice-main">
                    <div className="invoice-status">
                      <span className="status-icon">
                        {getStatusIcon(invoice.status)}
                      </span>
                      <span className={`status-text ${getStatusColor(invoice.status)}`}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </div>

                    <div className="invoice-info">
                      <div className="invoice-number">
                        Invoice #{details.number}
                      </div>
                      <div className="invoice-description">
                        {details.description}
                      </div>
                      <div className="invoice-period">
                        {details.period}
                      </div>
                    </div>

                    <div className="invoice-amount">
                      <div className="amount-value">
                        {formatCurrency(invoice.amount_paid || invoice.amount_due)}
                      </div>
                      <div className="invoice-date">
                        {formatDate(invoice.created)}
                      </div>
                    </div>

                    <div className="invoice-actions">
                      <button
                        className="btn-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedInvoice(invoice);
                        }}
                        title="View Details"
                      >
                        👁️
                      </button>
                      {invoice.status === 'paid' && (
                        <button
                          className="btn-icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadInvoice(invoice.id);
                          }}
                          title="Download PDF"
                        >
                          📥
                        </button>
                      )}
                    </div>
                  </div>

                  {invoice.status === 'failed' && (
                    <div className="invoice-error">
                      <span className="error-icon">⚠️</span>
                      <span>Payment failed. Please update your payment method.</span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      <AnimatePresence>
        {selectedInvoice && (
          <motion.div
            className="invoice-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedInvoice(null)}
          >
            <motion.div
              className="invoice-modal"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Invoice Details</h3>
                <button
                  className="modal-close"
                  onClick={() => setSelectedInvoice(null)}
                >
                  ×
                </button>
              </div>

              <div className="modal-content">
                {(() => {
                  const details = getInvoiceDetails(selectedInvoice);

                  return (
                    <>
                      <div className="invoice-overview">
                        <div className="overview-item">
                          <label>Invoice Number</label>
                          <span>{details.number}</span>
                        </div>
                        <div className="overview-item">
                          <label>Status</label>
                          <span className={`status-badge ${getStatusColor(selectedInvoice.status)}`}>
                            {getStatusIcon(selectedInvoice.status)} {selectedInvoice.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="overview-item">
                          <label>Date</label>
                          <span>{formatDate(selectedInvoice.created)}</span>
                        </div>
                        <div className="overview-item">
                          <label>Billing Period</label>
                          <span>{details.period}</span>
                        </div>
                      </div>

                      <div className="invoice-breakdown">
                        <h4>Billing Details</h4>
                        <div className="breakdown-item">
                          <span>Subtotal</span>
                          <span>{formatCurrency(details.subtotal)}</span>
                        </div>
                        {details.tax > 0 && (
                          <div className="breakdown-item">
                            <span>Tax</span>
                            <span>{formatCurrency(details.tax)}</span>
                          </div>
                        )}
                        <div className="breakdown-item total">
                          <span>Total</span>
                          <span>{formatCurrency(details.total)}</span>
                        </div>
                      </div>

                      <div className="payment-info">
                        <h4>Payment Information</h4>
                        <div className="payment-method">
                          <span>Payment Method: {details.paymentMethod}</span>
                        </div>
                        {selectedInvoice.status === 'paid' && (
                          <div className="payment-date">
                            <span>Paid on: {formatDate(selectedInvoice.status_transitions?.paid_at || selectedInvoice.created)}</span>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="modal-footer">
                <button
                  className="btn-secondary"
                  onClick={() => setSelectedInvoice(null)}
                >
                  Close
                </button>
                {selectedInvoice.status === 'paid' && (
                  <button
                    className="btn-primary"
                    onClick={() => handleDownloadInvoice(selectedInvoice.id)}
                  >
                    Download PDF
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InvoiceHistory;