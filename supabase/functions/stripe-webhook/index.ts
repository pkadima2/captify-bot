import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to format subscription data
const formatSubscriptionData = (
  subscription: Stripe.Subscription,
  customer: Stripe.Customer,
  profileId: string
) => {
  const subscriptionItem = subscription.items.data[0];
  const price = subscriptionItem.price;
  const paymentMethod = subscription.default_payment_method as Stripe.PaymentMethod;

  return {
    user_id: profileId,
    stripe_customer_id: customer.id,
    stripe_subscription_id: subscription.id,
    subscription_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    subscription_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    price_id: price.id,
    price_amount: price.unit_amount ? price.unit_amount / 100 : null,
    currency: price.currency,
    interval: price.recurring?.interval || null,
    payment_method: paymentMethod?.type || null,
    status: subscription.status,
    is_active: true,
    updated_at: new Date().toISOString()
  };
};

// Helper function to handle subscription updates
const handleSubscriptionUpdate = async (
  supabaseAdmin: any,
  subscriptionData: any
) => {
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
      is_premium: true,
      updated_at: new Date().toISOString()
    })
    .eq('id', subscriptionData.user_id);

  if (profileError) {
    console.error('Profile update error:', profileError);
    throw new Error(`Error updating profile: ${profileError.message}`);
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    }
  );

  try {
    const signature = req.headers.get('stripe-signature');
    
    if (!signature) {
      console.error('No stripe signature found');
      throw new Error('No stripe signature found');
    }

    const body = await req.text();
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET');
    
    if (!webhookSecret) {
      console.error('Webhook secret not configured');
      throw new Error('Webhook secret not configured');
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    console.log('Constructing Stripe event...');
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );

    console.log('Processing webhook event:', event.type);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Checkout session completed:', session.id);
        
        if (!session.customer || !session.subscription) {
          throw new Error('No customer or subscription found in session');
        }

        // Fetch the complete subscription details with expanded relations
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string, {
          expand: ['default_payment_method', 'items.data.price']
        });
        console.log('Full subscription details retrieved:', subscription.id);

        // Get customer details
        const customer = await stripe.customers.retrieve(session.customer as string);
        console.log('Customer retrieved:', customer.id);

        if (!customer.email) {
          throw new Error('No customer email found');
        }

        // Get user_id from profiles table using email
        const { data: profileData, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', customer.email)
          .single();

        if (profileError || !profileData) {
          console.error('Profile error:', profileError);
          throw new Error(`No profile found for email: ${customer.email}`);
        }

        console.log('Updating subscription for user:', profileData.id);

        // Format and update subscription data
        const subscriptionData = formatSubscriptionData(subscription, customer as Stripe.Customer, profileData.id);
        await handleSubscriptionUpdate(supabaseAdmin, subscriptionData);

        console.log('Successfully processed checkout session');
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Subscription deleted:', subscription.id);
        
        // Get customer details
        const customer = await stripe.customers.retrieve(subscription.customer as string);
        if (!customer.email) {
          throw new Error('No customer email found');
        }

        // Get user_id from profiles table using email
        const { data: profileData, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', customer.email)
          .single();

        if (profileError || !profileData) {
          throw new Error(`No profile found for email: ${customer.email}`);
        }

        // Update subscription status
        const { error: subscriptionError } = await supabaseAdmin
          .from('stripe_subscriptions')
          .update({
            is_active: false,
            status: subscription.status,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', profileData.id);

        if (subscriptionError) {
          throw new Error(`Error updating subscription: ${subscriptionError.message}`);
        }

        // Update premium status
        const { error: profileUpdateError } = await supabaseAdmin
          .from('profiles')
          .update({ 
            is_premium: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', profileData.id);

        if (profileUpdateError) {
          throw new Error(`Error updating profile: ${profileUpdateError.message}`);
        }

        console.log('Successfully processed subscription deletion');
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});