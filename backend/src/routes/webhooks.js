const express = require('express');
const router = express.Router();
const { verifyWebhookSignature } = require('../config/stripe');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const logger = require('../utils/logger');

// Stripe webhook endpoint
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = verifyWebhookSignature(req.body, signature, endpointSecret);
  } catch (error) {
    logger.error('Webhook signature verification failed:', error);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  logger.info('Stripe webhook received', { type: event.type, id: event.id });

  try {
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      case 'invoice.upcoming':
        await handleUpcomingInvoice(event.data.object);
        break;

      case 'customer.created':
        await handleCustomerCreated(event.data.object);
        break;

      case 'customer.updated':
        await handleCustomerUpdated(event.data.object);
        break;

      case 'payment_method.attached':
        await handlePaymentMethodAttached(event.data.object);
        break;

      case 'setup_intent.succeeded':
        await handleSetupIntentSucceeded(event.data.object);
        break;

      default:
        logger.info('Unhandled webhook event type:', event.type);
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Webhook handlers
async function handleSubscriptionCreated(subscription) {
  logger.info('Processing subscription.created webhook', {
    subscriptionId: subscription.id,
    customerId: subscription.customer
  });

  try {
    const existingSubscription = await Subscription.findByStripeSubscriptionId(subscription.id);

    if (existingSubscription) {
      logger.info('Subscription already exists, updating', {
        subscriptionId: subscription.id
      });
      return await updateSubscriptionFromStripe(existingSubscription, subscription);
    }

    // Find subscription by customer ID if not found by subscription ID
    const customerSubscription = await Subscription.findByStripeCustomerId(subscription.customer);

    if (customerSubscription) {
      return await updateSubscriptionFromStripe(customerSubscription, subscription);
    }

    logger.warn('No local subscription found for webhook', {
      subscriptionId: subscription.id,
      customerId: subscription.customer
    });
  } catch (error) {
    logger.error('Error processing subscription.created webhook:', error);
    throw error;
  }
}

async function handleSubscriptionUpdated(subscription) {
  logger.info('Processing subscription.updated webhook', {
    subscriptionId: subscription.id,
    status: subscription.status
  });

  try {
    const localSubscription = await Subscription.findByStripeSubscriptionId(subscription.id);

    if (!localSubscription) {
      logger.warn('No local subscription found for update webhook', {
        subscriptionId: subscription.id
      });
      return;
    }

    await updateSubscriptionFromStripe(localSubscription, subscription);
  } catch (error) {
    logger.error('Error processing subscription.updated webhook:', error);
    throw error;
  }
}

async function handleSubscriptionDeleted(subscription) {
  logger.info('Processing subscription.deleted webhook', {
    subscriptionId: subscription.id
  });

  try {
    const localSubscription = await Subscription.findByStripeSubscriptionId(subscription.id);

    if (!localSubscription) {
      logger.warn('No local subscription found for deletion webhook', {
        subscriptionId: subscription.id
      });
      return;
    }

    await localSubscription.update({
      status: 'canceled',
      tier: 'free',
      endedAt: new Date(subscription.ended_at * 1000),
      canceledAt: new Date(subscription.canceled_at * 1000),
      metadata: {
        ...localSubscription.metadata,
        deletedAt: new Date().toISOString(),
        deletionReason: subscription.cancellation_details?.reason
      }
    });

    logger.info('Subscription marked as deleted', {
      subscriptionId: subscription.id,
      userId: localSubscription.userId
    });
  } catch (error) {
    logger.error('Error processing subscription.deleted webhook:', error);
    throw error;
  }
}

async function handleTrialWillEnd(subscription) {
  logger.info('Processing subscription.trial_will_end webhook', {
    subscriptionId: subscription.id,
    trialEnd: new Date(subscription.trial_end * 1000)
  });

  try {
    const localSubscription = await Subscription.findByStripeSubscriptionId(subscription.id);

    if (!localSubscription) {
      logger.warn('No local subscription found for trial ending webhook');
      return;
    }

    // Send trial ending notification (implement email service)
    await sendTrialEndingNotification(localSubscription);

    // Update metadata
    await localSubscription.update({
      metadata: {
        ...localSubscription.metadata,
        trialEndingNotificationSent: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error processing trial_will_end webhook:', error);
    throw error;
  }
}

async function handlePaymentSucceeded(invoice) {
  logger.info('Processing invoice.payment_succeeded webhook', {
    invoiceId: invoice.id,
    customerId: invoice.customer,
    amount: invoice.amount_paid
  });

  try {
    const subscription = await Subscription.findByStripeCustomerId(invoice.customer);

    if (!subscription) {
      logger.warn('No subscription found for payment success webhook', {
        customerId: invoice.customer
      });
      return;
    }

    // Update subscription with payment info
    await subscription.update({
      status: 'active',
      lastPaymentDate: new Date(invoice.status_transitions.paid_at * 1000),
      metadata: {
        ...subscription.metadata,
        lastSuccessfulPayment: {
          invoiceId: invoice.id,
          amount: invoice.amount_paid,
          date: new Date().toISOString()
        }
      }
    });

    // Send payment success notification
    await sendPaymentSuccessNotification(subscription, invoice);

    logger.info('Payment success processed', {
      subscriptionId: subscription.id,
      invoiceId: invoice.id
    });
  } catch (error) {
    logger.error('Error processing payment_succeeded webhook:', error);
    throw error;
  }
}

async function handlePaymentFailed(invoice) {
  logger.info('Processing invoice.payment_failed webhook', {
    invoiceId: invoice.id,
    customerId: invoice.customer,
    attemptCount: invoice.attempt_count
  });

  try {
    const subscription = await Subscription.findByStripeCustomerId(invoice.customer);

    if (!subscription) {
      logger.warn('No subscription found for payment failure webhook', {
        customerId: invoice.customer
      });
      return;
    }

    // Update subscription status
    await subscription.update({
      status: 'past_due',
      metadata: {
        ...subscription.metadata,
        lastFailedPayment: {
          invoiceId: invoice.id,
          attemptCount: invoice.attempt_count,
          date: new Date().toISOString(),
          failureReason: invoice.last_finalization_error?.message
        }
      }
    });

    // Send payment failure notification
    await sendPaymentFailureNotification(subscription, invoice);

    logger.info('Payment failure processed', {
      subscriptionId: subscription.id,
      invoiceId: invoice.id,
      attemptCount: invoice.attempt_count
    });
  } catch (error) {
    logger.error('Error processing payment_failed webhook:', error);
    throw error;
  }
}

async function handleUpcomingInvoice(invoice) {
  logger.info('Processing invoice.upcoming webhook', {
    invoiceId: invoice.id,
    customerId: invoice.customer,
    amount: invoice.amount_due
  });

  try {
    const subscription = await Subscription.findByStripeCustomerId(invoice.customer);

    if (!subscription) {
      logger.warn('No subscription found for upcoming invoice webhook');
      return;
    }

    // Update next payment date
    await subscription.update({
      nextPaymentDate: new Date(invoice.period_end * 1000),
      metadata: {
        ...subscription.metadata,
        upcomingInvoice: {
          invoiceId: invoice.id,
          amount: invoice.amount_due,
          dueDate: new Date(invoice.period_end * 1000).toISOString()
        }
      }
    });

    // Send upcoming payment notification
    await sendUpcomingPaymentNotification(subscription, invoice);
  } catch (error) {
    logger.error('Error processing upcoming invoice webhook:', error);
    throw error;
  }
}

async function handleCustomerCreated(customer) {
  logger.info('Processing customer.created webhook', {
    customerId: customer.id,
    email: customer.email
  });

  // Customer creation is typically handled during subscription creation
  // This webhook is mainly for logging and analytics
}

async function handleCustomerUpdated(customer) {
  logger.info('Processing customer.updated webhook', {
    customerId: customer.id,
    email: customer.email
  });

  try {
    const subscription = await Subscription.findByStripeCustomerId(customer.id);

    if (subscription) {
      await subscription.update({
        metadata: {
          ...subscription.metadata,
          customerUpdated: new Date().toISOString(),
          customerEmail: customer.email
        }
      });
    }
  } catch (error) {
    logger.error('Error processing customer.updated webhook:', error);
    throw error;
  }
}

async function handlePaymentMethodAttached(paymentMethod) {
  logger.info('Processing payment_method.attached webhook', {
    paymentMethodId: paymentMethod.id,
    customerId: paymentMethod.customer
  });

  try {
    const subscription = await Subscription.findByStripeCustomerId(paymentMethod.customer);

    if (subscription) {
      await subscription.update({
        metadata: {
          ...subscription.metadata,
          paymentMethodAttached: {
            paymentMethodId: paymentMethod.id,
            type: paymentMethod.type,
            date: new Date().toISOString()
          }
        }
      });
    }
  } catch (error) {
    logger.error('Error processing payment_method.attached webhook:', error);
    throw error;
  }
}

async function handleSetupIntentSucceeded(setupIntent) {
  logger.info('Processing setup_intent.succeeded webhook', {
    setupIntentId: setupIntent.id,
    customerId: setupIntent.customer
  });

  // Setup intent success typically means payment method was successfully attached
  // This is handled by payment_method.attached webhook
}

// Helper functions
async function updateSubscriptionFromStripe(localSubscription, stripeSubscription) {
  const { getTierByPriceId } = require('../config/stripe');

  const priceId = stripeSubscription.items.data[0]?.price?.id;
  const tier = getTierByPriceId(priceId);

  const updateData = {
    stripeSubscriptionId: stripeSubscription.id,
    stripePriceId: priceId,
    tier: tier?.id || localSubscription.tier,
    status: stripeSubscription.status,
    currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
    currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    amount: stripeSubscription.items.data[0]?.price?.unit_amount || localSubscription.amount,
    currency: stripeSubscription.currency?.toUpperCase() || 'USD',
    interval: stripeSubscription.items.data[0]?.price?.recurring?.interval || localSubscription.interval,
    metadata: {
      ...localSubscription.metadata,
      lastWebhookUpdate: new Date().toISOString(),
      stripeStatus: stripeSubscription.status
    }
  };

  if (stripeSubscription.trial_start) {
    updateData.trialStart = new Date(stripeSubscription.trial_start * 1000);
  }

  if (stripeSubscription.trial_end) {
    updateData.trialEnd = new Date(stripeSubscription.trial_end * 1000);
  }

  if (stripeSubscription.canceled_at) {
    updateData.canceledAt = new Date(stripeSubscription.canceled_at * 1000);
  }

  if (stripeSubscription.ended_at) {
    updateData.endedAt = new Date(stripeSubscription.ended_at * 1000);
  }

  await localSubscription.update(updateData);

  logger.info('Subscription updated from Stripe webhook', {
    subscriptionId: localSubscription.id,
    stripeSubscriptionId: stripeSubscription.id,
    status: stripeSubscription.status,
    tier: updateData.tier
  });

  return localSubscription;
}

// Notification functions (to be implemented with email service)
async function sendTrialEndingNotification(subscription) {
  // TODO: Implement email notification
  logger.info('Trial ending notification would be sent', {
    subscriptionId: subscription.id,
    userId: subscription.userId
  });
}

async function sendPaymentSuccessNotification(subscription, invoice) {
  // TODO: Implement email notification
  logger.info('Payment success notification would be sent', {
    subscriptionId: subscription.id,
    invoiceId: invoice.id
  });
}

async function sendPaymentFailureNotification(subscription, invoice) {
  // TODO: Implement email notification
  logger.info('Payment failure notification would be sent', {
    subscriptionId: subscription.id,
    invoiceId: invoice.id,
    attemptCount: invoice.attempt_count
  });
}

async function sendUpcomingPaymentNotification(subscription, invoice) {
  // TODO: Implement email notification
  logger.info('Upcoming payment notification would be sent', {
    subscriptionId: subscription.id,
    invoiceId: invoice.id,
    amount: invoice.amount_due
  });
}

module.exports = router;