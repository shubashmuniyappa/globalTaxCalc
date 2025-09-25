/**
 * Push Notification Subscription API Endpoint
 *
 * Handles push notification subscriptions for the GlobalTaxCalc PWA,
 * including user preferences and notification scheduling.
 */

import webpush from 'web-push';

// Configure web-push with VAPID keys
webpush.setVapidDetails(
  'mailto:support@globaltaxcalc.com',
  process.env.VAPID_PUBLIC_KEY || 'demo-public-key',
  process.env.VAPID_PRIVATE_KEY || 'demo-private-key'
);

// In-memory storage for demo (use database in production)
const subscriptions = new Map();
const userPreferences = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { subscription, userAgent, timestamp, preferences } = req.body;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription data' });
    }

    // Generate subscription ID
    const subscriptionId = generateSubscriptionId(subscription);

    // Store subscription
    const subscriptionData = {
      id: subscriptionId,
      subscription,
      userAgent,
      timestamp,
      preferences: preferences || {},
      active: true,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };

    subscriptions.set(subscriptionId, subscriptionData);

    // Store user preferences
    if (preferences) {
      userPreferences.set(subscriptionId, preferences);
    }

    // Send welcome notification
    await sendWelcomeNotification(subscription);

    // Schedule upcoming tax deadline notifications
    await scheduleDeadlineNotifications(subscriptionId, subscription);

    console.log('Push subscription registered:', subscriptionId);

    res.status(200).json({
      success: true,
      subscriptionId,
      message: 'Push notifications enabled successfully'
    });

  } catch (error) {
    console.error('Subscription registration failed:', error);

    res.status(500).json({
      error: 'Failed to register subscription',
      details: error.message
    });
  }
}

// Generate unique subscription ID
function generateSubscriptionId(subscription) {
  const endpoint = subscription.endpoint;
  const urlParts = new URL(endpoint);
  const pathParts = urlParts.pathname.split('/');
  const id = pathParts[pathParts.length - 1] || Math.random().toString(36).substr(2, 9);
  return `sub_${id.substr(0, 16)}`;
}

// Send welcome notification
async function sendWelcomeNotification(subscription) {
  try {
    const payload = JSON.stringify({
      title: 'Welcome to GlobalTaxCalc!',
      body: 'You\'ll now receive helpful tax reminders and tips.',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: 'welcome',
      data: {
        type: 'welcome',
        url: '/',
        timestamp: Date.now()
      },
      actions: [
        {
          action: 'open',
          title: 'Open App',
          icon: '/icons/action-open.png'
        }
      ]
    });

    await webpush.sendNotification(subscription, payload);
    console.log('Welcome notification sent');

  } catch (error) {
    console.error('Failed to send welcome notification:', error);
  }
}

// Schedule tax deadline notifications
async function scheduleDeadlineNotifications(subscriptionId, subscription) {
  const currentYear = new Date().getFullYear();
  const deadlines = [
    {
      date: new Date(`${currentYear}-04-15`),
      title: 'Federal Tax Filing Deadline',
      type: 'federal_filing'
    },
    {
      date: new Date(`${currentYear}-06-17`),
      title: 'Q2 Estimated Tax Payment',
      type: 'estimated_tax'
    },
    {
      date: new Date(`${currentYear}-09-16`),
      title: 'Q3 Estimated Tax Payment',
      type: 'estimated_tax'
    },
    {
      date: new Date(`${currentYear + 1}-01-15`),
      title: 'Q4 Estimated Tax Payment',
      type: 'estimated_tax'
    }
  ];

  for (const deadline of deadlines) {
    if (deadline.date > new Date()) {
      // Schedule notifications 30, 14, 7, and 1 days before deadline
      const intervals = [30, 14, 7, 1];

      for (const days of intervals) {
        const notificationDate = new Date(deadline.date);
        notificationDate.setDate(notificationDate.getDate() - days);

        if (notificationDate > new Date()) {
          scheduleNotification(subscriptionId, subscription, {
            date: notificationDate,
            title: 'Tax Deadline Reminder',
            body: `${days} days left until ${deadline.title}!`,
            data: {
              type: 'tax_deadline',
              deadline: deadline.title,
              days: days,
              year: currentYear,
              url: '/calculators/income-tax'
            }
          });
        }
      }
    }
  }
}

// Schedule a notification (simplified - use job queue in production)
function scheduleNotification(subscriptionId, subscription, notification) {
  const delay = notification.date.getTime() - Date.now();

  if (delay > 0) {
    setTimeout(async () => {
      try {
        // Check if subscription is still active
        const subscriptionData = subscriptions.get(subscriptionId);
        if (!subscriptionData || !subscriptionData.active) {
          return;
        }

        const payload = JSON.stringify({
          title: notification.title,
          body: notification.body,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          tag: notification.data.type,
          data: notification.data,
          requireInteraction: true,
          actions: [
            {
              action: 'calculate',
              title: 'Calculate Now',
              icon: '/icons/action-calculate.png'
            },
            {
              action: 'remind-later',
              title: 'Remind Later',
              icon: '/icons/action-later.png'
            }
          ]
        });

        await webpush.sendNotification(subscription, payload);
        console.log(`Scheduled notification sent to ${subscriptionId}`);

      } catch (error) {
        console.error('Failed to send scheduled notification:', error);

        // Handle subscription errors (expired, invalid, etc.)
        if (error.statusCode === 410 || error.statusCode === 404) {
          // Subscription is no longer valid
          const subscriptionData = subscriptions.get(subscriptionId);
          if (subscriptionData) {
            subscriptionData.active = false;
            console.log(`Deactivated invalid subscription: ${subscriptionId}`);
          }
        }
      }
    }, delay);
  }

  console.log(`Notification scheduled for ${notification.date.toISOString()}`);
}

// Export utility functions for other API routes
export { subscriptions, userPreferences, webpush, scheduleNotification };