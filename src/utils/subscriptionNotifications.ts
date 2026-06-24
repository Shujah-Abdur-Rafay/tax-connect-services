import { createNotification } from '@/services/notificationService';

export const notifySubscriptionCreated = async (userId: string, planName: string) => {
  await createNotification({
    userId,
    type: 'subscription',
    title: 'Subscription Activated',
    message: `Your ${planName} subscription has been successfully activated!`,
    read: false,
    metadata: { planName, status: 'active' }
  });
};

export const notifyPaymentSuccess = async (userId: string, amount: number) => {
  await createNotification({
    userId,
    type: 'payment',
    title: 'Payment Successful',
    message: `Payment of $${amount.toFixed(2)} received. Thank you!`,
    read: false,
    metadata: { amount, status: 'succeeded' }
  });
};

export const notifyPaymentFailed = async (userId: string, amount: number) => {
  await createNotification({
    userId,
    type: 'payment',
    title: 'Payment Failed',
    message: `Payment of $${amount.toFixed(2)} failed. Please update your payment method.`,
    read: false,
    metadata: { amount, status: 'failed' }
  });
};

export const notifySubscriptionCancelled = async (userId: string) => {
  await createNotification({
    userId,
    type: 'subscription',
    title: 'Subscription Cancelled',
    message: 'Your subscription has been cancelled. You will have access until the end of the billing period.',
    read: false,
    metadata: { status: 'cancelled' }
  });
};

export const notifySubscriptionRenewal = async (userId: string, nextBillingDate: string) => {
  await createNotification({
    userId,
    type: 'subscription',
    title: 'Subscription Renewal Reminder',
    message: `Your subscription will renew on ${nextBillingDate}.`,
    read: false,
    metadata: { nextBillingDate }
  });
};
