import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { Stripe } from 'https://esm.sh/stripe@14.21.0';
import { formatSubscriptionData, isSubscriptionActive } from '../utils/subscription.ts';

export const handleSubscriptionUpdate = async (
  supabaseAdmin: any,
  subscription: Stripe.Subscription,
  customer: Stripe.Customer,
  profileId: string
) => {
  console.log('Processing subscription update for profile:', profileId);
  
  const subscriptionData = formatSubscriptionData(subscription, customer, profileId);
  
  const { error: subscriptionError } = await supabaseAdmin
    .from('stripe_subscriptions')
    .upsert(subscriptionData, {
      onConflict: 'user_id'
    });

  if (subscriptionError) {
    console.error('Subscription update error:', subscriptionError);
    throw new Error(`Error updating subscription: ${subscriptionError.message}`);
  }

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

  console.log('Successfully updated subscription and profile for user:', profileId);
};

export const handleSubscriptionDeletion = async (
  supabaseAdmin: any,
  profileId: string
) => {
  console.log('Processing subscription deletion for profile:', profileId);

  const { error: subscriptionError } = await supabaseAdmin
    .from('stripe_subscriptions')
    .update({
      is_active: false,
      status: 'canceled',
      updated_at: new Date().toISOString()
    })
    .eq('user_id', profileId);

  if (subscriptionError) {
    console.error('Subscription deletion error:', subscriptionError);
    throw new Error(`Error updating subscription: ${subscriptionError.message}`);
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({ 
      is_premium: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', profileId);

  if (profileError) {
    console.error('Profile update error:', profileError);
    throw new Error(`Error updating profile: ${profileError.message}`);
  }

  console.log('Successfully processed subscription deletion for user:', profileId);
};