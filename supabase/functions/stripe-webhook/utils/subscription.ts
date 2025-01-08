import { Stripe } from 'https://esm.sh/stripe@14.21.0';

export const isSubscriptionActive = (status: string): boolean => {
  return ['active', 'trialing'].includes(status);
};

export const formatSubscriptionData = (
  subscription: Stripe.Subscription,
  customer: Stripe.Customer,
  profileId: string
) => {
  const subscriptionItem = subscription.items.data[0];
  const price = subscriptionItem.price;
  const paymentMethod = subscription.default_payment_method as Stripe.PaymentMethod;

  const data = {
    user_id: profileId,
    stripe_customer_id: customer.id,
    stripe_subscription_id: subscription.id,
    subscription_item_id: subscriptionItem.id,
    price_id: price.id,
    price_amount: price.unit_amount ? price.unit_amount / 100 : null,
    currency: price.currency,
    interval: price.recurring?.interval || null,
    interval_count: price.recurring?.interval_count || null,
    billing_cycle_anchor: new Date(subscription.billing_cycle_anchor * 1000).toISOString(),
    subscription_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    subscription_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
    canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
    payment_method: paymentMethod?.type || null,
    status: subscription.status,
    is_active: isSubscriptionActive(subscription.status),
    metadata: subscription.metadata || {},
    updated_at: new Date().toISOString()
  };

  console.log('Formatted subscription data:', JSON.stringify(data, null, 2));
  return data;
};