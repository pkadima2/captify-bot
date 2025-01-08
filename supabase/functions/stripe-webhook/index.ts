import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🚀 Webhook function started');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing webhook request...');
    
    // Log all headers for debugging (excluding sensitive data)
    const headers = Object.fromEntries(req.headers.entries());
    console.log('Request headers present:', Object.keys(headers));
    
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      console.error('❌ No stripe signature found in headers');
      throw new Error('No stripe signature found');
    }
    console.log('✅ Stripe signature found');

    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET');
    if (!webhookSecret) {
      console.error('❌ Webhook secret not found in environment variables');
      throw new Error('Webhook secret not configured');
    }
    console.log('✅ Webhook secret found in environment');

    const body = await req.text();
    console.log('Request body length:', body.length);
    console.log('Request body preview:', body.substring(0, 100) + '...');
    
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });
    console.log('✅ Stripe client initialized');

    console.log('Attempting to construct Stripe event...');
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      );
      console.log('✅ Successfully constructed Stripe event:', event.type);
    } catch (err) {
      console.error('❌ Error constructing Stripe event:', {
        error: err.message,
        signature: signature ? 'present' : 'missing',
        bodyLength: body.length,
      });
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
    console.log('✅ Supabase admin client initialized');

    console.log('Processing webhook event type:', event.type);

    switch (event.type) {
      case 'checkout.session.completed':
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        console.log(`Processing ${event.type} event`);
        
        let subscription: Stripe.Subscription;
        
        if (event.type === 'checkout.session.completed') {
          const session = event.data.object as Stripe.Checkout.Session;
          console.log('Checkout session data:', {
            customerId: session.customer,
            subscriptionId: session.subscription,
            metadata: session.metadata
          });
          
          if (!session?.customer || !session?.subscription) {
            console.error('❌ Missing customer or subscription ID in session');
            throw new Error('Missing customer or subscription ID in session');
          }

          const subscriptionResponse = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          subscription = subscriptionResponse;
          console.log('✅ Retrieved subscription from session');
        } else {
          subscription = event.data.object as Stripe.Subscription;
          console.log('✅ Got subscription directly from event');
        }

        console.log('Subscription data:', {
          id: subscription.id,
          status: subscription.status,
          customerId: subscription.customer
        });

        const customer = await stripe.customers.retrieve(
          subscription.customer as string
        );
        console.log('✅ Customer retrieved:', {
          id: customer.id,
          metadata: (customer as Stripe.Customer).metadata
        });

        if (!customer || customer.deleted) {
          console.error('❌ Customer not found or deleted');
          throw new Error('Customer not found or deleted');
        }

        const userId = (customer as Stripe.Customer).metadata.supabase_user_id;
        if (!userId) {
          console.error('❌ No Supabase user ID found in customer metadata');
          throw new Error('No Supabase user ID found in customer metadata');
        }
        console.log('✅ Found Supabase user ID:', userId);

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
          console.error('❌ Error updating subscription in database:', subscriptionError);
          throw subscriptionError;
        }
        console.log('✅ Updated subscription in database');

        // Update user's premium status
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({ 
            is_premium: ['active', 'trialing'].includes(subscription.status),
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        if (profileError) {
          console.error('❌ Error updating user profile:', profileError);
          throw profileError;
        }
        console.log('✅ Updated user profile premium status');

        break;
      }
      default:
        console.log('Unhandled event type:', event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
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