const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const paypal = require('paypal-rest-sdk');

// Configure PayPal
paypal.configure({
  mode: process.env.PAYPAL_MODE || 'sandbox',
  client_id: process.env.PAYPAL_CLIENT_ID,
  client_secret: process.env.PAYPAL_CLIENT_SECRET
});

class PaymentService {
  constructor() {
    this.paymentMethods = {
      paypal: this.processPayPalPayment.bind(this),
      stripe: this.processStripePayment.bind(this),
      bank_transfer: this.processBankTransfer.bind(this),
      check: this.processCheckPayment.bind(this)
    };

    this.minimumPayoutThreshold = parseFloat(process.env.MINIMUM_PAYOUT_THRESHOLD) || 50.00;
    this.paymentSchedule = process.env.PAYMENT_SCHEDULE || 'monthly'; // weekly, monthly, bi-weekly
  }

  /**
   * Process payments for eligible affiliates
   */
  async processScheduledPayments() {
    try {
      console.log('Starting scheduled payment processing...');

      // Get eligible affiliates for payment
      const eligibleAffiliates = await this.getEligibleAffiliates();

      console.log(`Found ${eligibleAffiliates.length} eligible affiliates for payment`);

      const paymentBatchId = uuidv4();
      const results = {
        processed: 0,
        failed: 0,
        totalAmount: 0,
        errors: []
      };

      for (const affiliate of eligibleAffiliates) {
        try {
          const payment = await this.processAffiliatePayment(affiliate, paymentBatchId);
          if (payment) {
            results.processed++;
            results.totalAmount += payment.net_amount;
          }
        } catch (error) {
          console.error(`Failed to process payment for affiliate ${affiliate.id}:`, error);
          results.failed++;
          results.errors.push({
            affiliateId: affiliate.id,
            error: error.message
          });
        }
      }

      console.log('Payment processing completed:', results);
      return results;

    } catch (error) {
      console.error('Error in scheduled payment processing:', error);
      throw error;
    }
  }

  /**
   * Get affiliates eligible for payment
   */
  async getEligibleAffiliates() {
    // Get affiliates with approved commissions above threshold
    const affiliates = await db('affiliates as a')
      .select([
        'a.id',
        'a.email',
        'a.first_name',
        'a.last_name',
        'a.payment_methods',
        'a.payment_threshold',
        'a.tax_id',
        'a.tax_classification',
        db.raw('SUM(c.commission_amount) as pending_amount'),
        db.raw('COUNT(c.id) as commission_count'),
        db.raw('array_agg(c.id) as commission_ids')
      ])
      .join('commissions as c', 'a.id', 'c.affiliate_id')
      .where('a.status', 'approved')
      .where('c.status', 'approved')
      .whereNull('a.deleted_at')
      .groupBy('a.id', 'a.email', 'a.first_name', 'a.last_name', 'a.payment_methods', 'a.payment_threshold', 'a.tax_id', 'a.tax_classification')
      .having('SUM(c.commission_amount)', '>=', db.raw('COALESCE(a.payment_threshold, ?)'), [this.minimumPayoutThreshold]);

    return affiliates.map(affiliate => ({
      ...affiliate,
      payment_methods: typeof affiliate.payment_methods === 'string'
        ? JSON.parse(affiliate.payment_methods)
        : affiliate.payment_methods,
      commission_ids: Array.isArray(affiliate.commission_ids)
        ? affiliate.commission_ids
        : []
    }));
  }

  /**
   * Process payment for a single affiliate
   */
  async processAffiliatePayment(affiliate, paymentBatchId) {
    try {
      // Get the preferred payment method
      const paymentMethod = this.getPreferredPaymentMethod(affiliate.payment_methods);

      if (!paymentMethod) {
        throw new Error('No valid payment method configured');
      }

      // Calculate payment amounts
      const paymentCalculation = await this.calculatePaymentAmounts(affiliate);

      // Create payment record
      const payment = await this.createPaymentRecord({
        affiliateId: affiliate.id,
        paymentBatchId,
        paymentMethod,
        amounts: paymentCalculation,
        commissionIds: affiliate.commission_ids,
        affiliate: affiliate
      });

      // Process the actual payment
      const paymentResult = await this.executePayment(payment, paymentMethod, affiliate);

      // Update payment record with result
      await this.updatePaymentRecord(payment.id, paymentResult);

      // Update commission statuses
      if (paymentResult.success) {
        await this.updateCommissionStatuses(affiliate.commission_ids, payment.id);
      }

      // Generate tax forms if required
      if (this.requiresTaxForm(affiliate, paymentCalculation.grossAmount)) {
        await this.generateTaxForm(affiliate, payment);
      }

      // Send notification
      await this.sendPaymentNotification(affiliate, payment, paymentResult);

      return payment;

    } catch (error) {
      console.error(`Error processing payment for affiliate ${affiliate.id}:`, error);
      throw error;
    }
  }

  /**
   * Calculate payment amounts including taxes and fees
   */
  async calculatePaymentAmounts(affiliate) {
    const grossAmount = parseFloat(affiliate.pending_amount);

    // Calculate tax withholding
    const taxWithheld = this.calculateTaxWithholding(affiliate, grossAmount);

    // Calculate processing fees
    const feesDeducted = this.calculateProcessingFees(affiliate.payment_methods, grossAmount);

    // Calculate net amount
    const netAmount = grossAmount - taxWithheld - feesDeducted;

    return {
      grossAmount,
      taxWithheld,
      feesDeducted,
      netAmount
    };
  }

  /**
   * Calculate tax withholding
   */
  calculateTaxWithholding(affiliate, amount) {
    // Simplified tax calculation - should be more sophisticated in production
    if (affiliate.tax_classification === 'business' && amount > 600) {
      // For business entities, no withholding typically required
      return 0;
    }

    if (affiliate.tax_classification === 'individual' && amount > 600) {
      // Check if tax ID is provided
      if (!affiliate.tax_id) {
        // Backup withholding rate for missing tax ID
        return amount * 0.24;
      }
    }

    return 0;
  }

  /**
   * Calculate processing fees
   */
  calculateProcessingFees(paymentMethods, amount) {
    const preferredMethod = this.getPreferredPaymentMethod(paymentMethods);

    switch (preferredMethod?.type) {
      case 'paypal':
        // PayPal typically charges 2-3% for transfers
        return amount * 0.025;

      case 'stripe':
        // Stripe transfer fees
        return Math.min(amount * 0.015, 5.00);

      case 'bank_transfer':
        // Flat fee for bank transfers
        return 2.50;

      case 'check':
        // Flat fee for check processing
        return 1.50;

      default:
        return 0;
    }
  }

  /**
   * Get preferred payment method
   */
  getPreferredPaymentMethod(paymentMethods) {
    if (!paymentMethods || !Array.isArray(paymentMethods) || paymentMethods.length === 0) {
      return null;
    }

    // Sort by priority and return the first active method
    return paymentMethods
      .filter(method => method.active)
      .sort((a, b) => (a.priority || 0) - (b.priority || 0))[0];
  }

  /**
   * Create payment record in database
   */
  async createPaymentRecord(paymentData) {
    const {
      affiliateId,
      paymentBatchId,
      paymentMethod,
      amounts,
      commissionIds,
      affiliate
    } = paymentData;

    // Calculate period dates
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd);
    periodStart.setMonth(periodStart.getMonth() - 1);

    const payment = await db('payments')
      .insert({
        affiliate_id: affiliateId,
        payment_batch_id: paymentBatchId,
        gross_amount: amounts.grossAmount,
        tax_withheld: amounts.taxWithheld,
        fees_deducted: amounts.feesDeducted,
        net_amount: amounts.netAmount,
        currency: 'USD',
        payment_method: paymentMethod.type,
        payment_details: JSON.stringify(paymentMethod),
        status: 'pending',
        period_start: periodStart,
        period_end: periodEnd,
        commission_count: commissionIds.length,
        commission_ids: JSON.stringify(commissionIds),
        tax_form_required: this.requiresTaxForm(affiliate, amounts.grossAmount),
        tax_year: new Date().getFullYear()
      })
      .returning('*');

    return payment[0];
  }

  /**
   * Execute payment through the specified method
   */
  async executePayment(payment, paymentMethod, affiliate) {
    const paymentHandler = this.paymentMethods[paymentMethod.type];

    if (!paymentHandler) {
      throw new Error(`Unsupported payment method: ${paymentMethod.type}`);
    }

    try {
      const result = await paymentHandler(payment, paymentMethod, affiliate);
      return {
        success: true,
        externalId: result.externalId,
        reference: result.reference,
        message: result.message || 'Payment processed successfully'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        retryable: this.isRetryableError(error)
      };
    }
  }

  /**
   * Process PayPal payment
   */
  async processPayPalPayment(payment, paymentMethod, affiliate) {
    return new Promise((resolve, reject) => {
      const senderBatchId = `batch_${payment.id}_${Date.now()}`;

      const payoutData = {
        sender_batch_header: {
          sender_batch_id: senderBatchId,
          email_subject: 'You have a payment',
          email_message: 'You have received a payment from GlobalTaxCalc affiliate program'
        },
        items: [{
          recipient_type: 'EMAIL',
          amount: {
            value: payment.net_amount.toFixed(2),
            currency: payment.currency
          },
          receiver: paymentMethod.email,
          note: `Affiliate commission payment for period ${payment.period_start} to ${payment.period_end}`,
          sender_item_id: `payment_${payment.id}`
        }]
      };

      paypal.payout.create(payoutData, (error, payout) => {
        if (error) {
          reject(new Error(`PayPal error: ${error.message}`));
        } else {
          resolve({
            externalId: payout.batch_header.payout_batch_id,
            reference: senderBatchId,
            message: 'PayPal payout initiated successfully'
          });
        }
      });
    });
  }

  /**
   * Process Stripe payment
   */
  async processStripePayment(payment, paymentMethod, affiliate) {
    try {
      const transfer = await stripe.transfers.create({
        amount: Math.round(payment.net_amount * 100), // Stripe uses cents
        currency: payment.currency.toLowerCase(),
        destination: paymentMethod.stripe_account_id,
        description: `Affiliate commission payment for ${affiliate.first_name} ${affiliate.last_name}`,
        metadata: {
          payment_id: payment.id,
          affiliate_id: affiliate.id,
          batch_id: payment.payment_batch_id
        }
      });

      return {
        externalId: transfer.id,
        reference: transfer.id,
        message: 'Stripe transfer completed successfully'
      };

    } catch (error) {
      throw new Error(`Stripe error: ${error.message}`);
    }
  }

  /**
   * Process bank transfer payment
   */
  async processBankTransfer(payment, paymentMethod, affiliate) {
    // This would integrate with your bank's API or payment processor
    // For now, we'll mark it as pending manual processing

    const reference = `WIRE_${payment.id}_${Date.now()}`;

    // In a real implementation, you would:
    // 1. Submit to bank API for wire transfer
    // 2. Store wire transfer details
    // 3. Track transfer status

    return {
      externalId: reference,
      reference: reference,
      message: 'Bank transfer queued for processing'
    };
  }

  /**
   * Process check payment
   */
  async processCheckPayment(payment, paymentMethod, affiliate) {
    // This would integrate with a check printing service
    const checkNumber = `CHK_${payment.id}_${Date.now()}`;

    // In a real implementation, you would:
    // 1. Generate check data
    // 2. Submit to check printing service
    // 3. Track mailing status

    return {
      externalId: checkNumber,
      reference: checkNumber,
      message: 'Check queued for printing and mailing'
    };
  }

  /**
   * Update payment record with result
   */
  async updatePaymentRecord(paymentId, result) {
    const updateData = {
      external_payment_id: result.externalId,
      payment_reference: result.reference,
      status_message: result.message,
      updated_at: new Date()
    };

    if (result.success) {
      updateData.status = 'processing';
      updateData.processed_at = new Date();
    } else {
      updateData.status = 'failed';
      updateData.failed_at = new Date();
      updateData.failure_reason = result.error;

      if (result.retryable) {
        updateData.next_retry_at = new Date(Date.now() + 24 * 60 * 60 * 1000); // Retry in 24 hours
      }
    }

    await db('payments')
      .where({ id: paymentId })
      .update(updateData);
  }

  /**
   * Update commission statuses to paid
   */
  async updateCommissionStatuses(commissionIds, paymentId) {
    await db('commissions')
      .whereIn('id', commissionIds)
      .update({
        status: 'paid',
        paid_at: new Date(),
        payment_batch_id: paymentId,
        updated_at: new Date()
      });
  }

  /**
   * Check if tax form is required
   */
  requiresTaxForm(affiliate, amount) {
    // IRS requires 1099-NEC for payments of $600 or more to non-corporate entities
    return amount >= 600 && affiliate.tax_classification !== 'corporation';
  }

  /**
   * Generate tax form
   */
  async generateTaxForm(affiliate, payment) {
    try {
      // This would integrate with tax form generation service
      const formData = {
        affiliate: affiliate,
        payment: payment,
        taxYear: payment.tax_year,
        formType: '1099-NEC'
      };

      // In a real implementation, you would:
      // 1. Generate PDF form
      // 2. Store in secure location
      // 3. Send to affiliate
      // 4. Submit to IRS if required

      await db('payments')
        .where({ id: payment.id })
        .update({
          tax_form_required: true,
          tax_form_type: '1099-NEC',
          updated_at: new Date()
        });

      console.log(`Tax form queued for affiliate ${affiliate.id}, payment ${payment.id}`);

    } catch (error) {
      console.error('Error generating tax form:', error);
    }
  }

  /**
   * Send payment notification
   */
  async sendPaymentNotification(affiliate, payment, result) {
    try {
      const NotificationService = require('./NotificationService');
      const notificationService = new NotificationService();

      if (result.success) {
        await notificationService.sendPaymentProcessedNotification(affiliate, payment);
      } else {
        await notificationService.sendPaymentFailedNotification(affiliate, payment, result.error);
      }

    } catch (error) {
      console.error('Error sending payment notification:', error);
    }
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    const retryableMessages = [
      'network',
      'timeout',
      'temporary',
      'rate limit',
      'service unavailable'
    ];

    return retryableMessages.some(msg =>
      error.message.toLowerCase().includes(msg)
    );
  }

  /**
   * Retry failed payments
   */
  async retryFailedPayments() {
    try {
      const failedPayments = await db('payments')
        .where('status', 'failed')
        .whereNotNull('next_retry_at')
        .where('next_retry_at', '<=', new Date())
        .where('retry_count', '<', 'max_retries');

      console.log(`Retrying ${failedPayments.length} failed payments`);

      for (const payment of failedPayments) {
        try {
          // Get affiliate and payment method details
          const affiliate = await db('affiliates')
            .where({ id: payment.affiliate_id })
            .first();

          const paymentMethod = JSON.parse(payment.payment_details);

          // Retry the payment
          const result = await this.executePayment(payment, paymentMethod, affiliate);

          // Update retry count
          await db('payments')
            .where({ id: payment.id })
            .increment('retry_count', 1);

          // Update payment record
          await this.updatePaymentRecord(payment.id, result);

          if (result.success) {
            console.log(`Successfully retried payment ${payment.id}`);
          } else {
            console.log(`Retry failed for payment ${payment.id}: ${result.error}`);
          }

        } catch (error) {
          console.error(`Error retrying payment ${payment.id}:`, error);
        }
      }

    } catch (error) {
      console.error('Error in retry failed payments:', error);
    }
  }

  /**
   * Get payment statistics
   */
  async getPaymentStatistics(dateRange = {}) {
    const { startDate, endDate } = dateRange;

    let query = db('payments');

    if (startDate) {
      query = query.where('created_at', '>=', startDate);
    }

    if (endDate) {
      query = query.where('created_at', '<=', endDate);
    }

    const [
      totalPayments,
      successfulPayments,
      failedPayments,
      totalAmount,
      avgAmount,
      methodBreakdown
    ] = await Promise.all([
      query.clone().count('* as count').first(),
      query.clone().where('status', 'completed').count('* as count').first(),
      query.clone().where('status', 'failed').count('* as count').first(),
      query.clone().sum('net_amount as total').first(),
      query.clone().avg('net_amount as avg').first(),
      query.clone()
        .select('payment_method')
        .count('* as count')
        .sum('net_amount as total')
        .groupBy('payment_method')
    ]);

    return {
      totalPayments: parseInt(totalPayments.count) || 0,
      successfulPayments: parseInt(successfulPayments.count) || 0,
      failedPayments: parseInt(failedPayments.count) || 0,
      totalAmount: parseFloat(totalAmount.total) || 0,
      averageAmount: parseFloat(avgAmount.avg) || 0,
      methodBreakdown: methodBreakdown
    };
  }
}

module.exports = PaymentService;