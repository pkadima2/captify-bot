import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from './utils/cors.ts';
import { handleSubscriptionUpdate } from './handlers/subscription.ts';

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
        console.log('Checkout session completed event received');
        const session = event.data.object as Stripe.Checkout.Session;
        
        if (!session?.customer || !session?.subscription) {
          throw new Error('Missing customer or subscription ID in session');
        }

        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string,
          {
            expand: ['default_payment_method', 'items.data.price']
          }
        );
        console.log('Subscription retrieved:', subscription.id);

        const customer = await stripe.customers.retrieve(session.customer as string);
        console.log('Customer retrieved:', customer.id);

        if (!customer || customer.deleted) {
          throw new Error('Customer not found or deleted');
        }

        const { data: profileData, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', customer.email)
          .maybeSingle();

        if (profileError || !profileData) {
          throw new Error(`No profile found for email: ${customer.email}`);
        }

        await handleSubscriptionUpdate(
          supabaseAdmin,
          subscription,
          customer as Stripe.Customer,
          profileData.id
        );

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Subscription deleted:', subscription.id);
        
        const customer = await stripe.customers.retrieve(subscription.customer as string);
        if (!customer || customer.deleted || !customer.email) {
          throw new Error('No customer email found');
        }

        const { data: profileData, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', customer.email)
          .maybeSingle();

        if (profileError || !profileData) {
          throw new Error(`No profile found for email: ${customer.email}`);
        }

        // Update profile and subscription status
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({ 
            is_premium: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', profileData.id);

        if (updateError) {
          throw new Error(`Failed to update profile: ${updateError.message}`);
        }

        break;
      }
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
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});