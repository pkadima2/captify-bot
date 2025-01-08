import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { Stripe } from 'https://esm.sh/stripe@14.21.0';

export const handleSubscriptionUpdate = async (
  supabaseAdmin: any,
  subscription: Stripe.Subscription,
  customer: Stripe.Customer,
  profileId: string
) => {
  try {
    console.log('Starting subscription update process for profile:', profileId);
    console.log('Subscription object:', JSON.stringify(subscription, null, 2));
    
    // Format the subscription data
    const subscriptionData = formatSubscriptionData(subscription, customer, profileId);
    console.log('Formatted subscription data:', JSON.stringify(subscriptionData, null, 2));

    // Verify the subscription data matches your table schema
    const { data: existingSubscription, error: fetchError } = await supabaseAdmin
      .from('stripe_subscriptions')
      .select('*')
      .eq('user_id', profileId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching existing subscription:', fetchError);
      throw fetchError;
    }

    console.log('Existing subscription:', existingSubscription);

    // Perform the upsert with conflict handling
    const { error: subscriptionError } = await supabaseAdmin
      .from('stripe_subscriptions')
      .upsert(subscriptionData, {
        onConflict: 'user_id',
        returning: 'minimal'
      });

    if (subscriptionError) {
      console.error('Subscription upsert error:', subscriptionError);
      console.error('Failed data:', subscriptionData);
      throw new Error(`Error updating subscription: ${subscriptionError.message}`);
    }

    console.log('Subscription upsert successful');

    // Update profile premium status
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        is_premium: isSubscriptionActive(subscription.status),
        updated_at: new Date().toISOString()
      })
      .eq('id', profileId);

    if (profileError) {
      console.error('Profile update error:', profileError);
      throw new Error(`Error updating profile: ${profileError.message}`);
    }

    console.log('Successfully completed subscription update process');
    return true;

  } catch (error) {
    console.error('Subscription update process failed:', error);
    throw error;
  }
};

export const formatSubscriptionData = (
  subscription: Stripe.Subscription,
  customer: Stripe.Customer,
  profileId: string
) => {
  try {
    const subscriptionItem = subscription.items.data[0];
    if (!subscriptionItem) {
      throw new Error('No subscription item found');
    }

    const price = subscriptionItem.price;
    if (!price) {
      throw new Error('No price information found');
    }

    const paymentMethod = subscription.default_payment_method as Stripe.PaymentMethod;

    return {
      user_id: profileId,
      stripe_customer_id: customer.id,
      stripe_subscription_id: subscription.id,
      subscription_item_id: subscriptionItem.id,
      price_id: price.id,
      price_amount: price.unit_amount ? price.unit_amount / 100 : null,
      currency: price.currency,
      interval: price.recurring?.interval || null,
      interval_count: price.recurring?.interval_count || null,
      subscription_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      subscription_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      billing_cycle_anchor: subscription.billing_cycle_anchor ? new Date(subscription.billing_cycle_anchor * 1000).toISOString() : null,
      cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
      payment_method: paymentMethod?.type || null,
      status: subscription.status,
      is_active: isSubscriptionActive(subscription.status),
      metadata: subscription.metadata || {},
      last_payment_error: subscription.last_payment_error?.message || null,
      updated_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error formatting subscription data:', error);
    throw error;
  }
};

export const isSubscriptionActive = (status: string): boolean => {
  return ['active', 'trialing'].includes(status);
};