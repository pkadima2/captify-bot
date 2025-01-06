import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting checkout session creation...');
    
    // Initialize Supabase client with service role key for admin access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get the user information
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user?.email) {
      console.error('User authentication error:', userError);
      throw new Error('Authentication required');
    }

    console.log('User authenticated:', user.email);

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    // Get the price ID and origin URL from the request
    const { priceId } = await req.json();
    if (!priceId) {
      console.error('No price ID provided');
      throw new Error('No price ID provided');
    }

    // Get the origin from the request headers or default to a fallback URL
    const origin = req.headers.get('origin') || 'http://localhost:5173';
    console.log('Origin URL:', origin);

    console.log('Creating checkout session with price ID:', priceId);

    try {
      // First, check if a stripe_subscriptions record already exists
      const { data: existingSubscription, error: subscriptionError } = await supabaseAdmin
        .from('stripe_subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (subscriptionError) {
        console.error('Error checking existing subscription:', subscriptionError);
        throw new Error('Failed to check existing subscription');
      }

      let customerId = existingSubscription?.stripe_customer_id;

      if (!customerId) {
        console.log('Creating new Stripe customer...');
        // Create a new customer in Stripe
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: {
            supabase_user_id: user.id,
          },
        });
        customerId = customer.id;

        // Store the customer ID in our database
        const { error: insertError } = await supabaseAdmin
          .from('stripe_subscriptions')
          .insert({
            user_id: user.id,
            stripe_customer_id: customerId,
            stripe_subscription_id: '',
            is_active: false,
          });

        if (insertError) {
          console.error('Error storing customer ID:', insertError);
          throw new Error('Failed to store customer information');
        }
      }

      console.log('Creating checkout session...');
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${origin}/`,
        cancel_url: `${origin}/`,
      });

      console.log('Checkout session created successfully:', session.id);
      return new Response(
        JSON.stringify({ url: session.url }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );

    } catch (stripeError) {
      console.error('Stripe or database error:', stripeError);
      throw new Error(stripeError.message || 'Failed to create checkout session');
    }

  } catch (error) {
    console.error('Error in create-checkout-session:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});