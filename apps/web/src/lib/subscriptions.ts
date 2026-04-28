import { createClient } from '@/lib/supabase/server';

export interface UserSubscriptionInfo {
  isPro: boolean;
  planType: 'free' | 'monthly' | 'yearly';
  usedQuota: number;
  totalQuota: number;
}

export async function getUserSubscriptionInfo(userId?: string): Promise<UserSubscriptionInfo> {
  const defaultFree: UserSubscriptionInfo = {
    isPro: false,
    planType: 'free',
    usedQuota: 0,
    totalQuota: 3,
  };

  if (!userId) return defaultFree;

  const supabase = await createClient();

  // 1. 获取用户的订阅状态
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status, plan_type, current_period_end')
    .eq('user_id', userId)
    .single();

  const isPro = sub?.status === 'active' && new Date(sub.current_period_end) > new Date();
  const planType = isPro ? sub.plan_type : 'free';
  const totalQuota = isPro ? 100 : 3;

  // 2. 统计本月已使用的生成次数
  // 获取本月的第一天
  const now = new Date();
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
    usedQuota: count || 0,
    totalQuota,
  };
}
