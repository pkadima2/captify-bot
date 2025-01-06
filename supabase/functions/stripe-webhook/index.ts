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

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  
  try {
    if (!signature) {
      throw new Error('No signature found');
    }

    const body = await req.text();
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET');
    if (!webhookSecret) {
      throw new Error('Webhook secret not configured');
    }

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );

    console.log('Processing webhook event:', event.type);

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        // Get customer email from Stripe
        const customer = await stripe.customers.retrieve(customerId);
        if (!customer.email) {
          throw new Error('No customer email found');
        }

        console.log('Updating subscription for customer:', customer.email);

        // Get user_id from profiles table using email
        const { data: profileData, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', customer.email)
          .single();

        if (profileError || !profileData) {
          throw new Error(`No profile found for email: ${customer.email}`);
        }

        const userId = profileData.id;

        // Update stripe_subscriptions table
        const { error: subscriptionError } = await supabaseAdmin
          .from('stripe_subscriptions')
          .upsert({
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscription.id,
            is_active: subscription.status === 'active',
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });

        if (subscriptionError) {
          throw new Error(`Error updating subscription: ${subscriptionError.message}`);
        }

        // Update profiles table
        const { error: profileUpdateError } = await supabaseAdmin
          .from('profiles')
          .update({ 
            is_premium: subscription.status === 'active',
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        if (profileUpdateError) {
          throw new Error(`Error updating profile: ${profileUpdateError.message}`);
        }

        console.log('Successfully updated subscription and profile for:', customer.email);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        // Get customer email from Stripe
        const customer = await stripe.customers.retrieve(customerId);
        if (!customer.email) {
          throw new Error('No customer email found');
        }

        console.log('Processing subscription deletion for:', customer.email);

        // Get user_id from profiles table using email
        const { data: profileData, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', customer.email)
          .single();

        if (profileError || !profileData) {
          throw new Error(`No profile found for email: ${customer.email}`);
        }

        const userId = profileData.id;

        // Update stripe_subscriptions table
        const { error: subscriptionError } = await supabaseAdmin
          .from('stripe_subscriptions')
          .update({
            is_active: false,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (subscriptionError) {
          throw new Error(`Error updating subscription: ${subscriptionError.message}`);
        }

        // Update profiles table
        const { error: profileUpdateError } = await supabaseAdmin
          .from('profiles')
          .update({ 
            is_premium: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        if (profileUpdateError) {
          throw new Error(`Error updating profile: ${profileUpdateError.message}`);
        }

        console.log('Successfully processed subscription deletion for:', customer.email);
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});