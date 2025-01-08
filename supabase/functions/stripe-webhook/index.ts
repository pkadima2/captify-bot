import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('Webhook function called with method:', req.method);
  
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing webhook request...');
    
    // Log all headers for debugging
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));
    
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      console.error('No stripe signature found in headers');
      throw new Error('No stripe signature found');
    }

    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET');
    if (!webhookSecret) {
      console.error('Webhook secret not found in environment variables');
      throw new Error('Webhook secret not configured');
    }

    const body = await req.text();
    console.log('Request body length:', body.length);
    
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    console.log('Constructing Stripe event...');
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      );
      console.log('Successfully constructed Stripe event:', event.type);
    } catch (err) {
      console.error('Error constructing Stripe event:', err);
      throw err;
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

    console.log('Processing webhook event:', event.type);

    switch (event.type) {
      case 'checkout.session.completed':
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        console.log(`Processing ${event.type} event`);
        
        let subscription;
        let customer;

        if (event.type === 'checkout.session.completed') {
          const session = event.data.object as Stripe.Checkout.Session;
          console.log('Checkout session data:', session);
          
          if (!session?.customer || !session?.subscription) {
            console.error('Missing customer or subscription ID in session');
            throw new Error('Missing customer or subscription ID in session');
          }

          subscription = await stripe.subscriptions.retrieve(
            session.subscription as string,
            {
              expand: ['default_payment_method', 'items.data.price']
            }
          );
          customer = await stripe.customers.retrieve(session.customer as string);
        } else {
          subscription = event.data.object as Stripe.Subscription;
          customer = await stripe.customers.retrieve(subscription.customer as string);
        }

        console.log('Subscription retrieved:', subscription.id);
        console.log('Customer retrieved:', customer.id);

        if (!customer || customer.deleted) {
          console.error('Customer not found or deleted');
          throw new Error('Customer not found or deleted');
        }

        const userId = (customer as Stripe.Customer).metadata.supabase_user_id;
        if (!userId) {
          console.error('No Supabase user ID found in customer metadata');
          throw new Error('No Supabase user ID found in customer metadata');
        }

        const subscriptionData = {
          user_id: userId,
          stripe_customer_id: subscription.customer,
          stripe_subscription_id: subscription.id,
          subscription_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          subscription_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          price_id: subscription.items.data[0]?.price?.id,
          price_amount: subscription.items.data[0]?.price?.unit_amount,
          currency: subscription.currency,
          interval: subscription.items.data[0]?.price?.recurring?.interval,
          interval_count: subscription.items.data[0]?.price?.recurring?.interval_count,
          payment_method: (subscription.default_payment_method as Stripe.PaymentMethod)?.type || null,
          status: subscription.status,
          subscription_item_id: subscription.items.data[0]?.id,
          billing_cycle_anchor: subscription.billing_cycle_anchor ? new Date(subscription.billing_cycle_anchor * 1000).toISOString() : null,
          cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
          canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
          is_active: ['active', 'trialing'].includes(subscription.status),
          metadata: subscription.metadata || {},
          updated_at: new Date().toISOString()
        };

        console.log('Upserting subscription data:', subscriptionData);

        const { error: subscriptionError } = await supabaseAdmin
          .from('stripe_subscriptions')
          .upsert(subscriptionData, {
            onConflict: 'user_id'
          });

        if (subscriptionError) {
          console.error('Error updating subscription:', subscriptionError);
          throw new Error(`Failed to update subscription: ${subscriptionError.message}`);
        }

        // Update user's premium status
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({ 
            is_premium: ['active', 'trialing'].includes(subscription.status),
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        if (profileError) {
          console.error('Error updating profile:', profileError);
          throw new Error(`Failed to update profile: ${profileError.message}`);
        }

        console.log('Successfully updated subscription and profile data');
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Webhook processing error:', error);
    // Log the full error object for debugging
    console.error('Full error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause
    });
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});