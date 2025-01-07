import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

        // Get customer details to find email
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

        // Update stripe_subscriptions table
        const { error: subscriptionError } = await supabaseAdmin
          .from('stripe_subscriptions')
          .upsert({
            user_id: profileData.id,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            is_active: true,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });

        if (subscriptionError) {
          console.error('Subscription update error:', subscriptionError);
          throw new Error(`Error updating subscription: ${subscriptionError.message}`);
        }

        // Update profiles table
        const { error: profileUpdateError } = await supabaseAdmin
          .from('profiles')
          .update({ 
            is_premium: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', profileData.id);

        if (profileUpdateError) {
          console.error('Profile update error:', profileUpdateError);
          throw new Error(`Error updating profile: ${profileUpdateError.message}`);
        }

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