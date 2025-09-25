/**
 * Push Notification Unsubscription API Endpoint
 *
 * Handles push notification unsubscriptions and cleanup.
 */

import { subscriptions, userPreferences } from './subscribe';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { subscription } = req.body;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription data' });
    }

    // Generate subscription ID to find the stored subscription
    const subscriptionId = generateSubscriptionId(subscription);

    // Remove subscription
    const removed = subscriptions.delete(subscriptionId);
    userPreferences.delete(subscriptionId);

    if (removed) {
      console.log('Push subscription removed:', subscriptionId);

      res.status(200).json({
        success: true,
        message: 'Push notifications disabled successfully'
      });
    } else {
      res.status(404).json({
        error: 'Subscription not found'
      });
    }

  } catch (error) {
    console.error('Unsubscription failed:', error);

    res.status(500).json({
      error: 'Failed to unsubscribe',
      details: error.message
    });
  }
}

// Generate unique subscription ID (same as subscribe.js)
function generateSubscriptionId(subscription) {
  const endpoint = subscription.endpoint;
  const urlParts = new URL(endpoint);
  const pathParts = urlParts.pathname.split('/');
  const id = pathParts[pathParts.length - 1] || Math.random().toString(36).substr(2, 9);
  return `sub_${id.substr(0, 16)}`;
}