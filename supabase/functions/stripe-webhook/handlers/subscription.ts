import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { Stripe } from 'https://esm.sh/stripe@14.21.0';

export const isSubscriptionActive = (status: string): boolean => {
  return ['active', 'trialing'].includes(status);
};

export const handleSubscriptionUpdate = async (
  supabaseAdmin: any,
  subscription: Stripe.Subscription,
  customer: Stripe.Customer,
  profileId: string
) => {
  try {
    console.log('Starting subscription update process for profile:', profileId);
    console.log('Subscription status:', subscription.status);
    console.log('Subscription object:', JSON.stringify(subscription, null, 2));

    // First, update the stripe_subscriptions table
    const { error: subscriptionError } = await supabaseAdmin
      .from('stripe_subscriptions')
      .upsert({
        user_id: profileId,
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
        is_active: isSubscriptionActive(subscription.status),
        metadata: subscription.metadata,
        last_payment_error: null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (subscriptionError) {
      console.error('Error updating subscription:', subscriptionError);
      throw new Error(`Failed to update subscription: ${subscriptionError.message}`);
    }

    console.log('Successfully updated stripe_subscriptions table');

    // Then, update the profiles table
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        is_premium: isSubscriptionActive(subscription.status),
        updated_at: new Date().toISOString()
      })
      .eq('id', profileId);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      throw new Error(`Failed to update profile: ${profileError.message}`);
    }

    console.log('Successfully updated profiles table');
    console.log('Subscription update process completed successfully');
    
    return true;
  } catch (error) {
    console.error('Subscription update process failed:', error);
    throw error;
  }
};