import Stripe from 'stripe';
import { requireEnv } from '@/lib/env';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = requireEnv('STRIPE_SECRET_KEY');
  _stripe = new Stripe(key, {
    apiVersion: '2026-04-22.dahlia' as any,
    typescript: true,
    appInfo: {
      name: 'BiuBiu Tab',
      version: '1.0.0',
    },
  });
  return _stripe;
}
