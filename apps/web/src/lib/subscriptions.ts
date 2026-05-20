import { createClient } from '@/lib/supabase/server';

export interface UserSubscriptionInfo {
  isPro: boolean;
  planType: 'free' | 'monthly' | 'quarterly' | 'yearly';
  status: string | null;
  currentPeriodEnd: string | null;
  usedQuota: number;
  totalQuota: number;
}

export async function getUserSubscriptionInfoForClient(supabase: any, userId?: string): Promise<UserSubscriptionInfo> {
  const defaultFree: UserSubscriptionInfo = {
    isPro: false,
    planType: 'free',
    status: null,
    currentPeriodEnd: null,
    usedQuota: 0,
    totalQuota: 3,
  };

  if (!userId) return defaultFree;

  // 1. 获取用户的订阅状态
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status, plan_type, current_period_end')
    .eq('user_id', userId)
    .single();

  const now = new Date();
  const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null;
  const hasValidPeriodEnd = periodEnd instanceof Date && !Number.isNaN(periodEnd.getTime());
  const isPro = sub?.status === 'active' && (!hasValidPeriodEnd || periodEnd! > now);
  const planType = isPro ? (sub?.plan_type as UserSubscriptionInfo['planType']) : 'free';
  const totalQuota = isPro ? 100 : 3;

  // 2. 统计本月已使用的生成次数
  // 获取本月的第一天
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // count AI jobs created this month
  const { count } = await supabase
    .from('ai_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', firstDayOfMonth);

  return {
    isPro: !!isPro,
    planType,
    status: sub?.status ?? null,
    currentPeriodEnd: sub?.current_period_end ?? null,
    usedQuota: count || 0,
    totalQuota,
  };
}

export async function getUserSubscriptionInfo(userId?: string): Promise<UserSubscriptionInfo> {
  const supabase = await createClient();
  return getUserSubscriptionInfoForClient(supabase as any, userId);
}
