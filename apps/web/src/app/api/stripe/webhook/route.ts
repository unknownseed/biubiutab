import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import { requireEnv } from '@/lib/env';

const supabaseAdmin = createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'));

export async function POST(req: Request) {
  const stripe = getStripe();
  const body = await req.text();
  const signature = req.headers.get('stripe-signature') as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json({ error: 'Missing Stripe Webhook Secret' }, { status: 500 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('⚠️  Webhook signature verification failed.', err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      const subscription = event.data.object as any;
      const customerId = subscription.customer;
      const status = subscription.status;
      const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

      const planType = subscription.metadata?.plan_type || 'monthly';

      const { error: updateError } = await supabaseAdmin
        .from('subscriptions')
        .update({
          stripe_subscription_id: subscription.id,
          status: status,
          plan_type: planType,
          current_period_end: currentPeriodEnd,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_customer_id', customerId);

      if (updateError) {
        console.error('Error updating subscription in Supabase:', updateError);
      } else {
        console.log(`✅ Subscription ${subscription.id} updated successfully to status: ${status}`);
      }
      break;

    case 'customer.subscription.deleted':
      const deletedSub = event.data.object as any;
      const { error: deleteError } = await supabaseAdmin
        .from('subscriptions')
        .update({
          status: 'canceled',
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', deletedSub.id);

      if (deleteError) {
        console.error('Error canceling subscription in Supabase:', deleteError);
      }
      break;

    case 'checkout.session.completed':
      const session = event.data.object as any;
      
      if (session.mode === 'payment' && session.payment_status === 'paid') {
        const userId = session.metadata?.user_id;
        const planType = session.metadata?.plan_type || 'monthly';
        const customer = session.customer;

        if (userId) {
          const { data: existingSub } = await supabaseAdmin
            .from('subscriptions')
            .select('current_period_end')
            .eq('user_id', userId)
            .single();

          let baseDate = new Date();
          if (existingSub?.current_period_end) {
            const currentEnd = new Date(existingSub.current_period_end);
            if (currentEnd > baseDate) {
              baseDate = currentEnd;
            }
          }

          let daysToAdd = 31;
          if (planType === 'yearly') {
            daysToAdd = 365;
          } else if (planType === 'quarterly') {
            daysToAdd = 90;
          }

          baseDate.setDate(baseDate.getDate() + daysToAdd);

          const { error: checkoutError } = await supabaseAdmin
            .from('subscriptions')
            .upsert({
              user_id: userId,
              stripe_customer_id: customer,
              stripe_subscription_id: null,
              plan_type: planType,
              status: 'active',
              current_period_end: baseDate.toISOString(),
              updated_at: new Date().toISOString(),
            });
            
          if (checkoutError) {
            console.error('Error in payment checkout.session.completed:', checkoutError);
          } else {
            console.log(`✅ Payment Checkout completed! User ${userId} is now active until ${baseDate.toISOString()}.`);
          }
        }
      }
      else if (session.mode === 'subscription') {
        const userId = session.metadata?.user_id;
        const subId = session.subscription;
        const customer = session.customer;

        if (userId && subId) {
          let currentPeriodEnd: string | null = null;
          try {
            const sub: any = await stripe.subscriptions.retrieve(String(subId));
            if (sub?.current_period_end) {
              currentPeriodEnd = new Date(sub.current_period_end * 1000).toISOString();
            }
          } catch (e) {}

          const { error: checkoutError } = await supabaseAdmin
            .from('subscriptions')
            .upsert({
              user_id: userId,
              stripe_customer_id: customer,
              stripe_subscription_id: subId,
              plan_type: session.metadata?.plan_type || 'monthly',
              status: 'active',
              current_period_end: currentPeriodEnd,
              updated_at: new Date().toISOString(),
            });
            
          if (checkoutError) {
            console.error('Error in checkout.session.completed:', checkoutError);
          } else {
            console.log(`✅ Checkout completed! User ${userId} is now active.`);
          }
        }
      }
      break;
      
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
