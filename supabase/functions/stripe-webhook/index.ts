import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

serve(async (req) => {
  try {
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response('No signature', { status: 400 });
    }

    const body = await req.text();
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET') || ''
      );
    } catch (err) {
      console.error('Error verifying webhook signature:', err);
      return new Response('Invalid signature', { status: 400 });
    }

    console.log('Processing event:', event.type);

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscription = event.data.object;
        const customer = await stripe.customers.retrieve(subscription.customer as string);
        
        if (!customer.email) {
          throw new Error('No customer email found');
        }

        // Update user's premium status based on subscription status
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({ 
            is_premium: subscription.status === 'active',
            updated_at: new Date().toISOString()
          })
          .eq('email', customer.email);

        if (updateError) {
          throw updateError;
        }

        console.log(`Updated premium status for user ${customer.email}`);
        break;

      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object;
        const deletedCustomer = await stripe.customers.retrieve(deletedSubscription.customer as string);
        
        if (!deletedCustomer.email) {
          throw new Error('No customer email found');
        }

        // Set premium status to false when subscription is cancelled
        const { error: deleteError } = await supabaseAdmin
          .from('profiles')
          .update({ 
            is_premium: false,
            updated_at: new Date().toISOString()
          })
          .eq('email', deletedCustomer.email);

        if (deleteError) {
          throw deleteError;
        }

        console.log(`Removed premium status for user ${deletedCustomer.email}`);
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});