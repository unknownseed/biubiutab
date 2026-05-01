import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';

export async function POST(request: Request) {
  try {
    const stripe = getStripe();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const body = await request.json();
    const { plan, billingMode } = body;

    if (!['monthly', 'quarterly', 'yearly'].includes(plan)) {
      return NextResponse.json({ error: '无效的订阅方案' }, { status: 400 });
    }
    if (!['subscription', 'one-time'].includes(billingMode)) {
      return NextResponse.json({ error: '无效的付费模式' }, { status: 400 });
    }

    let subPriceId = null;
    if (plan === 'yearly') subPriceId = process.env.STRIPE_PRICE_SUB_YEARLY;
    else if (plan === 'monthly') subPriceId = process.env.STRIPE_PRICE_SUB_MONTHLY;
    else if (plan === 'quarterly') subPriceId = process.env.STRIPE_PRICE_SUB_QUARTERLY;

    let oneTimePriceId = null;
    if (plan === 'yearly') oneTimePriceId = process.env.STRIPE_PRICE_ONETIME_YEARLY;
    else if (plan === 'monthly') oneTimePriceId = process.env.STRIPE_PRICE_ONETIME_MONTHLY;
    else if (plan === 'quarterly') oneTimePriceId = process.env.STRIPE_PRICE_ONETIME_QUARTERLY;

    const priceId = billingMode === 'subscription' ? subPriceId : oneTimePriceId;

    if (!priceId) {
      return NextResponse.json({ error: 'Stripe 价格未配置，请检查环境变量' }, { status: 500 });
    }

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    let customerId = subscription?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      await supabase.from('subscriptions').upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: billingMode === 'subscription' ? 'subscription' : 'payment',
      payment_method_types: billingMode === 'subscription' ? ['card'] : ['card', 'alipay'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/pricing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/pricing?canceled=true`,
      metadata: {
        user_id: user.id,
        plan_type: plan,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe Checkout Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
