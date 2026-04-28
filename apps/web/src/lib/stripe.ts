import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('⚠️ STRIPE_SECRET_KEY is not defined in environment variables.');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-04-22.dahlia' as any,
  typescript: true,
  appInfo: {
    name: 'BiuBiu Tab',
    version: '1.0.0',
  },
});
