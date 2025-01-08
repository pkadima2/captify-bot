import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { logError, logSuccess, logWebhookEvent } from './logging.ts';

export const handleSubscriptionUpdate = async (
  supabaseAdmin: any,
  subscription: Stripe.Subscription,
  customer: Stripe.Customer
) => {
  try {
    logWebhookEvent('subscription_update', { subscription, customer });

    const userId = (customer as Stripe.Customer).metadata.supabase_user_id;
    if (!userId) {
      throw new Error('No Supabase user ID found in customer metadata');
    }

    // Update subscription in database
    const { error: subscriptionError } = await supabaseAdmin
      .from('stripe_subscriptions')
      .upsert({
        user_id: userId,
        stripe_customer_id: customer.id,
        stripe_subscription_id: subscription.id,
        subscription_item_id: subscription.items.data[0]?.id,
        price_id: subscription.items.data[0]?.price?.id,
        price_amount: subscription.items.data[0]?.price?.unit_amount ? subscription.items.data[0].price.unit_amount / 100 : null,
        currency: subscription.currency,
        interval: subscription.items.data[0]?.price?.recurring?.interval,
        interval_count: subscription.items.data[0]?.price?.recurring?.interval_count,
        subscription_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        subscription_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        billing_cycle_anchor: subscription.billing_cycle_anchor ? new Date(subscription.billing_cycle_anchor * 1000).toISOString() : null,
        cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
        canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
        payment_method: (subscription.default_payment_method as Stripe.PaymentMethod)?.type || null,
        status: subscription.status,
        is_active: ['active', 'trialing'].includes(subscription.status),
        metadata: subscription.metadata,
        last_payment_error: null,
        updated_at: new Date().toISOString()
      });

    if (subscriptionError) {
      throw subscriptionError;
    }
    logSuccess('Updated subscription in database');

    // Update user's premium status
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        is_premium: ['active', 'trialing'].includes(subscription.status),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (profileError) {
      throw profileError;
    }
    logSuccess('Updated user profile premium status');

    return true;
  } catch (error) {
    logError('handleSubscriptionUpdate', error);
    throw error;
  }
};

export const verifyAndConstructEvent = async (
  stripe: Stripe,
  body: string,
  signature: string,
  webhookSecret: string
) => {
  try {
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    logSuccess('Stripe event constructed', { type: event.type });
    return event;
  } catch (err) {
    logError('Error constructing Stripe event', {
      error: err,
      signature: signature ? 'present' : 'missing',
      bodyLength: body.length,
    });
    throw err;
  }
};